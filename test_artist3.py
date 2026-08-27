import json
with open('artist_daft.json') as f:
    d = json.load(f)
h = d['header']['musicImmersiveHeaderRenderer']
print(list(h.keys()))
if 'thumbnail' in h:
    print(h['thumbnail'])
elif 'foregroundThumbnail' in h:
    print(h['foregroundThumbnail'])
