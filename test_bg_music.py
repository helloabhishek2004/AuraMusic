import urllib.request
import re

req = urllib.request.Request(
    'https://music.youtube.com',
    headers={'User-Agent': 'Mozilla/5.0'}
)
with urllib.request.urlopen(req) as response:
    html = response.read().decode('utf-8')
    match = re.search(r'\"(/[a-zA-Z0-9_/.\-]+botguard[a-zA-Z0-9_/.\-]+\.js)\"', html)
    if match:
        print("FOUND BOTGUARD URL in MUSIC:", match.group(1))
    else:
        print("BOTGUARD URL NOT FOUND IN MUSIC HTML")
