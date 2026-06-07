export type TCGId = 'mtg' | 'pokemon' | 'yugioh' | 'starwars' | 'lorcana';

export interface TCGInfo {
  id: TCGId;
  name: string;
  color: string;
  emoji: string;
}

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  onboarding_complete: boolean;
  created_at: string;
}

export interface UserTCG {
  id: string;
  user_id: string;
  tcg: TCGId;
  skill_level: number;
}

export interface UserTCGDetails {
  id: string;
  user_id: string;
  tcg: TCGId;
  details: Record<string, string>;
}
