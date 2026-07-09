---
name: verify
description: Build/launch/drive recipe for verifying changes to the my-workouts PWA end-to-end.
---

# Verifying the my-workouts PWA

Build + serve (from `pwa/`):

```bash
npm run build                       # tsc -b + vite build
npm run preview -- --port 4173 &    # serves dist at http://localhost:4173/my-workouts/
```

Drive with Playwright (`@playwright/test` is a devDependency; chromium already installed).
**Scripts must live inside `pwa/`** (ESM bare-specifier resolution needs `pwa/node_modules`);
`node .myscript.mjs` from `pwa/` works, `/tmp` does not.

Seeding app state: write the zustand blob before load —

```js
await page.addInitScript(({ key, value }) => {
  localStorage.clear()
  if (value) localStorage.setItem(key, JSON.stringify({ state: value, version: 1 }))
}, { key: 'my-workouts-storage', value: state })
```

`state` shape: `{ profile, sessions, setLogs, wilksEntries, customAccessories, ... }` —
copy a full profile literal from `src/logic/storeMerge.test.ts`. `normalizePersistedData`
heals missing fields on load, so partial states are fine. Fixtures also exist in
`test-fixtures/` (see `e2e/helpers.ts`).

Gotchas:
- The app shell is a fixed-height inner scroll container: `page.locator('body').innerText()`
  MISSES content scrolled inside it, and `fullPage` screenshots don't expand it.
  Use `getByText(...).isVisible()` / `boundingBox()` for assertions instead.
- HashRouter: deep-link with `http://localhost:4173/my-workouts/#/prs` etc.
- Onboarding flow: 4 number inputs → Continue → program card by label → Continue → Start Training.
- Day picker chips are `BP/SQ/OHP/DL` (lift short names) or program chip labels (Squat/Push/Hinge/Pull).
