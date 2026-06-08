import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { FONTS, SPACING, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { supabase } from '@/lib/supabase';
import { uploadAvatar } from '@/lib/auth';
import { showAlert } from '@/lib/alert';

export default function NameScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const {
    selectedTCGs,
    region,
    latitude,
    longitude,
    skillLevels,
    username,
    setUsername,
    avatarBase64,
    setAvatarBase64,
    avatarUri,
    setAvatarUri,
  } = useOnboarding();

  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Berechtigung benötigt', 'Wir brauchen Zugriff auf deine Fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarBase64(result.assets[0].base64 ?? null);
    }
  };

  const finish = async () => {
    if (!username.trim()) {
      showAlert('Name fehlt', 'Bitte gib einen Anzeigenamen ein.');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht angemeldet');
      const userId = session.user.id;

      let avatarUrl: string | null = null;
      if (avatarBase64) {
        avatarUrl = await uploadAvatar(avatarBase64, userId);
      }

      // Upsert profile (handles first-time and re-onboarding)
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        username: username.trim(),
        avatar_url: avatarUrl,
        city: region.split(',')[0]?.trim() ?? region,
        region,
        latitude,
        longitude,
        onboarding_complete: true,
      });
      if (profileError) throw profileError;

      // Replace TCG entries
      if (selectedTCGs.length > 0) {
        await supabase.from('user_tcgs').delete().eq('user_id', userId);
        const { error: tcgError } = await supabase.from('user_tcgs').insert(
          selectedTCGs.map(tcg => ({
            user_id: userId,
            tcg,
            skill_level: skillLevels[tcg] ?? 1,
          }))
        );
        if (tcgError) throw tcgError;
      }

      router.replace('/(tabs)');
    } catch (err: unknown) {
      showAlert('Fehler', (err as Error).message ?? 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.step}>SCHRITT 4 / 4</Text>
            <Text style={styles.title}>Fast geschafft! 🎉</Text>
            <Text style={styles.subtitle}>Erstelle dein Spielerprofil</Text>
          </View>

          {/* Avatar picker */}
          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.8}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarIcon}>📷</Text>
                <Text style={styles.avatarHint}>Foto auswählen{'\n'}(optional)</Text>
              </View>
            )}
            <View style={styles.editOverlay}>
              <Text style={styles.editOverlayText}>✎</Text>
            </View>
          </TouchableOpacity>

          {/* Username input */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Dein Anzeigename *</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. DerMagier"
              placeholderTextColor={C.textMuted}
              value={username}
              onChangeText={setUsername}
              maxLength={24}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Text style={styles.hint}>Wird anderen Spielern angezeigt · max. 24 Zeichen</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.finishBtn, (!username.trim() || saving) && styles.disabled]}
          onPress={finish}
          disabled={!username.trim() || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.finishBtnText}>Fertig &amp; Losspielen 🚀</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  content: { padding: SPACING.lg, alignItems: 'center', paddingBottom: SPACING.xl },
  header: { width: '100%', marginBottom: SPACING.xl },
  step: { color: C.primary, fontSize: 11, fontFamily: FONTS.extrabold, letterSpacing: 2, marginBottom: SPACING.sm },
  title: { color: C.text, fontSize: 30, fontFamily: FONTS.extrabold, marginBottom: SPACING.sm },
  subtitle: { color: C.textMuted, fontSize: 15 },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.xl,
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: C.primary,
  },
  avatarPlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: C.surface2,
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  avatarIcon: { fontSize: 36 },
  avatarHint: { color: C.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  editOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: C.primary,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.bg,
  },
  editOverlayText: { color: '#fff', fontSize: 13 },
  inputSection: { width: '100%', gap: SPACING.sm },
  label: { color: C.textMuted, fontSize: 12, fontFamily: FONTS.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: 15,
    color: C.text,
    fontSize: 18,
    fontFamily: FONTS.semibold,
  },
  hint: { color: C.textMuted, fontSize: 12 },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  finishBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: { opacity: 0.35 },
  finishBtnText: { color: '#fff', fontSize: 17, fontFamily: FONTS.bold },
  });
}
