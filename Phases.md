# BIKE RIDER — Phases.md

Roadmap. Describes the build order the project has followed and where it is now. Task.md holds the live queue; this file sketches the arc.

## Phase 0 — Foundation (DONE)

- Single-file boot: `index.html`, Three.js r128 vendored, canvas + resize loop.
- Utils + config layer (`LANES`, `LEVELS`, `UPG`, `PAINTS`, `OUTFITS`, `BIKES`, `JOBT`).
- Save system (`defaultSave`/`deepMerge`/`persist`, localStorage) and settings.
- Audio engine skeleton (`AU`), full synth engine + horn; CC0 theme composed.
- Menu scene + state machine + quality settings.

## Phase 1 — The City (DONE)

- Procedural mesh builder (`MB`) → merged vertex-coloured geometry.
- Textures via `CanvasTexture`: roads, signs, billboards, gantries, brand strips.
- 48 Bahrain districts across four governorates, `BUILD_MIX` per style, chunked streaming world
  (`worldUpdate`) with pooling.
- Traffic prototypes: cars, sedans, taxis, vans, pickups, buses, bicycles, bikes.
- Pedestrians: 8 archetypes, procedural rigs, baking, poses.
- Street furniture + props (karak stalls, date/fruit stands, parked bikes, bus stops, poles, wires).
- Time of day, weather, smog, rain; headlights + emissive window night lighting.

## Phase 2 — Gameplay core (DONE)

- Player physics: gears, acceleration, braking, steering, condition (fuel/engine/tyres/damage).
- Job economy: 10 job types across 4 tiers; offers; fares (`base`/`perKm`/`perStop`); comfort→stars→tips.
- Pickup/drop flow, multi-stop (`multi`), long-distance (`long`), strict + risky tiers.
- Hazards: potholes, manholes, speed breakers, rough patches, puddles, cones, roadworks.
- Traffic rules: signals, cross traffic, lane changes, wrong-way riders, bus/pickup mass.
- Police checkpoints (speed limit `CHECK_MAX`) + rush-hour events.
- Crash system, face-mash damage, `crash(o, kind)`.
- Tutorial, HUD, toasts, floaters, offer cards, summaries.

## Phase 3 — Progression & garage (DONE)

- 5 rider levels + `LEVEL_UNLOCKS` gating content visually.
- Garage: service/repair/fuel, 10 upgrade parts, paints (8), outfits (6), bikes (13-model GAUSS AUTO showroom).
- `rebuildBike` regenerates player bike+rider from parts; XP/rewards from jobs.

## Phase 4 — Routes, navigation (DONE)

- `planRoute` + turn-by-turn nav (`navTurn`/`navUpdate`), junction turning with speed limit (`TURN_MAX`), miss/reroute.
- Guidance HUD: nav arrow, signal-state chip, road alerts, destination arrival.
- Route choice unlocked at level 4.

## Phase 5 — PWA / offline (DONE)

- `manifest.webmanifest` + icons (maskable), `sw.js` network-first + offline cache.
- Audio is fully synthesised — there are no audio files to cache; fonts degrade gracefully offline.

## Phase 6 — Hardening & balance (DONE → see Task.md)

- Early-economy balance: opening balance is **BHD 10**, cheapest upgrade is the horn at **BHD 20**, and a
  level-1 shift measures ≈ **BHD 17.9** — so the first purchase lands 1.1 shifts in. The `economy` regression
  group recomputes all of this from `JOBT` weights and fails if the pull disappears, if fare ordering inverts
  at any tier, or if difficulty stops moving pay and density in opposite directions.
- Job-pay curves across all 10 `JOBT` types; level-4 and level-5 work measurably out-earn level-1 work
  (BHD 5.45 and 6.85 against 2.98 on a 3 km job). Absolute weights are still open as a design call.
- Crash recovery: `reportError` surfaces a readable overlay, records the error for the studio, and never
  throws itself. `error-overlay` asserts all three; `fonts-offline` and `no-fouc-block` assert the loading
  screen always resolves even when the webfont request stalls (the font wait is capped at 2 s).
- Save-migration hardening: tri-state camera shake migrates v1 booleans; `saveImport` refuses a newer schema
  and never lets a travelling save overwrite studio-owned fields (the legacy `settings.ads`/`credits`/
  `adLastClaim` keys stay non-travelling — ads are gone but the keys remain schema-stable).
