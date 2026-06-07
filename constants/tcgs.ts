import { TCGId, TCGInfo } from '@/types';

export const TCG_LIST: TCGInfo[] = [
  { id: 'mtg',      name: 'Magic: The Gathering', color: '#C8A84B', emoji: '⚔️' },
  { id: 'pokemon',  name: 'Pokémon',              color: '#FFCB05', emoji: '⚡' },
  { id: 'yugioh',   name: 'Yu-Gi-Oh!',            color: '#A855F7', emoji: '👁️' },
  { id: 'starwars', name: 'Star Wars',             color: '#60A5FA', emoji: '⭐' },
  { id: 'lorcana',  name: 'Disney Lorcana',        color: '#38BDF8', emoji: '✨' },
];

export const TCG_MAP = Object.fromEntries(
  TCG_LIST.map(t => [t.id, t])
) as Record<TCGId, TCGInfo>;

export const MTG_COLORS = [
  { id: 'white',     label: 'Weiß',    symbol: '☀️' },
  { id: 'blue',      label: 'Blau',    symbol: '💧' },
  { id: 'black',     label: 'Schwarz', symbol: '💀' },
  { id: 'red',       label: 'Rot',     symbol: '🔥' },
  { id: 'green',     label: 'Grün',    symbol: '🌲' },
  { id: 'colorless', label: 'Farblos', symbol: '💎' },
] as const;

export const PLAY_STYLES = [
  { id: 'casual',     label: 'Casual'  },
  { id: 'tournament', label: 'Turnier' },
  { id: 'both',       label: 'Beides'  },
] as const;

export const TCG_FIELDS: Record<TCGId, Array<{ key: string; label: string; type: string }>> = {
  mtg: [
    { key: 'favorite_color', label: 'Lieblingsfarbe',      type: 'manaColor'  },
    { key: 'favorite_card',  label: 'Lieblingskarte',       type: 'cardPicker' },
    { key: 'playing_since',  label: 'Dabei seit (Jahr)',    type: 'text'       },
    { key: 'play_style',     label: 'Spielstil',            type: 'playStyle'  },
    { key: 'bio',            label: 'Über mich',            type: 'multiline'  },
  ],
  pokemon: [
    { key: 'favorite_type', label: 'Lieblingstyp',         type: 'text'       },
    { key: 'favorite_card', label: 'Lieblingskarte',        type: 'cardPicker' },
    { key: 'playing_since', label: 'Dabei seit (Jahr)',     type: 'text'       },
    { key: 'play_style',    label: 'Spielstil',             type: 'playStyle'  },
    { key: 'bio',           label: 'Über mich',             type: 'multiline'  },
  ],
  yugioh: [
    { key: 'favorite_archetype', label: 'Lieblingsarchetyp', type: 'text'     },
    { key: 'favorite_card',      label: 'Lieblingskarte',     type: 'text'     },
    { key: 'playing_since',      label: 'Dabei seit (Jahr)',  type: 'text'     },
    { key: 'play_style',         label: 'Spielstil',          type: 'playStyle'},
    { key: 'bio',                label: 'Über mich',          type: 'multiline'},
  ],
  starwars: [
    { key: 'faction',       label: 'Fraktion',              type: 'text'       },
    { key: 'favorite_card', label: 'Lieblingskarte',         type: 'text'       },
    { key: 'playing_since', label: 'Dabei seit (Jahr)',      type: 'text'       },
    { key: 'play_style',    label: 'Spielstil',              type: 'playStyle'  },
    { key: 'bio',           label: 'Über mich',              type: 'multiline'  },
  ],
  lorcana: [
    { key: 'faction',       label: 'Fraktion / Tintenfarbe', type: 'text'      },
    { key: 'favorite_card', label: 'Lieblingskarte',          type: 'text'      },
    { key: 'playing_since', label: 'Dabei seit (Jahr)',       type: 'text'      },
    { key: 'play_style',    label: 'Spielstil',               type: 'playStyle' },
    { key: 'bio',           label: 'Über mich',               type: 'multiline' },
  ],
};
