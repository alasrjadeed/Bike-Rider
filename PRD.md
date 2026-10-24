# BIKE RIDER — PRD

Product Requirements Document.

## 1. Summary

**What:** BIKE RIDER — a play-in-the-browser, offline-capable 3D game. You ride a motorcycle carrying passengers, food and parcels through a fictionalised Gulf country, earning and upgrading your bike. One engine ships **three runtime-swappable countries** — Bahrain (the home game), Saudi Arabia and the UAE — each a *single city* (Saudi = **Riyadh**, UAE = **Dubai**) with its own districts, landmarks, streets, bus livery, licence plates and currency. Ships as a PWA and as an Android APK, credited to **AL ASAR JADEED** with full SEO (canonical/OG/sitemap/robots at `https://alasarjadeed.com`).

**Tagline:** *DELIVER BAHRAIN • EARN • UPGRADE.*

**Form factor:** Single-file HTML5/WebGL app. Works on desktop browsers and mobile Safari/Chrome. PWA-installable, offline-capable, landscape-oriented.

## 2. Problem / opportunity

- Lightweight, immediately playable games that feel **culturally specific and loved** are rare. Most traffic/riding games are generic western city drifts.
- Established players (commute-time session players) get a "9-minute shift" — a real work cycle with a payout, not a score attack.
- The game carries zero asset-licensing cost because everything is procedural and original.

## 3. Goals

1. Deliver a complete, honest gameplay loop: **ride → earn → upgrade** within a single 9-minute shift arc.
2. Make the player *feel like a Gulf rider*: the horns, the clutter, the tenacity of the traffic, the pride of a clean run — and let them ride the same loop in **Bahrain, Saudi Arabia and the UAE** without the engine or the economy changing (country is thematic data: streets, landmarks, plate, currency, livery).
3. Run smoothly on a mid-range 2019-era phone, offline, no install friction.
4. Provide real progression (5 levels, 3 bikes, 10 parts, 8 paints, 6 outfits) that changes how the game plays, not just its numbers.

**Non-goals (v1):** multiplayer, real money, real-world brands, downloadable assets, level editor, monetisation — including **ads**: the game is free play (no sponsor/house ads, no ad credit currency, no unlock or reset gates paid in video views).

## 4. Target user

- **Primary:** mobile players with 5–15 min commutes; nostalgic for 70cc culture.
- **Secondary:** web-game browsers who want a "Bahrain map" experience.
- **Pencil person:** *Ahmed, 26, rides a Sitara to work daily.* He knows the exact streets this game pretends to be, and the game must earn his nod of approval — not just his playtime.

## 5. Core loop (clock cycle)

```
[ shift starts ] → [ ride / pick jobs ] → [ comfort+speed → stars → tips/fare ]
                    [ crash / violation / late → penalty ]
→ [ end of 540 s shift ] → [ summary: earnings, level, unlocks ] → [ garage: upgrade ]
→ [ next shift, harder city ]
```

## 6. Feature requirements

### R6.1 Riding & physics
- 4-lane road, good bike + player physics: acceleration, braking, lean, gears (4–5 per bike).
- Collisions, crashes with damage; wrong-way rider risk; police checkpoint speed limit (`CHECK_MAX`).
- Condition model: fuel, engine, tyres, damage — degrade from bumps/crashes/use; serviceable in garage.

### R6.2 Jobs (the economy)
- Offer-based work: jobs appear as cards; player accepts voluntarily.
- Job types (10): passenger, food, parcel, medicine, fragile, urgent, rush, vip, multi, long.
- Each with `base` + `perKm` (+ `perStop`), tier by rider level, `strict`/`risky` variants, comfort/fragile impact on payout, tips from stars for passenger jobs, penalties for lateness/damage.
- Multi-stop drop sequences; long-distance big-fare routes.

### R6.3 City & traffic
- 48 fictionalised Bahrain districts across four governorates, with distinct architecture/mood; district gantry
  gates and 48 placed landmarks (30 model kinds across all chapters; bh uses 18) as waypoints.
- Chapters are single-city: sa = **Riyadh** (20 districts), ae = **Dubai** (20 districts) — real landmark names
  allowed, storefronts/brands fictional (R6.3 rule, pinned by `chapter-switch`).
- Day cycle (dawn/night), dynamic weather (rain, smog), rush-hour density, signals + cross traffic, lane-change traffic, potholes, speed breakers, roadworks, waterlogged roads, police checkpoints, wrong-way riders.

### R6.4 Progression
- XP → 5 rider titles (New Rider → Manama Legend). Level gates content (jams, checkpoints, urgent tiers, multi-stop, long rides, route choice).
- Cash → garage: repairs, fuel, parts (10), paints (8), outfits (6), bikes (3).

### R6.5 Accessibility & UX
- Settings: sound, music, sfx, quality (auto/low/high), screen shake, time mode, weather mode.
- Tutorial for new riders; offline play; desktop + touch controls; fullscreen across screens; pause anytime.

### R6.6 Persistence
- Save every meaningful change; `save v1` schema, forward-migrating via `deepMerge`; reset option with confirm dialog.
- Stats: total earnings, best shift, jobs, distance, violations, perfect/failed.

## 7. Non-functional requirements

- **Performance:** 60 FPS target on mid-range 2019 Android / iPhone X era; zero per-frame allocation; object pooling throughout.
- **Compatibility:** modern Chrome/Safari/Firefox; iOS landscape; Android WebView incl. embedded contexts.
- **Offline:** full game playable after first visit (SW cache), incl. music.
- **Security:** no external network calls (Google Fonts only, offline-fallback); no analytics; local data only — see `security.md`.
- **Licensing:** all bundled assets original or permissively licensed (Three.js MIT, fonts OFL, theme CC0) — see `licence.md`.

## 8. Success metrics

- Could measure (analytics out of scope): % players completing ≥1 shift; shift→garage conversion; sessions ≥9 min; level-lingering curve (players stuck on early cash grind).
- Qualitative goal: local players say "this feels like home".

## 9. Open product questions

- Should the opening balance (BHD 10) buy a paint before shift 1? Paints currently start free only at red. The
  measured curve is: opening BHD 10, cheapest upgrade BHD 20, a level-1 shift ≈ BHD 17.9 — so the first purchase
  lands about 1.1 shifts in. The `economy` regression group recomputes this and fails if the pull disappears.
- Do we expose a "free ride" sandbox mode post-tutorial (no cash, no jobs)? Good for screenshots.
- Store presence: the APK is built and signed; Play Store listing, iconography and a privacy policy are not
  written. PWA remains the primary distribution.
- SEO/discoverability: shipped — head (title/description/keywords/author/robots), canonical, Open Graph +
  Twitter cards, JSON-LD `VideoGame` schema, `robots.txt` + `sitemap.xml` + `llms.txt` all point at the hosting
  root `https://alasarjadeed.com`; the start-screen footer carries the AL ASAR JADEED backlink.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Autoplay/audio blocks in browsers | Gesture-gated `AudioContext` resume (already in `AU`). |
| Old browsers vs WebGL | Vendor r128, `applyQuality` fallback; graceful message. |
| Balance = "grindy" | Watch Task.md balance items; adjust costs rather than adding content. |
| Scope creep (ambient layers, leaderboards) | Parked in Brain.md/Task.md; ship per phase. |
| Save corruption on user-owned storage | Documented reset path; defensive `deepMerge` parsing. |