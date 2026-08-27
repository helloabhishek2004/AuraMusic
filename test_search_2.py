import requests, json

headers = {
    'User-Agent': 'Mozilla/5.0'
}
data = {
    "context": {
        "client": {
            "clientName": "WEB_REMIX",
            "clientVersion": "1.20230501.00.00"
        }
    },
    "query": "Daft Punk"
}
r = requests.post("https://music.youtube.com/youtubei/v1/search?prettyPrint=false", json=data, headers=headers)
with open('search_test.json', 'w') as f:
    json.dump(r.json(), f, indent=2)
