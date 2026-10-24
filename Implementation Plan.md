# BIKE RIDER — Implementation Plan

The forward plan: what to build next, in what order, and how we'll know it is done. `Phases.md` is
the historical arc; this is the actionable list. Live granular tasks live in `Task.md`.

Working rules for every item below: single file (no build step), `npm test` green (static audit +
44 headless-Chrome groups), a manual shift on desktop + real phone, SW `VERSION` bump, docs refreshed
(`Rules.md`). Nothing here is allowed to break free play, offline play, or the fiction-only brand rule.

## Track A — Finish the documentation suite  *(this pass)*

| # | Item | Acceptance criteria | Status |
|---|---|---|---|
| A1 | Add the missing docs: `TRD.md`, `app flow.md`, `backend scema.md`, `UI-UX Design Brief.md`, `open graph tags.md`, `Implementation Plan.md`, `llms.txt` | All present in `BIKE RIDER/`, grounded in the shipped code, cross-linked | DONE |
| A2 | Refresh the existing docs for drift | `music/` references removed; `favicon.*` row corrected; doc list, line counts and contacts current | DONE |
| A3 | Regenerate the auto MCP index | `tools/auto-mcp-index.sh` lists all docs; `mcp-index.md` regenerated | DONE |
| A4 | Ship `llms.txt` | Added to `tools/sync-public.mjs` `FILES` so it flows into `public/`, the web zip and the APK | DONE |

## Phase 7 — Polish & depth (next build work)

Ordered by player impact. Each item ships with a regression group where testable.

1. **Accessibility: vibration + true reduce-motion**
   - Haptic pulse on touch actions (pickup, crash, checkpoint) behind a `vibration` setting, default off.
   - A `reduceMotion` toggle that damps floaters/toasts/speed lines in addition to the existing
     shake tri-state. *Acceptance:* setting persists; no motion when disabled; keyboard path unaffected.
2. **Daily local leaderboard**
   - Persist `bestShift`/`bestDistance` per day in the save; a small summary-screen panel.
   - *Acceptance:* survives reload, resets on a new local day, no network.
3. **Ambient audio depth**
   - District-flavoured ambient layers (souk chatter, corniche wind) via the existing `AU` synth.
   - *Acceptance:* layers cross-fade by district; obey `sound`/`sfx` settings; zero audio files added.
4. **Near-miss bonuses + passenger dialogue bubbles**
   - Reward a clean close pass; rider job bubbles from a fixed string pool (i18n all six languages).
   - *Acceptance:* bonus is measurable and capped; bubbles never block the HUD; no new dependencies.
5. **Hands-on low-end device pass**
   - Real Android ergonomics + frame-time check on a 2019-class handset. *Acceptance:* holds target
     FPS; touch language (GAS / ◀ ▶ / drag-to-lean / swipe-up jump) feels correct in both orientations.

## Track C — Never-stop player loop (rest income, Ustad loans, rider journal)

The player asked for four systems that share one rule: **a setback must never be a dead end**. The
fuel-station emergency advance (`ADVANCE_MIN`, `SAVE.debt`, repaid from the next delivery's payout at
the fare code) is the precedent — this track generalises it from fuel to *time* and *repairs*. Every
number below is a starting value to be tuned by the `economy` regression group, not gospel.

### C1 — Shift rest timer + hourly rest income *(player never stops)*

- **Rest timer:** `endShift()` sets `SAVE.rest = Date.now() + REST_MS` (start 60 min). While `now <
  SAVE.rest`, the START SHIFT button is replaced by a rest card: countdown + "rider is resting" +
  running rest-income total + a **SKIP REST** button priced in in-game cash (scales with level,
  never paywalled — free play is structural, this is a fiction cost, not money).
