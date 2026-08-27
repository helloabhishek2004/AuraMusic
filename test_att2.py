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
    headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'}
)

try:
    with urllib.request.urlopen(req) as response:
        data = response.read().decode('utf-8')
        j = json.loads(data)
        print("c field length:", len(j.get('c', '')))
        print("c field:", j.get('c', '')[:50] + "...")
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
