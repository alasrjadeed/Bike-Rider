# BIKE RIDER — Task.md

Working task tracker. Check off as work is done. Keep this honest and current — Phases.md is the roadmap, Task.md is the queue.

## Legend

- `[x]` done
- `[ ]` open
- `>` blocked / waiting
- `!` needs discussion

## Current state

The core game is playable end-to-end. Remaining work is polish, balance, content depth and hardening. See Phases.md for the phase against each region.

**Shipped name: BIKE RIDER** (package `com.bikerider.game`). AppGallery rejected this name under rule 9.5 as too similar to the existing game *Bike Rider*; the product was briefly renamed **BAHRAIN RIDERS** in v1.0.4 to clear that, then **deliberately renamed back to BIKE RIDER** in v1.0.5 at the owner's request. The rename is a known, accepted risk of a second 9.5 rejection — see `Rules.md` rule 3. See the 2026-10-21 entry in the Active sprint.

## Active sprint

- [x] **Rename to BIKE RIDER for AppGallery rule 9.5 + reproducible release build (2026-10-21).**
  - **Why:** AppGallery review rejected the submission — *"the name of your game is similar to that of
    game Bike Rider… provide authorization documents or modify the name"*. The project already owned
    an original brand (BIKE RIDER), so the name was changed rather than licensing a third party's.
  - **Product name** now BIKE RIDER in: `index.html` `<head>` (title, description, keywords, OG,
    Twitter, JSON-LD `name`/`alternateName`), the loading logo + sponsor-ad canvas text, the
    "plays in landscape" string in all 7 languages, `manifest.webmanifest` `name`/`short_name`,
    `robots.txt`, `sw.js` cache name (`bike-rider-v19`), `CREDITS.txt`, `PUBLISH.md`.
  - **Launcher label** `BIKE RIDER` in `android/app/src/main/res/values/strings.xml`.
  - **Package identity** `BikeRider.huawei` → `com.bikerider.game` across `app/build.gradle`
    (`applicationId` + `namespace`), the `MainActivity` package + its directory,
    `agconnect-services.json` `package_name` (root and app copy), and both manifests.
  - **Android project regenerated.** The Gradle module under `android/app/` (manifest, `res/`,
    `strings.xml`, `build.gradle`, `agconnect-services.json`) is complete again, and `android/AndroidManifest.xml`
    is a checked-in offline manifest for the raw-toolchain APK path, which previously read a file that
    no longer existed and could not build at all.
  - **`npm run build:aab`** (`tools/build-aab.mjs`, new) runs `gradlew bundleRelease` and writes
    `dist/BikeRider-<version>-<appId>.aab` — the AppGallery artifact. `build:apk` keeps working
    for sideloading. Gradle wrapper pinned to **8.2.1** (9.x breaks Huawei's AGCP plugin).
  - **Version** 1.0.3 → **1.0.4** (versionCode 4); `sw.js` VERSION bumped; `sync:public` run.
  - **Verified:** static audit clean, 50/50 regression groups pass, APK badging reads
    `label='BIKE RIDER'` / `package='com.bikerider.game'` and verifies against
    `CN=Bike Rider`; the AAB is signed and carries the same label and package.
  - **Deliberately NOT renamed:** the in-game fictional courier company "Bike Rider" (player-editable
    settings default, `licence.md` fictional-brands table, `PRD.md`). It is invented fiction inside the
    game, not the app identity — see `Rules.md` rule 3.
  - **Payload-hygiene fixes (same day).** `public/Screenshot/` (12 MB of AppGallery listing screenshots +
    a promo video, referenced by nothing) had been copied into `public/` by hand and was being baked into
    every artifact — the APK/AAB/web-zip had grown from ~1.5 MB to ~12.6 MB. It is now excluded by
    `SKIP`/`EXCLUDE` in `build-apk.mjs`, `build-aab.mjs` and `build-web.mjs`. `writeSums()` in
    `tools/build-web.mjs` no longer truncates `dist/SHA256SUMS` to the last build's artifacts — it lists
    every release artifact in `dist/`, newest version only, so the AAB/APK/zip entries survive any build
    order. `tools/device-check.mjs` no longer hard-codes a package id (`com.bikerider.app`, which never
    matched) and reads `applicationId` from `android/app/build.gradle` instead.
  - **Open:** the app icon artwork still reads "BIKE RIDERS"; regenerate via `tools/make-icons.py` if the
    reviewers object to the wordmark, and set the AGC console package name to `com.bikerider.game`
    or `com.huawei.agconnect` fails the build.
- [x] **WORLD RIDERS — opt-in global leaderboard on Supabase (2026-10-17).** The game's first (and
  only) backend feature, built to be deletable and to leave the offline promise intact.
  - **Backend:** Supabase project *Bike Rider* (`ckssgqvrpogjiobnsfsc`). Migration
    `supabase/migrations/20261017114500_leaderboard.sql` + `…115000_fix_submit_score.sql` create
    `public.leaderboard`, RLS with a **SELECT-only** policy for `anon`, and the `SECURITY DEFINER`
    functions `submit_score()` (the single write path, clamps every value) and `top_board()`.
    Applied with `npm run db:push`.
  - **Client:** zero-dependency `SB` module in `index.html` — plain `fetch` against PostgREST, so
    `@supabase/supabase-js` is never bundled or loaded from a CDN and the "no remote script
    dependencies" audit rule still holds. 7 s `AbortController` timeout, offline board cache
    (`br_board_cache_v1`), UUID `SAVE.deviceId`.
  - **Consent twice + offline:** `OWNER.sb.enabled` (studio, admin panel) **and**
    `SAVE.settings.board` (player Settings → *Global board*). Either off ⇒ no request. Reads on
    opening the board; the only write is an explicit **SUBMIT MY BEST**.
  - **Security:** client holds only the *publishable* key; RLS is the boundary. Direct
    `INSERT`/`PATCH`/`DELETE` from `anon` verified blocked; server-side clamps verified live. Names
    from other devices are untrusted and rendered through `esc()`.
  - **APK limitation (important):** the Android shell declares **no `INTERNET` permission** and
    blocks all off-host requests, so the board is **web-only**. `SB.packaged()` detects the shell
    and the screen says so instead of pretending to be offline. Enabling it in the APK would change
    the app's privacy posture — left off deliberately.
  - **Tests:** new `world-board` regression group (12 checks) + audit still green. Suite: **45 passed, 0 failed**.
  - **Docs:** `backend scema.md` (new *Supabase* section + `deviceId`/`board` fields), `security.md`
    (new *The leaderboard backend*), `Architecture.md` (new *WORLD RIDERS* section + recomputed
    code-section line refs), `llms.txt`, `sw.js` VERSION → `bike-riders-v15`.

