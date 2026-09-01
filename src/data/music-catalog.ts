export type CatalogTrack = {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  albumId?: string;
  duration?: string;
  durationSec?: number;
  art: string;
  dominantColors: string[];
};

export type CatalogArtist = {
  id: string;
  name: string;
  followers?: string;
  image: string;
};

export type CatalogAlbum = {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  year?: string;
  image: string;
  description: string;
  dominantColors: string[];
  tracks: CatalogTrack[];
};

/**
 * Production Policy: Pure On-Device Architecture
 * Synthetic/mock catalogs are purged. Local data and real YouTube Music
 * entities are the authoritative data sources.
 */
export const catalogTracks: CatalogTrack[] = [];
export const catalogArtists: CatalogArtist[] = [];
export const catalogAlbums: CatalogAlbum[] = [];

export function getTrackById(id?: string | string[]): CatalogTrack | undefined {
  const key = Array.isArray(id) ? id[0] : id;
  return catalogTracks.find((track) => track.id === key);
}

export function getArtistById(id?: string | string[]): CatalogArtist | undefined {
  const key = Array.isArray(id) ? id[0] : id;
  return catalogArtists.find((artist) => artist.id === key);
}

export function getAlbumById(id?: string | string[]): CatalogAlbum | undefined {
  const key = Array.isArray(id) ? id[0] : id;
  return catalogAlbums.find((album) => album.id === key);
}

export function getArtistIdForName(name?: string): string {
  if (!name) return '';
  const normalized = name.trim().toLowerCase();
  return catalogArtists.find((artist) => artist.name.toLowerCase() === normalized)?.id ?? name;
}
