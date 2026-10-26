# APPGALLERY RUNBOOK — Bike Rider on Huawei AppGallery

The whole AppGallery path for **Bike Rider**, from the AGC console to a submitted release.
Updated **2026-10-22**, after the app record was created and the first bundle was built.

Everything here has been verified against this repo or against Huawei's live API on
2026-10-21/22. Where a step was never executed end-to-end, it says so.

---

## 0. Where things stand (2026-10-22)

| | |
|---|---|
| App name | `BIKE RIDER` — fixed at creation, cannot be changed later |
| Package name | `com.bikerider.game` — matches `applicationId`, `namespace`, `MainActivity.java` and both manifests |
| Project | **Bike Rider**, project id `101653523865399891`, developer id `2640973000000052931` |
| App record | **created 2026-10-22** — app id **`119458707`** |
| Version | 1.0.6 / versionCode 6 (`package.json` + `android/app/build.gradle` agree) |
| Launcher label | `BIKE RIDER` (`android/app/src/main/res/values/strings.xml`) |
| `agconnect-services.json` | **attached** at `android/app/agconnect-services.json` (app_id `119458707`) |
| Signing keystore | `android/release.keystore`, alias `release`, `CN=Bike Rider`, SHA-256 `EE:81:CD:F1:F3:68:63:BF:F8:3B:1A:A0:1C:EA:12:7F:EF:E1:36:F0:5D:4B:1D:F2:7D:EE:D4:68:03:E2:93:E5` — **keep it** |
| Upload certificate | the same key, exported to `agc-upload/upload_certificate.pem` and **accepted by AGC** on 2026-10-22 — this is the upload key, not the store key |
| **Store signing certificate** | **Huawei-generated (Method 1)**, SHA-256 `BC:82:CE:98:64:BF:0B:DC:83:B3:C8:70:DC:AD:7A:B3:27:A4:C4:FA:72:25:CF:EA:02:3F:B1:07:FB:C3:2B:D2` — **download the certificate from the console and back it up** |
| Gradle wrapper | pinned to **8.2.1** — 9.x breaks the Huawei AGCP plugin |
| Signing mode | **Method 1** (AppGallery Connect generates and owns the key) — decided before the first upload |
| Bundle | `dist/BikeRider-1.0.6-com.bikerider.game.aab` — 1584 KiB, sha256 `a63a3e5d…fc3b`, built and signed |
| Console upload | **not done yet** — the next action, §6 |
| Scripted upload | blocked: no Connect API client yet (§6, Route B) |

### The old project (deleted — do not reuse any of it)

| Field | Old value |
|---|---|
| Project ID | `101653523865359516` |
| Client ID | `2063637681325261376` |
| app_id | `119398303` |
| Package | `bikerider.huawei` → `com.bikerider.huawei` |
| Store fingerprint | `F9:52:C0:CF:E5:D6:0F:E7:A3:E1:7F:79:4D:69:B6:66:53:E8:0E:DE:E3:05:54:0F:4E:CA:57:15:37:D1:82:C3` |

`tools/agc-config.mjs` holds these retired ids in one place; the build guard and the
preflight both read them from there.

---

## 1. The credentials — two tiers, and they are not interchangeable

`.agc.env` (gitignored, `chmod 600`) holds both kinds. Mixing them up is the single
most expensive mistake in this flow: the wrong one is rejected by Huawei's token
endpoint with a message that does not name the cause.

### Tier 1 — project (identifies the project, **cannot upload**)

| Field | Value |
|---|---|
| Project name | Bike Rider |
| Project ID | `101653523865399891` |
| Developer ID | `2640973000000052931` |
| Project client id | `2066124875352799936` |
| Project client secret | `753E29F5…F6CED` |
| API key | `DgEDAOdX…dEdjow==` |
| Public key | 3072-bit RSA — the project API key's token-verification key (public) |

### Tier 2 — app + publish client (**this is what uploads**)

| Field | Value | Where it comes from |
|---|---|---|
| `AGC_APP_ID` | `119458707` | AGC console → My apps → **the app** → App information |
| `AGC_APP_OAUTH_CLIENT_ID` | `119458707` | same page, "OAuth 2.0 client" |
| `AGC_APP_OAUTH_CLIENT_SECRET` | `cf1269c4…d7a5` | same page — HMS auth only, **not** a publish credential |
| `AGC_CLIENT_ID` | *not set yet* | Users and permissions → API key → **Connect API → API client** → Create |
| `AGC_CLIENT_SECRET` | *not set yet* | same place |

