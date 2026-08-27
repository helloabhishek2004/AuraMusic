const fs = require('fs');
const path = 'src/features/player/store/player.store.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/const resolvedTrack = await ensurePlayableTrack\(track\);/g, 'const resolvedTrack = track; // Bypassed JS resolution');
code = code.replace(/const resolved = await ensurePlayableTrack\(track\);/g, 'const resolved = track; // Bypassed JS resolution');
code = code.replace(/freshCurrent = await ensurePlayableTrack\(currentTrack\);/g, 'freshCurrent = currentTrack; // Bypassed JS resolution');
code = code.replace(/const repaired = await ensurePlayableTrack\(track\);/g, 'const repaired = track; // Bypassed JS resolution');

// Also remove the url check
code = code.replace(/if \(!resolvedTrack\.url\) \{/, 'if (false) {');

fs.writeFileSync(path, code);
console.log('Fixed player.store.ts ensurePlayableTrack bypass');
