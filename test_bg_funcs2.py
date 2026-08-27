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
        
        idx = js_code.find("Fm=function")
        if idx != -1: print("Fm is a function")
        idx2 = js_code.find("sF=function")
        if idx2 != -1: print("sF is a function")
        
except Exception as e:
    print("Error:", e)
