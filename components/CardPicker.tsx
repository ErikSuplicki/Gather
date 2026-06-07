import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface SelectedCard {
  id: string;
  name: string;
  image: string;
}

export type CardGame = 'mtg' | 'pokemon';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (cards: SelectedCard[]) => void;
  maxCards?: number;
  initialCards?: SelectedCard[];
  game?: CardGame;
}

// ─── MTG (Scryfall) ──────────────────────────────────────────────────────────

interface ScryfallCard {
  id: string;
  name: string;
  image_uris?: { normal: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
}

function scryfallImg(c: ScryfallCard): string | null {
  return c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null;
}

async function mtgDefault(): Promise<SelectedCard[]> {
  try {
    const res = await fetch(
      'https://api.scryfall.com/cards/search?q=is:commander&order=edhrec&unique=cards',
    );
    const data = await res.json();
    return (data.data ?? []).flatMap((c: ScryfallCard) => {
      const img = scryfallImg(c);
      return img ? [{ id: c.id, name: c.name, image: img }] : [];
    });
  } catch { return []; }
}

async function mtgSearch(q: string): Promise<SelectedCard[]> {
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=edhrec&unique=cards`,
    );
    const data = await res.json();
    if (data.object === 'error') return [];
    return (data.data ?? []).flatMap((c: ScryfallCard) => {
      const img = scryfallImg(c);
      return img ? [{ id: c.id, name: c.name, image: img }] : [];
    });
  } catch { return []; }
}

async function mtgAutocomplete(q: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`,
    );
    const data = await res.json();
    return data.data ?? [];
  } catch { return []; }
}

// ─── Pokémon TCG API ─────────────────────────────────────────────────────────

interface PokemonCard {
  id: string;
  name: string;
  images: { small: string; large: string };
}

async function pokemonDefault(): Promise<SelectedCard[]> {
  try {
    const res = await fetch(
      'https://api.pokemontcg.io/v2/cards?q=set.id:base1&orderBy=number&pageSize=9&select=id,name,images',
    );
    const data = await res.json();
    return (data.data ?? []).map((c: PokemonCard) => ({
      id: c.id,
      name: c.name,
      image: c.images.small,
    }));
  } catch { return []; }
}

