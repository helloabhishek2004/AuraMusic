import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerTrack } from '../../player/types/player';

export interface CachedMetadata {
    track: Partial<PlayerTrack>;
    lyrics?: any;
    dominantColors?: string[];
    albumDetails?: any;
    artistDetails?: any;
    lastUpdated: number;
}

interface MediaCacheState {
    metadata: Record<string, CachedMetadata>;
    albumMap: Record<string, string>; // name::artist -> albumId
}

interface MediaCacheActions {
    cacheTrack: (track: PlayerTrack, extra?: Partial<CachedMetadata>) => void;
    getCachedTrack: (trackId: string) => CachedMetadata | null;
    cacheLyrics: (trackId: string, lyrics: any) => void;
    cacheColors: (trackId: string, colors: string[]) => void;
    cacheAlbumId: (albumName: string, artistName: string, albumId: string) => void;
    getAlbumId: (albumName: string, artistName: string) => string | null;
    clearCache: () => void;
    getCacheStats: () => {
        metadataCount: number;
        lyricsCount: number;
        albumCount: number;
        totalSizeEstimate: string;
    };
}

export const useMediaCacheStore = create<MediaCacheState & MediaCacheActions>()(
    persist(
        (set, get) => ({
            metadata: {},
            albumMap: {},

            cacheTrack: (track, extra) => {
                set((state) => {
                    const existing = state.metadata[track.id] || { lastUpdated: 0, track: {} };
                    return {
                        metadata: {
                            ...state.metadata,
                            [track.id]: {
                                ...existing,
                                ...extra,
                                track: { ...existing.track, ...track },
                                lastUpdated: Date.now(),
                            },
                        },
                    };
                });
            },

            getCachedTrack: (trackId) => {
                return get().metadata[trackId] || null;
            },

            cacheLyrics: (trackId, lyrics) => {
                set((state) => {
                    const existing = state.metadata[trackId] || { lastUpdated: 0, track: { id: trackId } as any };
                    return {
                        metadata: {
                            ...state.metadata,
                            [trackId]: {
                                ...existing,
                                lyrics,
                                lastUpdated: Date.now(),
                            },
                        },
                    };
                });
            },

            cacheColors: (trackId, colors) => {
                set((state) => {
                    const existing = state.metadata[trackId] || { lastUpdated: 0, track: { id: trackId } as any };
                    return {
                        metadata: {
                            ...state.metadata,
                            [trackId]: {
                                ...existing,
                                dominantColors: colors,
                                lastUpdated: Date.now(),
                            },
                        },
                    };
                });
            },

            cacheAlbumId: (albumName, artistName, albumId) => {
                const key = `${albumName.toLowerCase()}::${artistName.toLowerCase()}`;
                set((state) => ({
                    albumMap: { ...state.albumMap, [key]: albumId }
                }));
            },

            getAlbumId: (albumName, artistName) => {
                const key = `${albumName.toLowerCase()}::${artistName.toLowerCase()}`;
                return get().albumMap[key] || null;
            },

            clearCache: () => {
                set({ metadata: {}, albumMap: {} });
            },

            getCacheStats: () => {
                const { metadata } = get();
                const keys = Object.keys(metadata);
                let lyricsCount = 0;
                keys.forEach(k => {
                    if (metadata[k].lyrics) lyricsCount++;
                });

                return {
                    metadataCount: keys.length,
                    lyricsCount,
                    albumCount: Object.keys(get().albumMap).length,
                    totalSizeEstimate: `${(JSON.stringify(get()).length / 1024 / 1024).toFixed(2)} MB`
                };
            },
        }),
        {
            name: 'aura-media-cache',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
