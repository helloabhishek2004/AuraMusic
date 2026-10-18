package com.anonymous.AuraMusic.poc

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import kotlinx.coroutines.Dispatchers
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

class PoTokenExperiment(private val context: Context) {
    private val TAG = "AURA_POC_EXP"
    private val REQUEST_KEY = "O43z0dpjhgX20SCx4KAo"
    private val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.3"
    private val JSON_PROTO = "application/json+protobuf".toMediaType()
    private val httpClient = OkHttpClient.Builder().build()
    
    var t0 = 0L
    var t1 = 0L
    var t2 = 0L
    var t3 = 0L
    
    private var webView: WebView? = null
    private var initContinuation: kotlin.coroutines.Continuation<Unit>? = null
    private var tokenContinuation: kotlin.coroutines.Continuation<String>? = null
    
    suspend fun run(videoId: String): String {
        return withContext(Dispatchers.Main) {
            t0 = System.currentTimeMillis()
            webView = WebView(context)
            webView!!.settings.javaScriptEnabled = true
            webView!!.addJavascriptInterface(this@PoTokenExperiment, "PoTokenWebView")
            
            // 1. Init WebView and load botguard
            t1 = System.currentTimeMillis()
            try {
                withTimeout(15000) {
                    suspendCancellableCoroutine<Unit> { cont ->
                        initContinuation = cont
                        val html = context.assets.open("po_token.html").bufferedReader().use { it.readText() }
                        val data = html.replaceFirst("</script>", "\nPoTokenWebView.downloadAndRunBotguard()</script>")
                        webView!!.loadDataWithBaseURL("https://www.youtube.com", data, "text/html", "utf-8", null)
                    }
                }
            } catch (e: Exception) {
                destroy()
                throw Exception("WebView Init Failed: " + e.message)
            }
            
            // 2. Request PoToken
            t3 = System.currentTimeMillis()
            try {
                withTimeout(5000) {
                    suspendCancellableCoroutine<String> { cont ->
                        tokenContinuation = cont
                        val u8Id = stringToU8(videoId)
                        webView!!.evaluateJavascript(
                            """try {
                                obtainPoToken($u8Id).then(function(poTokenU8) {
                                    PoTokenWebView.onObtainPoTokenResult(poTokenU8.join(","))
                                }).catch(function(error) {
                                    PoTokenWebView.onObtainPoTokenError(error + "\n" + (error.stack || ''))
                                })
                            } catch (error) {
                                PoTokenWebView.onObtainPoTokenError(error + "\n" + error.stack)
                            }""", null
                        )
                    }
                }
            } catch (e: Exception) {
                destroy()
                throw Exception("Token Gen Failed: " + e.message)
            } finally {
                destroy()
            }
        }
    }
    
    @JavascriptInterface
    fun downloadAndRunBotguard() {
        Log.e(TAG, "downloadAndRunBotguard() called")
        makePost("https://www.youtube.com/api/jnn/v1/Create", "[ \"$REQUEST_KEY\" ]") { responseBody ->
            val parsed = parseChallengeData(responseBody)
Log.e(TAG, "Parsed Data Length: ${parsed.length}"); Log.e(TAG, "Global Name: ${org.json.JSONObject(parsed).getString("globalName")}")
            Handler(Looper.getMainLooper()).post {
                webView!!.evaluateJavascript(
                    """try {
                        data = $parsed
                        runBotGuard(data).then(function (result) {
                            this.webPoSignalOutput = result.webPoSignalOutput
                            PoTokenWebView.onRunBotguardResult(result.botguardResponse)
                        }, function (error) {
                            PoTokenWebView.onJsInitializationError(error + "\n" + error.stack)
                        })
                    } catch (error) {
                        PoTokenWebView.onJsInitializationError(error + "\n" + error.stack)
                    }""", null
                )
            }
        }
    }
    
    @JavascriptInterface
    fun onRunBotguardResult(botguardResponse: String) {
        t2 = System.currentTimeMillis()
        Log.e(TAG, "onRunBotguardResult: $botguardResponse")
        makePost("https://www.youtube.com/api/jnn/v1/GenerateIT", "[ \"$REQUEST_KEY\", \"$botguardResponse\" ]") { responseBody ->
            val (integrityToken, ext) = parseIntegrityTokenData(responseBody)
            Handler(Looper.getMainLooper()).post {
                webView!!.evaluateJavascript(
                    """try {
                        this.integrityToken = $integrityToken
                        createPoTokenMinter(webPoSignalOutput, integrityToken).then(function() {
                            PoTokenWebView.onMinterCreated()
                        }).catch(function(error) {
                            PoTokenWebView.onJsInitializationError(error + "\n" + (error.stack || ''))
                        })
                    } catch (error) {
                        PoTokenWebView.onJsInitializationError(error + "\n" + error.stack)
                    }""", null
                )
            }
        }
    }
    
    @JavascriptInterface
    fun onMinterCreated() {
        Log.e(TAG, "Minter created!")
        initContinuation?.resume(Unit)
        initContinuation = null
    }
    
