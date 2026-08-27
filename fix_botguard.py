import re

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the whole JS injection part
old_script = '''        val regex = Regex("""\Q${'$'}_\E\.([a-zA-Z0-9_]+)\s*=\s*function""")
        val match = regex.find(jsCode)
        val funcName = match?.groupValues?.get(1) ?: throw Exception("Could not find botguard function name in script")

        suspendCancellableCoroutine<Unit> { continuation ->
            initContinuation = continuation
            val html = """
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
                        const minterFuncs = window['$funcName']('$botguardProgram');
                        if (minterFuncs && minterFuncs.length > 0) {
                            window.minter = minterFuncs[0];
                            window.PoTokenWebView.onInitSuccess();
                        } else {
                            window.PoTokenWebView.onInitError('BotGuard minter functions not found');
                        }
                    } catch(e) {
                        window.PoTokenWebView.onInitError(e.message);
                    }
                </script>
                </head>
                <body></body>
                </html>
            """.trimIndent()
            webView?.loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "UTF-8", null)
        }'''

new_script = '''        suspendCancellableCoroutine<Unit> { continuation ->
            initContinuation = continuation
            val html = """
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
                        let minterFunc = null;
                        if (window.trayride) {
                            for (let key in window.trayride) {
                                if (typeof window.trayride[key] === 'function') {
                                    minterFunc = window.trayride[key];
                                    break;
                                }
                            }
                        }
                        if (!minterFunc && window.${'$'}_) {
                            for (let key in window.${'$'}_) {
                                if (typeof window.${'$'}_[key] === 'function') {
                                    minterFunc = window.${'$'}_[key];
                                    break;
                                }
                            }
                        }
                        
                        if (minterFunc) {
                            const minterFuncs = minterFunc('$botguardProgram');
                            if (minterFuncs && minterFuncs.length > 0) {
                                window.minter = minterFuncs[0];
                                window.PoTokenWebView.onInitSuccess();
                            } else {
                                window.PoTokenWebView.onInitError('BotGuard minter function returned empty');
                            }
                        } else {
                            window.PoTokenWebView.onInitError('BotGuard minter function not found in trayride or $_');
                        }
                    } catch(e) {
                        window.PoTokenWebView.onInitError(e.message);
                    }
                </script>
                </head>
                <body></body>
                </html>
            """.trimIndent()
            webView?.loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "UTF-8", null)
        }'''

content = content.replace(old_script, new_script)

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'w', encoding='utf-8') as f:
    f.write(content)
