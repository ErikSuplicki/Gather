import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { TCGId, DeckCard, UserDeck } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  tcg: TCGId;
  userId: string;
  onImported: (deck: UserDeck) => void;
}

type Section = 'deck' | 'commander' | 'sideboard' | 'maybeboard';

interface ParsedLine {
  quantity: number;
  name: string;
  section: Section;
}

interface Resolved {
  cards: DeckCard[];
  notFound: string[];
}

const MTG_FORMAT_SUGGESTIONS = ['Commander', 'Modern', 'Standard', 'Pauper', 'Legacy'];

// Expected non-Maybeboard deck size by format (informational — shown next to the
// preview count, not enforced, since real-world brews/partial lists vary).
const FORMAT_DECK_SIZES: Record<string, number> = {
  commander: 100,
  brawl: 100,
  standard: 60,
  modern: 60,
  pioneer: 60,
  legacy: 60,
  vintage: 60,
  pauper: 60,
};

function expectedDeckSize(format: string): number | null {
  return FORMAT_DECK_SIZES[format.trim().toLowerCase()] ?? null;
}

const PLACEHOLDER = '1x Lightning Bolt\n2x Counterspell\n14x Island\n...';

// Recognizes section headers commonly found in Moxfield/Archidekt exports
// ("Commander", "Maybeboard", "Sideboard", "Deck", ...) so we can tag the
// commander and drop maybeboard cards from the imported list.
const SECTION_HEADER_RE = /^(commander|companion|deck|mainboard|main\s*deck|sideboard|maybeboard)\b/i;

function sectionFromHeader(label: string): Section | null {
  const key = label.toLowerCase().replace(/\s+/g, '');
  if (key === 'commander') return 'commander';
  if (key === 'sideboard') return 'sideboard';
  if (key === 'maybeboard') return 'maybeboard';
  if (key === 'deck' || key === 'mainboard' || key === 'maindeck' || key === 'companion') return 'deck';
  return null;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseDecklist(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  let section: Section = 'deck';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    const m = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (!m) {
      const header = line.match(SECTION_HEADER_RE);
      if (header) {
        const next = sectionFromHeader(header[1]);
        if (next) section = next;
      }
      continue;
    }
    const name = m[2].trim().replace(/\s*\([A-Za-z0-9]+\)\s*[\w-]*\s*$/, '').trim();
    if (!name) continue;
    out.push({ quantity: parseInt(m[1], 10), name, section });
  }
  return out;
}

function makeCard(line: ParsedLine, image: string | null, colorIdentity?: string[]): DeckCard {
  const card: DeckCard = { name: line.name, quantity: line.quantity, image };
  if (line.section === 'commander') card.isCommander = true;
  if (line.section === 'sideboard') card.isSideboard = true;
  if (colorIdentity) card.colorIdentity = colorIdentity;
  return card;
}

// ─── MTG resolution (Scryfall /cards/collection, batches of 75) ──────────────

interface ScryfallCard {
  name: string;
  image_uris?: { normal: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
  color_identity?: string[];
}

function scryfallImg(c: ScryfallCard): string | null {
  return c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null;
}

// Scryfall's /cards/collection does an exact-name match and misses modal
// double-faced / split cards fairly often (e.g. "Barkchannel Pathway //
// Tidechannel Pathway"). /cards/named?fuzzy= is built for exactly this —
// it resolves partial/front-face names and minor typos — so we use it as a
// one-by-one fallback for anything the batch call didn't match.
async function fuzzyMTG(name: string): Promise<ScryfallCard | null> {
  try {
    const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
    const data = await res.json();
    return data?.object === 'error' ? null : (data as ScryfallCard);
  } catch {
    return null;
  }
}

async function resolveMTG(lines: ParsedLine[]): Promise<Resolved> {
  const cards: DeckCard[] = [];
  const notFound: string[] = [];
  const unmatched: ParsedLine[] = [];

  for (let i = 0; i < lines.length; i += 75) {
    const chunk = lines.slice(i, i + 75);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk.map(l => ({ name: l.name })) }),
      });
      const data = await res.json();
      const found = (data.data ?? []) as ScryfallCard[];
      const byName = new Map<string, ScryfallCard>();
      for (const c of found) {
        byName.set(c.name.toLowerCase(), c);
        const front = c.name.split(' // ')[0];
        if (front !== c.name) byName.set(front.toLowerCase(), c);
      }
      for (const line of chunk) {
        const match = byName.get(line.name.toLowerCase());
        if (match) cards.push(makeCard(line, scryfallImg(match), match.color_identity));
        else unmatched.push(line);
      }
    } catch {
      unmatched.push(...chunk);
    }
  }

  // Fallback pass: fuzzy single-name lookups for anything the batch endpoint missed.
  for (const line of unmatched) {
    const match = await fuzzyMTG(line.name);
    if (match) cards.push(makeCard(line, scryfallImg(match), match.color_identity));
    else { notFound.push(line.name); cards.push(makeCard(line, null)); }
    await new Promise(r => setTimeout(r, 80));
  }

  return { cards, notFound };
}

