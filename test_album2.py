import json
with open('album_test.json') as f:
    d = json.load(f)
tabs = d.get('contents', {}).get('singleColumnBrowseResultsRenderer', {}).get('tabs', [])
if tabs:
    content = tabs[0].get('tabRenderer', {}).get('content', {}).get('sectionListRenderer', {}).get('contents', [])
    for s in content:
        print("Album Section:", list(s.keys()))
    
    if content and 'musicResponsiveHeaderRenderer' in content[0]:
        print("Header Title:", content[0]['musicResponsiveHeaderRenderer'].get('title'))
    if d.get('header'):
        print("Header:", list(d['header'].keys()))
else:
    print("No tabs found, checking root contents...")
    print(list(d.get('contents', {}).keys()))
