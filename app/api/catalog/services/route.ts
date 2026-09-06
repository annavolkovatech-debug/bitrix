import { NextRequest } from "next/server";
import { disabledResponse, errorResponse, isIntegrationEnabled, okResponse } from "@/lib/response";
import { SERVICE_PACKAGES, SERVICES } from "@/lib/catalog";
import type { ServiceItem, ServicePackage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  const path = req.nextUrl.pathname.split("/").filter(Boolean).pop();
  const id = req.nextUrl.searchParams.get("id");

  if (path === "packages") {
    if (id) return okResponse(SERVICE_PACKAGES.find((p) => p.id === id) || null);
    return okResponse(SERVICE_PACKAGES as ServicePackage[]);
  }

  if (id) return okResponse(SERVICES.find((s) => s.id === id) || null);
  const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase();
  const filtered = q
    ? SERVICES.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q)
      )
    : SERVICES;
  return okResponse(filtered as ServiceItem[]);
}

export async function POST() {
  if (!isIntegrationEnabled()) return disabledResponse();
  return errorResponse("БД отключена — справочник конфигурируется в lib/catalog.ts", 501);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