- [x] **Documentation suite expanded + auto index (2026-10-17).** The project's docs are now a complete,
  cross-linked set covering product, technical and operational ground:
  - **New:** `TRD.md` (technical requirements), `app flow.md` (screen/state machine + journeys),
    `backend scema.md` (persistence schema — documents the local save/owner stores; there is **no server**),
    `UI-UX Design Brief.md` (HUD/screens/controls/accessibility), `open graph tags.md` (shipped SEO/social
    metadata + validation), `Implementation Plan.md` (forward plan + acceptance criteria), and `llms.txt`
    (llmstxt.org machine summary).
  - **Refreshed:** removed stale `public/music/` (334 MB) claims from `Architecture.md`/`Memory.md`/`Design.md`/
    `Brain.md` (the folder was deleted — all audio is synthesised); corrected the working path and the file map
    (root `favicon.*`/`music/` do not exist; `llms.txt` added); updated the doc map in
    `Architecture.md`/`Memory.md`/`Rules.md`; added a "living docs + machine index" decision to `Brain.md`;
    recorded the phase in `Phases.md` (6.11).
  - **Ships to crawlers:** `llms.txt` added to `tools/sync-public.mjs`'s `FILES` (flows into `public/`, the web
    zip and the APK next to `robots.txt`/`sitemap.xml`).
  - **Auto MCP index:** `tools/auto-mcp-index.sh` `DOCS` list expanded to the full set; `mcp-index.md`
    regenerated (generated file — never hand-edit).
  - **Flagged, not silently changed:** the shipped **"Bike Rider"** naming vs the docs' **BIKE RIDER**, and
    `package.json` `"license":"MIT"` vs `licence.md` **CC0** — parked in `Implementation Plan.md` →
    *Known inconsistencies*.
  - No game code, assets, balance or save data were changed by this pass.

- [x] **Driving was on rails.** `playerUpdate` always accelerated to `st.top` and snapped the rider across
  lanes with a clamped `P.vx`, and a hard `|x| <= 5.15` wall stopped the bike at the edge of the tarmac
  regardless of the layout. The rider now owns the machine: `P.yaw` is a real heading relative to the road
  tangent, the throttle is an input (`W`/`↑`, or the new **GAS** pad), braking sets the speed you coast at,
  and the kerb comes from the chunk geometry via `W.rideLimit(lay)` / `W.asphaltHalf(lay)`.
  `P.d` stays authoritative for the route, so `P.z = -P.d` and every world query is untouched.
  Off the tarmac the bike now runs through the existing rough-surface path (tyre wear, dust, 0.72 top speed)
  plus extra gravel drag past 7.2 m, and time spent off-road forfeits the safe-driving bonus.
  Regression: new `/tmp/opencode/handling.mjs` + all 14 existing suites, 0 errors.

