"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SERVICE_PACKAGES, SERVICES } from "@/lib/catalog";

type LiftId = "LIFT_1" | "LIFT_2" | "LIFT_3" | "LIFT_4";
const LIFTS: Array<{ id: LiftId; label: string; color: string; bgLight: string }> = [
  { id: "LIFT_1", label: "Подъёмник 1", color: "#2563eb", bgLight: "#eff6ff" },
  { id: "LIFT_2", label: "Подъёмник 2", color: "#059669", bgLight: "#ecfdf5" },
  { id: "LIFT_3", label: "Подъёмник 3", color: "#d97706", bgLight: "#fffbeb" },
  { id: "LIFT_4", label: "Подъёмник 4", color: "#db2777", bgLight: "#fdf2f8" },
];
const LIFT_BY_ID: Record<LiftId, (typeof LIFTS)[number]> = Object.fromEntries(LIFTS.map((l) => [l.id, l])) as any;

type SearchEntity = {
  entityType: "lead" | "contact" | "deal";
  id: number;
  title: string;
  carBrand?: string;
  phone?: string;
};

type Appointment = {
  id: string;
  dealId: number;
  title: string;
  contactName: string;
  phone?: string;
  carPlate?: string;
  carBrand?: string;
  carModel?: string;
  lift: LiftId | undefined;
  startsAt: string;
  endsAt: string;
  serviceIds: string[];
  packageIds: string[];
  estimateUrl?: string;
  notes?: string;
};

type ViewRange = "TODAY" | "TOMORROW" | "3_DAYS" | "WEEK";
const HOUR_START = 8;
const HOUR_END = 20;
const HOURS: number[] = [];
for (let h = HOUR_START; h <= HOUR_END; h++) HOURS.push(h);
const PX_PER_HOUR = 70;

