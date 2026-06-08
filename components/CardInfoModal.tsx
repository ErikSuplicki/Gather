import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { FONTS, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { DeckCard, TCGId } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  card: DeckCard | null;
  tcg: TCGId;
}

interface CardDetails {
  stats: string | null;
  text: string | null;
  artist: string | null;
  year: string | null;
}

// ─── MTG details (Scryfall exact-name lookup) ────────────────────────────────
// Fetched live and never persisted — the deck only stores name/quantity/image,
// so this keeps the database lean while still surfacing rules text, P/T, etc.

interface ScryfallFull {
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  artist?: string;
  released_at?: string;
  card_faces?: Array<{ oracle_text?: string; power?: string; toughness?: string; artist?: string }>;
}

async function fetchMTGDetails(name: string): Promise<CardDetails | null> {
  try {
    const res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const c = (await res.json()) as ScryfallFull;
    const face = c.card_faces?.[0];
    let stats: string | null = null;
    if (c.power != null && c.toughness != null) stats = `Stärke ${c.power} · Widerstandskraft ${c.toughness}`;
    else if (face?.power != null && face?.toughness != null) stats = `Stärke ${face.power} · Widerstandskraft ${face.toughness}`;
    else if (c.loyalty != null) stats = `Loyalität ${c.loyalty}`;
    return {
      stats,
      text: c.oracle_text ?? face?.oracle_text ?? null,
      artist: c.artist ?? face?.artist ?? null,
      year: c.released_at ? c.released_at.slice(0, 4) : null,
    };
  } catch {
    return null;
  }
}

// ─── Pokémon details (Pokémon TCG API name search) ───────────────────────────

interface PokemonFull {
  hp?: string;
  attacks?: Array<{ damage?: string; text?: string }>;
  rules?: string[];
  flavorText?: string;
  artist?: string;
  set?: { releaseDate?: string };
}

async function fetchPokemonDetails(name: string): Promise<CardDetails | null> {
  try {
    const q = `name:"${name}"`;
    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&select=name,hp,attacks,rules,flavorText,artist,set&pageSize=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const c = (data.data?.[0] ?? null) as PokemonFull | null;
    if (!c) return null;
    const attackWithDamage = c.attacks?.find(a => !!a.damage);
    let stats: string | null = null;
    if (c.hp) stats = attackWithDamage?.damage ? `KP ${c.hp} · Schaden ${attackWithDamage.damage}` : `KP ${c.hp}`;
    return {
      stats,
      text: c.flavorText ?? c.rules?.[0] ?? c.attacks?.find(a => !!a.text)?.text ?? null,
      artist: c.artist ?? null,
      year: c.set?.releaseDate ? c.set.releaseDate.slice(0, 4) : null,
    };
  } catch {
    return null;
  }
}

async function fetchCardDetails(tcg: TCGId, name: string): Promise<CardDetails | null> {
  if (tcg === 'mtg') return fetchMTGDetails(name);
  if (tcg === 'pokemon') return fetchPokemonDetails(name);
  return null;
}

// ─── Mana symbols (Scryfall symbology — e.g. {R}{R} → red mana icon) ─────────
// Fetched live and cached in memory only, mirroring the "don't persist what an
// API can provide" approach used for the card details themselves.

const MANA_SYMBOL_RE = /\{[^}]+\}/g;

let symbologyPromise: Promise<Record<string, string>> | null = null;

function loadSymbology(): Promise<Record<string, string>> {
  if (!symbologyPromise) {
    symbologyPromise = fetch('https://api.scryfall.com/symbology')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { data?: Array<{ symbol?: string; svg_uri?: string }> } | null) => {
        const map: Record<string, string> = {};
        for (const sym of data?.data ?? []) {
          if (sym.symbol && sym.svg_uri) map[sym.symbol] = sym.svg_uri;
        }
        return map;
      })
      .catch(() => ({}));
  }
  return symbologyPromise;
}

