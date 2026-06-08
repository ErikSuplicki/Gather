import React from 'react';
import { Platform, Image } from 'react-native';

// createElement wrappers — on web these produce real SVG elements.
const S = (tag: string) =>
  Platform.OS === 'web'
    ? (props: Record<string, unknown>) => React.createElement(tag, props)
    : () => null;

const Svg = S('svg');
const Path = S('path');
const Circle = S('circle');

// ─── Nav bar icons ───────────────────────────────────────────────────────────

interface NavIconProps { color: string; size: number; active?: boolean }

export function CompassIcon({ color, size, active }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12" cy="12" r="8.5"
        stroke={color}
        strokeWidth={active ? 2.2 : 1.6}
        fill={active ? color : 'none'}
        fillOpacity={active ? 0.14 : 0}
      />
      <Path d="M14.8 9.2L12.9 12.9L9.2 14.8L11.1 11.1L14.8 9.2Z" fill={color} />
    </Svg>
  );
}

export function PersonIcon({ color, size, active }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12" cy="8.2" r="3.6"
        stroke={color}
        strokeWidth={active ? 0 : 1.8}
        fill={active ? color : 'none'}
      />
      <Path
        d="M4.5 20C4.8 16.2 8 13.6 12 13.6C16 13.6 19.2 16.2 19.5 20"
        stroke={color}
        strokeWidth={active ? 0 : 1.8}
        fill={active ? color : 'none'}
        fillOpacity={active ? 1 : 0}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── MTG mana icons ──────────────────────────────────────────────────────────
// Official mana symbol images from Scryfall's public CDN

const MANA_URIS: Record<string, string> = {
  white:     'https://svgs.scryfall.io/card-symbols/W.svg',
  blue:      'https://svgs.scryfall.io/card-symbols/U.svg',
  black:     'https://svgs.scryfall.io/card-symbols/B.svg',
  red:       'https://svgs.scryfall.io/card-symbols/R.svg',
  green:     'https://svgs.scryfall.io/card-symbols/G.svg',
  colorless: 'https://svgs.scryfall.io/card-symbols/C.svg',
};

export function ManaSymbol({ manaId, size = 44 }: { manaId: string; size?: number }) {
  const uri = MANA_URIS[manaId];
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
