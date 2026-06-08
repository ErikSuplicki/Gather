import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ThemeColors } from '@/constants/theme';

type Scheme = 'light' | 'dark';

const STORAGE_KEY = 'gather:colorScheme';

interface ThemeContextType {
  scheme: Scheme;
  colors: ThemeColors;
  toggleScheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<Scheme>(Appearance.getColorScheme() === 'light' ? 'light' : 'dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark') setScheme(stored);
    });
  }, []);

  const toggleScheme = () => {
    setScheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const colors = scheme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ scheme, colors, toggleScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