- Touch ergonomics: hands-on device pass still open (see Task.md backlog).

## Delivery pass — Phases 1–9 (DONE)

The second build pass, tracked in Task.md. All nine items shipped.

| # | Item | Shipped |
|---|---|---|
| 1 | PWA + icon set + manifest + service worker, runtime name badge | 192/512/maskable/apple icons, `manifest.webmanifest`, `sw.js`, profile name in the HUD |
| 2 | Road curvature, now **switched off** | `CURVE_ON = false` ships a dead-straight road; `W.curveK/cx/cdx/cy` and the whole warp pipeline are retained behind the flag. Re-enabled only after the bend's two coordinate models were reconciled into one `W.worldX(lateral,d)` and the 2x depth double-count in `warpFrame`/`pt` was fixed. The bend itself previously desynced geometry from every lateral placement, so it is off until the arc-length convention is redone |
| 3 | Road furniture, roundabouts, Bahrain landmarks | Zebra + real sign textures, give-way/speed signs, roundabout islands with trees, bus-stop crossings, fort / refinery flare / corniche / high-rises cycling every 900 m, traffic slows to 5.5 m/s inside a ring. Prop parenting hardened: `Chunk.add()` uses a plain `g.add()`, never `Object3D.attach()` |
| 4 | School zones | `W.schools` zones with signs and fences, 30 km/h cap, 2.4 s grace, BHD 10 speeding fine, horn refused (BHD 5) with a beep instead |
| 5 | Pedestrians | Six clothing variants with backpacks, hi-vis vests, caps and hard hats; crossing/bus-stop FSM that waits at the kerb and resumes when clear |
| 6 | Bahrain bus | Red/cream/white livery, dark glazing with pillars, roof AC, grille, windscreen and side plate; collision box unchanged |
| 7 | Company uniform, cargo branding, bike decals | Brand-coloured shirt + cap, six-face cargo box texture, bold brand-initial decals on both flanks and the nose; toggles rebuild live and persist |
| 8 | GAUSS AUTO showroom | 13 fictional models priced 0–4200 BHD across the five level gates, legacy ids migrated, 3D turntable where VIEW swaps the model and BUY equips and persists it |
| 9 | Final validation + docs | Replaced by the permanent suite: `tools/audit.mjs` (static) + `tools/regress.mjs` (44 headless-Chrome groups). The one-shot `validate.py` and the numbered `pN` scratch scripts are retired; `npm test` is now the gate every release runs |

Also folded in: `syncPassengerRig()` now mounts and clears the pillion rider with the real job state machine, and the HUD job card no longer assumes every job object carries `dropDist`/`est`.

## Phase 6.5 — Rider control (DONE)

- The bike stopped being an on-rails object: `P.yaw` (heading relative to the road tangent, capped at
  `YAW_MAX`), player throttle/brake with a held `P.cruise` speed, and a kerb taken from the real chunk
  geometry via `W.rideLimit(lay)` / `W.asphaltHalf(lay)` instead of a flat `±5.15` clamp.
- `P.d` remains the route spine — `P.z = -P.d`, world queries, traffic, jobs and nav are unchanged — so the
  curved-road work and every existing regression group still hold.
- Controls: `W`/`↑` throttle, `S`/`↓` brake, `A`/`D` lean, `Space` jump, `H` horn. Touch gains **GAS** and
  **◀ ▶** pads; the swipe is now drag-to-lean, flick-up to jump, tap to settle into a lane.
- Off the tarmac the bike runs the existing rough-surface path (tyre wear, dust, lower top speed) plus
  gravel drag; time spent off-road forfeits the safe-driving bonus.

## Phase 6.6 — Landmarks & rider progression (DONE)

- **Landmarks**: 48 districts mapped to 30 baked model kinds (`lmModel`/`lmRegister`; bh uses 18 of the 30, ~19.7k
  triangles for that subset), pooled at load, placed on the
  warped road via `Chunk.place` at the correct tangent, with the building strip skipped on the occupied side.
  Riding past one toasts it, records `SAVE.seen['lm:<id>']` and bumps `SAVE.lmCount`; the shift summary shows
  `LANDMARKS n/48`.
- **Trained skills** (`SKILLS`, 6 × 3 ranks, 1 point per level, SKILLS garage tab): every rank folds into
  `computeStats` through `applySkills`, so the rest of the game reads the effect through the stats it already
  uses — `st.brake`, `st.horn`, `st.grip`, `st.fuelUse`, `skPayMult()` in both the fare quote and the payout.
