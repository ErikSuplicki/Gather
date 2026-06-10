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

import { FONTS, ThemeColors, ELEVATION } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { TCG_MAP } from '@/constants/tcgs';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { TCGId } from '@/types';
import { TCGIcon } from '@/components/TCGIcon';

const SKILL_LABELS: Array<[number, string]> = [
  [1,  'Noch nie gespielt'],
  [3,  'Anfänger'],
  [5,  'Gelegenheitsspieler'],
  [7,  'Fortgeschritten'],
  [9,  'Erfahrener Spieler'],
  [10, 'Pro Player'],
];

function getSkillLabel(level: number): string {
  let label = SKILL_LABELS[0][1];
  for (const [threshold, name] of SKILL_LABELS) {
    if (level >= threshold) label = name;
  }
  return label;
}

export default function SkillScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { selectedTCGs, skillLevels, setSkillLevel } = useOnboarding();
  const allSet = selectedTCGs.every(tcg => (skillLevels[tcg] ?? 0) > 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.step}>Schritt 3 von 4</Text>
          <Text style={styles.title}>Wie gut spielst du?</Text>
          <Text style={styles.subtitle}>Bewerte dich für jedes TCG von 1 bis 10</Text>
        </View>

        {selectedTCGs.map(tcgId => {
          const tcg = TCG_MAP[tcgId as TCGId];
          const level = skillLevels[tcgId as TCGId] ?? 0;
          return (
            <View key={tcgId} style={styles.tcgSection}>
              <View style={styles.tcgHeader}>
                <TCGIcon tcg={tcg} size={22} color={C.textMuted} />
                <Text style={styles.tcgName}>{tcg.name}</Text>
              </View>

              {/* DS SegmentedControl-style level grid */}
              <View style={styles.levelGrid}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                  const active = level === n;
                  return (
                    <Pressable
                      key={n}
                      style={({ pressed }) => [
                        styles.levelBtn,
                        active && { backgroundColor: tcg.color, borderColor: tcg.color },
                        pressed && !active && styles.levelBtnPressed,
                      ]}
                      onPress={() => setSkillLevel(tcgId as TCGId, n)}
                    >
                      <Text style={[styles.levelBtnText, active && styles.levelBtnTextActive]}>
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {level > 0 && (
                <View style={styles.levelLabelRow}>
                  <View style={[styles.levelDot, { backgroundColor: tcg.color }]} />
                  <Text style={[styles.levelLabel, { color: tcg.color }]}>
                    {level} – {getSkillLabel(level)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* DS ButtonPrimary footer */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push('/(onboarding)/name')}
          disabled={!allSet}
          style={({ pressed }) => [
            styles.continueBtn,
            pressed && allSet && styles.continueBtnPressed,
            !allSet && styles.continueBtnDisabled,
          ]}
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
  content:   { padding: 16, paddingBottom: 12 },

  header:   { marginBottom: 24 },
  step:     { color: C.primary, fontSize: 11, fontFamily: FONTS.semibold, letterSpacing: 0.11, marginBottom: 8 },
  title:    { color: C.text, fontSize: 22, fontFamily: FONTS.bold, letterSpacing: -0.22, marginBottom: 8 },
  subtitle: { color: C.textMuted, fontSize: 14, fontFamily: FONTS.regular },

  // DS Card
  tcgSection: {
    backgroundColor: C.surface,
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    14,
    padding:         14,
    marginBottom:    8,
    gap:             12,
    ...ELEVATION.panel,
  },
  tcgHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tcgEmoji:  { fontSize: 12, fontFamily: FONTS.bold, letterSpacing: 0.5, color: C.textMuted },
  tcgName:   { color: C.text, fontSize: 15, fontFamily: FONTS.semibold },

  // Number buttons (DS Checkbox/button style)
  levelGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelBtn: {
    width:           42,
    height:          42,
    borderRadius:    10,
    backgroundColor: C.surface2,
    borderWidth:     1,
    borderColor:     C.borderDefault,
    alignItems:      'center',
    justifyContent:  'center',
  },
  levelBtnPressed:    { backgroundColor: C.surface3 },
  levelBtnText:       { color: C.textMuted, fontSize: 15, fontFamily: FONTS.semibold },
  levelBtnTextActive: { color: '#0A0A0A', fontFamily: FONTS.bold },

  // Level label with DS Badge dot
  levelLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelDot:      { width: 6, height: 6, borderRadius: 3 },
  levelLabel:    { fontSize: 12, fontFamily: FONTS.semibold },

  footer: {
    padding:        16,
    paddingBottom:  32,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  continueBtn: {
    height:          48,
    backgroundColor: C.primary,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     C.primary,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.35,
    shadowRadius:    8,
  },
  continueBtnPressed:  { backgroundColor: C.primaryDeep },
  continueBtnDisabled: { backgroundColor: C.surface3, shadowOpacity: 0, opacity: 0.55 },
  continueBtnText:     { color: '#fff', fontSize: 15, fontFamily: FONTS.semibold },
  });
}
