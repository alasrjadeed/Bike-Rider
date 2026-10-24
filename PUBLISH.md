# BIKE RIDER — Publishing & Advertising Kit

Everything needed to list, publish and advertise the game. Facts in this file match the shipped
build (`dist/bike-rider-1.0.6.apk` / `.web.zip`) and were verified against `index.html` and the
regression suite. Developer: **AL ASAR JADEED — https://alasarjadeed.com**.

> **AppGallery submission path:** `APPGALLERY-RUNBOOK.md` — the new-project runbook (create the
> app, signing mode, build, upload, submit).

---

## 1. Product overview (use this anywhere you need one paragraph)

> **Bike Rider** is a free, offline 3D delivery-motorbike game. You thread a motorbike through Gulf
> traffic, take passenger, food, parcel and medicine jobs, and upgrade your ride — across **three
> swappable countries in one game**: Bahrain (the home city, 48 districts and 48 landmarks), Saudi
> Arabia's **Riyadh** and the UAE's **Dubai**. Nine-minute shifts, ten job types, a 13-bike showroom,
> helmets, rider skills, night/rain/smog weather, and full Arabic + English support. No ads, no in-app
> purchases, no accounts, no internet required after first load — it runs as a browser PWA or a tiny
> Android app (built from a single HTML file, ~1.5 MB).

---

## 2. Fact sheet (grounded in the build)

| Item | Value |
|---|---|
| Game name | **Bike Rider** (AppGallery listing: BIKE RIDER) |
| Tagline | **DELIVER BAHRAIN • EARN • UPGRADE** |
| Genre | Racing / Arcade traffic sim (delivery) |
| Platforms | Web PWA (any modern browser, installable) + Android APK (minSdk 24 / Android 6.0+, target 34) |
| Chapters | 🇧🇭 **Bahrain** (home) · 🇸🇦 **Saudi — Riyadh** · 🇦🇪 **UAE — Dubai** (single-city, swappable on the start screen) |
| World | 48 Bahrain districts / 48 landmarks; 20 Riyadh districts; 20 Dubai districts; 30 landmark building styles |
| Gameplay | 9-minute shifts, 10 job types (passenger/food/parcel/medicine/fragile/urgent/rush/VIP/multi/long), 5 rider levels, 6 skills × 3 ranks, 4 level perks |
| Garage | 13-model GAUSS AUTO showroom, 10 upgrade parts, 8 paints, 6 outfits, 4 helmet tiers, company livery |
| Languages | English, Arabic (العربية), Gulf Arabic (ar-bh), Filipino, Hindi, Thai, Punjabi |
| Currencies | Display-only BHD / SR / AED (economy numbers shared — no pay-to-win) |
| Connectivity | Fully offline-capable (service-worker cache); no ads, no IAP, no accounts, no telemetry |
| Build size | APK ≈ 1.5 MB; web page ≈ 1.2 MB (single file, procedural assets) |
| Version | 1.0.6 (versionCode 6) — AppGallery package `com.bikerider.game` |
| Developer | AL ASAR JADEED — https://alasarjadeed.com |
| Licensing | Free; original code/art/audio dedicated to the public domain (CC0) — see `licence.md` |

Content notes: real **famous landmark names** are used (Kingdom Centre, Burj Khalifa, Masmak Fortress,
Dubai Frame, At-Turaif…); all storefronts, malls and brands are fictional.

---

## 3. Unique selling points (pick 3–5 for any ad)

1. **Three countries in one free game** — Bahrain, Riyadh, Dubai on the same phone.
2. **Truly offline** — works on the metro / in the desert / on a plane; no ads, no in-app purchases, no account.
3. **Culturally specific, not generic** — Gulf traffic, Arabic + English signs, real-feeling neighbourhoods.
4. **Tiny and fast** — ~1.5 MB app built for 2019-era phones, instant load.
5. **Real progression** — 13-bike showroom, helmets, skills, company branding.

---

## 4. Screenshots & key art plan

Play Store shows up to **8 phone screenshots** (landscape 1920×1080 works — the game is landscape).

