import React, { createContext, useContext } from 'react';
import { noirColors, ThemeColors } from '@/constants/theme';

interface ThemeContextType {
  scheme: 'dark';
  colors: ThemeColors;
  toggleScheme: () => void; // no-op — DS is dark-only
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ scheme: 'dark', colors: noirColors, toggleScheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
