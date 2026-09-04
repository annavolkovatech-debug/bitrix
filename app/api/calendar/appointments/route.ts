import { NextRequest } from "next/server";
import { errorResponse, okResponse } from "@/lib/response";
import type { CalendarAppointment, LiftId } from "@/lib/types";
import { LIFTS } from "@/lib/catalog";

const globalForAppointments = globalThis as unknown as {
  __appointments?: CalendarAppointment[];
};

const STORE = (globalForAppointments.__appointments = globalForAppointments.__appointments || [
  {
    id: "demo-1",
    startsAt: new Date(Date.now() + 86_400_000).toISOString().slice(0, 16) + ":00.000Z",
    endsAt: new Date(Date.now() + 86_400_000 + 5400_000).toISOString().slice(0, 16) + ":00.000Z",
    liftId: "LIFT_1",
    clientName: "Иванов Иван",
    vehicleBrand: "Kia Rio",
    serviceIds: ["SVC_001"],
    packageIds: [],
  } as CalendarAppointment,
]);

function inRange(appt: CalendarAppointment, from: Date, to: Date): boolean {
  const s = new Date(appt.startsAt).getTime();
  const e = new Date(appt.endsAt).getTime();
  return e >= from.getTime() && s <= to.getTime();
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.pathname.split("/").filter(Boolean).pop();
  if (path === "lifts") {
    return okResponse(LIFTS);
  }

  const fromStr = req.nextUrl.searchParams.get("from");
  const toStr = req.nextUrl.searchParams.get("to");
  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 7 * 86_400_000);
  const to = toStr ? new Date(toStr) : new Date(Date.now() + 31 * 86_400_000);
  const liftId = req.nextUrl.searchParams.get("liftId") as LiftId | null;

  const list = STORE.filter(
    (a) => inRange(a, from, to) && (!liftId || a.liftId === liftId)
  ).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return okResponse(list);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Omit<CalendarAppointment, "id">;
    if (!body.liftId || !LIFTS.some((l) => l.id === body.liftId)) return errorResponse("liftId required (LIFT_1..LIFT_4)", 400);
    if (!body.startsAt || !body.endsAt) return errorResponse("startsAt/endsAt required", 400);
    const id = `apt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const created: CalendarAppointment = { id, ...body };
    STORE.push(created);
    return okResponse(created, 201);
  } catch (e) {
    return errorResponse((e as Error).message, 400);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
