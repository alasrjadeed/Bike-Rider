# BIKE RIDER — UI/UX Design Brief

The interface contract: what the player sees, where it sits, how it responds, and the rules that
keep it readable at speed on a phone. This is the *build* brief — `Design.md` holds the art
direction and brand language; `app flow.md` holds the screen/state machine.

Direction: **"painted heat"** — a saturated dusk city that must be readable in one glance while
riding. Readability beats realism. Everything is landscape, touch-first, mobile-first.

## 1. Platform & canvas

- Landscape only. Portrait phones get the `#rotateHint` "turn your phone" overlay.
- **Reference handset: 823×384 CSS px** (a 1080×2316 @450dpi phone sideways). Phone rules use
  `@media (max-width:760px),(max-height:520px) and (orientation:landscape)`; check **both** when
  adding one.
- Fullscreen across screens; canvas fills the viewport; safe-area insets respected
  (`viewport-fit=cover`).
- 3D scene is the backdrop; all UI is HTML/CSS layered above, except in-world signage/canvas art.

## 2. Design language

- **Colour tokens** (CSS `:root` + materials): ink `#0b0f16`, gold `#ffc21a`, brand `#ff2a33`,
  brand2 `#ff4d55`, green `#19c37d`, red `#ff4d4d`, teal `#20c9c0`, pink `#ff3d8b`, blue `#4da3ff`,
  muted `#aab2bf`.
- **Job chips** reuse those per `JOBT.color` — **never change a job colour without updating the HUD
  legend** (grey/gold/green/red/teal/pink/blue mean job tiers).
- Country theme tint: the start-screen tabs and profile row use `CHAPTER.active.theme.primary`
  (Bahrain `#ce1126`). Swapping a chapter re-colours `--bh`/`--bhAcc` + `meta theme-color`.
- **Surfaces**: glass panels (blur + 1px border). In-play overlays are deliberately translucent
  (`--panel rgba(5,6,8,.52)`, `--panel2 rgba(6,7,10,.68)`) so the road stays visible.
- **Type**: `Baloo 2` (Latin), `Noto Naskh Arabic` (Arabic, RTL), `Noto Sans Thai/Devanagari/Gurmukhi`.
  Money/time use `tabular-nums` so digits don't jitter.

## 3. HUD layout (landscape, `#hud`)

| Region | Contents |
|---|---|
| Top-left | Cash (`#hudCash`), today's earnings, level + XP bar (`#todayVal`) |
| Top-centre | Active job chip, destination, fare/stops, comfort bar (`#hudJob`) |
| Top-right | Rating stars (`#rateBox`), in-game clock + time-of-day (`#clockBox`, `#todVal`), icon buttons (nav/garage/settings/audio/pause), HUD-eye toggle (`#btnHudEye`) |
| Under the top bar | Turn-by-turn nav arrow (`#roadPlate`), next-signal chip, road-alert banners |
| Bottom-left | Speedometer dial + gear (`#cond` readouts) |
| Bottom-right | Condition panel: fuel, engine, tyres, damage + warning blinker |
| Floating | Earnings/XP floaters, speech bubbles, toasts (`#toast`), tutorial callouts (`#tut`) |

- **HUD mode** (`hudMode` setting): `auto` = readouts fade when idle (body-class opacity +
  pointer-events only — never `display`, so layout never shifts); `full` = never fade. `#btnHudEye`
  toggles.
- **Text size** (`uiScale`): `compact 0.9 · standard 1 · large 1.13 · xlarge 1.23`. Type scales via a
  `--fsz` ratio; the layout and canvas do **not** zoom, so the 3D aspect ratio is preserved.
- **Compact landscape** (`@media (max-height:520px)`/`(max-width:760px)`) collapses HUD groups
  (smaller cash/job/nav/cond type) so the play area stays clear.

## 4. Controls

**Keyboard (desktop):** `W`/`↑` throttle, `S`/`↓` brake, `A`/`D` lean, `Space` jump, `H` horn,
`Esc`/`Backspace` back (`goBack()`).

**Touch (`#touchUI`):** `#tGas` (throttle), `#tBrake`, `#tLeft` / `#tRight` (lean), `#tHorn`,
`#tJump`. The old flick-to-change-lane swipe is now **drag-to-lean**, flick-up to jump, tap to settle
into a lane.

**Interaction rules**

- **1 finger = 1 action.** Left thumb owns accelerate/brake; steer is lean (buttons or drag). Horn and
  brake are clearly separated; no simultaneous-nonsense.
- Every action gives **immediate visual + audio feedback** (engine pitch, screen shake, speed lines).
- Buttons are a minimum **44×44 px** hit target (`.ibtn`), even when visually compact.
- Menus are keyboard-navigable; all destructive actions behind `#modalConfirm`.

## 5. Screens (see `app flow.md` for transitions)

- **Boot/loading**: progress bar + tagline "DELIVER BAHRAIN • EARN • UPGRADE".
- **Menu (`#screenStart`)**: logo, animated menu scene, country tabs, difficulty picker, START
  DELIVERING / GARAGE / SETTINGS / FULLSCREEN; author credit + backlink in the footer (one line,
  pinned by `start-screen-fit`). Scroll-safe (`overflow-y:auto`, `.hero margin:auto 0`) on short
  phones so the bottom row is never unreachable.
- **Garage (`#screenGarage`)**: tabs *Service / Performance / Style / Bikes / GAUSS AUTO / Helmets /
  Skills / Profile*. Showroom uses a fixed right sidebar `#showBar` (`width min(340px,38vw)`) with
  `.gFoot` pinned to the bottom.
- **Pause / Summary / modals**: consistent glass `panel` look.
- **Tutorial** (`#tut`): four timed cards then READY, skippable (`#tutSkip`), never re-triggered
  after `tutorialDone`.

## 5b. States the UI must handle

- **Empty** — no active job (`hudJob` idle), empty garage tab, zero credits/landmarks seen.
- **Loading** — boot bar, capped font wait (works when the webfont stalls; `no-fouc-block`).
- **Error** — `reportError()` overlay (`#err`) with a readable message and a dismiss/reload.
- **Portrait** — `#rotateHint`.
- **Offline** — identical UI; webfonts fall back to system faces, gameplay unaffected.

## 6. Accessibility & polish goals

- High-contrast text over any backdrop (shadowed floaters, panel glass).
- **Screen shake is tri-state** (`normal` / `reduced` at 0.35× / `false` = off) — a reduced-motion
  affordance; shipped as the shake setting.
- All menus keyboard-navigable; `Esc`/`Backspace` respected everywhere (`goBack`).
- Hit targets ≥ 44×44 px; icon buttons use the `.ibtn` pattern.
- Graceful degradation: fonts fall back; no-JS shows the dark background only.
- **i18n / RTL**: all text via `t()` (`en`, `ar`, `fil`, `hi`, `th`, `pa`); Arabic runs RTL through the
  `.ar`/`logoAr` path. Never hard-code a UI string that a translation should own — and never change a
  semantic colour without updating the legend.

## 7. Open questions (see also `Brain.md`, `Task.md`)

- Vibration on touch (proposed; not shipped).
- Full reduce-motion option beyond the shake tri-state.
- Remaining tutorial/touch ergonomics pass on a real low-end device.
