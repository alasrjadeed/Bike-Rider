#!/usr/bin/env node
/**
 * AppGallery preflight — one command that answers "can I build and upload right now?"
 *
 *   npm run check:agc          static checks only
 *   npm run check:agc -- --live  also probe Huawei's token endpoint (proves the
 *                                  credential type before an upload burns it)
 *
 * Every check that can fail with a *misleading* symptom lives here:
 *
 *  - agconnect-services.json belongs to a retired app/project. The file is still
 *    valid JSON, the AGCP plugin accepts it, the bundle builds and uploads cleanly
 *    — and attaches to the wrong listing. Every id is cross-checked against the
 *    console-issued values in .agc.env, not just against the file's own contents.
 *  - The credential in .agc.env is the wrong TYPE. The project's client id is not
 *    a publish client: Huawei answers "the type of clientId not match"
 *    (ret.code 203886599). --live is the only way to know before uploading.
 *  - The app id in .agc.env and the app id inside agconnect-services.json drift
 *    apart. Same failure as above, one step further along.
 *
 * Exit code is 1 only for a hard failure. A missing Connect API client is a
 * warning, not a failure: the FIRST release goes through the console and does
 * not need it.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, AGC_FILE, ENV_FILE, ANDROID,
  RETIRED_APP_IDS, RETIRED_PROJECT_IDS, RETIRED_PACKAGES,
  CURRENT_APP_ID, CURRENT_PROJECT_ID, CURRENT_PACKAGE,
  applicationId, readEnvFile, readAgcClient, gradleMajor, apiBase, apiHost,
} from './agc-config.mjs';

const LIVE = process.argv.includes('--live');
const API = apiBase();

const env = readEnvFile();
const APP_ID_GRADLE = applicationId();
const client = readAgcClient();

let failures = 0;
let warnings = 0;

const ok = m => console.log('  OK   ' + m);
const bad = m => { failures++; console.log('  FAIL ' + m); };
const warn = m => { warnings++; console.log('  WARN ' + m); };
const info = m => console.log('  --   ' + m);

console.log('AppGallery preflight — Bike Rider');
console.log('');

// ---------------------------------------------------------------- credentials
console.log('credentials');
if (!fs.existsSync(ENV_FILE)) {
  bad('.agc.env is missing — nothing can be uploaded without it');
} else {
  const mode = (fs.statSync(ENV_FILE).mode & 0o777).toString(8);
  if (mode !== '600') warn('.agc.env is mode ' + mode + ' — run: chmod 600 .agc.env');
  else ok('.agc.env present, mode 600');

  const need = ['AGC_PROJECT_ID', 'AGC_DEVELOPER_ID', 'AGC_PROJECT_CLIENT_ID', 'AGC_PROJECT_CLIENT_SECRET', 'AGC_PROJECT_API_KEY'];
  const missing = need.filter(k => !env[k]);
  if (missing.length) bad('.agc.env is missing: ' + missing.join(', '));
  else ok('project tier complete (project ' + env.AGC_PROJECT_ID + ', developer ' + env.AGC_DEVELOPER_ID + ')');

  if (env.AGC_PROJECT_ID && env.AGC_PROJECT_ID !== CURRENT_PROJECT_ID) {
    bad('.agc.env project id ' + env.AGC_PROJECT_ID + ' is not the current project ' + CURRENT_PROJECT_ID);
  }
  if (env.AGC_APP_ID) {
    if (RETIRED_APP_IDS.has(String(env.AGC_APP_ID))) bad('AGC_APP_ID ' + env.AGC_APP_ID + ' is a retired listing');
    else ok('app tier: AGC_APP_ID ' + env.AGC_APP_ID);
  } else {
    bad('AGC_APP_ID is unset — AGC console -> My apps -> the app -> App information');
  }
  if (!env.AGC_CLIENT_ID || !env.AGC_CLIENT_SECRET) {
    warn('no Connect API client yet (AGC_CLIENT_ID/AGC_CLIENT_SECRET) — console upload still works, scripted upload does not');
  }
  if (env.AGC_APP_OAUTH_CLIENT_ID) {
    info('app OAuth 2.0 client ' + env.AGC_APP_OAUTH_CLIENT_ID + ' present — HMS auth only, the publishing API rejects it');
  }
}

// ---------------------------------------------------------------- agc config
console.log('');
console.log('agconnect-services.json');
if (!fs.existsSync(AGC_FILE)) {
  bad('android/app/agconnect-services.json is missing');
  info('download it from the APP page (not the project page) and save it to android/app/');
} else if (!client) {
  bad('android/app/agconnect-services.json is not valid JSON');
} else {
  ok('present, valid JSON');

  if (client.package_name !== APP_ID_GRADLE) {
    bad('package_name (' + client.package_name + ') does not match applicationId (' + APP_ID_GRADLE + ')');
  } else {
    ok('package_name matches applicationId (' + client.package_name + ')');
  }

  if (RETIRED_PACKAGES.has(String(client.package_name))) {
    bad('package_name ' + client.package_name + ' belongs to a retired listing');
  }

  if (RETIRED_APP_IDS.has(String(client.app_id))) {
    bad('app_id ' + client.app_id + ' is the REJECTED listing — download from the current app page');
  } else {
    ok('app_id ' + client.app_id);
  }

  if (RETIRED_PROJECT_IDS.has(String(client.project_id))) {
    bad('project_id ' + client.project_id + ' is a DELETED project — download from the current app page');
  } else if (env.AGC_PROJECT_ID && client.project_id !== env.AGC_PROJECT_ID) {
    bad('project_id (' + client.project_id + ') does not match .agc.env (' + env.AGC_PROJECT_ID + ')');
  } else {
    ok('project_id ' + client.project_id + ' matches .agc.env');
  }

  if (env.AGC_APP_ID && String(client.app_id) !== String(env.AGC_APP_ID)) {
    bad('app_id in the file (' + client.app_id + ') differs from AGC_APP_ID (' + env.AGC_APP_ID + ')');
  } else {
    ok('app_id matches AGC_APP_ID');
  }

  if (env.AGC_PROJECT_API_KEY && client.api_key && client.api_key !== env.AGC_PROJECT_API_KEY) {
    bad('api_key in the file differs from the project api_key in .agc.env');
  } else {
    ok('api_key matches the project api_key in .agc.env');
  }

  info('publishing host ' + API + ' (follows the app data-processing region)');
}

// ---------------------------------------------------------------- build inputs
console.log('');
console.log('build');
const keystore = path.join(ANDROID, 'release.keystore');
const props = path.join(ANDROID, 'keystore.properties');
if (!fs.existsSync(keystore)) bad('android/release.keystore is missing — no bundle can be signed');
else ok('release keystore present');
if (!fs.existsSync(props)) warn('android/keystore.properties is missing — the build cannot read the keystore password');
else ok('keystore.properties present');

const major = gradleMajor();
if (major >= 9) bad('Gradle wrapper is on ' + major + '.x — the Huawei AGCP plugin needs 8.x');
else ok('Gradle wrapper on ' + major + '.x');

// ---------------------------------------------------------------- live probe
if (LIVE) {
  console.log('');
  console.log('live token probe (' + apiHost() + ')');
  if (!env.AGC_CLIENT_ID || !env.AGC_CLIENT_SECRET) {
    bad('no Connect API client to probe — create one in the console first');
  } else {
    try {
      const res = await fetch(API + '/api/oauth2/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cache-control': 'no-cache' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: env.AGC_CLIENT_ID,
          client_secret: env.AGC_CLIENT_SECRET,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.access_token) {
        ok('token acquired — this credential can upload');
      } else {
        const code = json.ret && json.ret.code;
        const msg = json.ret && json.ret.msg;
        bad('token refused' + (code ? ' (ret.code ' + code + ': ' + msg + ')' : ''));
        if (code === 203886599) {
          info('that is the PROJECT client — create a Connect API key instead');
        }
      }
    } catch (e) {
      bad('token probe failed: ' + e.message);
    }
  }
}

// ---------------------------------------------------------------- verdict
console.log('');
if (failures) {
  console.log('NOT READY — ' + failures + ' blocking problem' + (failures === 1 ? '' : 's') + '.');
  console.log('Next console action:');
  if (!fs.existsSync(AGC_FILE)) {
    console.log('  1. AGC console -> My apps -> project "Bike Rider" -> the app -> download agconnect-services.json');
    console.log('     -> save to android/app/agconnect-services.json');
  }
  if (!env.AGC_CLIENT_ID || !env.AGC_CLIENT_SECRET) {
    console.log('  2. Users and permissions -> API key -> Connect API -> Create API key (project "Bike Rider", Publish API)');
    console.log('     -> put the client id and secret in .agc.env as AGC_CLIENT_ID / AGC_CLIENT_SECRET');
  }
  console.log('  3. re-run: npm run check:agc');
} else {
  console.log('READY — npm run build:aab');
  if (env.AGC_CLIENT_ID && env.AGC_CLIENT_SECRET) {
    console.log('       npm run upload:agc -- --aab dist/<file>.aab --submit');
  } else {
    console.log('       then upload the .aab through the console (no Connect API client configured)');
  }
}
if (warnings) console.log('(' + warnings + ' warning' + (warnings === 1 ? '' : 's') + ')');
process.exit(failures ? 1 : 0);
