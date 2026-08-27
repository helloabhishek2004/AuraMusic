import urllib.request
import json
import re

with open("att_get.json", "r", encoding="utf-8") as f:
    root = json.load(f)

url = root["botguardData"]["interpreterSafeUrl"]["privateDoNotAccessOrElseTrustedResourceUrlWrappedValue"]
if url.startswith("//"):
    url = "https:" + url

req = urllib.request.Request(
    url,
    headers={'User-Agent': 'Mozilla/5.0'}
)
try:
    with urllib.request.urlopen(req) as response:
        js_code = response.read().decode('utf-8')
        for m in re.finditer(r'[\s,;]M\s*=', js_code):
            idx = m.start()
            print(js_code[idx-50:idx+50])
except Exception as e:
    print("Error:", e)
