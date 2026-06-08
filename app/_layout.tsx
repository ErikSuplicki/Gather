import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import {
  useFonts as useGoogleFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [interLoaded, interError] = useGoogleFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  // undefined = still loading, null = no session, Session = authenticated
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // undefined = still loading, null = no profile, Profile = loaded
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    if (fontError) throw fontError;
    if (interError) throw interError;
  }, [fontError, interError]);

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
    if (!loaded || !interLoaded || !authReady) return;
    SplashScreen.hideAsync();

    if (!session) {
      router.replace('/(auth)');
    } else if (!profile?.onboarding_complete) {
      router.replace('/(onboarding)/tcgs');
    } else {
      router.replace('/(tabs)');
    }
  }, [loaded, authReady, session, profile]);

  if (!loaded || !interLoaded || !authReady) return null;

  return (
    <ThemeProvider>
      <OnboardingProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </OnboardingProvider>
    </ThemeProvider>
  );
}
