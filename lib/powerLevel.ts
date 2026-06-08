import { DeckCard, TCGId } from '@/types';

// ─── Commander Brackets (WotC "Commander Brackets Beta") ─────────────────────
// 5-tier system the official, German-localized announcement describes as:
// 1 Zurschaustellung (Exhibition) · 2 Basisstufe (Core) · 3 Aufgewertet (Upgraded)
// · 4 Optimiert (Optimized) · 5 cEDH.
// Source: https://magic.wizards.com/de/news/announcements/introducing-commander-brackets-beta
export type CommanderBracket = 1 | 2 | 3 | 4 | 5;

export const BRACKET_LABELS: Record<CommanderBracket, string> = {
  1: 'Zurschaustellung',
  2: 'Basisstufe',
  3: 'Aufgewertet',
  4: 'Optimiert',
  5: 'cEDH',
};

export const BRACKET_COLORS: Record<CommanderBracket, string> = {
  1: '#3FB97D',
  2: '#5FA8E0',
  3: '#E0A53D',
  4: '#E0793D',
  5: '#C2407A',
};

export interface DeckPowerLevel {
  /** Floor implied purely by WotC's hard "not allowed below bracket X" requirements. */
  minBracket: CommanderBracket;
  /** minBracket, bumped upward when overall deck power outpaces what the bare minimums show. */
  recommendedBracket: CommanderBracket;
  /** Rough community-scale equivalent (1-10), per the r/EDH "Visual Guide to Power Levels" framing. */
  estimate: number;
  /** Why minBracket sits where it does — each tied to one of WotC's stated hard requirements. */
  requirementReasons: string[];
  /** Why recommendedBracket was raised above minBracket (empty when they're equal). */
  scoreReasons: string[];
}

// "Game Changers" — WotC's official curated list of cards that aren't allowed below
// Bracket 3 (max. three) and are unrestricted from Bracket 4 on. Combined from the
// Beta announcement and subsequent list updates, since WotC revises it periodically —
// a slightly broader net only makes the heuristic more conservative.
const GAME_CHANGERS = [
  'Ad Nauseam', 'Ancient Tomb', 'Aura Shards', "Bolas's Citadel", 'Braids, Cabal Minion',
  'Chrome Mox', 'Coalition Victory', 'Consecrated Sphinx', 'Crop Rotation', 'Cyclonic Rift',
  'Demonic Tutor', 'Drannith Magistrate', 'Enlightened Tutor', 'Expropriate', 'Field of the Dead',
  'Fierce Guardianship', 'Force of Will', "Gaea's Cradle", 'Gamble', 'Gifts Ungiven',
  'Glacial Chasm', 'Grand Arbiter Augustin IV', 'Grim Monolith', 'Humility', 'Imperial Seal',
  'Intuition', "Jeska's Will", 'Jin-Gitaxias, Core Augur', 'Kinnan, Bonder Prodigy',
  "Lion's Eye Diamond", 'Mana Vault', "Mishra's Workshop", 'Mox Diamond', 'Mystical Tutor',
  'Narset, Parter of Veils', 'Natural Order', 'Necropotence', 'Notion Thief', 'Opposition Agent',
  'Orcish Bowmasters', 'Panoptic Mirror', 'Rhystic Study', 'Seedborn Muse', "Serra's Sanctum",
  'Smothering Tithe', 'Survival of the Fittest', "Teferi's Protection", 'Tergrid, God of Fright',
  "Thassa's Oracle", 'The One Ring', 'The Tabernacle at Pendrell Vale', 'Trinisphere',
  'Underworld Breach', 'Urza, Lord High Artificer', 'Vampiric Tutor', 'Vorinclex, Voice of Hunger',
  'Winota, Joiner of Forces', 'Worldly Tutor', "Yuriko, the Tiger's Shadow",
];

// Cheap acceleration that enables explosive, low-turn starts (beyond the rocks
// already covered by the Game Changers list).
const FAST_MANA = [
  'Sol Ring', 'Mana Crypt', 'Lotus Petal', 'Black Lotus', 'Mox Opal', 'Jeweled Lotus',
  'Dark Ritual', 'Cabal Ritual', 'Seething Song', 'Songs of the Damned', 'Culling the Weak',
  'Pyretic Ritual', 'Mana Geyser',
];

