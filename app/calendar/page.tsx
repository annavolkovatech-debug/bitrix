"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SERVICE_PACKAGES, SERVICES } from "@/lib/catalog";

type LiftId = "LIFT_1" | "LIFT_2" | "LIFT_3" | "LIFT_4";
const LIFTS: Array<{ id: LiftId; label: string; color: string; soft: string }> = [
  { id: "LIFT_1", label: "Подъёмник 1", color: "#3b82f6", soft: "#dbeafe" },
  { id: "LIFT_2", label: "Подъёмник 2", color: "#10b981", soft: "#d1fae5" },
  { id: "LIFT_3", label: "Подъёмник 3", color: "#f59e0b", soft: "#fef3c7" },
  { id: "LIFT_4", label: "Подъёмник 4", color: "#ec4899", soft: "#fce7f3" },
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

const HOURS: number[] = [];
for (let h = 8; h <= 20; h++) HOURS.push(h);
const PX_PER_HOUR = 64;

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function fmtHour(h: number): string {
  return String(h).padStart(2, "0") + ":00";
}

function fmtDateHeader(d: Date): string {
  const wd = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"][d.getDay() === 0 ? 6 : d.getDay() - 1];
  return `${wd} ${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
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
  return (b.getTime() - a.getTime()) / 60000;
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
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showNew, setShowNew] = useState<NewApptState | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchEntity[]>([]);
  const [searching, setSearching] = useState(false);
  const dragAppointment = useRef<Appointment | null>(null);

  const days = useMemo(() => LIFTS.map(() => 0).map(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)))[0] ?? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  // ^ dummy to simplify: 7 days array
  const sevenDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const from = addDays(weekStart, -1).toISOString();
      const to = addDays(weekStart, 8).toISOString();
      const res = await fetch(`/api/bitrix/appointments/sync?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "failed");
      setAppointments((json.data?.appointments || []) as Appointment[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

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

  const onCellClick = (lift: LiftId, day: Date, hour: number) => {
    setShowNew({
      defaultLift: lift,
      defaultDay: new Date(day),
      defaultStartHour: hour,
      defaultStartMinute: 0,
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
    const dur = Math.max(30, minutesBetween(origStart, origEnd));
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <style>{`
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        * { box-sizing: border-box; }
        .scroll-x { overflow-x: auto; }
        .no-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
      `}</style>

      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">Календарь подъёмников</h1>
            <p className="text-xs text-slate-500 mt-1">{sevenDays[0].toLocaleDateString("ru-RU")} — {addDays(sevenDays[6], 0).toLocaleDateString("ru-RU")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-sm"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >← Неделя</button>
            <button
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              onClick={() => setWeekStart(mondayOf(new Date()))}
            >Сегодня</button>
            <button
              className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-sm"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >Неделя →</button>
            <button
              className="ml-2 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-sm"
              onClick={fetchList}
              disabled={loading}
            >{loading ? "Загрузка…" : "Обновить"}</button>
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

      {/* GRID */}
      <div className="p-6">
        <div className="scroll-x bg-white rounded-xl border border-slate-200 shadow-sm">
          <div style={{ minWidth: 1160 }}>
            {/* Lifts + day header row */}
            <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: `72px repeat(7, minmax(148px, 1fr))` }}>
              <div className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 p-2 text-xs font-semibold text-slate-500 flex items-center justify-center">
                Часы
              </div>
              {LIFTS.map((lift) => (
                <React.Fragment key={lift.id}>
                  {/* we have 7 days × 4 lifts actually. Adjust grid: */}
                </React.Fragment>
              ))}
              {/* Simple design: grid = cols [time, 7 days] × 4 blocks rows (lift 1-4) */}
              <div className="col-span-7 flex items-center">
                {sevenDays.map((d, i) => {
                  const isToday = new Date().toDateString() === d.toDateString();
                  return (
                    <div key={i} className={`flex-1 p-2 text-center border-l ${i === 0 ? "" : "border-slate-200"} ${isToday ? "bg-indigo-50" : ""}`}>
                      <div className={`text-xs font-semibold ${isToday ? "text-indigo-700" : "text-slate-600"}`}>{fmtDateHeader(d)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4 Lifts sections */}
            {LIFTS.map((lift) => (
              <React.Fragment key={lift.id}>
                {/* Lift sub-header */}
                <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: `72px repeat(7, minmax(148px, 1fr))` }}>
                  <div
                    className="sticky left-0 z-10 px-3 py-2 border-r border-slate-200 text-sm font-semibold"
                    style={{ backgroundColor: lift.soft, color: "#0f172a" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: lift.color }} />
                      {lift.label}
                    </div>
                  </div>
                  <div className="col-span-7 flex items-stretch">
                    {sevenDays.map((_, i) => (
                      <div key={i} className={`flex-1 border-l ${i === 0 ? "" : "border-slate-200"}`} />
                    ))}
                  </div>
                </div>
                {/* Hours rows for this lift + 7 days */}
                <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `72px repeat(7, minmax(148px, 1fr))` }}>
                  <div className="border-r border-slate-200 relative sticky left-0 z-10 bg-white">
                    {HOURS.map((h, ri) => (
                      <div
                        key={h}
                        className={`px-2 py-1 text-xs text-slate-500 text-right ${ri === 0 ? "" : "border-t border-dashed border-slate-200"}`}
                        style={{ height: PX_PER_HOUR, lineHeight: `${PX_PER_HOUR - 8}px` }}
                      >{fmtHour(h)}</div>
                    ))}
                  </div>
                  {/* 7 day columns */}
                  {sevenDays.map((day, di) => {
                    const colAppts = appointments.filter(a => {
                      if (!a.lift || a.lift !== lift.id) return false;
                      const sd = new Date(a.startsAt);
                      return sd.toDateString() === day.toDateString();
                    });
                    return (
                      <div
                        key={di}
                        className={`relative ${di === 0 ? "" : "border-l border-slate-200"}`}
                        style={{ height: HOURS.length * PX_PER_HOUR, minWidth: 148 }}
                      >
                        {/* hour lines inside column */}
                        {HOURS.map((h, ri) => (
                          <div
                            key={h}
                            className={`${ri === 0 ? "" : "border-t border-dashed border-slate-100"}`}
                            style={{ height: PX_PER_HOUR }}
                            onClick={() => onCellClick(lift.id, day, h)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                              const x = e.clientY - rect.top;
                              const minutePct = Math.min(1, Math.max(0, x / rect.height));
                              const totalMin = minutePct * HOURS.length * 60;
                              const hour = Math.floor(totalMin / 60) + HOURS[0];
                              const minute = Math.floor(totalMin % 60 / 30) * 30;
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
                          const topPx = Math.max(0, (startHour - firstH) * PX_PER_HOUR);
                          const hPx = Math.max(38, (endHour - startHour) * PX_PER_HOUR);
                          const carLine = [appt.carPlate, [appt.carBrand, appt.carModel].filter(Boolean).join(" ")].filter(Boolean).join("  · ");
                          return (
                            <div
                              key={appt.id}
                              draggable
                              onDragStart={() => { dragAppointment.current = appt; }}
                              onClick={(ev) => { ev.stopPropagation(); setShowNew({
                                defaultLift: lift.id,
                                defaultDay: new Date(s),
                                defaultStartHour: s.getHours(),
                                defaultStartMinute: s.getMinutes(),
                                durationMin: Math.max(30, Math.round((e.getTime() - s.getTime()) / 60000)),
                                selected: null,
                                serviceIds: appt.serviceIds,
                                packageIds: appt.packageIds,
                                notes: appt.notes || "",
                                dealId: appt.dealId,
                              }); setSearchQ(""); setSearchResults([]); }}
                              className="absolute left-1 right-1 rounded-lg px-2 py-1.5 text-[11px] leading-tight shadow-sm cursor-grab active:cursor-grabbing border"
                              style={{
                                top: topPx,
                                height: hPx,
                                backgroundColor: lift.soft,
                                borderColor: lift.color,
                                overflow: "hidden",
                              }}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="font-semibold truncate" style={{ color: "#0f172a" }}>
                                  {fmtTimeShort(appt.startsAt)}–{fmtTimeShort(appt.endsAt)}  {appt.contactName}
                                </div>
                                <a
                                  onClick={(ev) => ev.stopPropagation()}
                                  href={`https://b24-12cc50.bitrix24.com/crm/deal/details/${appt.dealId}/`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-indigo-600 underline whitespace-nowrap"
                                  title="Открыть сделку в Битрикс"
                                >BX</a>
                              </div>
                              {appt.phone && <div className="text-slate-600 truncate">📞 {appt.phone}</div>}
                              {carLine && <div className="mt-0.5 font-medium text-slate-800 truncate">{carLine}</div>}
                              {appt.estimateUrl && (
                                <div className="mt-0.5 truncate">
                                  <a onClick={(ev) => ev.stopPropagation()} className="text-emerald-700 underline" href={appt.estimateUrl} target="_blank" rel="noopener noreferrer">Смета PDF →</a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Клик по пустой ячейке — создать запись. Перетащи карточку — перенести на другое время/подъёмник.
        </div>
      </div>

      {/* MODAL New / Edit */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4" style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }}
          onClick={() => setShowNew(null)}
        >
          <div className="mt-8 w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">{showNew.dealId ? "Редактировать запись" : "Новая запись"}</h2>
              <button className="text-slate-500 hover:text-slate-900 text-sm" onClick={() => setShowNew(null)}>✕</button>
            </div>
            <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
              {/* Клиент */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Клиент (введи имя, телефон, марку авто…)</label>
                <div className="relative">
                  <input
                    autoFocus
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Поиск по лидам, контактам, сделкам…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  {searching && <div className="absolute right-3 top-2.5 text-xs text-slate-400">ищем…</div>}
                </div>
                {showNew.selected && (
                  <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{showNew.selected.title} <span className="text-xs text-slate-500">({showNew.selected.entityType})</span></div>
                      {showNew.selected.phone && <div className="text-xs text-slate-600">📞 {showNew.selected.phone}</div>}
                      {showNew.selected.carBrand && <div className="text-xs text-slate-600">🚗 {showNew.selected.carBrand}</div>}
                    </div>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => setShowNew({ ...showNew, selected: null })}>очистить</button>
                  </div>
                )}
                {!showNew.selected && searchResults.length > 0 && (
                  <div className="mt-2 rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    {searchResults.map((r) => (
                      <button
                        key={`${r.entityType}-${r.id}`}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-3"
                        onClick={() => setShowNew({ ...showNew, selected: r })}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{r.title} <span className="text-xs text-slate-400">· {r.entityType}</span></div>
                          {r.phone && <div className="text-xs text-slate-600">📞 {r.phone}</div>}
                          {r.carBrand && <div className="text-xs text-slate-600">🚗 {r.carBrand}</div>}
                        </div>
                        <span className="text-xs text-indigo-600 shrink-0">Выбрать</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Подъёмник / время */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-2">Подъёмник</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={showNew.defaultLift}
                    onChange={(e) => setShowNew({ ...showNew, defaultLift: e.target.value as LiftId })}
                  >
                    {LIFTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-2">Дата</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={fmtISOLocal(showNew.defaultDay).slice(0, 10)}
                    onChange={(e) => setShowNew({ ...showNew, defaultDay: new Date(e.target.value + "T00:00:00") })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-2">Начало</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      value={showNew.defaultStartHour}
                      onChange={(e) => setShowNew({ ...showNew, defaultStartHour: Number(e.target.value) })}
                    >
                      {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
                    </select>
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      value={showNew.defaultStartMinute}
                      onChange={(e) => setShowNew({ ...showNew, defaultStartMinute: Number(e.target.value) })}
                    >
                      {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")} мин</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-2">Длительность</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={showNew.durationMin}
                    onChange={(e) => setShowNew({ ...showNew, durationMin: Number(e.target.value) })}
                  >
                    {[30, 60, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{m} мин</option>)}
                  </select>
                </div>
              </div>

              {/* Услуги */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Услуги</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SERVICES.map((s) => {
                    const on = showNew.serviceIds.includes(s.id);
                    return (
                      <label key={s.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm ${on ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={on}
                          onChange={(e) => {
                            const set = new Set(showNew.serviceIds);
                            if (e.target.checked) set.add(s.id); else set.delete(s.id);
                            setShowNew({ ...showNew, serviceIds: Array.from(set) });
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{s.name}</div>
                          <div className="text-xs text-slate-500">{s.description}</div>
                          <div className="text-xs text-slate-700">{s.price} ₽</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Пакеты */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Пакеты услуг</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SERVICE_PACKAGES.map((p) => {
                    const on = showNew.packageIds.includes(p.id);
                    return (
                      <label key={p.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm ${on ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={on}
                          onChange={(e) => {
                            const set = new Set(showNew.packageIds);
                            if (e.target.checked) set.add(p.id); else set.delete(p.id);
                            setShowNew({ ...showNew, packageIds: Array.from(set) });
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{p.name} <span className="text-xs text-emerald-700">-{p.discount}%</span></div>
                          <div className="text-xs text-slate-500">{p.description}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            {p.services.map(si => {
                              const svc = SERVICES.find(ss => ss.id === si.serviceId);
                              return <span key={si.serviceId}>· {svc?.name || si.serviceId} ×{si.quantity} </span>;
                            })}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Примечания */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Примечания</label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[72px]"
                  placeholder="Комментарий к записи…"
                  value={showNew.notes}
                  onChange={(e) => setShowNew({ ...showNew, notes: e.target.value })}
                />
              </div>

              {/* Estimate URL */}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-emerald-600 text-white text-sm px-4 py-2.5 hover:bg-emerald-700 disabled:opacity-60"
                  disabled={!showNew.dealId}
                  onClick={async () => {
                    if (!showNew.dealId) return alert("Сначала сохраните запись, потом можно создать смету.");
                    try {
                      const r = await fetch("/api/estimates/build", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dealId: showNew.dealId, serviceIds: showNew.serviceIds, packageIds: showNew.packageIds, customerName: showNew.selected?.title || "Клиент", createInMoloni: true }),
                      });
                      const j = await r.json();
                      if (!j.ok) throw new Error(j.error || "build estimate failed");
                      alert("Готово. Ссылка на смету: " + (j.data?.pdf || j.data?.pdf_download_link || JSON.stringify(j.data)));
                      await fetchList();
                      setShowNew(null);
                    } catch (e) {
                      alert(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >Создать смету {showNew.dealId ? "" : "(сначала сохранить)"}</button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 text-slate-700 text-sm px-4 py-2.5 hover:bg-slate-50"
                  onClick={() => setShowNew(null)}
                >Отмена</button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-indigo-600 text-white text-sm px-4 py-2.5 hover:bg-indigo-700"
                  onClick={saveNew}
                >Сохранить запись</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