The Connect API client must be created with **project "Bike Rider"** and a role that carries
the release/publish permission. Huawei's docs: *"the client ID and key are displayed"* — that
is the only credential pair the publishing token endpoint accepts. Until it exists, uploads go
through the console (§6 Route A) — that is all the first release needs.

> **Service accounts.** Huawei now recommends a **Service Account** over an API client
> (*"Service Accounts will replace API clients"*). It downloads a `private.json` (key_id +
> private_key) and authenticates with a JWT at `oauth-login.cloud.huawei.com/oauth2/v3/token`
> instead of a client id/secret. More moving parts than the current script handles; only worth
> it when scripted releases become routine.

### What each credential does when it hits the token endpoint

Probed live on 2026-10-22 against every regional host (`connect-api`, `-drru`, `-dre`, `-dra`).
The region made no difference to these answers — the errors are about credential *type*:

| Credential | Result at `POST /api/oauth2/v1/token` |
|---|---|
| Project client id + secret | `203886599 the type of clientId not match` |
| Project API key + secret | `203882498 [AppGalleryConnectApiPermissionService]invalid client id` |
| App OAuth 2.0 client id + secret | `203890688 client id or secret error` |
| **Connect API client id + secret** | **works** — this is the one to create |

> **Regional host.** Huawei's Connect API docs: *"the domain name depends on the data
> processing location of the application… the domain name must be the same as that of the
> called API."* This app's data-processing location is **Russia (default)**, so the publishing
> host is **`connect-api-drru.cloud.huawei.com`**, not the default China host.
> `tools/agc-config.mjs` reads the region out of `agconnect-services.json` and both the upload
> script and the preflight use it, so there is one source of truth for the host.

> **Security — the tier-1 credentials are public, rotate them.** The project client id/secret and
> API key were pasted into chat on 2026-10-21/22, and those transcripts (including a 71 MB copy of
> the session database) were committed to this public repo. They were purged from `main` on
> 2026-10-26, but GitHub still serves the old commits by SHA, so assume the pair is public:
>
> 1. AGC console → Project settings → **API key** → delete the exposed key, create a new one.
> 2. AGC console → **Users and permissions → API key → Connect API** → delete the exposed client,
>    create a new one. This is the only credential type that can upload.
> 3. Update `agconnect-services.json` and `android/app/agconnect-services.json`
>    (`client.client_secret`, `client.api_key`), and `.agc.env` (tier-1 key).
> 4. `npm run build`, then `cd android && ./gradlew bundleRelease`; run `npm run check:agc` and
>    re-verify the AAB signature before uploading.
>
> Until steps 1–2 are done, anyone reading the repo history can call the project API with that
> pair. The app's OAuth secret (2026-10-22) is HMS-only and cannot publish, but rotate it as well.
>
> `conversations/` (save points and the session database) is gitignored as of 2026-10-26 and must
> stay local — never commit a transcript.

---

## 2. Decision gate A — the app name (already decided)

The app's store name is fixed at creation and is what AppGallery reviews. **BIKE RIDER** was
rejected under rule 9.5 for being too close to an existing game named *Bike Rider*. Re-using
the name accepts a second rejection — that risk is on the record in `Rules.md` rule 3 and in
`Task.md`, and it was the owner's decision.

The **project** name ("Bike Rider") is just a container and is never reviewed; the **app**
name is. It is already `BIKE RIDER` in the console and in
`android/app/src/main/res/values/strings.xml` — they match, so do not change one without
the other.

---

## 3. Step 1 — create the app (DONE 2026-10-22)

AGC console → **My apps** → the project **Bike Rider** → **Add app**.

| Field | Value |
|---|---|
| Platform | Android |
| App name | `BIKE RIDER` |
| Package name | `com.bikerider.game` |
| Category | Game → Racing |
| Default language | English |

**Acceptance test — the numbers, not the button you clicked:**

```
npm run check:agc
  OK   app_id matches AGC_APP_ID
  OK   project_id 101653523865399891 matches .agc.env
```

