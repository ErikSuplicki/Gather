import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithGoogle() {
  const redirectUri = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUri, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return { error: error ?? new Error('Keine URL erhalten') };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type === 'success') {
    const url = new URL(result.url);
    const params = new URLSearchParams(url.hash.replace('#', ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return { error: sessionError };
    }
  }

  return { error: null };
}

export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    return { error: new Error('Apple Sign In ist nur auf iOS verfügbar') };
  }

  try {
    const Apple = await import('expo-apple-authentication');
    const credential = await Apple.signInAsync({
      requestedScopes: [
        Apple.AppleAuthenticationScope.FULL_NAME,
        Apple.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { error: new Error('Kein Identity Token erhalten') };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    return { error };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      return { error: null };
    }
    return { error: err as Error };
  }
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function uploadAvatar(base64: string, userId: string): Promise<string> {
  const fileName = `${userId}.jpg`;
  const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  const { error } = await supabase.storage
    .from('avatars')
    .upload(fileName, byteArray, { upsert: true, contentType: 'image/jpeg' });

  if (error) throw error;

  return supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
}
