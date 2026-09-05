import json, urllib.request, urllib.parse, time
W = "https://b24-12cc50.bitrix24.com/rest/1/3vh62feyd4jfidcd/"
LABELS = [
    ("UF_APPT_LIFT",          "Lift (1-4)",            "Подъёмник"),
    ("UF_APPT_START",         "Date/Time Start",       "Дата и время начала"),
    ("UF_APPT_END",           "Date/Time End",         "Дата и время окончания"),
    ("UF_APPT_SERVICE_IDS",   "Service IDs (catalog)", "Услуги (через запятую)"),
    ("UF_APPT_PACKAGE_IDS",   "Package IDs (catalog)", "Пакеты услуг (через запятую)"),
    ("UF_APPT_NOTES",         "Notes",                 "Комментарий / Проблемы"),
    ("UF_APPT_EST_URL",       "Estimate URL (Moloni)", "Смета: ссылка PDF"),
]
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

lst = call("crm.deal.userfield.list").get("result") or []
by_xml = {(f.get("XML_ID") or "").upper(): f for f in lst}
for xml, en, ru in LABELS:
    f = by_xml.get(xml)
    if not f:
        print("SKIP", xml); continue
    r = call("crm.deal.userfield.update", {
        "id": f["ID"],
        "fields[EDIT_FORM_LABEL][en]": en,
        "fields[EDIT_FORM_LABEL][ru]": ru,
        "fields[LIST_COLUMN_LABEL][en]": en,
        "fields[LIST_COLUMN_LABEL][ru]": ru,
        "fields[LIST_FILTER_LABEL][en]": en,
        "fields[LIST_FILTER_LABEL][ru]": ru,
        "fields[HELP_MESSAGE][en]": en,
        "fields[HELP_MESSAGE][ru]": ru,
    })
    print(xml, f["ID"], "OK" if "error" not in r else r)
    time.sleep(0.2)