The console's download button lives on **the app's own page**, not the project page — they
look nearly identical, which is what caused the confusion last time. The file downloaded from
the app page is now at `android/app/agconnect-services.json`. **Never hand-edit it**: it is
issued per app, and rewriting the `package_name` strings inside it does not make it valid for
another app.

---

## 4. Step 2 — build the bundle (DONE 2026-10-22)

```bash
npm run sync:public
npm test
npm run build:aab
```

Output: `dist/BikeRider-1.0.6-com.bikerider.game.aab` (+ a `SHA256SUMS` entry).

`tools/build-aab.mjs` refuses to build if `agconnect-services.json` is missing, if its
`package_name` disagrees with `applicationId`, or if it carries a retired app id, project id
or package name. That guard is deliberate: a bundle built against the wrong app record
uploads cleanly and then attaches to the wrong listing.

**Verified 2026-10-22:** Gradle 8.2.1 builds `bundleRelease` clean in ~33 s, signs it with
`CN=Bike Rider`, and the AGCP plugin injects `com.huawei.hms.client.appid = appid=119458707`
plus `AGConnectInitializeProvider` / `ServiceDiscovery` into the merged manifest — proof
that the console-issued config was read and applied. Gradle 9.x fails with *"Cannot mutate
the dependencies of configuration ':app:releaseCompileClasspath'"* — the wrapper is pinned
to 8.2.1 on purpose.

### The Huawei SDK integration (verified against Huawei's own integration guide)

| Guide step | Where it lives in this repo |
|---|---|
| Add configuration file | `android/app/agconnect-services.json` (app_id `119458707`) |
| Maven address, project level | `android/build.gradle` → `buildscript.repositories` + `android/settings.gradle` → `pluginManagement` and `dependencyResolutionManagement` |
| `classpath 'com.huawei.agconnect:agcp:1.5.2.300'` | `android/build.gradle` |
| `implementation 'com.huawei.agconnect:agconnect-core:1.5.2.300'` | `android/app/build.gradle` |
| `apply plugin: 'com.huawei.agconnect'` | `android/app/build.gradle`, immediately after `com.android.application` |

Two deliberate differences from Huawei's text: the Maven address lives in
`settings.gradle`'s `dependencyResolutionManagement` rather than an `allprojects` block
(equivalent and newer — and `RepositoriesMode.PREFER_SETTINGS` means an `allprojects` block
would be ignored dead code), and the AGCP plugin is applied at the top of the app-level file
rather than the bottom, because it must come after the Android plugin. Both are proven by
the successful build.

---

## 5. Step 3 — signing mode (Method 1, one-way)

Console → the app → **Distribute → Services → App Signing**. Sign the service agreement the
first time.

> **Choose the mode BEFORE uploading the first package.** Huawei: *"If you have uploaded an
> app package, this option is not displayed. If you want to use this mode for an app, you need
> to create an app again."* One upload decides it.

### Method 1 — AppGallery Connect manages the key (CHOSEN, ACTIVE)

Huawei generates the signing key, re-signs the package, and shows the app signing
certificate fingerprint. Huawei's FAQ explicitly recommends Method 1 for a first release,
and it avoids the Method 2 upload path that already failed once on this project.

**Enabled 2026-10-22.** The console now shows two certificates:

| | SHA-256 | What it is |
|---|---|---|
| App signing certificate | `BC:82:CE:98:64:BF:0B:DC:83:B3:C8:70:DC:AD:7A:B3:27:A4:C4:FA:72:25:CF:EA:02:3F:B1:07:FB:C3:2B:D2` | the key Huawei generated and signs the store APK with. **Download the certificate file from the console and back it up.** |
| Upload certificate | `EE:81:CD:F1:F3:68:63:BF:F8:3B:1A:A0:1C:EA:12:7F:EF:E1:36:F0:5D:4B:1D:F2:7D:EE:D4:68:03:E2:93:E5` | `android/release.keystore` — signs every package you upload so AGC can confirm it is you |

**Consequence, recorded on purpose:** the store APK is signed by Huawei's key, not by
`android/release.keystore`. So a sideloaded APK can never be upgraded by the store build
(different signer) and vice versa. For a brand-new app with no store presence, that is
correct and cheap. `android/release.keystore` stays the identity of the sideloaded APK and
of every package you upload — keep backing it up, because it is the only way to ship an
update to a device that already has one.