    @JavascriptInterface
    fun onJsInitializationError(err: String) {
        Log.e(TAG, "JS Init Error: $err")
        initContinuation?.resumeWithException(Exception(err))
        initContinuation = null
    }
    
    @JavascriptInterface
    fun onObtainPoTokenResult(poTokenU8: String) {
        Log.e(TAG, "Obtained token U8: $poTokenU8")
        val poToken = u8ToBase64(poTokenU8)
        tokenContinuation?.resume(poToken)
        tokenContinuation = null
    }
    
    @JavascriptInterface
    fun onObtainPoTokenError(err: String) {
        Log.e(TAG, "JS Token Error: $err")
        tokenContinuation?.resumeWithException(Exception(err))
        tokenContinuation = null
    }
    
    private fun makePost(url: String, data: String, onResponse: (String) -> Unit) {
        Thread {
            try {
                val req = Request.Builder().url(url)
                    .post(data.toRequestBody(JSON_PROTO))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json+protobuf")
                    .header("x-goog-api-key", "AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw")
                    .header("x-user-agent", "grpc-web-javascript/0.1")
                    .build()
                val resp = httpClient.newCall(req).execute()
                val body = resp.body?.string() ?: ""
                if (resp.isSuccessful && body.isNotEmpty()) {
                    onResponse(body)
                } else {
                    onJsInitializationError("HTTP Error ${resp.code}: $body")
                }
            } catch (e: Exception) {
                onJsInitializationError("Network exception: ${e.message}")
            }
        }.start()
    }
    
    private fun destroy() {
        try {
            webView?.destroy()
        } catch(e:Exception){}
    }
    
    // Utilities ported from Metrolist
    private fun parseChallengeData(raw: String): String {
        val scrambled = JSONArray(raw)
        val challengeData = if (scrambled.length() > 1 && scrambled.opt(1) is String) {
            JSONArray(descramble(scrambled.getString(1)))
        } else {
            scrambled.getJSONArray(0)
        }
        val messageId = challengeData.getString(0)
        val interpreterHash = challengeData.getString(3)
        val program = challengeData.getString(4)
        val globalName = challengeData.getString(5)
        val clientExperimentsStateBlob = challengeData.getString(7)
        
        var privateDoNotAccessOrElseSafeScriptWrappedValue: String? = null; if (!challengeData.isNull(1)) { val arr = challengeData.getJSONArray(1); for (i in 0 until arr.length()) { if (arr.opt(i) is String) { privateDoNotAccessOrElseSafeScriptWrappedValue = arr.getString(i); break } } }
        
        var privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: String? = null; if (!challengeData.isNull(2)) { val arr = challengeData.getJSONArray(2); for (i in 0 until arr.length()) { if (arr.opt(i) is String) { privateDoNotAccessOrElseTrustedResourceUrlWrappedValue = arr.getString(i); break } } }
        
        val obj = JSONObject()
        obj.put("messageId", messageId)
        val interp = JSONObject()
        interp.put("privateDoNotAccessOrElseSafeScriptWrappedValue", privateDoNotAccessOrElseSafeScriptWrappedValue ?: JSONObject.NULL)
        interp.put("privateDoNotAccessOrElseTrustedResourceUrlWrappedValue", privateDoNotAccessOrElseTrustedResourceUrlWrappedValue ?: JSONObject.NULL)
        obj.put("interpreterJavascript", interp)
        obj.put("interpreterHash", interpreterHash)
        obj.put("program", program)
        obj.put("globalName", globalName)
        obj.put("clientExperimentsStateBlob", clientExperimentsStateBlob)
        return obj.toString()
    }
    
    private fun parseIntegrityTokenData(raw: String): Pair<String, Long> {
        val arr = JSONArray(raw)
        return Pair(base64ToU8(arr.getString(0)), arr.getLong(1))
    }
    
    private fun descramble(scrambled: String): String {
        val bytes = base64ToByteString(scrambled)
        val decoded = ByteArray(bytes.size)
        for (i in bytes.indices) { decoded[i] = (bytes[i] + 97).toByte() }
        return String(decoded)
    }
    
    private fun base64ToU8(base64: String): String {
        return newUint8Array(base64ToByteString(base64))
    }
    
    private fun stringToU8(identifier: String): String {
        return newUint8Array(identifier.toByteArray())
    }
    
    private fun newUint8Array(contents: ByteArray): String {
        return "new Uint8Array([" + contents.joinToString(",") { (it.toInt() and 0xFF).toString() } + "])"
    }
    
    private fun base64ToByteString(base64: String): ByteArray {
        val mod = base64.replace("-", "+").replace("_", "/").replace(".", "=")
        return Base64.decode(mod, Base64.DEFAULT)
    }
    
    private fun u8ToBase64(poToken: String): String {
        val bytes = poToken.split(",").map { it.toInt().toByte() }.toByteArray()
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP)
    }
}



