# Upper/Lower — Hypertrophy

## Audit and implementation decisions

| Requirement | Existing support | Change |
| --- | --- | --- |
| Separate program; preserve old plans | Registry, selectors and per-program customization archives | Add `upper_lower_chest_arms`; keep every existing prescription unchanged |
| Ordered sets, ranges, substitutions | Editable accessory rows already support these | Configure all movements using those rows, including primary barbell lifts; no AMRAP main block |
| RIR | Only the old top-set UI supported it; that picker was transient | Persist per-working-set RIR for the new program |
| Double progression | Existing helper uses only completed accessory rows, may increase from a partial workout and automatically applies increases | Add isolated, strict progression guidance for this preset; leave legacy algorithms unchanged |
| Manual working weights | Editable rows and unit conversion | Start manually; retain the last same-prescription working load, never derive working weights from a 1RM |
| Bodyweight | Existing storage is TOTAL BW + added, with an added-load input | Retain convention; display it explicitly; pin BW and units during new workouts |
| Unilateral tracking | Existing rows accept reps but need clear instructions | Label reps per arm/leg and DB weights per dumbbell in notes |
| Optional OHP | No per-session optional toggle | Include only when explicitly checked before Start; excluded work is not saved as missing |
| Warmups | Existing percentage and top-set main blocks | Add editable 50/70/85% ramp rows for bench, squat, deadlift and optional OHP, saved with `isWarmup`; exclude from progression |
| Session snapshots | Existing active state pins main weights/week/day, but accessories follow live settings | Snapshot this preset's movements, ranges, cycle, BW and units at Start; preserve completed prescriptions |
| History/import/export | Existing logs are stored independently of current definitions; v1/v2 backups and sync serialize nested fields | Add optional metadata to new sessions/logs; preserve legacy records and their display fallbacks |
| Mobile | Existing safe-area/tab layout and inline timer | Reuse layout; browser acceptance tests cover 390×844, navigation, finish control and horizontal overflow |

No persistence version bump or migration is necessary: new metadata is optional and existing import/export and local persistence retain it. The existing `topSet` engine also supports days without a main block (the previous Pull day); this preset reuses that range/accessory flow with all four main blocks disabled. Its working weights never use the seeded TM fields. It uses the existing seven-week cycle wrapper and optional deload screen; those screens remain the existing reduced-volume accessory guides for days without a main block. They do not contribute progression evidence; TM Test is not offered for this preset because it has no TM-test main sets. Skip the interlude to begin the next normal cycle if no reduced-volume week is desired.

## Use

1. Export a known-good backup from Settings before changing programs, especially if exact cycle position/TMs must be recoverable.
2. Finish any active workout. In **Settings → Program**, choose **Hypertrophy** within the **Upper/Lower** group and confirm. No existing installation switches automatically. The existing Upper/Lower style remains available as **Top Set** in that group. The standalone **Hypertrophy** and **5/3/1** programs remain available. This presentation grouping keeps both original program IDs and separate saved plans; it does not switch the active program or alter records.
3. Follow Upper A / Lower A / Upper B / Lower B. Monday / Tuesday / Thursday / Friday is suggested, with flexible day selection already supported by the app.
4. Choose conservative working weights manually on the first occurrence; old top sets are not assumed repeatable for three straight sets. Start at 2–3 RIR and work toward 1–2. Warmups are separate and adjustable.
5. Enter actual reps in each row. Log RIR and confirm good form if you want an increase suggestion. All prescribed mandatory working sets must be completed at least within range. For an exercise to qualify, every prescribed set must reach its upper boundary at the same load with good form and at least 1 RIR. Missing RIR conservatively withholds the suggestion.
6. Eligible increases appear as an optional next-load message; enter the new weight manually to accept. 135 × 8/7/6 retains 135; 135 × 8/8/8 with the criteria met suggests 140. Partial/failed workouts, mismatched exercise identity, range, set count, load type or day cannot unlock an increase. An enabled-but-unperformed optional OHP does not block completed mandatory exercises; OHP itself must satisfy every set.
7. Change suggested increments in **Settings → Workout Plan by Day**, expanding the relevant day. DB and EZ movements use small defaults; choose an increment your actual equipment supports. Respect the adjustable DB limit of 52.5 lb per dumbbell; suggestions do not enforce equipment ceilings.
8. Upper B defaults to incline DB press. To use flat instead, remove that row and add **Flat DB Bench Press**, 2 sets, 10–15, double progression, standard weight, through the existing plan editor. Use a distinct movement name for substitutions. Enable optional OHP before Start only when desired. Plan changes affect future sessions; the active session keeps its snapshot.

