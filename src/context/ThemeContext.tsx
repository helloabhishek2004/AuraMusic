import React, { createContext, useContext, useState, useEffect } from 'react';
import { colors as initialColors } from '../styles/theme';

const ThemeContext = createContext({
  accentColor: initialColors.primary,
  setAccentColor: (color: string) => {},
  themeColors: initialColors,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [accentColor, setAccentColor] = useState(initialColors.primary);
  const [themeColors, setThemeColors] = useState(initialColors);

  useEffect(() => {
    setThemeColors(prev => ({
      ...prev,
      primary: accentColor,
      primary_container: accentColor + '40', // 25% opacity for container
    }));
  }, [accentColor]);

  return (
    <ThemeContext.Provider value={{ accentColor, setAccentColor, themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
