import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { getArtistIdForName } from '@/src/data/music-catalog';

type AuraRouter = ReturnType<typeof useRouter>;

type RouteOrigin = {
  origin?: string;
  title?: string;
};

export function openNowPlaying(router: AuraRouter, trackId?: string, origin?: string) {
  router.push({
    pathname: '/now_playing',
    params: { trackId: trackId ?? '', origin: origin ?? '' },
  });
}

export function openArtist(router: AuraRouter, artistId?: string, origin?: RouteOrigin) {
  // If artistId is missing, try to get it from catalog or fallback to title (name)
  // The backend will resolve the name if it's not a valid browseId.
  const targetId = artistId ?? origin?.title;
  
  if (!targetId) return;

  router.push({
    pathname: '/artist/[id]',
    params: {
      id: targetId,
      origin: origin?.origin ?? '',
    },
  });
}

export function openArtistByName(router: AuraRouter, artistName?: string, origin?: RouteOrigin) {
  if (!artistName) return;
  openArtist(router, undefined, { ...origin, title: artistName });
}

export function openPlaylist(router: AuraRouter, playlistId: string, origin?: string) {
  router.push({
    pathname: '/playlist/[id]',
    params: { id: playlistId, origin: origin ?? '' },
  });
}

export function openAlbum(router: AuraRouter, albumId: string, origin?: string) {
  router.push({
    pathname: '/album/[id]',
    params: { id: albumId, origin: origin ?? '' },
  });
}

export function useMusicNavigation(origin: string) {
  const router = useRouter();

  const goNowPlaying = useCallback((trackId?: string) => openNowPlaying(router, trackId, origin), [origin, router]);
  const goArtist = useCallback((artistId?: string) => openArtist(router, artistId, { origin }), [origin, router]);
  const goArtistByName = useCallback((artistName?: string) => openArtistByName(router, artistName, { origin }), [origin, router]);
  const goPlaylist = useCallback((playlistId: string) => openPlaylist(router, playlistId, origin), [origin, router]);
  const goAlbum = useCallback((albumId: string) => openAlbum(router, albumId, origin), [origin, router]);

  return useMemo(
    () => ({
      router,
      goNowPlaying,
      goArtist,
      goArtistByName,
      goPlaylist,
      goAlbum,
    }),
    [goAlbum, goArtist, goArtistByName, goNowPlaying, goPlaylist, router]
  );
}
