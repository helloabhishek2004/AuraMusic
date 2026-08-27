import json
with open('search_album.json') as f:
    d = json.load(f)
tabs = d['contents']['tabbedSearchResultsRenderer']['tabs']
sections = tabs[0]['tabRenderer']['content']['sectionListRenderer']['contents']
item = sections[0]['musicShelfRenderer']['contents'][0]
print(json.dumps(item, indent=2))