**One door left open:** every future upload must be signed with the same upload key
(`android/release.keystore`). If that keystore is lost, no further version can be uploaded
under Method 1 either — AGC would have no way to confirm the upload is you. It is now
load-bearing for the store as well, not just for sideloading.

### Method 2 — you upload the key (fallback, not used)

Only if the store fingerprint must match the local keystore (multi-store distribution,
third-party signature checks). The console's Browse button wants **a `.zip` produced by
`pepk.jar`** — not loose `certificate.pem` / `encryptedPrivateKey` files. Three hand-built
ZIP layouts were tried on the previous project and all three were rejected with AGC's
generic "An unknown error occurred".

```bash
curl -L -o pepk.jar https://gstatic.com/play-apps-publisher-rapid/signing-tool/prod/pepk.jar
java -jar pepk.jar \
  --keystore android/release.keystore \
  --alias release \
  --output=agc-upload/sign.zip \
  --encryptionkey=034200041E224EE22B45D19B23DB91BA9F52DE0A06513E03A5821409B34976FDEED6E0A47DBA48CC249DD93734A6C5D9A0F43461F9E140F278A5D2860846C2CF5D2C3C02 \
  --include-cert
```

The `--encryptionkey` is Huawei's fixed public key. Do not change it. The keystore password
is in `android/keystore.properties` (`storePass`), `chmod 600`. `pepk.jar` reads the JVM's
default keystore type, which is PKCS12 on JDK 9+; if it rejects the file, convert first
with `keytool -importkeystore … -deststoretype JKS`. `agc-upload/` and `pepk.jar` are
gitignored.

---

## 6. Step 4 — upload the package

### Route A — console (use this for the first submission)

Console → **the app** → **App bundle → Upload** →
`dist/BikeRider-1.0.6-com.bikerider.game.aab` → Save. Watch for the compile status to turn
green (Huawei parses the bundle asynchronously, ~2 min).

### Route B — script (every version after the first)

One API client, created once:

AGC console → **Users and permissions → API key → Connect API → API client** → Create
→ project = Bike Rider, roles = the release/publish permission. It returns a **client id and
client secret**. (The "Service Account" tab is the newer equivalent — see §1.)

Put them in `.agc.env`:

```
AGC_CLIENT_ID=<the API client id>
AGC_CLIENT_SECRET=<the API client secret>
```

Then:

```bash
npm run check:agc -- --live      # proves the credential type before you spend an upload
npm run upload:agc -- --aab dist/BikeRider-1.0.6-com.bikerider.game.aab --submit
```

The script (`tools/agc-upload.mjs`) performs the five calls the console would:

1. `POST /api/oauth2/v1/token` — API-client token (on the regional host, §1)
2. `GET  /api/publish/v2/upload-url?appId=…&suffix=aab&releaseType=1` — upload URL + authCode
3. `POST <uploadUrl>` — multipart upload of the `.aab`
4. `PUT  /api/publish/v2/app-file-info?appId=…` — attach the file to the app record
5. `POST /api/publish/v2/app-submit?appid=…` — submit for review (only with `--submit`)

`--dry-run` prints the requests without sending anything. `--release-type 3` switches to a
phased release. The script prints every response body: Huawei answers with HTTP 200 and an
error code inside `ret.code` far more often than with a 4xx, so a silent failure is not
possible.

Do **not** use the project-level client id here — it fails with *"the type of clientId not
match"*, which is exactly what the preflight's `--live` probe is there to catch.

---

## 7. Step 5 — the listing (console)

Copy is ready in `PUBLISH.md` §5.1. Checklist:

- [ ] App name matches the created app name exactly (`BIKE RIDER`)
- [ ] Icon 512×512 (`icons/icon-512.png`), category Games → Racing
- [ ] Screenshots: `public/Screenshot/01-…` … `08-…` (landscape; the game is landscape).
      `public/Screenshot/Screenshot_Bike Rider0*.jpg` are store-sized variants
