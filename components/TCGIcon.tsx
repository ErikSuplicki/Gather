import React from 'react';
import { Image, Text } from 'react-native';
import { TCGInfo } from '@/types';
import { FONTS } from '@/constants/theme';

// All TCG icon image sources — must be static requires
export const ICONS: Partial<Record<string, ReturnType<typeof require>>> = {
  mtg:     require('../assets/images/Magic_Icon.png'),
  pokemon: require('../assets/images/Pokemon_Icon.png'),
  lorcana: require('../assets/images/Lorcana_Logo.png'),
};

interface Props {
  tcg: TCGInfo;
  size?: number;
  color?: string;
}

export function TCGIcon({ tcg, size = 28, color = '#A7ADB5' }: Props) {
  const source = ICONS[tcg.id];
  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  return (
    <Text style={{
      fontSize: Math.max(8, Math.floor(size * 0.38)),
      fontFamily: FONTS.bold,
      color,
      letterSpacing: 0.3,
    }}>
      {tcg.abbr}
    </Text>
  );
}
