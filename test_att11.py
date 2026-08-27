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
    prog = j['botguardData']['program']
    print("Fetched URL and Program")
    
    req2 = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req2) as resp2:
        js_code = resp2.read().decode('utf-8')
        
        # We know it ends with $_.XXX=function(...)
        # Or this.XXX=function(...)
        # Let's find the assignment of a function that returns an array of two functions
        match = re.search(r'\$\_\.([a-zA-Z0-9_]+)\s*=\s*function', js_code)
        if match:
            print("Found function name:", match.group(1))
        else:
            print("Regex failed to find function name!")
