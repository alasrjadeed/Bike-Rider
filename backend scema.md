# BIKE RIDER — Backend & data schema

**The game has no backend for gameplay.** It is a single client-side HTML file: it makes no network
calls to play, has no accounts, no server and no API, and every system except one is purely
on-device. This document therefore describes the **real persistence layer** — the on-device schema
in `localStorage` — because that is the "data model" anyone extending the game actually has to work
with.

There is exactly one exception, and it is opt-in and off the critical path: **WORLD RIDERS**, a
global leaderboard backed by Supabase (see *Supabase — the one backend*). It reads on demand, writes
only when the player presses **SUBMIT MY BEST**, and degrades to a cached board when offline. Nothing
about it is required to play.

> Filename note: this file is authored as requested (`backend scema.md`). The correct spelling is
> "schema"; the content below is the schema.

## Storage keys

| Key | Store | Owner | Wiped by RESET |
|---|---|---|---|
| `bahrain_rider_save_v1` | Player save + settings | Player | Yes |
| `bahrain_riders_owner_v1` | Studio/owner config, passcode, ledger | Owner (AL ASAR JADEED) | **No** — separate key |

- `const SAVE_KEY = 'bahrain_rider_save_v1'` and `const OWNER_KEY = 'bahrain_riders_owner_v1'`
  (both in `index.html`).
- The studio store is deliberately a **different key** so `resetProgress()` can never erase studio
  config, the passcode or the revenue ledger.
- A few non-save caches also live in `localStorage`: `br_board_cache_v1` (last good WORLD RIDERS
  board, so it still renders offline) and the locally-imported music library in IndexedDB (not
  `localStorage`). No cookies, and no Cache-API state beyond the service-worker response cache in
  `sw.js`.

## Player save — schema `v: 1`

Written by `defaultSave()` → `persist()` (JSON string), read by `loadSave()` → `deepMerge()`.
`defaultSave()` is the **source of truth for shape**:

```js
{
  v: 1,                       // schema version — refuse anything > 1 on import
  chapter: 'bh',              // active country: 'bh' | 'sa' | 'ae' (default 'bh')
  cash: 10,                   // current balance (display currency per chapter)
  sp: 0,                      // unspent skill points
  skills: {},                 // trained skill ranks: { skillId: rank }
  xp: 0,                      // experience → level via levelOf()
  rating: 4.5,                // rider star rating
  totalEarnings: 0, bestShift: 0,
  jobs: 0, shifts: 0, distance: 0,
  debt: 0,
  upgrades: { engine:0, brakes:0, tyres:0, suspension:0, tank:0,
              headlight:0, horn:0, cargo:0, mirrors:0, helmet:0 },
  cos:   { paint:'red', outfit:'white', helmet:null, helmetTier:null },   // equipped cosmetics
  owned: { paint:['red'], outfit:['white'], bike:['b125'], helmet:[] },
  bike: 'b125',               // equipped bike id (legacy id, see migrateBikes())
  company: { name:'Bike Rider', logo:null, color:'#ce1126',
             showOnBox:true, showOnBack:true, uniform:true, decals:true },
  rider: { name: '' },
  cond: { fuel:100, engine:100, tyres:100, damage:0 },
  settings: { sound:true, music:true, sfx:true, customMusic:true,
              quality:'auto', shake:'normal', uiScale:'standard',
              time:'dynamic', weather:'random', lang:'en', difficulty:'medium',
              minHud:false, hudMode:'auto', board:true,   // board = player opt-in to WORLD RIDERS
              ads:{ provider:'youtube', admobApp:'', admobUnit:'',
                    ytVideo:'yu9rldyKpIw', reward:1, premium:false } },
  credits: 0, adLastClaim: 0,
  deviceId: '',              // uuid, generated once — the WORLD RIDERS row key (not an account)
  tutorialDone: false,
  stats: { violations:0, perfect:0, failed:0, fuelBought:0 },
  seen: {}                    // toast/seen flags, e.g. seen['lm:<districtId>']
}
```

Field notes:

