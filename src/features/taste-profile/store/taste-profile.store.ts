/**
 * AuraMusic — Canonical Music Taste Profile Store
 *
 * Persisted locally via AsyncStorage (covered by Android Auto Backup allowlist).
 * Strictly versioned, atomic commits, isolated from raw behavioral telemetry.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MusicTasteProfile, OnboardingArtist } from '../types/taste-profile';
import { AuraRestore, isNativeCoreAvailable } from '../../../services/native-core';

export const CURRENT_PROFILE_VERSION = 1;

export interface TasteProfileState extends MusicTasteProfile {
  isHydrated: boolean;

  // Actions
  setName: (name: string) => void;
  setSongLanguages: (languages: string[]) => void;
  setGenres: (genres: string[]) => void;
  setFavoriteArtists: (artists: OnboardingArtist[]) => void;

  // Atomic Commit & Lifecycle
  commitProfile: (draft: {
    name?: string;
    songLanguages: string[];
    genres: string[];
    favoriteArtists: OnboardingArtist[];
  }) => Promise<void>;

  updateProfile: (updates: {
    name?: string;
    songLanguages?: string[];
    genres?: string[];
    favoriteArtists?: OnboardingArtist[];
  }) => Promise<void>;

  resetProfile: () => Promise<void>;
  markCompletedFromRestore: (profileData?: Partial<MusicTasteProfile>) => Promise<void>;
}

let _profileHydrated = false;
let _resolveProfileHydrated: () => void = () => {};
const _profileHydrationPromise = new Promise<void>((resolve) => {
  _resolveProfileHydrated = resolve;
});

export function isTasteProfileHydrated(): boolean {
  return _profileHydrated;
}

export function ensureTasteProfileHydrated(): Promise<void> {
  if (_profileHydrated) return Promise.resolve();
  return _profileHydrationPromise;
}

/**
 * Data normalization helper
 */
function normalizeArtistList(artists: OnboardingArtist[]): OnboardingArtist[] {
  const seenIds = new Set<string>();
  const normalized: OnboardingArtist[] = [];

  for (const a of artists) {
    if (!a || !a.name) continue;
    const cleanId = (a.id || a.name).trim();
    if (!cleanId || seenIds.has(cleanId)) continue;
    seenIds.add(cleanId);
    normalized.push({
      id: cleanId,
      name: a.name.trim(),
      artworkUrl: a.artworkUrl || undefined,
      source: a.source || 'curated',
    });
  }

  return normalized;
}

function deduplicateStrings(items: string[]): string[] {
  return Array.from(new Set(items.map(s => s.trim().toLowerCase()))).filter(Boolean);
}

