// Noir Console Design System — single dark palette
// Source of truth: design-system.json in repo root. Do not deviate without product approval.

export const noirColors = {
  // Backgrounds
  bg:             '#0F1011',
  bgDeep:         '#090A0B',
  surface:        '#1B1C1D',
  surface2:       '#202122',
  surface3:       '#252627',
  surfacePressed: '#18191A',

  // Borders
  border:         '#2A2B2D',
  borderDefault:  '#333538',
  borderStrong:   '#44474A',
  borderFocus:    '#1F8CFF',

  // Text
  text:           '#F4F6F8',
  textMuted:      '#A7ADB5',
  textFaint:      '#71777F',
  textDisabled:   '#4D535A',
  textDim:        '#71777F', // alias → textFaint

  // Brand (electric blue)
  primary:        '#168BFF',
  primaryBright:  '#4BA4FE',
  primaryLight:   '#4BA4FE', // alias → primaryBright
  primaryDeep:    '#0B5FBD',
  primaryGlow:    'rgba(22,139,255,0.35)',
  primaryGlowSubtle: 'rgba(22,139,255,0.18)',
  primaryRing:    'rgba(22,139,255,0.45)',
  primaryTint:    'rgba(22,139,255,0.10)',
  primaryTintMed: 'rgba(22,139,255,0.12)',
  primaryTintBadge: 'rgba(22,139,255,0.15)',

  // Status
  success:        '#57D298',
  successBg:      'rgba(87,210,152,0.14)',
  warning:        '#F4A43B',
  warningBg:      'rgba(244,164,59,0.14)',
  error:          '#E36259',
  errorBg:        'rgba(227,98,89,0.14)',
  errorRing:      'rgba(227,98,89,0.30)',

  // Misc
  surfaceHighlight: 'rgba(255,255,255,0.04)',
  cardShadow:     '#000000',
  overlay:        'rgba(0,0,0,0.58)',
} as const;

// Both themes are the same (DS is dark-first; light inversion is prohibited)
export const darkColors  = noirColors;
export const lightColors = noirColors;

export type ThemeColors = { [K in keyof typeof noirColors]: string };

// 4-pt grid spacing — matches DS spacing.scale exactly
export const SPACING = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  // semantic aliases
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // DS named spacings
  screenH:      16,
  cardPad:      14,
  cardPadDense: 10,
  sectionGap:   20,
  componentGap: 12,
  listItemGap:  8,
} as const;

// Inter font-family strings — loaded in app/_layout.tsx via @expo-google-fonts/inter
// Use regular/medium/semibold/bold to stay within DS-approved weights (400/500/600/700).
// extrabold/black exist for legacy usage; new code should use bold as the maximum weight.
export const FONTS = {
  regular:   'Inter_400Regular',
  medium:    'Inter_500Medium',
  semibold:  'Inter_600SemiBold',
  bold:      'Inter_700Bold',
  extrabold: 'Inter_700Bold', // mapped to 700 — DS does not approve 800
  black:     'Inter_700Bold', // mapped to 700 — DS does not approve 900
} as const;

// DS elevation presets for View shadow props
export const ELEVATION = {
  panel: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius:  15,
    elevation:     6,
  },
  floating: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 18 },
    shadowOpacity: 0.42,
    shadowRadius:  22,
    elevation:     12,
  },
} as const;

// DS border radii
export const RADII = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   22,
  pill: 999,
} as const;
