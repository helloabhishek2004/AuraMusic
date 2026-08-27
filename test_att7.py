import urllib.request
import json
import re

payload = {
    "context": {
        "client": {
            "clientName": "WEB",
            "clientVersion": "2.20230526.01.00"
        }
    }
}

req = urllib.request.Request(
    'https://www.youtube.com/youtubei/v1/att/get?key=O43z0dpjhgX20SCx4KAo',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
)

with urllib.request.urlopen(req) as response:
    data = response.read().decode('utf-8')
    j = json.loads(data)
    url = "https:" + j['botguardData']['interpreterSafeUrl']['privateDoNotAccessOrElseTrustedResourceUrlWrappedValue']
    
    req2 = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req2) as resp2:
        js_code = resp2.read().decode('utf-8')
        print("JS CODE length:", len(js_code))
        
        matches = re.findall(r'window\.(\w+)=function\(', js_code)
        if matches:
            print("Exported window properties:", matches)
            
        print("Bottom of JS code:", js_code[-200:])
