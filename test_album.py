import requests, json
headers = {'User-Agent': 'Mozilla/5.0'}
data = {
    "context": {"client": {"clientName": "WEB_REMIX", "clientVersion": "1.20230501.00.00"}},
    "browseId": "MPREb_K8qWMWVqXGi"
}
r = requests.post("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false", json=data, headers=headers)
with open('album_test.json', 'w') as f:
    json.dump(r.json(), f, indent=2)

print("Album Keys:", list(r.json().keys()))
if 'header' in r.json():
    print("Album Header Keys:", list(r.json()['header'].keys()))