export const useTasteProfileStore = create<TasteProfileState>()(
  persist(
    (set, get) => ({
      version: CURRENT_PROFILE_VERSION,
      name: 'Music Lover',
      songLanguages: [],
      genres: [],
      favoriteArtists: [],
      onboardingCompleted: false,
      onboardingCompletedAt: null,
      updatedAt: Date.now(),
      isHydrated: false,

      setName: (name: string) => {
        const trimmed = name.trim();
        set({ name: trimmed || 'Music Lover', updatedAt: Date.now() });
      },

      setSongLanguages: (languages: string[]) => {
        set({ songLanguages: deduplicateStrings(languages), updatedAt: Date.now() });
      },

      setGenres: (genres: string[]) => {
        set({ genres: deduplicateStrings(genres), updatedAt: Date.now() });
      },

      setFavoriteArtists: (artists: OnboardingArtist[]) => {
        set({ favoriteArtists: normalizeArtistList(artists), updatedAt: Date.now() });
      },

      /**
       * Atomic commit of complete onboarding flow
       */
      commitProfile: async (draft) => {
        const cleanName = (draft.name || '').trim() || 'Music Lover';
        const cleanLanguages = deduplicateStrings(draft.songLanguages);
        const cleanGenres = deduplicateStrings(draft.genres);
        const cleanArtists = normalizeArtistList(draft.favoriteArtists);
        const now = Date.now();

        // 1. Commit state atomically
        set({
          version: CURRENT_PROFILE_VERSION,
          name: cleanName,
          songLanguages: cleanLanguages,
          genres: cleanGenres,
          favoriteArtists: cleanArtists,
          onboardingCompleted: true,
          onboardingCompletedAt: now,
          updatedAt: now,
        });

        // 2. Mark native installation marker in noBackupFilesDir
        try {
          if (isNativeCoreAvailable() && AuraRestore && typeof AuraRestore.markInstallInitialized === 'function') {
            await AuraRestore.markInstallInitialized();
            console.info('[TasteProfileStore] Native install marker recorded.');
          }
        } catch (e) {
          console.warn('[TasteProfileStore] Failed to write native install marker:', e);
        }

        // 3. Trigger immediate candidate and recommendation sync
        try {
          const { syncPreferencePriorsToEngine } = await import('../services/preference-prior.service');
          await syncPreferencePriorsToEngine();
        } catch (e) {
          console.warn('[TasteProfileStore] Error syncing preference priors:', e);
        }
      },

      /**
       * Update preferences post-onboarding (from Settings)
       */
      updateProfile: async (updates) => {
        const current = get();
        const cleanName = updates.name !== undefined ? (updates.name.trim() || 'Music Lover') : current.name;
        const cleanLanguages = updates.songLanguages !== undefined ? deduplicateStrings(updates.songLanguages) : current.songLanguages;
        const cleanGenres = updates.genres !== undefined ? deduplicateStrings(updates.genres) : current.genres;
        const cleanArtists = updates.favoriteArtists !== undefined ? normalizeArtistList(updates.favoriteArtists) : current.favoriteArtists;
        const now = Date.now();

        set({
          name: cleanName,
          songLanguages: cleanLanguages,
          genres: cleanGenres,
          favoriteArtists: cleanArtists,
          updatedAt: now,
        });

        // Synchronize updated priors with recommendation engine
        try {
          const { syncPreferencePriorsToEngine } = await import('../services/preference-prior.service');
          await syncPreferencePriorsToEngine();
        } catch (e) {
          console.warn('[TasteProfileStore] Error re-syncing preference priors:', e);
        }
      },

      /**
       * Safe reset: Clears taste profile while protecting install lifecycle state and unrelated data
       */
      resetProfile: async () => {
        console.info('[TasteProfileStore] Initiating safe taste profile reset...');
        const now = Date.now();

        set({
          version: CURRENT_PROFILE_VERSION,
          name: 'Music Lover',
          songLanguages: [],
          genres: [],
          favoriteArtists: [],
          onboardingCompleted: false,
          onboardingCompletedAt: null,
          updatedAt: now,
        });

        // Clear native install marker so onboarding triggers cleanly
        try {
          if (isNativeCoreAvailable() && AuraRestore && typeof AuraRestore.clearInstallMarker === 'function') {
            await AuraRestore.clearInstallMarker();
            console.info('[TasteProfileStore] Native install marker cleared.');
          }
        } catch (e) {
          console.warn('[TasteProfileStore] Failed to clear install marker:', e);
        }

        // Clear preference priors from recommendation stores without touching history
        try {
          const { clearPreferencePriorsFromEngine } = await import('../services/preference-prior.service');
          await clearPreferencePriorsFromEngine();
        } catch (e) {
          console.warn('[TasteProfileStore] Error clearing preference priors:', e);
        }
      },

      /**
       * Marks profile complete when restored from existing backup data
       */
      markCompletedFromRestore: async (profileData) => {
        const now = Date.now();
        set({
          name: profileData?.name || 'Music Lover',
          songLanguages: profileData?.songLanguages || [],
          genres: profileData?.genres || [],
          favoriteArtists: profileData?.favoriteArtists || [],
          onboardingCompleted: true,
          onboardingCompletedAt: profileData?.onboardingCompletedAt || now,
          updatedAt: now,
        });

        try {
          if (isNativeCoreAvailable() && AuraRestore && typeof AuraRestore.markInstallInitialized === 'function') {
            await AuraRestore.markInstallInitialized();
          }
          const { syncPreferencePriorsToEngine } = await import('../services/preference-prior.service');
          await syncPreferencePriorsToEngine();
        } catch {}
      },
    }),
    {
      name: 'aura_music_taste_profile',
      storage: createJSONStorage(() => AsyncStorage),
      version: CURRENT_PROFILE_VERSION,
      onRehydrateStorage: () => (state) => {
        _profileHydrated = true;
        _resolveProfileHydrated();
        if (state) {
          state.isHydrated = true;
          console.info('[TasteProfileStore] Rehydrated from AsyncStorage:', {
            onboardingCompleted: state.onboardingCompleted,
            languagesCount: state.songLanguages?.length || 0,
            artistsCount: state.favoriteArtists?.length || 0,
          });

          // Re-sync preference priors to recommendation engine on app rehydrate/relaunch
          if (state.onboardingCompleted) {
            import('../services/preference-prior.service')
              .then(({ syncPreferencePriorsToEngine }) => {
                syncPreferencePriorsToEngine().catch((err) => {
                  console.warn('[TasteProfileStore] Background sync priors on rehydrate failed:', err);
                });
              })
              .catch(() => undefined);
          }
        }
      },
    }
  )
);
