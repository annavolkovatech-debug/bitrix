#!/usr/bin/env python3
"""Создать 12 авто-полей UF_CAR_* в DEAL / LEAD / CONTACT через REST API Bitrix24 cloud (international .com).

Выводит JSON {DEAL:{FIELD:UF_CRM_XXX}, LEAD:{...}, CONTACT:{...}} для подмены маппинга в lib/bitrix.ts.
Уже существующие поля с таким же EDIT_FORM_LABEL / FIELD_NAME — переиспользуются (не создаются дубли).
"""
from __future__ import annotations
import json
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

WEBHOOK = "https://b24-12cc50.bitrix24.com/rest/1/3vh62feyd4jfidcd/"

# Порядок важен — по этому порядку мапим потом BX_AUTO_FIELDS
FIELDS_SPEC: list[tuple[str, str, str, str]] = [
    # (FIELD_NAME, EDIT_FORM_LABEL [en_ro], USER_TYPE_ID [string|integer], XML_ID)
    ("UF_CAR_PLATE",      "License plate",           "string",  "UF_CAR_PLATE"),
    ("UF_CAR_BRAND",      "Car brand",               "string",  "UF_CAR_BRAND"),
    ("UF_CAR_MODEL",      "Car model",               "string",  "UF_CAR_MODEL"),
    ("UF_CAR_YEAR",       "Manufacture year",        "integer", "UF_CAR_YEAR"),
    ("UF_CAR_VIN",        "VIN",                     "string",  "UF_CAR_VIN"),
    ("UF_CAR_ENGINE",     "Engine info",             "string",  "UF_CAR_ENGINE"),
    ("UF_CAR_ENGINE_CC",  "Engine capacity (ccm)",   "integer", "UF_CAR_ENGINE_CC"),
    ("UF_CAR_ENGINE_POWER","Engine power (hp)",      "integer", "UF_CAR_ENGINE_POWER"),
    ("UF_CAR_FUEL",       "Fuel type",               "string",  "UF_CAR_FUEL"),
    ("UF_CAR_BODY",       "Body type",               "string",  "UF_CAR_BODY"),
    ("UF_CAR_COLOR",      "Color",                   "string",  "UF_CAR_COLOR"),
    ("UF_CAR_REG_DATE",   "Registration date",       "string",  "UF_CAR_REG_DATE"),
]

ENTITIES: list[tuple[str, str]] = [
    # (method prefix, english name)
    ("crm.deal",    "DEAL"),
    ("crm.lead",    "LEAD"),
    ("crm.contact", "CONTACT"),
]

def bx_call(method: str, params: dict | None = None) -> dict:
    url = WEBHOOK + method
    data = urllib.parse.urlencode(params or {}, doseq=True).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="ignore")
            try:
                j = json.loads(body)
            except Exception:
                j = {"error": str(e), "body": body[:300]}
            # quota / op limit — soft retry
            if e.code == 429 or (isinstance(j, dict) and j.get("error") in ("OPERATION_LIMIT", "QUERY_LIMIT")):
                time.sleep(2)
                continue
            raise RuntimeError(f"{method} -> HTTP {e.code}: {j}") from e
    raise RuntimeError(f"{method}: retries exhausted")

def list_existing(prefix: str) -> list[dict]:
    """crm.*.userfield.list with pagination up to 100."""
    out: list[dict] = []
    start = 0
    while True:
        r = bx_call(f"{prefix}.userfield.list", {"start": start, "order[ID]": "ASC"})
        batch = r.get("result") or []
        out.extend(batch)
        total = r.get("total") or len(out)
        nxt = r.get("next")
        start = r.get("next", start + len(batch)) if nxt is None else int(nxt)
        if len(out) >= total or not batch:
            break
        time.sleep(0.3)
    return out

def ensure_field(prefix: str, spec: tuple[str, str, str, str], existing: list[dict]) -> str:
    field_name, label, u_type, xml_id = spec
    # 1. Search by XML_ID exact match → fastest
    for f in existing:
        if (f.get("XML_ID") or "").upper() == xml_id.upper():
            return f["FIELD_NAME"]
    # 2. Search by EDIT_FORM_LABEL fuzzy → avoid duplicates in en/ru
    needle = {label, xml_id, field_name}
    for f in existing:
        ef = (f.get("EDIT_FORM_LABEL") or "").lower()
        fn = (f.get("FIELD_NAME") or "").upper()
        xl = (f.get("XML_ID") or "").lower()
        if fn == field_name.upper():
            return f["FIELD_NAME"]
        if any((n.lower() == ef or n.lower() == xl) for n in needle):
            return f["FIELD_NAME"]
    # 3. Create new
    params = {
        "fields[USER_TYPE_ID]": u_type,
        "fields[FIELD_NAME]":   field_name,
        "fields[XML_ID]":       xml_id,
        "fields[SORT]":         "900",
        "fields[MULTIPLE]":     "N",
        "fields[MANDATORY]":    "N",
        "fields[SHOW_FILTER]":  "I",
        "fields[SHOW_IN_LIST]": "Y",
        "fields[EDIT_IN_LIST]": "Y",
        "fields[IS_SEARCHABLE]":"Y",
        "fields[EDIT_FORM_LABEL][en]": label,
        "fields[LIST_COLUMN_LABEL][en]": label,
        "fields[LIST_FILTER_LABEL][en]": label,
        "fields[ERROR_MESSAGE][en]": "",
        "fields[HELP_MESSAGE][en]": label,
    }
    r = bx_call(f"{prefix}.userfield.add", params)
    if "error" in r:
        raise RuntimeError(f"create {prefix} {field_name} error: {r}")
    res = r.get("result")
    if isinstance(res, dict):
        fn = res.get("FIELD_NAME") or str(res.get("field") or res.get("id"))
    else:
        fn = str(res)  # sometimes returns just the id int
    time.sleep(0.2)
    # Reload existing immediately to see new field name (UF_CRM_xxxx)
    return fn

def main() -> int:
    mapping: dict[str, dict[str, str]] = {}
    for prefix, ename in ENTITIES:
        print(f"[*] Fetch existing userfields for {ename}...", file=sys.stderr)
        existing = list_existing(prefix)
        print(f"    found {len(existing)} userfields", file=sys.stderr)
        ent_map: dict[str, str] = {}
        for spec in FIELDS_SPEC:
            field_logical = spec[3]  # XML_ID = UF_CAR_*
            try:
                real_field = ensure_field(prefix, spec, existing)
            except Exception as e:
                print(f"[!] FAIL {ename}/{spec[0]}: {e}", file=sys.stderr)
                real_field = ""
            # refresh existing if newly created to get real UF_CRM_xxx
            if not any((f.get("FIELD_NAME") or "").upper() == real_field.upper() for f in existing):
                existing = list_existing(prefix)
                # If returned numeric id, remap it to FIELD_NAME from reloaded list
                if real_field.isdigit():
                    for f in existing:
                        if str(f.get("ID")) == real_field:
                            real_field = f.get("FIELD_NAME") or real_field
                            break
            ent_map[field_logical] = real_field
            print(f"    {ename}: {field_logical} -> {real_field}", file=sys.stderr)
        mapping[ename] = ent_map
    json.dump(mapping, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
