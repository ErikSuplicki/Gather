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

`supabase.auth.onAuthStateChange` drives all navigation — sign-out triggers it automatically. Provider nesting is `<ThemeProvider><OnboardingProvider><Stack/></OnboardingProvider></ThemeProvider>`.

### Route Groups

| Route | Purpose |
|---|---|
| `(auth)` | Email/password login screen |
| `(onboarding)/tcgs → /region → /skill → /name` | 4-step onboarding wizard |
| `(tabs)` | Main app: Entdecken + Profil tabs, custom pill `CustomTabBar` in `(tabs)/_layout.tsx` |
| `profile/[id]` | Read-only public profile view for any user (no edit controls) |

### Discover (Entdecken) Screen — `app/(tabs)/index.tsx`

The Entdecken tab is a full-screen map with a search overlay and a draggable bottom sheet (~1100 lines, single file). Key pieces:

- **Player search** queries `public.profiles` joined with `user_tcgs` via Supabase `.ilike('username', '%query%')`. Results are tappable player cards; tapping navigates to `app/profile/[id].tsx` (or to the Profil tab if the result is the logged-in user). Search always runs over the full unfiltered data — it is **not** affected by the map filters below.
- **Dual map rendering** — Leaflet is wired differently per platform:
  - Native: `buildMapHtml(centerLat, centerLng, events)` returns a full HTML document (Leaflet from CDN + CSS + marker/popup JS) loaded into a `react-native-webview` `<WebView>`. Marker taps `postMessage` `{type:'selectEvent', id}` back to RN via `onMessage`.
  - Web (`Platform.OS === 'web'`): a direct-DOM Leaflet init in a `useEffect`, targeting a plain `<div ref={setWebMapEl}>`. Marker taps call `window.__gatherSelectEvent(id)` directly.
  - Both paths render markers as TCG-logo `divIcon`s via `getTcgIconUri()`, falling back to the `abbr` text badge for TCGs without a logo asset. `getTcgIconUri` handles react-native-web's asset-resolution quirks (string / `{uri}` / native-module source forms — `Image.resolveAssetSource` is native-only).
- **`PLACEHOLDER_EVENTS`** — static demo event data (no `user_events` table yet). Each event stores `latOffset`/`lngOffset` *relative to the signed-in user's profile location* (`centerLat`/`centerLng`, from `currentProfile.latitude/longitude`, default Hamburg) so events always appear "nearby" regardless of the user's actual region. `bracket: CommanderBracket | null` is set for MTG Commander events.
- **Filter bar** below the search bar: TCG pills (`TCG_LIST`), Commander bracket pills B1–B5 (`BRACKET_COLORS`), date pills, and a custom `RadiusSlider` (10–200km, `PanResponder`-based drag, ref-mirrored values to avoid stale closures). These filters compute `visibleEvents` (via the `distanceKm` haversine helper), which drives **only** the map markers and the "Events in deiner Nähe" bottom-sheet list.
- **Bottom sheet**: `Animated.Value` + `PanResponder` with three snap points (expanded / collapsed / peek), computed from measured layout heights (`onLayout` on the container/header/handle/players-row) rather than hardcoded screen-height math.

`app/profile/[id].tsx` fetches `profiles`, `user_tcgs`, `user_tcg_details`, and `user_decks` for the target user ID (from `useLocalSearchParams`). Renders the same visual layout as the own-profile screen but with all edit controls, the avatar picker, the sign-out button, and deck-import stripped out. `DeckBrowserModal` is opened with `editing={false}` and no `onImportDeck` prop so its import button is hidden.

### Onboarding Data Flow

`OnboardingContext` (in `contexts/OnboardingContext.tsx`) carries all wizard state: `selectedTCGs`, `region`, `latitude/longitude`, `skillLevels`, `username`, `avatarBase64/Uri`. On finish (`name.tsx`), data is written to Supabase and `onboarding_complete` is set to `true`.

### Design System — Noir Console

**Dark-only.** Both `darkColors` and `lightColors` in `constants/theme.ts` export the same object (`noirColors`). There is no light palette. `toggleScheme()` is a no-op. Do not build light-mode-specific logic.

Source of truth: `design-system.json` in the repo root. `constants/theme.ts` is the TypeScript representation — do not deviate from it without product approval.

Key tokens:
- Canvas `#0F1011`, panel `#1B1C1D`, accent **electric blue `#168BFF`** (`C.primary`)
- Text hierarchy: `C.text` → `C.textMuted` → `C.textFaint` → `C.textDisabled`
- Surface stack: `C.surface` → `C.surface2` → `C.surface3`
- `ELEVATION.panel` / `ELEVATION.floating` — shadow preset objects, spread directly onto `StyleSheet` entries
- `RADII.sm/md/lg/xl/pill` — DS border-radius scale
- `FONTS.regular/medium/semibold/bold` — Inter weight tokens (400/500/600/700). `extrabold`/`black` both map to 700 for legacy reasons; **new code uses `bold` as the maximum weight**

