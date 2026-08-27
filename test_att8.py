import urllib.request
import json

req = urllib.request.Request(
    'https://www.youtube.com/youtubei/v1/att/get?key=O43z0dpjhgX20SCx4KAo',
    data=b'{}',
    headers={'Content-Type': 'application/json+protobuf', 'User-Agent': 'Mozilla/5.0'}
)

try:
    with urllib.request.urlopen(req) as response:
        data = response.read().decode('utf-8')
        j = json.loads(data)
        print("Keys:", j.keys())
        if 'c' in j:
            print("c length:", len(j['c']))
            print("c prefix:", j['c'][:50])
        else:
            print("c not found!")
except Exception as e:
    print("Error:", e)
