import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, SPACING } from '@/constants/theme';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } from '@/lib/auth';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const withLoading = async (fn: () => Promise<{ error: Error | null | undefined }>) => {
    setLoading(true);
    try {
      const { error } = await fn();
      if (error) Alert.alert('Fehler', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = () => {
    if (!email.trim() || !password) {
      Alert.alert('Fehler', 'Bitte E-Mail und Passwort eingeben.');
      return;
    }
    withLoading(() =>
      mode === 'signin'
        ? signInWithEmail(email.trim(), password)
        : signUpWithEmail(email.trim(), password)
    );
  };

  return (
    <View style={styles.root}>
      {/* ── Hero gradient (Luma-inspired) ── */}
      <LinearGradient
        colors={['#1E0A3C', '#120824', COLORS.bg]}
        locations={[0, 0.55, 1]}
        style={styles.heroBg}
      />

      {/* Glow orb */}
      <View style={styles.glowOrb} />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Hero section ── */}
            <View style={styles.hero}>
              <Text style={styles.logoEmoji}>🃏</Text>
              <Text style={styles.appName}>GATHER</Text>
              <Text style={styles.tagline}>Finde Mitspieler in deiner Nähe</Text>
            </View>

            {/* ── Form card ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {mode === 'signin' ? 'Willkommen zurück' : 'Konto erstellen'}
              </Text>

              <View style={styles.inputs}>
                <TextInput
                  style={styles.input}
                  placeholder="E-Mail"
                  placeholderTextColor={COLORS.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Passwort"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                />
              </View>

              {/* Primary gradient button */}
              <TouchableOpacity
                onPress={handleEmail}
                disabled={loading}
                activeOpacity={0.85}
                style={styles.primaryBtnWrap}
              >
                <LinearGradient
                  colors={loading ? [COLORS.surface3, COLORS.surface3] : ['#9333EA', '#6D28D9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {mode === 'signin' ? 'Anmelden' : 'Registrieren'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                disabled={loading}
              >
                <Text style={styles.toggleText}>
                  {mode === 'signin'
                    ? 'Noch kein Konto? Registrieren'
                    : 'Bereits registriert? Anmelden'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Divider ── */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>oder</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Social buttons ── */}
            <View style={styles.social}>
              <TouchableOpacity
                style={[styles.socialBtn, loading && styles.disabled]}
                onPress={() => withLoading(signInWithGoogle)}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.socialIcon}>🌐</Text>
                <Text style={styles.socialBtnText}>Mit Google fortfahren</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.socialBtn, loading && styles.disabled]}
                  onPress={() => withLoading(signInWithApple)}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.socialIcon}>🍎</Text>
                  <Text style={styles.socialBtnText}>Mit Apple fortfahren</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  heroBg: { ...StyleSheet.absoluteFillObject },
  glowOrb: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.06,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(124,58,237,0.18)',
    // iOS shadow as glow
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 60,
  },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: SPACING.lg, paddingTop: 0 },

  /* Hero */
  hero: {
    alignItems: 'center',
    paddingTop: SCREEN_HEIGHT * 0.07,
    paddingBottom: SPACING.xxl,
  },
  logoEmoji: { fontSize: 80, marginBottom: SPACING.sm },
  appName: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 10,
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  /* Card */
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.md,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  inputs: { gap: SPACING.sm },
  input: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
  },
  primaryBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  primaryBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  disabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  toggleText: {
    color: COLORS.primaryLight,
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: SPACING.xs,
  },

  /* Divider */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: {
    color: COLORS.textMuted,
    marginHorizontal: SPACING.md,
    fontSize: 13,
  },

  /* Social */
  social: { gap: SPACING.sm, paddingBottom: SPACING.xl },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
  },
  socialIcon: { fontSize: 18 },
  socialBtnText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
});
