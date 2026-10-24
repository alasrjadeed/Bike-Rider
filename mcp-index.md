# BIKE RIDER - MCP Documentation Index
Generated on Wed Oct 21 10:01:04 AM +03 2026

## Brain.md
Living design log. Update this file whenever the project's thinking changes.
> **Retargeted to Bahrain.** The original log was written around Lahore. The code retargeted to
> Bahrain (48 districts, four governorates, BHD, 48 landmarks) and this file was rewritten to match, because

[View full file](./Brain.md)

## PRD.md
Product Requirements Document.
**What:** BIKE RIDER — a play-in-the-browser, offline-capable 3D game. You ride a motorcycle carrying passengers, food and parcels through a fictionalised Gulf country, earning and upgrading your bike. One engine ships **three runtime-swappable countries** — Bahrain (the home game), Saudi Arabia and the UAE — each a *single city* (Saudi = **Riyadh**, UAE = **Dubai**) with its own districts, landmarks, streets, bus livery, licence plates and currency. Ships as a PWA and as an Android APK, credited to **AL ASAR JADEED** with full SEO (canonical/OG/sitemap/robots at `https://alasarjadeed.com`).
**Tagline:** *DELIVER BAHRAIN • EARN • UPGRADE.*

[View full file](./PRD.md)

## TRD.md
How the game is required to be built and behave, technically. `PRD.md` says *what* the product is;
this says *how* it must run and what a change is allowed to assume.
- Single-file client-side game: **all HTML, CSS and JavaScript live in `index.html`** (currently

[View full file](./TRD.md)

## Architecture.md
Single-file progressive web app: `index.html` (~6,400 lines) contains all HTML, CSS, and the entire Three.js game. `sw.js` + `manifest.webmanifest` give offline PWA behaviour.
There is **no bundler and no build step for the game itself** — edit the file and reload. Around it sits a
zero-dependency Node toolchain (`package.json`, `npm test`, `npm run build`): a static audit, a headless-Chrome

[View full file](./Architecture.md)

## app flow.md
The screens, states and user journeys of the game. State is `G.state`; screens are driven by
`UI.show(id)` and the offset camera (`setViewShift`). Code references are in `index.html`.
```

[View full file](./app%20flow.md)

## backend scema.md
**The game has no backend for gameplay.** It is a single client-side HTML file: it makes no network
calls to play, has no accounts, no server and no API, and every system except one is purely
on-device. This document therefore describes the **real persistence layer** — the on-device schema

[View full file](./backend%20scema.md)

## UI-UX Design Brief.md
The interface contract: what the player sees, where it sits, how it responds, and the rules that
keep it readable at speed on a phone. This is the *build* brief — `Design.md` holds the art
direction and brand language; `app flow.md` holds the screen/state machine.

[View full file](./UI-UX%20Design%20Brief.md)

## Design.md
Design spec: art direction, UI/UX, HUD, audio and brand guidelines. Aimed at whoever extends the game next.
> The **interface build contract** (HUD zones, controls, screens, accessibility, states) lives in
> **`UI-UX Design Brief.md`**; this file holds the art direction and brand language it builds on.

[View full file](./Design.md)

## open graph tags.md
This file documents the social/SEO metadata the game actually ships in `index.html` (`<head>`),
plus the crawl files and JSON-LD schema. It is the reference for "what does a link preview show
when someone shares the game?".

[View full file](./open%20graph%20tags.md)

## Phases.md
Roadmap. Describes the build order the project has followed and where it is now. Task.md holds the live queue; this file sketches the arc.
- Single-file boot: `index.html`, Three.js r128 vendored, canvas + resize loop.
- Utils + config layer (`LANES`, `LEVELS`, `UPG`, `PAINTS`, `OUTFITS`, `BIKES`, `JOBT`).

[View full file](./Phases.md)

## Task.md
Working task tracker. Check off as work is done. Keep this honest and current — Phases.md is the roadmap, Task.md is the queue.
- `[x]` done
- `[ ]` open

[View full file](./Task.md)

## Implementation Plan.md
The forward plan: what to build next, in what order, and how we'll know it is done. `Phases.md` is
the historical arc; this is the actionable list. Live granular tasks live in `Task.md`.
Working rules for every item below: single file (no build step), `npm test` green (static audit +

[View full file](./Implementation%20Plan.md)

## Rules.md
Development guardrails. Read before editing. These keep the project single-file, legal, fast and coherent.
1. **One file, no build step.** All game code lives in `index.html`. `package.json` exists but is **zero-dependency** (only `npm test`/`build` scripts — nothing to install), and there is no bundler or preprocessor. If you think you need one — you don't.
2. **No external assets.** Every model, texture, sound, font and icon is generated from code or beyond-reproducibility original bundlables (`music/bike-riders-theme.wav`). Never commit a downloaded sprite, texture, sample or font file — only original or vendored-with-license files.

[View full file](./Rules.md)

## security.md
Security & privacy posture for this project. The short version: **everything stays on the player's device. Gameplay makes no network calls at all; the only outbound request in the whole game is an opt-in, player-triggered global leaderboard.**
- Web game served over HTTPS, played in a browser (mobile + desktop).
- Biggest realistic risks: **save tampering/corruption**, **malicious third-party content injection via fonts/CDN**, and **social-engineering phishing of save data**. Not a high-value target — but let's keep it clean.

[View full file](./security.md)

## licence.md
This file summarises the licensing posture of every component of the project. Full credits and per-file attributions: **`CREDITS.txt`**.
> **Name history (2026-10-21).** The app was submitted to AppGallery as **"Bike Rider"**; review
> rejected it under rule 9.5 as similar to the existing game *Bike Rider* and asked for authorization

[View full file](./licence.md)

## Memory.md
Project memory. Facts, decisions, traps and conventions that must survive context loss. Update whenever you learn something new or change something structural.
A single-file Three.js (r128) web game: ride a motorcycle through a fictionalised **Bahrain**, take food/parcel/pharmacy
and passenger jobs in shifts, earn **BHD**, upgrade. All assets are generated procedurally from code. Ships as an

[View full file](./Memory.md)

## redesign.md
**Design proposal for review only.** No game code, assets, balance, or save data have been changed. Review and
approve the visual direction before implementation.
Give the player bike, rider, and helmet a coherent, memorable identity that feels at home in Bike Rider:

[View full file](./redesign.md)

## PUBLISH.md
Everything needed to list, publish and advertise the game. Facts in this file match the shipped
build (`dist/bike-rider-1.0.1.apk` / `.web.zip`) and were verified against `index.html` and the
regression suite. Developer: **AL ASAR JADEED — https://alasarjadeed.com**.

[View full file](./PUBLISH.md)

## llms.txt
> BIKE RIDER is a free, offline-capable 3D delivery-riding game built as a single HTML file
> (Three.js r128 + Web Audio) and shipped both as an installable PWA and a signed Android APK.
> You ride a motorcycle through a fictionalised Gulf city, carry passengers, food, parcels and

[View full file](./llms.txt)

