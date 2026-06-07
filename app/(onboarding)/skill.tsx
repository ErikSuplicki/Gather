import React from 'react';
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

import { COLORS, SPACING } from '@/constants/theme';
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
            colors={allSet ? ['#9333EA', '#6D28D9'] : [COLORS.surface3, COLORS.surface3]}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingBottom: SPACING.md },
  header: { marginBottom: SPACING.xl },
  step: { color: COLORS.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: 30, fontWeight: '800', marginBottom: SPACING.sm },
  subtitle: { color: COLORS.textMuted, fontSize: 15 },
  tcgSection: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  tcgName: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBtnText: { color: COLORS.textMuted, fontSize: 16, fontWeight: '600' },
  levelBtnTextActive: { color: '#0A0A0A', fontWeight: '800' },
  levelLabel: { marginTop: SPACING.md, fontSize: 13, fontWeight: '700' },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  continueBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: 14,
  },
  disabled: { opacity: 0.4 },
  continueBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
