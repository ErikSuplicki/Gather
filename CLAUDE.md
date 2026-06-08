# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Dev Commands

Node.js is at `C:\Program Files\nodejs\` and is **not** in the shell PATH by default. Always use the full path:

```powershell
# Start web dev server (primary target for testing)
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH; & "C:\Program Files\nodejs\npx.cmd" expo start --web --port 8081

# Or run in background
Start-Process -FilePath "C:\Program Files\nodejs\npx.cmd" -ArgumentList "expo", "start", "--web", "--port", "8081" -WorkingDirectory "d:\Gather\Project_Code"
```

App runs at **http://localhost:8081** in Chrome. There is no test suite.

To test on a physical phone via Expo Go, start a second instance on a different port without `--web` (e.g. `--port 8082`) — it serves a QR code / `exp://<lan-ip>:8082` URL over the LAN. Run it in a real interactive terminal window (not piped to a log file) so the QR code renders.

## Architecture

**Expo SDK 56** + Expo Router (file-based) + TypeScript + Supabase (auth + PostgreSQL + Storage).

### Routing & Auth State Machine

`app/_layout.tsx` is the root. It holds a session state machine with three values:
- `undefined` = still loading (renders `null` / splash)
- `null` = no session → redirect to `/(auth)`
- `Session` = authenticated → check `profile.onboarding_complete`
  - `false` → redirect to `/(onboarding)/tcgs`
  - `true` → redirect to `/(tabs)`

`supabase.auth.onAuthStateChange` drives all navigation — sign-out triggers it automatically. Provider nesting is `<ThemeProvider><OnboardingProvider><Stack/></OnboardingProvider></ThemeProvider>` — theme wraps everything (incl. pre-login auth/onboarding screens), onboarding state only matters post-login.

### Route Groups

| Group | Path | Purpose |
|---|---|---|
| `(auth)` | `/` | Email/password + Google/Apple OAuth login screen |
| `(onboarding)` | `/tcgs → /region → /skill → /name` | 4-step onboarding wizard |
| `(tabs)` | `/` | Main app: Entdecken (discover) + Profil, rendered through a custom pill-shaped `CustomTabBar` (in `(tabs)/_layout.tsx`, icons from `components/icons.tsx`) |

### Onboarding Data Flow

`OnboardingContext` (in `contexts/OnboardingContext.tsx`) is provided at root layout level and carries all wizard state across the 4 screens: `selectedTCGs`, `region`, `latitude/longitude`, `skillLevels`, `username`, `avatarBase64/Uri`. On finish (`name.tsx`), data is written to Supabase and `onboarding_complete` is set to `true`.

### Theming — `ThemeContext` + `useTheme()` + `makeStyles(C)`

`contexts/ThemeContext.tsx` provides app-wide light/dark mode via `ThemeProvider`. `useTheme()` returns `{ scheme, colors, toggleScheme }`:
- `colors` is `darkColors` or `lightColors` from `constants/theme.ts` — same `ThemeColors` shape; only the neutrals (`bg`/`surface`/`text`/`border`/…) differ between palettes, while `primary` (`#7C3AED`)/`primaryLight`/`error`/`success` are shared brand constants that stay constant across themes
- `scheme` is initialized from `Appearance.getColorScheme()`, then persisted to `AsyncStorage` under key `gather:colorScheme`
- A sun/moon toggle in the Profil header calls `toggleScheme()`

**Every** styled screen/component follows this convention — never hardcode colors or import a static palette:
```tsx
const { colors: C } = useTheme();
const styles = useMemo(() => makeStyles(C), [C]);
// `function makeStyles(C: ThemeColors) { return StyleSheet.create({ ... }) }`
// is defined once below the component, building styles from `C.primary`, `C.surface`, `C.text`, etc.
```

### Supabase Schema

Four tables, all with RLS enabled (public read, owner-only write):
- `public.profiles` — one row per user, linked to `auth.users` via trigger. Key field: `onboarding_complete: boolean`.
- `public.user_tcgs` — which TCGs a user plays + skill level (1–10).
- `public.user_tcg_details` — JSONB `details` column for flexible per-TCG profile fields (MTG colors, play style, etc.).
- `public.user_decks` — imported decklists: `tcg`, `name`, `format`, `cards` (JSONB array of `DeckCard`), `card_count`.

