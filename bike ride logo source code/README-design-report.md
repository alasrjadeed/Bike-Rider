# Bahrain Rider — Logo Design Report & Source Blueprint

## 1. Executive summary
The supplied artwork is a bold motorsport / motorcycle-community logo. Its strongest visual cues are a two-line italic wordmark, red and white lettering, layered black/white/gold outlines, angular speed shapes, and a motorcycle tire on the right. The look is energetic, competitive, and suited to a riders' club, motorcycle app, events, apparel, and social media.

## 2. Source-file facts
- Original file: `Bahrain Riders App .png`
- Image dimensions: **610 × 409 pixels**
- Format / color mode: **PNG / RGBA**
- Background: **transparent** (corner pixel alpha is 0)
- Non-transparent artwork bounds: **(19, 81, 596, 387)** (left, top, right, bottom; Python bounding-box convention)
- Aspect ratio: **1.491:1**
- SVG source: `bahrain-riders-logo.svg` (an SVG wrapper containing the original PNG, so it preserves the artwork exactly but is not a fully editable vector trace).

## 3. Typography blueprint
- Visual category: **heavy, bold, condensed/extended motorsport display lettering**, strongly italic/oblique, custom-styled.
- Letter treatment: large uppercase “BAHRAIN” and “RIDER” forms, tight spacing, aggressive forward slant, thick multi-layer outlines and dimensional shadowing.
- **Exact font cannot be reliably identified from a flattened image.** The letterforms may be custom-drawn or heavily modified. Do not claim a specific font as confirmed.
- For a rebuild, compare bold italic display families such as **Teko ExtraBold Italic**, **Roboto Condensed Black Italic**, or **Bebas Neue Pro Italic** as starting points only; the artwork would still need manual shaping and outlining to match.

## 4. Color system
The palette below is an **approximation sampled from the raster artwork**, not an official source palette. Anti-aliasing, gradients, highlights and shadows create many nearby colors.

- **#000000** — RGB (0, 0, 0) (sampled dominant tone; inspect the original for its exact role)\n- **#F0F0F0** — RGB (240, 240, 240) (sampled dominant tone; inspect the original for its exact role)\n- **#C00000** — RGB (192, 0, 0) (sampled dominant tone; inspect the original for its exact role)\n- **#D00000** — RGB (208, 0, 0) (sampled dominant tone; inspect the original for its exact role)\n- **#A00000** — RGB (160, 0, 0) (sampled dominant tone; inspect the original for its exact role)\n- **#B00000** — RGB (176, 0, 0) (sampled dominant tone; inspect the original for its exact role)\n- **#E0E0E0** — RGB (224, 224, 224) (sampled dominant tone; inspect the original for its exact role)\n- **#202020** — RGB (32, 32, 32) (sampled dominant tone; inspect the original for its exact role)\n- **#900000** — RGB (144, 0, 0) (sampled dominant tone; inspect the original for its exact role)\n- **#101010** — RGB (16, 16, 16) (sampled dominant tone; inspect the original for its exact role)\n
Recommended semantic palette:
- Racing red: primary wordmark fill.
- White / silver: secondary lettering and highlights.
- Black / charcoal: depth, shadows, tire and contrast.
- Gold / warm yellow: thin premium accent outlines and rim details.
- Transparent: preferred logo background where supported.

## 5. Composition & effects
1. Main wordmark is arranged on two rising/forward-leaning lines.
2. Red and white letter fills create contrast between the two lines.
3. Multiple dark, light and gold contour layers separate the letters from the background.
4. Angular streaks / chevrons extend behind the text to suggest speed.
5. A detailed motorcycle wheel/tire anchors the right edge and communicates the riding theme.
6. Transparent canvas lets the logo sit on different backgrounds; dark backgrounds may provide the strongest contrast.

## 6. Recommended usage
- Keep the full logo's original proportions; avoid stretching or skewing the entire image.
- Use the original transparent PNG for general placement. It is only {im.width} pixels wide, so test sharpness before large print or high-density displays.
- For small app icons, make a separately simplified icon (for example, a wheel/initial mark); the full wordmark will become hard to read at favicon size.
- Keep clear space around the outermost gold/black edges. A practical starting rule is 5% of logo width on every side.
- Do not place a dark outline on a similarly dark background without checking contrast.
- For print, vehicle decals, embroidery, and large-format production, request or create a true vector master (outlined paths), not merely an SVG containing a PNG.

## 7. Deliverables in this package
- `bahrain-riders-original.png` — unchanged original artwork.
- `bahrain-riders-logo.svg` — SVG wrapper with embedded original PNG; visually faithful and self-contained, but raster artwork inside.
- `brand-palette.json` — machine-readable sampled palette.
- `logo-source.html` — simple HTML preview that loads the PNG.
- `README-design-report.md` — this report and design blueprint.

## 8. Important limitation / next step for a true vector master
The supplied image is a flattened raster image, so the exact original font, editable letter paths, layer structure, and wheel construction are not recoverable with certainty from this file alone. A professional vector recreation would manually trace/redraw the lettering, outlines, speed shapes, and tire in Illustrator, Inkscape, or a similar vector editor. Keep this SVG wrapper as a faithful source container, but do not label it “fully vectorized”.
