import { create } from 'zustand';

export type PlayerSurface = 
  | 'mini'
  | 'expanded.controls' 
  | 'expanded.lyrics' 
  | 'expanded.queue' 
  | 'expanded.devices' 
  | 'expanded.menu';

export type LegacyPlayerSurface = 'controls' | 'lyrics' | 'queue' | 'devices' | 'menu';

interface PlayerUIState {
  surface: PlayerSurface;
  
  // State Machine Transitions
  expandToControls: () => void;
  collapseToMini: () => void;
  openSubSurface: (surface: 'lyrics' | 'queue' | 'devices' | 'menu') => void;
  closeSubSurface: () => void;
  
  // Computed (Backward Compatibility)
  isExpanded: boolean;
  activeSurface: LegacyPlayerSurface;
  
  // Legacy Actions (Maintained to prevent breaking consumers)
  expand: () => void;
  collapse: () => void;
  setExpanded: (expanded: boolean) => void;
  openLyrics: () => void;
  closeLyrics: () => void;
  openQueue: () => void;
  closeQueue: () => void;
  openDevices: () => void;
  closeDevices: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  setActiveSurface: (surface: LegacyPlayerSurface) => void;
}

export const usePlayerUIStore = create<PlayerUIState>((set, get) => ({
  surface: 'mini',

  // State Machine Transitions
  expandToControls: () => set({ surface: 'expanded.controls', isExpanded: true, activeSurface: 'controls' }),
  collapseToMini: () => set({ surface: 'mini', isExpanded: false, activeSurface: 'controls' }),
  openSubSurface: (surface) => set((state) => ({ 
    surface: `expanded.${surface}` as PlayerSurface,
    activeSurface: surface 
  })),
  closeSubSurface: () => set((state) => ({
    surface: state.surface.startsWith('expanded.') ? 'expanded.controls' : state.surface,
    activeSurface: 'controls'
  })),

  // Computed (Backward Compatibility)
  isExpanded: false,
  activeSurface: 'controls',

  // Legacy Actions (Proxy to new state machine)
  expand: () => get().expandToControls(),
  collapse: () => get().collapseToMini(),
  setExpanded: (expanded: boolean) => {
    if (expanded) get().expandToControls();
    else get().collapseToMini();
  },
  openLyrics: () => get().openSubSurface('lyrics'),
  closeLyrics: () => get().closeSubSurface(),
  openQueue: () => get().openSubSurface('queue'),
  closeQueue: () => get().closeSubSurface(),
  openDevices: () => get().openSubSurface('devices'),
  closeDevices: () => get().closeSubSurface(),
  openMenu: () => get().openSubSurface('menu'),
  closeMenu: () => get().closeSubSurface(),
  setActiveSurface: (surface: LegacyPlayerSurface) => {
    if (get().isExpanded) {
      set({ surface: `expanded.${surface}` as PlayerSurface, activeSurface: surface });
    } else {
      set({ activeSurface: surface });
    }
  },
}));
