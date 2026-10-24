# BIKE RIDER — App flow

The screens, states and user journeys of the game. State is `G.state`; screens are driven by
`UI.show(id)` and the offset camera (`setViewShift`). Code references are in `index.html`.

## High-level state machine

```
              ┌──────────── overlay ────────────┐
              │  modalSettings   modalConfirm   │
              │  screenAdmin (hidden)  modalAd  │   (dormant / owner-only)
              │  rotateHint      err overlay    │
              └─────────────────────────────────┘

 boot
  │  loading  ──► menu ────────────────► garage ──► playing ⇄ paused
  │                ▲  ▲                     │           │        │
  │                │  └─────────────────────┘           │        │  (back / Esc)
  │                │        (BACK)                      ▼        ▼
  │                └──────────────────────────── summary ◄── endShift
  │                                             │
  └─────────────────────────────────────────────┘   (next shift / menu)
```

- States: `loading → menu → garage → playing ⇄ paused → summary → menu`, plus a transient `ended`
  while the shift settles.
- Every screen is a full-viewport `#screen*` node; `hud` is the live-play layer.

## Screens

| `id` | State | Purpose | Key controls |
|---|---|---|---|
| `#loading` | `loading` | Boot progress (bar + tip). Fonts-offline safe (2 s cap). | — (auto-advances) |
| `#screenStart` | `menu` | Title, animated menu scene, **country tabs** (🇧🇭/🇸🇦/🇦🇪), difficulty picker, author credit footer. Scroll-safe on short phones. | START DELIVERING, GARAGE, SETTINGS, FULLSCREEN |
| `#hud` | `playing` | Live play layer (see `UI-UX Design Brief.md`). | GAS / ◀ ▶ pads, brake, horn, icon buttons |
| `#screenGarage` | `garage` | Tabs: **Service · Performance · Style · Bikes · GAUSS AUTO · Helmets · Skills · Profile**. | BACK, START SHIFT |
| `#screenPause` | `paused` | Pit-stop menu mid-shift. | RESUME, GARAGE, SETTINGS, END SHIFT |
| `#screenSummary` | `summary` | Shift earnings, level/XP, unlocks, landmarks `n/48`. | NEXT SHIFT, GARAGE, MENU |
| `#modalSettings` | overlay | Sound/music/sfx, quality, screen-shake, text size (`uiScale`), time, weather, language, difficulty, HUD mode, Company, Export/Import, Reset. | row controls, CLOSE |
| `#modalConfirm` | overlay | Destructive confirm (e.g. reset progress, quit shift). | CONFIRM / CANCEL |
| `#rotateHint` | overlay | "Turn your phone" for portrait handsets. | — |
| `#err` | overlay | `reportError()` friendly crash message. | DISMISS / RELOAD |
| `#screenAdmin` | overlay | **Hidden, passcode-gated** owner page (5 taps on the logo in 0.9 s, or `?admin`). | passcode, BACKEND |

`#modalAd` exists but is **dormant** — no gameplay path calls `adOpen` (free play).

## Key journeys

### 1. First run → a shift
1. Boot: `loadSave()` reads `bahrain_rider_save_v1` (defaults on first run) → materials/textures/
   prototypes build → `loading` resolves → `menu`.
2. `CHAPTER.init()` has already activated the saved `chapter` (`bh` default).
3. Player picks a **country tab** (optional) — full world rebuild (`worldReset`), theme + plate + bus
   livery + currency swap. Then `START DELIVERING`.
4. **Tutorial** (first time only): four timed cards — *STEER → BRAKE FOR PICKUP → DELIVER THE ORDER →
   EARN & UPGRADE* — then READY. `G.tutorial` silences hazards/traffic; `tutorialDone` is persisted
   and the cards never re-trigger. Skippable (`tutorialSkip`).
5. `startShift()` → `playing` for a **540 s** shift (overtime can extend +180 s at ×1.5 pay).

### 2. The shift loop (play)
- **Job offers** slide in from the right as cards; accept (`jobAccept`) or decline (`jobX`).
- Ride → pick up → deliver. Comfort + speed drive stars → tips; crashes/violations/late hits the fare.
- Hazards and events roll in (potholes, speed breakers, rain/smog, rush hour, police checkpoints,
  wrong-way riders). School zones cap 30 km/h (fine BHD 10; horn refused, BHD 5).
- HUD carries route instruction, next signal, cash, condition (fuel/engine/tyres/damage) and alerts.
- **Pause** at any time (`paused`); back out to garage or settings.
- `endShift()` → `ended` → **summary**.

### 3. Garage loop (spend & upgrade)
`menu → garage`; tabs:
- **Service** — repairs + fuel (`serviceCosts()`).
- **Performance** — 10 upgrade parts (`UPG`).
- **Style** — 8 paints, 6 outfits.
- **Bikes** / **GAUSS AUTO** — 13-model showroom (turntable, VIEW/BUY).
- **Helmets** — 4 tiers, preview; **Skills** — trained skills + earned level perks.
- **Profile** — stats, level unlocks, country line.
BACK returns to `menu`; START SHIFT goes to `playing`.

### 4. Chapter (country) switch
Available from the start screen tabs and Settings → `🌍 Country`. `CHAPTER.set(id)`:
`SAVE.chapter = id` + persist → swap world arrays → `padCityInvariants()` → `applyTheme()` →
`lmRegister()` → `rebuildPlate()` → `trafficClear()` + `buildTrafficProtos()` → `worldReset()` /
`playerReset()` / `rebuildBike()` → toast + UI re-render.

### 5. Owner/admin
`#screenAdmin` is reached only by 5 taps on the start-screen logo inside 0.9 s, or `?admin` /
`?admin=CODE`. Passcode-gated (default `1234`). Pauses the ride and resumes on close. Its BACKEND
section holds the remote-config URL (`fetchRemoteConfig()` stub). Players never see ad/credit
controls.

## Back navigation (`goBack()`)

`window.__brBack` is exposed for the Android hardware back button; the Activity only exits when
`goBack()` reports it consumed nothing. Priority order:

1. `loading` → ignore.
2. `modalConfirm` open → close it.
3. `modalSettings` open → `closeSettings()`.
4. `ADM_OPEN` → `adminClose()`.
5. `playing` → `pause()`; `paused` → `resume()`.
6. `garage` or `summary` → `goMenu()`.
7. otherwise → not handled (Activity exits).

## Persistence points in the flow

- Save on every meaningful change (job completed, purchase, settings close, chapter swap, landmark
  seen, skill awarded).
- `RESET PROGRESS` (Settings, behind a confirm modal) wipes the player save only — studio config,
  credits and premium survive (separate key). See `backend scema.md`.

## Related

- Visual/UX detail: `UI-UX Design Brief.md` and `Design.md`.
- State/code map: `Architecture.md` → *State machine (screens)*.
- Rules that constrain flow changes: `Rules.md`.
