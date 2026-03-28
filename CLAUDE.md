# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A 5/3/1 weightlifting program tracker built as an offline-first React PWA. No backend — all data persists in localStorage via Zustand. Deployed to GitHub Pages.

## Commands

All commands run from `pwa/`:

```bash
cd pwa
npm install        # install dependencies
npm run dev        # start Vite dev server with HMR
npm run build      # typecheck (tsc -b) + production build
npm run lint       # ESLint
npm run preview    # serve production build locally
npm test           # run tests in watch mode (vitest)
npm run test:run   # run tests once (CI)
```

Tests use Vitest. Test files are co-located with source as `*.test.ts` in `logic/`.

## Architecture

### Tech Stack
- React 19 + TypeScript, Vite 7, Tailwind CSS 4, Zustand 5, React Router 7, Recharts 3
- PWA via vite-plugin-pwa (standalone mode, auto-update service worker)
- HashRouter for GitHub Pages compatibility

### Code Layout (`pwa/src/`)
- **`store.ts`** — Zustand store with `persist` middleware (localStorage key: `my-workouts-storage`). Single source of truth for profile, sessions, set logs, active workout state, accessories, and Wilks entries. The `merge` function handles schema evolution.
- **`types.ts`** — All TypeScript types and const-object enums. `MainLift` maps 1-4 to Squat/Bench/Deadlift/OHP. `liftFromDay()` maps day number to lift.
- **`logic/`** — Pure functions with no React dependencies:
  - `calculator.ts` — 5/3/1 set/rep prescriptions (warmup + working + supplemental). Rounds to nearest 2.5 lbs.
  - `brzycki.ts` — Estimated 1RM formula
  - `cycleEvaluator.ts` — Evaluates cycle success and suggests TM adjustments (+10 lbs squat/deadlift, +5 lbs bench/OHP)
  - `plates.ts` — Plate-per-side breakdown
  - `wilks.ts` — Wilks score calculation (male coefficients)
  - `accessories.ts` — Default accessory exercises per day
- **`hooks/`** — Custom React hooks (`useElapsedTimer`).
- **`views/`** — Page-level components. `WorkoutView.tsx` handles active workout tracking with set completion, AMRAP input, rest timer, and plate breakdown.
- **`components/`** — Reusable UI: TabBar, RestTimer, PlateBreakdown, MainSetCard, CollapsibleSection, AccessoryEditor, Icons.
- **`App.tsx`** — Conditional root: no profile → OnboardingView, cycle complete → CycleCompletionView, otherwise tab-based layout with routes.

### Key Data Flow
- `activeWorkout` in the store survives tab switches (persisted in localStorage) so in-progress workouts aren't lost.
- `saveWorkout()` creates a `WorkoutSession` + individual `SetLog` entries, then advances the day/week/cycle counters on the profile.
- Cycle completion is detected in `App.tsx` when all 12 sessions (4 lifts × 3 weeks) are done.

### Routing
`/workout`, `/history`, `/history/:sessionId`, `/prs`, `/prs/chart/:liftId`, `/settings`

### Styling
- Dark theme (#0a0a0a bg, iOS blue #007AFF accent)
- CSS custom properties in `index.css` for accent colors
- 100dvh for viewport height; safe-area padding classes for PWA standalone mode
- System font stack (-apple-system, SF Pro Display)

### Deployment
GitHub Actions workflow (`.github/workflows/deploy-pwa.yml`) auto-deploys to GitHub Pages on push to `main` when `pwa/**` changes. Base path is `/my-workouts/`.
