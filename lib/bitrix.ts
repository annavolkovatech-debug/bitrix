import { httpJson } from "./http";
import type { Json } from "./types";

const BITRIX_WEBHOOK_URL = process.env.BITRIX_WEBHOOK_URL || process.env.BITRIX_BASE_URL || "";

function ensureWebhook(): string {
  if (!BITRIX_WEBHOOK_URL) {
    throw new Error("BITRIX_WEBHOOK_URL не настроен в env");
  }
  return BITRIX_WEBHOOK_URL.replace(/\/$/, "");
}

function buildUrl(method: string): string {
  return `${ensureWebhook()}/${method}`;
}

export async function bxCall<T = unknown>(method: string, params?: unknown): Promise<T> {
  const url = buildUrl(method);
  const res = await httpJson<{ result?: T; error?: string; error_description?: string }>(url, {
    method: "POST",
    body: params ? JSON.stringify(params) : undefined,
  });
  if ((res as Json && typeof res === "object" && (res as { error?: string }).error)) {
    throw new Error(
      `Bitrix error ${(res as { error?: string }).error}: ${(res as { error_description?: string }).error_description || ""}`
    );
  }
  if (res && typeof res === "object" && "result" in res) {
    return (res as { result: T }).result as T;
  }
  return res as unknown as T;
}

export type BxFieldMap = Record<string, string | number | boolean | null | undefined | Json | Record<string, unknown>>;

export const BX_AUTO_FIELDS = {
  LICENSE_PLATE: "UF_CRM_CAR_PLATE",
  BRAND: "UF_CRM_CAR_BRAND",
  MODEL: "UF_CRM_CAR_MODEL",
  YEAR: "UF_CRM_CAR_YEAR",
  VIN: "UF_CRM_CAR_VIN",
  ENGINE: "UF_CRM_CAR_ENGINE",
  ENGINE_DISPLACEMENT: "UF_CRM_CAR_ENGINE_CC",
  ENGINE_POWER: "UF_CRM_CAR_ENGINE_POWER",
  FUEL_TYPE: "UF_CRM_CAR_FUEL",
  BODY_TYPE: "UF_CRM_CAR_BODY",
  COLOR: "UF_CRM_CAR_COLOR",
  REGISTRATION_DATE: "UF_CRM_CAR_REG_DATE",
} as const;

export function buildAutoFields(data: {
  licensePlate?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | string | null;
  vin?: string | null;
  engine?: string | null;
  engineDisplacement?: number | null;
  enginePower?: number | null;
  fuelType?: string | null;
  bodyType?: string | null;
  color?: string | null;
  registrationDate?: string | null;
}): BxFieldMap {
  return {
    [BX_AUTO_FIELDS.LICENSE_PLATE]: data.licensePlate ?? null,
    [BX_AUTO_FIELDS.BRAND]: data.brand ?? null,
    [BX_AUTO_FIELDS.MODEL]: data.model ?? null,
    [BX_AUTO_FIELDS.YEAR]: data.year ?? null,
    [BX_AUTO_FIELDS.VIN]: data.vin ?? null,
    [BX_AUTO_FIELDS.ENGINE]: data.engine ?? null,
    [BX_AUTO_FIELDS.ENGINE_DISPLACEMENT]: data.engineDisplacement ?? null,
    [BX_AUTO_FIELDS.ENGINE_POWER]: data.enginePower ?? null,
    [BX_AUTO_FIELDS.FUEL_TYPE]: data.fuelType ?? null,
    [BX_AUTO_FIELDS.BODY_TYPE]: data.bodyType ?? null,
    [BX_AUTO_FIELDS.COLOR]: data.color ?? null,
    [BX_AUTO_FIELDS.REGISTRATION_DATE]: data.registrationDate ?? null,
  };
}

export async function updateDealAutoFields(dealId: number, fields: BxFieldMap): Promise<unknown> {
  return bxCall("crm.deal.update", { id: dealId, fields });
}

