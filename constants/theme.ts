const shared = {
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  error: '#E5484D',
  success: '#00C896',
} as const;

export const darkColors = {
  ...shared,
  bg: '#111111',
  surface: '#1A1A1A',
  surface2: '#222222',
  surface3: '#2C2C2C',
  border: '#2A2A2A',
  primaryGlow: 'rgba(124,58,237,0.16)',
  text: '#FFFFFF',
  textMuted: '#888888',
  textDim: '#444444',
  cardShadow: '#000000',
  overlay: 'rgba(8,8,8,0.88)',
} as const;

export const lightColors = {
  ...shared,
  bg: '#F6F4FB',
  surface: '#FFFFFF',
  surface2: '#F0EEF6',
  surface3: '#E7E4F0',
  border: '#E3E0EC',
  primaryGlow: 'rgba(124,58,237,0.10)',
  text: '#1B1A1F',
  textMuted: '#7A7787',
  textDim: '#B7B4C2',
  cardShadow: '#5B5470',
  overlay: 'rgba(40,36,54,0.6)',
} as const;

export type ThemeColors = { [K in keyof typeof darkColors]: string };

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Inter — loaded in app/_layout.tsx via @expo-google-fonts/inter
export const FONTS = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;
