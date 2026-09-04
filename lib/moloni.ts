import { httpJson } from "./http";
import type { MoloniCustomer, MoloniEstimateLine, MoloniProduct } from "./types";

const BASE_URL = process.env.MOLONI_BASE_URL || "https://api.moloni.pt/v1";
const CLIENT_ID = process.env.MOLONI_CLIENT_ID || "";
const CLIENT_SECRET = process.env.MOLONI_CLIENT_SECRET || "";
const USERNAME = process.env.MOLONI_USERNAME || "";
const PASSWORD = process.env.MOLONI_PASSWORD || "";
const COMPANY_ID = Number(process.env.MOLONI_COMPANY_ID || 0);

type TokenCache = { accessToken: string; expiresAt: number } | null;
let tokenCache: TokenCache = null;

export function isMoloniConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && USERNAME && PASSWORD && COMPANY_ID);
}

function ensureConfigured(): void {
  if (!isMoloniConfigured()) {
    throw new Error("Moloni не настроен (CLIENT_ID/SECRET/USERNAME/PASSWORD/COMPANY_ID)");
  }
}

async function authenticate(): Promise<string> {
  ensureConfigured();
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }
  const form = new URLSearchParams({
    grant_type: "password",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    username: USERNAME,
    password: PASSWORD,
  });
  const res = await httpJson<{ access_token: string; expires_in?: number }>(`${BASE_URL}/grant/`, {
    method: "POST",
    body: form.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  tokenCache = {
    accessToken: res.access_token,
    expiresAt: now + ((res.expires_in || 3600) * 1000),
  };
  return res.access_token;
}

export async function moloniCall<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  { methodHttp = "POST" }: { methodHttp?: "GET" | "POST" } = {}
): Promise<T> {
  const accessToken = await authenticate();
  const url = `${BASE_URL}${method.startsWith("/") ? method : `/${method}`}/?access_token=${encodeURIComponent(
    accessToken
  )}`;
  const body = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "object") {
      body.append(k, JSON.stringify(v));
    } else {
      body.append(k, String(v));
    }
  });
  const options: RequestInit =
    methodHttp === "POST"
      ? {
          method: "POST",
          body: body.toString(),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      : { method: "GET" };

  const data = await httpJson<T>(url, options);
  const arr = Array.isArray(data) ? data : [data];
  (arr as unknown as Array<{ error?: string; error_description?: string }>).forEach((r) => {
    if (r && typeof r === "object" && "error" in r && r.error) {
      throw new Error(`Moloni error ${r.error}: ${r.error_description || ""}`);
    }
  });
  return data;
}

export async function moloniCompaniesGetAll(): Promise<Array<{ company_id: number; name: string }>> {
  return moloniCall<Array<{ company_id: number; name: string }>>("/companies/getAll", {}, { methodHttp: "POST" });
}

export async function moloniProductsGetAll(): Promise<MoloniProduct[]> {
  return moloniCall<MoloniProduct[]>("/products/getAll", { company_id: COMPANY_ID });
}

export async function moloniProductsInsert(product: Omit<MoloniProduct, "product_id">): Promise<{ product_id: number }> {
  const payload = {
    company_id: COMPANY_ID,
    name: product.name,
    reference: product.reference || "",
    price: Number(product.price) || 0,
    vat_type: product.vat_type ?? 1,
    unit_id: product.unit_id ?? 1,
    has_stock: product.has_stock ?? 0,
    stock: product.stock ?? 0,
    category_id: product.category_id ?? 0,
  };
  return moloniCall<{ product_id: number }>("/products/insert", payload);
}

export async function moloniCustomersGetByVatOrEmail({
  vat,
  email,
}: {
  vat?: string;
  email?: string;
}): Promise<MoloniCustomer | null> {
  const list = await moloniCall<MoloniCustomer[]>("/customers/getAll", { company_id: COMPANY_ID });
  if (vat) {
    const byVat = list.find((c) => c.vat && c.vat === vat);
    if (byVat) return byVat;
  }
  if (email) {
    const byEmail = list.find((c) => c.email && c.email.toLowerCase() === email.toLowerCase());
    if (byEmail) return byEmail;
  }
  return null;
}

export async function moloniCustomersInsert(customer: Omit<MoloniCustomer, "customer_id">): Promise<{ customer_id: number }> {
  return moloniCall<{ customer_id: number }>("/customers/insert", {
    company_id: COMPANY_ID,
    name: customer.name,
    email: customer.email || "",
    phone: customer.phone || "",
    vat: customer.vat || "999999999",
    address: customer.address || "",
    city: customer.city || "",
    zip_code: customer.zip_code || "",
    country_id: customer.country_id ?? 1,
    language_id: customer.language_id ?? 1,
    payment_day: customer.payment_day ?? 0,
    discount: customer.discount ?? 0,
  });
}

type MoloniDocumentResponse = { document_id: number; pdf_download_link?: string };

export async function moloniEstimatesInsert(args: {
  customer: MoloniCustomer;
  lines: MoloniEstimateLine[];
  notes?: string;
  documentDate?: string;
  expirationDate?: string;
}): Promise<MoloniDocumentResponse> {
  const { customer, lines, notes, documentDate, expirationDate } = args;
  const existingCustomer =
    (customer.customer_id ? { customer_id: customer.customer_id } : null) ||
    (await moloniCustomersGetByVatOrEmail({ vat: customer.vat, email: customer.email }));
  let customer_id = existingCustomer ? (existingCustomer as { customer_id?: number }).customer_id : 0;
  if (!customer_id) {
    const created = await moloniCustomersInsert(customer);
    customer_id = created.customer_id;
  }

  const documentDateFinal = documentDate || new Date().toISOString().slice(0, 10);
  const expirationDateFinal = expirationDate || documentDateFinal;

  const products = lines.map((l, idx) => ({
    product_id: l.product_id ?? 0,
    name: l.name,
    qty: l.qty,
    price: Number(l.price) || 0,
    discount: l.discount ?? 0,
    vat_type: l.vat_type ?? 1,
    unit_id: l.unit_id ?? 1,
    sorting: idx + 1,
  }));

  const payload = {
    company_id: COMPANY_ID,
    customer_id,
    document_date: documentDateFinal,
    expiration_date: expirationDateFinal,
    entourages: [],
    payments: [],
    products,
    notes: notes || "",
  };
  return moloniCall<MoloniDocumentResponse>("/estimates/insert", payload);
}
