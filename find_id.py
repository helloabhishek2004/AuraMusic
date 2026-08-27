import re
import glob

files = glob.glob('app/**/\[id\].tsx', recursive=True) + glob.glob('app/**/id.tsx', recursive=True) + glob.glob('app/artist/*.tsx', recursive=True)

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'setQueue' in content and 'usePlayerStore' in content:
        print("Patching", file)
        # We need to replace `const setQueue = usePlayerStore(s => s.setQueue);`
        content = re.sub(r'const setQueue = usePlayerStore\(s => s\.setQueue\);\n?', '', content)
        
        # And replace `setQueue(` with `PlaybackService.loadTrack(`
        # Wait, setQueue was called like: await setQueue(mutableList.map(...), index, {...})
        # Wait, PlaybackService.loadTrack takes: track, queue, startIndex
        
        # Actually it's easier just to rewrite that whole handleTrackPress function
        
        # Let's find handleTrackPress
        # We'll just replace `await setQueue(` with `PlaybackService.syncQueue(`! No, syncQueue?
        pass

