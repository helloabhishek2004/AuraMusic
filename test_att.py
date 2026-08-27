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
    'https://www.youtube.com/youtubei/v1/att/get?key=O43z0dpjhgX20SCx4KAo&prettyPrint=false',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
)
try:
    with urllib.request.urlopen(req) as response:
        with open("att_get.json", "w", encoding="utf-8") as f:
            f.write(response.read().decode('utf-8'))
        print("Wrote att_get.json")
except Exception as e:
    print("Error:", e)
