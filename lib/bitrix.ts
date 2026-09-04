import { httpJson } from "./http";
import type { Json } from "./types";

const BITRIX_WEBHOOK_URL = process.env.BITRIX_WEBHOOK_URL || "";

function ensureWebhook(): string {
  if (!BITRIX_WEBHOOK_URL) {
    throw new Error("BITRIX_WEBHOOK_URL не настроен в env");
  }
  return BITRIX_WEBHOOK_URL.replace(/\/$/, "");
}

function buildUrl(method: string): string {
  return `${ensureWebhook()}/${method}`;
}

export async function bxCall<T = unknown>(method: string, params?: Json): Promise<T> {
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

export type BxFieldMap = Record<string, string | number | null | undefined | Json>;

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
): Promise<Array<{ entityType: BxEntityType; id: number; title: string; carBrand?: string }>> {
  const q = `%${query}%`;
  const out: Array<{ entityType: BxEntityType; id: number; title: string; carBrand?: string }> = [];

  await Promise.all(
    entityTypes.map(async (entityType) => {
      const method =
        entityType === "lead" ? "crm.lead.list" : entityType === "contact" ? "crm.contact.list" : "crm.deal.list";
      const list = await bxCall<Array<Record<string, unknown>>>(method, {
        filter: {
          "%TITLE": q,
        },
        select: ["ID", "TITLE", "NAME", "LAST_NAME", "COMPANY_TITLE", BX_AUTO_FIELDS.BRAND, BX_AUTO_FIELDS.MODEL],
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
        out.push({ entityType, id, title, carBrand: carBrand || undefined });
      });
    })
  );

  return out;
}
