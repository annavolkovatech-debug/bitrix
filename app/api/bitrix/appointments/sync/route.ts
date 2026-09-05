import { NextRequest, NextResponse } from "next/server";
import { okResponse, errorResponse } from "@/lib/response";
import {
  Appointment,
  fetchDealAppointments,
  searchEntities,
  upsertDealAppointment,
  parseLiftField,
  BX_APPT_FIELDS,
} from "@/lib/bitrix";
import { bxCall } from "@/lib/bitrix";
import { Json } from "@/lib/types";

export const dynamic = "force-dynamic";

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = req.nextUrl;
    const search = (url.searchParams.get("q") || "").trim();
    const typesRaw = url.searchParams.get("types");
    const from = url.searchParams.get("from") || new Date().toISOString();
    const to = url.searchParams.get("to") || addDays(from, 14);

    if (search || typesRaw) {
      const types = typesRaw ? (typesRaw.split(",") as Array<"lead" | "contact" | "deal">) : undefined;
      const data = await searchEntities(search, types);
      return okResponse({ results: data });
    }

    const appointments = await fetchDealAppointments(from, to);
    return okResponse({ appointments, from, to });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse("sync get failed: " + msg, 500, { stack: e instanceof Error ? e.stack : undefined });
  }
}

export type MoveAppointmentInput = {
  action: "move";
  dealId: number;
  lift: "LIFT_1" | "LIFT_2" | "LIFT_3" | "LIFT_4";
  startsAt: string;
  endsAt?: string;
};

export type UpsertInput = Parameters<typeof upsertDealAppointment>[0] & {
  action?: "upsert";
};

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as MoveAppointmentInput | UpsertInput | { action?: string };
    const act = (body as { action?: string }).action || "upsert";
    if (act === "move") {
      const m = body as MoveAppointmentInput;
      if (!m.dealId) return errorResponse("dealId required", 400);
      if (!m.lift) return errorResponse("lift required", 400);
      if (!m.startsAt) return errorResponse("startsAt required", 400);
      const lift = parseLiftField(m.lift);
      if (!lift) return errorResponse("invalid lift", 400);
      const fields: Record<string, Json | Record<string, unknown> | undefined> = {
        [BX_APPT_FIELDS.LIFT]: { XML_ID: m.lift },
        [BX_APPT_FIELDS.START]: m.startsAt,
      };
      if (m.endsAt) fields[BX_APPT_FIELDS.END] = m.endsAt;
      await bxCall("crm.deal.update", { id: m.dealId, fields });
      return okResponse({ ok: true, dealId: m.dealId });
    }

    const input = body as UpsertInput;
    const res = await upsertDealAppointment(input as Parameters<typeof upsertDealAppointment>[0]);
    return okResponse(res as Json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse("sync post failed: " + msg, 500, { stack: e instanceof Error ? e.stack : undefined });
  }
}