- [x] **Landmarks, rider skills and level perks.** Bahrain districts now carry a real monument: 33 districts
  mapped to 18 models (dome, gate, fort, ruin, wheels, circuit, tower, villa, mound, fountain, palms, …),
  built once at load, pooled, placed on the warped road through `Chunk.place` (so they sit on the curve and
  never fall into the void), and skipped on the side they occupy. Riding past one toasts it and records it
  in `SAVE.seen` / `SAVE.lmCount`, with an `n/33` readout on the shift summary. Two skill layers now stack:
  **trained skills** (1 point per level, 6 perks × 3 ranks, trained in the new SKILLS garage tab) fold into
  `computeStats` — brake +9%/rank, horn yield +16%, grip +11%, fuel −7%, cash +6%/rank, less shake and pothole
  punishment — and **level perks** (LV2 smooth braking, LV3 lane filtering, LV4 night vision, LV5 rain grip),
  which are *derived* from `levelOf(SAVE.xp)` so they can never desync or need a save migration.
  Regression: new `/tmp/opencode/lm.mjs` + `/tmp/opencode/sk.mjs` + `handling.mjs` + all 14 suites, 0 errors.
  Side fix: granted skill points are now persisted the moment they are awarded, not on the next save.

- [x] **Regression suite green end-to-end (40/40).** `tools/regress.mjs` was 13/40; the missing game APIs are
  now in the single-file `index.html` — `W.worldX(lx,dist)`, the global `SPAN` span allow-list,
  `UI.saveIO()` returning `true`, and the `Oasis Mall` store entry — plus three real frame bugs that the
  suite was written to catch: `Chunk.pt()`/`warp()` rotated the longitudinal offset a second time (every
  chunk drew 2×CHUNK and overlapped its neighbour), `Chunk.place()` wrote only `rotation.y` after
  `Object3D.attach()` had decomposed a 180° yaw into Euler (π,0,π), so a prop reused on the opposite side
  kept the old x/z and mirrored across the carriageway, and `poolGet` never reset a recycled prop's
  rotation. `npm test` (audit + regress) is 40/40, `sync:public` run, `build:web` and `build:apk` green.

- [x] **Device install (2026-10-06).** SDK was missing on this machine, so a portable Temurin JDK 17
  (`/home/oem/tools/jdk-17.0.20.1+1`) and the Android SDK (`/home/oem/Android/Sdk`, cmdline-tools +
  build-tools 34.0.0 + platforms;android-34 + platform-tools) were installed without sudo; build with
  `ANDROID_SDK_ROOT=/home/oem/Android/Sdk` and that JDK on `PATH`. The phone had to be **uninstalled
  first**: its build was signed with `android/release.keystore` (`CN=Bike Rider, OU=Games`), which no
  longer exists on this machine, so no update could match it — and it was not debuggable, so its save
  could not be pulled. `npm run device` = 13/13 (online + airplane-mode cold launch, no fatal logcat).

- [x] **UI/visual fix batch (2026-10-07).** Four player-reported issues on the handset build, then rebuilt + reinstalled:
  - **Road still blocked by a school fence** on some layouts: `schoolFence` reoriented `ry=0` along the road
    at `fx=-(W.rideLimit(lay)+0.35)` with two 24 m rails at `lz=±13` giving a gate gap, skipped on the
    highway; `POOL.make.island` is now a flat painted mini-roundabout (RingGeometry 2.2–3 + CircleGeometry 2.2
    at `y=0.05`, `depthWrite:false`, `renderOrder:1`) holding `island` surface, lamps removed from it;
    `road-clearance-live` extended (skip only surface/span, straddle check for 'over', 3.5 m inner-face
    envelope; solid keeps the tarmac-band check), forces a school chunk non-vacuous, and the old `PI/2` yaw
    is asserted to fail.
  - **HUD text hid the road**: `hudMode:'auto'` default (`defaultSave` + `migrateSettings` coerces non-'full'
    to 'auto'), `#btnHudEye` toggle in `#hudRight`, body-class fading for hudCash/hudJob/rateBox/clockBox/cond
    (opacity + pointer-events only, never `display`), idle bump in `UI.hudUpdate`, Settings `HUD in play` row.
  - **Gauss Auto showroom** (new) — bike hidden behind the opaque `.showCard` (`rgba(10,13,20,.92)`) bottom-centre:
    the info card is now a **translucent right sidebar** (`#showBar` fixed, `top:120px; bottom:64px; right:0`,
    `width:min(340px,38vw)`, gradient scrim, `.showCard` `rgba(5,6,8,.45)` + backdrop blur, height-capped with
    internal scroll); the showroom background lightened (`.1` centre alpha) so the turntable bike reads dead-centre;
    `.gFoot` docks at the bottom (`margin-top:auto`) and clears the sidebar width. `showroom-viewer` now asserts
    the card is a right sidebar (left > 60vw, no edge overflow); `showroom-viewer-phone` emulates a **landscape**
    740×360 handset (the game is played landscape), samples the bike zone left/centre, and asserts the sidebar/card
    stay on-screen.
  - **In-play overlays transparent + small on phones**: `--panel` → `rgba(5,6,8,.52)`, `--panel2` → `rgba(6,7,10,.68)`;
    `@media (max-height:520px)` and `(max-width:760px)` compact the HUD readouts (cash 16/17px, job place 12px,
    job stats 15px, nav 17/10.5px, cond 9.5px) so the road stays visible while riding.
  - **JUMP button did nothing**: `IN.jumpPressed` (Space / `#tJump` / swipe-up) was set but never consumed —
    `playerUpdate` only read the autopilot's `jump`. Manual input now sets `jump=IN.jumpPressed` before the
    per-frame reset, so the pad, Space, and swipe-up all launch the rider at `P.speed>3`.
  - **New app icon/logo** installed from `Favicon/Bike Riders App .png` (37 files) via `install-app-icon.mjs`.
  Full suite 40/40, `sync:public` + `build:web` (1173 KiB) + `build:apk` + `adb install -r` green. `npm run
  device` re-run hit the keyguard (phone locked) — resume-check fails are environmental, app launches/renders.

