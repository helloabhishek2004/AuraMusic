import urllib.request
import json
import re

with open("att_get.json", "r", encoding="utf-8") as f:
    root = json.load(f)

url = root["botguardData"]["interpreterSafeUrl"]["privateDoNotAccessOrElseTrustedResourceUrlWrappedValue"]
if url.startswith("//"):
    url = "https:" + url

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        js_code = response.read().decode('utf-8')
        
        matches = re.findall(r'(\w+)\.([a-zA-Z0-9_]+)\s*=\s*function\(([^)]*)\)', js_code)
        for m in matches:
            print(m)
        
except Exception as e:
    print("Error:", e)