- [ ] Short description (80 chars) and full description from `PUBLISH.md` §5.1
- [ ] Privacy policy URL → `https://alasarjadeed.com/privacy.html`
- [ ] Content rating questionnaire (no violence, cartoon crashes, no user interaction)
- [ ] Data safety: **no data collected, no data shared** — true, the APK has no INTERNET permission
- [ ] Target audience / age rating, and the "game" content declarations Huawei asks for
- [ ] Release countries and regions
- [ ] App signing fingerprint — with **Method 1** Huawei owns the key and the console offers
      "Add certificate fingerprint" on the app's App information page. Only fill it in if an
      AGC service needs to match it; it is not required for a plain store submission.

---

## 8. Step 6 — submit and verify

- [ ] App bundle status: compiled, no errors
- [ ] Version shows 1.0.6 / versionCode 6
- [ ] Package name reads `com.bikerider.game`
- [ ] Submit for review
- [ ] Watch the review email. Rule 9.5 (name) and privacy-policy reachability are the two
      things most likely to bounce.

---

## 9. After it is live

```bash
npm run build:apk     # sideload artifact, signed with the same keystore
npm run upload:agc -- --aab dist/BikeRider-<new>-com.bikerider.game.aab --submit
```

Bump `version` and `versionCode` in `package.json` **and** `versionName`/`versionCode` in
`android/app/build.gradle` together, then `npm run build:aab`.

---

## 10. Back up, now, before anything else

Three things, off this machine, in a password manager or an encrypted drive:

| Item | Why |
|---|---|
| `android/release.keystore` | the **upload key** — every future package must be signed with it or AGC cannot confirm the upload is you. Lose it and the store is frozen too, not just sideloading |
| `android/keystore.properties` | its password |
| `.agc.env` | the AGC credentials, including the API client |
| the **app signing certificate** downloaded from the console | the store's public identity, `BC:82:CE:98…D2`. Huawei will never export the key behind it |

`agc-upload/sign.zip` is regenerable from the keystore, so it does not need backing up — but
the keystore does.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `the type of clientId not match` (ret.code 203886599) | the project's client id used where a publish client id is required | create a Connect API **client** and use that client id |
| `invalid client id` (ret.code 203882498) | the project API key was used as a client id | same as above |
| `client id or secret error` (ret.code 203890688) | the app's OAuth 2.0 client was used | the publishing API does not take it — create a Connect API client |
| `android/app/agconnect-services.json is missing` | the build guard | download it from the app's own console page |
| `package_name … does not match applicationId` | the file belongs to a different app | download it again from the matching app |
| `app_id 119398303` / project `101653523865359516` | you are still on the deleted project | current app is `119458707` in project `101653523865399891` |
| `the app signature key file that you uploaded is not supported` | key algorithm/length outside Huawei's set | ours is RSA 2048 — should not happen; re-export with `pepk.jar` |
| `An unknown error occurred` on the signing-key upload | wrong file shape (loose files instead of `pepk.jar`'s zip) **or** no app record to attach to | use `agc-upload/sign.zip`; confirm the app exists via `npm run check:agc` |
| `Cannot mutate the dependencies of configuration ':app:releaseCompileClasspath'` | Gradle 9.x | wrapper pinned to 8.2.1 — restore it |
| upload succeeds but the version never appears | Huawei parses asynchronously | wait ~2 min, then re-check; re-uploading does not help |
| `404` / wrong host on a publish API call | the app's data-processing region is Russia — the host must be `connect-api-drru` | `tools/agc-config.mjs` derives it from `agconnect-services.json` |
| review rejects on the app name | rule 9.5 | the name is locked; the app must be recreated under a distinct one |

---

## 12. One-page summary

1. **Create the app** — DONE: `BIKE RIDER` / `com.bikerider.game`, app id `119458707`.
2. **Download** `agconnect-services.json` from the app's page — DONE, attached at
   `android/app/`.
3. **Verify:** `npm run check:agc` → all OK.
4. **Signing mode:** **Method 1, enabled 2026-10-22** — Huawei's key `BC:82:CE:98…D2` signs the
   store APK, our keystore `EE:81:CD:F1…93:E5` signs the uploads. Download the app signing
   certificate and back it up.
5. **Upload** `dist/BikeRider-1.0.6-com.bikerider.game.aab` in the console — **NEXT**.
6. **Fill in the listing** from `PUBLISH.md` §5.1.
7. **Submit for review.**
8. **Create a Connect API key** so later versions upload with one command.
9. **Back up** `android/release.keystore` + `android/keystore.properties` + `.agc.env`.
