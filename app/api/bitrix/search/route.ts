import { NextRequest } from "next/server";
import { searchEntities, BxEntityType } from "@/lib/bitrix";
import { errorResponse, okResponse } from "@/lib/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || req.nextUrl.searchParams.get("query");
  const types = (req.nextUrl.searchParams.get("types") || "lead,contact").split(",").filter(Boolean) as BxEntityType[];
  if (!q) return errorResponse("q required", 400);
  try {
    return okResponse(await searchEntities(q, types));
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
