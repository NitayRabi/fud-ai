# Fud AI — shared mobile app (React Native / Expo)

One TypeScript codebase for iOS and Android, versioned **7.1 (build 38)** in lock-step with the
native apps in `ios/` and `android/`. The native apps remain the shipping apps and are not
deleted; this is the shared port, now covering every tab and the full onboarding.

## UI rule

**Same UI on both platforms, matching the current iOS SwiftUI look.**

- Colors come from `src/theme/colors.ts`, a port of `AppThemeColor` / `AppColors` and the
  `appBackground` / `appCard` asset colors (warm cream in light, system black in dark).
- Spacing, radii and control sizes (`src/theme/spacing.ts`) are the SwiftUI values: 16/24 padding,
  16 card radius, 54 CTA height, 60 add button, 240/14 calorie dome, 16×64 macro bars.
- Type sizes follow iOS Dynamic Type defaults (`src/theme/typography.ts`).
- Android renders exactly this design. Do **not** add Material-only layouts, FABs, snackbars or a
  second design system. Segmented pickers, pill tabs, wheel-style steppers and bottom sheets are
  shared components under `src/components/` so both platforms render the same control.
- The only platform exception is **Liquid Glass on iOS**, provided by the native bridge in
  `modules/glass-chrome`. Android gets the same layout and colors with a solid card background.

Reference `ios/calorietracker/` when porting a screen; file-level comments in `src/` point at
the SwiftUI source they mirror.

## What is here

