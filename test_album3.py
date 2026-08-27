import json
with open('album_test.json') as f:
    d = json.load(f)
two_col = d['contents']['twoColumnBrowseResultsRenderer']
print("twoColumn keys:", list(two_col.keys()))
secondary = two_col.get('secondaryContents', {})
print("secondaryContents keys:", list(secondary.keys()))
tabs = secondary.get('sectionListRenderer', {}).get('contents', [])
for t in tabs:
    print("secondary section:", list(t.keys()))
    if 'musicShelfRenderer' in t:
        print("  musicShelfRenderer keys:", list(t['musicShelfRenderer'].keys()))
        print("  Number of tracks:", len(t['musicShelfRenderer'].get('contents', [])))
