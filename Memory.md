# BIKE RIDER — Memory.md

Project memory. Facts, decisions, traps and conventions that must survive context loss. Update whenever you learn something new or change something structural.

## What this project is

A single-file Three.js (r128) web game: ride a motorcycle through a fictionalised **Bahrain**, take food/parcel/pharmacy
and passenger jobs in shifts, earn **BHD**, upgrade. All assets are generated procedurally from code. Ships as an
offline-capable PWA and as a signed Android APK.

## Hard facts (do not contradict)

- **One file.** `index.html` contains ALL CSS, HTML and game JS (~6,400 lines). Do not split it without a very
  good reason and an explicit request.
- **Two copies on purpose.** The root `index.html` is **canonical**; `public/` is the deployable mirror that also
  holds `icons/` and `music/`. Never hand-edit `public/index.html` — run `npm run sync:public`. `public/` is what
  gets hosted and what gets baked into the APK.
- **There is a toolchain now.** `package.json` has zero *runtime* dependencies on purpose: the test harness drives headless
  Chrome over the DevTools Protocol using Node's built-in `WebSocket`, and the APK is built with the raw Android
  SDK tools. The one devDependency is the `supabase` CLI (migrations only — never bundled, never shipped).
  `npm test` is the gate.
- **The only network code is `SB` (WORLD RIDERS).** A zero-dependency `fetch` client for the Supabase
  leaderboard — deliberately **not** `@supabase/supabase-js`, so nothing is bundled or CDN-loaded. It is
  opt-in twice (`OWNER.sb.enabled` + `SAVE.settings.board`), reads on open, writes only on an explicit
  **SUBMIT MY BEST**, and degrades to `localStorage['br_board_cache_v1']` when offline. The server is the
  boundary: the client holds only the publishable key, `anon` has SELECT-only, and writes go through the
  `SECURITY DEFINER` `submit_score()` which clamps every value. **The Android APK has no `INTERNET`
  permission, so the board is web-only** — `SB.packaged()` disables it there. See `backend scema.md`.
- **Three.js r128 is vendored** in `vendor/three.r128.min.js` (MIT). The page must load it from that path — a
  remote `<script src>` fails `tools/audit.mjs`, because the offline build needs no network to start. Do not
  upgrade casually; `CanvasTexture`, `Sprite` and legacy geometry usage make any upgrade a separate project.
- **Assets are generated or original.** See `CREDITS.txt`. **All audio is WebAudio synthesis — there is no audio
  file.** The old `public/music/` stems folder (unused sample material) has been **deleted** — it was
  referenced by nothing.
- **Fictional brands only**: BahrainRide, KhanaJet, DakBox, SehatPlus, Sitara Motors, Zoom Fuel, GAUSS AUTO.
  Never real-world brands.
- **48 Bahrain districts** in `BAHRAIN`, across four governorates, with `lvl` gates and per-style
  `BUILD_MIX` (commercial/residential/market/oldcity/food/mixed). **All 48 carry a landmark** (`LMARKS`),
  rendered from 30 model kinds (`lmModel`); bh itself uses a subset (18 kinds).
- **Multi-country chapters (`CHAPTERS`/`CHAPTER`).** One engine, three swappable countries: `bh` (Bahrain,
  the shipped game — its arrays are **snapshotted by `CHAPTER.bind()`**, so swaps can never mutate the original
  catalogue), `sa` (Saudi Arabia — one city, **Riyadh**, 20 districts), `ae` (UAE — one city, **Dubai**, 20 districts).
  Live world surfaces are swapped in
  place: `BAHRAIN` is emptied+refilled, and `LMARKS`/`LMSIDE`/`STREETS`/`BUSROUTES`/`fmtRs` are `let` reassigned.
  `SAVE.chapter` (top-level, `'bh'`) persists the choice; deepMerge migrates old saves. `CHAPTER.init()` runs
  from boot after `migrateSettings()`, before `padCityInvariants()`.
- **Money formatting is chapter-specific, the economy is not.** `fmtRs` is still the historical name; for `bh`
  it emits `BHD n.nnn`, for `sa` `SR n.nn`, for `ae` `AED n.nn`. Balance numbers (fares, upgrade costs) are
  shared and untouched — currency is display-only. Opening balance BHD/SR/AED 10, cheapest upgrade 20, a
  level-1 shift ≈ 17.9.
