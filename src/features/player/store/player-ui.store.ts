import { create } from 'zustand';

export type PlayerSurface = 'controls' | 'lyrics' | 'queue' | 'devices' | 'menu';

interface PlayerUIState {
  isExpanded: boolean;
  expand: () => void;
  collapse: () => void;
  setExpanded: (expanded: boolean) => void;
  
  // Surface Management
  activeSurface: PlayerSurface;
  openLyrics: () => void;
  closeLyrics: () => void;
  openQueue: () => void;
  closeQueue: () => void;
  openDevices: () => void;
  closeDevices: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  setActiveSurface: (surface: PlayerSurface) => void;
}

export const usePlayerUIStore = create<PlayerUIState>((set) => ({
  isExpanded: false,
  expand: () => set({ isExpanded: true }),
  collapse: () => set({ isExpanded: false, activeSurface: 'controls' }),
  setExpanded: (expanded: boolean) => set({ isExpanded: expanded }),

  // Surface Management
  activeSurface: 'controls',
  openLyrics: () => set({ activeSurface: 'lyrics' }),
  closeLyrics: () => set({ activeSurface: 'controls' }),
  openQueue: () => set({ activeSurface: 'queue' }),
  closeQueue: () => set({ activeSurface: 'controls' }),
  openDevices: () => set({ activeSurface: 'devices' }),
  closeDevices: () => set({ activeSurface: 'controls' }),
  openMenu: () => set({ activeSurface: 'menu' }),
  closeMenu: () => set({ activeSurface: 'controls' }),
  setActiveSurface: (surface: PlayerSurface) => set({ activeSurface: surface }),
}));