- **Hourly coins:** finishing a shift pays the rider's on-the-clock wage — `REST_RATE` per hour,
  scaled by level, rating and company level, accrued while the app is open *or* closed (compute from
  `Date.now()` deltas against `SAVE.restAt`, the same timestamp pattern as `breakdownTow`'s fees).
  Cap accrual at `REST_CAP_H` hours (start 8) so an overnight gap is a bonus, not an exploit.
  Claimed automatically on the rest card and on opening the app ("Rider wages: +Rs X").
- **Free play unaffected:** REST applies to *paid* shifts only; a free-play/practice ride (existing
  `G.noTutorial`/free-play path) ignores the timer, and the tutorial's first shifts are exempt.
- *Acceptance:* rest card shows on `screenStart` after a shift; wages accrue across a page reload
  and across a device-clock rollback (clamp to `[0, REST_CAP_H]`); skip price never exceeds what a
  shift earns; `economy` group extended with rest-income maths.

### C2 — Ustad Garage: wait-or-loan repairs *(breakdown is a choice, not a stop)*

- Brand the existing garage **service screen** as **USTAD GARAGE** (the ustād — Bahraini master
  mechanic — already fits the world; no new screen, extend `renderGarage`'s service section).
- When `cond.damage` (or engine/tyres) crosses the breakdown threshold, `breakdownTow()` changes
  from "tow & auto-fix" to a **two-choice card**, and play continues either way:
  1. **WAIT — "Ustad works on it"**: free/cheap, but the repair completes after a real-time wait
     (`repairAt = now + minutes-by-severity`); the bike rides broken-but-legal (existing damage
     physics, `dmgUpdate`) until then. Timer persists across reload like the rest timer.
  2. **LOAN — "Fix it now, pay later"**: instant repair, cost = `serviceCosts()` × 1.25 interest,
     added to `SAVE.debt`. Repaid exactly like the fuel advance — the existing
     `FUEL CREDIT REPAID` line in the fare calculation becomes `GARAGE LOAN REPAID` and takes a
     cut of every delivery until cleared. Cap total debt at ~2× cash-on-hand or one shift's best
     earning, whichever is larger, so a loan can never eat a whole shift.
- *Acceptance:* with 0 cash and a wrecked bike the player still rides (broken) or borrows (debt);
  the loan cannot be stacked infinitely (one active repair-loan at a time); debt survives reload;
  `helmet-designs`-style regression group `ustad-loan` covers: wait-timer, debt accrual, per-delivery
  repayment, debt cap, and "no cash + max debt ⇒ wait is always free".

### C3 — Accident advisory, never a hard stop *(repair in advance, pay later)*

- On a crash where `cond.damage` lands in the "needs the ustād" band (start: ≥40), replace the
  tow/stop flow with an **advisory toast + garage marker**: "Bodywork's bad — take it to Ustad
  Garage. Fix now, pay from your next fares." The bike stays drivable; the existing damage model
  already punishes riding damaged (wobble, `dmgUpdate`), so the player self-weighs the risk.
- The **SHOWROOM** (garage viewer) gains a **repair-in-advance** action on the current bike: book
  the repair on credit from the viewer, same loan maths as C2, so "showroom" and "ustad" are one
  workshop with two doors. `advanceUsed`-style once-per-shift guard keeps it from spaming.
- *Acceptance:* a ≥40-damage crash never forces `endShift` or a tow; the advisory fires once per
  crash, is i18n'd in all seven languages; the advance-repair appears only when `damage > 0`;
  paying in advance with cash short still lands on the loan path, never negative cash.

### C4 — Rider journal: daily / weekly / monthly records *(profile remembers)*

- Extend `SAVE.stats` with period buckets: `journal = { d:'YYYY-MM-DD', w:ISO-week, m:'YYYY-MM',
  day:{…}, week:{…}, month:{…}, hist:[last N closed periods] }`. Roll-over on load and on
  `endShift()` (same timestamp pattern as C1): when the date key changes, push the closed bucket
  into `hist` (cap 30 entries) and start fresh. Buckets track: shifts, deliveries, perfect rides,
  km, earned, fuel spent, crashes, fines, best shift, rating delta — all counters already exist in
  `SAVE.stats` / `M.*`, this is aggregation, not new measurement.
- Profile screen (`renderProfile`) gains a **JOURNAL** section with a day/week/month toggle showing
  the three buckets + a "best day this month" row. Purely local, no network, no backend.
- *Acceptance:* playing across a mocked date change rolls the bucket and shows yesterday's numbers;
  `hist` is capped and survives reload; journal rows i18n'd; a new regression group `rider-journal`
  pins roll-over, aggregation and cap; `dom-integrity` still green.

### Build order

C1 → C4 → C2 → C3 (rest income first because C2's loan repayment wants the same
delivery-hook; journal is independent and cheap; C3 depends on C2's loan maths). Each lands with its
regression group, `npm test` green, SW `VERSION` bump, docs (`Task.md`, `Memory.md`,
`backend scema.md` save-field table) refreshed in the same change.

## Balance & hardening (from `Task.md`, still open)

- Early cash curve: opening 10 vs first upgrade 20 — verify the pull lands within shift 1–2 (the
  `economy` group recomputes it; adjust costs, not content).
- Job offer weights + pay-per-km across all 10 `JOBT` types; confirm VIP/long dominate correctly at lvl 4.
- Difficulty ramping (`evInterval`/`updateDifficulty`) on touch at level 5.
- Verify the level-gated highway/valley `rideLimit`/`asphaltHalf` branches (9.4 m / 8.6 m) when a
  high-level route rolls one — currently unreachable from the procedural route.

## Release / operational (must not be forgotten)

- ~~**Release keystore is missing and must be recreated and backed up off-machine.**~~ **DONE (2026-10-21).**
  `android/release.keystore` exists (`CN=Bike Rider, OU=Games`) and both release paths sign with it —
  the AAB via `android/app/build.gradle`'s `signingConfigs.release`, the APK via `android/keystore.properties`.
  *Still to do:* back it up off-machine; losing it breaks every future update on AppGallery.
- Bump `VERSION` in `sw.js` on every release; run `npm run sync:public`; confirm offline cold start.
- Keep `CREDITS.txt` / `licence.md` accurate; resolve the **naming/licence inconsistency** (see below).
- Source answers to Huawei (**app name is BIKE RIDER, package `com.bikerider.game`**) and reply
  with the re-submission text in `PUBLISH.md` §5.1 after uploading the new version.

## Known inconsistencies to decide (not silently fix)

1. ~~**Project name:** shipped meta/manifest/JSON-LD say **"Bike Rider"**; the docs and repo say
   **BIKE RIDER**.~~ **DONE (2026-10-21).** AppGallery rejected the old name under rule 9.5
   (similar to the existing game *Bike Rider*), which forced the decision: everything now ships as
   **BIKE RIDER** — `<head>` (title/OG/Twitter/JSON-LD), `manifest.webmanifest`, `sw.js` cache
   name, `robots.txt`, `licence.md`, `CREDITS.txt`, `PUBLISH.md`, and the Android launcher label.
   `package.json` name is `bike-rider`. The in-game fictional courier company "Bike Rider" stays
   (it is invented fiction, player-editable, not the app identity) — see `Rules.md` rule 3.
2. **Licence:** `licence.md`/`CREDITS.txt` dedicate the work **CC0 1.0**, but `package.json` declares
   `"license": "MIT"`. Align `package.json` with the intended licence (CC0) or restate the intent.
3. **`public/music/`** references survive in some docs though the folder is deleted — cleaned up in
   this docs pass; keep it that way.
4. ~~**Android manifest missing / no reproducible release build.**~~ **DONE (2026-10-21).** The Gradle
   module under `android/app/` was regenerated (manifest, `res/`, `strings.xml`, `build.gradle`), a
   checked-in offline `android/AndroidManifest.xml` was added for the raw-toolchain APK path, and
   `npm run build:aab` (`tools/build-aab.mjs`) now produces the AppGallery `.aab`. The Gradle wrapper
   is pinned to **8.2.1** — Gradle 9.x breaks the Huawei AGCP plugin with
   `Cannot mutate the dependencies of configuration ':app:releaseCompileClasspath'`.
5. **`android/keystore.properties` is gitignored but required** by `npm run build:apk --release`
   (`storePass`/`keyPass`/`keyAlias`). The `build:aab` path reads its credentials from
   `android/app/build.gradle` instead. Back the keystore and both credential sources up off-machine.

## Definition of done (every change)

- `npm test` green (static audit + all regression groups).
- `npm run sync:public` run; `public/` matches root.
- Manual shift played: desktop keyboard, real phone touch, real Android build.
- Offline cold start verified; `sw.js` `VERSION` bumped.
- The docs this touches (`Task.md`, `Memory.md`, and any of `Architecture.md` / `app flow.md` /
  `backend scema.md` / this file) updated in the same change — then regenerate `mcp-index.md`.

## Out of scope (do not do without an explicit new decision)

- Backend/server, accounts, multiplayer, cloud saves, leaderboard server.
- Any player-facing ads or monetisation (free play is structural — `Rules.md`).
- Splitting `index.html` or introducing a bundler.
