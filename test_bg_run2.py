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
req = urllib.request.Request('https://www.youtube.com/youtubei/v1/att/get?key=O43z0dpjhgX20SCx4KAo', data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
j = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
url = "https:" + j['botguardData']['interpreterSafeUrl']['privateDoNotAccessOrElseTrustedResourceUrlWrappedValue']
prog = j['botguardData']['program']

req2 = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
js_code = urllib.request.urlopen(req2).read().decode('utf-8')

match = re.search(r'\$\_\.([a-zA-Z0-9_]+)\s*=\s*function', js_code)
funcName = match.group(1)

html = f"""
<html><head><script>
// We need to define $_ as window
window.$_ = window;
</script>
<script>
{js_code}
</script>
<script>
try {{
    const minterFuncs = window['{funcName}']('{prog}');
    console.log("Minter funcs length:", minterFuncs.length);
    // Usually identifier is passed to mint?
    const token = minterFuncs[0]('123456');
    document.write("TOKEN=" + token);
}} catch(e) {{
    document.write("Error=" + e.message);
}}
</script></head><body></body></html>
"""
with open("test_bg.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Wrote test_bg.html")