**Every** styled screen/component follows this convention — never hardcode colors:
```tsx
const { colors: C } = useTheme();
const styles = useMemo(() => makeStyles(C), [C]);
// function makeStyles(C: ThemeColors) { return StyleSheet.create({ ... }) }
// defined once below the component
```

### TCG Icons — `components/TCGIcon.tsx`

`<TCGIcon tcg={TCGInfo} size={n} color={hex} />` renders an image asset for TCGs that have one (MTG, Pokémon, Lorcana), or falls back to the `abbr` text badge. The `ICONS` map inside uses static `require()` calls (React Native bundler requirement — dynamic requires don't work). To add a new TCG icon, add one line to that map.

`TCGInfo` (from `types/index.ts`) has `id`, `name`, `color`, `abbr` — **no `emoji` field**. The `abbr` is a short string like `MTG`/`PKM`/`YGO`.

### Supabase Schema

Four tables, all with RLS enabled (public read, owner-only write):
- `public.profiles` — one row per user, created by trigger on `auth.users` insert. Key field: `onboarding_complete: boolean`.
- `public.user_tcgs` — which TCGs a user plays + skill level (1–10).
- `public.user_tcg_details` — JSONB `details` column for flexible per-TCG profile fields (MTG colors, play style, etc.).
- `public.user_decks` — imported decklists: `tcg`, `name`, `format`, `cards` (JSONB array of `DeckCard`), `card_count`.

`user_tcgs` and `user_tcg_details` are uniquely keyed by `(user_id, tcg)` — always pass `{ onConflict: 'user_id,tcg' }` to `.upsert()`, or repeat saves will silently fail on the unique constraint.

Storage bucket `avatars` — public, files named `{userId}.jpg`, uploaded via `lib/auth.ts:uploadAvatar`.

### Deck Import & Browsing

- **`DeckImportModal`** — paste raw decklist; resolves names → cards/images via Scryfall (MTG) or Pokémon TCG API; saves to `user_decks`
- **`DeckBrowserModal`** — full-screen grid with format filter + deck-detail view. Accepts `editing?: boolean` (hides card-remove controls when false) and `onImportDeck?: () => void` (import button is only rendered when this prop is provided)
- **`DeckTile`** — shared deck grid tile (cover image from commander/first card, or TCGIcon fallback)
- **`CardInfoModal`** — full-screen card-detail overlay
- **`lib/powerLevel.ts`** — `analyzeDeckPowerLevel(deck)`: places MTG Commander decks into WotC 5-tier Commander Brackets (1–5), returning `DeckPowerLevel | null` (`null` for non-MTG/non-Commander decks). Also exports `CommanderBracket` (`1|2|3|4|5`), `BRACKET_LABELS`, `BRACKET_COLORS` — used by the Discover map's bracket filter.

### Constants & Types

- `constants/tcgs.ts` — `TCG_LIST`, `TCG_MAP`, `TCG_FIELDS` (field types: `text`/`multiline`/`manaColor`/`playStyle`), `MTG_COLORS`, `PLAY_STYLES`
- `types/index.ts` — `TCGId`, `Profile`, `UserTCG`, `UserTCGDetails`, `DeckCard`, `UserDeck`
- `lib/alert.ts` — `showAlert(title, message?)`, cross-platform single-button alert (see Web Compatibility Rules)

### `components/CardPicker.tsx` — implemented but unwired

Full-screen live card-search modal (Scryfall/Pokémon TCG API, typeahead, multi-select). No `TCG_FIELDS` entry uses it (`cardPicker` field type doesn't exist yet). Re-wiring: add a `cardPicker` field type to the relevant `TCG_FIELDS` entries; JSON-stringify `SelectedCard[]` into the JSONB `details` column on save; parse it back defensively (handle both string and pre-parsed array) when reading.

### Web Compatibility Rules

- Never use `Alert.alert` with multi-button arrays on web — use `lib/alert.ts:showAlert()` (single-button) or call handlers directly.
- Never use `{someString && <View>}` — if `someString` is `""`, React Native Web renders a text node inside a View and crashes. Always coerce: `{!!someString && <View>}`.
- `expo-location`'s `reverseGeocodeAsync` does not work on web — use the Nominatim API (`nominatim.openstreetmap.org`) instead.
- Modals must use `animationType={Platform.OS === 'web' ? 'fade' : 'slide'}` — slide on web leaves the overlay capturing touches after close.

### Environment

`.env.local` (gitignored) must contain:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```