- **`settings.ads`, `credits`, `adLastClaim` are legacy-studio keys that stay schema-stable but do
  not travel.** Ads are removed (free play); the keys remain so old saves keep parsing. `saveImport()`
  restores them from the live save, so a shared player save can never carry or forge them.
- **`seen`** keys look like `lm:<districtId>`; at boot the game counts them into a **derived**
  `SAVE.lmCount` (`SAVE.lmCount = Object.keys(SAVE.seen).filter(k => k.startsWith('lm:')).length`).
  `lmCount` is not authored in `defaultSave()` — it is recomputed, never trusted from disk.
- **`bike` / `owned.bike` use legacy ids** (`b125`, `b150`, `b250`, `b400`). `migrateBikes()` rewrites
  them to current `BIKES` ids (`h150b`…) on load, so an old save always resolves to a valid ride.
- **`chapter`** is forward/backward safe: unknown ids fall back to `bh`.

## Migrations (forward-only)

The rule: **old saves must always load.** Add fields to `defaultSave()`; never repurpose an existing
field's meaning in place. Two migration hooks exist:

- **`deepMerge(base, o)`** — recursive merge of the loaded save over `defaultSave()`. Unknown keys
  are dropped, missing keys are defaulted, and non-object/array type mismatches are ignored, so a
  corrupted or hand-edited string parses to defaults instead of crashing the game.
- **`migrateSettings()`** — runs from `loadSave()`; the place for **value-type/shape changes**. It
  currently: maps the legacy boolean camera-shake to the tri-state `'normal' | 'reduced' | 'false'`;
  defaults `uiScale`; coerces any non-`'full'` `hudMode` to `'auto'`; and normalises the legacy
  `settings.ads` block.
- **`migrateBikes()`** — separate pass that maps retired bike ids and prunes `owned.bike`.

A **new major schema** means bumping `v` (to `2`) and writing an explicit migration. `saveImport()`
already refuses anything without a truthy `v` and anything with `v > 1`.

## Export / import (portability)

- Settings → **Export / Import** round-trips the save through a textarea, because `prompt()` is
  unsupported in several Android WebViews and `navigator.clipboard` is unavailable on non-secure
  origins.
- `UI.saveImport(str)` refuses anything that is not an object with a truthy `v`, and refuses `v > 1`.
  After a successful import it **restores `settings.ads`, `credits` and `adLastClaim` from the live
  save** — studio-owned fields never travel in a player save.
- `resetProgress()` wipes `bahrain_rider_save_v1` (behind a confirm modal) but touches nothing else.

## Studio store — `bahrain_riders_owner_v1`

Loaded by `loadOwner()` / written by `saveOwner()`; defaults from `OWNER_DEF`:

```js
{
  pass: '1234',               // admin passcode (changeable; default hint hides once changed)
  ads: { provider:'youtube', admobApp:'', admobUnit:'', ytVideo:'yu9rldyKpIw' },
  reward: 1, premiumPrice: 10, length: 15, skipAfter: 5, waitMin: 5,
  enabled: true,              // global kill switch
  sb: {                       // Supabase leaderboard — publishable key is client-safe
    url: 'https://<ref>.supabase.co',
    key: 'sb_publishable_…',  // NEVER a service_role / sb_secret key here
    enabled: false            // master switch: false = the game never calls out
  },
  stats: { forced:0, rewardShown:0, rewardDone:0, credits:0, premium:0,
           earned:0, lastSync:0, sbPosts:0 }   // revenue ledger
}
```

- Reached via the hidden `#screenAdmin` (5 taps on the start-screen logo inside 0.9 s, or `?admin` /
  `?admin=CODE`); passcode-gated.
- **`adCfg()`** merges the player save's ad block *under* the studio block, so studio config always wins.
- **`fetchRemoteConfig()`** is the only "backend-shaped" code in the project: `GET OWNER.cfgUrl` →
  `{ ads, reward, premiumPrice, length, skipAfter, waitMin, enabled }` merged into `OWNER`, with a 5 s
  timeout and a `lastSync` stamp. Empty URL = inert. It is a **stub** — no server ships with the game.
- Ads are disabled for players (free play); the owner store governs only the dormant, studio-only
  engine. See `Architecture.md` → *Studio (owner) administration*.

## Supabase — the one backend

