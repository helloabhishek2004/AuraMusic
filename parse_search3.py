# -*- coding: utf-8 -*-
import json
with open("search_response.json", "r", encoding="utf-8") as f:
    root = json.load(f)
contents = root.get("contents", {}).get("tabbedSearchResultsRenderer", {}).get("tabs", [{}])[0].get("tabRenderer", {}).get("content", {}).get("sectionListRenderer", {}).get("contents", [])
for section in contents:
    print("Section keys:", list(section.keys()))
