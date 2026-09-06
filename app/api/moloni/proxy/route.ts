import { NextRequest } from "next/server";
import { disabledResponse, errorResponse, isIntegrationEnabled, okResponse } from "@/lib/response";
import {
  isMoloniConfigured,
  moloniCompaniesGetAll,
  moloniEstimatesInsert,
  moloniProductsGetAll,
  moloniProductsInsert,
} from "@/lib/moloni";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  if (!isMoloniConfigured()) return errorResponse("Moloni not configured", 503);
  try {
    const action = req.nextUrl.searchParams.get("action");
    if (action === "companies") {
      return okResponse(await moloniCompaniesGetAll());
    }
    return okResponse(await moloniProductsGetAll());
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export async function POST(req: NextRequest) {
  if (!isIntegrationEnabled()) return disabledResponse();
  if (!isMoloniConfigured()) return errorResponse("Moloni not configured", 503);
  try {
    const body = (await req.json()) as
      | {
          action?: "createEstimate" | "createProduct" | "companies";
        }
      | Record<string, unknown>;

    if (body.action === "companies") {
      return okResponse(await moloniCompaniesGetAll());
    }

    if (body.action === "createProduct") {
      const b = body as { name: string; price: number; vat_type?: number; unit_id?: number; reference?: string };
      if (!b.name || typeof b.price !== "number") return errorResponse("name and price required", 400);
      return okResponse(
        await moloniProductsInsert({
          name: b.name,
          price: b.price,
          reference: b.reference,
          vat_type: b.vat_type,
          unit_id: b.unit_id,
        })
      );
    }

    if (body.action === "createEstimate" || !body.action) {
      const b = body as {
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
        lines: Array<{ name: string; qty: number; price: number; product_id?: number; discount?: number; vat_type?: number }>;
        notes?: string;
        documentDate?: string;
        expirationDate?: string;
      };
      if (!b.customer || !b.customer.name) return errorResponse("customer.name required", 400);
      if (!Array.isArray(b.lines) || !b.lines.length) return errorResponse("lines required", 400);
      return okResponse(
        await moloniEstimatesInsert({
          customer: b.customer,
          lines: b.lines,
          notes: b.notes,
          documentDate: b.documentDate,
          expirationDate: b.expirationDate,
        })
      );
    }

    return errorResponse("unknown action", 400);
  } catch (e) {
    return errorResponse((e as Error).message, 502, String(e));
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
