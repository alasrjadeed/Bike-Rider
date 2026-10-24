# BIKE RIDER — Rules

Development guardrails. Read before editing. These keep the project single-file, legal, fast and coherent.

## Absolute rules (never break silently)

1. **One file, no build step.** All game code lives in `index.html`. `package.json` exists but is **zero-dependency** (only `npm test`/`build` scripts — nothing to install), and there is no bundler or preprocessor. If you think you need one — you don't.
2. **No external assets.** Every model, texture, sound, font and icon is generated from code or beyond-reproducibility original bundlables (`music/bike-riders-theme.wav`). Never commit a downloaded sprite, texture, sample or font file — only original or vendored-with-license files.
3. **No real-world brands, people, or maps.** Fictional only (BahrainRide, KhanaJet, DakBox, SehatPlus, Sitara Motors, Zoom Fuel, fictionalised districts). Real street names are "fictionalised settings" per CREDITS.
   - **The app's own name is BIKE RIDER** (store name and launcher label must both read BIKE RIDER). This is the name AppGallery rejected under rule 9.5 as too close to the existing game *Bike Rider*; v1.0.4 briefly shipped as **BAHRAIN RIDERS** to clear the rejection, and v1.0.5 reverted to BIKE RIDER by the owner's decision. Re-submitting under this name risks a second 9.5 rejection — that risk is accepted and on the record, not an oversight. A *fictional in-game courier company* also called "Bike Rider" (player-editable, settings default) exists and is intentional; note that since v1.0.5 it is the same string as the product name, so the two can no longer be told apart in-game.
   - **Package identity is `com.bikerider.game`** — this value lives in `android/app/build.gradle` (`applicationId` + `namespace`), `MainActivity.java`'s package, `agconnect-services.json`'s `package_name`, and `android/AndroidManifest.xml`. All five must move together; a mismatch breaks the AppGallery build.
   - **Never hand-edit `agconnect-services.json`.** It is issued **per app** by Huawei's console and is not interchangeable. Rewriting the `package_name` strings inside it does *not* make it valid for a new app — `app_id`, `client_id`, `project_id` and `api_key` still point at the old AGC record, and the build succeeds anyway. The result is a bundle that uploads cleanly and then attaches to a superseded listing. To move to a new AppGallery project: create the app in the console, **download a fresh `agconnect-services.json`**, and replace the file. `tools/build-aab.mjs` blocks the build if the file's `app_id` is in `SUPERSEDED_AGC_APP_IDS` or its `package_name` disagrees with `applicationId` — add retired app_ids to that set rather than deleting the check.
   - **Signing credentials are not brand names.** A project-wide rename must never rewrite `storePass`/`keyPass` in `android/keystore.properties` or `android/app/build.gradle`; doing so fails 36 s into Gradle with `BadPaddingException`. `tools/build-apk.mjs` probes the keystore with `keytool -list` before building and names the cause if the password no longer opens it.
   - **Geo names, not trademarks.** The multi-country chapters keep real *famous landmark* names (Kingdom Centre, Al Faisaliah, Masmak Fortress — Riyadh; Burj Khalifa, Burj Al Arab, Dubai Frame — Dubai) — geography is not a brand — but every storefront, mall and company must stay invented in every country (never ARAMCO, SABIC, STC, EMAAR, ADNOC, ETISALAT, DP WORLD, CARREFOUR or any real trademark, in any chapter). Currency is display-only (`fmtRs`); economy numbers are shared so chapters can never fork balance.
4. **Attribution is sacred.** Keep `CREDITS.txt` and `vendor/THREE-LICENSE.txt` accurate. Any added dependency must carry its license and be listed.
5. **Performance budget is enforced by review, not tooling.** Per-frame = no allocations: append to pools, reuse temp vectors (`_v1`…`_m3`), reuse geometries (`gKey`). Object pools for any recycled entity (`poolGet`/`poolPut`, `RIGPOOL`, traffic pools).
6. **Save compatibility is forward-only.** Schema `v:1` must stay understandable by `deepMerge`. Add fields to `defaultSave()`; never change meaning of an existing field in place. New major schema → bump `v` and write a migration.
7. **Service worker discipline.** On every release bump `VERSION` in `sw.js`. Test offline before shipping.
8. **A11y basics.** All controls keyboard+navigable on desktop, touch on mobile; Esc/Backspace respected (`goBack`); font-shadow contrast maintained; screen shake optional.