| # | Shot | What to capture |
|---|---|---|
| 1 | **Start screen** | Logo + tagline + country tabs (Bahrain red theme) |
| 2 | **Gameplay — Bahrain day** | Rider in traffic, HUD, nav arrow, BHD fare chip |
| 3 | **Night + rain** | Sodium lamps, wet road, headlight throw (weather sells atmosphere) |
| 4 | **Chapter swap — Riyadh** | Country tab switched, Saudi plate + green theme, desert escarpment landmark |
| 5 | **Chapter swap — Dubai** | Dubai theme, Burj-style sky bridge landmark, waterfront |
| 6 | **GAUSS AUTO showroom** | Turntable bike + price, helmet row |
| 7 | **Shift summary** | Earnings / rating / LANDMARKS n/48 readout |
| 8 | **Landmark toast** | Riding past a monument with the toast + Arabic/English name |

Capture on the real phone (`R5CT50HDLDK`) in landscape for authentic quality, or in headless Chrome
at 1920×1080 using the `?debug` seam. Also produce: **feature graphic** 1024×500, **icon** 512×512
(existing `icons/icon-512.png`), **hi-res icon** 512×512.

---

## 5. Store listing copy

### 5.1 Play Store

- **App name:** `Bike Rider — 3D Delivery Game` (30-char limit → `Bike Rider` is safest)
  > **AppGallery rule 9.5 — NOT cleared (2026-10-21).** The app was submitted as "Bike Rider" and
  > rejected as similar to the existing game *Bike Rider*. v1.0.4 relabelled it **BAHRAIN RIDERS** to
  > clear that; v1.0.5 renamed it **back to Bike Rider** by owner decision. The name is therefore
  > *again* the one that was rejected, and AppGallery may reject it a second time or demand
  > authorisation documents. Package `com.bikerider.game`.
- **Short description (80 chars):**
  ```
  Free offline 3D motorbike delivery game — Bahrain, Riyadh and Dubai. No ads. No IAP.
  ```
- **Full description (paste-ready):**

  ```
  Ride a delivery motorbike through real-feeling Gulf streets. Take passenger, food, parcel and
  medicine orders in 9-minute shifts, dodge traffic, bikes and hazards, and spend your earnings on a
  bigger ride.

  THREE COUNTRIES, ONE GAME
  • Bahrain — the home game: 48 districts, 48 landmarks (Qal'at al-Bahrain, the track at Seef…)
  • Saudi Arabia — Riyadh: Kingdom Centre, Masmak Fortress, Diriyah, Edge of the World
  • UAE — Dubai: Burj Khalifa, Dubai Frame, Museum of the Future, Atlantis, Marina
  Switch countries on the start screen — plates, bus liveries, currency, streets and landmarks all change.

  PROGRESSION THAT MATTERS
  • 13-bike GAUSS AUTO showroom, 10 performance parts, paints, outfits and 4 helmet tiers
  • 6 skills × 3 ranks and level perks (night vision, rain grip, lane filtering, smooth braking)
  • Your own company name, uniform colour and cargo branding

  THE GULF, DONE RIGHT
  • Arabic + English menus and signage; real landmarks, fictional shopfronts
  • Heavy traffic, wrong-way riders, police checkpoints, school zones, rush hour
  • Day/night cycle and rain and smog that change how you ride

  OFFLINE FIRST
  • No ads, no in-app purchases, no accounts, no data collection
  • Works fully offline once loaded — PWA on the web, tiny APK on Android (~1.5 MB)

  Languages: English, العربية, Filipino, Hindi, Thai, Punjabi.
  Built by AL ASAR JADEED — alasarjadeed.com
  ```

- **Category:** Games → **Racing** (alt: Arcade) — **Pricing/free**, no IAP.
- **Tags/keywords:** bike, motorbike, delivery, riding, offline, free, 3d, bahrain, saudi, riyadh, dubai, uae

### 5.2 Content rating & data safety (Play Console answers)

- **Content rating:** no user interaction except local save; cartoon crashes only → complete with
  "no violence / no mature content / simple cartoon level".
- **Data safety:** declare **"No data collected", "No data shared"**. True — the app has **no
  INTERNET permission** and everything lives in local storage on the device.
- **Privacy policy URL:** `https://alasarjadeed.com/privacy.html` (already live — the AL ASAR JADEED agency
  privacy policy that covers this game as a service of the site).

### 5.3 Web/PWA listing

- Host root: `https://alasarjadeed.com/` — canonical/OG/Twitter/sitemap/robots already point there.
- The `<head>` already ships title, description, keywords, JSON-LD `VideoGame` schema.
- Submit the sitemap in Google Search Console; label the page a game in webmaster tools.

