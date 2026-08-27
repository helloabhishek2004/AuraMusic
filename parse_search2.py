# -*- coding: utf-8 -*-
import json

with open("search_response.json", "r", encoding="utf-8") as f:
    root = json.load(f)

contents = root.get("contents", {}).get("tabbedSearchResultsRenderer", {}).get("tabs", [{}])[0].get("tabRenderer", {}).get("content", {}).get("sectionListRenderer", {}).get("contents", [])

for section in contents:
    shelf = section.get("musicCardShelfRenderer")
    if shelf:
        print("Found Card Shelf:", shelf.get("header", {}).get("musicCardShelfHeaderBasicRenderer", {}).get("title", {}).get("runs", [{}])[0].get("text", "Unknown"))
    shelf = section.get("musicShelfRenderer")
    if not shelf:
        continue
    title = shelf.get("title", {}).get("runs", [{}])[0].get("text", "Unknown") if shelf.get("title") else "Songs?"
    print("Found Shelf:", title)
    
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
        
        video_id = None
        if item.get("playlistItemData"):
            video_id = item.get("playlistItemData").get("videoId")
        if not video_id and item.get("navigationEndpoint", {}).get("watchEndpoint"):
            video_id = item.get("navigationEndpoint", {}).get("watchEndpoint", {}).get("videoId")
        if not video_id and title_run.get("navigationEndpoint", {}).get("watchEndpoint"):
            video_id = title_run.get("navigationEndpoint", {}).get("watchEndpoint", {}).get("videoId")
            
        # check if videoId is SOMEWHERE ELSE!
        if not video_id:
            overlay = item.get("overlay", {}).get("musicItemThumbnailOverlayRenderer", {}).get("content", {}).get("musicPlayButtonRenderer", {}).get("playNavigationEndpoint", {}).get("watchEndpoint", {})
            if overlay.get("videoId"):
                video_id = "FROM_OVERLAY:" + overlay.get("videoId")
                
        artist_run = columns[1].get("musicResponsiveListItemFlexColumnRenderer", {}).get("text", {}).get("runs", [])
        artist = ""
        for ar in artist_run:
            if ar.get("text", "").strip() != u'\u2022':
                artist += ar.get("text", "")
                
        print(f"  -> Title: {title}, VideoID: {video_id}, Artist: {artist[:30]}")
