"""Создать UF-поля КАЛЕНДАРЯ для СДЕЛОК (DEAL) — 4 подъёмника, время, услуги, пакеты, смета.

Поля создаются ТОЛЬКО в DEAL (потому что запись на ТО — это стадия воронки, сделка).
"""
import json, urllib.request, urllib.parse, time
W = "https://b24-12cc50.bitrix24.com/rest/1/3vh62feyd4jfidcd/"

FIELDS_SPEC: list[tuple[str, str, str, str]] = [
    # (FIELD_NAME, en_label,          ru_label,           type)
    ("UF_APPT_LIFT",       "Lift / Car lift",    "Подъёмник",              "enumeration"),
    ("UF_APPT_START",      "Appointment start",  "Дата и время начала",    "datetime"),
    ("UF_APPT_END",        "Appointment end",    "Дата и время окончания", "datetime"),
    ("UF_APPT_SERVICE_IDS","Services (catalog)","Услуги (список ID)",     "string"),
    ("UF_APPT_PACKAGE_IDS","Packages (catalog)","Пакеты услуг (список)",  "string"),
    ("UF_APPT_NOTES",      "Notes / comment",    "Комментарий мастера",    "string"),
    ("UF_APPT_EST_URL",    "Estimate (Moloni) URL", "Смета (Moloni) URL", "string"),
]

LIFT_ENUM_VALUES = ["Lift 1 — Подъёмник 1", "Lift 2 — Подъёмник 2", "Lift 3 — Подъёмник 3", "Lift 4 — Подъёмник 4"]

def call(m, p=None):
    data = urllib.parse.urlencode(p or {}, doseq=True).encode()
    req = urllib.request.Request(W + m, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            time.sleep(2)
    raise RuntimeError(m)

def list_uf():
    out = []
    st = 0
    while True:
        r = call("crm.deal.userfield.list", {"start": st})
        batch = r.get("result") or []
        out.extend(batch)
        total = r.get("total") or len(out)
        nxt = r.get("next")
        st = r.get("next", st + len(batch)) if nxt is None else int(nxt)
        if len(out) >= total or not batch:
            break
        time.sleep(0.2)
    return out

existing = list_uf()
by_xml = { (f.get("XML_ID") or "").upper(): f for f in existing }
by_fn  = { (f.get("FIELD_NAME") or "").upper(): f for f in existing }

for fn, en, ru, t in FIELDS_SPEC:
    xml = fn.upper()
    if xml in by_xml or fn.upper() in by_fn:
        f = by_xml.get(xml) or by_fn.get(fn.upper())
        fid = f["ID"]
        print(f"[EXIST] {fn:22s} (id={fid})")
    else:
        params = {
            "fields[USER_TYPE_ID]": t,
            "fields[FIELD_NAME]":   fn,
            "fields[XML_ID]":       xml,
            "fields[SORT]":         "950",
            "fields[MULTIPLE]":     "N",
            "fields[MANDATORY]":    "N",
            "fields[SHOW_IN_LIST]": "Y",
            "fields[EDIT_IN_LIST]": "Y",
            "fields[IS_SEARCHABLE]":"Y",
            "fields[EDIT_FORM_LABEL][en]": en,
            "fields[EDIT_FORM_LABEL][ru]": ru,
            "fields[LIST_COLUMN_LABEL][en]": en,
            "fields[LIST_COLUMN_LABEL][ru]": ru,
            "fields[LIST_FILTER_LABEL][en]": en,
            "fields[LIST_FILTER_LABEL][ru]": ru,
            "fields[HELP_MESSAGE][en]": en,
            "fields[HELP_MESSAGE][ru]": ru,
        }
        if t == "enumeration":
            for i, lv in enumerate(LIFT_ENUM_VALUES, start=1):
                params[f"fields[LIST][{i}][XML_ID]"] = f"LIFT_{i}"
                params[f"fields[LIST][{i}][VALUE]"]  = lv
                params[f"fields[LIST][{i}][SORT]"]   = str(i * 10)
                params[f"fields[LIST][{i}][DEF]"]    = "Y" if i == 1 else "N"
        r = call("crm.deal.userfield.add", params)
        if "error" in r:
            print(f"[FAIL ] {fn}: {r}")
            continue
        print(f"[NEW  ] {fn:22s} -> {r.get('result')}")
        time.sleep(0.3)

print("\n=== Done. Reloading userfields for IDs ===")
existing2 = list_uf()
for fn, *_ in FIELDS_SPEC:
    f = next((f for f in existing2 if (f.get("XML_ID") or "").upper() == fn.upper() or (f.get("FIELD_NAME") or "").upper() == fn.upper()), None)
    if f:
        print(f"  {f['FIELD_NAME']:30s}  ID={str(f.get('ID')):>4}  TYPE={f.get('USER_TYPE_ID'):12s}  LABEL_en={f.get('EDIT_FORM_LABEL') if isinstance(f.get('EDIT_FORM_LABEL'), str) else (f.get('EDIT_FORM_LABEL') or {}).get('en')}")
