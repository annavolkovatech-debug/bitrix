"""Проставить человекочитаемые EDIT_FORM_LABEL (en + ru) и HELP_MESSAGE для всех 36 авто-полей."""
import json, urllib.request, urllib.parse, time
W = "https://b24-12cc50.bitrix24.com/rest/1/3vh62feyd4jfidcd/"

LABELS: list[tuple[str, str, str]] = [
    # XML_ID,             en_label,                ru_label
    ("UF_CAR_PLATE",       "License plate",         "Госномер автомобиля"),
    ("UF_CAR_BRAND",       "Car brand",             "Марка авто"),
    ("UF_CAR_MODEL",       "Car model",             "Модель авто"),
    ("UF_CAR_YEAR",        "Manufacture year",      "Год выпуска"),
    ("UF_CAR_VIN",         "VIN",                   "VIN-номер"),
    ("UF_CAR_ENGINE",      "Engine info",           "Двигатель"),
    ("UF_CAR_ENGINE_CC",   "Engine capacity (ccm)", "Объём двигателя, см³"),
    ("UF_CAR_ENGINE_POWER","Engine power (hp)",     "Мощность, л.с."),
    ("UF_CAR_FUEL",        "Fuel type",             "Тип топлива"),
    ("UF_CAR_BODY",        "Body type",             "Тип кузова"),
    ("UF_CAR_COLOR",       "Color",                 "Цвет"),
    ("UF_CAR_REG_DATE",    "Registration date",     "Дата регистрации"),
]

ENTITIES = [("DEAL", "crm.deal"), ("LEAD", "crm.lead"), ("CONTACT", "crm.contact")]

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

for ename, prefix in ENTITIES:
    lst = call(f"{prefix}.userfield.list").get("result") or []
    by_xml = { (f.get("XML_ID") or "").upper(): f for f in lst if "CAR" in (f.get("FIELD_NAME") or "").upper() }
    print(f"\n== {ename}")
    for xml, en_lbl, ru_lbl in LABELS:
        f = by_xml.get(xml.upper())
        if not f:
            print(f"  SKIP (not found): {xml}")
            continue
        fid = f["ID"]
        params = {
            "id": fid,
            "fields[EDIT_FORM_LABEL][en]": en_lbl,
            "fields[EDIT_FORM_LABEL][ru]": ru_lbl,
            "fields[LIST_COLUMN_LABEL][en]": en_lbl,
            "fields[LIST_COLUMN_LABEL][ru]": ru_lbl,
            "fields[LIST_FILTER_LABEL][en]": en_lbl,
            "fields[LIST_FILTER_LABEL][ru]": ru_lbl,
            "fields[HELP_MESSAGE][en]": en_lbl,
            "fields[HELP_MESSAGE][ru]": ru_lbl,
        }
        r = call(f"{prefix}.userfield.update", params)
        ok = "error" not in r
        print(f"  {xml:22s} -> ID={fid:>4}  OK={ok}  {r.get('error','')}")
        time.sleep(0.2)
