import React, { useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { FONTS, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { MTG_COLORS } from '@/constants/tcgs';
import { TCGIcon } from './TCGIcon';
import { ManaSymbol } from './icons';
import { TCGInfo, UserDeck } from '@/types';
import { analyzeDeckPowerLevel, BRACKET_COLORS, BRACKET_LABELS } from '@/lib/powerLevel';

type MtgColor = (typeof MTG_COLORS)[number];

// Scryfall color-identity letters (WUBRG) → the app's existing mana-color icons.
const COLOR_IDENTITY_TO_MTG_COLOR: Record<string, MtgColor['id']> = {
  W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green',
};
const COLORLESS_MTG_COLOR = MTG_COLORS.find(c => c.id === 'colorless')!;

const WUBRG_ORDER = ['W', 'U', 'B', 'R', 'G'];

function deckColorIdentity(cards: UserDeck['cards']): MtgColor[] | null {
  // Commander: use the commander card's declared color identity
  const commander = cards.find(c => c.isCommander);
  if (commander?.colorIdentity !== undefined) {
    if (commander.colorIdentity.length === 0) return [COLORLESS_MTG_COLOR];
    return commander.colorIdentity
      .map(l => MTG_COLORS.find(c => c.id === COLOR_IDENTITY_TO_MTG_COLOR[l]))
      .filter((c): c is MtgColor => !!c);
  }
  // All other formats: union of main-deck card color identities, sorted WUBRG
  const letters = new Set<string>();
  cards.filter(c => !c.isSideboard).forEach(c => c.colorIdentity?.forEach(l => letters.add(l)));
  if (letters.size === 0) return null;
  return WUBRG_ORDER
    .filter(l => letters.has(l))
    .map(l => MTG_COLORS.find(c => c.id === COLOR_IDENTITY_TO_MTG_COLOR[l]))
    .filter((c): c is MtgColor => !!c);
}

interface Props {
  deck: UserDeck;
  tcgInfo: TCGInfo;
  onPress: () => void;
  editing?: boolean;
  onDelete?: () => void;
  width?: number;
}

export function DeckTile({ deck, tcgInfo, onPress, editing, onDelete, width = 132 }: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const cover = deck.cards.find(c => c.isCommander && !!c.image)?.image
    ?? deck.cards.find(c => !!c.image)?.image
    ?? null;
  const height = Math.floor(width / 0.718);
  const powerLevel = useMemo(() => analyzeDeckPowerLevel(deck), [deck]);
  const colors = useMemo(() => deckColorIdentity(deck.cards), [deck.cards]);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wrap, { width }, pressed && { opacity: 0.88 }]}>
      <View style={[styles.coverWrap, { height }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.coverFallback, { backgroundColor: tcgInfo.color + '14', borderColor: tcgInfo.color + '33' }]}>
            <TCGIcon tcg={tcgInfo} size={40} color={tcgInfo.color} />
          </View>
        )}
        {!!powerLevel && (
          <View style={[styles.bracketBadge, { backgroundColor: BRACKET_COLORS[powerLevel.recommendedBracket] }]}>
            <Text style={styles.bracketBadgeText}>B{powerLevel.recommendedBracket}</Text>
          </View>
        )}
        {!!editing && !!onDelete && (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [styles.deleteTag, pressed && { opacity: 0.75 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.deleteText}>✕</Text>
          </Pressable>
        )}
      </View>
      {!!colors && (
        <View style={styles.colorRow}>
          {colors.map((c, i) => (
            <ManaSymbol key={c.id + i} manaId={c.id} size={16} />
          ))}
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>{deck.name}</Text>
      <Text style={styles.meta} numberOfLines={1}>
        {deck.format ? `${deck.format} · ` : ''}{deck.card_count} Karten
      </Text>
      {!!powerLevel && (
        <View style={styles.bracketRow}>
          <View style={[styles.bracketDot, { backgroundColor: BRACKET_COLORS[powerLevel.recommendedBracket] }]} />
          <Text style={styles.bracketText} numberOfLines={1}>
            Bracket {powerLevel.recommendedBracket} · {BRACKET_LABELS[powerLevel.recommendedBracket]}
            {powerLevel.recommendedBracket !== powerLevel.minBracket ? ` (mind. ${powerLevel.minBracket})` : ''}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: 6 },
    coverWrap: {
      position: 'relative',
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: C.cardShadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
      elevation: 3,
    },
    cover: { width: '100%', height: '100%' },
    coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    coverEmoji: { fontSize: 15, fontFamily: FONTS.bold, color: C.textMuted, letterSpacing: 0.5 },
    deleteTag: {
      position: 'absolute', top: 6, right: 6,
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center', justifyContent: 'center',
    },
    deleteText: { color: '#FFFFFF', fontSize: 11, fontFamily: FONTS.black },
    bracketBadge: {
      position: 'absolute', top: 6, right: 6,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    bracketBadgeText: { color: '#FFFFFF', fontSize: 10.5, fontFamily: FONTS.extrabold },
    colorRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
    name: { color: C.text, fontSize: 13, fontFamily: FONTS.bold },
    meta: { color: C.textMuted, fontSize: 11 },
    bracketRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    bracketDot: { width: 7, height: 7, borderRadius: 3.5 },
    bracketText: { color: C.textMuted, fontSize: 10, fontFamily: FONTS.semibold, flexShrink: 1 },
  });
}
