import { NextRequest } from "next/server";
import { disabledResponse, errorResponse, isIntegrationEnabled, okResponse } from "@/lib/response";
import {
  BX_AUTO_FIELDS,
  BxEntityType,
  buildAutoFields,
  searchEntities,
  updateContactAutoFields,
  updateDealAutoFields,
  updateLeadAutoFields,
} from "@/lib/bitrix";
import { regnumLookupLicensePlate } from "@/lib/regnum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySecret(req: NextRequest, payload: Record<string, unknown>): boolean {
  const expectedInbound = process.env.BITRIX_INBOUND_SECRET;
  const urlToken = req.nextUrl.searchParams.get("secret");
  const headerToken = req.headers.get("x-bitrix-secret");
  if (expectedInbound) {
    if (urlToken && urlToken === expectedInbound) return true;
    if (headerToken && headerToken === expectedInbound) return true;
  }

  const expectedAppToken = (process.env.BITRIX_OUTBOUND_APP_TOKEN || "").trim();
  const knownFallbackTokens = ["xdd2hdk9hlx155m1kpd130h11zdttx4j", "42ta8u26n7vyg51u59gle0og6rccg3rv"];
  const appToken = expectedAppToken || knownFallbackTokens.find(Boolean) || "";
  if (appToken) {
    const token =
      (payload["auth[application_token]"] as string) ||
      (payload["auth"] as Record<string, unknown> | undefined)?.["application_token"] ||
      req.nextUrl.searchParams.get("auth[application_token]") ||
      req.nextUrl.searchParams.get("application_token");
    if (token === expectedAppToken) return true;
    const tStr = (token || "") as string;
    if (tStr && knownFallbackTokens.includes(tStr)) return true;
  }

  if (!expectedInbound && !appToken) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  const ct = req.headers.get("content-type") || "";
  let payload: Record<string, unknown> = {};
  try {
    payload = ct.includes("application/json")
      ? ((await req.json()) as Record<string, unknown>)
      : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());
  } catch {
    payload = {};
  }
  const auth = req.nextUrl.searchParams;
  const event = (payload.event || auth.get("event")) as string | undefined;
  const data = (payload.data || {}) as Record<string, unknown>;

  if (!verifySecret(req, payload)) {
    return errorResponse("secret mismatch", 403);
  }

  try {
    if (
      event === "OnCrmLeadUpdate" ||
      event === "OnCrmDealUpdate" ||
      event === "OnCrmContactUpdate" ||
      event === "OnCrmLeadAdd" ||
      event === "OnCrmDealAdd" ||
      event === "OnCrmContactAdd"
    ) {
      const eventFields =
        (payload["FIELDS"] as Record<string, unknown> | undefined) ||
        (data?.FIELDS as Record<string, unknown> | undefined) ||
        {};
      const id = Number(eventFields["ID"] ?? auth.get("data[FIELDS][ID]"));
      const entity = (event.includes("Lead") ? "lead" : event.includes("Deal") ? "deal" : "contact") as BxEntityType;
      if (id) {
        const plateFieldValue =
          (eventFields[BX_AUTO_FIELDS.LICENSE_PLATE] as string) ||
          (auth.get(`data[FIELDS][${BX_AUTO_FIELDS.LICENSE_PLATE}]`) as string | undefined);
        if (plateFieldValue) {
          const vehicle = await regnumLookupLicensePlate(plateFieldValue);
          const autoFields = buildAutoFields(vehicle);
          const updater =
            entity === "lead"
              ? updateLeadAutoFields
              : entity === "deal"
              ? updateDealAutoFields
              : updateContactAutoFields;
          const bxUpdated = await updater(id, autoFields);
          return okResponse({ event, id, entity, vehicle, bxUpdated });
        }
      }
    }
    return okResponse({ handled: false, event, payload });
  } catch (e) {
    return errorResponse((e as Error).message, 500, String(e));
  }
}

export async function GET(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  const q = req.nextUrl.searchParams.get("q") || req.nextUrl.searchParams.get("query");
  if (q) {
    try {
      const entities = req.nextUrl.searchParams.get("types")?.split(",") as BxEntityType[] | undefined;
      return okResponse(await searchEntities(q, entities || ["lead", "contact"]));
    } catch (e) {
      return errorResponse((e as Error).message, 502, String(e));
    }
  }
  return okResponse({ webhook: true });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
