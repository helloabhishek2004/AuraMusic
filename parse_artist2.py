# -*- coding: utf-8 -*-
import json

with open("artist_response2.json", "r", encoding="utf-8") as f:
    root = json.load(f)

tabs = root.get("contents", {}).get("singleColumnBrowseResultsRenderer", {}).get("tabs", [])
if tabs:
    sections = tabs[0].get("tabRenderer", {}).get("content", {}).get("sectionListRenderer", {}).get("contents", [])
    for section in sections:
        shelf = section.get("musicShelfRenderer") or section.get("musicCarouselShelfRenderer")
        if not shelf:
            continue
        print("Found a shelf with", len(shelf.get("contents", [])), "items")
        
        items = shelf.get("contents", [])
        for item_wrapper in items:
            item = item_wrapper.get("musicResponsiveListItemRenderer")
            if not item:
                continue
                
            columns = item.get("flexColumns", [])
            if len(columns) < 2:
                continue
                
            title_run = columns[0].get("musicResponsiveListItemFlexColumnRenderer", {}).get("text", {}).get("runs", [{}])[0]
            title = title_run.get("text")
            
            # This is Kotlin's current logic
            video_id = None
            if item.get("playlistItemData"):
                video_id = item.get("playlistItemData").get("videoId")
            if not video_id and item.get("navigationEndpoint", {}).get("watchEndpoint"):
                video_id = item.get("navigationEndpoint", {}).get("watchEndpoint", {}).get("videoId")
            if not video_id and title_run.get("navigationEndpoint", {}).get("watchEndpoint"):
                video_id = title_run.get("navigationEndpoint", {}).get("watchEndpoint", {}).get("videoId")
            if not video_id:
                overlay = item.get("overlay", {}).get("musicItemThumbnailOverlayRenderer", {}).get("content", {}).get("musicPlayButtonRenderer", {}).get("playNavigationEndpoint", {}).get("watchEndpoint", {})
                if overlay.get("videoId"):
                    video_id = "FROM_OVERLAY:" + overlay.get("videoId")
                
            print(f"  -> Title: {title}, VideoID: {video_id}")
