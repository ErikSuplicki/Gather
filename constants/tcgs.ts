import { TCGId, TCGInfo } from '@/types';

export const TCG_LIST: TCGInfo[] = [
  { id: 'mtg',      name: 'Magic: The Gathering', color: '#C8A84B', abbr: 'MTG' },
  { id: 'pokemon',  name: 'Pokémon',              color: '#FFCB05', abbr: 'PKM' },
  { id: 'yugioh',   name: 'Yu-Gi-Oh!',            color: '#A855F7', abbr: 'YGO' },
  { id: 'starwars', name: 'Star Wars',             color: '#60A5FA', abbr: 'SW'  },
  { id: 'lorcana',  name: 'Disney Lorcana',        color: '#38BDF8', abbr: 'LOR' },
];

export const TCG_MAP = Object.fromEntries(
  TCG_LIST.map(t => [t.id, t])
) as Record<TCGId, TCGInfo>;

export const MTG_COLORS = [
  { id: 'white',     label: 'Weiß',    symbol: 'W' },
  { id: 'blue',      label: 'Blau',    symbol: 'U' },
  { id: 'black',     label: 'Schwarz', symbol: 'B' },
  { id: 'red',       label: 'Rot',     symbol: 'R' },
  { id: 'green',     label: 'Grün',    symbol: 'G' },
  { id: 'colorless', label: 'Farblos', symbol: 'C' },
] as const;

export const PLAY_STYLES = [
  { id: 'casual',     label: 'Casual'  },
  { id: 'tournament', label: 'Turnier' },
  { id: 'both',       label: 'Beides'  },
] as const;

export const TCG_FIELDS: Record<TCGId, Array<{ key: string; label: string; type: string }>> = {
  mtg: [
    { key: 'favorite_color', label: 'Lieblingsfarbe',      type: 'manaColor'  },
    { key: 'playing_since',  label: 'Dabei seit (Jahr)',    type: 'text'       },
    { key: 'play_style',     label: 'Spielstil',            type: 'playStyle'  },
    { key: 'bio',            label: 'Über mich',            type: 'multiline'  },
  ],
  pokemon: [
    { key: 'favorite_type', label: 'Lieblingstyp',         type: 'text'       },
    { key: 'playing_since', label: 'Dabei seit (Jahr)',     type: 'text'       },
    { key: 'play_style',    label: 'Spielstil',             type: 'playStyle'  },
    { key: 'bio',           label: 'Über mich',             type: 'multiline'  },
  ],
  yugioh: [
    { key: 'favorite_archetype', label: 'Lieblingsarchetyp', type: 'text'     },
    { key: 'playing_since',      label: 'Dabei seit (Jahr)',  type: 'text'     },
    { key: 'play_style',         label: 'Spielstil',          type: 'playStyle'},
    { key: 'bio',                label: 'Über mich',          type: 'multiline'},
  ],
  starwars: [
    { key: 'faction',       label: 'Fraktion',              type: 'text'       },
    { key: 'playing_since', label: 'Dabei seit (Jahr)',      type: 'text'       },
    { key: 'play_style',    label: 'Spielstil',              type: 'playStyle'  },
    { key: 'bio',           label: 'Über mich',              type: 'multiline'  },
  ],
  lorcana: [
    { key: 'faction',       label: 'Fraktion / Tintenfarbe', type: 'text'      },
    { key: 'playing_since', label: 'Dabei seit (Jahr)',       type: 'text'      },
    { key: 'play_style',    label: 'Spielstil',               type: 'playStyle' },
    { key: 'bio',           label: 'Über mich',               type: 'multiline' },
  ],
};
