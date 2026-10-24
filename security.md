# BIKE RIDER — Security notes

Security & privacy posture for this project. The short version: **everything stays on the player's device. Gameplay makes no network calls at all; the only outbound request in the whole game is an opt-in, player-triggered global leaderboard.**

## Threat model

- Web game served over HTTPS, played in a browser (mobile + desktop).
- Biggest realistic risks: **save tampering/corruption**, **malicious third-party content injection via fonts/CDN**, and **social-engineering phishing of save data**. Not a high-value target — but let's keep it clean.

## Data locality & privacy

- No analytics. No tracking pixels. No telemetry. No remote calls during gameplay.
- Progress lives in `localStorage['bahrain_rider_save_v1']` on the player's own device.
- Only external network dependency: Google Fonts (Baloo 2, Noto Naskh Arabic, Noto Sans Thai/Devanagari/Gurmukhi) — **optional**; the game falls back to system fonts when offline or blocked, so gameplay never requires the network.
- Service worker (`sw.js`) is same-origin only: `new URL(req.url).origin !== self.location.origin` → no caching/interception of cross-origin responses, and `range` requests are let through untouched (media).
- The one exception is **WORLD RIDERS**, the optional global leaderboard (Supabase/PostgREST over `fetch`). It is opt-in twice (studio switch *and* player Settings → *Global board*), only runs while the board screen is open, and only writes when the player presses **SUBMIT MY BEST**. Nothing is ever sent automatically, and the game plays identically offline.

## Save data handling

- `localStorage` is not encrypted (it can't be) — treat save contents as neither private nor tamper-proof.
- All reads path through `deepMerge` over `defaultSave()`: unknown keys are dropped, missing keys defaulted, non-object/array type mismatches are ignored. A corrupted/tampered string parses to defaults rather than crashing the game.
- `persist()` is wrapped in try/catch — storage-full or blocked-storage failure is silently tolerated, never a crash.
- Provide the in-app reset (`resetProgress()` behind a confirm modal) so players can self-clear data.

## Injection & XSS surface

- All dynamic text is **canvas-drawn** (signs, billboards, gantries) or rendered via `textContent`/templates from **internal constants** — never from user input, so there is no reflection/injection vector in the game. The multi-country chapter content (districts, landmark names, storefronts, plate text) is internal constant data shipped inside `index.html`, so it adds no new input or injection surface.
- No `innerHTML` usage surfaced for user data; keep it that way. If ever rendering user-provided strings, escape HTML.
- **The leaderboard is cross-device, so its names are untrusted input.** `rider_name` comes from another player's device and is rendered through `esc()` in `renderBoard()`. The audit's "no player-supplied value reaches innerHTML unescaped" check covers it. Never interpolate a board row without `esc()`.

## The leaderboard backend (Supabase)

- The client ships only the **publishable (anon) key**. It is not a secret — Row Level Security is the boundary. A `service_role` or `sb_secret_…` key must never reach `index.html`, the admin panel, or a commit.
- `anon` has **SELECT only** on `public.leaderboard`. There is no insert/update/delete policy, so a client cannot write a column directly — proven by test (`INSERT` → 401; `PATCH`/`DELETE` affect 0 rows).
- The single write path is `submit_score()`, a `security definer` function that re-validates and clamps everything server-side (name length, score/earnings caps, rating range, country allow-list). The client is untrusted by definition, so no validation is trusted from it.
- A client-authored score can still be forged — that is inherent to any client-side leaderboard. The caps exist to stop trivial abuse and unbounded write pumps, not to certify honesty. Document this; do not oversell it.
- `device_id` is a random UUID generated once into `SAVE.deviceId`. It is a row key, **not** an account and **not** a persistent identifier tied to a person.
- `.env` (project URL, ref, key, CLI token) is gitignored and never mirrored into `public/`.

## Supply-chain / dependency hygiene

- Vendored dependencies are pinned and licensed to the commit (Three.js r128 = MIT; see `vendor/THREE-LICENSE.txt`). The game itself has **zero runtime dependencies** — the leaderboard talks to PostgREST with the platform `fetch`, deliberately *not* `@supabase/supabase-js`, so no library is bundled or loaded from a CDN.
- Dev-only exception: the `supabase` CLI is a `devDependency` so `npm run db:push` can apply migrations. It is never loaded by the game, never shipped in `public/` or the APK, and is the only non-Node-built-in tooling dependency.
- Google Fonts are fetched at runtime purely as CSS/fonts; no scripts from that origin.
- Update or audit the vendored lib only as a deliberate, tested step (see `Memory.md`).

## Web-platform hardening notes

- PWA must be served over HTTPS (service workers require it) — this alone prevents many MITM issues.
- `manifest.webmanifest` is static and same-file; no user-controlled fields.
- `robots.txt`, `sitemap.xml` and `llms.txt` are static public files describing the game (and linking the
  repo docs). They contain **no private data, no save contents and no player information** — keep it that way;
  never list local storage keys, file paths of private material, or credentials in them.
- Game code is a single file — keep it that way; a build pipeline would introduce order-of-execution, minification-renaming and supply-chain risks for zero benefit here.
- The Android WebView shell declares **no `INTERNET` permission** and `shouldInterceptRequest` refuses every off-host request, so the packaged APK cannot phone home — the offline promise is structural, not a setting.

## Things we deliberately do NOT do

- No ad SDKs, no attribution/SDK blobs, no third-party JS (single Google Fonts CSS link aside).
- The start-screen footer's CC0 + AL ASAR JADEED backlink is the only user-facing outbound link; it uses
  `target="_blank" rel="noopener noreferrer"` so a page it opens can never reach back into the game tab.
- No mic/camera/geolocation/contacts/sensors.
- No auto-forwarded emails, no cloud saves, no accounts. The one social feature is the opt-in **WORLD RIDERS** leaderboard (see *The leaderboard backend*), and it is **web-only** — the Android shell has no `INTERNET` permission, so the packaged APK stays fully offline and `SB.packaged()` disables the board there.
- We don't store passwords, PII, or payment data — there is nothing to store them with.

## If you change something

- Adding any new third-party resource → document it in `CREDITS.txt` + `licence.md`, verify its license, and confirm offline fallback.
- Bumping the Three.js version → re-audit `CanvasTexture`/`Sprite`/anisotropy behaviour and re-test on low-end mobile.
- If a remote call ever becomes necessary → review CSP, add a Content-Security-Policy `default-src 'self'` with explicit allowlist, and note the exception here.