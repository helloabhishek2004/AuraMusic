import urllib.request
import json

payload = {
    "context": {
        "client": {
            "clientName": "WEB",
            "clientVersion": "2.20230526.01.00",
            "visitorData": "CgtRQU43amZfWm92Zyj5s526BjIKCgJJThIEGgAgGw%3D%3D"
        }
    }
}
req = urllib.request.Request(
    'https://www.youtube.com/youtubei/v1/att/get?key=O43z0dpjhgX20SCx4KAo',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
)
try:
    with urllib.request.urlopen(req) as response:
        data = response.read().decode('utf-8')
        j = json.loads(data)
        print("c length:", len(j.get('c', '')))
except Exception as e:
    print("Error:", e)
