import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';

import { FONTS, SPACING, ThemeColors } from '@/constants/theme';
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
  const [locating, setLocating] = useState(false);
  const [confirmedLocation, setConfirmedLocation] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
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
      if (status !== 'granted') {
        setLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&format=json`,
        { headers: { 'Accept-Language': 'de' } }
      );
      const data = await response.json();
      const label =
        formatAddress(data.address) ||
        `${loc.coords.latitude.toFixed(2)}, ${loc.coords.longitude.toFixed(2)}`;
      confirmLocation(label, loc.coords.latitude, loc.coords.longitude);
    } catch {
      // user can enter manually
    } finally {
      setLocating(false);
    }
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setConfirmedLocation('');

    if (timerRef.current) clearTimeout(timerRef.current);

    if (text.length < 2) {
      setSuggestions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'de' } }
        );
        const results: NominatimResult[] = await response.json();
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    }, 400);
  };

  const selectSuggestion = (item: NominatimResult) => {
    const label =
      formatAddress(item.address) ||
      item.display_name.split(',').slice(0, 2).join(',').trim();
    confirmLocation(label, parseFloat(item.lat), parseFloat(item.lon));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.step}>SCHRITT 2 / 4</Text>
          <Text style={styles.title}>Wo suchst du{'\n'}Mitspieler?</Text>
          <Text style={styles.subtitle}>
            Dein Standort hilft dir, lokale Spieler in deiner Nähe zu finden
          </Text>
        </View>

        <TouchableOpacity
          style={styles.locationBtn}
          onPress={useMyLocation}
          disabled={locating}
          activeOpacity={0.8}
        >
          {locating ? (
            <ActivityIndicator color={C.primary} />
          ) : (
            <Text style={styles.locationBtnText}>📍   Meinen Standort verwenden</Text>
          )}
        </TouchableOpacity>

        {confirmedLocation ? (
          <View style={styles.confirmedCard}>
            <Text style={styles.confirmedIcon}>✓</Text>
            <View style={styles.confirmedText}>
              <Text style={styles.confirmedLabel}>Standort gesetzt</Text>
              <Text style={styles.confirmedCity}>{confirmedLocation}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>oder manuell suchen</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="z.B. München, Bayern"
          placeholderTextColor={C.textMuted}
          value={query}
          onChangeText={handleQueryChange}
          autoCorrect={false}
        />

        {suggestions.length > 0 ? (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.suggestion, index > 0 && styles.suggestionBorder]}
                onPress={() => selectSuggestion(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText} numberOfLines={2}>
                  {item.display_name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, !confirmedLocation && styles.disabled]}
          onPress={() => router.push('/(onboarding)/skill')}
          disabled={!confirmedLocation}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>Weiter →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, padding: SPACING.lg },
  header: { marginBottom: SPACING.xl },
  step: { color: C.primary, fontSize: 11, fontFamily: FONTS.extrabold, letterSpacing: 2, marginBottom: SPACING.sm },
  title: { color: C.text, fontSize: 30, fontFamily: FONTS.extrabold, lineHeight: 36, marginBottom: SPACING.sm },
  subtitle: { color: C.textMuted, fontSize: 15, lineHeight: 22 },
  locationBtn: {
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  locationBtnText: { color: C.primaryLight, fontSize: 16, fontFamily: FONTS.semibold },
  confirmedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: '#10B98115',
    borderWidth: 1.5,
    borderColor: '#10B98150',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  confirmedIcon: { fontSize: 22, color: C.success, fontFamily: FONTS.bold },
  confirmedText: { flex: 1 },
  confirmedLabel: {
    color: C.success,
    fontSize: 11,
    fontFamily: FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confirmedCity: { color: C.text, fontSize: 16, fontFamily: FONTS.bold, marginTop: 2 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { color: C.textMuted, marginHorizontal: SPACING.md, fontSize: 13 },
  input: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: 15,
    color: C.text,
    fontSize: 16,
  },
  suggestionsContainer: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    marginTop: SPACING.xs,
    overflow: 'hidden',
  },
  suggestion: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  suggestionBorder: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  suggestionText: { color: C.text, fontSize: 14 },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  continueBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: { opacity: 0.35 },
  continueBtnText: { color: '#fff', fontSize: 17, fontFamily: FONTS.bold },
  });
}
