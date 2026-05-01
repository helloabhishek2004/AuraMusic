export const palette = {
  ink: '#ffffff',
  inkMuted: 'rgba(226, 221, 238, 0.72)',
  inkDim: 'rgba(226, 221, 238, 0.48)',
  background: '#07070c',
  backgroundRaised: '#101016',
  glass: 'rgba(20, 20, 28, 0.68)',
  glassDense: 'rgba(12, 12, 18, 0.82)',
  glassSoft: 'rgba(255, 255, 255, 0.055)',
  border: 'rgba(255, 255, 255, 0.10)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  edge: 'rgba(255, 255, 255, 0.24)',
  primary: '#bf5af2',
  primaryMid: '#9b38da',
  primaryDeep: '#6f2bbe',
  cyan: '#46f5e0',
  blue: '#2f8cff',
  coral: '#ff7a8a',
  amber: '#ffd166',
  success: '#47e39a',
};

export const spacing = {
  xxs: 3,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const typography = {
  display: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 42,
    lineHeight: 48,
    color: palette.ink,
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: palette.ink,
  },
  headline: {
    fontFamily: 'Inter_500Medium',
    fontSize: 17,
    lineHeight: 22,
    color: palette.ink,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: palette.inkMuted,
  },
  caption: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: palette.inkDim,
  },
};

export const motion = {
  duration: {
    instant: 90,
    fast: 160,
    base: 240,
    slow: 360,
  },
  spring: {
    nav: { tension: 86, friction: 12 },
    press: { tension: 260, friction: 13 },
    sheet: { tension: 58, friction: 12 },
    soft: { tension: 68, friction: 11 },
  },
};

export const glass = {
  navBlur: 48,
  surfaceBlur: 54,
  denseBlur: 64,
  androidBlurLimit: 38,
};
