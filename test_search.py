import urllib.request
import json

payload = {
    "context": {
        "client": {
            "clientName": "WEB_REMIX",
            "clientVersion": "1.20230524.01.00"
        }
    },
    "query": "21 savage"
}
req = urllib.request.Request(
    'https://music.youtube.com/youtubei/v1/search?prettyPrint=false',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
)
try:
    with urllib.request.urlopen(req) as response:
        with open("search_response.json", "w", encoding="utf-8") as f:
            f.write(response.read().decode('utf-8'))
        print("Wrote search_response.json")
except Exception as e:
    print("Error:", e)
