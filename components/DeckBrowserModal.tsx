import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  Modal,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS, ThemeColors, ELEVATION } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { DeckCard, TCGInfo, UserDeck } from '@/types';
import { DeckTile } from './DeckTile';
import { CardInfoModal } from './CardInfoModal';
import { analyzeDeckPowerLevel, BRACKET_COLORS, BRACKET_LABELS } from '@/lib/powerLevel';

interface Props {
  visible: boolean;
  onClose: () => void;
  decks: UserDeck[];
  tcgInfo: TCGInfo;
  initialDeckId?: string | null;
  editing?: boolean;
  onDeckUpdated?: (deck: UserDeck) => void;
  onImportDeck?: () => void;
}

const ALL_FILTER = 'Alle';

export function DeckBrowserModal({ visible, onClose, decks, tcgInfo, initialDeckId, editing, onDeckUpdated, onImportDeck }: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { width } = useWindowDimensions();
  const containerWidth = Math.min(width, 500);
  const TILE_W = Math.floor((containerWidth - 40 - 16) / 2);
  const CARD_W = Math.floor((containerWidth - 40 - 24) / 4);
  const CARD_H = Math.floor(CARD_W / 0.718);

  const [filter, setFilter] = useState(ALL_FILTER);
  const [selectedDeck, setSelectedDeck] = useState<UserDeck | null>(null);
  const [infoCard, setInfoCard] = useState<DeckCard | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const powerLevel = useMemo(() => selectedDeck ? analyzeDeckPowerLevel(selectedDeck) : null, [selectedDeck]);

  useEffect(() => {
    if (!visible) return;
    setFilter(ALL_FILTER);
    setSelectedDeck(initialDeckId ? decks.find(d => d.id === initialDeckId) ?? null : null);
  }, [visible, initialDeckId, decks]);

  useEffect(() => {
    setShowReasoning(false);
  }, [selectedDeck?.id]);

  const formats = Array.from(new Set(decks.map(d => d.format).filter((f): f is string => !!f)));
  const filtered = filter === ALL_FILTER ? decks : decks.filter(d => d.format === filter);

  const handleClose = () => {
    setSelectedDeck(null);
    onClose();
  };

  const removeCard = async (index: number) => {
    if (!selectedDeck) return;
    const cards = selectedDeck.cards.filter((_, i) => i !== index);
    const card_count = cards.reduce((s, c) => s + c.quantity, 0);
    const updated: UserDeck = { ...selectedDeck, cards, card_count };
    setSelectedDeck(updated);
    onDeckUpdated?.(updated);
    const { error } = await supabase.from('user_decks').update({ cards, card_count }).eq('id', selectedDeck.id);
    if (error) console.error('removeCard failed:', error);
  };

  const hasImages = tcgInfo.id === 'mtg' || tcgInfo.id === 'pokemon';

  const renderCardList = (entries: Array<{ c: DeckCard; i: number }>, keyPrefix: string) => (
    hasImages ? (
      <View style={styles.grid}>
        {entries.map(({ c, i }) => (
          <Pressable
            key={`${keyPrefix}-${c.name}-${i}`}
            style={({ pressed }) => [styles.cardWrap, { width: CARD_W }, c.isCommander && styles.commanderWrap, pressed && { opacity: 0.88 }]}
            onPress={() => setInfoCard(c)}
          >
            {c.image ? (
              <Image source={{ uri: c.image }} style={[styles.cardImg, { height: CARD_H }]} resizeMode="cover" />
            ) : (
              <View style={[styles.cardImg, styles.cardImgFallback, { height: CARD_H }]}>
                <Text style={styles.cardFallbackText} numberOfLines={3}>{c.name}</Text>
              </View>
            )}
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyText}>×{c.quantity}</Text>
            </View>
            {!!c.isCommander && (
              <View style={styles.commanderTag}>
                <Text style={styles.commanderTagText}>★ Commander</Text>
              </View>
            )}
            {!!editing && (
              <Pressable
                onPress={() => removeCard(i)}
                style={({ pressed }) => [styles.removeTag, pressed && { opacity: 0.75 }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeTagText}>−</Text>
              </Pressable>
            )}
          </Pressable>
        ))}
      </View>
    ) : (
      <View style={styles.textList}>
        {entries.map(({ c, i }) => (
          <View key={`${keyPrefix}-${c.name}-${i}`} style={styles.textListRowWrap}>
            <Text style={[styles.textListRow, c.isCommander && styles.textListCommander]}>
              {c.quantity}× {c.name}{c.isCommander ? '  ★ Commander' : ''}
            </Text>
            {!!editing && (
              <Pressable
                onPress={() => removeCard(i)}
                style={({ pressed }) => [styles.removeTagInline, pressed && { opacity: 0.75 }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeTagText}>−</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    )
  );

  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={[styles.inner, { maxWidth: containerWidth, alignSelf: 'center', width: '100%' }]}>

          {/* Header */}
          <View style={styles.header}>
            {selectedDeck ? (
              <Pressable
                onPress={() => setSelectedDeck(null)}
                style={({ pressed }) => [styles.backBtn, pressed && styles.iconBtnPressed]}
              >
                <Text style={styles.backText}>‹</Text>
              </Pressable>
            ) : (
              <View style={{ width: 36 }} />
            )}
            <Text style={styles.title} numberOfLines={1}>
              {selectedDeck ? selectedDeck.name : 'Alle Decks'}
            </Text>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.iconBtnPressed]}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {selectedDeck ? (() => {
            // ── Detail page: visual card grid (or text list for image-less TCGs) ──
            const indexed = selectedDeck.cards.map((c, i) => ({ c, i }));
            const main = indexed.filter(x => !x.c.isSideboard);
            const side = indexed.filter(x => x.c.isSideboard);
            const sideCount = side.reduce((s, { c }) => s + c.quantity, 0);
            return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              <Text style={styles.detailMeta}>
                {selectedDeck.format ? `${selectedDeck.format} · ` : ''}{selectedDeck.card_count} Karten
              </Text>

              {!!powerLevel && (() => {
                const diverges = powerLevel.minBracket !== powerLevel.recommendedBracket;
                const headlineBracket = powerLevel.recommendedBracket;
                return (
                <View style={[styles.powerLevelCard, { borderColor: BRACKET_COLORS[headlineBracket] + '55' }]}>
                  <View style={styles.powerLevelHeader}>
                    <View style={[styles.bracketBadge, { backgroundColor: BRACKET_COLORS[headlineBracket] + '22', borderColor: BRACKET_COLORS[headlineBracket] }]}>
                      <Text style={[styles.bracketBadgeText, { color: BRACKET_COLORS[headlineBracket] }]}>
                        {diverges ? 'Empfohlen: ' : ''}Bracket {headlineBracket} · {BRACKET_LABELS[headlineBracket]}
                      </Text>
                    </View>
                    <Text style={styles.powerLevelEstimate}>≈ Power Level {powerLevel.estimate}/10</Text>
                  </View>

                  {diverges && (
                    <View style={[styles.minBracketPill, { borderColor: BRACKET_COLORS[powerLevel.minBracket] + '88' }]}>
                      <Text style={[styles.minBracketPillText, { color: BRACKET_COLORS[powerLevel.minBracket] }]}>
                        Mindestens Bracket {powerLevel.minBracket} · {BRACKET_LABELS[powerLevel.minBracket]} — laut harten Bracket-Anforderungen erlaubt
                      </Text>
                    </View>
                  )}

                  <Pressable
                    onPress={() => setShowReasoning(v => !v)}
                    style={({ pressed }) => [styles.reasoningToggle, pressed && { opacity: 0.75 }]}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.reasoningToggleText}>
                      {showReasoning ? 'Grund verbergen ▲' : 'Grund anzeigen ▼'}
                    </Text>
                  </Pressable>

                  {showReasoning && (
                    <>
                      <Text style={styles.powerLevelSectionLabel}>
                        {diverges ? 'Harte Anforderungen (Mindest-Bracket)' : 'Begründung'}
                      </Text>
                      {powerLevel.requirementReasons.map((r, i) => (
                        <Text key={`req-${i}`} style={styles.powerLevelReason}>•  {r}</Text>
                      ))}

                      {powerLevel.scoreReasons.length > 0 && (
                        <>
                          <Text style={styles.powerLevelSectionLabel}>Warum die Empfehlung höher liegt</Text>
                          {powerLevel.scoreReasons.map((r, i) => (
                            <Text key={`score-${i}`} style={styles.powerLevelReason}>•  {r}</Text>
                          ))}
                        </>
                      )}

                      <Text style={styles.powerLevelNote}>
                        Automatische Schätzung anhand bekannter Power-Karten (WotC „Commander Brackets" &amp; r/EDH-Communityskala) — keine offizielle Einstufung. „Mindestens" markiert die laut harten Anforderungen erlaubte Bracket-Untergrenze, „Empfohlen" bezieht zusätzlich die Gesamt-Power-Signale ein und kann höher, aber nie niedriger als das Minimum ausfallen.
                      </Text>
                    </>
                  )}
                </View>
                );
              })()}

              {renderCardList(main, 'main')}

              {side.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Sideboard · {sideCount} Karten</Text>
                  {renderCardList(side, 'side')}
                </>
              )}
            </ScrollView>
            );
          })() : (
            // ── List page: format filter + deck tile grid ──
            <>
              {formats.length > 0 && (
                <View style={styles.filterWrap}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {[ALL_FILTER, ...formats].map(f => (
                      <Pressable
                        key={f}
                        style={({ pressed }) => [styles.filterPill, filter === f && styles.filterPillActive, pressed && filter !== f && styles.filterPillPressed]}
                        onPress={() => setFilter(f)}
                      >
                        <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
                {!!onImportDeck && (
                  <Pressable
                    style={({ pressed }) => [styles.importBtn, pressed && styles.importBtnPressed]}
                    onPress={onImportDeck}
                  >
                    <Text style={styles.importBtnText}>+ Deck importieren</Text>
                  </Pressable>
                )}

                {filtered.length === 0 ? (
                  <Text style={styles.emptyText}>Keine Decks in diesem Format.</Text>
                ) : (
                  <View style={styles.tileGrid}>
                    {filtered.map(deck => (
                      <DeckTile
                        key={deck.id}
                        deck={deck}
                        tcgInfo={tcgInfo}
                        onPress={() => setSelectedDeck(deck)}
                        width={TILE_W}
                      />
                    ))}
                  </View>
                )}
              </ScrollView>
            </>
          )}

        </View>
      </SafeAreaView>

      <CardInfoModal
        visible={!!infoCard}
        onClose={() => setInfoCard(null)}
        card={infoCard}
        tcg={tcgInfo.id}
      />
    </Modal>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { color: C.textMuted, fontSize: 20, fontFamily: FONTS.bold, marginTop: -2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: C.textMuted, fontSize: 14, fontFamily: FONTS.bold },
  iconBtnPressed: { backgroundColor: C.surface3 },
  title: { flex: 1, color: C.text, fontSize: 20, fontFamily: FONTS.bold },

  filterWrap: { marginBottom: 4 },
  filterRow: { paddingHorizontal: 20, gap: 8 },
  filterPill: {
    height: 32,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterPillPressed: { backgroundColor: C.surface2 },
  filterText: { color: C.textMuted, fontSize: 13, fontFamily: FONTS.semibold },
  filterTextActive: { color: '#FFFFFF' },

  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  emptyText: { color: C.textFaint, textAlign: 'center', padding: 48, fontSize: 15 },

  importBtn: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  importBtnPressed: { backgroundColor: C.primaryTint },
  importBtnText: { color: C.primary, fontSize: 16, fontFamily: FONTS.bold },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },

  detailMeta: { color: C.textMuted, fontSize: 13, fontFamily: FONTS.semibold, marginBottom: 16 },

  powerLevelCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 8,
    ...ELEVATION.panel,
  },
  powerLevelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  bracketBadge: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  bracketBadgeText: { fontSize: 13, fontFamily: FONTS.bold },
  powerLevelEstimate: { color: C.textMuted, fontSize: 12, fontFamily: FONTS.semibold },
  minBracketPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  minBracketPillText: { fontSize: 11.5, fontFamily: FONTS.semibold },
  reasoningToggle: { alignSelf: 'flex-start' },
  reasoningToggleText: { color: C.primary, fontSize: 12, fontFamily: FONTS.bold },
  powerLevelSectionLabel: { color: C.textFaint, fontSize: 10.5, fontFamily: FONTS.bold, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  powerLevelReason: { color: C.textMuted, fontSize: 12.5, lineHeight: 18 },
  powerLevelNote: { color: C.textFaint, fontSize: 11, lineHeight: 16, fontStyle: 'italic', marginTop: 2 },

  sectionLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardWrap: { position: 'relative' },
  commanderWrap: { borderWidth: 2, borderColor: '#F0C75E', borderRadius: 10, padding: 2 },
  cardImg: { width: '100%', borderRadius: 8, backgroundColor: C.surface },
  cardImgFallback: { alignItems: 'center', justifyContent: 'center', padding: 6, borderWidth: 1, borderColor: C.border },
  cardFallbackText: { color: C.textMuted, fontSize: 10, textAlign: 'center', fontFamily: FONTS.semibold },
  qtyBadge: {
    position: 'absolute', bottom: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  qtyText: { color: '#FFFFFF', fontSize: 11, fontFamily: FONTS.bold },
  commanderTag: {
    position: 'absolute', top: 7, left: 7,
    backgroundColor: '#F0C75E',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  commanderTagText: { color: '#1A1300', fontSize: 9, fontFamily: FONTS.bold },
  removeTag: {
    position: 'absolute', top: 5, right: 5,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  removeTagInline: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  removeTagText: { color: '#FFFFFF', fontSize: 15, fontFamily: FONTS.bold, marginTop: -1 },

  textList: { gap: 6 },
  textListRowWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  textListRow: { color: C.text, fontSize: 14, flexShrink: 1 },
  textListCommander: { color: '#F0C75E', fontFamily: FONTS.bold },
  });
}