- **Landmarks may carry real famous names, stores never do.** Kingdom Centre, Al Faisaliah, Masmak Fortress,
  At-Turaif, Edge of the World (Riyadh); Burj Khalifa, Burj Al Arab, Dubai Frame, Museum of the Future,
  Atlantis, Mall of the Emirates (Dubai) are real landmark *names* (fine); storefronts in every chapter are
  fictional — never real trademarks (ARAMCO, SABIC, STC, EMAAR, ADNOC, ETISALAT, DP WORLD, CARREFOUR…).
- **SEO & author credit.** The `<head>` owns title/description/keywords/author/robots, `rel=canonical`,
  Open Graph + Twitter cards (image `icons/icon-512.png`) and a JSON-LD `VideoGame` schema — all pointed at
  the hosting root **`https://alasarjadeed.com/`**. `robots.txt` + `sitemap.xml` live at that root and flow
  through `sync:public` into the web zip and APK. The start-screen footer credits **"Made by AL ASAR
  JADEED"** with a `rel="noopener noreferrer"` backlink (kept to one line — `start-screen-fit` pins it).
  `tools/audit.mjs` skips `application/ld+json` blocks.
- **Documentation set + machine index.** The docs are: `Brain.md` (thinking), `PRD.md`, `TRD.md`,
  `Architecture.md` (how), `app flow.md` (screens/states), `backend scema.md` (persistence schema — there is
  **no backend**), `UI-UX Design Brief.md`, `Design.md`, `open graph tags.md`, `Phases.md`, `Task.md`,
  `Implementation Plan.md`, `Rules.md`, `security.md`, `licence.md`, this `Memory.md`. `llms.txt` is the
  machine summary (mirrored by `sync:public`). `mcp-index.md` is **generated** by `tools/auto-mcp-index.sh`
  — update that script's `DOCS` array and re-run it whenever a doc is added or renamed; never hand-edit
  `mcp-index.md`.
- **Naming: BIKE RIDER, chosen knowingly (2026-10-21); licence still open.** The app ships as
  **BIKE RIDER** everywhere — `<head>`/`manifest.webmanifest`/JSON-LD, the Android launcher label,
  `CREDITS.txt`, `PUBLISH.md`. This is the same name AppGallery rejected under rule 9.5 as too similar
  to the existing game *Bike Rider*. v1.0.4 briefly shipped as **BAHRAIN RIDERS** to clear that
  rejection; v1.0.5 reverted to **BIKE RIDER** at the owner's explicit request, accepting the risk of a
  second rejection. The **in-game fictional courier company** is also called "Bike Rider"
  — player-editable, invented fiction; after v1.0.5 it is the same string as the product name, so the
  two are no longer distinguishable in-game. `package.json` still
  declares `"license":"MIT"` while `licence.md`/`CREDITS.txt` dedicate the work **CC0 1.0** — that one is
  still open (see `Implementation Plan.md` → *Known inconsistencies*).
- **App identity is `com.bikerider.game`** (was `BikeRider.huawei`). It appears in
  `android/app/build.gradle`, `MainActivity.java`'s package directory, `agconnect-services.json`, and both
  manifests. The AppGallery AGC console must have the same package name or the build fails.
