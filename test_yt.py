import requests

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
}
data = {
    "context": {
        "client": {
            "clientName": "WEB_REMIX",
            "clientVersion": "1.20230501.00.00"
        }
    },
    "browseId": "UCbWicJ6EusUme4ZndG5jJbg"
}
r = requests.post("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false", json=data, headers=headers)
print(list(r.json().keys()))
if 'header' in r.json():
    print("Header keys:", list(r.json()['header'].keys()))
if 'contents' in r.json():
    print("Contents:", list(r.json()['contents'].keys()))
