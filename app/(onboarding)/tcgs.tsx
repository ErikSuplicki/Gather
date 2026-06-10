import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { FONTS, SPACING, ThemeColors, ELEVATION } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { TCG_LIST } from '@/constants/tcgs';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { TCGId } from '@/types';
import { TCGIcon } from '@/components/TCGIcon';

export default function TCGsScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { selectedTCGs, setSelectedTCGs } = useOnboarding();

  const toggle = (id: TCGId) => {
    setSelectedTCGs(
      selectedTCGs.includes(id)
        ? selectedTCGs.filter(t => t !== id)
        : [...selectedTCGs, id]
    );
  };

  const canProceed = selectedTCGs.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.step}>Schritt 1 von 4</Text>
          <Text style={styles.title}>Welche TCGs{'\n'}spielst du?</Text>
          <Text style={styles.subtitle}>Wähle alle zutreffenden aus</Text>
        </View>

        <View style={styles.list}>
          {TCG_LIST.map(tcg => {
            const selected = selectedTCGs.includes(tcg.id);
            return (
              <Pressable
                key={tcg.id}
                onPress={() => toggle(tcg.id)}
                style={({ pressed }) => [
                  styles.card,
                  selected && styles.cardSelected,
                  pressed && !selected && styles.cardPressed,
                ]}
              >
                {/* Left accent bar (TCG brand color) */}
                <View style={[styles.colorBar, { backgroundColor: tcg.color }]} />

                {/* Emoji */}
                <View style={[styles.emojiCircle, { backgroundColor: tcg.color + '20', borderColor: tcg.color + '40' }]}>
                  <TCGIcon tcg={tcg} size={30} color={tcg.color} />
                </View>

                {/* Name */}
                <Text style={[styles.cardName, selected && { color: tcg.color }]} numberOfLines={1}>
                  {tcg.name}
                </Text>

                {/* Checkbox (DS Checkbox style) */}
                <View style={[styles.check, selected && { backgroundColor: tcg.color, borderColor: tcg.color }]}>
                  {selected && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* DS ButtonPrimary footer */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push('/(onboarding)/region')}
          disabled={!canProceed}
          style={({ pressed }) => [
            styles.continueBtn,
            pressed && canProceed && styles.continueBtnPressed,
            !canProceed && styles.continueBtnDisabled,
          ]}
        >
          <Text style={styles.continueBtnText}>
            {canProceed
              ? `Weiter mit ${selectedTCGs.length} TCG${selectedTCGs.length > 1 ? 's' : ''} →`
              : 'Wähle mindestens ein TCG'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 12 },

  header: { marginBottom: 24 },
  step: {
    color:         C.primary,
    fontSize:      11,
    fontFamily:    FONTS.semibold,
    letterSpacing: 0.11,
    marginBottom:  8,
  },
  title: {
    color:         C.text,
    fontSize:      22,
    fontFamily:    FONTS.bold,
    letterSpacing: -0.22,
    lineHeight:    28,
    marginBottom:  8,
  },
  subtitle: { color: C.textMuted, fontSize: 14, fontFamily: FONTS.regular },

  list: { gap: 8 },

  card: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   C.surface,
    borderWidth:       1,
    borderColor:       C.border,
    borderRadius:      14,
    paddingHorizontal: 14,
    paddingVertical:   14,
    gap:               14,
    overflow:          'hidden',
    ...ELEVATION.panel,
  },
  cardSelected: { borderColor: C.primary, backgroundColor: C.primaryTint },
  cardPressed:  { backgroundColor: C.surface2 },
  colorBar: {
    position:             'absolute',
    left:                 0,
    top:                  0,
    bottom:               0,
    width:                4,
    borderTopLeftRadius:  14,
    borderBottomLeftRadius: 14,
  },

  emojiCircle: {
    width:          46,
    height:         46,
    borderRadius:   10,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 11, fontFamily: FONTS.bold, letterSpacing: 0.5 },
  cardName: { flex: 1, color: C.text, fontSize: 15, fontFamily: FONTS.semibold },

  // DS Checkbox
  check: {
    width:           24,
    height:          24,
    borderRadius:    5,
    borderWidth:     1.5,
    borderColor:     C.borderDefault,
    backgroundColor: C.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkMark: { color: '#fff', fontSize: 12, fontFamily: FONTS.bold },

  footer: {
    padding:       16,
    paddingBottom: SPACING.xl,
    borderTopWidth:  1,
    borderTopColor: C.border,
  },
  // DS ButtonPrimary (lg)
  continueBtn: {
    height:            48,
    backgroundColor:   C.primary,
    borderRadius:      12,
    paddingHorizontal: 24,
    alignItems:        'center',
    justifyContent:    'center',
    shadowColor:       C.primary,
    shadowOffset:      { width: 0, height: 0 },
    shadowOpacity:     0.35,
    shadowRadius:      8,
  },
  continueBtnPressed:  { backgroundColor: C.primaryDeep },
  continueBtnDisabled: { backgroundColor: C.surface3, shadowOpacity: 0, opacity: 0.55 },
  continueBtnText: { color: '#fff', fontSize: 15, fontFamily: FONTS.semibold },
  });
}