export async function updateContactAutoFields(contactId: number, fields: BxFieldMap): Promise<unknown> {
  return bxCall("crm.contact.update", { id: contactId, fields });
}

export async function updateLeadAutoFields(leadId: number, fields: BxFieldMap): Promise<unknown> {
  return bxCall("crm.lead.update", { id: leadId, fields });
}

export type BxEntityType = "lead" | "contact" | "deal";

export async function searchEntities(
  query: string,
  entityTypes: BxEntityType[] = ["lead", "contact"]
): Promise<Array<{ entityType: BxEntityType; id: number; title: string; carBrand?: string; phone?: string }>> {
  const q = `%${query}%`;
  const out: Array<{ entityType: BxEntityType; id: number; title: string; carBrand?: string; phone?: string }> = [];

  await Promise.all(
    entityTypes.map(async (entityType) => {
      const method =
        entityType === "lead" ? "crm.lead.list" : entityType === "contact" ? "crm.contact.list" : "crm.deal.list";
      const list = await bxCall<Array<Record<string, unknown>>>(method, {
        filter: {
          "%TITLE": q,
        },
        select: ["ID", "TITLE", "NAME", "LAST_NAME", "COMPANY_TITLE", "PHONE", "FM.PHONE", BX_AUTO_FIELDS.BRAND, BX_AUTO_FIELDS.MODEL],
        limit: 20,
      });
      (list || []).forEach((item) => {
        const id = Number(item.ID);
        if (!id) return;
        const nameParts = [item.LAST_NAME as string, item.NAME as string].filter(Boolean);
        const title =
          (item.TITLE as string) || nameParts.join(" ").trim() || (item.COMPANY_TITLE as string) || `#${id}`;
        const carBrand =
          ((item[BX_AUTO_FIELDS.BRAND] as string) || "") +
          (((item[BX_AUTO_FIELDS.BRAND] as string) && (item[BX_AUTO_FIELDS.MODEL] as string)) ? ` ${item[BX_AUTO_FIELDS.MODEL]}` : ((item[BX_AUTO_FIELDS.MODEL] as string) || ""));
        let phone: string | undefined;
        const ph = item.PHONE ?? item["FM.PHONE"];
        if (Array.isArray(ph) && ph[0] && typeof ph[0] === "object" && "VALUE" in (ph[0] as object)) {
          phone = (ph[0] as { VALUE?: string }).VALUE;
        } else if (typeof ph === "string") {
          phone = ph;
        }
        out.push({ entityType, id, title, carBrand: carBrand || undefined, phone });
      });
    })
  );

  return out;
}

// ========== CALENDAR / APPOINTMENTS (Deal-level user fields) ==========
export const BX_APPT_FIELDS = {
  LIFT: "UF_CRM_APPT_LIFT",
  START: "UF_CRM_APPT_START",
  END: "UF_CRM_APPT_END",
  SERVICE_IDS: "UF_CRM_APPT_SERVICE_IDS",
  PACKAGE_IDS: "UF_CRM_APPT_PACKAGE_IDS",
  NOTES: "UF_CRM_APPT_NOTES",
  ESTIMATE_URL: "UF_CRM_APPT_EST_URL",
} as const;

export const BX_LIFT_ENUM: Record<string, { xmlId: string; label: string; color: string }> = {
  LIFT_1: { xmlId: "LIFT_1", label: "Lift 1", color: "#60a5fa" },
  LIFT_2: { xmlId: "LIFT_2", label: "Lift 2", color: "#34d399" },
  LIFT_3: { xmlId: "LIFT_3", label: "Lift 3", color: "#fbbf24" },
  LIFT_4: { xmlId: "LIFT_4", label: "Lift 4", color: "#f472b6" },
};

export type LiftId = keyof typeof BX_LIFT_ENUM;

