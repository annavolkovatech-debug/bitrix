import { httpJson } from "./http";
import type { VehicleData } from "./types";

const BASE_URL = process.env.REGNUM_BASE_URL || "http://drm.bovsoft.com:400/bovsoft.regnum.clientapi";
const ID = process.env.REGNUM_ID || process.env.REGNUM_CLIENT_ID || "467";
const TOKEN = process.env.REGNUM_TOKEN || "";

type RegnumResponse = {
  success?: boolean;
  data?: Record<string, unknown>;
  error?: string;
  [k: string]: unknown;
};

function buildUrl(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  search.set("id", ID);
  if (TOKEN) search.set("tocken", TOKEN);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  });
  return `${BASE_URL}?${search.toString()}`;
}

export async function regnumLookupLicensePlate(plate: string): Promise<VehicleData> {
  if (!plate) throw new Error("Госномер не указан");
  const normalized = plate.replace(/\s+/g, "").toUpperCase();
  const url = buildUrl({
    action: "getVehicleInfo",
    plate: normalized,
    // резерв: документация bovsoft использует param "gosNumber" в некоторых версиях
    gosNumber: normalized,
    number: normalized,
  });
  const raw = await httpJson<RegnumResponse | Record<string, unknown>>(url, { method: "GET" });

  const payload = (raw && (raw as RegnumResponse).data) || raw;
  const body = (payload || {}) as Record<string, unknown>;

  const pickStr = (keys: string[]): string | null => {
    for (const k of keys) {
      if (body[k] !== undefined && body[k] !== null) {
        const v = body[k];
        if (typeof v === "string" && v) return v;
        if (typeof v === "number") return String(v);
      }
    }
    return null;
  };
  const pickNum = (keys: string[]): number | null => {
    for (const k of keys) {
      if (body[k] !== undefined && body[k] !== null) {
        const v = body[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string" && v) {
          const n = Number(v.replace(",", "."));
          if (Number.isFinite(n)) return n;
        }
      }
    }
    return null;
  };

  return {
    licensePlate: normalized,
    brand: pickStr(["brand", "marka", "mark", "manufacturer", "carBrand", "BRAND"]),
    model: pickStr(["model", "model_name", "carModel", "MODEL"]),
    year: pickNum(["year", "year_of_manufacture", "issueYear", "issue_year", "YEAR"]),
    vin: pickStr(["vin", "VIN", "vin_number"]),
    engine: pickStr(["engine", "engine_model", "dvigatel", "ENGINE"]),
    engineDisplacement: pickNum(["engine_displacement", "engineVolume", "volume", "ENGINE_CC"]),
    enginePower: pickNum(["engine_power", "power", "hp", "ENGINE_POWER"]),
    fuelType: pickStr(["fuel_type", "fuel", "toplivo", "FUEL"]),
    bodyType: pickStr(["body_type", "kuzov", "body", "BODY"]),
    color: pickStr(["color", "cveta", "COLOR"]),
    registrationDate: pickStr(["reg_date", "registrationDate", "date_reg", "REG_DATE"]),
    raw: raw as unknown as VehicleData["raw"],
  };
}