- **Release builds:** `npm run build:aab` (`tools/build-aab.mjs` → `gradlew bundleRelease`, wrapper pinned
  to Gradle **8.2.1**; 9.x breaks Huawei's AGCP plugin) for AppGallery; `npm run build:apk`
  (`tools/build-apk.mjs`, raw aapt2/d8) for sideloading, reading the checked-in offline
  `android/AndroidManifest.xml` and `android/keystore.properties`. JDK: `/home/oem/tools/jdk-17.0.20.1+1`
  (no `java` on PATH — export `JAVA_HOME` or both builds fail).

## Save system — read before touching

- Key `localStorage['bahrain_rider_save_v1']`, schema `v: 1`.
- `defaultSave()` is the source of truth for shape; `deepMerge(base,o)` migrates **forward only** (old → new). Add
  fields to `defaultSave`, then old saves survive.
- `migrateSettings()` runs from `loadSave()` and is where **shape changes to a value type** go. It currently maps
  the old boolean camera-shake to the tri-state `'normal' | 'reduced' | 'false'`, and coerces any non-`'full'`
  HUD mode to `'auto'` (the `hudMode` default; `'full'` = never fade, `'auto'` = fade when idle).
- `persist()` is called on every meaningful change + settings close. Beware: **do not break `deepMerge`**; a bad
  manual save shape is fine (defaults fill in).
- `UI.saveImport()` refuses anything that is not an object with a truthy `v`, and refuses `v > 1`. It restores
  `settings.ads`, `credits` and `adLastClaim` from the live save afterwards — **studio-owned fields must never
  travel in a player save.**
- `SAVE.deviceId` (a UUID, generated once) is the WORLD RIDERS row key — a key, **not** an account. Added to
  `defaultSave`, so old saves get one lazily on first board use via `SB.deviceId()`.
- `SAVE.settings.board` is the player's leaderboard opt-in (default `true`); it only matters when the studio
  switch `OWNER.sb.enabled` is also on.
- There is a `resetProgress()` path — it wipes the save (used from settings confirm modal). The board cache and
  `deviceId` go with it, so a reset rider re-registers as a new row.

## Conventions

- **Variable names**: UPPER_SNAKE = const config (`LANES`, `LEVELS`, `JOBT`, `UPG`, `SKILLS`, `PERKS`); `SAVE` =
  persisted state; single-letter component globals (`P` = player, `T` = traffic, `H` = hazards, `EV` = events,
  `W` = world, `X` = cross traffic, `M` = mission/job, `G` = runtime).
- **No comments unless clarifying**; existing code uses section banner comments like `// ---- section ----`.
- **Formatting**: compact one-line expressions preferred (matches existing style). Keep edits consistent with
  surroundings.
- **Units**: metres and m/s. `fmtRs` formats the **active chapter's currency** (`BHD n.nnn` / `SR n.nn` /
  `AED n.nn`), `fmtTime` formats `m:ss`, `fmtDist` handles m/km.
- **Math helpers**: `clamp`, `lerp`, `damp`, `rand`, `randi`, `pick`, `chance`, `weighted`, `smooth` — always
  reuse, never reimplement.
- **Escaping**: player-supplied text reaching the DOM goes through `textContent` or `esc()`. `tools/audit.mjs`
  fails the build on an unescaped interpolation of a player value into `innerHTML`.

## Seams the tooling drives

These exist for the regression suite and are load-bearing — do not rename them casually.

- `?debug` exposes `window.__BR`, including `ev: x => eval(x)`. The game is one IIFE, so this direct-eval seam is
  the only way a test can reach `G`, `W`, `SAVE`, `UI`.
- `?test` sets `G.autopilot` and `G.noTutorial` and starts a shift.
- `window.__brBack` is the game's `goBack()`. The Android hardware back button calls it and only exits the
  Activity when `goBack()` reports it consumed nothing.
- `tick(dt)` is fixed-step-safe: the soak steps it 1,800 times at 1/30 s.
- `window.__BR.SB` exposes the leaderboard module so `world-board` can stub `window.fetch` and drive the
  board offline. The backend itself is verified separately against the live project (see Task.md).

## Known traps / gotchas

- **Service worker caching**: after editing `index.html`, bump `VERSION` in `sw.js` or some players keep the old
  cached game. Now `bike-riders-v15`. The worker is network-first with a cache fallback, so it can only serve
  stale content to someone who is already offline.
- **The APK cannot use the leaderboard.** The Android shell has no `INTERNET` permission and
  `shouldInterceptRequest` refuses every off-host request, so a Supabase call from the packaged app fails by
  construction. `SB.packaged()` detects `appassets.androidplatform.net` and disables the board there — do not
  "fix" the board by loosening the shell without an explicit privacy decision. The board is a web-build feature.
- **Never put a `service_role` / `sb_secret_…` key in `index.html` or the admin panel.** Only the publishable
  (anon) key ships; RLS is the boundary. A secret key in the client hands every player full write access.