export function parseLiftField(val: unknown): LiftId | undefined {
  if (!val) return undefined;
  // enumeration field returns {ID, VALUE, XML_ID}
  if (typeof val === "object" && val !== null) {
    const v = val as { XML_ID?: string; VALUE?: string };
    if (v.XML_ID) return (Object.keys(BX_LIFT_ENUM) as Array<LiftId>).find((k) => BX_LIFT_ENUM[k].xmlId === v.XML_ID || k === v.XML_ID);
    if (v.VALUE) {
      const n = (v.VALUE.match(/\d/) || [""])[0];
      if (n) return `LIFT_${n}` as LiftId;
    }
  }
  if (typeof val === "string") {
    const n = (val.match(/LIFT[_ -]?(\d)/i) || [])[1] || (val.match(/(?:подъёмник|Lift)\s*(\d)/i) || [])[1];
    if (n) return `LIFT_${n}` as LiftId;
    if (Object.keys(BX_LIFT_ENUM).includes(val)) return val as LiftId;
  }
  return undefined;
}

export function encodeLiftForUpdate(lift: LiftId | undefined): Record<string, unknown> | undefined {
  if (!lift) return undefined;
  const enumRec = BX_LIFT_ENUM[lift];
  // For add/update enumeration UF: {XML_ID:'LIFT_1'} works
  return { XML_ID: enumRec.xmlId };
}

export type Appointment = {
  id: string;
  dealId: number;
  title: string;
  clientEntity?: BxEntityType;
  clientId?: number;
  contactName: string;
  phone?: string;
  carPlate?: string;
  carBrand?: string;
  carModel?: string;
  lift: LiftId | undefined;
  startsAt: string;
  endsAt: string;
  serviceIds: string[];
  packageIds: string[];
  notes?: string;
  estimateUrl?: string;
};

const DEAL_SELECT_FOR_APPT = [
  "ID",
  "TITLE",
  "STAGE_ID",
  "CATEGORY_ID",
  "CONTACT_ID",
  "LEAD_ID",
  "COMPANY_TITLE",
  "OPPORTUNITY",
  "CURRENCY_ID",
  "UF_CRM_CAR_PLATE",
  "UF_CRM_CAR_BRAND",
  "UF_CRM_CAR_MODEL",
  "UF_CRM_APPT_LIFT",
  "UF_CRM_APPT_START",
  "UF_CRM_APPT_END",
  "UF_CRM_APPT_SERVICE_IDS",
  "UF_CRM_APPT_PACKAGE_IDS",
  "UF_CRM_APPT_NOTES",
  "UF_CRM_APPT_EST_URL",
];

export async function fetchDealAppointments(fromIso: string, toIso: string): Promise<Appointment[]> {
  const filt: Record<string, Json | undefined> = {};
  filt[">=" + BX_APPT_FIELDS.START] = fromIso;
  filt["<=" + BX_APPT_FIELDS.END] = toIso;
  const order: Record<string, Json> = {};
  order[BX_APPT_FIELDS.START] = "ASC";
  const list = await bxCall<Array<Record<string, unknown>>>("crm.deal.list", {
    filter: filt,
    select: DEAL_SELECT_FOR_APPT,
    order: { [BX_APPT_FIELDS.START]: "ASC" },
    limit: 200,
  });
  const out: Appointment[] = [];
  (list || []).forEach((d) => {
    const start = d[BX_APPT_FIELDS.START] as string | undefined;
    const end = d[BX_APPT_FIELDS.END] as string | undefined;
    if (!start) return;
    const contactId = d.CONTACT_ID ? Number(d.CONTACT_ID) : undefined;
    const leadId = d.LEAD_ID ? Number(d.LEAD_ID) : undefined;
    out.push({
      id: `deal-${d.ID}`,
      dealId: Number(d.ID),
      title: (d.TITLE as string) || `Deal #${d.ID}`,
      clientEntity: contactId ? "contact" : leadId ? "lead" : undefined,
      clientId: contactId || leadId,
      contactName: (d.TITLE as string) || (d.COMPANY_TITLE as string) || `Клиент #${d.ID}`,
      carPlate: d[BX_AUTO_FIELDS.LICENSE_PLATE] as string | undefined,
      carBrand: d[BX_AUTO_FIELDS.BRAND] as string | undefined,
      carModel: d[BX_AUTO_FIELDS.MODEL] as string | undefined,
      lift: parseLiftField(d[BX_APPT_FIELDS.LIFT]),
      startsAt: start,
      endsAt: end || start,
      serviceIds: ((d[BX_APPT_FIELDS.SERVICE_IDS] as string) || "")
        .split(/[,;\s]+/).filter(Boolean),
      packageIds: ((d[BX_APPT_FIELDS.PACKAGE_IDS] as string) || "")
        .split(/[,;\s]+/).filter(Boolean),
      notes: d[BX_APPT_FIELDS.NOTES] as string | undefined,
      estimateUrl: d[BX_APPT_FIELDS.ESTIMATE_URL] as string | undefined,
    });
  });
  return out;
}

