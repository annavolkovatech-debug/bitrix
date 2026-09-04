import { NextRequest } from "next/server";
import { regnumLookupLicensePlate } from "@/lib/regnum";
import { BxEntityType, buildAutoFields, updateDealAutoFields, updateLeadAutoFields, updateContactAutoFields } from "@/lib/bitrix";
import { errorResponse, okResponse } from "@/lib/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const plate = req.nextUrl.searchParams.get("plate") || req.nextUrl.searchParams.get("licensePlate");
  if (!plate) return errorResponse("plate required", 400);
  try {
    const data = await regnumLookupLicensePlate(plate);
    return okResponse(data);
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      plate?: string;
      entityType?: BxEntityType;
      entityId?: number | string;
    };
    if (!body.plate) return errorResponse("plate required", 400);

    const data = await regnumLookupLicensePlate(body.plate);

    let bxUpdated: unknown = null;
    if (body.entityType && body.entityId) {
      const id = Number(body.entityId);
      if (!id || !["lead", "contact", "deal"].includes(body.entityType)) {
        return errorResponse("invalid entityType/entityId", 400);
      }
      const fields = buildAutoFields(data);
      bxUpdated =
        body.entityType === "deal"
          ? await updateDealAutoFields(id, fields)
          : body.entityType === "lead"
          ? await updateLeadAutoFields(id, fields)
          : await updateContactAutoFields(id, fields);
    }

    return okResponse({ vehicle: data, bxUpdated });
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
