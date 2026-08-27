import re

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = r'''
    private suspend fun initBotGuard() {
        val botguardProgram = downloadBotguard()
        suspendCancellableCoroutine<Unit> { continuation ->
            initContinuation = continuation
            val html = ""\"
                <html>
                <body>
                    <script>
                        botguardProgram
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
            ""\".trimIndent()
            webView?.loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "UTF-8", null)
        }
    }

    private suspend fun downloadBotguard(): String = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("https://www.youtube.com")
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
        val response = httpClient.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("Failed to load youtube.com")
        
        // Regex for botguard js
        val pattern = java.util.regex.Pattern.compile("\"([^\"]*?/player/[^\"]*?/botguard\\\\.js)\"")
        val matcher = pattern.matcher(body)
        var bgUrl = ""
        if (matcher.find()) {
            bgUrl = matcher.group(1)
        } else {
            val fallbackPattern = java.util.regex.Pattern.compile("(/s/player/[a-zA-Z0-9_-]+/botguard\\\\.js)")
            val fallbackMatcher = fallbackPattern.matcher(body)
            if (fallbackMatcher.find()) {
                bgUrl = fallbackMatcher.group(1)
            } else {
                throw Exception("Could not find botguard.js URL in youtube html")
            }
        }
        
        if (bgUrl.startsWith("//")) bgUrl = "https:" + bgUrl
        else if (bgUrl.startsWith("/")) bgUrl = "https://www.youtube.com" + bgUrl
        
        val bgReq = Request.Builder().url(bgUrl).header("User-Agent", "Mozilla/5.0").build()
        val bgRes = httpClient.newCall(bgReq).execute()
        bgRes.body?.string() ?: throw Exception("Failed to download botguard script")
    }
'''

content = re.sub(r'private suspend fun initBotGuard\(\) \{.*?@JavascriptInterface', replacement + '\n    @JavascriptInterface', content, flags=re.DOTALL)

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'w', encoding='utf-8') as f:
    f.write(content)