- [x] **Showroom rider + helmet inspection (2026-10-07).** Player-reported SHOW RIDER "not working" and
  "helmet not show" in Gauss Auto:
  - `showroomHelmStep` cycled `SHOW.helmT` but `riderAppearance()` rebuilt with `helmetStyle()` — the shell
    literally never changed. `riderAppearance` now honours `HELM_PREVIEW` (non-purchase tier preview),
    `showroomHelmet` seeds/clears `HELM_PREVIEW` and re-renders the sidebar (it previously left the button
    label stale — same class of bug that made toggles feel dead), `showroomHelmSet(t)` picks a tier directly.
  - New **HELMET** control in the showroom card: toggle + the four tier buttons (`.helmetRow` — the CSS always
    existed but no markup/actions were wired) + a `.helmInfo` details line (fitted helmet shows brand/name/
    quality/crumple bonus). Helmet mode forces the rider on and the camera close-ups on the rider head
    (`showroomCamera`), then restores the bare turntable + rider state on exit.
  - **Handset-res mismatch**: the physical phone is 1080×2316 @450dpi = **823 CSS px landscape**, wider than the
    `max-width:760px` every phone layout used, so the garage/HUD quietly fell back to desktop layout on-device.
    Phone rules now also fire on `(max-height:520px) and (orientation:landscape)`; `showroom-viewer-phone`
    emulates the real 823×384. Text panels lightened further (`--panel .45`, `--panel2 .58`, showCard `.32`).
  - New group `showroom-rider-helmet` drives the actual buttons (`garageAction('helm'|'helmT')`) and asserts
    toggle, label flips, forced rider, head close-up preconditions, tier rebuild + highlight, clean exit.
  Full suite 41/41, `sync:public` + `build:apk` + `adb install -r` → Success, `npm run device` 13/13.

- [x] **Sponsored session unlock + helmet restyle (2026-10-07).** Owner wired their YouTube sponsor film to the
  low-credit unlock flow and asked the helmets to look more distinct:
  - **YouTube sponsor is the default ad.** `OWNER_DEF.ads` + `defaultSave().settings.ads` → provider `youtube`,
    `ytVideo:'yu9rldyKpIw'`; `migrateSettings` / `loadOwner` upgrade vintage saves (non-admob producers turn
    youtube, empty id gets the film). `adOpen` falls back to the offline house ad when the film can't play.
  - **Ads now truly run 15s.** The old code granted `youtube`+`reward` instantly at `adOpen` and made the
    youtube `CLOSE` appear immediately (`renderAdButtons` shortcuts), so "ad time" was ~0s. Instant grant
    removed; `renderAdButtons` requires `AD.t>=adLength()` (15s default) for both close + grant.
  - **Low-credit unlock:** new `adSessionUnlock()` + `syncUnlockButtons()` show a gold
    `▶ WATCH VIDEO — UNLOCK NEXT SESSION` button in the garage and on the shift summary when credits are 0
    (not premium, not tutorial, cooldown clear). Watching grants +1 credit (`adGrant`), which hides the offer.
    i18n keys added for en/ar/ar-bh.
  - **Helmet restyle:** the four tier shapes in `personGeos` are now visibly distinct — Half Shell (low hemi +
    sun peak + chin nub), Open Face (round shell + bare face + peak + chin bar), Full Face (visor + glint +
    chin guard + top ridge), Premium Modular (gold jaw trim + aero tail fin + dark visor). Interior parts are
    pointless in solid shells, so every new part sticks out of the shell/head surface.
  - New group `sponsored-unlock` asserts provider/id wiring, 15s length, no instant grant, grant at timer end
    (+1 credit), offer visible at 0 credits and gone after. Full suite 42/42, device 13/13.

