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

const colors = {
  violet: ['#bf5af2', '#6f2bbe'],
  cyan: ['#46f5e0', '#005950'],
  coral: ['#ff7a8a', '#93000a'],
  blue: ['#2f8cff', '#162b88'],
};

export const catalogTracks: CatalogTrack[] = [
  {
    id: 'nebula',
    title: 'Nebula Drift',
    artist: 'Lumina Synthetics',
    artistId: 'elara',
    albumId: 'a3',
    duration: '6:12',
    durationSec: 372,
    art: 'aura://generated?name=Nebula%20Drift&type=song',
    dominantColors: colors.violet,
  },
  {
    id: 'neon',
    title: 'Neon Nights',
    artist: 'Synthwave Collective',
    artistId: '7',
    albumId: 'neon-echoes',
    duration: '7:05',
    durationSec: 425,
    art: 'aura://generated?name=Neon%20Nights&type=song',
    dominantColors: colors.cyan,
  },
  {
    id: 'solar',
    title: 'Solar Flare',
    artist: 'Cosmic Echo',
    artistId: '1',
    albumId: 'solaris',
    duration: '5:44',
    durationSec: 344,
    art: 'aura://generated?name=Solar%20Flare&type=song',
    dominantColors: colors.coral,
  },
  {
    id: 'nightcall',
    title: 'Nightcall',
    artist: 'Kavinsky',
    artistId: '2',
    albumId: 'late-night-drive',
    duration: '4:18',
    durationSec: 258,
    art: 'aura://generated?name=Nightcall&type=song',
    dominantColors: colors.blue,
  },
];

export const catalogArtists: CatalogArtist[] = [
  { id: 'elara', name: 'Elara Vance', followers: '12.4M', image: 'aura://generated?name=Elara%20Vance&type=artist' },
  { id: '1', name: 'Solstice', followers: '8.2M', image: 'aura://generated?name=Solstice&type=artist' },
  { id: '2', name: 'Luna Ray', followers: '5.4M', image: 'aura://generated?name=Luna%20Ray&type=artist' },
  { id: '7', name: 'The Voyagers', followers: '850K', image: 'aura://generated?name=The%20Voyagers&type=artist' },
  { id: 'lumina', name: 'Lumina Synthetics', followers: '1.2M', image: 'aura://generated?name=Lumina%20Synthetics&type=artist' },
  { id: 'synthwave', name: 'Synthwave Collective', followers: '980K', image: 'aura://generated?name=Synthwave%20Collective&type=artist' },
  { id: 'cosmic', name: 'Cosmic Echo', followers: '740K', image: 'aura://generated?name=Cosmic%20Echo&type=artist' },
  { id: 'kavinsky', name: 'Kavinsky', followers: '3.1M', image: 'aura://generated?name=Kavinsky&type=artist' },
];

export const catalogAlbums: CatalogAlbum[] = [
  {
    id: 'a3',
    title: 'Synthwave Dreams',
    artist: 'Elara Vance',
    artistId: 'elara',
    year: '2024',
    image: 'aura://generated?name=Synthwave%20Dreams&type=album',
    description: 'Glass-edged synths, soft pulse drums, and midnight-scale atmosphere.',
    dominantColors: colors.violet,
    tracks: [catalogTracks[0]],
  },
  {
    id: 'neon-echoes',
    title: 'Neon Echoes',
    artist: 'The Voyagers',
    artistId: '7',
    year: '2024',
    image: 'aura://generated?name=Neon%20Echoes&type=album',
    description: 'High-gloss night drives with bright hooks and deep low-end motion.',
    dominantColors: colors.cyan,
    tracks: [catalogTracks[1]],
  },
  {
    id: 'solaris',
    title: 'Solaris',
    artist: 'Solstice',
    artistId: '1',
    year: '2024',
    image: 'aura://generated?name=Solaris&type=album',
    description: 'Warm electronic pop shaped for wide skies and quick transitions.',
    dominantColors: colors.coral,
    tracks: [catalogTracks[2]],
  },
  {
    id: 'late-night-drive',
    title: 'Late Night Drive',
    artist: 'Aura Editors',
    artistId: '2',
    year: 'Updated',
    image: 'aura://generated?name=Late%20Night%20Drive&type=album',
    description: 'Moody synthwave and deep club tracks for the open road.',
    dominantColors: colors.blue,
    tracks: [catalogTracks[3], catalogTracks[1], catalogTracks[2]],
  },
];

export function getTrackById(id?: string | string[]) {
  const key = Array.isArray(id) ? id[0] : id;
  return catalogTracks.find((track) => track.id === key) ?? catalogTracks[0];
}

export function getArtistById(id?: string | string[]) {
  const key = Array.isArray(id) ? id[0] : id;
  return catalogArtists.find((artist) => artist.id === key) ?? catalogArtists[0];
}

export function getAlbumById(id?: string | string[]) {
  const key = Array.isArray(id) ? id[0] : id;
  return catalogAlbums.find((album) => album.id === key) ?? catalogAlbums[0];
}

export function getArtistIdForName(name?: string) {
  if (!name) return catalogArtists[0].id;
  const normalized = name.trim().toLowerCase();
  return catalogArtists.find((artist) => artist.name.toLowerCase() === normalized)?.id ?? catalogArtists[0].id;
}
