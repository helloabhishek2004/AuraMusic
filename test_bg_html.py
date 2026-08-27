import urllib.request
import re

req = urllib.request.Request(
    'https://www.youtube.com',
    headers={'User-Agent': 'Mozilla/5.0'}
)
with urllib.request.urlopen(req) as response:
    html = response.read().decode('utf-8')
    match = re.search(r'\"(/[a-zA-Z0-9_/.\-]+botguard[a-zA-Z0-9_/.\-]+\.js)\"', html)
    if match:
        print("FOUND BOTGUARD URL:", match.group(1))
    else:
        print("BOTGUARD URL NOT FOUND IN HTML")
        
    bg_matches = re.findall(r'src="([^"]*botguard[^"]*)"', html)
    print("Script tags with botguard:", bg_matches)
