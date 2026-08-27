import json
with open('album_test.json') as f:
    d = json.load(f)
tabs = d['contents']['twoColumnBrowseResultsRenderer']['tabs']
for t in tabs:
    if 'tabRenderer' in t:
        content = t['tabRenderer'].get('content', {})
        print("tab content keys:", list(content.keys()))
        if 'sectionListRenderer' in content:
            sections = content['sectionListRenderer'].get('contents', [])
            for s in sections:
                print("tab section:", list(s.keys()))
                if 'musicResponsiveHeaderRenderer' in s:
                    h = s['musicResponsiveHeaderRenderer']
                    print("Header title:", h.get('title'))
                    print("Header subtitle:", h.get('subtitle'))
