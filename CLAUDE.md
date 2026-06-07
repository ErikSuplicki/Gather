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

## Architecture

**Expo SDK 56** + Expo Router (file-based) + TypeScript + Supabase (auth + PostgreSQL + Storage).

### Routing & Auth State Machine

`app/_layout.tsx` is the root. It holds a session state machine with three values:
- `undefined` = still loading (renders `null` / splash)
- `null` = no session → redirect to `/(auth)`
- `Session` = authenticated → check `profile.onboarding_complete`
  - `false` → redirect to `/(onboarding)/tcgs`
  - `true` → redirect to `/(tabs)`

`supabase.auth.onAuthStateChange` drives all navigation — sign-out triggers it automatically.

### Route Groups

| Group | Path | Purpose |
|---|---|---|
| `(auth)` | `/` | Email/password + Google OAuth login screen |
| `(onboarding)` | `/tcgs → /region → /skill → /name` | 4-step onboarding wizard |
| `(tabs)` | `/` | Main app: Entdecken (discover) + Profil |

### Onboarding Data Flow

`OnboardingContext` (in `contexts/OnboardingContext.tsx`) is provided at root layout level and carries all wizard state across the 4 screens: `selectedTCGs`, `region`, `latitude/longitude`, `skillLevels`, `username`, `avatarBase64/Uri`. On finish (`name.tsx`), data is written to Supabase and `onboarding_complete` is set to `true`.

### Supabase Schema

Three tables with RLS enabled:
- `public.profiles` — one row per user, linked to `auth.users` via trigger. Key field: `onboarding_complete: boolean`.
- `public.user_tcgs` — which TCGs a user plays + skill level (1–10).
- `public.user_tcg_details` — JSONB `details` column for flexible per-TCG profile fields (MTG colors, play style, etc.).

Storage bucket `avatars` — public, files named `{userId}.jpg`, uploaded via `lib/auth.ts:uploadAvatar`.

### Design System

- `constants/theme.ts` — all colors (`COLORS`) and spacing (`SPACING`). Use these everywhere; do not hardcode values.
- `constants/tcgs.ts` — `TCG_LIST`, `TCG_MAP`, per-TCG field schemas (`TCG_FIELDS`). TCG colors drive UI theming throughout profile and onboarding.
- `types/index.ts` — `TCGId`, `Profile`, `UserTCG`, `UserTCGDetails`.

### Web Compatibility Rules

- Never use `Alert.alert` with multi-button arrays on web — it maps to `window.confirm` and callbacks don't fire. Call handlers directly instead.
- Never use conditional rendering like `{someString && <View>}` — if `someString` is `""`, React Native Web renders a text node inside a View and crashes. Always coerce to boolean: `{!!someString && <View>}`.
- `expo-location`'s `reverseGeocodeAsync` does not work on web — use the Nominatim API (`nominatim.openstreetmap.org`) for geocoding instead.

### Environment

`.env.local` (gitignored) must contain:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```
