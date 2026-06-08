import React, { useMemo, useState } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { FONTS, SPACING, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } from '@/lib/auth';
import { showAlert } from '@/lib/alert';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const withLoading = async (fn: () => Promise<{ error: Error | null | undefined }>) => {
    setLoading(true);
    try {
      const { error } = await fn();
      if (error) showAlert('Fehler', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = () => {
    if (!email.trim() || !password) {
      showAlert('Fehler', 'Bitte E-Mail und Passwort eingeben.');
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
        colors={['#1E0A3C', '#120824', C.bg]}
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
                  placeholderTextColor={C.textMuted}
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
                  placeholderTextColor={C.textMuted}
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
                  colors={loading ? [C.surface3, C.surface3] : ['#9333EA', '#6D28D9']}
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

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  heroBg: { ...StyleSheet.absoluteFill },
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
    fontFamily: FONTS.black,
    color: C.text,
    letterSpacing: 10,
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: C.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  /* Card */
  card: {
    backgroundColor: C.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
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
    color: C.text,
    fontSize: 20,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.xs,
  },
  inputs: { gap: SPACING.sm },
  input: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    color: C.text,
    fontFamily: FONTS.regular,
    fontSize: 16,
  },
  primaryBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  primaryBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  disabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: FONTS.bold, letterSpacing: 0.3 },
  toggleText: {
    color: C.primaryLight,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: FONTS.medium,
    paddingVertical: SPACING.xs,
  },

  /* Divider */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: {
    color: C.textMuted,
    marginHorizontal: SPACING.md,
    fontSize: 13,
    fontFamily: FONTS.medium,
  },

  /* Social */
  social: { gap: SPACING.sm, paddingBottom: SPACING.xl },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 14,
  },
  socialIcon: { fontSize: 18 },
  socialBtnText: { color: C.text, fontSize: 15, fontFamily: FONTS.semibold },
  });
}