- **Level perks** (`PERKS`, LV2–LV5): smooth braking (+15% brake), lane filtering (25% narrower collision box
  plus traffic tolerance), night vision (+25% headlight throw), rain grip (`0.82 → 0.95` wet factor). Derived
  from `levelOf(SAVE.xp)` at read time, so no save migration and no desync.
- Regression: the `landmarks` and `skills-perks` groups, alongside the rest of the suite.

## Phase 6.7 — Road craft & rider aids (DONE)

- **The split.** The centre-line between the two middle lanes is painted as a double solid yellow so it reads
  at speed, and threading it pays: a narrow hit taken upright inside `SPLIT.half` is a squeeze past at 0.32×
  damage with a "THREADED" callout, not a square crash. The same skill the whole game is about now has a
  mechanical reward.
- **Indicators read the machine, not the stick.** A committed side stays lit while `|P.yaw|` is still into
  that direction, so releasing the lean mid-manoeuvre does not cancel the blinker before the wheels are
  straight. The first 1.5-lane-filtering reward is a natural place to spend the attention this buys.
- **Overtime.** The feature existed but crashed the game: `UI.otShow` was called and never defined, so the
  first shift end threw. It now has a modal, a live countdown pill, keyboard bindings and clean teardown.

## Phase 6.8 — Ship packaging (DONE)

- **Offline that is actually offline.** Three.js r128 was being pulled from cdnjs, so the offline build
  needed a network to start. Now vendored at `vendor/three.r128.min.js`, already in the SW precache.
  `tools/audit.mjs` fails the build on any remote `<script src>`.
- **`public/` is a mirror, not a fork.** `tools/sync-public.mjs` copies root → `public/` one way, and
  `--check` reports drift in CI. The old `public/music/` stems folder was referenced by nothing (the game
  synthesises every sound) and has since been **deleted**.
- **Android APK, no Gradle.** `android/` is one Activity and one WebView. `tools/build-apk.mjs` runs
  aapt2 → javac → d8 → zipalign → apksigner, which is the pipeline Gradle wraps minus a ~100 MB plugin
  download per machine — the difference between a build that works offline on a fresh checkout and one that
  does not. 663 KiB signed artifact.
- **Save portability.** Export/import via a textarea, because `prompt()` is unsupported in several Android
  WebViews and the async clipboard is unavailable on non-secure origins.
- **Static audit** for the failure modes a modern browser hides: duplicate ids, `$()` lookups that resolve to
  null, player-supplied values reaching `innerHTML`, font stacks with no generic fallback, referenced files
  that do not exist, manifest icons and SW precache entries that point at nothing.

## Phase 6b — Road clearance (DONE)

- The "buildings in the road" defect, closed at the root rather than nudged. The real cause was that
  landmark factories were never wrapped for measurement, so every landmark's footprint came back
  empty and its clearance offset was computed from nothing.
- Three separate width numbers, all derived from the same values the road geometry is built from:
  `W.asphaltHalf` (tarmac), `W.kerb(lay, side)` (outer footway, where a building starts) and
  `W.rideLimit` (player clamp), with `W.kerbClearsRider` asserting the player can never reach a wall.
- Every model self-measures on first build (`measureExtent` / `selfMeasuring` / `EXTENT`) and is
  placed through `clearX` or the `placeClear` tripwire, so no call site holds a hand-tuned offset.
- Fixed by the same pass: landmarks yawed 90° regardless of shape, which turned a bay's 24 m depth
  into a 24 m width and dropped it across the carriageway; the gate arch was 12.4 m wide against a
  16.4 m corridor, so a rider in an outer lane passed *beside* it; `SPAN` listed a `gantry` model
  that does not exist anywhere in the file.
- `road-clearance` regression group: 48 models × 4 layouts × 2 sides × 4 yaws, asserted rather than
  eyeballed. Total suite is now 44 groups.

## Phase 6.9 — Multi-country chapters (DONE)

One engine, three runtime-swappable country chapters. The plan approved in `conversations/` shipped in one pass:

- **Data-driven chapter switch** (`CHAPTERS` + `CHAPTER`): `bh` (Bahrain, the shipped game), `sa` (Saudi
  Arabia — one city, **Riyadh**, 20 districts), `ae` (UAE — one city, **Dubai**, 20 districts). Districts,
  landmarks, streets, bus routes, city store pools, currency formatter, licence-plate format, theme colours
  and a traffic-mix scale all live per chapter. Each chapter is deliberately a *single city* — no Jeddah/
  Neom mix in Saudi, no Abu Dhabi/Sharjah/RAK mix in the UAE.
