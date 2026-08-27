import urllib.request
import json

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

try:
    with urllib.request.urlopen(req) as response:
        data = response.read().decode('utf-8')
        j = json.loads(data)
        if 'c' in j:
            print("FOUND c:", len(j['c']))
        else:
            print("c is NOT in response!")
            print(list(j.keys()))
except Exception as e:
    print("Error:", e)
