import { NextRequest } from "next/server";
import { disabledResponse, errorResponse, isIntegrationEnabled, okResponse } from "@/lib/response";
import { SERVICE_PACKAGES, SERVICES } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const pkg = SERVICE_PACKAGES.find((p) => p.id === id);
    if (!pkg) return errorResponse("package not found", 404);
    const services = pkg.services
      .map((s) => ({
        meta: SERVICES.find((svc) => svc.id === s.serviceId),
        quantity: s.quantity,
      }))
      .filter((x) => x.meta);
    return okResponse({ ...pkg, services });
  }
  return okResponse(
    SERVICE_PACKAGES.map((pkg) => {
      const services = pkg.services
        .map((s) => SERVICES.find((svc) => svc.id === s.serviceId))
        .filter(Boolean);
      const subtotal = services.reduce((acc, s, i) => acc + (s!.price * pkg.services[i]!.quantity), 0);
      const total = Math.round(subtotal * (1 - (pkg.discount || 0) / 100));
      return { ...pkg, serviceCount: pkg.services.length, subtotal, total };
    })
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
