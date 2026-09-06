import { NextRequest } from "next/server";
import { disabledResponse, errorResponse, isIntegrationEnabled, okResponse } from "@/lib/response";
import { isMoloniConfigured, moloniEstimatesInsert } from "@/lib/moloni";
import type { MoloniCustomer, MoloniEstimateLine } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  if (!isMoloniConfigured()) return errorResponse("Moloni not configured", 503);
  try {
    const body = (await req.json()) as {
      customer: MoloniCustomer;
      lines: MoloniEstimateLine[];
      notes?: string;
      documentDate?: string;
      expirationDate?: string;
    };
    if (!body.customer?.name) return errorResponse("customer.name required", 400);
    if (!Array.isArray(body.lines) || !body.lines.length) return errorResponse("lines required", 400);
    const doc = await moloniEstimatesInsert(body);
    return okResponse(doc);
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