- [x] **Offline grace, editable company name, sponsor video actually plays (2026-10-07).** Follow-ups from the
  owner session:
  - **Offline auto-unlock:** the sponsor film needs the network, so when the device is offline the low-credit
    gate opens by itself after 60s — no ad, no charge. New `offlineUnlockTick(dt)` (called from `tick`, next to
    `adUpdate`) accumulates only while `adSessionUnlock()` is live AND `navigator.onLine===false`; the gold
    unlock buttons show `OFFLINE — UNLOCK IN Ns`; at the mark it grants +1 credit, persists, and hides the
    offer (resets on going online / claiming / an open ad). Group `offline-auto-unlock` pins it: no grant
    online, countdown accumulates offline, grant at 61s simulated, offer gone after.
  - **Company name editable:** the Settings "Company name" field had an input preview but no Save, so it felt
    locked (and my first Save button had a TDZ bug — `const v=coName?v.value` referenced `v`). It now has a
    Save button (+ Enter key), persists, rebuilds bike decals + cargo box + badge, and shows a floater.
    Group `rider-company-edit` asserts input preview, save, and localStorage persistence.
  - **Sponsor video was blocked in the APK by design:** the shell had no `INTERNET` permission and
    `LocalAssetClient` 403'd every off-host request, so the YouTube embed could never load. Added
    `android.permission.INTERNET` and a strict host whitelist in `shouldInterceptRequest` (`youtube.com`,
    `youtube-nocookie.com`, `ytimg.com`, `googlevideo.com`, `ggpht.com`) — everything else still refused.
  - **Shell no longer kidnaps the app:** `shouldOverrideUrlLoading` used to `ACTION_VIEW` *every* off-host URL,
    so subframe navigation inside the sponsor embed could bounce the player out to the YouTube app. It now
    only overrides main-frame, non-video-host URLs (`mailto:`, the CC0 licence…).
  - New groups `offline-auto-unlock` + `rider-company-edit`. `sw.js` → `bike-riders-v11`. Full suite **44/44**,
    device **13/13** (incl. offline cold launch).

- [x] **Ads removed — free play (2026-10-07).** The sponsor YouTube ad, the sim house ad, the low-credit unlock
  gate and the forced ads don't belong in a kids/bespoke app, so everything player-facing is gone and the game
  is free play end-to-end:
  - No forced ad at shift start; the shift simply starts. No ad gate on RESET — progress wipes instantly (the
    "watch an ad to reset" confirm, `AD.onReset` and `adWaitLeft()` gating are deleted).
  - The low-credit session lock is gone entirely: `adSessionUnlock()` is a hard `false`, the gold
    `▶ WATCH VIDEO — UNLOCK NEXT SESSION` buttons (garage + summary) are removed from markup/CSS/i18n, and the
    offline auto-unlock countdown (`offlineUnlockTick`/`OFFLINE_UNLOCK_MS`) is deleted. Credits row dropped from
    the profile screen (credits were the ad currency).
  - The studio admin panel lost the AD NETWORK, REWARDS & CREDITS and REVENUE LEDGER sections (ads, provider,
    AdMob/YouTube ids, length/skip/reward/premium config, test-ad buttons, ledger stats); `adminRender` now only
    fills the BACKEND config URL. The ad engine + modal stay dormant in the code (nothing calls `adOpen`) so the
    studio can re-enable politely later — players never see an ad or an ad-shaped lock.
  - Android shell reverted to offline-by-construction: `INTERNET` permission removed, `VIDEO_HOSTS`/`isVideoHost`
    wl whitelist deleted, `shouldInterceptRequest` blocks every off-host request again; the fixed
    main-frame-only `shouldOverrideUrlLoading` guard is kept so no third party can yank the app elsewhere.
    `device-check.mjs` lost the youtube-nocookie NetworkError tolerance (no embed anymore).
  - Regressions rewritten for free play: `house-ad-gate` → `free-play` (no unlock offer, no forced ad on
    `startShift`, instant gated reset); `sponsored-unlock` + `offline-auto-unlock` groups deleted.
    `sw.js` → `bike-riders-v12`. Full suite **42/42** (44 − 2 removed ad groups), `build:web` + `build:apk`
    green (APK has **no permissions** — INTERNET is gone), device **13/13** (online + airplane-mode cold launch).