**Project:** `Bike Rider` · ref `ckssgqvrpogjiobnsfsc` · `https://ckssgqvrpogjiobnsfsc.supabase.co`

> The Supabase **project** is still named "Bike Rider" — an external console name, left as-is so the CLI
> link in `supabase/.temp/linked-project.json` and the recorded ref stay valid. The *app* ships as
> **BIKE RIDER** (package `com.bikerider.game`) since the 2026-10-21 rename. The
> `company.name` default above is a different thing again: the **in-game fictional courier company**,
> which stays "Bike Rider" on purpose (see `Rules.md` rule 3).

Supabase backs the **WORLD RIDERS** board and nothing else. It is deliberately the smallest possible
surface:

- **No `@supabase/supabase-js`.** The client calls PostgREST over plain `fetch`. Vendoring a 100 kB
  library (or worse, a CDN `<script src>`) would break the "no remote script dependencies" rule the
  audit enforces, and the whole API here is two RPC calls.
- **The publishable (anon) key ships in the client.** That is what it is for: it is not a secret, and
  Row Level Security is the security boundary. A `service_role` or `sb_secret_…` key must **never** be
  pasted into the admin panel — it would hand every player full write access.
- **Opt-in twice.** `OWNER.sb.enabled` (studio master switch, admin panel) *and* `SAVE.settings.board`
  (player Settings → *Global board*). Either one off means no network call is attempted.
- **Offline-first.** Every call has a 7 s `AbortController` timeout, failures are swallowed, and the
  last good board is cached under `br_board_cache_v1`.

### Tables & functions

| Object | Kind | Access |
|---|---|---|
| `public.leaderboard` | table | `SELECT` for `anon`/`authenticated`; **no** write policy |
| `public.submit_score(...)` | `security definer` fn | the only write path; clamps every value |
| `public.top_board(limit)` | `security definer` fn | read the top N, already ranked |

`leaderboard` is keyed by a **unique `device_id`** (a UUID the client generates once into
`SAVE.deviceId`), so a re-submit replaces that rider's row instead of stacking. Score never decreases:
the upsert takes `greatest(old, new)`.

`submit_score()` trims and caps the name at 24 chars, clamps score/earnings to `1e8`, distance to
`1e9`, jobs to `1e5`, rating to `0–5`, and country to `bh|sa|ae` — because the client is untrusted by
definition.

> A determined attacker can still post a fake score. That is true of every client-authored
> leaderboard; the caps stop it being trivial or an unbounded write pump, which is the realistic bar.

### Schema fields

| Table `leaderboard` | Type | Notes |
|---|---|---|
| `id` | `uuid` | pk, `gen_random_uuid()` |
| `device_id` | `uuid` | **unique** — one row per install |
| `rider_name` | `text` | trimmed to 24 chars server-side |
| `score` | `bigint` | `SAVE.bestShift` — best single-shift earnings |
| `earnings` | `bigint` | `SAVE.totalEarnings` |
| `distance_m` | `bigint` | `SAVE.distance` |
| `jobs` | `integer` | `SAVE.jobs` |
| `rating` | `numeric(2,1)` | `SAVE.rating` |
| `country` | `text` | `bh` \| `sa` \| `ae` |
| `created_at` / `updated_at` | `timestamptz` | |

Migrations live in `supabase/migrations/`. Push with
`SUPABASE_ACCESS_TOKEN=… npx supabase db push` after `npx supabase link --project-ref ckssgqvrpogjiobnsfsc`.
Credentials live in a **gitignored** `.env` (never in `index.html` or a commit).

## Rules when touching the schema

1. **Add to `defaultSave()`; never rename or repurpose.** Old fields keep their meaning forever.
2. **Sensitive shape changes go in `migrateSettings()`** (or a new migration), not in readers — the
   runtime should never have to know a save's vintage.
3. **Never let a player save carry studio fields.** Keep the `saveImport()` restore list current.
4. **Never trust derived values from disk** (`lmCount`, levels, stats snapshots) — recompute them.
5. **Bump `v` only for a genuinely breaking change**, and ship the migration in the same commit.
6. Update this file and the *Save format* section of `Architecture.md` together.
