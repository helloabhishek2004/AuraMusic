package com.auramusic.core.playback

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.TransferListener
import java.io.IOException

/**
 * Production-grade ChunkingDataSource for bounded CDN audio delivery (e.g. Googlevideo / YouTube CDN).
 *
 * Why this is needed:
 * YouTube CDN (Googlevideo) rejects unbounded HTTP Range requests (Range: bytes=0-) with HTTP 403 Forbidden,
 * but accepts bounded subrange requests (e.g. Range: bytes=0-1048575, bytes=1048576-2097151).
 *
 * ProgressiveMediaPeriod requests the stream with [0, C.LENGTH_UNSET].
 * If a single DataSpec is bounded to 512KB, playback prematurely terminates with unexpected EOF.
 *
 * ChunkingDataSource wraps upstream DataSource (e.g. OkHttpDataSource), transparently breaking the full
 * stream request into sequential bounded chunks (default 1MB / 1,048,576 bytes).
 * When ExoPlayer reads past the end of one chunk, ChunkingDataSource automatically and transparently
 * opens the next chunk at current position, maintaining continuous playback to 100% completion.
 * When ExoPlayer seeks to any arbitrary position, ChunkingDataSource immediately jumps and begins
 * reading from that exact byte offset with a new bounded chunk.
 */
class ChunkingDataSource(
    private val upstreamFactory: DataSource.Factory,
    private val chunkSize: Long = 1024 * 1024L // 1 MB per chunk
) : DataSource {

    private var currentUpstream: DataSource? = null
    private var openedDataSpec: DataSpec? = null
    private var currentPosition: Long = 0L
    private var totalBytesToRead: Long = C.LENGTH_UNSET.toLong()
    private var totalBytesReadSoFar: Long = 0L
    private var currentChunkRemaining: Long = 0L
    private var isOpened: Boolean = false
    private var uri: Uri? = null

    class Factory(
        private val upstreamFactory: DataSource.Factory,
        private val chunkSize: Long = 1024 * 1024L
    ) : DataSource.Factory {
        override fun createDataSource(): DataSource {
            return ChunkingDataSource(upstreamFactory, chunkSize)
        }
    }

    override fun addTransferListener(transferListener: TransferListener) {
        // Upstream factory handles listener attachments
    }

    override fun open(dataSpec: DataSpec): Long {
        this.openedDataSpec = dataSpec
        this.uri = dataSpec.uri
        this.currentPosition = dataSpec.position
        this.totalBytesToRead = dataSpec.length
        this.totalBytesReadSoFar = 0L
        this.isOpened = true

        openNextChunk()
        return if (totalBytesToRead != C.LENGTH_UNSET.toLong()) totalBytesToRead else C.LENGTH_UNSET.toLong()
    }

    private fun openNextChunk() {
        closeCurrentUpstream()

        val dataSpec = openedDataSpec ?: return
        val remainingTotal = if (totalBytesToRead != C.LENGTH_UNSET.toLong()) {
            totalBytesToRead - totalBytesReadSoFar
        } else {
            C.LENGTH_UNSET.toLong()
        }

        if (remainingTotal == 0L) {
            currentChunkRemaining = 0L
            return
        }

        val thisChunkLength = if (remainingTotal != C.LENGTH_UNSET.toLong()) {
            minOf(remainingTotal, chunkSize)
        } else {
            chunkSize
        }

        val chunkDataSpec = dataSpec.buildUpon()
            .setPosition(currentPosition)
            .setLength(thisChunkLength)
            .build()

        val upstream = upstreamFactory.createDataSource()
        currentUpstream = upstream

        try {
            val openedLen = upstream.open(chunkDataSpec)
            currentChunkRemaining = if (openedLen != C.LENGTH_UNSET.toLong()) openedLen else thisChunkLength
            android.util.Log.d("ChunkingDataSource", "Opened chunk pos=$currentPosition length=$thisChunkLength openedLen=$openedLen")
        } catch (e: Exception) {
            android.util.Log.e("ChunkingDataSource", "Failed to open chunk pos=$currentPosition length=$thisChunkLength", e)
            throw e
        }
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (!isOpened || length == 0) return 0

        // If current chunk is exhausted, open the next chunk
        if (currentChunkRemaining <= 0) {
            if (totalBytesToRead != C.LENGTH_UNSET.toLong() && totalBytesReadSoFar >= totalBytesToRead) {
                return C.RESULT_END_OF_INPUT
            }
            openNextChunk()
            if (currentChunkRemaining <= 0) {
                return C.RESULT_END_OF_INPUT
            }
        }

        val toRead = minOf(length.toLong(), currentChunkRemaining).toInt()
        val upstream = currentUpstream ?: return C.RESULT_END_OF_INPUT
        val bytesRead = upstream.read(buffer, offset, toRead)

        if (bytesRead == C.RESULT_END_OF_INPUT) {
            // Reached end of current chunk response body. Try opening next chunk.
            openNextChunk()
            val nextUpstream = currentUpstream ?: return C.RESULT_END_OF_INPUT
            if (currentChunkRemaining <= 0) return C.RESULT_END_OF_INPUT
            
            val nextToRead = minOf(length.toLong(), currentChunkRemaining).toInt()
            val nextBytesRead = nextUpstream.read(buffer, offset, nextToRead)
            if (nextBytesRead == C.RESULT_END_OF_INPUT) {
                return C.RESULT_END_OF_INPUT
            }
            currentPosition += nextBytesRead
            totalBytesReadSoFar += nextBytesRead
            currentChunkRemaining -= nextBytesRead
            return nextBytesRead
        }

        currentPosition += bytesRead
        totalBytesReadSoFar += bytesRead
        currentChunkRemaining -= bytesRead
        return bytesRead
    }

    override fun getUri(): Uri? = uri

    override fun close() {
        isOpened = false
        closeCurrentUpstream()
        openedDataSpec = null
    }

    private fun closeCurrentUpstream() {
        try {
            currentUpstream?.close()
        } catch (_: Exception) {}
        currentUpstream = null
    }
}