- [x] **Multi-country chapters (2026-10-07).** The one approved plan shipped: one engine, three runtime-swappable
  country chapters — 🇧🇭 **Bahrain** (the shipped game, untouched), 🇸🇦 **Saudi Arabia**, 🇦🇪 **UAE**:
  - **One engine, real data swap.** `CHAPTERS` (declared after `padCityInvariants`) holds three self-contained
    chapter profiles: districts (~20 each), landmarks, streets, bus routes, licence-plate format, currency
    formatter, theme colours, and a per-chapter `trafficScale`. The live world globals are swapped in place —
    `BAHRAIN` is mutated (`length=0` + `push`, so `districtAt`/`pushSeg`/`randomDistrict` need no changes) and
    `LMARKS`/`LMSIDE`/`STREETS`/`BUSROUTES`/`fmtRs` went from `const` to `let` and are reassigned. The `bh`
    chapter's arrays are **snapshots** taken by `CHAPTER.bind()` so swapping away can never clobber the shipped
    catalogue (48 districts / 48 landmarks — the `place-names-real` group stayed green throughout).
  - **Swapping live** (`CHAPTER.set`): change `SAVE.chapter`, persist, then `padCityInvariants()` → `lmRegister()`
    (landmark pools pick up the chapter's kinds) → `rebuildPlate()` (licence plate canvas swaps country/colours)
    → `trafficClear()` + `T.pool={}` (buses/vehicles die with their livery) → `buildTrafficProtos()` (bus colour +
    route blinds come from the chapter) → `worldReset()`/`playerReset()`/`rebuildBike()` → toast + UI re-render of
    the country tabs, profile row and settings row. `buff` geometry reuses the existing `MAT.plate` material — only
    its `.map` is replaced, no bike rebuild needed.
  - **New landmark kinds.** 12 authored builders added to `lmModel` (30 kinds total): `curvetower` (Kingdom Centre /
    Burj Khalifa sky bridge), `sail` (Burj Al Arab wedge), `louvre` (lattice dome), `market` (grand souq hall),
    `frame` (the Frame), `ring` (Museum-of-the-Future torus), `palace` (Emirates Palace), `resort` (Atlantis),
    `park` (palms + pavilion), `cliff` (desert escarpment), `rock` (carved tomb), `line` (NEOM). `LMY` extended in
    step (still unused — dead code by design). Chapter shifts place these for real: `worldReset()` builds 10 chunks
    of the new country during the swap, so the whole geometry path is covered by the regression group.
  - **Content is fictional but real-feeling.** Iconic landmark **names** stay real-famous — **Riyadh**: Kingdom
    Centre, Al Faisaliah Tower, Masmak Fortress, Murabba Palace, At-Turaif (Diriyah), Edge of the World, Wadi
    Hanifah, KAFD, Riyadh Water Tower; **Dubai**: Burj Khalifa, Burj Al Arab, Dubai Frame, Museum of the Future,
    Atlantis The Palm, Mall of the Emirates, Dubai Marina, Deira Gold Souk, Safa Park — geography is fine; only
    trademarks were fictionalised. Stores/malls/branding are invented per country (no ARAMCO/SABIC/STC/EMAAR/
    ADNOC/ETISALAT/DP WORLD/CARREFOUR), currencies are display-only (`fmtRs`: `SR n.nn` / `AED n.nn`, body
    `BHD n.nnn` untouched).
  - **Single-city chapters (2026-10-07).** `sa` is **Riyadh only** and `ae` is **Dubai only**: all 20 districts
    per chapter are real neighbourhoods of that one city (`gov:'Riyadh'`/`gov:'Dubai'`), and every landmark,
    mall, street and bus route is Riyadh/Dubai content — the old cross-country mixes (Jeddah/Mecca/Medina/
    Dammam/NEOM in sa; Abu Dhabi/Yas/Saadiyat/Sharjah/RAK/Fujairah/UAQ in ae) are gone. Landmarks were re-assigned
    to their true districts (Burj Al Arab → Jumeirah, Dubai Frame → Zabeel, Museum of the Future → DIFC,
    Masmak Fortress → Qasr Al Hukm, At-Turaif → Diriyah) and 9 new Riyadh/Dubai districts replace the removed
    ones (Hittin/KAFD, Al Janadriyah, Umm Al Hammam, Manfuhah, Al Wizarat… / Al Barsha, Zabeel, Emirates Hills,
    Dubai Creek Harbour, JVC, Jebel Ali, Al Karama, Al Safa, Al Khawaneej). `chapter-switch` now also asserts
    the single-city rule (every sa district `gov:'Riyadh'`, every ae district `gov:'Dubai'`, Riyadh/Dubai
    landmark rosters present, no cross-city leftovers). Full suite stays **44/44**.
  - **Author credit + backlink + SEO (2026-10-07).** Start-screen footer now reads "…public domain · Made by
    **AL ASAR JADEED**" with the https://alasarjadeed.com backlink (kept to one line — `start-screen-fit`
    re-verified). Full SEO head: `title`/`description`/`keywords`/`author`/`robots`, `canonical`
    (https://alasarjadeed.com/), Open Graph + Twitter cards, JSON-LD `VideoGame` schema (author/publisher
    AL ASAR JADEED). New `robots.txt` + `sitemap.xml` (hosted at the alasarjadeed.com root) flow through
    `sync:public` into the web zip and APK; manifest `description` + `lang` updated; `package.json`
    `author` set; `audit.mjs` skips `application/ld+json` blocks; `sw.js` → `bike-riders-v14`.
  - **UI**: start screen gets country tabs (`.chapterTab`, themed per active country), settings gets a `🌍 Country`
    row (`data-ch` seg), the profile card shows flag · country · currency code, and `applyTheme` re-colours the
    `--bh`/`--bhAcc` vars + `meta theme-color`.
  - **Save**: `SAVE.chapter` is a top-level field of `defaultSave()` (`'bh'` default) — `deepMerge` forward-migrates
    old saves, export/import carries it, unknown ids fall back to `bh`.
  - New group `chapter-switch` (bh → sa → ae → bh, asserting districts/landmarks counts, money format, theme var,
    bus livery, save persistence, full bh round-trip). `save-schema` now also pins the default. Full suite **43/43**.
  - **Bug (2026-10-07): menu cut off on the phone.** On a landscape handset (1080×2316 @450dpi = 823×384 css px) the
    start screen's column — logo, truckart, the new country tabs, difficulty picker, START, and the
    GARAGE/SETTINGS/FULLSCREEN row — was taller than 384 px, and `#screenStart` had no `overflow`, so the bottom
    row was clipped and unreachable. Fixed two ways: (1) compact the menu under `@media (max-height:520px)` (smaller
    logo/truckart/tabs/difficulty paddings) so it fits the phone; (2) safety net — `#screenStart` now
    `overflow-y:auto` and `.hero` uses `margin:auto 0`, so when a screen is ever too short the top of the column
    (logo first) stays reachable by scrolling instead of clipping the bottom. Pinned by the new `start-screen-fit`
    group (asserts all six menu controls inside the 823×384 viewport + the scroll safety net). Full suite **44/44**
    on this update.

