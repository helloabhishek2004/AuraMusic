import json
with open("artist_response.json", "r", encoding="utf-8") as f:
    root = json.load(f)
print("Root keys:", list(root.keys()))
if "error" in root:
    print(root["error"])
