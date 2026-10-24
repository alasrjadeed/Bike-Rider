# BIKE RIDER — Brain

Living design log. Update this file whenever the project's thinking changes.

> **Retargeted to Bahrain.** The original log was written around Lahore. The code retargeted to
> Bahrain (48 districts, four governorates, BHD, 48 landmarks) and this file was rewritten to match, because
> a design log that describes a different game is worse than no design log. The pillar *shape* survived; only the
> subject changed.

## Vision (one line)

> Ride through Bahraini traffic. Carry passengers, deliver food and parcels, earn BHD and upgrade your bike.

## Why this game exists

- A love letter to a very specific world: the motorcycle courier / ride-share culture of the Gulf.
- Everything in the game is *felt* first — the honking sedan, the speed breaker, the smell of the food street — and
  described second.
- Built as a single-file playable web game: open `index.html`, play, no install, PWA-offline on mobile, and an
  Android APK for players who want one.

## Core fantasy

You are a small rider in a big, loud, living city. You are not a hero — you are trying to earn a living. The city is
the star; you survive it and eventually master it (Manama Legend). Money is tight; the traffic tailgates you on
purpose.

## Core loop (the 3 beats)

1. **Ride** — the joy of the ride: lane weaving, gears, potholes, wrong-way riders, the midnight road.
2. **Earn** — take a shift, take jobs, get paid, get rated. Comfort + speed = tips.
3. **Upgrade** — BHD → parts → better bike → better jobs → more BHD.

The loop resolves every 540 s (9-minute shift), one full arc. Overtime extends the arc by 180 s at ×1.5 pay — enough
to be worth the extra minutes, not so much that it becomes a grind.

## Design pillars (ranked, do not violate)

1. **Procedural everything.** No art pipeline. Models, textures, music, UI — all generated from code at runtime. Keep
   it that way: nobody can lose source assets, and the whole game lives in one file. (The Android launcher icons
   follow the same rule — `tools/make-icons.mjs` rasterises them from a hand-written vector description.)
2. **Respect the subject.** Bahraini clutter, Arabic and English signage, fictional-but-believable brands
   (BahrainRide, KhanaJet, DakBox, SehatPlus, Sitara Motors, Zoom Fuel, GAUSS AUTO). Never cartoonise it into
   "generic city".
3. **Readability over realism.** The screen can be read in one glance at speed: colour-coded job chips, one
   always-visible route instruction, big money numbers. This is why the centre-line is a **double solid yellow**
   rather than a dashed white — the player has 0.2 s to decide whether to thread it, and a dashed line at speed in
   a dark texture is not a decision, it is a coin flip.
4. **Mobile-first.** Landscape, touch controls, fits on a phone, works offline with no network at all, no install.
5. **Deterministic-feeling chaos.** Randomness always weighted; events are fair and teachable (police checkpoints,
   rush hour, waterlogged roads).

## Key design decisions & the "why" behind them

