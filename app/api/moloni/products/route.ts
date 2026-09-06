import { NextRequest } from "next/server";
import { disabledResponse, errorResponse, isIntegrationEnabled, okResponse } from "@/lib/response";
import { isMoloniConfigured, moloniProductsGetAll, moloniProductsInsert } from "@/lib/moloni";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isIntegrationEnabled()) return disabledResponse();
  if (!isMoloniConfigured()) return errorResponse("Moloni not configured", 503);
  try {
    return okResponse(await moloniProductsGetAll());
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export async function POST(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  if (!isMoloniConfigured()) return errorResponse("Moloni not configured", 503);
  try {
    const body = (await req.json()) as {
      name: string;
      price: number;
      vat_type?: number;
      unit_id?: number;
      reference?: string;
      has_stock?: number;
      stock?: number;
      category_id?: number;
    };
    if (!body.name || typeof body.price !== "number") {
      return errorResponse("name + price required", 400);
    }
    return okResponse(await moloniProductsInsert(body));
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
