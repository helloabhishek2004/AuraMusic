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
    art: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDvPx_cacsyYoMUH_pNgGcRi4uEGEaZclAzYYTxP8ay88S1AGyEJzlo-cwY2a6vZpRxUqjOFJw8VVM6XorKQgOWTk9FbTnPrm8W8zvJtr_cDobTY0PBpm8a2VfZfcWgNzo9pkQ9KXfJUkwnW95tzuNJRV-0kfiHpAbzv1fgRb92yKUgDA_1wbr6etz41zwCt3BIh0_PCA8pdp3keJxQiVlohG_nAlmNZy3lBQc2e6uYRHW9W9sBR3js83IaO9EFfNUAYDjheUgRFE',
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
    art: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=480',
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
    art: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?auto=format&fit=crop&q=80&w=480',
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
    art: 'https://picsum.photos/seed/kavinsky/400',
    dominantColors: colors.blue,
  },
];

export const catalogArtists: CatalogArtist[] = [
  { id: 'elara', name: 'Elara Vance', followers: '12.4M', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=480' },
  { id: '1', name: 'Solstice', followers: '8.2M', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=480' },
  { id: '2', name: 'Luna Ray', followers: '5.4M', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=480' },
  { id: '7', name: 'The Voyagers', followers: '850K', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=480' },
  { id: 'lumina', name: 'Lumina Synthetics', followers: '1.2M', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=480' },
  { id: 'synthwave', name: 'Synthwave Collective', followers: '980K', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=480' },
  { id: 'cosmic', name: 'Cosmic Echo', followers: '740K', image: 'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&q=80&w=480' },
  { id: 'kavinsky', name: 'Kavinsky', followers: '3.1M', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=480' },
];

export const catalogAlbums: CatalogAlbum[] = [
  {
    id: 'a3',
    title: 'Synthwave Dreams',
    artist: 'Elara Vance',
    artistId: 'elara',
    year: '2024',
    image: catalogTracks[0].art,
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
    image: catalogTracks[1].art,
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
    image: catalogTracks[2].art,
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
    image: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=800',
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