| Decision | Why |
|---|---|
| Single `index.html` | Zero build friction, trivially offline-cacheable, doubles as the whole repo. The *tooling* around it stayed zero-dependency for the same reason: a checkout that needs a 100 MB plugin download is a checkout that cannot build offline. |
| 4 fixed lanes | Pure skill, no steering-noise. Lane choice IS the game. |
| The centre-line pays | Threading it is the single most skill-expressive thing the bike can do, so it needed a mechanical reward. A narrow hit taken upright inside the line is a squeeze past at 0.32× damage — "THREADED", not "CRASH". The skill the game is about should be the skill the game pays for. |
| Indicators read yaw, not input | A blinker that cancels the instant you release the lean is a blinker that lies about what the front wheel is doing. It stays lit while the bike is still yawed that way. |
| 9-minute shifts | Long enough to matter, short enough for a commute-sized session. |
| Money is tight early, but reachable | BHD 10 opening, first upgrade BHD 20, a shift ≈ BHD 17.9. Tight enough that the horn is a real decision; loose enough that the pull lands inside shift 1 or 2. The number is *measured* by the test suite, because a balance claim nobody recomputes is a guess. |
| Real fares feel earned (job types unlock by level) | Progression gate = content gate: lvl1 rides/food, lvl2 medicine/fragile, lvl3 urgent/VIP/checkpoints, lvl4 multi-stop/long, lvl5 legendary routes. |
| Fixed fictional brands | Keeps it legal, keeps it humorous, keeps the city specific. |
| Fully synthesised audio | No licensed samples to ship or clear. There is no audio file in the project at all — which is also why `public/music/` (the old unused stems folder) was a bug, not an asset, and has since been deleted. |
| Night / smog / rain change the rules | Headlight upgrade, tyres matter in rain, smog hurts visibility — parts must change the game, not just numbers. |
| No `INTERNET` permission on Android | The build is local. Denying the permission makes that structural rather than a promise: a URL changed by mistake in the web build cannot become a phone-home. |
| Free play — no ads, no gates | The sponsor film, house ad, credit reward and the unlock gating are gone: a session or a reset is never traded for a video, and credits are not a currency. Enforced structurally (`adSessionUnlock()` is a hard `false`, zero gameplay callers of `adOpen`), so an "ads on" flag can't creep back in by accident. |
| Assets served over an intercepted https origin, not `file://` | `localStorage` is unreliable on `file://` in older WebViews, and a service worker needs a real secure origin. The interception layer also refuses off-host requests, so "fully local" is enforced, not assumed. |
| Test harness over a test framework | 44 groups driving headless Chrome over CDP with Node's built-in `WebSocket`. The value is in the assertions — save round-trips, kerb clamping, crash damage ratios, an economy that must stay tight — not in the runner. |
| One game, three countries (chapters) | The engine is country-agnostic; only the world surfaces (districts, landmarks, streets, plate, currency, bus livery, theme, traffic mix) are data. Bahrain stays the shipped game — its arrays are snapshotted (`CHAPTER.bind()`) so a swap can never mutate the original catalogue. Saudi and UAE ride the same physics, economy and job systems with their own authored single-city worlds (Riyadh only / Dubai only, 20 districts each). More countries = more data rows, not more code. |
| Landmarks are real-famous names, stores are fictional | Geography is safe to keep real (Kingdom Centre, Burj Khalifa, Masmak Fortress, Dubai Frame — players want the nod), so landmark/street *names* stay iconic; storefronts and brands must be invented (never ARAMCO/SABIC/STC/EMAAR/ADNOC/ETISALAT/DP WORLD/CARREFOUR). Currency is display-only formatting — `SR`/`AED`/`BHD` label the same balance numbers, so no economy fork. |
| Single-city chapters (sa = Riyadh, ae = Dubai) | A chapter is one real city, not a country montage — Riyadh's 20 districts, Dubai's 20 districts. Keeps each chapter readable at a glance and the authoring honest; `chapter-switch` pins every sa district `gov:'Riyadh'` and every ae district `gov:'Dubai'`, so a cross-city district can never slip in without a red suite. |
| Author credit + SEO root | The start-screen footer credits **AL ASAR JADEED** with a backlink to `https://alasarjadeed.com` — the chosen hosting root — and canonical / OG / Twitter / `robots.txt` / `sitemap.xml` / JSON-LD all resolve to that root, so search and share previews converge on one owner instead of scattering across hosts. |
| Living docs + a machine index | The project keeps a full doc set (product, technical, architecture, flow, schema, UI, roadmap) plus `llms.txt` for AI readers, because the single file is only navigable if the map outside it stays true. `mcp-index.md` is generated from the set (`tools/auto-mcp-index.sh`) so an index can never quietly go stale by hand. |

## Open questions / thought streams (park here)

- Should parking/saving be possible mid-shift, or does the 540 s guarantee a clean story? (Current: shift = complete
  arc, endShift settles.)
- More job types: group rides? airport runs? "fragile at speed under a strict timer" is popular — maybe a bank-van
  escort (no, out of fantasy).
- Multiplayer ghosts are out of scope; a daily local "leaderboard by distance" could be saved per device.
- What is the level-5 exclusive livery? (Legend Purple currently owns that slot.)
- Sound: more ambient layers — adhan at shift start, a low drone only in one district? Watch scope.
- `public/music/` — **resolved: deleted.** The old unused stems folder is gone; every sound is synthesised.

## Moodboard in words

Heat haze off an exhaust, the thump of a speed breaker, orange sodium lamps, the smell of gahwa at sunset, a gantry
you pass under that names a district in Arabic and English, the causeway lights on the water, the refinery flare
lighting the sky orange, and the rare clean empty midnight boulevard.