// ─── Pokémon resolution (Lucene OR-queries, batches of 8) ────────────────────

interface PokemonCard {
  name: string;
  images: { small: string };
}

async function resolvePokemon(lines: ParsedLine[]): Promise<Resolved> {
  const cards: DeckCard[] = [];
  const notFound: string[] = [];
  const CHUNK = 8;
  for (let i = 0; i < lines.length; i += CHUNK) {
    const chunk = lines.slice(i, i + CHUNK);
    try {
      const q = chunk.map(l => `name:"${l.name}"`).join(' OR ');
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&select=name,images&pageSize=${CHUNK * 4}`,
      );
      const data = await res.json();
      const found = (data.data ?? []) as PokemonCard[];
      for (const line of chunk) {
        const match = found.find(c => c.name.toLowerCase() === line.name.toLowerCase());
        if (match) cards.push(makeCard(line, match.images.small));
        else { notFound.push(line.name); cards.push(makeCard(line, null)); }
      }
    } catch {
      for (const line of chunk) { notFound.push(line.name); cards.push(makeCard(line, null)); }
    }
  }
  return { cards, notFound };
}

// ─── Plain resolution (no card-image API integrated for this TCG) ────────────

function resolvePlain(lines: ParsedLine[]): Resolved {
  return { cards: lines.map(l => makeCard(l, null)), notFound: [] };
}

async function resolveDeck(tcg: TCGId, lines: ParsedLine[]): Promise<Resolved> {
  if (tcg === 'mtg') return resolveMTG(lines);
  if (tcg === 'pokemon') return resolvePokemon(lines);
  return resolvePlain(lines);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DeckImportModal({ visible, onClose, tcg, userId, onImported }: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { width } = useWindowDimensions();
  const containerWidth = Math.min(width, 500);
  const CARD_W = Math.floor((containerWidth - 40 - 24) / 4);
  const CARD_H = Math.floor(CARD_W / 0.718);

  const [name, setName] = useState('');
  const [format, setFormat] = useState('');
  const [decklist, setDecklist] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setFormat('');
    setDecklist('');
    setResolved(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const preview = async () => {
    const lines = parseDecklist(decklist).filter(l => l.section !== 'maybeboard');
    if (lines.length === 0) return;
    setResolving(true);
    setResolved(null);
    const result = await resolveDeck(tcg, lines);
    setResolved(result);
    setResolving(false);
  };

  const save = async () => {
    if (!resolved || !name.trim()) return;
    setSaving(true);
    try {
      const cardCount = resolved.cards.reduce((s, c) => s + c.quantity, 0);
      const { data, error } = await supabase
        .from('user_decks')
        .insert({
          user_id: userId,
          tcg,
          name: name.trim(),
          format: format.trim() || null,
          cards: resolved.cards,
          card_count: cardCount,
        })
        .select()
        .single();
      if (error) throw error;
      onImported(data as UserDeck);
      reset();
      onClose();
    } catch (e) { console.error('deck import failed:', e); }
    finally { setSaving(false); }
  };

  const parsedLines = parseDecklist(decklist);
  const lines = parsedLines.filter(l => l.section !== 'maybeboard');
  const maybeboardCount = parsedLines.length - lines.length;
  const hasImages = tcg === 'mtg' || tcg === 'pokemon';
  const expectedSize = tcg === 'mtg' ? expectedDeckSize(format) : null;

  const renderCardList = (list: DeckCard[], keyPrefix: string) => (
    hasImages ? (
      <View style={styles.grid}>
        {list.map((c, i) => (
          <View key={`${keyPrefix}-${c.name}-${i}`} style={[styles.cardWrap, { width: CARD_W }, c.isCommander && styles.commanderWrap]}>
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
          </View>
        ))}
      </View>
    ) : (
      <View style={styles.textList}>
        {list.map((c, i) => (
          <Text key={`${keyPrefix}-${c.name}-${i}`} style={[styles.textListRow, c.isCommander && styles.textListCommander]}>
            {c.quantity}× {c.name}{c.isCommander ? '  ★ Commander' : ''}
          </Text>
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

          <View style={styles.header}>
            <Text style={styles.title}>Deck importieren</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>

            <Text style={styles.label}>Deckname</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. Mono Blue Tempo"
              placeholderTextColor={C.textDim}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Format</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. Commander"
              placeholderTextColor={C.textDim}
              value={format}
              onChangeText={setFormat}
            />
            {tcg === 'mtg' && (
              <View style={styles.chipRow}>
                {MTG_FORMAT_SUGGESTIONS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, format === f && styles.chipActive]}
                    onPress={() => setFormat(f)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, format === f && styles.chipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Decklist</Text>
            <TextInput
              style={[styles.input, styles.decklistInput]}
              placeholder={PLACEHOLDER}
              placeholderTextColor={C.textDim}
              value={decklist}
              onChangeText={text => { setDecklist(text); setResolved(null); }}
              multiline
              numberOfLines={8}
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              Exportiere deine Liste aus Moxfield, Archidekt o.ä. im Format „1x Kartenname" und füge sie hier ein.
              {tcg === 'mtg'
                ? ' Damit Commander, Sideboard und Maybeboard erkannt werden, müssen sie im Text als eigene Abschnitte deklariert sein — z. B. mit einer Zeile „Commander", „Sideboard" bzw. „Maybeboard" über den jeweiligen Karten.'
                : ''}
            </Text>
            {maybeboardCount > 0 && (
              <Text style={styles.maybeboardHint}>
                {maybeboardCount} Karte{maybeboardCount > 1 ? 'n' : ''} aus dem Maybeboard werden beim Import übersprungen.
              </Text>
            )}

            <TouchableOpacity
              style={[styles.previewBtn, lines.length === 0 && styles.previewBtnOff]}
              onPress={preview}
              disabled={lines.length === 0 || resolving}
              activeOpacity={0.85}
            >
              {resolving
                ? <ActivityIndicator color={C.primary} size="small" />
                : (
                  <Text style={styles.previewBtnText}>
                    {lines.length > 0 ? `${lines.length} Karten auflösen` : 'Decklist einfügen'}
                  </Text>
                )
              }
            </TouchableOpacity>

            {!!resolved && (() => {
              const totalCount = resolved.cards.reduce((s, c) => s + c.quantity, 0);
              const mainCards = resolved.cards.filter(c => !c.isSideboard);
              const sideCards = resolved.cards.filter(c => c.isSideboard);
              const mainCount = mainCards.reduce((s, c) => s + c.quantity, 0);
              const sideCount = sideCards.reduce((s, c) => s + c.quantity, 0);
              return (
              <View style={styles.previewSection}>
                <Text style={styles.label}>
                  Vorschau · {totalCount} Karten
                </Text>
                {expectedSize !== null && (
                  <Text style={[styles.sizeHint, mainCount !== expectedSize ? styles.sizeHintWarn : styles.sizeHintOk]}>
                    {mainCount === expectedSize
                      ? `✓ Hauptdeck entspricht ${expectedSize} Karten für ${format.trim()}`
                      : `⚠ ${format.trim()} erwartet ${expectedSize} Karten im Hauptdeck — dieses hat ${mainCount}`}
                  </Text>
                )}

                {renderCardList(mainCards, 'main')}

                {sideCards.length > 0 && (
                  <>
                    <Text style={styles.label}>Sideboard · {sideCount} Karten</Text>
                    {renderCardList(sideCards, 'side')}
                  </>
                )}

                {resolved.notFound.length > 0 && (
                  <Text style={styles.notFoundText}>
                    {resolved.notFound.length} Karte{resolved.notFound.length > 1 ? 'n' : ''} nicht gefunden: {resolved.notFound.join(', ')}
                  </Text>
                )}
              </View>
              );
            })()}

          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, (!resolved || !name.trim()) && styles.confirmBtnOff]}
              onPress={save}
              disabled={!resolved || !name.trim() || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : (
                  <Text style={styles.confirmText}>
                    {!resolved ? 'Erst Karten auflösen' : !name.trim() ? 'Deckname eingeben' : 'Deck speichern'}
                  </Text>
                )
              }
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
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
  },
  title: { color: C.text, fontSize: 20, fontFamily: FONTS.extrabold },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: C.textMuted, fontSize: 14, fontFamily: FONTS.bold },

  body: { paddingHorizontal: 20, paddingBottom: 40 },

  label: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 18,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },
  decklistInput: { minHeight: 160, textAlignVertical: 'top' },
  hint: { color: C.textDim, fontSize: 12, marginTop: 8, lineHeight: 17 },
  maybeboardHint: { color: C.textMuted, fontSize: 12, marginTop: 6, lineHeight: 17, fontStyle: 'italic' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.textMuted, fontSize: 12, fontFamily: FONTS.semibold },
  chipTextActive: { color: C.text },

  previewBtn: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  previewBtnOff: { borderColor: C.border },
  previewBtnText: { color: C.primary, fontSize: 15, fontFamily: FONTS.bold },

  previewSection: { marginTop: 8 },
  sizeHint: { fontSize: 12, fontFamily: FONTS.semibold, lineHeight: 17, marginTop: -4, marginBottom: 8 },
  sizeHintOk: { color: '#3FB97D' },
  sizeHintWarn: { color: '#E0A53D' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
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
  qtyText: { color: '#FFFFFF', fontSize: 11, fontFamily: FONTS.extrabold },
  commanderTag: {
    position: 'absolute', top: 7, left: 7,
    backgroundColor: '#F0C75E',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  commanderTagText: { color: '#1A1300', fontSize: 9, fontFamily: FONTS.black },

  textList: { gap: 6, marginTop: 4 },
  textListRow: { color: C.text, fontSize: 14 },
  textListCommander: { color: '#F0C75E', fontFamily: FONTS.bold },

  notFoundText: { color: C.primary, fontSize: 12, marginTop: 14, lineHeight: 17 },

  footer: { padding: 20, borderTopWidth: 1, borderTopColor: C.border },
  confirmBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmBtnOff: { backgroundColor: C.surface3 },
  confirmText: { color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.bold },
  });
}