| Area | Files | Status |
|------|-------|--------|
| App shell + theme | `App.tsx`, `src/theme/`, `src/navigation/` | 5 tabs (Home, Progress, Coach, Settings, Workouts), accent + appearance prefs |
| Onboarding | `src/screens/onboarding/` | All 14 steps of `OnboardingView.swift`: welcome, gender, birthday, height & weight, body fat, activity, goal, desired weight, goal speed, notifications, Health, AI setup, building plan, Plan Ready. AI step keeps the #373 fix: placeholder is "Paste Gemini API key", helper text explains a disabled Continue |
| Home | `src/screens/home/`, `src/components/home/` | Week strip, calorie dome, nutrient bars, unified diary, "+" menu with water, fasting, manual entry and AI logging |
| AI food logging | `src/screens/home/FoodAISheets.tsx`, `src/services/aiClient.ts`, `src/domain/ai/` | Scan Food / Scan Label (camera or library), Describe Meal, Voice (keyboard dictation), Saved Meals. Analyzing overlay with Cancel; every request has a hard timeout; results reviewed (name, kcal, macros, serving grams, ingredients, meal, note) before entering the diary with the native `FoodSource` |
| AI transports | `src/domain/ai/transport.ts`, `runtime.ts`, `errors.ts` | Gemini, OpenAI-compatible, Anthropic and the hosted proxy. Compact retry on truncation, `AIErrorKind` classification, vision/text selection, single fallback retry, hosted entitlement gate |
| Progress | `src/screens/progress/`, `src/domain/progress/`, `src/domain/body/` | My Progress / Weekly Challenge pills; 1W–All ranges; Weight / Body Fat / Workouts metric; SVG trend chart (area, dots, goal rule, drag-to-inspect); calorie bars; macro + nutrient averages; streaks & stats; Log Weight / Log Body Fat and history sheets. Weekly Challenge scores on device |
| Coach | `src/screens/coach/CoachScreen.tsx`, `src/domain/coach/` | `ChatView` layout: hero empty state, goal-aware prompt grid and chips, bubbles, typing indicator, photo attach, gradient send, Reset Chat. System prompt carries profile, formulas and the `WeightAnalysisService` forecast; history persisted under `coachChatHistory` with a 20-message context window |
| Workouts | `src/screens/workouts/`, `src/domain/workouts/` | Log / Library modes. Log: today's exercises with weight / reps / RPE sets, add from library, Finish with the `StrengthWorkoutBurnEstimator` estimate, history. Library: 877-exercise FreeExerciseDB catalog, debounced search, Level / Equipment / Primary / Category filters, sort, CDN thumbnails, detail with animated frames and instructions |
| Settings | `src/screens/settings/` | Personal Info, Goals & Nutrition (custom targets, Recalculate Goals, calculation methods), Tracking & Reminders, Notifications (meal reminders), AI Access, App Settings, Health & Data |
| Hosted paywall + purchases | `src/screens/paywall/HostedPaywallSheet.tsx`, `src/services/purchases.ts`, `src/domain/purchases/` | `react-native-purchases` adapter behind `setPurchasesAdapter`: offerings, purchase (cancelled sheet is not an error), restore, customer-info listener. Without an SDK key or native module the sheet says plans are unavailable |
| Companion seams | `src/domain/integrations/companions.ts`, Settings → Health & Data | `HealthSync`, snapshot writer and per-platform status model; all report native-only honestly (see below) |
| Unified diary store | `src/domain/diary/diaryState.ts`, `src/state/` | One reducer/state for food + water + fasting (#369); body, workouts and chat follow the same pattern |
| iOS glass bridge | `modules/glass-chrome/` | Expo local module: `UIGlassEffect` (iOS 26+) with material fallback |

### Still native-only (ios/ and android/)

These stay in the native apps for now. The shared app never fakes them — Settings → Health &
Data lists each one with its status.

- **Apple Health / Health Connect** — `HealthKitManager.swift`; the shared app has the
  `HealthSync` seam and the `healthKitEnabled` preference but no bridge module yet.
- **Apple Watch companion, home / lock-screen widgets, Siri App Intents** — extension targets
  read a snapshot the native app writes (`WidgetSnapshotWriter`, `WatchSnapshotSync`). The
  `CompanionSnapshot` shape is defined; no shared-app extension targets exist.
- **On-device AI** — Apple Intelligence and the LiteRT Gemma 4 runtime; selecting them reports
  `unsupportedDevice` / `localUnavailable` and points to a cloud provider.
- **Barcode lookup (Open Food Facts), on-device Whisper transcription, weekly-challenge
  leaderboard accounts, diary export/import, cloud backup, Adaptive Goals, custom reminder
  times, meal photos on disk** — the UI names each of these where it would appear.

## Domain parity

`src/domain` is pure TypeScript with no React Native imports, so it unit-tests in Node and can be
shared with `web/`. Names are kept identical to the native apps:

- Provider `rawValue`s match `AIProvider.swift` / `AIProvider.kt` (`"Google Gemini"`, …).
- Preference property names are the iOS `UserDefaults` keys (`waterTrackingEnabled`, `aiAccessMode`,
  `selectedAIProvider`, `notificationsEnabled`, `healthKitEnabled`, …); `preferenceKeys` fails to
  compile if one drifts.
- `FoodEntry`, `WaterEntry`, `FastingSession`, `FoodAnalysis`, `WeightEntry`, `BodyFatEntry`,
  `StrengthWorkoutSession` / `CompletedSet` and `ChatMessage` carry the same fields.
- Food-analysis prompts and the `FoodAnalysis` parser are the `GeminiService.swift` ones; the
  Coach system prompt is `ChatService.buildSystemPrompt`; the forecast is `WeightAnalysisService`.
- RevenueCat entitlement/product IDs match `HostedAIConstants.swift`.
- API keys go to `expo-secure-store` under `apikey_<provider rawValue>`, mirroring the Keychain.

### One store for food + water + fasting (#369)

Android's `HomeViewModel` merged three flows by snapshotting the previous UI state, so a food
re-emission could overwrite a newer water/fasting update. Here every mutation is a pure reducer
step over a single immutable `DiaryState`; React reads it with `useSyncExternalStore`, so a change
is exactly one emission and the pillar and diary update in the same render. See
`tests/diaryState.test.ts`.

### Exercise catalog

`src/domain/workouts/exerciseCatalog.json` (metadata tuples, ~125 KB) and
`exerciseInstructions.json` are generated from the FreeExerciseDB corpus the native apps bundle
(`ios/calorietracker/Resources/FreeExerciseDB/dist/exercises.json`) and the workout-vector
manifest. Regenerate with `npm run catalog`. Animation frames are never bundled; like the store
builds they load from `https://assets.fud-ai.app/workout-vectors/v2/`.

## Run

Requirements: Node 22, npm, and for device builds Xcode 16+ (iOS) / Android Studio with an SDK.

```bash
cd mobile
npm ci

# Typecheck + domain unit tests (what CI runs)
npm run check

# Start Metro; press i / a for a simulator, or scan the QR code with Expo Go
npm start
```

Expo Go runs every screen; the GlassChrome module is simply absent there and the tab bar falls
back to a solid card background. `react-native-purchases` and local notifications need a
development build:

```bash
# iOS (macOS only) — generates ios/ via prebuild, links modules/glass-chrome, runs on a simulator
npx expo run:ios

# Android
npx expo run:android
```

`ios/` and `android/` inside `mobile/` are generated by prebuild and git-ignored; `app.json` is the
source of truth (bundle id `com.apoorvdarshan.calorietracker`, version 7.1, build 38).

### Purchases (RevenueCat)

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` /
`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` to the public SDK keys. No key is committed; without one the
hosted paywall shows "plans unavailable" and BYOK keeps working.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm start` | Metro dev server |
| `npm run ios` / `npm run android` | Prebuild + run a native dev build |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest over `tests/` (pure domain code) |
| `npm run check` | typecheck + test — run by `.github/workflows/quality.yml` |
| `npm run catalog` | Regenerate the exercise catalog JSON from the native FreeExerciseDB corpus |

## Layout

```
mobile/
├── App.tsx                  # Hydrates stores, installs the purchases adapter, gates on onboarding
├── app.json                 # Expo config (7.1 / 38, bundle id, plugins)
├── assets/                  # Onboarding logo
├── modules/glass-chrome/    # iOS Liquid Glass local Expo module (Swift) + TS wrapper
├── scripts/                 # build-exercise-catalog.mjs
├── src/
│   ├── theme/               # AppColors palette, surfaces, typography, spacing, ThemeProvider
│   ├── domain/              # Pure TS: ai/, body/, coach/, diary/, fasting/, food/, integrations/,
│   │                        #   onboarding/, prefs/, profile/, progress/, purchases/, water/, workouts/
│   ├── state/               # createStore, persistence adapters, app stores + hydration
│   ├── services/            # RN bindings: aiClient, imagePicker, notifications, purchases
│   ├── components/          # Primitives, Icon map, SegmentedControl, StepperField, charts/, home/
│   ├── navigation/          # Tab + settings stack
│   └── screens/             # home/, progress/, coach/, workouts/, onboarding/, settings/, paywall/
└── tests/                   # Vitest domain tests
```