Chest volume is 3 bench + 3 incline + 3 dips + 2 DB press = 11 direct sets/week. Curl/triceps sets may be alternated to save time, with separate row logging. Sixty minutes is a target, not guaranteed. No nutrition, cardio or step features are added.

## Compatibility and limitations

- No production localStorage or synced files were read or modified for testing. Tests use isolated browser storage and repository fixtures, including synthetic records matching the handoff's recent lifts and anomalous duration.
- Historical sessions, variant values, timestamps, load semantics, PR calculations and summary calculations are unchanged. Implausible old durations remain as recorded; this work adds no duration analytics or timer repair.
- New working rows are not AMRAPs. The legacy AMRAP-only strength PR board/estimated-1RM charts retain their existing behavior; these new sets are visible in history, itemized exports, exercise summaries and load-volume trends but do not create AMRAP PRs.
- Warmup logs are explicitly identified in exports/history. Existing load-volume summaries include all completed weighted rows, including warmups, as they did before; they are not a direct working-set count.
- No-weight ab-wheel work and hanging-leg-raise reps progress by controlled reps/ROM without suggested load increases. There is no new ROM-stage input.
- BW movements retain TOTAL weight storage. Set BW in Settings for a separate added-load input; otherwise enter the TOTAL explicitly. A workout pins its BW at Start. No historical bodyweight loads are reinterpreted.
- Local in-progress state survives refresh, including optional choice, reps, weights, RIR and technique confirmation. Existing backup/auto-sync intentionally omit in-progress sessions; importing a backup clears the active workout. Completed snapshots round-trip through v2; old v1 files remain importable.
- Same movement on different days has separate recommendation context (Upper A's 3×8–12 incline does not feed Upper B's 2×10–15). Substitutions get separate identities and require new manual starting weights. The first version does not offer historical-set editing or a dedicated hypertrophy-volume dashboard.
- Existing program switching resets week/day and reseeds current TMs; per-program exercise customizations are archived/restored, but exact cycle position and old top-set load state are not archived. To roll back, reselect the old program for its plan. To recover its exact pre-switch profile/cycle/TMs, restore the known-good backup. Export a fresh backup first if you need to retain sessions logged since that backup; restoring replaces the saved collections using the app's existing behavior.
- Backups containing this new program should be restored with this version or later; older app builds do not know its program ID.

## Verification

Run from `pwa/`: `npm run test:run`, `npm run build`, `npm run lint`, and `npm run test:e2e`.
Focused unit tests cover program prescriptions, day slots, strict progression, incomplete/failed sessions, variants, configured increments, legacy fixture import/rollback, PR/summary preservation, snapshots and backups. Browser tests cover mobile activation, weights/reps/RIR, warmups, partial save, reload, bodyweight accounting and optional OHP.

Verified on implementation: 364 unit tests passed, the full 53-test browser suite passed, and 13 focused browser checks passed after the final setup changes (including two additional mobile cases). A final five-test mobile suite also passed, including the new program’s cycle transition without TM increases. Production build, TypeScript checks and ESLint passed. Browser checks use Chromium at iPhone-sized dimensions; physical iOS/Safari testing remains manual.