// Library-search effects that trade a card for exactly the piece a deck needs —
// the consistency signal the bracket guide calls out at every tier.
const TUTORS = [
  'Diabolic Tutor', 'Diabolic Intent', 'Idyllic Tutor', 'Wishclaw Talisman', "Eladamri's Call",
  'Final Parting', 'Long-Term Plans', 'Personal Tutor', 'Tooth and Nail', 'Trophy Mage',
  'Fabricate', 'Eldritch Evolution', 'Birthing Pod',
];

// Broad "take an extra turn" pool — used to gauge density. WotC bars Bracket 2/3 from
// "chaining" extra turns; edhpowerlevel.com operationalizes that as "no more than ~2-3
// such cards" plus a hard list of the most repeatable offenders (see CHAINING_EXTRA_TURNS).
const EXTRA_TURNS = [
  'Time Warp', 'Temporal Manipulation', 'Capture of Jingzhou', 'Walk the Aeons', 'Time Stretch',
  'Nexus of Fate', 'Temporal Mastery', 'Beacon of Tomorrows', 'Final Fortune', 'Last Chance',
  'Expropriate', 'Timestream Navigator', 'Sage of Hours', 'Lighthouse Chronologist',
  'Time Sieve', 'Magosi, the Waterveil',
];

// The specific extra-turn cards that are trivial to reuse / chain — WotC-adjacent
// guidance treats these as simply "not allowed below Bracket 4" regardless of count.
const CHAINING_EXTRA_TURNS = [
  'Time Warp', 'Temporal Manipulation', 'Walk the Aeons', 'Capture of Jingzhou', 'Expropriate',
  'Time Stretch', 'Nexus of Fate', 'Timestream Navigator', 'Sage of Hours',
  'Lighthouse Chronologist', 'Time Sieve', 'Magosi, the Waterveil',
];

// Mass Land Denial — WotC describes this as cards that "regularly destroy, exile, or
// bounce other lands, keep lands tapped, or change what mana four-or-more lands per
// player produce, without replacing them." Curated list combines well-known classics
// with the dedicated MLD pool edhpowerlevel.com tracks for effects that are easy to
// miss via text search alone.
const MASS_LAND_DENIAL = [
  'Armageddon', 'Ravages of War', 'Catastrophe', 'Jokulhaups', 'Decree of Annihilation',
  'Obliterate', 'Wildfire', 'Burning of Xinye', 'Impending Disaster', 'Cataclysm', 'Sunder',
  'Hall of Gemstone', 'Contamination', 'Dimensional Breach', 'Epicenter', 'Global Ruin',
  'Hokori, Dust Drinker', "Razia's Purification", 'Rising Waters', 'Soulscour', 'Apocalypse',
  'Bearer of the Heavens', 'Conversion', 'Glaciers', 'Pox', 'Death Cloud', 'Tangle Wire',
  'Restore Balance', 'Realm Razer', 'Spreading Algae', 'Numot, the Devastator', 'Kudzu',
  'Demonic Hordes', "Urza's Sylex", 'Infernal Darkness', 'Worldfire', 'Worldslayer',
  'Gilt-Leaf Archdruid', 'Worldpurge', 'Stasis',
];

// Resource-denial / "stax" pieces — a hallmark of Optimized and cEDH metas.
const STAX = [
  'Winter Orb', 'Static Orb', 'Smokestack', 'Sphere of Resistance',
  'Thalia, Guardian of Thraben', 'Archon of Emeria', 'Lodestone Golem', 'Collector Ouphe',
];

// Well-known two-card combo enablers/finishers. We don't try to match exact pairs
// (too many valid combinations, and Commander Spellbook's full combo+cost database
// isn't available client-side) — finding two or more from this pool is itself a
// strong signal of an early, deliberate combo plan, which is what WotC's "no
// early-game two-card combos" rule is actually trying to flag.
const COMBO_PIECES = [
  'Demonic Consultation', 'Tainted Pact', 'Isochron Scepter', 'Dramatic Reversal',
  'Kiki-Jiki, Mirror Breaker', 'Restoration Angel', 'Splinter Twin', 'Pestermite',
  'Deceiver Exarch', 'Sharuum the Hegemon', 'Sword of the Meek', 'Krark-Clan Ironworks',
  'Scrap Trawler', 'Hermit Druid', 'Walking Ballista', 'Heliod, Sun-Crowned', 'Devoted Druid',
  'Vizier of Remedies', 'Earthcraft', 'Squirrel Nest', 'Food Chain', 'Eternal Scourge',
  'Worldgorger Dragon', 'Animate Dead',
];

