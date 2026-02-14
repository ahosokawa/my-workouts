# My Workouts PWA

A 5/3/1-inspired weightlifting tracker built as a Progressive Web App. Designed primarily for iOS standalone mode with a dark theme and touch-optimized interface.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build:** Vite 7
- **Styling:** Tailwind CSS 4
- **State:** Zustand (persisted to localStorage)
- **Routing:** React Router 7 (HashRouter)
- **Charts:** Recharts
- **PWA:** vite-plugin-pwa (Workbox service worker, auto-update)

## Project Structure

```
src/
├── components/       # Reusable UI (TabBar, PlateBreakdown, RestTimer, Icons)
├── views/            # Page-level components
│   ├── OnboardingView.tsx        # First-run 1RM setup
│   ├── WorkoutView.tsx           # Active workout tracking
│   ├── CycleCompletionView.tsx   # End-of-cycle review & accessory editor
│   ├── HistoryView.tsx           # Past workout list
│   ├── WorkoutDetailView.tsx     # Single workout detail
│   ├── PRsView.tsx               # Personal records (Est. 1RM, PR Board, Wilks)
│   ├── E1RMChartView.tsx         # Estimated 1RM chart over time
│   ├── PRBoardView.tsx           # Rep-based PR table
│   └── SettingsView.tsx          # Profile, data backup, resets
├── logic/            # Pure business logic
│   ├── calculator.ts             # 5/3/1 set/rep prescriptions
│   ├── accessories.ts            # Default accessory exercise definitions
│   ├── brzycki.ts                # Estimated 1RM formula
│   ├── cycleEvaluator.ts         # Cycle success evaluation
│   ├── plates.ts                 # Plate loading calculator
│   └── wilks.ts                  # Wilks score calculator
├── App.tsx           # Router & conditional layout
├── store.ts          # Zustand store (state, actions, persistence)
├── types.ts          # TypeScript types & enums
├── main.tsx          # Entry point
└── index.css         # Global styles & CSS variables
```

## Prerequisites

- Node.js 20+
- npm

## Local Development

```bash
# Install dependencies
npm install

# Start dev server with HMR
npm run dev
```

The dev server runs at `http://localhost:5173/my-workouts/` by default. The `/my-workouts/` base path mirrors the production deployment on GitHub Pages.

### Available Scripts

| Script          | Command              | Description                                  |
| --------------- | -------------------- | -------------------------------------------- |
| `npm run dev`   | `vite`               | Start dev server with hot module replacement |
| `npm run build` | `tsc -b && vite build` | Type-check and build for production        |
| `npm run preview` | `vite preview`     | Serve the production build locally           |
| `npm run lint`  | `eslint .`           | Run ESLint                                   |

### Testing the PWA Locally

The service worker is only generated during production builds. To test PWA features (offline support, install prompt, caching):

```bash
npm run build
npm run preview
```

Then open the preview URL in your browser. On Chrome, use DevTools > Application > Service Workers to inspect caching behavior.

## Deployment

The app deploys to **GitHub Pages** automatically via the workflow at `.github/workflows/deploy-pwa.yml`.

### How it works

1. Push to `main` with changes inside the `pwa/` directory (or trigger manually via `workflow_dispatch`).
2. The workflow installs dependencies, runs `npx vite build`, and deploys `pwa/dist/` to GitHub Pages.
3. The site is served at `https://<username>.github.io/my-workouts/`.

### Manual deployment

If you need to deploy without the CI workflow:

```bash
npm run build
# Upload the contents of dist/ to any static hosting provider
```

The `base` path in `vite.config.ts` is set to `/my-workouts/`. If deploying to a different path, update the `base` value and the `start_url` in the PWA manifest config accordingly.

## Data & State

All user data is stored in **localStorage** under the key `my-workouts-storage` via Zustand's persist middleware. There is no backend.

Key state:
- **Profile** -- 1RMs, training maxes, cycle/week/day position, body weight
- **Sessions** -- completed workout metadata
- **Set Logs** -- individual set records (main lifts + accessories)
- **Wilks Entries** -- Wilks score history
- **Custom Accessories** -- per-day accessory exercise overrides
- **Saved Exercises** -- user-created exercise library for re-use

Users can export/import a full JSON backup from the Settings screen.

## Key Concepts

- **Cycles:** 3 weeks long, 4 training days per week (Squat, Bench, Deadlift, Overhead Press).
- **Training Maxes:** Calculated as 90% of estimated 1RM, rounded to the nearest 5 lbs.
- **Progression:** After a successful cycle, TMs increase by 10 lbs (Squat/Deadlift) or 5 lbs (Bench/OHP).
- **AMRAP:** The final working set each day is "as many reps as possible." The app tracks reps and calculates estimated 1RM via the Brzycki formula.
- **Accessories:** Configurable per day. Users can customize exercises when starting a new cycle; the configuration persists across cycles.

## PWA Configuration

The PWA manifest and service worker are configured in `vite.config.ts` via `vite-plugin-pwa`:

- **Display:** `standalone` (full-screen on iOS/Android)
- **Register type:** `autoUpdate` (service worker updates silently)
- **Icons:** `public/icon-192.png` and `public/icon-512.png`
- **iOS support:** `apple-mobile-web-app-capable` and `apple-touch-icon` meta tags in `index.html`
