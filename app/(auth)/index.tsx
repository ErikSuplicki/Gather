import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONTS, SPACING, ThemeColors, ELEVATION } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } from '@/lib/auth';
import { showAlert } from '@/lib/alert';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [mode, setMode]       = useState<Mode>('signin');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused]       = useState(false);

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
      {/* Deep-blue glow orb — DS-aligned (brand glow, not purple) */}
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
            {/* Hero */}
            <View style={styles.hero}>
              <Image
                source={require('../../assets/images/Logo_NoBorder.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.appName}>GATHER</Text>
              <Text style={styles.tagline}>Finde Mitspieler in deiner Nähe</Text>
            </View>

            {/* DS Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {mode === 'signin' ? 'Willkommen zurück' : 'Konto erstellen'}
              </Text>

              <View style={styles.inputs}>
                <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocused]}>
                  <TextInput
                    style={styles.input}
                    placeholder="E-Mail"
                    placeholderTextColor={C.textFaint}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
                <View style={[styles.inputWrap, pwFocused && styles.inputWrapFocused]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Passwort"
                    placeholderTextColor={C.textFaint}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={!loading}
                    onFocus={() => setPwFocused(true)}
                    onBlur={() => setPwFocused(false)}
                  />
                </View>
              </View>

              {/* DS ButtonPrimary (lg) */}
              <Pressable
                onPress={handleEmail}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.primaryBtnPressed,
                  loading && styles.primaryBtnDisabled,
                ]}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>
                      {mode === 'signin' ? 'Anmelden' : 'Registrieren'}
                    </Text>
                }
              </Pressable>

              <Pressable
                onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                disabled={loading}
              >
                <Text style={styles.toggleText}>
                  {mode === 'signin'
                    ? 'Noch kein Konto? Registrieren'
                    : 'Bereits registriert? Anmelden'}
                </Text>
              </Pressable>
            </View>

            {/* DS Divider (labeled) */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>oder</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* DS ButtonSecondary social buttons */}
            <View style={styles.social}>
              <Pressable
                style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed, loading && styles.disabled]}
                onPress={() => withLoading(signInWithGoogle)}
                disabled={loading}
              >
                <Text style={styles.socialIcon}>🌐</Text>
                <Text style={styles.socialBtnText}>Mit Google fortfahren</Text>
              </Pressable>

              {Platform.OS === 'ios' && (
                <Pressable
                  style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed, loading && styles.disabled]}
                  onPress={() => withLoading(signInWithApple)}
                  disabled={loading}
                >
                  <Text style={styles.socialIcon}>🍎</Text>
                  <Text style={styles.socialBtnText}>Mit Apple fortfahren</Text>
                </Pressable>
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

  // Brand glow orb — blue, subtler than the old purple
  glowOrb: {
    position:      'absolute',
    top:           SCREEN_HEIGHT * 0.02,
    alignSelf:     'center',
    width:         240,
    height:        240,
    borderRadius:  120,
    backgroundColor: 'transparent',
    shadowColor:   '#168BFF',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius:  80,
  },

  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: SPACING.xl },

  /* Hero */
  hero: {
    alignItems:  'center',
    paddingTop:  SCREEN_HEIGHT * 0.06,
    paddingBottom: 40,
    gap:         16,
  },
  logoImage: {
    width:  96,
    height: 96,
  },
  appName: {
    fontSize:      28,
    fontFamily:    FONTS.bold,
    color:         C.text,
    letterSpacing: 8,
  },
  tagline: {
    fontSize:   14,
    fontFamily: FONTS.regular,
    color:      C.textMuted,
    textAlign:  'center',
    letterSpacing: 0,
  },

  /* DS Card */
  card: {
    backgroundColor: C.surface,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         16,
    gap:             12,
    ...ELEVATION.panel,
  },
  cardTitle: {
    color:         C.text,
    fontSize:      18,
    fontFamily:    FONTS.semibold,
    letterSpacing: -0.18,
  },
  inputs: { gap: 8 },

  // DS TextInput
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
    fontFamily:        FONTS.regular,
    fontSize:          14,
  },

  // DS ButtonPrimary (lg)
  primaryBtn: {
    height:            48,
    backgroundColor:   C.primary,
    paddingHorizontal: 24,
    borderRadius:      12,
    alignItems:        'center',
    justifyContent:    'center',
    shadowColor:       C.primary,
    shadowOffset:      { width: 0, height: 0 },
    shadowOpacity:     0.35,
    shadowRadius:      8,
  },
  primaryBtnPressed:  { backgroundColor: C.primaryDeep },
  primaryBtnDisabled: { opacity: 0.38 },
  primaryBtnText: {
    color:       '#FFFFFF',
    fontFamily:  FONTS.semibold,
    fontSize:    15,
    letterSpacing: 0,
  },

  toggleText: {
    color:      C.primaryBright,
    textAlign:  'center',
    fontSize:   14,
    fontFamily: FONTS.medium,
  },

  /* DS Divider (labeled) */
  divider: {
    flexDirection: 'row',
    alignItems:    'center',
    marginVertical: 16,
  },
  dividerLine:  { flex: 1, height: 1, backgroundColor: C.border },
  dividerLabel: {
    color:           C.textFaint,
    marginHorizontal: 12,
    fontSize:         11,
    fontFamily:       FONTS.semibold,
    letterSpacing:    0.11,
  },

  /* DS ButtonSecondary social */
  social: { gap: 8 },
  socialBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    height:            48,
    backgroundColor:   C.surface3,
    borderWidth:       1,
    borderColor:       C.borderDefault,
    borderRadius:      12,
  },
  socialBtnPressed: { backgroundColor: C.surfacePressed, borderColor: C.borderStrong },
  socialIcon:    { fontSize: 18 },
  socialBtnText: { color: C.text, fontSize: 14, fontFamily: FONTS.semibold },
  disabled:      { opacity: 0.38 },
  });
}