function renderOracleText(text: string, symbols: Record<string, string> | null, styles: ReturnType<typeof makeStyles>) {
  if (!symbols || !MANA_SYMBOL_RE.test(text)) return <Text style={styles.text}>{text}</Text>;
  MANA_SYMBOL_RE.lastIndex = 0;
  const parts = text.split(MANA_SYMBOL_RE);
  const matches = text.match(MANA_SYMBOL_RE) ?? [];
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<Text key={`t${i}`}>{part}</Text>);
    const symbol = matches[i];
    if (symbol) {
      const uri = symbols[symbol];
      nodes.push(
        uri
          ? <Image key={`s${i}`} source={{ uri }} style={styles.manaIcon} />
          : <Text key={`s${i}`}>{symbol}</Text>
      );
    }
  });
  return <Text style={styles.text}>{nodes}</Text>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CardInfoModal({ visible, onClose, card, tcg }: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { width } = useWindowDimensions();
  const isNarrow = width < 560;
  const panelMaxWidth = Math.min(width - 40, 720);
  const imgWidth = isNarrow ? Math.min(width - 80, 280) : 230;
  const imgHeight = Math.floor(imgWidth / 0.718);

  const [details, setDetails] = useState<CardDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [symbols, setSymbols] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!visible || !card) { setDetails(null); setLoading(false); return; }
    let cancelled = false;
    setDetails(null);
    setLoading(true);
    fetchCardDetails(tcg, card.name).then(d => {
      if (cancelled) return;
      setDetails(d);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [visible, card, tcg]);

  useEffect(() => {
    if (!visible || tcg !== 'mtg' || symbols) return;
    loadSymbology().then(setSymbols);
  }, [visible, tcg, symbols]);

  if (!card) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.panel, { maxWidth: panelMaxWidth, flexDirection: isNarrow ? 'column' : 'row' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          {card.image ? (
            <Image source={{ uri: card.image }} style={[styles.image, { width: imgWidth, height: imgHeight }]} resizeMode="contain" />
          ) : (
            <View style={[styles.image, styles.imageFallback, { width: imgWidth, height: imgHeight }]}>
              <Text style={styles.imageFallbackText}>{card.name}</Text>
            </View>
          )}

          <ScrollView style={styles.infoCol} showsVerticalScrollIndicator={false}>
            <Text style={styles.name}>{card.name}</Text>

            {loading ? (
              <ActivityIndicator color={C.textMuted} size="small" style={styles.spinner} />
            ) : details ? (
              <>
                {!!details.stats && <Text style={styles.stats}>{details.stats}</Text>}
                {!!details.text && (tcg === 'mtg' ? renderOracleText(details.text, symbols, styles) : <Text style={styles.text}>{details.text}</Text>)}
                {!!details.artist && <Text style={styles.meta}>Illustration: {details.artist}</Text>}
                {!!details.year && <Text style={styles.meta}>Erschienen: {details.year}</Text>}
              </>
            ) : (
              <Text style={styles.meta}>Keine zusätzlichen Informationen verfügbar.</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px)' } as Record<string, unknown>) : {}),
  },
  panel: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    gap: 20,
    position: 'relative',
    maxHeight: '90%',
    shadowColor: C.cardShadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 14, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: C.textMuted, fontSize: 13, fontFamily: FONTS.bold },

  image: { borderRadius: 12, backgroundColor: C.surface2, alignSelf: 'center' },
  imageFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, padding: 16 },
  imageFallbackText: { color: C.textMuted, fontSize: 13, fontFamily: FONTS.bold, textAlign: 'center' },

  infoCol: { flexShrink: 1 },
  spinner: { marginTop: 14, alignSelf: 'flex-start' },
  name: { color: C.text, fontSize: 20, fontFamily: FONTS.extrabold, marginBottom: 10, paddingRight: 30 },
  stats: { color: '#F0C75E', fontSize: 14, fontFamily: FONTS.extrabold, marginBottom: 10 },
  text: { color: C.text, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  manaIcon: { width: 14, height: 14, marginHorizontal: 1 },
  meta: { color: C.textMuted, fontSize: 12, marginBottom: 4 },
  });
}
