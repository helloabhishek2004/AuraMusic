import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerTrack } from '../../player/types/player';
import { getCanonicalTrackId } from '../../player/utils/track-identity';

export interface CacheEntry {
    id: string;               // Canonical Track Identity
    album: string | null;     // Extracted Album Name
    albumId: string | null;   // Resolved API Album ID
    artistId: string | null;  // Resolved API Artist ID
    lyrics: string | null;    // Synced/Plain Lyrics string (optional, usually stored separately)
    artwork: string | null;   // High-res artwork URL
    duration: number | null;  // Accurate duration in seconds
    source: string;           // 'ytmusic' | 'local'
    checksum: string;         // Used to verify if local file changed
    fetchedAt: number;        // Epoch timestamp of last successful hydrate
    staleAt: number;          // Epoch timestamp when cache needs re-validation
}

const CACHE_META_KEY_PREFIX = 'cache:track-meta:';
const CACHE_LYRICS_KEY_PREFIX = 'cache:lyrics:';
const MAX_MEMORY_ITEMS = 200;
const STALE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

class MetadataCacheService {
    private memoryMap: Map<string, CacheEntry> = new Map();
    private lyricsMap: Map<string, string> = new Map();
    private dirtyMetaKeys: Set<string> = new Set();
    private dirtyLyricsKeys: Set<string> = new Set();
    private flushTimeout: NodeJS.Timeout | null = null;
    private initialized: boolean = false;

    /**
     * Optional: Load recently played metadata into memory on startup
     * For now, memory map populates lazily on demand.
     */
    async init() {
        if (this.initialized) return;
        this.initialized = true;
        // In a full implementation, we could read the first 50 keys and warm the map.
    }

    /**
     * Retrieves an entry synchronously from the hot memory cache.
     */
    getHotEntry(track: Partial<PlayerTrack>): CacheEntry | null {
        const id = getCanonicalTrackId(track);
        return this.memoryMap.get(id) || null;
    }

    /**
     * Retrieves an entry, checking memory first, then AsyncStorage.
     */
    async getEntry(track: Partial<PlayerTrack>): Promise<CacheEntry | null> {
        const id = getCanonicalTrackId(track);
        if (this.memoryMap.has(id)) {
            // Touch for LRU
            const entry = this.memoryMap.get(id)!;
            this.memoryMap.delete(id);
            this.memoryMap.set(id, entry);
            return entry;
        }

        try {
            const raw = await AsyncStorage.getItem(`${CACHE_META_KEY_PREFIX}${id}`);
            if (raw) {
                const entry = JSON.parse(raw) as CacheEntry;
                this._enforceMemoryLimit();
                this.memoryMap.set(id, entry);
                return entry;
            }
        } catch (e) {
            console.error('Failed to read cache entry', e);
        }
        return null;
    }

    /**
     * Retrieves lyrics, checking memory first, then AsyncStorage.
     */
    async getLyrics(track: Partial<PlayerTrack>): Promise<string | null> {
        const id = getCanonicalTrackId(track);
        if (this.lyricsMap.has(id)) {
            return this.lyricsMap.get(id)!;
        }
        
        try {
            const raw = await AsyncStorage.getItem(`${CACHE_LYRICS_KEY_PREFIX}${id}`);
            if (raw) {
                this._enforceMemoryLimit();
                this.lyricsMap.set(id, raw);
                return raw;
            }
        } catch (e) {
            console.error('Failed to read lyrics cache', e);
        }
        return null;
    }

    /**
     * Partially merges new fields into the cache entry for a track.
     */
    mergeEntry(track: Partial<PlayerTrack>, partialEntry: Partial<CacheEntry>) {
        const id = getCanonicalTrackId(track);
        let existing = this.memoryMap.get(id);

        const now = Date.now();
        const merged: CacheEntry = {
            id,
            album: existing?.album || track.album || null,
            albumId: existing?.albumId || null,
            artistId: existing?.artistId || null,
            lyrics: null, // lyrics stored separately
            artwork: existing?.artwork || track.art || null,
            duration: existing?.duration || track.duration || null,
            source: existing?.source || track.source || 'unknown',
            checksum: existing?.checksum || '',
            fetchedAt: now,
            staleAt: now + STALE_DURATION,
            ...existing,
            ...partialEntry,
        };

        // Touch LRU
        this.memoryMap.delete(id);
        this._enforceMemoryLimit();
        this.memoryMap.set(id, merged);

        this.dirtyMetaKeys.add(id);
        this.scheduleFlush();
        return merged;
    }

