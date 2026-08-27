import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# Add logging to search()
old_search_start = '''    suspend fun search(query: String): List<AuraTrackInfo> {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("query", query)'''

new_search_start = '''    suspend fun search(query: String): List<AuraTrackInfo> {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("query", query)
            Log.d("SEARCH_DEBUG", "query=$query")'''

content = content.replace(old_search_start, new_search_start)

# Add logging to response parsing
old_response_start = '''                override fun onResponse(call: Call, response: Response) {
                    try {
                        val body = response.body?.string() ?: ""
                        val root = JSONObject(body)
                        val tracks = mutableListOf<AuraTrackInfo>()'''

new_response_start = '''                override fun onResponse(call: Call, response: Response) {
                    try {
                        val body = response.body?.string() ?: ""
                        Log.d("SEARCH_DEBUG", "status=${response.code}")
                        Log.d("SEARCH_DEBUG", "bodyBytes=${body.length}")
                        
                        val root = JSONObject(body)
                        val tracks = mutableListOf<AuraTrackInfo>()'''

content = content.replace(old_response_start, new_response_start)

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='utf-8') as f:
    f.write(content)
