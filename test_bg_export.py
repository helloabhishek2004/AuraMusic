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
        
        # Let's find Sp.Eru_ again
        match = re.search(r'(\w+)\.([a-zA-Z0-9_]+)\s*=\s*function\(([^)]+)\)', js_code)
        if match:
            obj_name = match.group(1)
            func_name = match.group(2)
            args = match.group(3)
            print(f"Found exported function: {obj_name}.{func_name} with args {args}")
            
            # Find declaration of the object
            print("Looking for declaration of", obj_name)
            for m in re.finditer(rf'[\s,;]{obj_name}\s*=', js_code):
                idx = m.start()
                print("Decl:", js_code[idx-50:idx+50])
except Exception as e:
    print("Error:", e)
