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
        
        matches = re.findall(r'trayride\.([a-zA-Z0-9_]+)\s*=', js_code)
        print("trayride properties assigned explicitly:", set(matches))
        
        matches2 = re.findall(r'Sp\.([a-zA-Z0-9_]+)\s*=', js_code)
        print("Sp (trayride) properties assigned explicitly:", set(matches2))
except Exception as e:
    print("Error:", e)
