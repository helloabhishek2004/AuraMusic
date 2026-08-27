import json
with open('album_test.json') as f:
    d = json.load(f)
s = d['contents']['twoColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'][0]['musicResponsiveHeaderRenderer']
print(json.dumps(s.get('straplineTextOne'), indent=2))
print("===")
print(json.dumps(s.get('thumbnail'), indent=2))
