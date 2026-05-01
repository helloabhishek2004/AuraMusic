import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { colors as initialColors } from '../styles/theme';
import { hexToRgba } from '@/src/utils/color';

const ThemeContext = createContext({
  accentColor: initialColors.primary,
  setAccentColor: (color: string) => {},
  setAlbumAccent: (colors: string[]) => {},
  themeColors: initialColors,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [accentColor, setAccentColor] = useState(initialColors.primary);

  const setAlbumAccent = useCallback((colors: string[]) => {
    if (colors[0]) setAccentColor(colors[0]);
  }, []);

  const themeColors = useMemo(
    () => ({
      ...initialColors,
      primary: accentColor,
      primary_container: hexToRgba(accentColor, 0.25),
    }),
    [accentColor]
  );

  const value = useMemo(
    () => ({ accentColor, setAccentColor, setAlbumAccent, themeColors }),
    [accentColor, setAlbumAccent, themeColors]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