- **A `position:relative` on `#screenGarage.showMode` shrank the whole garage layout.** `.screen` is
  `position:fixed; inset:0`; any rule that overrides `position` (a `#screenGarage.showMode` selector beats the
  class selector) drops the element back into flow with a content-height box, so flex auto-margins lose their
  free space and absolute children anchor to a ~193 px box, not the viewport. The showroom sidebar is
  `position:fixed` (anchored to the viewport) precisely so the screen keeps its full-height `inset:0`.
- **`#screenGarage.showMode .gFoot` must stay pinned.** With `#showBar` out of flow (fixed), `.gFoot` would
  float directly under the tabs; `margin-top:auto` docks it at the bottom of the flex column again, and
  `padding-right:min(340px,38vw)` keeps BACK/START SHIFT clear of the sidebar.
- **The phone garage/showroom geometry is now landscape.** `showroom-viewer-phone` emulates the real handset
  **823×384** (±740×360 earlier), because the game is played landscape (`#rotateHint` turns portrait phones
  around). The old portrait 390×844 emulation let bottom-bar assertions pass that are meaningless sideways.
  The `.showCard` is height-capped with internal scroll — a `nav.bottom` bound is wrong once content scrolls
  inside the card; bound the card, not its content.
- **The handset is wider than the 760 px phone breakpoint in landscape.** A 1080×2316 @450dpi phone is
  **823 CSS px wide** sideways, so every `@media (max-width:760px)` phone rule silently did not fire and the
  garage/HUD fell back to desktop layout on-device. Phone rules now use the combined selector
  `@media (max-width:760px),(max-height:520px) and (orientation:landscape)` — check YOU changed both when
  adding a handset rule, and emulate ≥ 823 width in tests.
- **JUMP input was a silent no-op.** `IN.jumpPressed` (Space / `#tJump` / swipe-up) was set but never read —
  `playerUpdate` only took `a.jump` from the autopilot and then cleared `IN.jumpPressed`. Input who's not
  consumed by `playerUpdate`'s `else` branch simply vanishes; keep the "read before reset" contract in mind.
- **The handset can sit at its keyguard during `npm run device`.** The resumed-activity check reads window focus;
  when the phone is locked, `mCurrentFocus` is the keyguard `NotificationShade`/`Bouncer`, so "activity resumed"
  fails even though the app launched and rendered. Unlock the phone (swipe/PIN) before treating that as a failure.
- **A fixed CDP debugging port silently invalidates a whole test run.** `launch()` used port 9333; a leaked
  Chrome from a previous run still answers `/json/list`, so the new browser cannot bind and the suite silently
  drives the *old* profile. That produced an `offline-boot` "pass" with the feature under test switched off.
  `launch()` now takes a free port and refuses to attach to a busy one. When a test result is too good, suspect
  the harness before congratulating yourself.
- **Helmet inspection previewed nothing.** `showroomHelmStep` cycled `SHOW.helmT` and rebuilt the bike, but
  `riderAppearance()` read `helmetStyle()` (the equipped shell) — `HELM_PREVIEW` was written but never read.
  The builder must honour `HELM_PREVIEW` while it is set, and `HELM_PREVIEW` must be cleared everywhere the
  showroom exits (`showroomExit`, `showroomHelmet(false)`, the `bikeview` seam) so gameplay `rebuildBike()`
  never wears a previewed tier.
