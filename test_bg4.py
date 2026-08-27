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
        print(js_code[-500:])
except Exception as e:
    print("Error:", e)
