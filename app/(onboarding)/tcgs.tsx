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
import { TCG_LIST } from '@/constants/tcgs';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { TCGId } from '@/types';

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.step}>SCHRITT 1 / 4</Text>
          <Text style={styles.title}>Welche TCGs{'\n'}spielst du?</Text>
          <Text style={styles.subtitle}>Wähle alle zutreffenden aus</Text>
        </View>

        {/* TCG cards */}
        <View style={styles.list}>
          {TCG_LIST.map(tcg => {
            const selected = selectedTCGs.includes(tcg.id);
            return (
              <TouchableOpacity
                key={tcg.id}
                onPress={() => toggle(tcg.id)}
                activeOpacity={0.75}
                style={styles.cardWrap}
              >
                {/* Left color bar */}
                <View style={[styles.colorBar, { backgroundColor: tcg.color }]} />

                <View
                  style={[
                    styles.card,
                    selected && {
                      backgroundColor: tcg.color + '12',
                      borderColor: tcg.color + '60',
                    },
                  ]}
                >
                  {/* Emoji in colored circle */}
                  <View
                    style={[
                      styles.emojiCircle,
                      { backgroundColor: tcg.color + '20', borderColor: tcg.color + '40' },
                    ]}
                  >
                    <Text style={styles.emoji}>{tcg.emoji}</Text>
                  </View>

                  {/* Name */}
                  <Text
                    style={[styles.cardName, selected && { color: tcg.color }]}
                    numberOfLines={1}
                  >
                    {tcg.name}
                  </Text>

                  {/* Check */}
                  <View
                    style={[
                      styles.check,
                      selected && { backgroundColor: tcg.color, borderColor: tcg.color },
                    ]}
                  >
                    {selected && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => router.push('/(onboarding)/region')}
          disabled={selectedTCGs.length === 0}
          activeOpacity={0.85}
          style={[{ borderRadius: 16, overflow: 'hidden' }, selectedTCGs.length === 0 && styles.disabledWrap]}
        >
          <LinearGradient
            colors={selectedTCGs.length > 0 ? ['#9333EA', '#6D28D9'] : [C.surface3, C.surface3]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueBtn}
          >
            <Text style={styles.continueBtnText}>
              {selectedTCGs.length > 0
                ? `Weiter mit ${selectedTCGs.length} TCG${selectedTCGs.length > 1 ? 's' : ''} →`
                : 'Wähle mindestens ein TCG'}
            </Text>
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
  step: {
    color: C.primary,
    fontSize: 11,
    fontFamily: FONTS.extrabold,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  title: {
    color: C.text,
    fontSize: 32,
    fontFamily: FONTS.black,
    lineHeight: 38,
    marginBottom: SPACING.sm,
  },
  subtitle: { color: C.textMuted, fontSize: 15 },

  list: { gap: SPACING.sm },

  cardWrap: {
    flexDirection: 'row',
    borderRadius: 18,
    overflow: 'hidden',
  },
  colorBar: {
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: C.border,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },

  emojiCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },

  cardName: {
    flex: 1,
    color: C.text,
    fontSize: 16,
    fontFamily: FONTS.bold,
  },

  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 14, fontFamily: FONTS.black },

  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  disabledWrap: { opacity: 0.45 },
  continueBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: 16,
  },
  continueBtnText: { color: '#fff', fontSize: 17, fontFamily: FONTS.bold },
  });
}
