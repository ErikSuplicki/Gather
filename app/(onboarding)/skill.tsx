import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { FONTS, SPACING, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { TCG_MAP } from '@/constants/tcgs';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { TCGId } from '@/types';

const SKILL_LABELS: Array<[number, string]> = [
  [1, 'Noch nie gespielt'],
  [3, 'Anfänger'],
  [5, 'Gelegenheitsspieler'],
  [7, 'Fortgeschritten'],
  [9, 'Erfahrener Spieler'],
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
          <Text style={styles.step}>SCHRITT 3 / 4</Text>
          <Text style={styles.title}>Wie gut spielst du?</Text>
          <Text style={styles.subtitle}>Bewerte dich für jedes TCG von 1 bis 10</Text>
        </View>

        {selectedTCGs.map(tcgId => {
          const tcg = TCG_MAP[tcgId as TCGId];
          const level = skillLevels[tcgId as TCGId] ?? 0;

          return (
            <View key={tcgId} style={styles.tcgSection}>
              <View style={styles.tcgHeader}>
                <Text style={styles.tcgEmoji}>{tcg.emoji}</Text>
                <Text style={styles.tcgName}>{tcg.name}</Text>
              </View>

              <View style={styles.levelGrid}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                  const active = level === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[
                        styles.levelBtn,
                        active && { backgroundColor: tcg.color, borderColor: tcg.color },
                      ]}
                      onPress={() => setSkillLevel(tcgId as TCGId, n)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[styles.levelBtnText, active && styles.levelBtnTextActive]}
                      >
                        {n}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {level > 0 && (
                <Text style={[styles.levelLabel, { color: tcg.color }]}>
                  {level} – {getSkillLabel(level)}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => router.push('/(onboarding)/name')}
          disabled={!allSet}
          activeOpacity={0.85}
          style={[{ borderRadius: 14, overflow: 'hidden' }, !allSet && styles.disabled]}
        >
          <LinearGradient
            colors={allSet ? ['#9333EA', '#6D28D9'] : [C.surface3, C.surface3]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueBtn}
          >
            <Text style={styles.continueBtnText}>Weiter →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: SPACING.lg, paddingBottom: SPACING.md },
  header: { marginBottom: SPACING.xl },
  step: { color: C.primary, fontSize: 11, fontFamily: FONTS.extrabold, letterSpacing: 2, marginBottom: SPACING.sm },
  title: { color: C.text, fontSize: 30, fontFamily: FONTS.extrabold, marginBottom: SPACING.sm },
  subtitle: { color: C.textMuted, fontSize: 15 },
  tcgSection: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  tcgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tcgEmoji: { fontSize: 26 },
  tcgName: { color: C.text, fontSize: 17, fontFamily: FONTS.bold },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBtnText: { color: C.textMuted, fontSize: 16, fontFamily: FONTS.semibold },
  levelBtnTextActive: { color: '#0A0A0A', fontFamily: FONTS.extrabold },
  levelLabel: { marginTop: SPACING.md, fontSize: 13, fontFamily: FONTS.bold },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  continueBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: 14,
  },
  disabled: { opacity: 0.4 },
  continueBtnText: { color: '#fff', fontSize: 17, fontFamily: FONTS.bold },
  });
}
