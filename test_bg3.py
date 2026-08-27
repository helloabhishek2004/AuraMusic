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
        # Print matches for exported functions
        # Look for something assigned to a global object, like this.XXX = function or R.XXX = function
        matches = re.findall(r'(\w+)\.([a-zA-Z0-9_]{1,6})\s*=\s*function\(([^)]*)\)', js_code)
        for m in matches:
            if m[0] not in ('this', 'window', 'self'):
                # maybe check if m[0] was assigned to 'this' or 'self'
                # in the script it does: R=this||self
                if m[0] == 'R':
                    print("Found exported to R:", m[1], "args:", m[2])
                continue
            print("Found exported to", m[0], ":", m[1], "args:", m[2])
        
        matches = re.findall(r'window\s*\[\s*["\']([a-zA-Z0-9_]+)["\']\s*\]\s*=\s*function', js_code)
        for m in matches:
            print("Found exported via bracket notation:", m)
except Exception as e:
    print("Error:", e)
