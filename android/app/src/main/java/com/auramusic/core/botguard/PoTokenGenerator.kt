package com.auramusic.core.botguard

import android.content.Context
import android.util.Log
import android.webkit.CookieManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

class PoTokenGenerator(context: Context) {
    private val TAG = "PoTokenGenerator"
    private val applicationContext = context.applicationContext

    private val webViewSupported by lazy { runCatching { CookieManager.getInstance() }.isSuccess }
    private var webViewBadImpl = false

    private val webPoTokenGenLock = Mutex()
    private var webPoTokenSessionId: String? = null
    private var webPoTokenStreamingPot: String? = null
    private var webPoTokenGenerator: PoTokenWebView? = null

    suspend fun getWebClientPoToken(videoId: String, sessionId: String): WebPoTokenResult? {
        if (!webViewSupported || webViewBadImpl) {
            Log.d(TAG, "[PlaybackTrace] WebView not available: supported=$webViewSupported, badImpl=$webViewBadImpl")
            return null
        }

        return try {
            withTimeout(POTOKEN_TIMEOUT_MS) {
                getWebClientPoToken(videoId, sessionId, forceRecreate = false)
            }
        } catch (e: TimeoutCancellationException) {
            Log.w(TAG, "[PlaybackTrace] poToken generation timed out after ${POTOKEN_TIMEOUT_MS}ms; proceeding without PoToken")
            clearGenerator()
            null
        } catch (e: CancellationException) {
            throw e
        } catch (e: BadWebViewException) {
            Log.e(TAG, "[PlaybackTrace] Could not obtain PO token because WebView is unavailable")
            webViewBadImpl = true
            null
        } catch (e: Exception) {
            Log.e(TAG, "[PlaybackTrace] PO token generation failed: ${e.message}")
            throw e
        }
    }

    suspend fun close() {
        clearGenerator()
    }

    private suspend fun clearGenerator() {
        webPoTokenGenLock.withLock {
            try {
                withContext(Dispatchers.Main) {
                    webPoTokenGenerator?.close()
                }
            } catch (error: Exception) {
                Log.e(TAG, "[PlaybackTrace] PO token WebView cleanup failed: ${error.message}")
            }
            webPoTokenGenerator = null
            webPoTokenStreamingPot = null
            webPoTokenSessionId = null
        }
    }

    private suspend fun getWebClientPoToken(videoId: String, sessionId: String, forceRecreate: Boolean): WebPoTokenResult {
        val (poTokenGenerator, streamingPot, hasBeenRecreated) =
            webPoTokenGenLock.withLock {
                val shouldRecreate =
                    forceRecreate || webPoTokenGenerator == null || webPoTokenGenerator!!.isExpired ||
                        webPoTokenGenerator!!.isDead ||
                        webPoTokenSessionId != sessionId

                if (shouldRecreate) {
                    Log.d(TAG, "[PlaybackTrace] Creating new PoTokenWebView (forceRecreate=$forceRecreate)")

                    withContext(Dispatchers.Main) {
                        webPoTokenGenerator?.close()
                    }

                    webPoTokenGenerator = null
                    webPoTokenStreamingPot = null
                    webPoTokenSessionId = null

                    val newGenerator = PoTokenWebView.getNewPoTokenGenerator(applicationContext)
                    val newStreamingPot = try {
                        newGenerator.generatePoToken(sessionId)
                    } catch (t: Throwable) {
                        runCatching { newGenerator.close() }
                        throw t
                    }

                    webPoTokenGenerator = newGenerator
                    webPoTokenStreamingPot = newStreamingPot
                    webPoTokenSessionId = sessionId
                    Log.d(TAG, "[PlaybackTrace] Streaming PO token generated successfully")
                }

                Triple(webPoTokenGenerator!!, webPoTokenStreamingPot!!, shouldRecreate)
            }

        val playerPot = try {
            poTokenGenerator.generatePoToken(videoId)
        } catch (throwable: Throwable) {
            if (hasBeenRecreated) {
                throw throwable
            } else {
                Log.e(TAG, "[PlaybackTrace] PO-token generation failed; recreating WebView")
                return getWebClientPoToken(videoId = videoId, sessionId = sessionId, forceRecreate = true)
            }
        }

        Log.d(TAG, "[PlaybackTrace] PO tokens generated successfully (playerRequestPot + streamingPot)")

        return WebPoTokenResult(
            playerRequestPoToken = streamingPot,
            streamingDataPoToken = playerPot,
        )
    }

    companion object {
        const val POTOKEN_TIMEOUT_MS = 10_000L
    }
}