### 5.4 AppGallery (Huawei) listing copy

Limits: app name ≤30 chars (non-Chinese default), **brief introduction ≤80** (Huawei's API schema
also documents 60 — the copy below is 60, so it passes either), **full introduction ≤8000**.
**No HTML and no markdown** — AppGallery renders the text literally, so `**bold**` shows up as
asterisks. Everything is indexed, so keywords live in the prose, not in a tag list.

**Brief introduction** (60 chars):

```
Offline 3D motorbike delivery game — Bahrain, Riyadh & Dubai
```

**Full introduction** (1434 chars):

```
A free 3D delivery motorbike game set in the Gulf. Take passenger, food, parcel, medicine and fuel orders in 9-minute shifts, dodge traffic, bikes and hazards, and spend your earnings on a bigger ride.

THREE COUNTRIES, ONE GAME
• Bahrain, the home game: 48 districts and 48 landmarks, from Qal'at al-Bahrain to the track at Seef.
• Saudi Arabia, Riyadh: Kingdom Centre, Masmak Fortress, Diriyah, the Edge of the World.
• UAE, Dubai: Burj Khalifa, Dubai Frame, Museum of the Future, Atlantis, the Marina.
Switch country on the start screen. Plates, bus liveries, currency, streets and landmarks all change.

PROGRESSION THAT MATTERS
• 13-bike GAUSS AUTO showroom, 10 performance parts, paints, outfits and 4 helmet tiers.
• 6 skills across 3 ranks, plus level perks: night vision, rain grip, lane filtering, smooth braking.
• Name your own company, pick a uniform colour and brand your cargo.

THE GULF, DONE RIGHT
• Arabic and English menus and signage, real landmarks, fictional shopfronts.
• Heavy traffic, wrong-way riders, police checkpoints, school zones, rush hour.
• A day/night cycle, plus rain and smog that change how you ride.

OFFLINE FIRST
• No ads, no in-app purchases, no accounts, no data collection, no internet permission.
• Plays fully offline once loaded, and also runs in your browser as an installable PWA.

Languages: English, العربية, Filipino, Hindi, Thai, Punjabi.
Built by AL ASAR JADEED - alasarjadeed.com
```

AppGallery extras the other stores do not have: **New features** (≤500 chars, per release),
**release notes**, an **age-rating questionnaire**, and **release countries/regions** picked
explicitly.

---

## 6. Advertising & social copy

### 6.1 Hooks (pick one per ad)

- "Free. Offline. Three countries."
- "Deliver Bahrain, Riyadh and Dubai — without a data connection."
- "No ads. No wifi. No problem."
- "The Gulf delivery game made for Gulf players."
- "Your motorbike. Your company. Your city — three of them."

### 6.2 Post variants

**Short (X/Twitter, Instagram caption):**
```
Offline delivery motorbike game — Bahrain, Riyadh, Dubai. No ads, no IAP, no wifi needed.
Free on Android + browser 🏍️ 🇧🇭🇸🇦🇦🇪  alasarjadeed.com
```

**Medium (Facebook/LinkedIn):**
```
Bike Rider is a free, fully-offline 3D delivery game where you ride for a living across Bahrain,
Riyadh and Dubai — 48 Bahrain districts, Kingdom Centre, Burj Khalifa, 13 upgradable bikes,
helmets, skills, night rain and heavy traffic. One tiny ~1.5 MB app, no ads, no purchases, no
accounts. Built by AL ASAR JADEED. Free: alasarjadeed.com
```

**Long (blog/landing):**
```
Bike Rider turns the commute into a game. You're a courier on a 70cc-class motorbike: thread lanes,
beat the clock, take the rough job for the big fare. Nine-minute shifts, ten job types, five rider
levels, a 13-bike showroom and a garage that only upgrades. It is the rare game that is culturally
specific — Arabic and English signage, gulf traffic, real famous landmarks — and technically
obsessive: one HTML file, procedural everything, offline-capable, ~1.5 MB. Play free, install the PWA,
or grab the Android APK. No ads. No in-app purchases. No account. No data collected.
```

### 6.3 Platforms & formats

