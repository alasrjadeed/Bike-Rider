# BIKE RIDER — TRD (Technical Requirements Document)

How the game is required to be built and behave, technically. `PRD.md` says *what* the product is;
this says *how* it must run and what a change is allowed to assume.

## 1. Product form

- Single-file client-side game: **all HTML, CSS and JavaScript live in `index.html`** (currently
  ~6,400 lines). There is **no bundler and no build step for the game itself** — edit and reload.
- Rendered with **Three.js r128**, vendored at `vendor/three.r128.min.js` (MIT). Loaded from that
  local path only; a remote `<script src>` fails `tools/audit.mjs`.
- Distributed two ways: an installable **PWA** (`sw.js` + `manifest.webmanifest`) and a signed
  **Android APK** (WebView shell in `android/`, no Gradle).
- Landscape orientation, touch-first, mobile-first.

## 2. Runtime architecture (summary)

`loadSave()` → module-scoped globals (`SAVE`, `G`, `P`, `T`, `H`, `EV`, `W`, `M`) → build
(materials, textures, prototypes) → `loop(now)` → `tick(dt)` → `playerUpdate / trafficUpdate /
crossUpdate / hazards / evUpdate / pedsUpdate / worldUpdate / updateEnvironment / UI.update`. See
`Architecture.md` for the full diagram and the code-section index.

- **Single source of truth:** module-scoped globals; no state-sync framework. A small `UI` object
  binds the DOM.
- **Screens** are driven by `G.state` (`menu → garage → playing ⇄ paused → summary`) plus overlays;
  see `app flow.md`.

## 3. Technology requirements

| Area | Requirement |
|---|---|
| Rendering | WebGL via Three.js r128; vertex-coloured baked geometry (`MB`), canvas `THREE.CanvasTexture` for signs/roads/billboards |
| Audio | **Web Audio API synthesis only** — no audio files anywhere. `AudioContext` created/resumed on first user gesture |
| Persistence | `localStorage` only (schema `v:1`) — see `backend scema.md` |
| Offline | Service worker, **network-first with cache fallback**; precache of shell + icons + vendored Three.js |
| Fonts | Google Fonts (Baloo 2, Noto Naskh Arabic, Noto Sans Thai/Devanagari/Gurmukhi), **optional** — system-font fallback offline |
| Language | All in-game text via the `t()` i18n table (`en`, `ar`, `fil`, `hi`, `th`, `pa`); Arabic renders RTL under the `.ar`/`logoAr` path |
| Navigation | Junction turn system (`planRoute`/`turnMotion`) with miss/reroute; turn-by-turn HUD |
| No network | Zero gameplay network calls; no analytics, no telemetry, no remote config at runtime |

## 4. Performance requirements

- **Target 60 FPS** on a mid-range 2019-era Android / iPhone X class phone.
- **Zero per-frame allocation** in `tick`: reuse shared temps (`_v1`, `_q1`, `_e1`, `_m3`), reuse
  geometries via the `gKey`/`GEO` cache, and take everything recycled from **object pools**
  (`poolGet`/`poolPut`, `RIGPOOL`, per-prototype vehicle pools, hazard pool).
- FPS-independent physics with a clamped `dt`; fixed-step-safe `tick(dt)`.
- Quality tiers (`applyQuality`: `auto`/`low`/`high`); `low` reduces prototype counts + anisotropy.
- The perf budget is enforced by **review**, not tooling (see `Rules.md`).

## 5. Compatibility requirements

- Modern Chrome, Safari, Firefox (desktop and mobile), plus **Android WebView** including embedded
  contexts.
- **iOS Safari landscape**, including safe-area insets (`viewport-fit=cover`).
- Graceful degradation: WebGL fallback via the quality path + a readable message; no-JS shows the
  dark background only; `reportError()` shows a friendly overlay rather than a blank screen.
- Phone layouts must work at the real handset geometry (**823×384 CSS px landscape**); phone media
  queries use `@media (max-width:760px),(max-height:520px) and (orientation:landscape)`.

## 6. Offline requirements

- After the first online visit, the **entire game is playable with no network** — including the
  vendored Three.js and the road, served from the service-worker cache. `offline-boot` proves this
  by shutting the server down before a reload.
- `registerServiceWorker()` must never be able to block boot (no-ops without support or on `file://`).
- Android is offline **by construction**: assets served from `assets/public/` over
  `https://appassets.androidplatform.net/`; `shouldInterceptRequest` refuses every off-host request;
  the manifest declares **no `INTERNET` permission**.

## 7. Security & privacy requirements

- No network calls for gameplay; no analytics/tracking/telemetry; nothing transmitted off-device.
- All dynamic text is canvas-drawn or rendered from internal constants via `textContent`/`esc()`;
  no user input reaches `innerHTML` (`audit.mjs` fails the build on an unescaped interpolation).
- Saves are parsed defensively through `deepMerge`; `persist()` is wrapped in `try/catch`.
- Studio-owned fields (`credits`, premium, ad config) never travel in a player save.
- Full posture: `security.md`.

## 8. Testing & quality gates

- `npm test` = `tools/audit.mjs` (static audit) **+** `tools/regress.mjs` (**44 headless-Chrome
  regression groups** over the DevTools Protocol). This is the gate for every release.
- The static audit covers failure modes a browser hides: duplicate ids, `$()` lookups resolving to
  null, player values reaching `innerHTML`, font stacks without a generic fallback, referenced files
  that do not exist, manifest icons and SW precache entries pointing at nothing, and root/`public`
  icon drift.
- Test seams (load-bearing — see `Architecture.md` → *Test seams*): `?debug` (`window.__BR`,
  `ev: x => eval(x)`), `?test`, `window.__brBack`, `tick(dt)`, `reportError(e)`.
- **Manual pass still required:** a full shift on desktop (keyboard), on a real phone (touch) and on
  a real Android device (the WebView shell is not covered by the browser suite).

## 9. Toolchain & environment

- **Zero npm dependencies.** Tooling uses only Node built-ins (CDP over the built-in `WebSocket`).
- `npm test` (audit + regress), `npm run sync:public`, `npm run build:web`, `npm run build:apk`,
  `npm run device`, `npm run build` / `release`.
- `public/` is a **one-way mirror** of the root (`tools/sync-public.mjs`, `--check` reports drift);
  never hand-edit `public/index.html`.
- Android build: raw SDK tools (`aapt2 → javac → d8 → zipalign → apksigner`), no Gradle.
  Uses portable Temurin JDK 17 and the Android SDK on this machine (see `Memory.md`).
- `javac` must not receive `-bootclasspath android.jar` (it strips `java.lang.invoke`, breaking lambdas).

## 10. Delivery & deployment requirements

- Web: static HTTPS host serving `public/` at the SEO root **`https://alasarjadeed.com/`**.
- Release artifacts: `dist/bike-rider-<version>.apk`, `dist/bike-rider-<version>.web.zip`,
  `dist/SHA256SUMS`.
- **Bump `VERSION` in `sw.js` on every release** so clients evict stale caches.
- Release keystore is the app's permanent identity and must be backed up off-machine (see `Rules.md`
  and the release checklist in `Task.md`).

## 11. Non-requirements / explicitly out of scope (v1)

- No backend or server-side component; no multiplayer; no real money or in-app purchases.
- No ads for players (free play); no analytics; no cloud saves; no leaderboard server.
- No downloadable assets; no level editor; no build pipeline for the game file.