- [ ] Balance pass: early cash curve (opening balance BHD 10 vs. first upgrade at BHD 20) — player should feel pull within shift 1.
- [ ] Balance pass: job offer weight + pay per km across all 10 `JOBT` types; verify VIP/long dominate at lvl 4 correctly.
- [ ] Hardening: add a `{ v: 1 }` schema check already present — keep `deepMerge` forward-migration test in mind with next save shape change.
- [ ] Difficulty curve: verify ramping of `evInterval`/`updateDifficulty` feels fair on touch at level 5.

## Backlog (queue)

- [ ] **Track C — never-stop player loop** (full design in `Implementation Plan.md` §Track C). Four
  systems the player asked for, one rule: a setback must never be a dead end. Build order C1→C4→C2→C3.
  - [ ] **C1 Shift rest timer + hourly rest income.** `endShift()` sets `SAVE.rest`; START SHIFT
    becomes a rest card (countdown + accrued wages + cash-priced SKIP, never paywalled). Wages accrue
    open-or-closed from a `Date.now()` delta, capped at 8 h; free play and tutorial exempt. Extend the
    `economy` group with the rest-income maths.
  - [ ] **C4 Rider journal — daily/weekly/monthly records.** `SAVE.stats.journal` period buckets rolled
    on load/`endShift()` (date-key change ⇒ push closed bucket to `hist`, cap 30). Profile screen gets a
    JOURNAL section with a day/week/month toggle. New regression group `rider-journal`.
  - [ ] **C2 Ustad Garage — wait-or-loan repairs.** Brand the garage service screen USTAD GARAGE.
    Breakdown offers WAIT (free, real-time `repairAt` timer, rides broken-but-legal meanwhile) or LOAN
    (instant, `serviceCosts()×1.25`, onto the existing `SAVE.debt` path repaid per delivery — the
    `FUEL CREDIT REPAID` line becomes `GARAGE LOAN REPAID`). One active loan, debt cap, wait always
    free when broke. New regression group `ustad-loan`.
  - [ ] **C3 Accident advisory, no hard stop.** Crash landing `damage ≥40` fires a one-time advisory +
    garage marker ("take it to Ustad — fix now, pay later"), bike stays drivable. Showroom gains
    repair-in-advance on credit (same loan maths as C2, once per shift). All strings i18n'd ×7.
- [ ] Remaining tutorial polish: `tutorialStart`/`tutNext` — verify the four timed cards (STEER → BRAKE FOR PICKUP → DELIVER THE ORDER → EARN & UPGRADE) never re-trigger after `tutorialDone`.
- [ ] Settings: add a "data/reset confirmation" flow that documents what's lost (uses `resetProgress`).
- [ ] Save export/import (copy string) so progress survives browser data clearing.
- [ ] More ambient audio layers (see Brain.md "thought streams"): adhan at shift start; ambient market noise in souq districts.
- [ ] Country-themed livery pack idea (bh red / sa green / ae teal accents) — needs a design slot decision (Brain.md open question).
- [ ] Local daily leaderboard: "best shift earnings" / "best distance" persisted in save.
- [ ] Option for reduced camera shake (some players report motion sickness) — hooks into existing `shake` setting.
- [ ] Mid-shift "top-up fuel at pump" animation/UI (currently fuel is a condition; pumps exist as petrol props).
- [ ] Touch handling pass on a real device: the new **GAS / ◀ ▶** pads and drag-to-lean replace the old
  flick-to-change-lane swipe, so the gesture language needs a hands-on check in both orientations.
- [ ] Highway and valley `rideLimit`/`asphaltHalf` branches (9.4 m / 8.6 m) are written from the chunk
  geometry but currently unreachable — the procedural route only ever generates `street` and `boulevard`
  because the highway/valley districts are level-gated. Verify them when a high-level route rolls one.

## Bugs / fixes log (triage)

