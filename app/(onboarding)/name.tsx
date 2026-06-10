import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
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

import { FONTS, ThemeColors, ELEVATION } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { supabase } from '@/lib/supabase';
import { uploadAvatar } from '@/lib/auth';
import { showAlert } from '@/lib/alert';

export default function NameScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const {
    selectedTCGs, region, latitude, longitude, skillLevels,
    username, setUsername, avatarBase64, setAvatarBase64, avatarUri, setAvatarUri,
  } = useOnboarding();

  const [saving, setSaving]         = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Berechtigung benötigt', 'Wir brauchen Zugriff auf deine Fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
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
      if (avatarBase64) avatarUrl = await uploadAvatar(avatarBase64, userId);
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId, username: username.trim(), avatar_url: avatarUrl,
        city: region.split(',')[0]?.trim() ?? region,
        region, latitude, longitude, onboarding_complete: true,
      });
      if (profileError) throw profileError;
      if (selectedTCGs.length > 0) {
        await supabase.from('user_tcgs').delete().eq('user_id', userId);
        const { error: tcgError } = await supabase.from('user_tcgs').insert(
          selectedTCGs.map(tcg => ({ user_id: userId, tcg, skill_level: skillLevels[tcg] ?? 1 }))
        );
        if (tcgError) throw tcgError;
      }
      router.replace('/(tabs)');
    } catch (err: unknown) {
      showAlert('Fehler', (err as Error).message ?? 'Speichern fehlgeschlagen.');
    } finally { setSaving(false); }
  };

  const canFinish = !!username.trim() && !saving;

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
            <Text style={styles.step}>Schritt 4 von 4</Text>
            <Text style={styles.title}>Fast geschafft!</Text>
            <Text style={styles.subtitle}>Erstelle dein Spielerprofil</Text>
          </View>

          {/* DS Avatar — large with camera overlay */}
          <Pressable style={styles.avatarContainer} onPress={pickImage}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarHint}>Foto{'\n'}(optional)</Text>
              </View>
            )}
            <View style={styles.editOverlay}>
              <Text style={styles.editOverlayText}>+</Text>
            </View>
          </Pressable>

          {/* DS TextInput */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Dein Anzeigename</Text>
            <View style={[styles.inputWrap, inputFocused && styles.inputWrapFocused]}>
              <TextInput
                style={styles.input}
                placeholder="z.B. DerMagier"
                placeholderTextColor={C.textFaint}
                value={username}
                onChangeText={setUsername}
                maxLength={24}
                autoCorrect={false}
                autoCapitalize="none"
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
            </View>
            <Text style={styles.hint}>Wird anderen Spielern angezeigt · max. 24 Zeichen</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* DS ButtonPrimary footer */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.finishBtn,
            pressed && canFinish && styles.finishBtnPressed,
            !canFinish && styles.finishBtnDisabled,
          ]}
          onPress={finish}
          disabled={!canFinish}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.finishBtnText}>Fertig &amp; Losspielen</Text>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex:      { flex: 1 },
  content:   { padding: 16, alignItems: 'center', paddingBottom: 32 },

  header:   { width: '100%', marginBottom: 32 },
  step:     { color: C.primary, fontSize: 11, fontFamily: FONTS.semibold, letterSpacing: 0.11, marginBottom: 8 },
  title:    { color: C.text, fontSize: 22, fontFamily: FONTS.bold, letterSpacing: -0.22, marginBottom: 8 },
  subtitle: { color: C.textMuted, fontSize: 14, fontFamily: FONTS.regular },

  // DS Avatar (lg)
  avatarContainer: { position: 'relative', marginBottom: 32 },
  avatar: {
    width:        100,
    height:       100,
    borderRadius: 50,
    borderWidth:  2,
    borderColor:  C.primary,
  },
  avatarPlaceholder: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: C.surface2,
    borderWidth:     1.5,
    borderColor:     C.borderDefault,
    borderStyle:     'dashed',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
  },
  avatarHint: { color: C.textFaint, fontSize: 12, fontFamily: FONTS.semibold, textAlign: 'center' },
  editOverlay: {
    position:        'absolute',
    bottom:          2,
    right:           2,
    backgroundColor: C.primary,
    borderRadius:    12,
    width:           24,
    height:          24,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     C.bg,
  },
  editOverlayText: { color: '#fff', fontSize: 11 },

  // DS TextInput
  inputSection: { width: '100%', gap: 6 },
  label: {
    color:         C.textFaint,
    fontSize:      10,
    fontFamily:    FONTS.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
    fontSize:          16,
    fontFamily:        FONTS.semibold,
  },
  hint: { color: C.textFaint, fontSize: 11, fontFamily: FONTS.regular },

  footer: {
    padding:        16,
    paddingBottom:  32,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  finishBtn: {
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
  finishBtnPressed:  { backgroundColor: C.primaryDeep },
  finishBtnDisabled: { backgroundColor: C.surface3, shadowOpacity: 0, opacity: 0.55 },
  finishBtnText:     { color: '#fff', fontSize: 15, fontFamily: FONTS.semibold },
  });
}
