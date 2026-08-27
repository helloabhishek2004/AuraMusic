import json
with open("search_response.json", "r", encoding="utf-8") as f:
    root = json.load(f)
contents = root.get("contents", {}).get("tabbedSearchResultsRenderer", {}).get("tabs", [{}])[0].get("tabRenderer", {}).get("content", {}).get("sectionListRenderer", {}).get("contents", [])
for idx, section in enumerate(contents):
    if "itemSectionRenderer" in section:
        items = section["itemSectionRenderer"].get("contents", [])
        for item in items:
            if "musicResponsiveListItemRenderer" in item:
                flex = item["musicResponsiveListItemRenderer"].get("flexColumns", [])
                if flex:
                    title = flex[0].get("musicResponsiveListItemFlexColumnRenderer", {}).get("text", {}).get("runs", [{}])[0].get("text")
                    print(f"[{idx}] Title:", title)
            elif "shelfRenderer" in item:
                print(f"[{idx}] SHELF RENDERER")
            else:
                print(f"[{idx}] OTHER RENDERER:", list(item.keys()))
