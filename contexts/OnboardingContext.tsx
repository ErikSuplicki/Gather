import React, { createContext, useContext, useState } from 'react';
import { TCGId } from '@/types';

interface OnboardingState {
  selectedTCGs: TCGId[];
  region: string;
  latitude: number | null;
  longitude: number | null;
  skillLevels: Partial<Record<TCGId, number>>;
  username: string;
  avatarBase64: string | null;
  avatarUri: string | null;
}

interface OnboardingContextType extends OnboardingState {
  setSelectedTCGs: (tcgs: TCGId[]) => void;
  setRegion: (region: string) => void;
  setLocation: (lat: number, lng: number) => void;
  setSkillLevel: (tcg: TCGId, level: number) => void;
  setUsername: (name: string) => void;
  setAvatarBase64: (b64: string | null) => void;
  setAvatarUri: (uri: string | null) => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [selectedTCGs, setSelectedTCGs] = useState<TCGId[]>([]);
  const [region, setRegion] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [skillLevels, setSkillLevels] = useState<Partial<Record<TCGId, number>>>({});
  const [username, setUsername] = useState('');
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const setLocation = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const setSkillLevel = (tcg: TCGId, level: number) => {
    setSkillLevels(prev => ({ ...prev, [tcg]: level }));
  };

  return (
    <OnboardingContext.Provider
      value={{
        selectedTCGs, setSelectedTCGs,
        region, setRegion,
        latitude, longitude, setLocation,
        skillLevels, setSkillLevel,
        username, setUsername,
        avatarBase64, setAvatarBase64,
        avatarUri, setAvatarUri,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
