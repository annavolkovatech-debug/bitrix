import json, urllib.request, urllib.parse
W = "https://b24-12cc50.bitrix24.com/rest/1/3vh62feyd4jfidcd/"

def call(m, p=None):
    data = urllib.parse.urlencode(p or {}, doseq=True).encode()
    req = urllib.request.Request(W + m, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

for name, prefix in [("DEAL", "crm.deal"), ("LEAD", "crm.lead"), ("CONTACT", "crm.contact")]:
    r = call(f"{prefix}.userfield.list", {})
    rows = [f for f in (r.get("result") or []) if "CAR" in (f.get("FIELD_NAME") or "").upper()]
    print(f"\n=== {name} CAR-fields: {len(rows)} / total UF: {r.get('total')}")
    for f in sorted(rows, key=lambda x: (x.get("FIELD_NAME") or "")):
        label = f.get("EDIT_FORM_LABEL") if isinstance(f.get("EDIT_FORM_LABEL"), str) else (f.get("EDIT_FORM_LABEL") or {}).get("en")
        print(f"  {f['FIELD_NAME']:30s}  ID={str(f.get('ID')):>5}  TYPE={f.get('USER_TYPE_ID'):10s}  XML={f.get('XML_ID'):20s}  LABEL={label}")