async function pokemonSearch(q: string): Promise<SelectedCard[]> {
  try {
    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=name:${q}*&orderBy=name&pageSize=20&select=id,name,images`,
    );
    const data = await res.json();
    return (data.data ?? []).map((c: PokemonCard) => ({
      id: c.id,
      name: c.name,
      image: c.images.small,
    }));
  } catch { return []; }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CardPicker({
  visible,
  onClose,
  onSelect,
  maxCards = 4,
  initialCards = [],
  game = 'mtg',
}: Props) {
  const { width } = useWindowDimensions();
  const containerWidth = Math.min(width, 500);
  const CARD_W = Math.floor((containerWidth - 48) / 3);
  const CARD_H = Math.floor(CARD_W / 0.718);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SelectedCard[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SelectedCard[]>(initialCards);
  const [zoomedCard, setZoomedCard] = useState<SelectedCard | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDefault = async (g: CardGame) => {
    setLoading(true);
    const cards = g === 'mtg' ? await mtgDefault() : await pokemonDefault();
    setResults(cards);
    setLoading(false);
  };

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setSuggestions([]);
    setResults([]);
    setSelected(initialCards);
    loadDefault(game);
  }, [visible, game]);

  const search = (text: string) => {
    setQuery(text);
    setSuggestions([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (acTimer.current) clearTimeout(acTimer.current);

    if (text.length === 0) {
      loadDefault(game);
      return;
    }
    if (text.length < 2) return;

    // Autocomplete — MTG only (Scryfall has a dedicated endpoint)
    if (game === 'mtg') {
      acTimer.current = setTimeout(async () => {
        setSuggestions(await mtgAutocomplete(text));
      }, 150);
    }

    // Grid search
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      const cards = game === 'mtg' ? await mtgSearch(text) : await pokemonSearch(text);
      setResults(cards);
      setLoading(false);
    }, 400);
  };

  const pickSuggestion = (name: string) => {
    setQuery(name);
    setSuggestions([]);
    setLoading(true);
    mtgSearch(`!"${name}"`).then(cards => {
      setResults(cards);
      setLoading(false);
    });
  };

  const toggle = (card: SelectedCard) => {
    const already = selected.find(s => s.id === card.id);
    if (already) {
      setSelected(prev => prev.filter(s => s.id !== card.id));
    } else if (selected.length >= maxCards) {
      setSelected(prev => [...prev.slice(1), card]);
    } else {
      setSelected(prev => [...prev, card]);
    }
  };

  const confirm = () => {
    onSelect(selected);
    onClose();
  };

  const handleClose = () => {
    setQuery('');
    setSuggestions([]);
    setSelected(initialCards);
    onClose();
  };

  const title = game === 'mtg' ? 'Magic-Karte wählen' : 'Pokémon-Karte wählen';
  const placeholder = game === 'mtg' ? 'Kartenname eingeben...' : 'Pokémon-Karte suchen...';

  return (
    <Modal
      visible={visible}
      // fade closes instantly on web — slide animation can block the profile
      // save button while the dismissal animation is still running
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={[styles.inner, { maxWidth: containerWidth, alignSelf: 'center', width: '100%' }]}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search + autocomplete dropdown */}
          <View style={styles.searchContainer}>
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor="#555"
                value={query}
                onChangeText={search}
                autoCorrect={false}
              />
              {loading && <ActivityIndicator color="#D4384A" size="small" />}
            </View>

            {suggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {suggestions.slice(0, 8).map(name => (
                  <TouchableOpacity
                    key={name}
                    style={styles.suggestionItem}
                    onPress={() => pickSuggestion(name)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Selected strip */}
          {selected.length > 0 && (
            <View style={styles.selectedStrip}>
              <Text style={styles.selectedLabel}>
                Ausgewählt {selected.length}/{maxCards}
              </Text>
              <View style={styles.selectedRow}>
                {selected.map(card => (
                  <TouchableOpacity
                    key={card.id}
                    onPress={() => setSelected(prev => prev.filter(s => s.id !== card.id))}
                    style={styles.selectedThumbWrap}
                  >
                    <Image source={{ uri: card.image }} style={styles.selectedThumb} resizeMode="cover" />
                    <View style={styles.removeTag}>
                      <Text style={styles.removeText}>✕</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Card grid */}
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSel = selected.some(s => s.id === item.id);
              return (
                <Pressable
                  style={[styles.cardWrap, { width: CARD_W, height: CARD_H }, isSel && styles.cardWrapSel]}
                  onPress={() => toggle(item)}
                  onLongPress={() => setZoomedCard(item)}
                  onPressOut={() => setZoomedCard(null)}
                  delayLongPress={300}
                >
                  <Image source={{ uri: item.image }} style={styles.cardImg} resizeMode="cover" />
                  {isSel && (
                    <View style={styles.checkOverlay}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              loading ? null : (
                <Text style={styles.emptyText}>Keine Karten gefunden.</Text>
              )
            }
          />

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, selected.length === 0 && styles.confirmBtnOff]}
              onPress={confirm}
              disabled={selected.length === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmText}>
                {selected.length > 0
                  ? `${selected.length} Karte${selected.length > 1 ? 'n' : ''} übernehmen`
                  : 'Keine Karte ausgewählt'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Long-press zoom overlay */}
          {!!zoomedCard && (
            <View style={styles.zoomOverlay} pointerEvents="none">
              <View style={styles.zoomedCardWrap}>
                <Image
                  source={{ uri: zoomedCard.image }}
                  style={{ width: containerWidth * 0.78, height: (containerWidth * 0.78) / 0.718 }}
                  resizeMode="contain"
                />
              </View>
            </View>
          )}

        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  inner: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#1C1C1C',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#888888', fontSize: 14, fontWeight: '700' },

  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    zIndex: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchIcon: { color: '#555555', fontSize: 18 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15 },

  suggestionsBox: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginTop: 4,
    overflow: 'hidden',
    zIndex: 20,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  suggestionText: { color: '#FFFFFF', fontSize: 14 },

  selectedStrip: { paddingHorizontal: 20, marginBottom: 14 },
  selectedLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  selectedRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  selectedThumbWrap: { position: 'relative' },
  selectedThumb: {
    width: 72, height: 100,
    borderRadius: 6,
    borderWidth: 2, borderColor: '#D4384A',
  },
  removeTag: {
    position: 'absolute', top: -7, right: -7,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#D4384A',
    alignItems: 'center', justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  grid: { paddingHorizontal: 12, paddingBottom: 20, gap: 6 },
  cardWrap: {
    margin: 3,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  cardWrapSel: { borderWidth: 2.5, borderColor: '#D4384A' },
  cardImg: { width: '100%', height: '100%' },
  checkOverlay: {
    position: 'absolute', top: 5, right: 5,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#D4384A',
    alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 14, fontWeight: '900' },

  emptyText: { color: '#555555', textAlign: 'center', padding: 48, fontSize: 15 },

  zoomOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.82)',
    zIndex: 50,
  },
  zoomedCardWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 32,
    elevation: 32,
  },

  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#1E1E1E' },
  confirmBtn: {
    backgroundColor: '#D4384A',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmBtnOff: { backgroundColor: '#1E1E1E' },
  confirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