- [x] **Start menu cut off on a landscape phone.** At the handset's real CSS size (1080×2316 @450dpi
  = **823×384 px** landscape) the start-screen hero column measured **467 px** — 83 px taller than
  the viewport — so GARAGE / SETTINGS / FULLSCREEN sat below the screen edge, unreachable
  (`#screenStart` scrolls, but nothing indicated more content). The `.diffPick` picker (93 px,
  stacked) and the `.btnRow` (92 px, wrapped to two lines) were the offenders. In the landscape
  compact block (`max-height:520px and orientation:landscape`) `.diffPick` is now one row, and
  `.btnRow` is `flex-wrap:nowrap` with tighter buttons — hero now fits at **373 px**. Guarded by
  the `start-screen-fit` regression group (emulates 823×384, asserts every control inside the
  viewport). Also removed leftover `[BR-RES]` debug logging and restored the shipped DPR caps in
  `applyQuality` (an interrupted session had left that diagnostic WIP unsynced in root
  `index.html`). SW `bike-riders-v16`; suite **46/46**, device check **13/13** on R5CT50HDLDK.
- [ ] **Static audit fails on the music-player ids (`npm test:audit`).** The parked music player
  (`MUSIC`) still references `mpList` / `mpSearch` / `mpClear` / `mpFolder` (index.html ~line 1746) but
  those ids are no longer declared in the markup (`mpBar/mpBody/mpBtns/mpFile/mpLoad/mpPlay/…` exist,
  the four above do not). The code guards every lookup (`if(mpList)…`), so it is inert at runtime, but
  `tools/audit.mjs` reports *"element ids referenced but never declared"* for both `index.html` and
  `public/index.html` — **pre-existing, not introduced by any docs change.** Fix by either re-declaring
  the four elements as part of the music panel markup or removing the dead player scaffolding (a
  deliberate API-surface decision), then run `npm test` green.
- [x] **Road no longer follows the road.** Every chunk drew its 40 m road, footway, median, shoulders and rails as one rigid slab, rotated to the curve only at the chunk centre. On a strong bend that slab sat up to **5.5 m** off the true centre-line, so the rider was on the kerb/grass and buildings stood on the asphalt. Chunks are now authored in a nominal straight frame and warped onto the real centre-line: `MB` gained a per-vertex `warp` hook, `Chunk.warpFrame()` warps every chunk-owned mesh (baking each mesh's own placement first, and re-warping from the cached bake when a chunk is recycled), long merged boxes are built in 5 m pieces so they can bend, and props/buildings are placed with `Chunk.pt()`/`Chunk.place()`. Verified: 23,950/23,950 rider lane points on asphalt across 4,790 chunk setups (24 km), max warp deviation 0.001 m.
- [x] **Pedestrians walked backwards.** `personGeos` puts eyes, beard, helmet visor and cap brim at **-z**, so the person model faces -z like the bike — but the walking branch used `(zdir>0?0:Math.PI)` while the waiting branch used the opposite convention, so walkers moonwalked and stood facing the wrong way. Facing now uses `(zdir>0?Math.PI:0)`, the duplicated sign logic is unified in `pedZdir(p)`, waiting/crossing peds face the direction they are about to travel, and the pedestrian cap brim moved from the back of the head to the front. Verified: 38/38 walkers face within 3° of travel, 9/9 destination-bound peds move toward their crossing/bus stop, crossing still completes.
- [x] Service worker versioning introduced (`bike-rider-v2`) — SW no longer serves stale cached index.
- [ ] Verify Google Fonts flash/`FOUT` fallback on slow networks; ensure Arabic (Naskh) renders offline (falls back to system Arabic fonts by design — confirm acceptable).
- [ ] `toggleFullscreen` — iOS Safari has no FS button; confirm button is hidden there (compact layout CSS).
- [ ] Confirm `reportError` path: unknown runtime errors show a friendly overlay, no blank screen.

## Ideas pool (parked, not committed)

- Airport run = the "mission" escalation the game lacks at endgame.
- Passenger dialogues (bubble lines) to add narrative texture cheaply.
- Day-count / shift-daily streak bonus.
- "Wrong-way rider" near-miss = small 'close call' bonus; currently pure penalty.
- Kitchen / tiffin delivery (reuse `cargo` label system).

## Release checklist (every release)

- [ ] Bump `VERSION` in `sw.js` (cache invalidation).
- [ ] **Signing identity:** `android/release.keystore` is gone; only `android/debug.keystore` remains, so a
  build signed today cannot update a phone holding the old release-signed APK. Recreate a release keystore
  (or adopt the debug identity for every install) and back the key up off this machine before the next
  device rollout.
- [ ] Update `CREDITS.txt` if assets were added.
- [ ] Full manual shift on touch and desktop (the in-app `autotestStep` autotest is gone; `npm test` +
  `?test` soak cover the automated half).
- [ ] Confirm offline: hard-reload with network off → game + theme still work.
- [ ] Update Phases.md / Task.md / Memory.md as relevant.