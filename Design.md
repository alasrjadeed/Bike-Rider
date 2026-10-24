# BIKE RIDER — Design.md

Design spec: art direction, UI/UX, HUD, audio and brand guidelines. Aimed at whoever extends the game next.

> The **interface build contract** (HUD zones, controls, screens, accessibility, states) lives in
> **`UI-UX Design Brief.md`**; this file holds the art direction and brand language it builds on.

## Art direction

**Aesthetic: "painted heat" — saturated dusk city, readable from a phone at speed.**

- Procedural, stylised, vertex-coloured 3D (no textures on most geometry; canvas textures for signs/roads/billboards).
- Palette is governed by the time-of-day + weather system (`applyTOD`): warm sodium lamps at night, hazy amber daylight, desaturated smog, silver rain.
- World density tells the story: old-city souqs (Manama Souq, Muharraq) feel cluttered and loud with karak stalls, date crates and parked bikes; commercial strips (Seef, the Diplomatic Area) feel cleaner with plazas and billboards.
- **Clutter is character**. Trees, wires (catenary curves), street poles, median lamps and fruit stands fill the kerb on top of each district's `BUILD_MIX` style; neighbourhood streets come from the `STREETS` catalogue via `streetFor(dist)`.

### District style guides

| Style | Feel | Building mix (`BUILD_MIX`) |
|---|---|---|
| residential | quiet, green, parked bikes | house 55, villa 20, shop 10, mosque 5, filler |
| commercial | glassy plazas + billboards | mall 35, shop 30, mosque 5, filler |
| market | busy, brand-crowded | shop 50, mall 20, mosque 10, filler |
| oldcity | tight old-city souqs | shop 70, mosque 10, filler |
| food | food streets, karak smoke | shop 60, mosque 10, filler |
| mixed | commercial + villa blend | shop 35, house 25, mall 15, villa 10, mosque 8, filler |

### Brand system

Fictional brands engraved on signage, billboards and cargo: **BahrainRide** (quick mobility), **KhanaJet** (food), **DakBox** (parcels), **SehatPlus** (medicine), **Sitara Motors** (the garage) & **GAUSS AUTO** (the bike showroom — a 13-model fictional line: Hareed, Riffa, Gulf, Nakhla, Dhowri, Sabeel, Zahra, Nadir tiers), **Zoom Fuel** (petrol). Brand strips are canvas-drawn (`drawBrandStrip`) — keep the colour system: bg + fg text, high contrast.

### Country chapters (theme pass)

The engine is country-agnostic; each chapter re-skins the swappable surfaces. Keep each country *readable at a glance*:

| Chapter | Primary (`--bh`) | Bus livery | Plate | Currency (`fmtRs`) | Character |
|---|---|---|---|---|---|
| 🇧🇭 Bahrain | `#ce1126` red | `#ce1126` red body | "BAHRAIN · BH" on ivory | `BHD 12.500` | the home game — never change it |
| 🇸🇦 Saudi — one city, **Riyadh** (20 districts) | `#006c35` green | `#1a7a4a` green | "SAUDI ARABIA · SA" on white | `SR 12.50` | wide boulevards, desert escarpments, Heritage-souq districts |
| 🇦🇪 UAE — one city, **Dubai** (20 districts) | `#00732f` green | `#b6262e` red | "UAE · DXB" on white | `AED 12.50` | glassy boulevards, waterfront, the Burj/Atlantis silhouettes |

Each chapter is deliberately a *single city* (no Jeddah/NEOM mix in sa, no Abu Dhabi/Sharjah mix in ae);
`chapter-switch` pins `gov:'Riyadh'` / `gov:'Dubai'` on every district.

Start-screen country tabs and the profile "Country" line are tinted by `CHAPTER.active.theme.primary`; the
settings row and tabs live outside the game's i18n `t()` table (English "🌍 Country" literal, matching the other
settings rows). Swapping chapters is a full world rebuild (`worldReset`) — the theme must read immediately from
the first chunk.

The start-screen footer carries the author credit — "Made by **AL ASAR JADEED**" → `https://alasarjadeed.com` —
as a single `rel="noopener noreferrer"` line (pinned by `start-screen-fit`); the `<head>` ships
canonical/OG/Twitter/JSON-LD pointed at that hosting root (see Architecture.md "SEO & discoverability").

