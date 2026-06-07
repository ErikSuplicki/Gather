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

export function CompassIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <Path d="M12 5.5L14 12L12 10.5L10 12Z" fill={color} />
      <Path d="M12 18.5L10 12L12 13.5L14 12Z" fill={color} opacity="0.3" />
      <Circle cx="12" cy="12" r="1.4" fill={color} />
    </Svg>
  );
}

export function PersonIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21C4 17 7.6 14 12 14C16.4 14 20 17 20 21" />
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
