import { okResponse } from "@/lib/response";
import { LIFTS } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return okResponse(LIFTS);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
