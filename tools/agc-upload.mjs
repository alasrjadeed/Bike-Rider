#!/usr/bin/env node
/**
 * Uploads an .aab to AppGallery through the Connect API (Publishing API).
 *
 *   node tools/agc-upload.mjs --aab dist/BikeRider-1.0.6-com.bikerider.game.aab --submit
 *
 * Why this exists: the first submission has to happen in the AGC console anyway, because the
 * signing mode (Method 1 vs Method 2) can only be chosen there and only BEFORE the first
 * package is uploaded. Every release after that is a version bump, and doing it through the
 * console means five pages of click-through. This script does the same five API calls the
 * console would, in one command.
 *
 * Credentials come from `.agc.env` in the project root (gitignored, chmod 600) or from the
 * environment:
 *
 *   AGC_CLIENT_ID      API client id  — AGC console -> Users and permissions -> API Key ->
 *                      Connect API -> Create API key. NOT the project "Client ID" from the
 *                      project API-key page: that one is a different credential type and the
 *                      token endpoint rejects it with "the type of clientId not match".
 *   AGC_CLIENT_SECRET  secret of that same API key.
 *   AGC_APP_ID         numeric app id of the AppGallery app record — AGC console -> My apps ->
 *                      the app -> App information. This is the app_id inside
 *                      android/app/agconnect-services.json, and it is NOT the project id.
 *
 * The API can upload a package but cannot create the app record and cannot upload a signing
 * key. Those two steps stay in the console — see APPGALLERY-RUNBOOK.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { apiBase, apiHost, appRegion } from './agc-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The Connect API host follows the app's data-processing region (Russia for this app), and
// Huawei's docs are explicit that the token endpoint must be the SAME host as the API it
// authenticates. Reading it from agconnect-services.json is the only way to get it right.
const API = apiBase();

// ---- args ----
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
};
const has = name => args.includes(name);

const say = m => console.log(m);
const die = m => { console.error('upload failed: ' + m); process.exit(1); };

// ---- credentials ----
// .agc.env is a flat KEY=VALUE file. Environment variables win over it, so CI can inject
// them without touching the file.
const readEnvFile = () => {
  const file = path.join(ROOT, '.agc.env');
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
};

const fileEnv = readEnvFile();
const env = key => process.env[key] || fileEnv[key] || '';

const CLIENT_ID = env('AGC_CLIENT_ID');
const CLIENT_SECRET = env('AGC_CLIENT_SECRET');
const APP_ID = env('AGC_APP_ID');
const RELEASE_TYPE = flag('--release-type', '1');   // 1 = full release, 3 = phased release
const DRY = has('--dry-run');
const SUBMIT = has('--submit');

// ---- artifact ----
const newestAab = () => {
  const dir = path.join(ROOT, 'dist');
  if (!fs.existsSync(dir)) return null;
  const aabs = fs.readdirSync(dir).filter(f => f.endsWith('.aab'));
  if (!aabs.length) return null;
  aabs.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
  return path.join(dir, aabs[0]);
};

const aabArg = flag('--aab', '');
const AAB = aabArg ? path.resolve(aabArg) : newestAab();

// ---- http ----
// Every response body is printed verbatim. Huawei's API answers with HTTP 200 and an error
// code inside `ret.code` far more often than it does with a 4xx, so a body that is not
// printed is a body that cannot be debugged.
async function req(method, url, { headers = {}, body, raw = false } = {}) {
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON — printed as text below */ }
  if (!res.ok) die(`${method} ${url}\n  HTTP ${res.status}\n  ${text.slice(0, 800)}`);
  if (json && json.ret && Number(json.ret.code) !== 0) {
    die(`${method} ${url}\n  ret.code ${json.ret.code}: ${json.ret.msg}\n  ${text.slice(0, 800)}`);
  }
  if (raw) return { text, json };
  return { text, json: json ?? text };
}