export type UpsertAppointmentInput = {
  dealId?: number | null;
  title?: string;
  contactName?: string;
  phone?: string;
  carPlate?: string;
  carBrand?: string;
  carModel?: string;
  contactId?: number | null;
  leadId?: number | null;
  dealCategoryId?: number;
  dealStageId?: string;
  lift: LiftId;
  startsAt: string;
  endsAt: string;
  serviceIds?: string[] | string;
  packageIds?: string[] | string;
  notes?: string;
  opportunity?: number;
  currencyId?: string;
};

export async function upsertDealAppointment(input: UpsertAppointmentInput): Promise<{ dealId: number; created: boolean }> {
  const servicesStr = Array.isArray(input.serviceIds) ? input.serviceIds.join(",") : input.serviceIds || "";
  const packagesStr = Array.isArray(input.packageIds) ? input.packageIds.join(",") : input.packageIds || "";

  const fields: BxFieldMap = {
    [BX_APPT_FIELDS.LIFT]:  encodeLiftForUpdate(input.lift),
    [BX_APPT_FIELDS.START]: input.startsAt,
    [BX_APPT_FIELDS.END]:   input.endsAt,
    [BX_APPT_FIELDS.SERVICE_IDS]: servicesStr || null,
    [BX_APPT_FIELDS.PACKAGE_IDS]: packagesStr || null,
    [BX_APPT_FIELDS.NOTES]: input.notes || null,
  };
  if (input.contactName || input.title) fields.TITLE = input.title || input.contactName || "Запись на ТО";
  if (input.contactId) fields.CONTACT_ID = Number(input.contactId);
  if (input.leadId)    fields.LEAD_ID    = Number(input.leadId);
  if (input.dealCategoryId) fields.CATEGORY_ID = Number(input.dealCategoryId);
  if (input.dealStageId)    fields.STAGE_ID    = input.dealStageId;
  if (input.opportunity !== undefined) fields.OPPORTUNITY = input.opportunity;
  if (input.currencyId)      fields.CURRENCY_ID = input.currencyId;
  if (input.carPlate) fields[BX_AUTO_FIELDS.LICENSE_PLATE] = input.carPlate;
  if (input.carBrand) fields[BX_AUTO_FIELDS.BRAND] = input.carBrand;
  if (input.carModel) fields[BX_AUTO_FIELDS.MODEL] = input.carModel;
  if (input.phone) fields.UF_CRM_PHONE_PRIMARY || fields.PHONE; // leave phone to later; deal has no direct PHONE, contact/lead does.

  let created = false;
  let dealId = input.dealId ? Number(input.dealId) : 0;
  if (dealId > 0) {
    await bxCall("crm.deal.update", { id: dealId, fields });
  } else {
    if (!fields.CATEGORY_ID) fields.CATEGORY_ID = 0;
    if (!fields.STAGE_ID)    fields.STAGE_ID = "NEW";
    const r = await bxCall<{ ID?: number } | number | string>("crm.deal.add", { fields });
    created = true;
    dealId = typeof r === "object" && r && "ID" in r ? Number((r as { ID?: number }).ID) : Number(r);
  }
  return { dealId, created };
}
