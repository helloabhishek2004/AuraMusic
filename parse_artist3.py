import json
with open("artist_response.json", "r", encoding="utf-8") as f:
    root = json.load(f)
print("Keys in contents:", list(root.get("contents", {}).keys()))
