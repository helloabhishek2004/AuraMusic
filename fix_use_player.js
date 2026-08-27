const fs = require('fs');
const path = 'src/features/player/hooks/use-player.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("import { usePlayerStore } from '../store/player.store';", "import { usePlayerStore } from '../store/player.store';\nimport { PlaybackService } from '../services/playback.service';");

code = code.replace("play: store.play,", "play: PlaybackService.play,");
code = code.replace("pause: store.pause,", "pause: PlaybackService.pause,");
code = code.replace("togglePlayback: store.togglePlayback,", "togglePlayback: () => store.isPlaying ? PlaybackService.pause() : PlaybackService.play(),");
code = code.replace("next: store.next,", "next: PlaybackService.skipToNext,");
code = code.replace("previous: store.previous,", "previous: PlaybackService.skipToPrevious,");

fs.writeFileSync(path, code);
console.log('Fixed use-player.ts');
