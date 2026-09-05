"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SERVICE_PACKAGES, SERVICES } from "@/lib/catalog";

type LiftId = "LIFT_1" | "LIFT_2" | "LIFT_3" | "LIFT_4";
const LIFTS: Array<{ id: LiftId; label: string; color: string; soft: string; accent: string }> = [
  { id: "LIFT_1", label: "Подъёмник 1", color: "#2563eb", soft: "#eff6ff", accent: "border-blue-500 bg-blue-50" },
  { id: "LIFT_2", label: "Подъёмник 2", color: "#059669", soft: "#ecfdf5", accent: "border-emerald-500 bg-emerald-50" },
  { id: "LIFT_3", label: "Подъёмник 3", color: "#d97706", soft: "#fffbeb", accent: "border-amber-500 bg-amber-50" },
  { id: "LIFT_4", label: "Подъёмник 4", color: "#db2777", soft: "#fdf2f8", accent: "border-pink-500 bg-pink-50" },
];

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

type ViewRange = "TODAY" | "TOMORROW" | "WEEK" | "3_DAYS";

const HOURS: number[] = [];
for (let h = 8; h <= 20; h++) HOURS.push(h);
const PX_PER_HOUR = 72;

function fmtHour(h: number): string {
  return String(h).padStart(2, "0") + ":00";
}

function fmtDayHeader(d: Date): { wd: string; num: string; isToday: boolean } {
  const wd = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][d.getDay() === 0 ? 6 : d.getDay() - 1];
  const isToday = new Date().toDateString() === d.toDateString();
  return { wd, num: `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, "0")}`, isToday };
}

function fmtISOLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function fmtTimeShort(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function daysForRange(range: ViewRange, selectedDate: Date): Date[] {
  const base = new Date(selectedDate);
  base.setHours(0, 0, 0, 0);
  if (range === "TODAY") return [new Date(base)];
  if (range === "TOMORROW") {
    const t = new Date(base);
    t.setDate(t.getDate() + 1);
    return [t];
  }
  if (range === "3_DAYS") return [0, 1, 2].map((i) => { const d = new Date(base); d.setDate(d.getDate() + i); return d; });
  // WEEK = понедельник по воскресенье этой недели
  const monday = new Date(base);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

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
  const [dragOffsetMin, setDragOffsetMin] = useState(0);
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

  // Debounced search
  useEffect(() => {
    if (!searchQ.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/bitrix/appointments/sync?q=${encodeURIComponent(searchQ)}&types=lead,contact,deal`);
        const j = await r.json();
        setSearchResults(((j.data?.results || []) as SearchEntity[]).slice(0, 15));
      } finally {
        setSearching(false);
      }
    }, 250);
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
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const moveAppt = async (appt: Appointment, targetLift: LiftId, targetDay: Date, hour: number, minute = 0) => {
    const start = new Date(targetDay);
    start.setHours(hour, minute, 0, 0);
    const origStart = new Date(appt.startsAt);
    const origEnd = new Date(appt.endsAt);
    const dur = Math.max(15, minutesBetween(origStart, origEnd));
    const end = new Date(start.getTime() + dur * 60000);
    try {
      const r = await fetch("/api/bitrix/appointments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          dealId: appt.dealId,
          lift: targetLift,
          startsAt: fmtISOLocal(start),
          endsAt: fmtISOLocal(end),
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "move failed");
      await fetchList();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  // Column count for responsive grid
  const dayCols = days.length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <style>{`
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        * { box-sizing: border-box; }
      `}</style>

      {/* ============== HEADER ============== */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">📅 Календарь подъёмников</h1>
            <p className="text-xs text-slate-500 mt-1">Создай запись в 1 клик, перемещай Drag&Drop, синхронизация с Битрикс24</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Range tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50 text-sm">
              {(["TODAY", "TOMORROW", "3_DAYS", "WEEK"] as ViewRange[]).map((v) => {
                const labels: Record<ViewRange, string> = { TODAY: "Сегодня", TOMORROW: "Завтра", "3_DAYS": "3 дня", WEEK: "Неделя" };
                const active = range === v;
                return (
                  <button
                    key={v}
                    className={`px-3 py-1.5 ${active ? "bg-indigo-600 text-white font-semibold" : "text-slate-600 hover:bg-slate-100"}`}
                    onClick={() => setRange(v)}
                  >{labels[v]}</button>
                );
              })}
            </div>
            {/* Date picker */}
            <input
              type="date"
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={fmtISOLocal(selectedDate).slice(0, 10)}
              onChange={(e) => setSelectedDate(new Date(e.target.value + "T00:00:00"))}
            />
            <button
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm hover:bg-slate-50"
              onClick={() => setSelectedDate(new Date())}
            >Сегодня</button>
            <button
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
              disabled={loading}
              onClick={fetchList}
            >{loading ? "Обновляем…" : "🔄 Обновить"}</button>
          </div>
        </div>

        {/* Filter chips by Lift */}
        <div className="px-6 pb-3 flex items-center gap-3 flex-wrap border-b border-slate-100">
          <div className="text-xs font-semibold text-slate-500 mr-1">Показать подъёмники:</div>
          {LIFTS.map((l) => (
            <div
              key={l.id}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${l.accent}`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
              {l.label}
            </div>
          ))}
          <div className="ml-auto text-xs text-slate-500">
            💡 Клик по пустой ячейке — создать запись • Перетащи карточку — перенести
          </div>
        </div>

        {err && (
          <div className="px-6 pb-3">
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              Ошибка: {err}
            </div>
          </div>
        )}
      </div>

      {/* ============== GRID ============== */}
      <div className="p-6 space-y-8">
        {LIFTS.map((lift) => (
          <section
            key={lift.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            {/* Lift Header (big) */}
            <div
              className="px-5 py-3 border-b border-slate-200 flex items-center justify-between"
              style={{ backgroundColor: lift.soft }}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center rounded-xl px-4 py-1.5 text-white text-base font-bold shadow-sm"
                  style={{ backgroundColor: lift.color }}
                >🏗️ {lift.label}</span>
                <div className="text-xs text-slate-600">
                  Рабочие часы <b>08:00 – 20:00</b> • Шаг <b>15 мин</b>
                </div>
              </div>
              <button
                className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 font-semibold"
                onClick={() => {
                  const now = new Date();
                  onCellClick(lift.id, days.find(d => d.toDateString() === now.toDateString()) || days[0], Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], now.getHours())), now.getMinutes() < 30 ? 0 : 30);
                }}
              >+ Новая запись сюда</button>
            </div>

            {/* Day columns grid for this lift */}
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${120 + dayCols * 240}px` }}>
                {/* Column day headers */}
                <div className="grid border-b border-slate-200 bg-slate-50"
                  style={{ gridTemplateColumns: `80px repeat(${dayCols}, minmax(240px, 1fr))` }}
                >
                  <div className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 border-r border-slate-200 flex items-center justify-end">
                    Время
                  </div>
                  {days.map((d, i) => {
                    const hd = fmtDayHeader(d);
                    return (
                      <div
                        key={i}
                        className={`py-2.5 px-3 text-center border-l border-slate-200 ${hd.isToday ? "bg-indigo-50" : ""}`}
                      >
                        <div className={`text-[11px] uppercase tracking-wide font-bold ${hd.isToday ? "text-indigo-700" : "text-slate-500"}`}>{hd.wd}</div>
                        <div className={`text-base font-extrabold ${hd.isToday ? "text-indigo-800" : "text-slate-800"}`}>{hd.num}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Hours rows × days cols */}
                <div className="grid relative"
                  style={{ gridTemplateColumns: `80px repeat(${dayCols}, minmax(240px, 1fr))` }}
                >
                  {/* Time column (left sticky) */}
                  <div className="sticky left-0 z-10 bg-white border-r border-slate-200">
                    {HOURS.map((h, ri) => (
                      <div
                        key={h}
                        className={`px-3 py-1 text-right text-[11px] font-semibold text-slate-500 ${ri === 0 ? "" : "border-t border-dashed border-slate-200"}`}
                        style={{ height: PX_PER_HOUR, lineHeight: `${PX_PER_HOUR - 8}px` }}
                      >{fmtHour(h)}</div>
                    ))}
                  </div>
                  {/* Day columns (cells) */}
                  {days.map((day, di) => {
                    const colAppts = appointments.filter(a => {
                      if (!a.lift || a.lift !== lift.id) return false;
                      return new Date(a.startsAt).toDateString() === day.toDateString();
                    });
                    return (
                      <div
                        key={di}
                        className="relative border-l border-slate-200"
                        style={{ height: HOURS.length * PX_PER_HOUR, minWidth: 240 }}
                      >
                        {/* Hour cells */}
                        {HOURS.map((h, ri) => (
                          <div
                            key={h}
                            className={`${ri === 0 ? "" : "border-t border-dashed border-slate-100"} cursor-pointer hover:bg-slate-50`}
                            style={{ height: PX_PER_HOUR }}
                            onClick={() => onCellClick(lift.id, day, h)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                              const frac = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
                              const startOfDay = HOURS[0];
                              const endOfDay = HOURS[HOURS.length - 1] + 1;
                              const totalHours = endOfDay - startOfDay;
                              const absH = startOfDay + frac * totalHours;
                              const hour = Math.floor(absH);
                              const minute = Math.floor((absH - hour) * 60 / 15) * 15;
                              if (dragAppointment.current) {
                                moveAppt(dragAppointment.current, lift.id, day, Math.min(HOURS[HOURS.length - 1], hour), minute);
                                dragAppointment.current = null;
                              }
                            }}
                          />
                        ))}

                        {/* Appointment cards */}
                        {colAppts.map((appt) => {
                          const s = new Date(appt.startsAt);
                          const e = new Date(appt.endsAt);
                          const startHour = s.getHours() + s.getMinutes() / 60;
                          const endHour = e.getHours() + e.getMinutes() / 60;
                          const firstH = HOURS[0];
                          const top = Math.max(0, (startHour - firstH) * PX_PER_HOUR);
                          const height = Math.max(40, Math.min(HOURS.length * PX_PER_HOUR - top, (endHour - startHour) * PX_PER_HOUR));
                          const carLine = [appt.carPlate, [appt.carBrand, appt.carModel].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
                          return (
                            <div
                              key={appt.id}
                              draggable
                              onDragStart={() => {
                                dragAppointment.current = appt;
                                const now = new Date();
                                setDragOffsetMin((now.getHours() - firstH) * 60 + now.getMinutes());
                              }}
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
                              className="absolute left-1.5 right-1.5 rounded-xl px-3 py-2 text-[12px] leading-snug shadow-md cursor-grab active:cursor-grabbing border-l-4"
                              style={{
                                top,
                                height,
                                overflow: "hidden",
                                backgroundColor: lift.soft,
                                borderLeftColor: lift.color,
                                border: `1px solid ${lift.color}`,
                                borderLeftWidth: 4,
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-extrabold text-slate-900 truncate">
                                  <span style={{ color: lift.color }}>▶</span> {fmtTimeShort(appt.startsAt)}–{fmtTimeShort(appt.endsAt)} {" "}
                                  <span className="text-slate-800">{appt.contactName}</span>
                                </div>
                                <a
                                  onClick={(ev) => ev.stopPropagation()}
                                  href={`https://b24-12cc50.bitrix24.com/crm/deal/details/${appt.dealId}/`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="shrink-0 text-[10px] font-bold bg-indigo-600 text-white rounded-md px-2 py-0.5 hover:bg-indigo-700"
                                  title="Открыть сделку в Битрикс24"
                                >BX</a>
                              </div>
                              {appt.phone && <div className="text-slate-600 truncate text-[11px]">📞 {appt.phone}</div>}
                              {carLine && <div className="mt-0.5 font-semibold text-slate-800 text-[11px] truncate">🚗 {carLine}</div>}
                              {appt.estimateUrl && (
                                <div className="mt-0.5 truncate text-[11px]">
                                  <a onClick={(ev) => ev.stopPropagation()} href={appt.estimateUrl} target="_blank" rel="noopener noreferrer"
                                     className="text-emerald-700 underline font-semibold">📄 Смета PDF →</a>
                                </div>
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
          </section>
        ))}
      </div>

      {/* ============== MODAL ============== */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4" style={{ backgroundColor: "rgba(15, 23, 42, 0.5)" }}
          onClick={() => setShowNew(null)}
        >
          <div className="mt-6 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#eef2ff" }}>
              <h2 className="text-lg font-extrabold text-slate-800">
                {showNew.dealId ? "✏️ Редактировать запись" : "➕ Новая запись на ТО"}
              </h2>
              <button className="text-slate-500 hover:text-slate-800 text-lg" onClick={() => setShowNew(null)}>✕</button>
            </div>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* 1. Клиент */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600 block mb-2">👤 Клиент</label>
                <input
                  autoFocus
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Начни вводить имя, телефон, госномер, марку… и сразу появятся подсказки"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {searching && <div className="text-xs text-slate-400 mt-1">⏳ ищем…</div>}
                {showNew.selected && (
                  <div className="mt-2 rounded-xl border-2 border-indigo-300 bg-indigo-50 px-4 py-3 text-sm flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800">{showNew.selected.title}
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-white rounded px-1.5 py-0.5 border border-slate-200 text-slate-600">{showNew.selected.entityType}</span>
                      </div>
                      {showNew.selected.phone && <div className="text-sm text-slate-700 mt-0.5">📞 {showNew.selected.phone}</div>}
                      {showNew.selected.carBrand && <div className="text-sm text-slate-700 mt-0.5">🚗 {showNew.selected.carBrand}</div>}
                    </div>
                    <button className="text-xs text-red-600 font-semibold hover:underline" onClick={() => setShowNew({ ...showNew, selected: null })}>очистить</button>
                  </div>
                )}
                {!showNew.selected && searchResults.length > 0 && (
                  <div className="mt-2 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    {searchResults.map((r) => (
                      <button
                        type="button"
                        key={`${r.entityType}-${r.id}`}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start justify-between gap-3"
                        onClick={() => setShowNew({ ...showNew, selected: r })}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{r.title}
                            <span className="ml-2 text-[10px] text-slate-500 uppercase font-bold">{r.entityType}</span>
                          </div>
                          {r.phone && <div className="text-xs text-slate-600">📞 {r.phone}</div>}
                          {r.carBrand && <div className="text-xs text-slate-600">🚗 {r.carBrand}</div>}
                        </div>
                        <span className="text-xs font-bold text-indigo-600 shrink-0">Выбрать →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Время/Подъёмник */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600 block mb-2">🕒 Время и подъёмник</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">🏗️ Подъёмник</label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                      value={showNew.defaultLift}
                      onChange={(e) => setShowNew({ ...showNew, defaultLift: e.target.value as LiftId })}
                    >
                      {LIFTS.map((l) => <option key={l.id} value={l.id}>● {l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">📆 Дата</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                      value={fmtISOLocal(showNew.defaultDay).slice(0, 10)}
                      onChange={(e) => setShowNew({ ...showNew, defaultDay: new Date(e.target.value + "T00:00:00") })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">⏱️ Начало</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="rounded-xl border border-slate-300 px-2 py-2 text-sm font-semibold"
                        value={showNew.defaultStartHour}
                        onChange={(e) => setShowNew({ ...showNew, defaultStartHour: Number(e.target.value) })}
                      >
                        {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
                      </select>
                      <select
                        className="rounded-xl border border-slate-300 px-2 py-2 text-sm font-semibold"
                        value={showNew.defaultStartMinute}
                        onChange={(e) => setShowNew({ ...showNew, defaultStartMinute: Number(e.target.value) })}
                      >
                        {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{m.toString().padStart(2, "0")} мин</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">⏳ Длительность</label>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                      value={showNew.durationMin}
                      onChange={(e) => setShowNew({ ...showNew, durationMin: Number(e.target.value) })}
                    >
                      {[15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300].map((m) => (
                        <option key={m} value={m}>
                          {m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${m % 60 === 0 ? "" : (m % 60 + " мин")}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Услуги */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600 block mb-2">🔧 Услуги</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SERVICES.map((s) => {
                    const on = showNew.serviceIds.includes(s.id);
                    return (
                      <label key={s.id}
                        className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 cursor-pointer text-sm ${on ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={on}
                          onChange={(e) => {
                            const set = new Set(showNew.serviceIds);
                            if (e.target.checked) set.add(s.id); else set.delete(s.id);
                            setShowNew({ ...showNew, serviceIds: Array.from(set) });
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{s.name}</div>
                          <div className="text-[11px] text-slate-500">{s.description}</div>
                          <div className="text-sm font-extrabold text-slate-800">{s.price.toLocaleString("ru-RU")} ₽</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 4. Пакеты */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600 block mb-2">📦 Пакеты услуг (скидка)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SERVICE_PACKAGES.map((p) => {
                    const on = showNew.packageIds.includes(p.id);
                    return (
                      <label key={p.id}
                        className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 cursor-pointer text-sm ${on ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={on}
                          onChange={(e) => {
                            const set = new Set(showNew.packageIds);
                            if (e.target.checked) set.add(p.id); else set.delete(p.id);
                            setShowNew({ ...showNew, packageIds: Array.from(set) });
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{p.name} <span className="text-xs text-emerald-700 font-bold">-{p.discount}%</span></div>
                          <div className="text-[11px] text-slate-500">{p.description}</div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {p.services.map((si) => {
                              const svc = SERVICES.find((ss) => ss.id === si.serviceId);
                              return <span key={si.serviceId} className="inline-block mr-2 mb-0.5 rounded bg-white px-1.5 border border-slate-200">✓ {svc?.name || si.serviceId} ×{si.quantity}</span>;
                            })}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 5. Примечания */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600 block mb-2">📝 Примечания</label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm min-h-[80px]"
                  placeholder="Клиент просил заменить колодки передние, проверить сход-развал…"
                  value={showNew.notes}
                  onChange={(e) => setShowNew({ ...showNew, notes: e.target.value })}
                />
              </div>

              {/* Итог */}
              <div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Выбрано услуг: <b className="text-slate-900">{showNew.serviceIds.length}</b>, пакетов: <b className="text-slate-900">{showNew.packageIds.length}</b></span>
                  <a
                    onClick={(ev) => {
                      ev.preventDefault();
                      const sum = (showNew.serviceIds || []).reduce((acc, sid) => acc + (SERVICES.find((s) => s.id === sid)?.price || 0), 0)
                        + (showNew.packageIds || []).reduce((acc, pid) => {
                          const pkg = SERVICE_PACKAGES.find((pp) => pp.id === pid);
                          if (!pkg) return acc;
                          let s = pkg.services.reduce((a, si) => a + (SERVICES.find((ss) => ss.id === si.serviceId)?.price || 0) * si.quantity, 0);
                          return acc + Math.round(s * (1 - (pkg.discount || 0) / 100));
                        }, 0);
                      alert(`Предварительная сумма (заказ): ${sum.toLocaleString("ru-RU")} ₽`);
                    }}
                    href="#"
                    className="text-xs font-bold text-indigo-700 underline"
                  >Посчитать примерную сумму →</a>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-wrap items-stretch gap-2 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-slate-100 text-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-200"
                  onClick={() => setShowNew(null)}
                >Отмена</button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-emerald-700 disabled:opacity-60"
                  disabled={!showNew.dealId}
                  onClick={async () => {
                    if (!showNew.dealId) return alert("Сначала сохраните запись (кнопка ниже), затем можно создать смету.");
                    try {
                      const r = await fetch("/api/estimates/build", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dealId: showNew.dealId, serviceIds: showNew.serviceIds, packageIds: showNew.packageIds, customerName: showNew.selected?.title || "Клиент", createInMoloni: true }),
                      });
                      const j = await r.json();
                      if (!j.ok) throw new Error(j.error || "estimate build failed");
                      alert("Смета создана ✅. Ссылка: " + (j.data?.pdf || j.data?.pdf_download_link || JSON.stringify(j.data)));
                      await fetchList();
                      setShowNew(null);
                    } catch (e) {
                      alert(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >📄 Создать смету PDF {showNew.dealId ? "" : "(сначала сохрани)"}</button>
                <button
                  type="button"
                  className="flex-[1.5] rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-sm font-extrabold hover:bg-indigo-700"
                  onClick={saveNew}
                >💾 Сохранить запись</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
