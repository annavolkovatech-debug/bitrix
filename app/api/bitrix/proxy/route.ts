import { NextRequest } from "next/server";
import { bxCall } from "@/lib/bitrix";
import { disabledResponse, errorResponse, isIntegrationEnabled, okResponse } from "@/lib/response";
import type { Json } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  const method = req.nextUrl.searchParams.get("method");
  if (!method) return errorResponse("?method=crm.deal.list required", 400);
  try {
    const params: Record<string, unknown> = {};
    req.nextUrl.searchParams.forEach((v, k) => {
      if (k === "method") return;
      try {
        params[k] = JSON.parse(v);
      } catch {
        params[k] = v;
      }
    });
    return okResponse(await bxCall(method, params as unknown as Json));
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export async function POST(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  try {
    const body = (await req.json()) as { method: string; params?: Record<string, unknown> };
    if (!body.method) return errorResponse("method required", 400);
    return okResponse(await bxCall(body.method, (body.params || {}) as unknown as Json));
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
