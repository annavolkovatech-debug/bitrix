import { NextRequest } from "next/server";
import { disabledResponse, errorResponse, isIntegrationEnabled, okResponse } from "@/lib/response";
import { SERVICE_PACKAGES, SERVICES } from "@/lib/catalog";
import type { MoloniEstimateLine } from "@/lib/types";
import { isMoloniConfigured, moloniEstimatesInsert } from "@/lib/moloni";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  customer: {
    name: string;
    customer_id?: number;
    email?: string;
    phone?: string;
    vat?: string;
    address?: string;
    city?: string;
    zip_code?: string;
  };
  items: Array<{ serviceId?: string; packageId?: string; quantity?: number; manualName?: string; manualPrice?: number }>;
  notes?: string;
  documentDate?: string;
  expirationDate?: string;
};

export async function POST(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  try {
    const b = (await req.json()) as Body;
    if (!b.customer?.name) return errorResponse("customer.name required", 400);
    if (!Array.isArray(b.items) || !b.items.length) return errorResponse("items required", 400);

    const lines: MoloniEstimateLine[] = [];
    let subtotal = 0;

    for (const it of b.items) {
      const qty = it.quantity || 1;
      if (it.serviceId) {
        const svc = SERVICES.find((s) => s.id === it.serviceId);
        if (!svc) return errorResponse(`unknown serviceId ${it.serviceId}`, 400);
        lines.push({
          name: svc.name,
          qty,
          price: svc.price,
          vat_type: svc.vat ?? 0,
          unit_id: svc.unitId ?? 1,
          product_id: svc.moloniProductId,
        });
        subtotal += svc.price * qty;
      } else if (it.packageId) {
        const pkg = SERVICE_PACKAGES.find((p) => p.id === it.packageId);
        if (!pkg) return errorResponse(`unknown packageId ${it.packageId}`, 400);
        for (const ps of pkg.services) {
          const svc = SERVICES.find((s) => s.id === ps.serviceId);
          if (!svc) continue;
          const discount = pkg.discount || 0;
          const price = Math.round(svc.price * (1 - discount / 100));
          lines.push({
            name: `${pkg.name} · ${svc.name}`,
            qty: ps.quantity * qty,
            price,
            discount: 0,
            vat_type: svc.vat ?? 0,
            unit_id: svc.unitId ?? 1,
            product_id: svc.moloniProductId,
          });
          subtotal += price * ps.quantity * qty;
        }
      } else if (it.manualName && typeof it.manualPrice === "number") {
        lines.push({ name: it.manualName, qty, price: it.manualPrice });
        subtotal += it.manualPrice * qty;
      } else {
        return errorResponse("each item requires serviceId/packageId or (manualName+manualPrice)", 400);
      }
    }

    if (!isMoloniConfigured()) {
      return okResponse({
        moloni: false,
        localEstimate: {
          lines,
          subtotal,
          vat: 0,
          total: subtotal,
        },
      });
    }

    const doc = await moloniEstimatesInsert({
      customer: b.customer,
      lines,
      notes: b.notes,
      documentDate: b.documentDate,
      expirationDate: b.expirationDate,
    });
    return okResponse({ moloni: true, document: doc, lines, subtotal, total: subtotal });
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
