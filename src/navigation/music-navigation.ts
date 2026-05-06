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
  router.push({
    pathname: '/artist/[id]',
    params: {
      id: artistId ?? getArtistIdForName(origin?.title),
      origin: origin?.origin ?? '',
    },
  });
}

export function openArtistByName(router: AuraRouter, artistName?: string, origin?: RouteOrigin) {
  openArtist(router, getArtistIdForName(artistName), { ...origin, title: artistName });
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