function matchNames(deckNames: Set<string>, list: string[]): string[] {
  return list.filter(n => deckNames.has(n.toLowerCase()));
}

const ESTIMATE_RANGE: Record<CommanderBracket, [number, number]> = {
  1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9, 10],
};

/**
 * Rule-based Commander power-level estimate, modeled on how edhpowerlevel.com bridges
 * WotC's "Commander Brackets" with a continuous power score: a **minimum bracket**
 * derived purely from WotC's stated hard requirements (Game Changers, Mass Land
 * Denial, extra-turn chaining, early two-card combos), and a **recommended bracket**
 * that can sit higher when the deck's overall power signals (fast mana, tutors, stax,
 * combo density…) outpace what the bare minimums show — exactly the "decks which
 * dodge the requirements but perform at a high level" gap edhpowerlevel calls out.
 * The recommended bracket is never lower than the minimum.
 *
 * Deliberately deterministic & explainable rather than AI-driven: every signal maps
 * to a named card group, so the "why" shown to the user is never a guess about a
 * guess. Only scoped to MTG Commander/EDH — brackets aren't a thing elsewhere.
 */
export function analyzeDeckPowerLevel(deck: { tcg: TCGId; format: string | null; cards: DeckCard[] }): DeckPowerLevel | null {
  if (deck.tcg !== 'mtg') return null;
  if (!/commander|edh/i.test(deck.format ?? '')) return null;
  if (deck.cards.length === 0) return null;

  const names = new Set(deck.cards.filter(c => !c.isSideboard).map(c => c.name.toLowerCase()));

  const gameChangers = matchNames(names, GAME_CHANGERS);
  const combos = matchNames(names, COMBO_PIECES);
  const massLandDenial = matchNames(names, MASS_LAND_DENIAL);
  const extraTurns = matchNames(names, EXTRA_TURNS);
  const chainingExtraTurns = matchNames(names, CHAINING_EXTRA_TURNS);
  const fastMana = matchNames(names, FAST_MANA);
  const tutors = matchNames(names, TUTORS);
  const stax = matchNames(names, STAX);

  // ── Minimum bracket: purely the hard "not allowed below X" rules WotC states ──
  // Baseline floor: a deck that contains zero recognizable staples/power signals
  // across every tracked category reads as built around a theme rather than
  // optimization — the hallmark of Bracket 1 (Zurschaustellung/Exhibition). The
  // moment even one staple shows up, it's read as at least Bracket 2 (Basisstufe,
  // the "average precon" baseline WotC describes).
  const totalSignalCount = gameChangers.length + combos.length + massLandDenial.length
    + extraTurns.length + fastMana.length + tutors.length + stax.length;
  let minBracket: CommanderBracket = totalSignalCount === 0 ? 1 : 2;
  const requirementReasons: string[] = [];

  if (gameChangers.length >= 4) {
    minBracket = Math.max(minBracket, 4) as CommanderBracket;
    requirementReasons.push(
      `${gameChangers.length} Game Changer (mehr als die in Bracket 3 erlaubten 3): ${gameChangers.slice(0, 3).join(', ')} u. a. → mindestens Bracket 4`
    );
  } else if (gameChangers.length >= 1) {
    minBracket = Math.max(minBracket, 3) as CommanderBracket;
    requirementReasons.push(
      `${gameChangers.length} Game Changer laut WotC-Liste: ${gameChangers.join(', ')} → mindestens Bracket 3`
    );
  }

  if (massLandDenial.length > 0) {
    minBracket = Math.max(minBracket, 4) as CommanderBracket;
    requirementReasons.push(`Mass Land Denial (unterhalb Bracket 4 nicht erlaubt): ${massLandDenial.join(', ')}`);
  }

  if (chainingExtraTurns.length > 0) {
    minBracket = Math.max(minBracket, 4) as CommanderBracket;
    requirementReasons.push(`Wiederholbare Extrazug-Karten (unterhalb Bracket 4 nicht erlaubt): ${chainingExtraTurns.join(', ')}`);
  } else if (extraTurns.length > 3) {
    minBracket = Math.max(minBracket, 4) as CommanderBracket;
    requirementReasons.push(`${extraTurns.length} Extrazug-Karten — Dichte spricht laut Bracket-Richtlinie für „Chaining" (mindestens Bracket 4): ${extraTurns.slice(0, 3).join(', ')}`);
  } else if (extraTurns.length > 2) {
    minBracket = Math.max(minBracket, 3) as CommanderBracket;
    requirementReasons.push(`${extraTurns.length} Extrazug-Karten — mehr als die in Bracket 2 üblichen, vereinzelten Exemplare (mindestens Bracket 3): ${extraTurns.join(', ')}`);
  }

  if (combos.length >= 2) {
    minBracket = Math.max(minBracket, 4) as CommanderBracket;
    requirementReasons.push(`Mögliches frühes 2-Karten-Combo-Paar erkannt (unterhalb Bracket 4 nicht erlaubt): ${combos.slice(0, 3).join(', ')}`);
  }

  if (requirementReasons.length === 0) {
    if (minBracket === 1) {
      requirementReasons.push(
        'Keine bekannten Power-Karten oder Staples in der Liste gefunden — die Kartenauswahl wirkt eher auf ein Thema/Erlebnis statt auf Optimierung ausgelegt, das Kennzeichen von Bracket 1 (Zurschaustellung). Ob das Deck dort oder bei Bracket 2 (Basisstufe, „durchschnittliches, unverändertes Precon-Niveau") landet, hängt vom Deckkonzept ab — das lässt sich aus der Kartenliste allein nicht zweifelsfrei ablesen.'
      );
    } else {
      requirementReasons.push('Keine der harten Bracket-Anforderungen (Game Changer, Mass Land Denial, Extrazug-Ketten, frühe 2-Karten-Combos) ausgelöst → mindestens Bracket 2 (Basisstufe).');
    }
  }

  // ── Recommended bracket: minBracket, bumped up by overall power-score signals ──
  // (mirrors edhpowerlevel.com's "recommended ≥ minimum, informed by Power Score")
  const weight = gameChangers.length * 2.5 + combos.length * 2 + massLandDenial.length * 3
    + extraTurns.length + fastMana.length * 0.75 + tutors.length * 0.5 + stax.length * 0.75;

  let scoreBracket: CommanderBracket = 2;
  if (weight >= 14) scoreBracket = 5;
  else if (weight >= 8) scoreBracket = 4;
  else if (weight >= 4) scoreBracket = 3;
  else if (weight === 0) scoreBracket = 1;

  const recommendedBracket = Math.max(minBracket, scoreBracket) as CommanderBracket;

  const scoreReasons: string[] = [];
  if (recommendedBracket > minBracket) {
    const contributors: string[] = [];
    if (fastMana.length > 0) contributors.push(`${fastMana.length}× schnelle Manabeschleunigung (${fastMana.slice(0, 2).join(', ')})`);
    if (tutors.length > 0) contributors.push(`${tutors.length}× zusätzliche Tutoren`);
    if (stax.length > 0) contributors.push(`${stax.length}× Stax-/Ressourcenkontrolle (${stax.slice(0, 2).join(', ')})`);
    if (extraTurns.length > 0 && chainingExtraTurns.length === 0) contributors.push(`${extraTurns.length}× Extrazug-Karten`);
    if (combos.length === 1) contributors.push(`1 mögliches Combo-Stück (${combos[0]})`);
    scoreReasons.push(
      `Die Summe der Power-Signale${contributors.length > 0 ? ` — ${contributors.join(', ')}` : ''} liegt über dem, was die Mindestanforderungen allein zeigen → Empfehlung: Bracket ${recommendedBracket} (${BRACKET_LABELS[recommendedBracket]}) statt nur Bracket ${minBracket}.`
    );
  }

  const [lo, hi] = ESTIMATE_RANGE[recommendedBracket];
  const estimate = weight >= (recommendedBracket * 2.5) ? hi : lo;

  return { minBracket, recommendedBracket, estimate, requirementReasons, scoreReasons };
}