- **In-place world swap**: `BAHRAIN` is emptied + refilled (so `districtAt`/`pushSeg`/`randomDistrict` never
  change) and `LMARKS`/`LMSIDE`/`STREETS`/`BUSROUTES`/`fmtRs` are reassigned `let` bindings. `CHAPTER.bind()`
  snapshots the bh arrays so the shipped 48-district/48-landmark catalogue is immutable under swaps.
- **Swappable render surfaces**: plate texture (`plateCanvas`/`rebuildPlate` — `MAT.plate.map` swapped in
  place), bus livery + route blinds (`buildTrafficProtos`), traffic mix (per-chapter `trafficScale` in
  `spawnAhead`), theme vars (`--bh`/`--bhAcc` + meta theme-color). Landmarks reuse the pooled builder system
  with 12 new `lmModel` kinds (curvetower, sail, louvre, market, frame, ring, palace, resort, park, cliff,
  rock, line) for the real-famous but fictional-safely-named monuments (Kingdom Centre, Masmak Fortress,
  At-Turaif, Edge of the World — Riyadh; Burj Khalifa, Burj Al Arab, Dubai Frame, Museum of the Future,
  Atlantis, Mall of the Emirates — Dubai).
- **Content rules**: landmark/street *names* may be real landmarks (geography); store/mall/brand names are
  fictional (never ARAMCO/SABIC/STC/EMAAR/ADNOC/ETISALAT/DP WORLD/CARREFOUR). Economy numbers untouched —
  currency is display-only formatting (`fmtRs`: `SR n.nn`, `AED n.nn`, `BHD n.nnn` for bh).
- **UI**: start-screen country tabs, Settings `🌍 Country` row, profile country line — all re-rendered on swap.
- **Save**: `SAVE.chapter` (top-level, default `'bh'`), deepMerge-migrated, export/import-safe.
- Regression: new `chapter-switch` group (bh → sa → ae → bh round-trip), `save-schema` extended. Full suite
  **44/44**. `chapter-switch` also pins the single-city rule: every sa district `gov:'Riyadh'` and every ae
  district `gov:'Dubai'`, with the real Riyadh/Dubai landmark sets present and no cross-city leftovers.

## Phase 6.10 — Author credit & SEO (DONE)

- Start-screen footer gains a single-line credit + backlink: "…public domain · Made by **AL ASAR JADEED**"
  → `https://alasarjadeed.com`, both anchors `rel="noopener noreferrer"` (`start-screen-fit` pins the line).
- Full SEO head: `title`/`description`/`keywords`/`author`/`robots`, `rel=canonical`, Open Graph + Twitter
  cards (image `icons/icon-512.png`), and a JSON-LD `VideoGame` schema (author/publisher AL ASAR JADEED) —
  all pointed at the hosting root `https://alasarjadeed.com/`.
- `robots.txt` + `sitemap.xml` at that root; both flow through `sync:public` into the web zip and APK;
  `audit.mjs` skips `application/ld+json` blocks; `sw.js` → `bike-riders-v14`.

## Phase 6.12 — WORLD RIDERS: opt-in global leaderboard (DONE)

- **First backend feature, built to be deletable.** Supabase (project *Bike Rider*, ref
  `ckssgqvrpogjiobnsfsc`) backs one table, `public.leaderboard`, with a **SELECT-only** RLS policy for
  `anon` and a single `SECURITY DEFINER` write path, `submit_score()`, that clamps every value
  server-side. `top_board()` serves the read. Migrations live in `supabase/migrations/`; deploy with
  `npm run db:push`.
- **No client library.** `SB` talks to PostgREST over plain `fetch` rather than bundling
  `@supabase/supabase-js`, so the "no remote script dependencies" audit rule still holds and the
  single-file architecture is untouched.
- **Offline-first preserved.** Opt-in twice (studio `OWNER.sb.enabled` + player `SAVE.settings.board`);
  read on opening the screen, write only on an explicit **SUBMIT MY BEST**; 7 s abort on every request;
  the last good board is cached for offline display.
- **Web-only, on purpose.** The Android shell declares no `INTERNET` permission and blocks all off-host
  requests, so the board is disabled in the APK (`SB.packaged()`). Loosening that is a privacy decision,
  not a default.
