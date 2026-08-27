import json
with open("search_response.json", "r", encoding="utf-8") as f:
    root = json.load(f)
contents = root.get("contents", {}).get("tabbedSearchResultsRenderer", {}).get("tabs", [{}])[0].get("tabRenderer", {}).get("content", {}).get("sectionListRenderer", {}).get("contents", [])
if len(contents) > 1:
    items = contents[1].get("itemSectionRenderer", {}).get("contents", [])
    print(json.dumps(items[0] if items else {}, indent=2)[:500])
