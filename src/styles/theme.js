export const colors = {
  background: '#131318',
  surface: '#131318',
  primary: '#dab9ff',
  primary_container: '#6c37a9',
  secondary: '#46f5e0',
  surface_container_low: '#1b1b20',
  surface_container_high: '#2a292f',
  surface_container_highest: '#35343a',
  surface_variant: '#35343a',
  outline_variant: '#494456',
  on_surface: '#e4e1e9',
  on_surface_muted: '#cbc3d9',
  on_primary: '#460283'
};

export const typography = {
  headlineFont: 'Manrope_700Bold',
  bodyFont: 'Inter_400Regular',
  labelFont: 'Inter_500Medium',
  displayLg: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 56, // 3.5rem
    color: '#e4e1e9',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  bodyMd: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#cbc3d9',
  },
  titleSm: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#e4e1e9',
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  asymmetricLeft: 136, // 8.5rem
  asymmetricRight: 32, // 2rem
};

export const styling = {
  glassBg: 'rgba(53, 52, 58, 0.4)', // surface_variant at 40%
  glassBorder: 'rgba(73, 68, 86, 0.2)', // outline_variant at 20%
  radiusMd: 24, // 1.5rem
  radiusFull: 9999,
  ambientShadow: {
    shadowColor: '#e4e1e9',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.06,
    shadowRadius: 48,
    elevation: 5,
  }
};
