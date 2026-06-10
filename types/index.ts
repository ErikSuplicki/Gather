export type TCGId = 'mtg' | 'pokemon' | 'yugioh' | 'starwars' | 'lorcana';

export interface TCGInfo {
  id: TCGId;
  name: string;
  color: string;
  abbr: string;
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

export interface DeckCard {
  name: string;
  quantity: number;
  image: string | null;
  id?: string;
  isCommander?: boolean;
  isSideboard?: boolean;
  /** MTG color identity (WUBRG letters, e.g. ['W','U']; [] = colorless) — from Scryfall's `color_identity`. */
  colorIdentity?: string[];
}

export interface UserDeck {
  id: string;
  user_id: string;
  tcg: TCGId;
  name: string;
  format: string | null;
  cards: DeckCard[];
  card_count: number;
  created_at: string;
  bracket: number | null;
}