### Colour tokens (CSS `:root` + materials)

```
ink   #0b0f16   background / night
gold  #ffc21a   brand gold / money / XP bar
brand #ff2a33   brand red / primary accent (CSS --brand)
brand2 #ff4d55  brand red tint (CSS --brand2)
green #19c37d   money-up, positive, GO
red   #ff4d4d   danger, late, crash
teal  #20c9c0   passenger rides
pink  #ff3d8b   urgent rides
blue  #4da3ff   multi-stop
muted #aab2bf   secondary text
```

Job chips reuse these per `JOBT.color` — **never change a job colour without updating the HUD legend**.

## UI / UX

### HUD layout (landscape)
- Top-left: cash + today's earnings + level/XP bar.
- Top-centre: active job chip, destination, fare/stops, comfort bar (`#hudJob`).
- Top-right: rating stars, in-game clock + time-of-day, icon buttons (nav/garage/settings/audio/pause).
- Bottom-left: speedometer dial + gear.
- Bottom-right: condition panel (fuel, engine, tyres, damage + warning blinker).
- Under the top bar: turn-by-turn nav arrow, next-signal chip, road-alert banners.
- Floating: earnings/XP floaters, speech bubbles, toasts, tutorial callouts.
- Privacy/safety: the phone-offer "job offer" card slides in from the right and can be declined (`jobX`).

### Interaction rules
- **1 finger = 1 action.** Left thumb = accelerate/brake zone; steer = tilt/left-right; horn and brake buttons clearly separated; no simultaneous-nonsense.
- Every action must give immediate visual + audio feedback (engine pitch, screen shake, speed lines).
- Readability: font `Baloo 2` (Latin) + `Noto Naskh Arabic` (Arabic) + Noto Sans Thai/Devanagari/Gurmukhi for the other UI languages. Numerals use `tabular-nums`.
- Buttons min 44×44 px, `.ibtn` pattern; hit-target safety even when visually compact.
- Compact-landscape handling: `.compact` CSS collapses HUD groups to keep play area clear.

### Screens
- **Boot/Load**: progress bar, "DELIVER BAHRAIN • EARN • UPGRADE".
- **Menu**: title, animated menu scene, country tabs, difficulty picker, START DELIVERING, GARAGE, SETTINGS, FULLSCREEN; the author credit + backlink line sits in the footer.
- **Garage**: tabs — Service (repairs + fuel), Performance (10 parts), Style (paints/outfits), Bikes (GAUSS AUTO showroom), Helmets, Skills, Profile (stats + level unlocks).
- **Pause / Summary / Modals**: consistent `panel` glass look (blur + border).

### Tutorial
Four timed cards (`UI.tut`) walk a new player through **STEER → BRAKE FOR PICKUP → DELIVER THE ORDER →
EARN & UPGRADE**, then a READY card hands control back — no staged spawns (`G.tutorial` silences hazards and
traffic). Skippable (`tutorialSkip`) and never re-triggered after `tutorialDone` is set.

## Audio design

- **Music**: original CC0 composition — `music/bike-riders-theme.wav` (filename per `CREDITS.txt`), synthesised from code, no samples. It is a **reference track only**: the game loads no audio files (the old `public/music/` stems folder has been **deleted**) — every in-game sound comes from the `AU` synth, and the on-screen player (`MUSIC`, the ♪ panel) lets players queue their own tracks.
- **Engine**: procedural synth; RPM tracks speed and gear; volume/ducking under settings.
- **Horn**: three-layer horn for "delivery" character, `hornDown`/`hornUp`.
- **SFX**: cash, pickup, drop, crash, boost, checkpoint whistle, UI clicks — all Web-Audio synth, no samples.
- Settings: `sound`, `music`, `sfx` toggles persisted in save. Expect `vibration` later on touch.

## Accessibility / polish goals

- High contrast text over any backdrop (shadowed floaters, panel glass).
- Screen-shake can be disabled (`shake` setting). Proposed: reduce-motion option.
- All menus keyboard-navigable (Esc/Backspace handled in `goBack`).
- Graceful degradation: fonts fall back; no-JS shows dark background only.