// ---- steps ----
async function getToken() {
  const url = `${API}/api/oauth2/v1/token`;
  const body = JSON.stringify({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  if (DRY) { say(`  POST ${url}  (client_id=${CLIENT_ID || '<unset>'})`); return 'DRY-RUN-TOKEN'; }
  const { json } = await req('POST', url, {
    headers: { 'Content-Type': 'application/json', 'cache-control': 'no-cache' },
    body,
  });
  if (!json.access_token) die('token response had no access_token:\n  ' + JSON.stringify(json).slice(0, 600));
  return json.access_token;
}

async function getUploadUrl(token, fileName, size, sha256) {
  const url = `${API}/api/publish/v2/upload-url?appId=${encodeURIComponent(APP_ID)}&suffix=aab&releaseType=${RELEASE_TYPE}`;
  if (DRY) { say(`  GET  ${url}`); return { uploadUrl: 'DRY-RUN-URL', authCode: 'DRY-RUN-AUTH' }; }
  const { json } = await req('GET', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', client_id: CLIENT_ID },
  });
  if (!json.uploadUrl || !json.authCode) die('upload-url response was missing uploadUrl/authCode:\n  ' + JSON.stringify(json).slice(0, 600));
  return { uploadUrl: json.uploadUrl, authCode: json.authCode };
}

async function uploadFile(uploadUrl, authCode, aabPath) {
  if (DRY) { say(`  POST ${uploadUrl}  (multipart: authCode, fileCount=1, parseType=1, file=${path.basename(aabPath)})`); return { fileDestUrl: 'DRY', size: '0' }; }
  const form = new FormData();
  form.set('authCode', authCode);
  form.set('fileCount', '1');
  form.set('parseType', '1');
  form.set('file', new Blob([fs.readFileSync(aabPath)]), path.basename(aabPath));
  const { json } = await req('POST', uploadUrl, { headers: { Accept: 'application/json' }, body: form });
  const r = json && json.result && json.result.UploadFileRsp;
  const info = r && r.fileInfoList && r.fileInfoList[0];
  if (!info || !info.fileDestUlr) die('upload response had no fileDestUlr:\n  ' + JSON.stringify(json).slice(0, 800));
  return { fileDestUrl: info.fileDestUlr, size: String(info.size) };
}

async function updateAppFileInfo(token, fileName, fileDestUrl, size) {
  const url = `${API}/api/publish/v2/app-file-info?appId=${encodeURIComponent(APP_ID)}`;
  const body = JSON.stringify({ fileType: '5', files: [{ fileName, fileDestUrl, size }] });
  if (DRY) { say(`  PUT  ${url}\n  ${body}`); return; }
  await req('PUT', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', releaseType: RELEASE_TYPE, client_id: CLIENT_ID },
    body,
  });
  say('  app file info updated');
}

async function submitApp(token) {
  const url = `${API}/api/publish/v2/app-submit?appid=${encodeURIComponent(APP_ID)}`;
  if (DRY) { say(`  POST ${url}`); return; }
  await req('POST', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', client_id: CLIENT_ID },
  });
  say('  submitted for review');
}

// ---- main ----
say('AppGallery upload (Connect API)');
say(`  host    ${API}  (region ${appRegion() || 'default'})`);
say(`  app id   ${APP_ID || '<unset>'}`);
say(`  client   ${CLIENT_ID || '<unset>'}`);
say(`  artifact ${AAB ? path.relative(ROOT, AAB) : '<none>'}`);
say(`  release  ${RELEASE_TYPE}${SUBMIT ? '  (submit for review)' : '  (upload only)'}`);

if (!AAB) die('no .aab found in dist/ — run: npm run build:aab');
if (!fs.existsSync(AAB)) die('artifact not found: ' + path.relative(ROOT, AAB));
if (!APP_ID) die('AGC_APP_ID is unset — put it in .agc.env (gitignored) or export it');
if (!CLIENT_ID || !CLIENT_SECRET) {
  die('AGC_CLIENT_ID / AGC_CLIENT_SECRET are unset.\n'
    + '  Create an API key in the AGC console: Users and permissions -> API Key -> Connect API ->\n'
    + '  Create API key, choose this project and the Publish API, then put the client id and\n'
    + '  secret in .agc.env. The project "Client ID" from the project API-key page is a\n'
    + '  different credential type and the token endpoint rejects it.');
}

const bytes = fs.statSync(AAB).size;
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(AAB)).digest('hex');
say(`  size     ${bytes} bytes`);
say(`  sha256   ${sha256}`);

say('');
const token = await getToken();
if (!DRY) say('  token acquired');

const { uploadUrl, authCode } = await getUploadUrl(token, path.basename(AAB), bytes, sha256);
if (!DRY) say('  upload url acquired');

const { fileDestUrl, size } = await uploadFile(uploadUrl, authCode, AAB);
if (!DRY) say('  file uploaded');

await updateAppFileInfo(token, path.basename(AAB), fileDestUrl, size);

if (SUBMIT) {
  // Huawei parses the package asynchronously. Submitting too early is the usual cause of a
  // "package not ready" rejection, so wait before asking for review.
  say('  waiting 180s for Huawei to parse the package…');
  if (!DRY) await new Promise(r => setTimeout(r, 180000));
  await submitApp(token);
}

say('');
say(DRY ? 'dry run — nothing was sent' : 'done');
