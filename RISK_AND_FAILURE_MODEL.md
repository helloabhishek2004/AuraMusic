# RISK_AND_FAILURE_MODEL.md — Production Failure Handling

## FAILURE MODES

### 1. InnerTube API Failure

| Failure | Detection | Recovery |
|---|---|---|
| HTTP 403 Forbidden | Response status code | Rotate to next client profile |
| HTTP 429 Too Many Requests | Response status code | Exponential backoff (1s → 2s → 4s → 8s → 16s) |
| HTTP 500 Server Error | Response status code | Retry 3 times with backoff |
| HTTP 503 Unavailable | Response status code | Retry with different client |
| Empty response body | Body is null/empty | Retry or try different client |
| Malformed JSON | JSON parse exception | Log error, try different client |
| Network timeout | IOException | Retry with longer timeout, then fail |

### 2. Cipher Deobfuscation Failure

| Failure | Detection | Recovery |
|---|---|---|
| Player JS download fails | IOException | Retry 3 times, then fail |
| Player JS too large | Size > 8MB | Reject and try different client |
| Signature solve fails | Null result from all layers | Try different client (different player JS) |
| N-parameter solve fails | URL still has old n value | Reject format, try next format |
| QuickJS engine crash | Exception in execute() | Reinitialize engine, retry once |
| Invalid script syntax | ParseException | Log and try different player JS |

### 3. Stream Playback Failure

| Failure | Detection | Recovery |
|---|---|---|
| Stream URL expired | HTTP 403 on playback | Re-resolve stream |
| Stream URL rejected | HTTP 403 from CDN | Try different format/client |
| Buffer underrun | Player STATE_BUFFERING for >10s | Rebuffer, then resume |
| Codec unsupported | MediaCodec exception | Select different format |
| Audio focus loss | AudioManager callback | Pause, resume when focus gained |

### 4. Network Failure

| Failure | Detection | Recovery |
|---|---|---|
| No network available | ConnectivityManager callback | Queue request, retry when online |
| Metered network | NetworkCapabilities check | Respect user preference (allow/restrict) |
| DNS resolution fails | UnknownHostException | Retry with backoff |
| Connection reset | IOException | Retry 3 times |

### 5. Database Failure

| Failure | Detection | Recovery |
|---|---|---|
| Room query fails | SQLException | Log error, return empty/default |
| Database corrupted | IllegalStateException | Recreate database (data loss acceptable for cache) |
| Migration fails | MigrationException | Fall back to new database |

### 6. Download Failure

| Failure | Detection | Recovery |
|---|---|---|
| Download interrupted | Network loss | Resume from last position (Media3 handles) |
| File write fails | IOException | Retry, then fail |
| Storage full | IOException | Prompt user to free space |
| File corrupted | Integrity check fail | Re-download |

## RETRY STRATEGY

```
Attempt 1: Immediate
Attempt 2: Wait 500ms
Attempt 3: Wait 1000ms
Attempt 4: Wait 2000ms
Attempt 5: Wait 4000ms
Attempt 6: Give up, report error

Maximum retries: 5
Maximum total wait: 7.5 seconds
```

For non-critical operations (lyrics, metadata), reduce to 2 retries.

## FALLBACK CHAIN

```
Operation: resolve stream
    1. Primary client (TVHTML5)
    2. Fallback client (ANDROID_VR)
    3. Fallback client (VISIONOS)
    4. Fallback client (IOS)
    5. Error: "Cannot play this track"

Operation: search
    1. Primary client (WEB_REMIX)
    2. Fallback client (WEB)
    3. Error: "Search unavailable"

Operation: lyrics
    1. LRCLIB
    2. KuGou
    3. YouTube transcript
    4. No lyrics available
```

## ERROR MAPPING TO UI

```kotlin
fun mapToUserMessage(error: Throwable): String {
    return when (error) {
        is IOException -> "Network error. Check your connection."
        is HttpException -> when (error.code) {
            403 -> "This content is not available."
            404 -> "This content was not found."
            429 -> "Too many requests. Please wait."
            500, 502, 503 -> "YouTube is temporarily unavailable."
            else -> "Something went wrong."
        }
        is CipherSolveException -> "Cannot play this track. Try another quality."
        is StreamExpiredException -> "Refreshing stream..."
        is DatabaseException -> "Local data error."
        else -> "An unexpected error occurred."
    }
}
```

## CONCURRENCY PROTECTION

```kotlin
// Prevent duplicate operations
class OperationGuard {
    private val locks = ConcurrentHashMap<String, Mutex>()
    
    suspend fun <T> withLock(key: String, block: suspend () -> T): T {
        val mutex = locks.getOrPut(key) { Mutex() }
        return mutex.withLock(block)
    }
}
```

## HEALTH MONITORING

```kotlin
class HealthMonitor {
    data class HealthState(
        val innerTubeHealthy: Boolean,
        val cipherHealthy: Boolean,
        val lastSuccessTime: Long,
        val consecutiveFailures: Int,
    )
    
    fun recordSuccess(component: String) { ... }
    fun recordFailure(component: String, error: Throwable) { ... }
    fun isHealthy(): Boolean = consecutiveFailures < 5
}
```

END OF FILE
