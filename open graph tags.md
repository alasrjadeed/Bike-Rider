# BIKE RIDER — Open Graph & SEO tags

This file documents the social/SEO metadata the game actually ships in `index.html` (`<head>`),
plus the crawl files and JSON-LD schema. It is the reference for "what does a link preview show
when someone shares the game?".

Everything resolves to **one hosting root: `https://alasarjadeed.com/`**. Canonical, Open Graph,
Twitter, `robots.txt` and `sitemap.xml` all point there, so search results and share previews
converge on a single owner instead of scattering across hosts.

> **Naming note (2026-10-21).** The product was submitted as **"Bike Rider"** and AppGallery rejected
> that name under rule 9.5 as too similar to the existing game *Bike Rider*. It was relabelled
> **BAHRAIN RIDERS** in v1.0.4, then **renamed back to BIKE RIDER in v1.0.5 at the owner's request**.
> Every tag below reads **BIKE RIDER**, and `index.html` (head), `manifest.webmanifest`, `package.json`,
> `licence.md` and `CREDITS.txt` were updated together in the same change.
> One **in-game fictional courier company** is also called "Bike Rider" (player-editable); after v1.0.5
> that is the same string as the product name — see `Rules.md` rule 3.

## Where it lives

- Tags: `index.html`, `<head>` (open the "SEO head" section — see `Architecture.md` → *SEO &
  discoverability*).
- Crawl files: `robots.txt` and `sitemap.xml` at the root; both are mirrored by
  `tools/sync-public.mjs` into `public/` and therefore into the web zip and the APK.
- `tools/audit.mjs` skips `application/ld+json` blocks (the schema is a JSON literal, not
  executable script).

## Basic meta

```html
<title>Bike Rider — Free 3D Delivery Motorbike Game | Bahrain · Riyadh · Dubai</title>
<meta name="description" content="Bike Rider — a free 3D delivery motorbike game. Take fares across Bahrain, Riyadh (Saudi Arabia) and Dubai (UAE), deliver food, parcels and fuel, upgrade your bike. Plays fully offline — PWA and Android app, in English, Arabic and more.">
<meta name="keywords" content="bike rider, motorbike game, delivery game, 3d game, bahrain game, saudi arabia game, uae game, riyadh, dubai, offline game, pwa game, android game, free game, لعبة توصيل, لعبة دراجة نارية">
<meta name="author" content="AL ASAR JADEED">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="https://alasarjadeed.com/">
```

## Open Graph

```html
<meta property="og:type" content="website">
<meta property="og:site_name" content="Bike Rider">
<meta property="og:title" content="Bike Rider — Free 3D Delivery Motorbike Game (Bahrain · Riyadh · Dubai)">
<meta property="og:description" content="Ride and deliver across Bahrain, Riyadh and Dubai in a free offline 3D motorbike game. Earn fares, upgrade your ride, play in English or العربية.">
<meta property="og:url" content="https://alasarjadeed.com/">
<meta property="og:image" content="https://alasarjadeed.com/icons/icon-512.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:image:alt" content="Bike Rider — a night-ride delivery motorbike game">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="ar_AR">
```

