# BIKE RIDER — Licence

This file summarises the licensing posture of every component of the project. Full credits and per-file attributions: **`CREDITS.txt`**.

> **Name history (2026-10-21).** The app was submitted to AppGallery as **"Bike Rider"**; review
> rejected it under rule 9.5 as similar to the existing game *Bike Rider* and asked for authorization
> documents or a name change. It was relabelled **BAHRAIN RIDERS** in v1.0.4 to clear that, then
> **renamed back to BIKE RIDER in v1.0.5 at the owner's request** — so the shipped name is once again
> the name that was rejected, and a second 9.5 rejection is a known risk. Everything ships as
> **BIKE RIDER** (package `com.bikerider.game`). The *in-game*
> courier company named "Bike Rider" (player-editable, in the fictional-brands table below) is
> deliberately unchanged — it is invented fiction, and after v1.0.5 it shares the product's name.
> `package.json` still declares `"license": "MIT"` while project work is dedicated **CC0**; aligning
> that field is tracked in `Implementation Plan.md`.

## Quick summary

| Component | Licence | Notes |
|---|---|---|
| Game code, 3D models (code-generated), textures, SFX, logo, icons | **CC0 1.0 Universal** | Original work created for this project — dedicated to the public domain |
| Music — `music/bike-riders-theme.wav` | CC0 1.0 Universal | Original composition synthesised from code; no samples |
| Three.js r128 — `vendor/three.r128.min.js` | MIT | © 2010–2021 three.js authors — `vendor/THREE-LICENSE.txt` |
| Fonts — Baloo 2, Noto Naskh Arabic, Noto Sans Thai/Devanagari/Gurmukhi | SIL Open Font License 1.1 | Loaded from Google Fonts when online; system-font fallback offline |
| All in-game brands (Bike Rider, KhanaJet, DakBox, SehatPlus, Sitara Motors, Zoom Fuel) | Fictional | Not real trademarks; fictionalised settings |

**Developed by AL ASAR JADEED — https://alasarjadeed.com**

## The game itself

**BIKE RIDER** — game code, all procedurally generated 3D, canvas textures, sound effects, logos and icons are **original work created for this project** and are released under the

## CC0 1.0 Universal (public domain dedication)

<https://creativecommons.org/publicdomain/zero/1.0/>

```
To the extent possible under law, the author(s) have waived all copyright and
related or neighbouring rights to BIKE RIDER. This work is published from
Bahrain under the CC0 1.0 Universal public domain dedication.

You can copy, modify, distribute and perform the work, even for commercial
purposes, all without asking permission and without any requirement to provide
credit.

Full legal code:  https://creativecommons.org/publicdomain/zero/1.0/legalcode
Human-readable summary: https://creativecommons.org/publicdomain/zero/1.0/
```

CC0 is a dedication, not a licence: no conditions, no attribution required (credit is still appreciated and given in `CREDITS.txt`). Third-party components keep their own terms — see the dependency section below.

## Dependency licences (must stay accurate)

- **Three.js r128** — MIT License, copyright © 2010–2021 three.js authors. The full MIT text ships in `vendor/THREE-LICENSE.txt`. In short: use, copy, modify, distribute freely; liability disclaimed; attribution notice retained.
- **Fonts** — SIL Open Font License 1.1. Baloo 2 and the Noto family (Google). OFL allows free use, redistribution and embedding; modified versions must be renamed. The project only *loads* the fonts — it does not redistribute font files in the repo.
- **Music** — CC0 1.0 Universal (public domain dedication), per `CREDITS.txt`.

## Rules going forward (see also `Rules.md`)

1. Any added asset must carry reproducible provenance and a licence compatible with the project (preferred: CC0 / MIT / OFL).
2. `CREDITS.txt` is the single source of truth for per-file attribution; keep it accurate when assets are added.
3. Never bundle a file without its licence text next to it (that's why `vendor/THREE-LICENSE.txt` exists).
4. All in-game brands are fictional; do not submit trademark claims.

## Full credits

See `CREDITS.txt` — game code/models/textures/SFX/logo/icons, the music composition, Three.js, fonts, and the fictional-brands disclaimer.
