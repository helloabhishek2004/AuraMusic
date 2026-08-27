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
    j = json.loads(response.read().decode('utf-8'))
    url = "https:" + j['botguardData']['interpreterSafeUrl']['privateDoNotAccessOrElseTrustedResourceUrlWrappedValue']
    
    req2 = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req2) as resp2:
        js_code = resp2.read().decode('utf-8')
        
        # Look for global assignments
        print(re.findall(r'window\.(\w+)\s*=', js_code))
        print(re.findall(r'this\.(\w+)\s*=', js_code))
        
        # Look for the main class
        print(re.findall(r'(\w+)\.([a-zA-Z0-9_]+)=function\(f,D,C,b,B,y,H,c,S,v\)', js_code))
