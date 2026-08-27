import urllib.request
import json
import re

with open("att_get.json", "r", encoding="utf-8") as f:
    root = json.load(f)

url = root["botguardData"]["interpreterSafeUrl"]["privateDoNotAccessOrElseTrustedResourceUrlWrappedValue"]
if url.startswith("//"):
    url = "https:" + url

print("Fetching URL:", url)

req = urllib.request.Request(
    url,
    headers={'User-Agent': 'Mozilla/5.0'}
)
try:
    with urllib.request.urlopen(req) as response:
        js_code = response.read().decode('utf-8')
        match = re.search(r'\$_\.([a-zA-Z0-9_]+)\s*=\s*function', js_code)
        if match:
            print("Found minter function:", match.group(1))
        else:
            print("COULD NOT FIND MINTER FUNCTION!")
            
        print("Script length:", len(js_code))
except Exception as e:
    print("Error:", e)
