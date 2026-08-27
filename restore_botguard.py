import re

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace downloadBotguard
new_downloadBotguard = """
    private val REQUEST_KEY = "O43z0dpjhgX20SCx4KAo"

    private suspend fun downloadBotguard(): String = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("https://www.youtube.com/youtubei/v1/att/get?key=$REQUEST_KEY")
            .post("{}".toRequestBody(JSON_PROTO))
            .header("Content-Type", "application/json+protobuf")
            .header("User-Agent", "Mozilla/5.0")
            .build()
        val response = httpClient.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("Failed to get bg config")
        val json = org.json.JSONObject(body)
        var botguard = json.optString("c")
        if (botguard.isEmpty()) throw Exception("Empty botguard script")
        val pidx = botguard.indexOf(";")
        botguard = botguard.substring(pidx + 1)
        val decoded = android.util.Base64.decode(botguard, android.util.Base64.DEFAULT).decodeToString()
        decoded
    }
"""

content = re.sub(r'private suspend fun downloadBotguard\(\): String = withContext\(Dispatchers\.IO\) \{.*?\n    \}', new_downloadBotguard.strip(), content, flags=re.DOTALL)

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'w', encoding='utf-8') as f:
    f.write(content)