function pad2(n: number): string { return String(n).padStart(2, "0"); }
function fmtHour(h: number): string { return `${pad2(h)}:00`; }
function fmtISOLocal(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`; }
function fmtTimeShort(iso: string): string { const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function fmtDayHeader(d: Date): { wd: string; num: string; isToday: boolean } {
  const wd = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][d.getDay() === 0 ? 6 : d.getDay() - 1];
  const isToday = new Date().toDateString() === d.toDateString();
  return { wd, num: `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`, isToday };
}
function daysForRange(range: ViewRange, selectedDate: Date): Date[] {
  const base = new Date(selectedDate);
  base.setHours(0, 0, 0, 0);
  if (range === "TODAY") return [new Date(base)];
  if (range === "TOMORROW") { const t = new Date(base); t.setDate(t.getDate() + 1); return [t]; }
  if (range === "3_DAYS") return [0, 1, 2].map((i) => { const d = new Date(base); d.setDate(d.getDate() + i); return d; });
  const monday = new Date(base);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; });
}

const STYLES = {
  page: { background: "#f1f5f9", minHeight: "100vh", color: "#0f172a", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  header: { position: "sticky" as const, top: 0, zIndex: 20, background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "14px 22px", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" },
  h1: { fontSize: 22, fontWeight: 800, margin: 0, color: "#0f172a" },
  sub: { fontSize: 12, color: "#475569", marginTop: 4 },
  row: { display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: 10 },
  tabBtn: (active: boolean) => ({
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    border: "1px solid #cbd5e1",
    background: active ? "#4f46e5" : "#f8fafc",
    color: active ? "#ffffff" : "#334155",
    cursor: "pointer",
  }),
  input: {
    padding: "6px 10px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 13,
    background: "#ffffff",
    color: "#0f172a",
  },
  btn: (primary = true, disabled = false) => ({
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 8,
    border: primary ? "1px solid #4f46e5" : "1px solid #cbd5e1",
    background: primary ? "#4f46e5" : "#ffffff",
    color: primary ? "#ffffff" : "#334155",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  }),
  chip: (c: string, bg: string) => ({
    display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px",
    fontSize: 12, fontWeight: 700, borderRadius: 999, background: bg, color: c,
    border: `1px solid ${c}`,
  }),
  liftCard: { background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)", overflow: "hidden" as const },
  liftHeader: (bg: string, color: string) => ({
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: bg, padding: "10px 18px", borderBottom: "1px solid #e2e8f0",
  }),
  liftBadge: (color: string) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: "6px 14px", borderRadius: 10, background: color, color: "#fff",
    fontWeight: 800, fontSize: 14,
  }),
  smallBtn: {
    padding: "5px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8,
    border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", cursor: "pointer",
  },
  scrollBox: { overflowX: "auto" as const, background: "#fff" },
  gridTable: (nCols: number) => ({ display: "grid", gridTemplateColumns: `90px repeat(${nCols}, minmax(220px, 1fr))`, minWidth: `${90 + nCols * 220}px` }),
  th: (isToday = false) => ({
    padding: "10px 8px", textAlign: "center" as const,
    background: isToday ? "#eef2ff" : "#f8fafc",
    borderLeft: "1px solid #e2e8f0",
    borderBottom: "1px solid #e2e8f0",
    minWidth: 220,
  }),
  thTime: {
    padding: "10px 10px 10px 0", textAlign: "right" as const, fontSize: 11,
    color: "#64748b", fontWeight: 700,
    background: "#f8fafc",
    borderRight: "1px solid #e2e8f0",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky" as const, left: 0, zIndex: 2,
  },
  hourCell: (ri: number) => ({
    position: "relative" as const,
    height: PX_PER_HOUR,
    borderLeft: "1px solid #f1f5f9",
    borderTop: ri === 0 ? "none" : "1px dashed #e2e8f0",
    cursor: "pointer",
    background: "#ffffff",
    minWidth: 220,
  }),
  hourTime: {
    position: "sticky" as const, left: 0, zIndex: 1,
    padding: "0 10px 0 0", textAlign: "right" as const,
    fontSize: 11, fontWeight: 600, color: "#64748b",
    background: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    borderTop: "1px dashed transparent",
    lineHeight: `${PX_PER_HOUR}px`, height: PX_PER_HOUR,
  },
  apptCard: (color: string, bg: string, top: number, h: number) => ({
    position: "absolute" as const,
    left: 6, right: 6, top, height: Math.max(42, h),
    overflow: "hidden", zIndex: 3,
    background: bg,
    border: `1px solid ${color}`,
    borderLeft: `4px solid ${color}`,
    borderRadius: 10,
    padding: "6px 8px",
    boxShadow: "0 2px 6px rgba(15,23,42,0.12)",
    cursor: "grab",
    fontSize: 12, lineHeight: 1.35,
  }),
  apptTitle: { fontWeight: 800, color: "#0f172a", marginBottom: 2 },
  apptSmall: { fontSize: 11, color: "#334155" },
  bxLink: {
    position: "absolute" as const, top: 6, right: 6, fontSize: 10, fontWeight: 800,
    padding: "2px 6px", borderRadius: 4, background: "#4f46e5", color: "#fff", textDecoration: "none",
  },
  modalBackdrop: {
    position: "fixed" as const, inset: 0, zIndex: 50,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20,
  },
  modal: {
    marginTop: 24, width: "100%", maxWidth: 820,
    background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
    boxShadow: "0 24px 50px rgba(15,23,42,0.25)", overflow: "hidden" as const,
  },
  modalHeader: { padding: "14px 22px", background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0" },
  modalBody: { padding: 22, maxHeight: "78vh", overflowY: "auto" as const },
  label: { fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: "#475569", textTransform: "uppercase" as const, display: "block", marginBottom: 8 },
  textInput: {
    width: "100%", padding: "10px 14px", fontSize: 14,
    border: "1px solid #cbd5e1", borderRadius: 12, outline: "none",
    color: "#0f172a", background: "#fff",
  },
  select: { width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #cbd5e1", borderRadius: 12, background: "#fff", color: "#0f172a", fontWeight: 600 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  checkbox: (checked: boolean, color: string) => ({
    display: "flex", alignItems: "flex-start", gap: 10, padding: 12,
    border: `1px solid ${checked ? color : "#e2e8f0"}`,
    background: checked ? (color === "#10b981" ? "#ecfdf5" : "#eef2ff") : "#fff",
    borderRadius: 12, cursor: "pointer",
  }),
};

type NewApptState = {
  defaultLift: LiftId;
  defaultDay: Date;
  defaultStartHour: number;
  defaultStartMinute: number;
  durationMin: number;
  selected: SearchEntity | null;
  serviceIds: string[];
  packageIds: string[];
  notes: string;
  dealId?: number;
};

export default function CalendarPage() {
  const [range, setRange] = useState<ViewRange>("TODAY");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showNew, setShowNew] = useState<NewApptState | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchEntity[]>([]);
  const [searching, setSearching] = useState(false);
  const dragAppointment = useRef<Appointment | null>(null);

  const days = useMemo(() => daysForRange(range, selectedDate), [range, selectedDate]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const from = new Date(days[0]);
      from.setHours(0, 0, 0, 0);
      const to = new Date(days[days.length - 1]);
      to.setDate(to.getDate() + 2);
      const res = await fetch(`/api/bitrix/appointments/sync?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "failed");
      setAppointments((json.data?.appointments || []) as Appointment[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/bitrix/appointments/sync?q=${encodeURIComponent(searchQ)}&types=lead,contact,deal`);
        const j = await r.json();
        setSearchResults(((j.data?.results || []) as SearchEntity[]).slice(0, 15));
      } finally { setSearching(false); }
    }, 280);
    return () => clearTimeout(t);
  }, [searchQ]);

  const onCellClick = (lift: LiftId, day: Date, hour: number, minute = 0) => {
    setShowNew({
      defaultLift: lift,
      defaultDay: new Date(day),
      defaultStartHour: hour,
      defaultStartMinute: minute,
      durationMin: 60,
      selected: null,
      serviceIds: [],
      packageIds: [],
      notes: "",
    });
    setSearchQ("");
  };

  const saveNew = async () => {
    if (!showNew) return;
    const start = new Date(showNew.defaultDay);
    start.setHours(showNew.defaultStartHour, showNew.defaultStartMinute, 0, 0);
    const end = new Date(start.getTime() + showNew.durationMin * 60000);
    const payload = {
      action: "upsert" as const,
      dealId: showNew.dealId ?? null,
      lift: showNew.defaultLift,
      startsAt: fmtISOLocal(start),
      endsAt: fmtISOLocal(end),
      title: showNew.selected?.title || "Новая запись",
      contactName: showNew.selected?.title || "Новая запись",
      phone: showNew.selected?.phone,
      carBrand: showNew.selected?.carBrand,
      contactId: showNew.selected?.entityType === "contact" ? showNew.selected.id : null,
      leadId: showNew.selected?.entityType === "lead" ? showNew.selected.id : null,
      dealCategoryId: 0,
      dealStageId: "NEW",
      serviceIds: showNew.serviceIds,
      packageIds: showNew.packageIds,
      notes: showNew.notes,
    };
    try {
      const r = await fetch("/api/bitrix/appointments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "save failed");
      setShowNew(null);
      setSearchQ("");
      setSearchResults([]);
      await fetchList();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const moveAppt = async (appt: Appointment, targetLift: LiftId, targetDay: Date, hour: number, minute = 0) => {
    const start = new Date(targetDay);
    start.setHours(hour, minute, 0, 0);
    const origStart = new Date(appt.startsAt);
    const origEnd = new Date(appt.endsAt);
    const dur = Math.max(15, Math.round((origEnd.getTime() - origStart.getTime()) / 60000));
    const end = new Date(start.getTime() + dur * 60000);
    try {
      const r = await fetch("/api/bitrix/appointments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", dealId: appt.dealId, lift: targetLift, startsAt: fmtISOLocal(start), endsAt: fmtISOLocal(end) }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "move failed");
      await fetchList();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const rangeLabels: Record<ViewRange, string> = { TODAY: "Сегодня", TOMORROW: "Завтра", "3_DAYS": "3 дня", WEEK: "Неделя" };

  return (
    <div style={STYLES.page}>
      {/* HEADER */}
      <div style={STYLES.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={STYLES.h1}>📅 Календарь подъёмников</h1>
            <div style={STYLES.sub}>4 подъёмника · Рабочие часы 08:00–20:00 · Шаг 15 мин · Синхронизация с Битрикс24</div>
          </div>
          <div style={STYLES.row}>
            <div style={{ ...STYLES.row, border: "1px solid #cbd5e1", borderRadius: 10, overflow: "hidden", background: "#f8fafc" }}>
              {(["TODAY", "TOMORROW", "3_DAYS", "WEEK"] as ViewRange[]).map((v) => (
                <button key={v} onClick={() => setRange(v)} style={{ ...STYLES.tabBtn(range === v), border: "none", borderRadius: 0, borderRight: v !== "WEEK" ? "1px solid #e2e8f0" : "none" }}>{rangeLabels[v]}</button>
              ))}
            </div>
            <input
              type="date"
              style={STYLES.input}
              value={fmtISOLocal(selectedDate).slice(0, 10)}
              onChange={(e) => setSelectedDate(new Date(e.target.value + "T00:00:00"))}
            />
            <button style={STYLES.btn(false)} onClick={() => setSelectedDate(new Date())}>Сегодня</button>
            <button style={STYLES.btn(true, loading)} onClick={fetchList}>{loading ? "⏳ Обновляем…" : "🔄 Обновить"}</button>
          </div>
        </div>

        {/* Legend chips */}
        <div style={{ ...STYLES.row, marginTop: 12, gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginRight: 4 }}>Подъёмники:</div>
          {LIFTS.map((l) => <span key={l.id} style={STYLES.chip(l.color, l.bgLight)}><span style={{ width: 10, height: 10, borderRadius: 999, background: l.color, display: "inline-block" }} />{l.label}</span>)}
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>💡 Клик по пустой ячейке — создать запись · Перетащи карточку — перенести</div>
        </div>

        {err && <div style={{ marginTop: 10, fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>⚠️ {err}</div>}
      </div>

      {/* LIFTS */}
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 22 }}>
        {LIFTS.map((lift) => {
          return (
            <div key={lift.id} style={STYLES.liftCard}>
              <div style={STYLES.liftHeader(lift.bgLight, lift.color)}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={STYLES.liftBadge(lift.color)}>🏗️ {lift.label}</span>
                  <span style={{ fontSize: 12, color: "#475569" }}>Часы работы <b>08:00 – 20:00</b> · <b>15 мин</b> шаг</span>
                </div>
                <button style={STYLES.smallBtn} onClick={() => {
                  const now = new Date();
                  const day = days.find((d) => d.toDateString() === now.toDateString()) || days[0];
                  onCellClick(lift.id, day, Math.max(HOUR_START, Math.min(HOUR_END, now.getHours())), now.getMinutes() < 30 ? 0 : 30);
                }}>+ Новая запись сюда</button>
              </div>

              <div style={STYLES.scrollBox}>
                {/* Header row */}
                <div style={STYLES.gridTable(days.length)}>
                  <div style={STYLES.thTime}>Время</div>
                  {days.map((d, i) => {
                    const hd = fmtDayHeader(d);
                    return (
                      <div key={i} style={STYLES.th(hd.isToday)}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: hd.isToday ? "#4338ca" : "#64748b", textTransform: "uppercase" }}>{hd.wd}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: hd.isToday ? "#312e81" : "#0f172a", marginTop: 2 }}>{hd.num}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Body grid (relative wrapper for absolute cards) */}
                <div style={{ position: "relative" }}>
                  <div style={STYLES.gridTable(days.length)}>
                    {/* Time labels */}
                    <div>
                      {HOURS.map((h, ri) => <div key={h} style={{ ...STYLES.hourTime, borderTop: ri === 0 ? "none" : "1px dashed #e2e8f0" }}>{fmtHour(h)}</div>)}
                    </div>
                    {/* Day columns (each column: cells + inner absolute cards) */}
                    {days.map((day, di) => {
                      const colAppts = appointments.filter((a) => a.lift === lift.id && new Date(a.startsAt).toDateString() === day.toDateString());
                      return (
                        <div key={di} style={{ position: "relative", minWidth: 220, borderLeft: "1px solid #f1f5f9" }}>
                          {/* cells */}
                          {HOURS.map((h, ri) => (
                            <div
                              key={h}
                              style={{ ...STYLES.hourCell(ri), borderLeft: "none", width: "100%" }}
                              onClick={() => onCellClick(lift.id, day, h)}
                              onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                              onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                              onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.background = "#eef2ff"; }}
                              onDragLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                              onDrop={(e) => {
                                e.preventDefault();
                                (e.currentTarget as HTMLDivElement).style.background = "#fff";
                                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                const frac = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
                                const absH = h + frac;
                                const hour = Math.floor(absH);
                                const minute = Math.floor((absH - hour) * 60 / 15) * 15;
                                if (dragAppointment.current) {
                                  moveAppt(dragAppointment.current, lift.id, day, Math.min(HOUR_END, hour), minute);
                                  dragAppointment.current = null;
                                }
                              }}
                            />
                          ))}
                          {/* absolute cards */}
                          {colAppts.map((appt) => {
                            const s = new Date(appt.startsAt);
                            const e = new Date(appt.endsAt);
                            const startHour = s.getHours() + s.getMinutes() / 60;
                            const endHour = e.getHours() + e.getMinutes() / 60;
                            const top = Math.max(0, (startHour - HOUR_START) * PX_PER_HOUR);
                            const hgt = Math.min((HOUR_END + 1 - HOUR_START) * PX_PER_HOUR - top, (endHour - startHour) * PX_PER_HOUR);
                            const l = LIFT_BY_ID[appt.lift || "LIFT_1"] || lift;
                            const carLine = [appt.carPlate, [appt.carBrand, appt.carModel].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
                            return (
                              <div
                                key={appt.id}
                                draggable
                                onDragStart={() => { dragAppointment.current = appt; }}
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setShowNew({
                                    defaultLift: lift.id,
                                    defaultDay: new Date(s),
                                    defaultStartHour: s.getHours(),
                                    defaultStartMinute: s.getMinutes(),
                                    durationMin: Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000)),
                                    selected: null,
                                    serviceIds: appt.serviceIds,
                                    packageIds: appt.packageIds,
                                    notes: appt.notes || "",
                                    dealId: appt.dealId,
                                  });
                                  setSearchQ("");
                                  setSearchResults([]);
                                }}
                                style={STYLES.apptCard(l.color, l.bgLight, top, hgt)}
                              >
                                <a
                                  onClick={(ev) => ev.stopPropagation()}
                                  href={`https://b24-12cc50.bitrix24.com/crm/deal/details/${appt.dealId}/`}
                                  target="_blank" rel="noopener noreferrer"
                                  style={STYLES.bxLink}
                                  title="Открыть сделку в Битрикс24"
                                >BX</a>
                                <div style={STYLES.apptTitle}><span style={{ color: l.color }}>▶</span> {fmtTimeShort(appt.startsAt)}–{fmtTimeShort(appt.endsAt)} {appt.contactName}</div>
                                {appt.phone && <div style={STYLES.apptSmall}>📞 {appt.phone}</div>}
                                {carLine && <div style={{ ...STYLES.apptSmall, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>🚗 {carLine}</div>}
                                {appt.estimateUrl && (
                                  <a onClick={(ev) => ev.stopPropagation()} href={appt.estimateUrl} target="_blank" rel="noopener noreferrer"
                                     style={{ display: "inline-block", marginTop: 2, fontSize: 11, fontWeight: 700, color: "#047857", textDecoration: "underline" }}>📄 Смета PDF →</a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL */}
      {showNew && (
        <div style={STYLES.modalBackdrop} onClick={() => setShowNew(null)}>
          <div style={STYLES.modal} onClick={(e) => e.stopPropagation()}>
            <div style={STYLES.modalHeader}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#1e1b4b" }}>
                {showNew.dealId ? "✏️ Редактировать запись" : "➕ Новая запись на ТО"}
              </div>
              <button onClick={() => setShowNew(null)} style={{ border: "none", background: "transparent", fontSize: 20, color: "#475569", cursor: "pointer" }}>✕</button>
            </div>
            <div style={STYLES.modalBody}>
              {/* 1. Client */}
              <div style={{ marginBottom: 18 }}>
                <label style={STYLES.label}>👤 Клиент — найди существующего или оставь пустым (создадим новую сделку)</label>
                <input style={STYLES.textInput} placeholder="Начни вводить имя, телефон, госномер, марку…"
                  value={searchQ} onChange={(e) => setSearchQ(e.target.value)} autoFocus />
                {searching && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>⏳ ищем в Битрикс…</div>}
                {showNew.selected && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "2px solid #a5b4fc", background: "#eef2ff", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>
                        {showNew.selected.title}
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "#fff", border: "1px solid #c7d2fe", color: "#3730a3", textTransform: "uppercase" }}>{showNew.selected.entityType}</span>
                      </div>
                      {showNew.selected.phone && <div style={{ fontSize: 13, color: "#0f172a", marginTop: 2 }}>📞 {showNew.selected.phone}</div>}
                      {showNew.selected.carBrand && <div style={{ fontSize: 13, color: "#0f172a", marginTop: 2 }}>🚗 {showNew.selected.carBrand}</div>}
                    </div>
                    <button onClick={() => setShowNew({ ...showNew, selected: null })}
                      style={{ border: "none", background: "transparent", color: "#b91c1c", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>очистить</button>
                  </div>
                )}
                {!showNew.selected && searchResults.length > 0 && (
                  <div style={{ marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                    {searchResults.map((r, i) => (
                      <button key={`${r.entityType}-${r.id}`} onClick={() => setShowNew({ ...showNew, selected: r })}
                        style={{
                          width: "100%", textAlign: "left", padding: "10px 14px", background: "#fff",
                          border: "none", borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                          cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
                        }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title} <span style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase", marginLeft: 6 }}>{r.entityType}</span></div>
                          {r.phone && <div style={{ fontSize: 12, color: "#475569" }}>📞 {r.phone}</div>}
                          {r.carBrand && <div style={{ fontSize: 12, color: "#475569" }}>🚗 {r.carBrand}</div>}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#4338ca" }}>Выбрать →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Time + Lift */}
              <div style={{ marginBottom: 18 }}>
                <label style={STYLES.label}>🕒 Время и подъёмник</label>
                <div style={STYLES.twoCol}>
                  <div>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 600 }}>🏗️ Подъёмник</div>
                    <select style={STYLES.select} value={showNew.defaultLift}
                      onChange={(e) => setShowNew({ ...showNew, defaultLift: e.target.value as LiftId })}>
                      {LIFTS.map((l) => <option key={l.id} value={l.id}>● {l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 600 }}>📆 Дата</div>
                    <input type="date" style={STYLES.select}
                      value={fmtISOLocal(showNew.defaultDay).slice(0, 10)}
                      onChange={(e) => setShowNew({ ...showNew, defaultDay: new Date(e.target.value + "T00:00:00") })} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 600 }}>⏱️ Начало</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <select style={STYLES.select} value={showNew.defaultStartHour}
                        onChange={(e) => setShowNew({ ...showNew, defaultStartHour: Number(e.target.value) })}>
                        {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
                      </select>
                      <select style={STYLES.select} value={showNew.defaultStartMinute}
                        onChange={(e) => setShowNew({ ...showNew, defaultStartMinute: Number(e.target.value) })}>
                        {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{pad2(m)} мин</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 600 }}>⏳ Длительность</div>
                    <select style={STYLES.select} value={showNew.durationMin}
                      onChange={(e) => setShowNew({ ...showNew, durationMin: Number(e.target.value) })}>
                      {[15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300].map((m) => (
                        <option key={m} value={m}>{m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ""}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Services */}
              <div style={{ marginBottom: 18 }}>
                <label style={STYLES.label}>🔧 Услуги</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {SERVICES.map((s) => {
                    const on = showNew.serviceIds.includes(s.id);
                    return (
                      <label key={s.id} style={STYLES.checkbox(on, "#4338ca")}>
                        <input type="checkbox" checked={on}
                          onChange={(e) => {
                            const set = new Set(showNew.serviceIds);
                            if (e.target.checked) set.add(s.id); else set.delete(s.id);
                            setShowNew({ ...showNew, serviceIds: Array.from(set) });
                          }} style={{ marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{s.description}</div>
                          <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a", marginTop: 2 }}>{s.price.toLocaleString("ru-RU")} ₽</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 4. Packages */}
              <div style={{ marginBottom: 18 }}>
                <label style={STYLES.label}>📦 Пакеты услуг (скидка)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {SERVICE_PACKAGES.map((p) => {
                    const on = showNew.packageIds.includes(p.id);
                    return (
                      <label key={p.id} style={STYLES.checkbox(on, "#10b981")}>
                        <input type="checkbox" checked={on}
                          onChange={(e) => {
                            const set = new Set(showNew.packageIds);
                            if (e.target.checked) set.add(p.id); else set.delete(p.id);
                            setShowNew({ ...showNew, packageIds: Array.from(set) });
                          }} style={{ marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name} <span style={{ color: "#047857", fontSize: 11 }}>— скидка {p.discount}%</span></div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{p.description}</div>
                          <div style={{ marginTop: 4 }}>
                            {p.services.map((si) => {
                              const svc = SERVICES.find((ss) => ss.id === si.serviceId);
                              return <span key={si.serviceId} style={{ display: "inline-block", margin: "0 6px 3px 0", padding: "2px 6px", borderRadius: 4, fontSize: 11, background: "#fff", border: "1px solid #e2e8f0", color: "#0f172a" }}>✓ {svc?.name || si.serviceId} ×{si.quantity}</span>;
                            })}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 5. Notes */}
              <div style={{ marginBottom: 18 }}>
                <label style={STYLES.label}>📝 Примечания</label>
                <textarea style={{ ...STYLES.textInput, minHeight: 84 }}
                  placeholder="Клиент просил заменить колодки передние, проверить сход-развал…"
                  value={showNew.notes}
                  onChange={(e) => setShowNew({ ...showNew, notes: e.target.value })}
                />
              </div>

              {/* Sum */}
              <div style={{ marginBottom: 18, padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 13, color: "#334155" }}>
                  Выбрано услуг: <b style={{ color: "#0f172a" }}>{showNew.serviceIds.length}</b>, пакетов: <b style={{ color: "#0f172a" }}>{showNew.packageIds.length}</b>
                </div>
                <button
                  onClick={(ev) => {
                    ev.preventDefault();
                    const sum = (showNew.serviceIds || []).reduce((acc, sid) => acc + (SERVICES.find((s) => s.id === sid)?.price || 0), 0)
                      + (showNew.packageIds || []).reduce((total, pid) => {
                        const pkg = SERVICE_PACKAGES.find((pp) => pp.id === pid);
                        if (!pkg) return total;
                        const s = pkg.services.reduce((acc, si) => acc + (SERVICES.find((ss) => ss.id === si.serviceId)?.price || 0) * si.quantity, 0);
                        return total + Math.round(s * (1 - (pkg.discount || 0) / 100));
                      }, 0);
                    alert(`Предварительная сумма: ${sum.toLocaleString("ru-RU")} ₽`);
                  }}
                  style={{ border: "none", background: "transparent", color: "#4338ca", fontSize: 12, fontWeight: 800, textDecoration: "underline", cursor: "pointer" }}
                >Посчитать сумму →</button>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={{ flex: 1, padding: "11px 18px", fontSize: 13, fontWeight: 700, borderRadius: 12, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", cursor: "pointer" }} onClick={() => setShowNew(null)}>Отмена</button>
                <button
                  disabled={!showNew.dealId}
                  style={{ flex: 1, padding: "11px 18px", fontSize: 13, fontWeight: 800, borderRadius: 12, border: "1px solid #059669", background: showNew.dealId ? "#059669" : "#e2e8f0", color: showNew.dealId ? "#fff" : "#94a3b8", cursor: showNew.dealId ? "pointer" : "not-allowed" }}
                  onClick={async () => {
                    if (!showNew.dealId) return alert("Сначала сохраните запись — после сохранения можно создать смету PDF в Moloni.");
                    try {
                      const r = await fetch("/api/estimates/build", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          dealId: showNew.dealId,
                          serviceIds: showNew.serviceIds, packageIds: showNew.packageIds,
                          customerName: showNew.selected?.title || "Клиент", createInMoloni: true,
                        }),
                      });
                      const j = await r.json();
                      if (!j.ok) throw new Error(j.error || "estimate build failed");
                      alert("Смета создана ✅ Ссылка: " + (j.data?.pdf || j.data?.pdf_download_link || JSON.stringify(j.data)));
                      await fetchList();
                      setShowNew(null);
                    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
                  }}
                >📄 Создать смету PDF {showNew.dealId ? "" : "(сначала сохрани)"}</button>
                <button style={{ flex: 1.4, padding: "11px 18px", fontSize: 14, fontWeight: 900, borderRadius: 12, border: "1px solid #4338ca", background: "#4338ca", color: "#fff", cursor: "pointer" }} onClick={saveNew}>💾 Сохранить запись</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
