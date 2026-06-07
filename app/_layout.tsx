import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';
import { OnboardingProvider } from '@/contexts/OnboardingContext';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // undefined = still loading, null = no session, Session = authenticated
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // undefined = still loading, null = no profile, Profile = loaded
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfile(data ?? null);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const authReady = session !== undefined && profile !== undefined;

  useEffect(() => {
    if (!loaded || !authReady) return;
    SplashScreen.hideAsync();

    if (!session) {
      router.replace('/(auth)');
    } else if (!profile?.onboarding_complete) {
      router.replace('/(onboarding)/tcgs');
    } else {
      router.replace('/(tabs)');
    }
  }, [loaded, authReady, session, profile]);

  if (!loaded || !authReady) return null;

  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </OnboardingProvider>
  );
}
