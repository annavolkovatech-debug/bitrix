import { NextRequest } from "next/server";
import { okResponse } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function mask(name: string): { name: string; set: boolean; length: number; prefix: string } {
  const v = process.env[name];
  const s = v ?? "";
  return {
    name,
    set: !!v,
    length: s.length,
    prefix: s ? s.slice(0, Math.min(6, s.length)) + "***" : "",
  };
}

export async function GET(_req: NextRequest) {
  const list = [
    "BITRIX_WEBHOOK_URL",
    "BITRIX_BASE_URL",
    "BITRIX_INBOUND_SECRET",
    "BITRIX_OUTBOUND_APP_TOKEN",
    "REGNUM_BASE_URL",
    "REGNUM_ID",
    "REGNUM_CLIENT_ID",
    "REGNUM_TOKEN",
    "MOLONI_BASE_URL",
    "MOLONI_CLIENT_ID",
    "MOLONI_CLIENT_SECRET",
    "MOLONI_USERNAME",
    "MOLONI_PASSWORD",
    "MOLONI_COMPANY_ID",
    "ALLOWED_ORIGIN",
    "NODE_TLS_REJECT_UNAUTHORIZED",
  ];
  return okResponse({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || process.env.ENVIRONMENT || "",
    vars: Object.fromEntries(list.map((n) => [n, mask(n)])),
  });
}