| Platform | Format | Content |
|---|---|---|
| YouTube Shorts / TikTok / Instagram Reels | 9:16 vertical, 15–30 s | Fast gameplay cuts + country swap; text "Free · Offline · 3 countries" |
| YouTube | 16:9 feature trailer 60–90 s | Start screen → Bahrain day → night/rain → Riyadh → Dubai → showroom → "Deliver on alasarjadeed.com" |
| X / Facebook | Single image + hook | Screenshot #1–#5 with a 1-line hook + link |
| Google Ads (Search) | Text ads | Keywords below; headline "Free Offline Delivery Motorbike Game" |
| Google Ads (Display) | 300×250 / 728×90 | Screenshot + logo + CTA |

### 6.4 Ad keywords (Search campaigns)

`bike game` · `motorbike game` · `delivery game` · `package delivery game` · `bahrain game` ·
`saudi game` · `riyadh` · `dubai game` · `uae game` · `offline game` · `no wifi game` ·
`free android game` · `3d riding game`

### 6.5 Hashtags

`#BikeRider` · `#Bahrain` · `#Riyadh` · `#Dubai` · `#OfflineGame` · `#FreeGame` ·
`#MotorbikeGame` · `#DeliveryDriver` · `#PWA` · `#indiegames` · `#gulfgames`

---

## 7. Publishing checklist

**Preflight**
- [x] `npm test` → 50/50 regression groups, static audit clean
- [x] `npm run sync:public` → `public/` mirrors canonical files
- [x] `npm run build:aab` + `npm run build:apk` → `dist/` + `SHA256SUMS`

**AppGallery (Huawei) — new project, package `com.bikerider.game`**

Full step-by-step: **`APPGALLERY-RUNBOOK.md`**. Summary:

- [ ] AppGallery Connect → **My apps → the project *Bike Rider* → Add app**
- [ ] Package name: **`com.bikerider.game`** (exact, case-sensitive — it cannot be changed later)
- [ ] Download the new **`agconnect-services.json`** from **the app's own page** → save to
      `android/app/agconnect-services.json` (overwrite, never hand-edit). `npm run build:aab`
      refuses to build until it is there and its `app_id` is not a retired one — see `Rules.md`
- [ ] `npm run check:agc` → `OK package_name` + `OK app_id`
- [ ] `npm run build:aab` → `dist/BikeRider-1.0.6-com.bikerider.game.aab`
- [ ] App name field: **BIKE RIDER**; category Games → Racing
- [ ] Upload the 8 screenshots (§4) — keep `public/Screenshot/` out of the payload, the build excludes it
- [ ] **App signing → choose the mode BEFORE the first upload**, it locks afterwards.
      **Method 1 (Huawei generates the key) was enabled 2026-10-22** — the store signing
      certificate is `BC:82:CE:98:64:BF:0B:DC:83:B3:C8:70:DC:AD:7A:B3:27:A4:C4:FA:72:25:CF:EA:02:3F:B1:07:FB:C3:2B:D2`
      and the upload certificate is our own keystore, `EE:81:CD:F1…93:E5`. Method 2 (upload
      your own key so the store fingerprint matches the local one) remains the fallback and
      needs **the zip `pepk.jar` produces** — the earlier loose `certificate.pem` /
      `encryptedPrivateKey` files were the wrong shape, which is why all three ZIP layouts
      were rejected with AGC's generic "An unknown error occurred".
      Exact commands: `APPGALLERY-RUNBOOK.md` §5
- [ ] Download the **app signing certificate** from the App Signing page and back it up with
      the keystore — it is the store's public identity, and Huawei does not let you export
      the key behind it
- [ ] Paste the store fingerprint into **App information → "Add certificate fingerprint"** if
      any AGC/HMS service is ever enabled (it is optional for a plain store submission)
- [ ] Upload `dist/BikeRider-1.0.6-com.bikerider.game.aab` → Save → Submit for review
- [ ] Later versions: `npm run upload:agc -- --aab dist/<file>.aab --submit` (needs an API
      client from AGC → Users and permissions → API key → Connect API)
- [ ] **Back up off this machine** — `android/release.keystore` + `android/keystore.properties`
      (chmod 600) + `.agc.env`. The keystore is the app's permanent signing identity and it
      outlives any AGC project.
- [ ] Acknowledgement: the name was rejected under rule 9.5 previously; re-submitting as BIKE RIDER
      accepts that risk (documented in `Rules.md` rule 3)

