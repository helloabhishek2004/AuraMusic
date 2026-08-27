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
        
        idx = js_code.find("Sp.ad=Fm")
        print(js_code[idx-50:idx+50])
        
        # Check what Fm is
        fm_decl = re.search(r'function Fm\(', js_code)
        if fm_decl: print("Fm is a function")
        sf_decl = re.search(r'function sF\(', js_code)
        if sf_decl: print("sF is a function")
        
except Exception as e:
    print("Error:", e)
