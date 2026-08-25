package com.auramusic.core.botguard

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import java.util.concurrent.atomic.AtomicBoolean

data class PoTokenResult(val token: String)

class PoTokenManager(private val context: Context) {
    private val TAG = "PoTokenManager"
    private val REQUEST_KEY = "O43z0dpjhgX20SCx4KAo"
    private val JSON_PROTO = "application/json+protobuf".toMediaType()
    private val httpClient = OkHttpClient.Builder().build()
    
    private var webView: WebView? = null
    private var isPrewarmed = false
    private val mutex = Mutex()
    private var currentVisitorData: String? = null
    
    private var initContinuation: kotlin.coroutines.Continuation<Unit>? = null
    private var tokenContinuation: kotlin.coroutines.Continuation<String>? = null

    suspend fun prewarm() = withContext(Dispatchers.Main) {
        if (isPrewarmed) return@withContext
        mutex.withLock {
            if (isPrewarmed) return@withContext
            setupWebView()
            initBotGuard()
            isPrewarmed = true
        }
    }

    fun invalidate() {
        Handler(Looper.getMainLooper()).post {
            webView?.destroy()
            webView = null
            isPrewarmed = false
        }
    }

    suspend fun getToken(identifier: String): PoTokenResult = withContext(Dispatchers.Main) {
        mutex.withLock {
            if (!isPrewarmed || webView == null) {
                setupWebView()
                initBotGuard()
                isPrewarmed = true
            }
            
            val token = suspendCancellableCoroutine<String> { continuation ->
                tokenContinuation = continuation
                val js = "try { window.minter.mint('$identifier', (token) => { window.PoTokenWebView.onToken(token); }); } catch(e) { window.PoTokenWebView.onError(e.message); }"
                webView?.evaluateJavascript(js, null)
            }
            PoTokenResult(token)
        }
    }

    private fun setupWebView() {
        webView?.destroy()
        webView = WebView(context)
        webView?.settings?.javaScriptEnabled = true
        webView?.addJavascriptInterface(this@PoTokenManager, "PoTokenWebView")
    }

    private suspend fun initBotGuard() {
        val botguardProgram = downloadBotguard()
        suspendCancellableCoroutine<Unit> { continuation ->
            initContinuation = continuation
            val html = """
                <html>
                <body>
                    <script>
                        $botguardProgram
                        try {
                            const botguard = window.trayride;
                            window.minter = new botguard.T();
                            window.PoTokenWebView.onInitSuccess();
                        } catch(e) {
                            window.PoTokenWebView.onInitError(e.message);
                        }
                    </script>
                </body>
                </html>
            """.trimIndent()
            webView?.loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "UTF-8", null)
        }
    }

    private suspend fun downloadBotguard(): String = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("https://www.youtube.com/youtubei/v1/att/get?key=$REQUEST_KEY")
            .post("{}".toRequestBody(JSON_PROTO))
            .header("Content-Type", "application/json+protobuf")
            .header("User-Agent", "Mozilla/5.0")
            .build()
        val response = httpClient.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("Failed to get bg config")
        val json = JSONObject(body)
        var botguard = json.optString("c")
        if (botguard.isEmpty()) throw Exception("Empty botguard script")
        val pidx = botguard.indexOf(";")
        botguard = botguard.substring(pidx + 1)
        val decoded = Base64.decode(botguard, Base64.DEFAULT).decodeToString()
        decoded
    }

    @JavascriptInterface
    fun onInitSuccess() {
        initContinuation?.resume(Unit)
        initContinuation = null
    }

    @JavascriptInterface
    fun onInitError(error: String) {
        initContinuation?.resumeWithException(Exception(error))
        initContinuation = null
    }

    @JavascriptInterface
    fun onToken(token: String) {
        tokenContinuation?.resume(token)
        tokenContinuation = null
    }

    @JavascriptInterface
    fun onError(error: String) {
        tokenContinuation?.resumeWithException(Exception(error))
        tokenContinuation = null
    }
}