**Play Console**
- [ ] Create app → choose name/listing (copy in §5.1)
- [ ] Upload 512×512 icon, 1024×500 feature graphic, 8 screenshots (§4)
- [ ] Category Games → Racing
- [ ] Content-rating questionnaire (no data, cartoon level)
- [ ] Data-safety form: no data collected / shared
- [ ] Privacy policy URL → `https://alasarjadeed.com/privacy.html` (already live)
- [ ] Upload `dist/bike-rider-1.0.6.apk` to Draft → internal test track → production
- [ ] Release notes (§8)

**Web/PWA**
- [ ] Deploy `public/` to `https://alasarjadeed.com/` over HTTPS
- [ ] Google Search Console: verify domain, submit `sitemap.xml`
- [ ] Confirm `robots.txt`, canonical, OG image resolve at the root

**Legal**
- [ ] `licence.md` / `CREDITS.txt` ship inside the app (already embedded in the APK + web zip)
- [ ] Confirm `https://alasarjadeed.com/privacy.html` resolves and link it from the store listing (already live)
- [ ] Keep the AL ASAR JADEED credit + backlink on the start screen (regression `start-screen-fit` pins it)

**Marketing**
- [ ] Capture the 8 screenshots (§4) and a 60–90 s trailer (§6.3)
- [ ] Publish social posts (§6.2) across X/Instagram/TikTok/Facebook
- [ ] Launch Google Ads Search campaign (§6.4)

---

## 8. Release notes — v1.0.1

```
1.0.6 — 21 Oct 2026
• New AppGallery project (the old one was deleted after the rule 9.5 rejection). Project ID
  101653523865399891, package identity unchanged: com.bikerider.game (versionCode 6).
• No gameplay changes — same game, same content. Version number and the release plumbing only.
• AppGallery submission is now a documented runbook: APPGALLERY-RUNBOOK.md. It covers creating
  the app, choosing the signing mode (it locks after the first upload), building the .aab and
  uploading it — by console for the first release, or by script (npm run upload:agc) after that.

1.0.5 — 21 Oct 2026
• Renamed back to Bike Rider. The app name, launcher label, store title, PWA manifest and page head
  all read Bike Rider again; v1.0.4 had briefly shipped as BAHRAIN RIDERS.
• No gameplay changes — same game, same content, version number only.
• Package identity unchanged: com.bikerider.game (versionCode 5).

1.0.4 — 21 Oct 2026
• Renamed to BAHRAIN RIDERS (AppGallery name policy — the old "Bike Rider" name was too close to
  another game). Same game, same artwork, one clear name.
• New package identity: com.bikerider.game
• Three countries, one game — Bahrain, Saudi Arabia (Riyadh) and the UAE (Dubai), swappable
  on the start screen with per-country plates, bus liveries, streets and currency.
• Riyadh and Dubai as single-city chapters: 20 real districts each (Kingdom Centre, Masmak
  Fortress, Diriyah / Burj Khalifa, Dubai Frame, Museum of the Future, Atlantis…).
• 12 new landmark styles (30 total) — desert escarpments, sky bridges, lattice domes, souq halls.
• GAUSS AUTO bike showroom (13 models), 4 helmet tiers, rider skills & perks.
• Start-screen layout fixed for small landscape phones (all controls reachable).
• "Made by AL ASAR JADEED" credit + full SEO (canonical, Open Graph, sitemap, robots).
• Fully offline: service-worker cache; no ads, no in-app purchases, no accounts.
```

---

## 9. FAQ (support / store help)

- **Does it need the internet?** No — after first load it runs fully offline. The APK never phones home (no INTERNET permission).
- **Is it really free?** Yes. No ads, no in-app purchases, no pay walls. Progress reset is instant and never gated.
- **Which languages?** English, Arabic, Gulf Arabic, Filipino, Hindi, Thai, Punjabi.
- **What devices?** Any modern browser (PWA), Android 6.0+, landscape orientation.
- **Is the content real?** Famous landmark names are real; shopfronts, malls and brands are fictional.
- **Who made it?** AL ASAR JADEED — https://alasarjadeed.com

---

## 10. Contact & credit

- Developer / publisher: **AL ASAR JADEED — https://alasarjadeed.com**
- Privacy policy: `https://alasarjadeed.com/privacy.html` (live AL ASAR JADEED policy)
- Licensing: `licence.md`, `CREDITS.txt` (included in every artifact)