## Twitter / X card

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Bike Rider — Free 3D Delivery Motorbike Game (Bahrain · Riyadh · Dubai)">
<meta name="twitter:description" content="Ride and deliver across Bahrain, Riyadh and Dubai in a free offline 3D motorbike game. Earn fares, upgrade your ride, play in English or العربية.">
<meta name="twitter:image" content="https://alasarjadeed.com/icons/icon-512.png">
```

`twitter:card` is `summary_large_image` but the image is a square 512×512 icon, so some clients
render it letterboxed rather than as a wide banner. A dedicated 1200×630 `og-image` would improve
large-card previews — see "Improvements worth making".

## JSON-LD structured data

```json
{
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "name": "Bike Rider",
  "alternateName": "Bike Rider — 3D Delivery Game",
  "url": "https://alasarjadeed.com/",
  "image": "https://alasarjadeed.com/icons/icon-512.png",
  "description": "Bike Rider — a free 3D delivery motorbike game. …",
  "applicationCategory": "GameApplication",
  "operatingSystem": "Any modern web browser and Android 6.0+",
  "genre": ["Racing", "Simulation", "Arcade"],
  "inLanguage": ["en", "ar", "fil", "hi", "th", "pa"],
  "author":     { "@type": "Organization", "name": "AL ASAR JADEED", "url": "https://alasarjadeed.com" },
  "publisher":  { "@type": "Organization", "name": "AL ASAR JADEED", "url": "https://alasarjadeed.com" }
}
```

(The block above is abridged for readability — the shipped block is the source of truth.)

## Mobile / browser chrome

```html
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#050608">
<meta name="msapplication-TileColor" content="#050608">
<meta name="msapplication-TileImage" content="icons/icon-180.png">
<meta name="msapplication-config" content="browserconfig.xml">
<link rel="manifest" href="manifest.webmanifest">
```

`applyTheme()` rewrites `meta theme-color` live when the player switches country chapter.

## Icons referenced by the head

```html
<link rel="icon" href="icons/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="icons/favicon.svg">
<link rel="icon" type="image/png" sizes="16x16" href="icons/favicon-16.png">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="48x48" href="icons/favicon-48.png">
<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
```

Root `icons/` is the **source of truth**; `public/icons/` is only a mirror (see `Rules.md`).
`tools/audit.mjs` fails the build on drift between the two trees.

## Crawl files

`robots.txt`:

```
# Bike Rider — crawl rules
User-agent: *
Allow: /

Sitemap: https://alasarjadeed.com/sitemap.xml
```

`sitemap.xml` — a single `<url>` for the root (`changefreq weekly`, `priority 1.0`) with a
`lastmod` date. Bump `lastmod` when the game is redeployed.

## PWA identity (`manifest.webmanifest`)

`name` / `short_name` = **Bike Rider**, `lang` = `en`, `display` = `standalone`, `orientation` =
`landscape`, `theme_color` / `background_color` = `#050608`, id/scope/start_url `./`. The
`description` names AL ASAR JADEED as the maker.

## Rules (keep these true)

1. **Change the host in four places at once** — the `<head>` URLs, `robots.txt`, `sitemap.xml` and
   `manifest.webmanifest` scope. `Rules.md` makes this a process rule.
2. **`llms.txt` is the agent-facing summary** of the project (see `llms.txt`). If the public name or
   the hosting root changes, update it too.
3. **Any new social image must be an absolute URL** under the hosting root — relative `og:image`
   URLs are not resolved by most crawlers.
4. **`og:image` should stay ≥ 512×512** and live in `icons/` so it is mirrored by `sync:public`.
5. The JSON-LD block is skipped by the static audit but must remain valid JSON — a syntax error
   silently drops all structured data.

## Validating a change

- View source in the browser; confirm the tags and that the JSON-LD parses (paste into a JSON
  validator).
- Facebook Sharing Debugger, LinkedIn Post Inspector and the X/Twitter Card Validator read the
  live URL (they fetch from the hosting root, not localhost).
- Google Rich Results Test for the `VideoGame` schema; Google Search Console → URL Inspection for
  canonical/indexing.
- Remember the service worker is **network-first**, so a re-deployed `index.html` is picked up
  immediately online; bump `VERSION` in `sw.js` on release so offline clients evict old caches.

## Improvements worth making (not yet shipped)

- A dedicated **1200×630 `og-image`** for proper large-card previews (currently a square icon).
- `og:image` for each country chapter (Bahrain / Riyadh / Dubai) if share-targeted pages are ever added.
- `<link rel="alternate" hreflang="ar">` / locale landing pages if Arabic SEO becomes a goal.
- An `Organization` JSON-LD node once the AL ASAR JADEED site itself has one to reference.
