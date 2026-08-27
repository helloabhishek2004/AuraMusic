const fs = require('fs');
const path = 'android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt';
let code = fs.readFileSync(path, 'utf8');

// Inject log for parseMusicResponsiveListItemRenderer
const parserSignature = 'private fun parseMusicResponsiveListItemRenderer(root: JSONObject): AuraTrackInfo? {';
const parserLog = \private fun parseMusicResponsiveListItemRenderer(root: JSONObject): AuraTrackInfo? {
        android.util.Log.d("AuraYouTube", "parseMusicResponsiveListItemRenderer JSON: " + root.toString())
\;
code = code.replace(parserSignature, parserLog);

fs.writeFileSync(path, code);
console.log('Added logging to AuraYouTubeEngine');
