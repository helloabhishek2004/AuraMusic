import json
with open("search_response.json", "r", encoding="utf-8") as f:
    root = json.load(f)
contents = root.get("contents", {}).get("tabbedSearchResultsRenderer", {}).get("tabs", [{}])[0].get("tabRenderer", {}).get("content", {}).get("sectionListRenderer", {}).get("contents", [])
for section in contents:
    items = section.get("itemSectionRenderer", {}).get("contents", [])
    for item in items:
        if "musicResponsiveListItemRenderer" in item:
            flex = item["musicResponsiveListItemRenderer"].get("flexColumns", [])
            title = flex[0].get("musicResponsiveListItemFlexColumnRenderer", {}).get("text", {}).get("runs", [{}])[0].get("text")
            endpoint = item["musicResponsiveListItemRenderer"].get("navigationEndpoint", {})
            if "browseEndpoint" in endpoint:
                print(title, endpoint["browseEndpoint"]["browseId"])