`user_tcgs` and `user_tcg_details` are uniquely keyed by `(user_id, tcg)`, not by their `id` PK — always pass `{ onConflict: 'user_id,tcg' }` to `.upsert()`, otherwise repeat saves attempt an INSERT and fail on the unique constraint (silently, unless the error is logged).

Storage bucket `avatars` — public, files named `{userId}.jpg`, uploaded via `lib/auth.ts:uploadAvatar`.

### Deck Import & Browsing

A multi-component flow (all theme-aware via `useTheme()`/`makeStyles`) for pasting, storing, and browsing decklists:
- **`DeckImportModal`** — paste a raw decklist (optional `Commander`/`Deck`/`Sideboard`/`Maybeboard` section headers, lines like `2x Lightning Bolt`); resolves names → cards/images via a live external API (MTG → Scryfall `/cards/collection` batch lookup with `/cards/named?fuzzy=` per-card fallback; Pokémon → Pokémon TCG API search), then saves the result to `user_decks`
- **`DeckBrowserModal`** — full-screen grid of a user's decks with a format filter; opens a deck-detail view with the card grid plus, for MTG Commander/EDH decks, a power-level readout
- **`DeckTile`** — the deck grid tile shared by the browser and the profile screen (cover from the commander/first card with an image, name, format, card count)
- **`CardInfoModal`** — full-screen card-detail overlay opened by tapping a card in the deck-detail grid
- **`lib/powerLevel.ts`** — `analyzeDeckPowerLevel(deck)`: a heuristic that places MTG Commander decks into WotC's 5-tier "Commander Brackets" system (`CommanderBracket` 1–5: Zurschaustellung/Basisstufe/Aufgewertet/Optimiert/cEDH), scored against curated card lists (`GAME_CHANGERS`, `FAST_MANA`, `TUTORS`, `EXTRA_TURNS`, …). Returns `null` for non-MTG or non-Commander/EDH decks.

### Design System

- `constants/theme.ts` — `darkColors`/`lightColors`/`ThemeColors` (see Theming above), `SPACING`, `FONTS` (Inter weight tokens, e.g. `FONTS.semibold`/`FONTS.extrabold` — fonts are loaded once via `@expo-google-fonts/inter` in the root layout; never reference a raw font-family string).
- `constants/tcgs.ts` — `TCG_LIST`, `TCG_MAP`, per-TCG field schemas (`TCG_FIELDS`, field types currently `text`/`multiline`/`manaColor`/`playStyle`), plus `MTG_COLORS` and `PLAY_STYLES`. TCG colors/emoji drive UI theming throughout profile and onboarding.
- `types/index.ts` — `TCGId`, `Profile`, `UserTCG`, `UserTCGDetails`, `DeckCard`, `UserDeck`.
- `lib/alert.ts` — `showAlert(title, message?)`, the cross-platform single-button alert wrapper (native `Alert.alert`, web `window.alert`); use it instead of `Alert.alert` directly (see Web Compatibility Rules).

### `components/CardPicker.tsx` — implemented but currently unwired

A full-screen live card-search modal exists (Scryfall search/autocomplete for MTG, Pokémon TCG API for Pokémon, typeahead, long-press-to-zoom, multi-select up to `maxCards`), but **no `TCG_FIELDS` entry references it** — there's no `cardPicker` field type in any TCG's field list, so it isn't imported or rendered anywhere. It's available-but-orphaned rather than dead code: re-wiring it means adding a `cardPicker` field type to the relevant `TCG_FIELDS` entries and JSON-stringifying its `SelectedCard[]` output into the `details` JSONB column on save (and parsing it back defensively — handle both string and pre-parsed array forms — when reading).

### Web Compatibility Rules

- Never use `Alert.alert` with multi-button arrays on web — it maps to `window.confirm` and callbacks don't fire. Use `lib/alert.ts:showAlert()` (single-button) or call handlers directly.
- Never use conditional rendering like `{someString && <View>}` — if `someString` is `""`, React Native Web renders a text node inside a View and crashes. Always coerce to boolean: `{!!someString && <View>}`.
- `expo-location`'s `reverseGeocodeAsync` does not work on web — use the Nominatim API (`nominatim.openstreetmap.org`) for geocoding instead.
- Modals must use `animationType={Platform.OS === 'web' ? 'fade' : 'slide'}` — on web, the native `slide` dismissal animation can leave the overlay capturing touches and block elements underneath after close.

### Environment

`.env.local` (gitignored) must contain:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```