## Coding conventions

- Reuse the smart helpers: `clamp`, `lerp`, `damp`, `rand(1)`, `randi`, `pick`, `chance`, `weighted`, `smooth`, `fmtRs`, `fmtTime`, `fmtDist`, `shade`. Don't invent parallel ones.
- Naming: `UPPER_SNAKE` for config consts; `SAVE` for persisted state; single letters only for well-known runtime singletons (`P`, `T`, `H`, `EV`, `W`, `X`, `M`, `G`).
- Keep the section-banner comment style (`// ---- name ----`); update line-numbered maps in `Architecture.md` when sections move.
- Match file formatting exactly (compact expressions, 2-space CSS, existing brace style). Mind the huge-list style used for sets (e.g. `LEVELS`, `PAINTS`).
- No dead code accumulation: if you remove a system, delete it, don't comment it out.
- Arabic strings stay in the `.ar`/`logoAr` path (`Noto Naskh Arabic`, `dir`/RTL handled) — match the existing pattern rather than inventing a new one.

## Balance & feel rules

- Fares should always make a **decisions** — choices between a safe parcel run and a risky urgent run, not an automatic "best".
- Early game must feel tight but never blocked: the first upgrade should be reachable within ~2 shifts.
- New job types must arrive alongside a matching district/level unlock so they're *seen in context* (see `LEVEL_UNLOCKS`).
- Difficulty must *teach*: a new hazard type appears at a level where it's survivable, with tutorial floaters (`hint`/`tut*`) when relevant.

## Process rules

- Keep `Task.md` and `Memory.md` truthful; update them as part of the change, not after.
- Keep `Task.md` and `Memory.md` truthful; update them as part of the change, not after.
- **Keep the doc set honest.** The docs are the map of the single file: `Brain.md`, `PRD.md`, `TRD.md`,
  `Architecture.md`, `app flow.md`, `backend scema.md`, `UI-UX Design Brief.md`, `Design.md`,
  `open graph tags.md`, `Phases.md`, `Task.md`, `Implementation Plan.md`, `Rules.md`, `security.md`,
  `licence.md`, `Memory.md`. When one of them makes a claim you change, update it in the same change. When
  you add or rename a doc, edit `tools/auto-mcp-index.sh`'s `DOCS` array and **regenerate** `mcp-index.md`
  (`bash tools/auto-mcp-index.sh`) — never hand-edit the index. Keep `llms.txt` in sync too (it is mirrored
  by `sync:public` alongside `robots.txt`/`sitemap.xml`).
- No analytics, no network telemetry, no dependency on network for gameplay (fonts degrade gracefully).
- **Free play, structurally.** Ads are removed and must stay removed: `adSessionUnlock()` returns `false`, no
  gameplay path may call `adOpen`, and a session or a RESET is never traded for a video. The dormant ad engine
  is studio-only; re-adding ads means adding _deliberate_ triggers, never a settings flag. `free-play` is a
  permanent regression group that asserts this every release.
- **Author credit + SEO stay pointed at the owner.** The start-screen footer keeps the "Made by **AL ASAR
  JADEED**" line backlinking to `https://alasarjadeed.com` (single line — `start-screen-fit` pins it), and the
  canonical / OG / Twitter / `robots.txt` / `sitemap.xml` URLs all use that hosting root. If the hosting host
  changes, update the head, `robots.txt` and `sitemap.xml` together.
- Testing: `npm test` (static audit + 44 headless-Chrome regression groups) must pass before a release, **and** a
  full shift must be played by hand on desktop (keyboard), on a real phone (touch) and on a real Android device
  (the WebView shell is not covered by the browser suite). The old in-app `autotestStep` is gone; `?test` drives the
  autopilot for unattended soak runs.
- Never hand-edit `public/index.html` — it is a mirror of the canonical root file. Use `npm run sync:public`.
- No remote `<script src>`, ever. The offline build and the APK both depend on the game starting with no network,
  and `tools/audit.mjs` fails the build if one appears.
- When in doubt, follow the closest existing pattern in the file over a "better" idiom found elsewhere.