    /**
     * Updates lyrics separately.
     */
    setLyrics(track: Partial<PlayerTrack>, lyrics: string) {
        const id = getCanonicalTrackId(track);
        this.lyricsMap.delete(id);
        this._enforceMemoryLimit();
        this.lyricsMap.set(id, lyrics);
        
        this.dirtyLyricsKeys.add(id);
        this.scheduleFlush();
    }

    /**
     * Returns true if the cache entry is fresh and doesn't need hydration.
     */
    isFresh(entry: CacheEntry | null): boolean {
        if (!entry) return false;
        return Date.now() < entry.staleAt;
    }

    /**
     * Enforces LRU size on the memory maps.
     */
    private _enforceMemoryLimit() {
        if (this.memoryMap.size > MAX_MEMORY_ITEMS) {
            const firstKey = this.memoryMap.keys().next().value;
            if (firstKey) this.memoryMap.delete(firstKey);
        }
        if (this.lyricsMap.size > MAX_MEMORY_ITEMS) {
            const firstKey = this.lyricsMap.keys().next().value;
            if (firstKey) this.lyricsMap.delete(firstKey);
        }
    }

    /**
     * Debounced flush of dirty keys to AsyncStorage.
     */
    private scheduleFlush() {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
        }
        this.flushTimeout = setTimeout(() => {
            this.flush();
        }, 5000); // 5 seconds debounce
    }

    /**
     * Performs a batched write to AsyncStorage.
     */
    async flush() {
        const metaPairs: [string, string][] = [];
        const lyricsPairs: [string, string][] = [];

        for (const id of this.dirtyMetaKeys) {
            const entry = this.memoryMap.get(id);
            if (entry) {
                metaPairs.push([`${CACHE_META_KEY_PREFIX}${id}`, JSON.stringify(entry)]);
            }
        }
        for (const id of this.dirtyLyricsKeys) {
            const lyrics = this.lyricsMap.get(id);
            if (lyrics) {
                lyricsPairs.push([`${CACHE_LYRICS_KEY_PREFIX}${id}`, lyrics]);
            }
        }

        this.dirtyMetaKeys.clear();
        this.dirtyLyricsKeys.clear();

        try {
            if (metaPairs.length > 0) await AsyncStorage.multiSet(metaPairs);
            if (lyricsPairs.length > 0) await AsyncStorage.multiSet(lyricsPairs);
        } catch (e) {
            console.error('Cache flush failed', e);
        }
    }

    /**
     * For settings page metrics and clearing.
     */
    async getMetrics() {
        const keys = await AsyncStorage.getAllKeys();
        const metaKeys = keys.filter(k => k.startsWith(CACHE_META_KEY_PREFIX));
        const lyricsKeys = keys.filter(k => k.startsWith(CACHE_LYRICS_KEY_PREFIX));
        return {
            metadataCount: metaKeys.length,
            lyricsCount: lyricsKeys.length,
            // (Size estimate would require multiGet or tracking, simplified for now)
        };
    }

    async clearAll() {
        this.memoryMap.clear();
        this.lyricsMap.clear();
        this.dirtyMetaKeys.clear();
        this.dirtyLyricsKeys.clear();

        const keys = await AsyncStorage.getAllKeys();
        const toRemove = keys.filter(k => k.startsWith(CACHE_META_KEY_PREFIX) || k.startsWith(CACHE_LYRICS_KEY_PREFIX));
        if (toRemove.length > 0) {
            await AsyncStorage.multiRemove(toRemove);
        }
    }
}

export const MetadataCache = new MetadataCacheService();
