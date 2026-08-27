import re

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# We will replace the script injection with a deterministic Kotlin parser
new_js = """
        // Parse the exact function name from JS source
        val minterMatcher = Regex("""([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*=\s*function\(([a-zA-Z0-9_,]+)\)\s*\{\s*return\s*\[""").find(jsCode)
        val minterName = minterMatcher?.groups?.get(2)?.value ?: ""
        
        suspendCancellableCoroutine<Unit> { continuation ->
            initContinuation = continuation
            val html = ""\"
                <html>
                <head>
                <script>
                    window.${'$'}_ = window;
                </script>
                <script>
                    $jsCode
                </script>
                <script>
                    try {
                        let exportObj = window.trayride || window.${'$'}_;
                        if (exportObj && exportObj['$minterName']) {
                            const res = exportObj['$minterName']('$botguardProgram');
                            if (res && res.length > 0 && typeof res[0] === 'function') {
                                window.minter = res[0];
                                window.PoTokenWebView.onInitSuccess();
                            } else {
                                window.PoTokenWebView.onInitError('BotGuard minter function generated invalid result');
                            }
                        } else {
                            window.PoTokenWebView.onInitError('BotGuard minter function $minterName not found in namespace');
                        }
                    } catch(e) {
                        window.PoTokenWebView.onInitError(e.message);
                    }
                </script>
                </head>
                <body></body>
                </html>
            ""\".trimIndent()
"""

# I need to match the previous suspendCancellableCoroutine block and replace it
import sys

start_idx = content.find("suspendCancellableCoroutine<Unit> { continuation ->")
end_idx = content.find(".trimIndent()", start_idx)

if start_idx != -1 and end_idx != -1:
    replaced = content[:start_idx] + new_js.strip() + content[end_idx+13:]
    with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'w', encoding='utf-8') as f:
        f.write(replaced)
    print("Replaced!")
else:
    print("Not found")

