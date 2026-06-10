import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';

import { FONTS, ThemeColors, ELEVATION } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    country?: string;
  };
}

function formatAddress(address: NominatimResult['address']): string {
  const city = address.city ?? address.town ?? address.village ?? address.county ?? '';
  const country = address.country ?? '';
  return [city, country].filter(Boolean).join(', ');
}

export default function RegionScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { setRegion, setLocation } = useOnboarding();
  const [locating, setLocating]           = useState(false);
  const [confirmedLocation, setConfirmedLocation] = useState('');
  const [query, setQuery]                 = useState('');
  const [suggestions, setSuggestions]     = useState<NominatimResult[]>([]);
  const [inputFocused, setInputFocused]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirmLocation = (label: string, lat: number, lon: number) => {
    setConfirmedLocation(label);
    setRegion(label);
    setLocation(lat, lon);
    setSuggestions([]);
    setQuery(label);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&format=json`,
        { headers: { 'Accept-Language': 'de' } }
      );
      const data = await response.json();
      const label = formatAddress(data.address) ||
        `${loc.coords.latitude.toFixed(2)}, ${loc.coords.longitude.toFixed(2)}`;
      confirmLocation(label, loc.coords.latitude, loc.coords.longitude);
    } catch { /* user can enter manually */ }
    finally { setLocating(false); }
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setConfirmedLocation('');
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.length < 2) { setSuggestions([]); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'de' } }
        );
        setSuggestions(await response.json());
      } catch { setSuggestions([]); }
    }, 400);
  };

  const selectSuggestion = (item: NominatimResult) => {
    const label = formatAddress(item.address) ||
      item.display_name.split(',').slice(0, 2).join(',').trim();
    confirmLocation(label, parseFloat(item.lat), parseFloat(item.lon));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.step}>Schritt 2 von 4</Text>
          <Text style={styles.title}>Wo suchst du{'\n'}Mitspieler?</Text>
          <Text style={styles.subtitle}>
            Dein Standort hilft dir, lokale Spieler in deiner Nähe zu finden
          </Text>
        </View>

        {/* DS ButtonSecondary — location */}
        <Pressable
          style={({ pressed }) => [styles.locationBtn, pressed && styles.locationBtnPressed]}
          onPress={useMyLocation}
          disabled={locating}
        >
          {locating
            ? <ActivityIndicator color={C.primary} />
            : <Text style={styles.locationBtnText}>Meinen Standort verwenden</Text>
          }
        </Pressable>

        {/* Confirmed location card */}
        {!!confirmedLocation && (
          <View style={styles.confirmedCard}>
            <Text style={styles.confirmedIcon}>✓</Text>
            <View style={styles.confirmedText}>
              <Text style={styles.confirmedLabel}>Standort gesetzt</Text>
              <Text style={styles.confirmedCity}>{confirmedLocation}</Text>
            </View>
          </View>
        )}

        {/* DS Divider (labeled) */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>oder manuell suchen</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* DS TextInput */}
        <View style={[styles.inputWrap, inputFocused && styles.inputWrapFocused]}>
          <TextInput
            style={styles.input}
            placeholder="z.B. München, Bayern"
            placeholderTextColor={C.textFaint}
            value={query}
            onChangeText={handleQueryChange}
            autoCorrect={false}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
        </View>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((item, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.suggestion,
                  index > 0 && styles.suggestionBorder,
                  pressed && styles.suggestionPressed,
                ]}
                onPress={() => selectSuggestion(item)}
              >
                <Text style={styles.suggestionText} numberOfLines={2}>
                  {item.display_name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* DS ButtonPrimary footer */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.continueBtn,
            pressed && !!confirmedLocation && styles.continueBtnPressed,
            !confirmedLocation && styles.continueBtnDisabled,
          ]}
          onPress={() => router.push('/(onboarding)/skill')}
          disabled={!confirmedLocation}
        >
          <Text style={styles.continueBtnText}>Weiter →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { flex: 1, padding: 16 },

  header:   { marginBottom: 24 },
  step:     { color: C.primary, fontSize: 11, fontFamily: FONTS.semibold, letterSpacing: 0.11, marginBottom: 8 },
  title:    { color: C.text, fontSize: 22, fontFamily: FONTS.bold, letterSpacing: -0.22, lineHeight: 28, marginBottom: 8 },
  subtitle: { color: C.textMuted, fontSize: 14, fontFamily: FONTS.regular, lineHeight: 20 },

  // DS ButtonSecondary
  locationBtn: {
    backgroundColor:   C.surface3,
    borderWidth:       1,
    borderColor:       C.primary,
    borderRadius:      10,
    height:            48,
    alignItems:        'center',
    justifyContent:    'center',
    marginBottom:      12,
  },
  locationBtnPressed: { backgroundColor: C.primaryTint },
  locationBtnText:    { color: C.primaryBright, fontSize: 14, fontFamily: FONTS.semibold },

  // Success badge
  confirmedCard: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              12,
    backgroundColor:  C.successBg,
    borderWidth:      1,
    borderColor:      C.success + '50',
    borderRadius:     12,
    padding:          12,
    marginBottom:     8,
  },
  confirmedIcon:  { fontSize: 18, color: C.success },
  confirmedText:  { flex: 1 },
  confirmedLabel: {
    color:         C.success,
    fontSize:      10,
    fontFamily:    FONTS.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confirmedCity: { color: C.text, fontSize: 14, fontFamily: FONTS.semibold, marginTop: 2 },

  // DS Divider (labeled)
  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerLabel: {
    color:            C.textFaint,
    marginHorizontal: 12,
    fontSize:         11,
    fontFamily:       FONTS.semibold,
    letterSpacing:    0.11,
  },

  // DS TextInput
  inputWrap: {
    borderWidth:  1,
    borderColor:  C.border,
    borderRadius: 10,
  },
  inputWrapFocused: {
    borderColor:   C.borderFocus,
    shadowColor:   C.borderFocus,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius:  3,
  },
  input: {
    height:            42,
    backgroundColor:   C.surface2,
    borderRadius:      10,
    paddingHorizontal: 12,
    color:             C.text,
    fontSize:          14,
    fontFamily:        FONTS.regular,
  },

  // Suggestions (DS Card + ListItem)
  suggestionsContainer: {
    backgroundColor: C.surface,
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    12,
    marginTop:       4,
    overflow:        'hidden',
    ...ELEVATION.panel,
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  suggestionBorder:  { borderTopWidth: 1, borderTopColor: C.surfaceHighlight },
  suggestionPressed: { backgroundColor: C.surface2 },
  suggestionText:    { color: C.text, fontSize: 14, fontFamily: FONTS.regular },

  footer: {
    padding:         16,
    paddingBottom:   32,
    borderTopWidth:  1,
    borderTopColor:  C.border,
  },
  // DS ButtonPrimary (lg)
  continueBtn: {
    height:            48,
    backgroundColor:   C.primary,
    borderRadius:      12,
    alignItems:        'center',
    justifyContent:    'center',
    shadowColor:       C.primary,
    shadowOffset:      { width: 0, height: 0 },
    shadowOpacity:     0.35,
    shadowRadius:      8,
  },
  continueBtnPressed:  { backgroundColor: C.primaryDeep },
  continueBtnDisabled: { backgroundColor: C.surface3, shadowOpacity: 0, opacity: 0.55 },
  continueBtnText:     { color: '#fff', fontSize: 15, fontFamily: FONTS.semibold },
  });
}
