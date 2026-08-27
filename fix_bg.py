import re

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """
    private suspend fun initBotGuard() {
        val botguardProgram = downloadBotguard()
        suspendCancellableCoroutine<Unit> { continuation ->
            initContinuation = continuation
            val html = \"\"\"
                <html>
                <body>
                    <script>
                        $botguardProgram
                        try {
                            const botguard = window.trayride || window.bg;
                            if (botguard && botguard.T) {
                                window.minter = new botguard.T();
                                window.PoTokenWebView.onInitSuccess();
                            } else {
                                window.PoTokenWebView.onInitError('BotGuard not found in injected script');
                            }
                        } catch(e) {
                            window.PoTokenWebView.onInitError(e.message);
                        }
                    </script>
                </body>
                </html>
            \"\"\".trimIndent()
            webView?.loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "UTF-8", null)
        }
    }
"""

content = re.sub(r'\s+private suspend fun initBotGuard\(\) \{.*?\}\n    \}\n', replacement, content, flags=re.DOTALL)

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'w', encoding='utf-8') as f:
    f.write(content)