- **A showroom toggle that does not re-render the sidebar leaves a stale button label** (felt like "the button
  does nothing"). `showroomRider`/`showroomHelmStep`/`showroomHelmSet` re-render via
  `if(G.state==='garage') UI.renderGarage(); else showBarRender();` — any new toggle (e.g. `showroomHelmet`)
  must do the same or the label never flips back.
- **Ads are off — the app is free play.** The sponsor/house ads, the low-credit session gate and the offline
  unlock are gone: `adSessionUnlock()` returns `false` (hard no), no gameplay path calls `adOpen` (the engine +
  modal are dormant so the studio can re-enable politely; the admin AD/REWARDS/LEDGER sections and the gold
  unlock buttons are removed). If an ad ever appears again, that is a bug, not a code path. `adWaitLeft()`,
  `adCfg()` (OWNER/SAVE deep merge) and the offline clock rules below only matter to that dormant engine.
- **Solid shells hide interior geometry.** `sph`/`hemi`/`box` are solid — any helmet stripe/vent placed inside
  the shell radius is invisible; every decorative part must protrude past the shell surface (compute radius at
  that height, then push it out).
- **The rider model's root origin sits at seat height (`root y≈-0.13` inside the bike), not its feet.**
  World-position probes on a showroom rider must measure `SHOW.bike.rider.head` (≈ y 1.3–1.6), not `root`
  (≈ y −0.03 at ground level) — a root-y assertion "proves" the rider is buried when it is actually fine.
- **The Android shell is offline by construction — and stays that way.** No `INTERNET` permission and a
  `LocalAssetClient` that 403s every off-host request. There is no YouTube whitelist anymore (ads are gone), and
  `shouldOverrideUrlLoading` only overrides **main-frame**, non-`HOST` URLs (mailto:, the CC0 licence) so a
  third-party iframe can never yank the app into another app.
- **App event listeners swallow exceptions.** A throw inside a `click` handler (my `const v=coName?v.value`
  TDZ typo) never reaches the caller's `try/catch` — it goes to `window.onerror` (`G.errors`). When a button
  "does nothing", check `G.errors`/the `#err` overlay before assuming the listener never ran.
- **Offline unlock and the youtube tolerance were removed with the ads.** `offlineUnlockTick`/`OFFLINE_UNLOCK_MS`
  and the `logErrors()` skip for `https://www.youtube-nocookie.com/embed/` lines in `device-check.mjs` are gone;
  there is no embed, so a NetworkError from that host is now a real gate failure again.
- **`load` has usually already fired by the time async boot finishes.** Registering a service worker from inside
  an `async init()` needs `document.readyState === 'complete'` checked first, otherwise the listener never fires
  and the failure is completely silent.
- **To prove a network-dependent test is real, take the network away for real.** A second server on its own port,
  shut down before the reload, is stronger evidence than CDP offline emulation (which does not reach the service
  worker's own fetches) or a mocked failure. `offline-boot` does exactly that, in its own browser target so it
  cannot disturb the session the other groups are driving.
- **The release keystore is the app's permanent identity.** `android/release.keystore` and
  `android/keystore.properties` are gitignored and must be backed up off the machine: lose them and no future
  version can update an already-installed app. Passwords resolve from env, then that file, and a release build
  with nothing to resolve fails loudly rather than falling back to `android`.
- **AudioContext**: must be created/resumed on first user gesture or browsers block it. The `AU` module handles
  this; UI interactions must keep calling into it, not re-create nodes. The Android shell also sets
  `setMediaPlaybackRequiresUserGesture(false)` — without it the first beep waits forever.
- **`prompt()` is unsupported in several Android WebViews** and `navigator.clipboard` is unavailable on
  non-secure origins. That is why save export/import renders a real textarea instead of a prompt.
- **Frame budget on old phones**: `tick` must stay allocation-light — always use the shared temps (`_v1` etc.) and
  pools; never allocate arrays in per-frame code.
- **THREE r128 specifics**: `Sprite`s and `CanvasTexture` behave differently in newer versions; `anisotropy` must
  be set per-texture.
- **`applyQuality`** mirrors settings; on `low` it drops prototype counts — if you add a district style, it
  inherits automatically via `buildPrototypes` counts using `lo` gating.
- **Android does not serve the build from `file://`.** `localStorage` is unreliable there and a service worker
  needs a real secure origin, so `MainActivity` intercepts `https://appassets.androidplatform.net/` and reads
  `assets/public/…`. Off-host requests are refused, not passed through.
- **Never re-parent a placed prop with `Object3D.attach()`.** `attach()` preserves the object's *world*
  transform across a re-parent by overwriting its local one through `Matrix4.decompose`. If it runs after you
  set the transform, it silently substitutes the new parent's frame — for a pooled prop that means the frame
  of whichever chunk it was last used by, which showed up as buildings mirrored 180 deg across the road. Use
  `g.add()` and own the full transform yourself. See Architecture.md.
- **The road bend is off (`CURVE_ON = false`) on purpose.** It ran geometry and everything driving on it
  through two incompatible coordinate models that only agreed at zero tangent. Do not flip it back on just
  because the formulas still look right — `curvature-consistency` asserts `P.d === -P.z`, which is a
  straight-mode-only identity, and that failure is the intended signal to redo the arc-length convention.
- **When a transform looks wrong, check the write path, not the value.** Reading `o.rotation.x` told us the
  object was flipped; it did not tell us who flipped it. Trapping the `x`/`z` *setters* found nothing,
  because `setFromQuaternion` assigns the private `_x`/`_z` fields directly. The stack that actually mattered
  came from trapping `Euler.setFromQuaternion` — three frames further up was the real caller.
- **`javac` must not get `-bootclasspath android.jar`** — it also removes `java.lang.invoke`, which is where
  `LambdaMetafactory` lives, and every lambda in `MainActivity` fails to compile.

- **Root `icons/` is the source of truth; `public/icons/` is only a mirror** that `tools/sync-public.mjs` copies
  into. Writing an icon straight into `public/icons/` looks like it worked and is then silently reverted by the
  next sync, so the build ships the old launcher icon with no error anywhere. `tools/install-app-icon.mjs` writes
  root `icons/` and prints the sync reminder; `tools/audit.mjs` now compares both trees and fails on drift.
- **aapt2 re-encodes PNGs, so a built APK's icons never match the source by `sha256`.** To prove an icon reached
  a build or an install, pull the APK and compare **pixels** (PIL `ImageChops.difference`). Byte comparison gives
  a false "it did not ship" on every single density.
- **`.click()` on a disabled `<button>` is a no-op**, so a "a locked option cannot be applied" test passes even
  when the guard that protects it has been deleted. `dispatchEvent(new MouseEvent('click',{bubbles:true}))` does
  reach listeners on disabled buttons, which is the only way to test the JS guard independently of the
  `disabled` attribute. Mutation-test every guard: both of these bugs shipped as green tests.
- **Do not count meshes to identify a shape.** A cap check that counted every child of `rider.head` was really
  asserting on helmet geometry, so it passed or failed as the helmet design changed. Compare the scene with and
  without the feature and diff the triangle count.
- **Helmet appearance is not the helmet upgrade.** `SAVE.cos.helmet` is the cosmetic style the rider wears,
  `SAVE.upgrades.helmet` is the purchased protection. The showroom `HELM_PREVIEW` may show unbought tiers but
  must never write the upgrade, or the upgrade is free.
- **The CDP `Session.run` is synchronous** (it evaluates through `window.__BR.ev`), so a snippet that returns a
  Promise serialises as `{}` and every assertion inside it silently "passes". Use `Session.ta`/`s.ta` for anything
  async.

- **`dumpsys` output is a history, not a value.** `tools/device-check.mjs`'s "activity resumed" check read the
  *first* `mResumedActivity`-style match, so it reported whichever app was in front *before* the launch and
  failed intermittently while the game was demonstrably resumed and rendering a 1.1 MB frame. The current state
  is the **last** one printed. Two more traps in the same query: Android 16 renamed the key to
  `topResumedActivity`, and the window dumps contain NUL bytes that make a naive line regex miss. Always prove
  such a check still *fails* when the condition is false — press HOME, confirm it goes red, then bring the app
  back. A check that has only ever seen the passing case is not a check.

- **`Object3D.attach()` decomposes the matrix back into Euler, and a 180° yaw does not come back as
  `rotation.y = π`.** It comes back as `(π, 0, π)`, so `o.rotation.y` *reads* 0 while the prop is still
  turned around. `Chunk.place()` used to write only `.y`, which meant a prop pooled from the right side and
  reused on the left kept `(π, 0, π)` and sat mirrored across the carriageway. Two rules follow: write all
  three axes (`o.rotation.set(0, yaw, 0)`), and **reparent first, set the transform second**. `poolGet`
  also resets rotation so nothing inherits a stale transform. When a test reports a rotation as 0, check
  `matrixWorld` before believing it — probe `getWorldRotation` in Euler XYZ hides a Y-π as `x=π, z=π, y=0`.

- **`Chunk.pt()` and `Chunk.warp()` must be the same line, and `lz` is already along the path.** The frame
  is `d = d0 - lz`, so the mapping is `X = cx(d) + lx*cos y`, `Z = -d - lx*sin y`. Rotating `(lx, lz)`
  as if it were a rigid local vector (the `+ lz*s` / `+ lz*c` terms) double-counts the longitudinal offset:
  every chunk drew 2×CHUNK of road and overlapped its neighbour by half. `W.worldX(lx, dist)` is the same
  formula exposed for the tests; if you change one, change all three.

- **Build toolchain on this machine (installed 2026-10-06, no sudo):** portable Temurin JDK 17 at
  `/home/oem/tools/jdk-17.0.20.1+1`, Android SDK at `/home/oem/Android/Sdk` (cmdline-tools, build-tools
  34.0.0, platforms;android-34, platform-tools). Builds need `ANDROID_SDK_ROOT=/home/oem/Android/Sdk` and
  `JAVA_HOME/bin` on `PATH`; `tools/device-check.mjs` expects adb in `$SDK/platform-tools`.

## History (notable dates/decisions)

- v1 shipped as an offline-capable single-file game; SW `bike-rider-v2` introduced to fix the stale-cache
  problem. Currently `bike-riders-v15`.
- Music is synthesised, not sampled; the code-synthesised theme is CC0. Game code/art remain the project's own
  (see `licence.md`).
- Route/junction turn system (`planRoute`, `turnMotion`, miss/reroute) added for turn-by-turn guidance — drives
  the "navigation" fantasy.
- The economy moved from rupees to BHD with the Bahrain retarget. Balance claims in the docs are now **measured**
  by the `economy` regression group rather than asserted.
- The permanent test suite replaced a series of one-shot validation scripts (`validate.py`, `pN` scratch scripts
  under `/tmp`). `npm test` is now the only gate.
- 2026-10-21: **Renamed to BIKE RIDER and shipped an AppGallery bundle.** AppGallery review rejected
  the submission under rule 9.5 — the app was named "Bike Rider", too similar to the existing game *Bike
  Rider*, and asked for authorization documents or a name change. Rather than license a third party's
  name, the project reverted to the brand it already owned: **BIKE RIDER** in the page head
  (title/description/OG/Twitter/JSON-LD), the loading logo, the landscape string in all 7 languages,
  `manifest.webmanifest`, `sw.js` (`bike-rider-v19`), `robots.txt`, `CREDITS.txt`, `PUBLISH.md`, and
  the Android launcher label. Package identity became **`com.bikerider.game`** (applicationId,
  namespace, `MainActivity` package, `agconnect-services.json`, both manifests). The Android Gradle module
  was **regenerated** — it had no manifest, so no release build could run — and a checked-in offline
  `android/AndroidManifest.xml` was added for the raw-toolchain APK path. New `npm run build:aab`
  (`tools/build-aab.mjs`) produces `dist/BikeRider-1.0.4-com.bikerider.game.aab`; the Gradle
  wrapper is pinned to **8.2.1** because Huawei's AGCP plugin fails on Gradle 9.x. Version 1.0.4 /
  versionCode 4. Verified: audit clean, 50/50 regression groups, APK badging
  `label='BIKE RIDER' package='com.bikerider.game'`, signed by `CN=Bike Rider`. The
  in-game fictional courier company "Bike Rider" was deliberately left alone — it is invented fiction,
  not the app identity (`Rules.md` rule 3). Same day, three build-hygiene fixes: (1) `public/Screenshot/`
  — the 12 MB AppGallery listing screenshots + promo video — had been copied into `public/` by hand and was
  being baked into the app payload, inflating the APK/AAB/web-zip from ~1.5 MB to ~12.6 MB; it is now in
  the `SKIP`/`EXCLUDE` lists of `build-apk.mjs`, `build-aab.mjs` and `build-web.mjs`, so listing material
  can never enter the payload again (the files stay on disk). (2) `writeSums()` in `tools/build-web.mjs`
  truncated `dist/SHA256SUMS` to only the artifacts of whichever build ran last, so building the AAB after
  the APK silently dropped the bundle entry; it now describes **every** release artifact present in `dist/`,
  filtered to the newest version. (3) `tools/device-check.mjs` hard-coded `com.bikerider.app`, an id that
  had never matched the shipped `applicationId`; it now reads the value out of `android/app/build.gradle`.
  The package identity was briefly `com.roadriders.huawei` and `com.BikeRider.huawei` during naming
  back-and-forth before settling back on **`com.bikerider.game`** — the same id the rejected submission
  used, so AppGallery carries the listing (and its rule 9.5 history) forward.
- 2026-10-06: `regress.mjs` reached **40/40** (was 13/40). The last five were `dom-integrity` (`UI.saveIO`
  had to return `true`), `road-clearance` (missing global `SPAN`), `place-names-real` (`Oasis Mall`),
  `road-clearance-live` (the attach/Euler mirroring above) and `curvature-consistency` (the `pt`/`warp`
  double-rotation). Same day the APK was rebuilt and reinstalled on `R5CT50HDLDK` — a **fresh install**,
  because the phone's old build was signed with the now-missing `release.keystore`.
- 2026-10-17: **documentation suite expanded + machine index.** Added `TRD.md`, `app flow.md`,
  `backend scema.md`, `UI-UX Design Brief.md`, `open graph tags.md`, `Implementation Plan.md` and
  `llms.txt`; refreshed the existing docs (stale `public/music/` claims removed, working path corrected,
  doc map updated); `llms.txt` added to `sync:public`'s `FILES`; `mcp-index.md` regenerated from an
  expanded `tools/auto-mcp-index.sh`.
- 2026-10-17: **WORLD RIDERS shipped** — the first backend feature, on Supabase (project *Bike Rider*,
  `ckssgqvrpogjiobnsfsc`). Zero-dependency `fetch` client (`SB`) rather than `@supabase/supabase-js`;
  `leaderboard` table with SELECT-only RLS for `anon`; writes only via the `SECURITY DEFINER`
  `submit_score()` (server-side clamps); `top_board()` for reads. Opt-in twice (studio + player); read on
  open, write only on **SUBMIT MY BEST**; caches the last board for offline. **Web-only** — the APK has no
  `INTERNET` permission, so `SB.packaged()` disables the board in the app. New `world-board` regression
  group; suite at **45/45**.
- 2026-10-17: **start menu fits the landscape phone** — the last piece of the mobile-resolution fix
  (the 823×384 CSS-px handset the earlier session identified). The hero column was 467px tall on a
  384px viewport, putting GARAGE/SETTINGS/FULLSCREEN below the screen edge; `.diffPick` became one
  row and `.btnRow` stopped wrapping — hero now fits at 373px. `start-screen-fit` regression group
  guards it (suite **46/46**). Also stripped leftover `[BR-RES]` debug logging and restored the
  shipped DPR caps in `applyQuality`. SW `bike-riders-v16`; APK rebuilt + installed on
  R5CT50HDLDK; device check **13/13**.

## Contacts / where things live

- Working directory: `~/Documents/all project data /Bike Rider/BIKE RIDER/` (note the capitalisation and
  the spaces — quote the whole path in shell commands). The parent `.../Bike Rider/` also holds the
  `BIKE RIDER android/` shell project, `Favicon/`, `conversations/` and archived material.
- Tooling: `tools/audit.mjs` (static), `tools/regress.mjs` (e2e), `tools/cdp.mjs` (CDP client),
  `tools/serve.mjs` (static server), `tools/sync-public.mjs`, `tools/build-web.mjs`, `tools/build-apk.mjs`,
  `tools/make-icons.mjs` (code-drawn Android launcher icons) and `tools/install-app-icon.mjs` (installs the real
  artwork to the Android mipmaps *and* the web/PWA set), plus `tools/auto-mcp-index.sh` (regenerates
  `mcp-index.md` from the doc set). Do not run the old generator after installing artwork.
- Android: `android/AndroidManifest.xml`, `android/java/com/bikerider/app/MainActivity.java`, `android/res/`.
- Artifacts: `dist/*.apk`, `dist/*.web.zip`, `dist/SHA256SUMS`.
- Docs: `Brain.md` (thinking), `PRD.md` / `TRD.md` (requirements), `Architecture.md` (how), `app flow.md`
  (screens/states), `backend scema.md` (persistence schema), `UI-UX Design Brief.md` + `Design.md` (UI/art),
  `open graph tags.md` (SEO/social metadata), `Phases.md` (roadmap), `Task.md` (queue + release checklist),
  `Implementation Plan.md` (forward plan), `Rules.md` (guardrails), `security.md`, `licence.md`, `llms.txt`
  (machine summary), and the generated `mcp-index.md`. Keep `Task.md`/`Memory.md` fresh as you work, and
  regenerate the index with `tools/auto-mcp-index.sh` after adding a doc.