- **Verification:** new `world-board` regression group (12 checks) covering the double opt-in, the
  offline fallback, the timeout path, no-auto-post, rank reporting and escaping of a hostile rider name.
  Suite at **45/45**; audit green.
- **Docs:** `backend scema.md` (new *Supabase* section, new save fields), `security.md` (new *The
  leaderboard backend*), `Architecture.md` (new *WORLD RIDERS* section + recomputed code-section refs),
  `llms.txt`, `Task.md`, `Memory.md`; `sw.js` → `bike-riders-v15`.

## Phase 6.11 — Documentation suite & agent readiness (DONE)

- **Full doc set.** Added `TRD.md` (technical requirements), `app flow.md` (screen/state machine),
  `backend scema.md` (persistence schema — there is **no backend**), `UI-UX Design Brief.md` (HUD,
  screens, controls, a11y), `open graph tags.md` (shipped SEO/social metadata), `Implementation Plan.md`
  (forward plan) and `llms.txt` (llmstxt.org machine summary), alongside the existing
  `Brain.md`/`PRD.md`/`Architecture.md`/`Design.md`/`Phases.md`/`Task.md`/`Memory.md`/`Rules.md`/
  `security.md`/`licence.md`.
- **Drift fixed.** Stale `public/music/` (334 MB) claims removed across the docs — the folder was deleted
  (all audio is synthesised); the working path, doc map and tooling list corrected.
- **Ships to crawlers.** `llms.txt` joined `tools/sync-public.mjs`'s `FILES`, so it flows into `public/`,
  the web zip and the APK alongside `robots.txt`/`sitemap.xml`.
- **Auto index.** `tools/auto-mcp-index.sh`'s doc list expanded to the whole set; `mcp-index.md` regenerated
  (generated, never hand-edited).
- **Flagged, then decided (2026-10-21):** the "Bike Rider" vs "BAHRAIN RIDERS" naming split was forced
  to a conclusion by an AppGallery rejection under rule 9.5 — the product shipped briefly as **BAHRAIN
  RIDERS** (package `com.bikerider.game`), then v1.0.5 renamed it back to **BIKE RIDER** at the
  owner's request, accepting the risk of a second rejection. The `package.json` MIT vs `licence.md` CC0
  mismatch remains parked in `Implementation Plan.md`.

## Phase 8 — AppGallery release (DONE, 2026-10-21)

- **Rule 9.5 name rejection → rename → deliberate revert.** The submission shipped as "Bike Rider",
  which AppGallery ruled similar to the existing game *Bike Rider*. v1.0.4 relabelled the product
  **BAHRAIN RIDERS** to clear the rejection; v1.0.5 renamed it **back to BIKE RIDER** by owner decision,
  re-applying the name that was rejected. The risk is documented in `Rules.md` rule 3, not hidden.
- **Android project restored.** The Gradle module under `android/app/` was incomplete (no manifest), which
  silently broke every release build; it was regenerated with the new package identity, plus a checked-in
  offline manifest for the raw-toolchain path.
- **`npm run build:aab` added** — the AppGallery `.aab` artifact, alongside the existing sideload APK.
  Gradle wrapper pinned to 8.2.1 because the Huawei AGCP plugin cannot run on Gradle 9.x.
- **Payload hygiene, three fixes.** `public/Screenshot/` (12 MB of listing screenshots + promo video,
  referenced by nothing) was being baked into every artifact — the APK/AAB/web-zip had ballooned from
  ~1.5 MB to ~12.6 MB; it is now excluded in all three build tools. `writeSums()` no longer truncates
  `dist/SHA256SUMS` to the last build's artifacts but lists every new artifact in `dist/`.
  `tools/device-check.mjs` no longer hard-codes a package id that had drifted from the real
  `applicationId`; it reads the Gradle module instead.
- **Verified end to end:** static audit clean, 50/50 regression groups, APK + AAB both read
  `BIKE RIDER` / `com.bikerider.game` and verify against the `CN=Bike Rider` release key.

## Phase 7 — Polish & depth (NEXT)

- Ambient district audio layers; near-miss bonuses; passenger dialogue bubbles.
- Daily local leaderboard.
- Accessibility: font-size scaling and vibration (reduced motion shipped as the tri-state shake setting).
- Hands-on performance and ergonomics pass on a low-end Android device.

