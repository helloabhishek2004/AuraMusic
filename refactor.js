const fs = require('fs');
const path = 'src/features/player/store/player.store.ts';
let code = fs.readFileSync(path, 'utf8');

// Top level imports to add
const imports = [
  "import { ensurePlayableTrack } from '../services/source-authority';",
  "import { HydrationScheduler } from '../services/hydration.service';",
  "import { MetadataCache } from '../../cache/services/metadata-cache.service';",
  "import { isResolvedUrl, resolveAudioOnly } from '../utils/track-resolver';",
  "import { validateTrackSource } from '../services/source-validator';",
  "import { isSourceStale } from '../services/source-freshness-policy';",
  "import { useTelemetryStore } from './telemetry.store';",
  "import { useSourceHealthStore } from './source-health.store';",
  "import { QueueRepairService } from '../services/queue-repair.service';"
];

// Add imports after the last import statement
const lines = code.split('\n');
const lastImportIndex = lines.findLastIndex(l => l.startsWith('import '));
lines.splice(lastImportIndex + 1, 0, ...imports);
code = lines.join('\n');

// Replace dynamic imports
code = code.replace(/const\s+\{\s*ensurePlayableTrack\s*\}\s*=\s*await\s+import\([^)]+\);\s*/g, '');
code = code.replace(/const\s+\{\s*HydrationScheduler\s*\}\s*=\s*await\s+import\([^)]+\);\s*/g, '');
code = code.replace(/const\s+\{\s*MetadataCache\s*\}\s*=\s*await\s+import\([^)]+\);\s*/g, '');
code = code.replace(/const\s+\{\s*isResolvedUrl,\s*resolveAudioOnly\s*\}\s*=\s*await\s+import\([^)]+\);\s*/g, '');
code = code.replace(/const\s+\{\s*PlaybackService\s*\}\s*=\s*await\s+import\([^)]+\);\s*/g, '');
code = code.replace(/const\s+\{\s*validateTrackSource\s*\}\s*=\s*await\s+import\([^)]+\);\s*/g, '');
code = code.replace(/const\s+\{\s*isSourceStale\s*\}\s*=\s*await\s+import\([^)]+\);\s*/g, '');
code = code.replace(/const\s+\{\s*useTelemetryStore\s*\}\s*=\s*await\s+import\([^)]+\);\s*/g, '');
code = code.replace(/const\s+\{\s*useSourceHealthStore\s*\}\s*=\s*await\s+import\([^)]+\);\s*/g, '');
code = code.replace(/const\s+\{\s*QueueRepairService\s*\}\s*=\s*await\s+import\([^)]+\);\s*/g, '');

fs.writeFileSync(path, code);
console.log('Done refactoring player.store.ts');