## Phase 8 — Studio monetisation (DONE, owner-only)

- Ads and credits are **not** player settings. All ad config, credit issuing, premium granting and the revenue ledger live on the hidden, passcode-gated `#screenAdmin` page (5 taps on the logo, or `?admin`).
- Studio store: `OWNER` in `localStorage['bahrain_riders_owner_v1']`, separate from the player save. Providers: in-house simulator, AdMob (app + unit id), YouTube (video id); studio config overrides the save.
- Player-facing surface is only the studio house ad between shifts (owner's ad revenue) — skippable after the studio `skipAfter`, length from studio `length`, with a global on/off kill switch. Premium (owner-granted) removes it. Progress reset is ad-gated unless premium or ads are off.
- Credits are issued by the owner (+1/+5/+10/+50, take all); premium is grantable or sellable for credits. `fetchRemoteConfig()` is the backend stub for pushing config from a URL.
- Ledger: house ads shown, reward ads shown/completed, credits issued, premium sold, credits taken, last sync. Test ads never touch the ledger.

## Later (dreaming)

- Level-5 exclusive content (the "legendary" route set).
- Post-market: WebShare → store landing; localised Hindi/English audience test.
- Possible conversions: Arcade cabinet controller bindings (keyboard HW overlays already exist).

## Road-geometry pass (straight road + clearance)

The bend is off (`CURVE_ON = false`) and four defects found while turning it off are fixed and guarded:

- `Chunk.warpFrame()` and `Chunk.pt()` each advanced the along-road distance by the local `lz` on top of
  `d0`, so each 40 m chunk drew 80 m of road. Both now share `d = d0 - lz`. Guard: `curvature-consistency`
  (chunk spans exact, `warp`/`pt` mutually consistent, drawn mesh == `W.worldX`), plus `road-geometry`.
- `Chunk.add()` re-parented with `Object3D.attach()`, which overwrites the local transform `place()` had just
  set with the world matrix of whatever chunk the prop was recycled from. Pooled buildings came back mirrored
  180 deg across the carriageway. Now a plain `g.add()`, `place()` writes all three Euler axes, and `poolGet()`
  resets a recycled prop. Guard: `road-clearance-live` asserts no placed prop carries any roll or pitch —
  verified to fail when `attach()` is put back.
- `placeClear()` takes a **signed** lateral, but the petrol-station and bus-stop call sites passed the kerb
  magnitude while asking for `side = -1`, so the clearance test read the far face and the station straddled the
  tarmac. Now `sx*W.kerb(lay,sx)`. Guard: `road-clearance-live`.
- `W.rideLimit` / `W.kerb` per-layout branches (highway 9.4 m, street 8.6 m) stay as they are.

## Offline pass

- **`sw.js` was never registered.** Nothing in the project called `navigator.serviceWorker.register`, and `sw.js`
  was not referenced by `index.html` or the manifest, so a cold offline start had no engine at all and the PWA
  claim was untested. `registerServiceWorker()` now installs it, and handles the `file://` and no-support cases
  without ever being able to block boot.
- **`offline-boot`** (new group) stands up a second server, waits for the worker to take control and fill its
  precache, then **shuts the server down** and reloads. The game must boot with no network at all, serving Three.js
  r128 and the road out of the cache. It asserts the font fallback stack too, since the webfonts are cross-origin
  and the worker is same-origin only.
- **Harness fix**: `launch()` took a fixed CDP port, so a leaked Chrome from an earlier run would answer
  `/json/list` and the suite would drive a stale profile — which is how the new test first "passed" with the
  registration commented out. It now takes a free port and refuses to attach to a busy one.
- **`tools/device-check.mjs`** (`npm run device`) automates the mechanical half of the on-device pass: install,
  cold launch, non-blank frame, clean logcat, then all of it again in aeroplane mode. Audio, the hardware back
  button and touch ergonomics still need a human.

Result: the offline pass stood at 29 green groups at the time; the permanent suite has since grown to **44/44**.

## Evergreen

- Every phase ships with: SW `VERSION` bump, `npm run sync:public`, `npm test`, a real-device manual pass,
  `CREDITS.txt` sync, and a docs refresh. The full list is the release checklist at the bottom of Task.md.
- The in-app `autotestStep` autotest is gone; the permanent gate is `npm test` (static audit + 44 headless
  Chrome groups over CDP), and `?debug` / `?test` / `?clearance` remain the seams it drives.