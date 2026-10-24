// Single source of truth for the AppGallery identity facts that more than one
// tool needs to agree on: which app/project/package are the CURRENT ones, and
// which are retired.
//
// It exists because the failure mode is silent. An agconnect-services.json that
// belongs to a superseded listing is still valid JSON, the AGCP plugin accepts
// it, the build succeeds, the bundle uploads cleanly — and then it attaches to
// the wrong AppGallery app. Every check that needs to know "is this the current
// app?" reads its answer from here, so the list of retired ids is written down
// exactly once and cannot drift between the build guard and the preflight.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ANDROID = path.join(ROOT, 'android');
export const AGC_FILE = path.join(ANDROID, 'app', 'agconnect-services.json');
export const ENV_FILE = path.join(ROOT, '.agc.env');
export const GRADLE_FILE = path.join(ANDROID, 'app', 'build.gradle');
export const WRAPPER_FILE = path.join(ANDROID, 'gradle', 'wrapper', 'gradle-wrapper.properties');

// The rejected listing of the deleted project, and the project it belonged to.
export const RETIRED_APP_IDS = new Set(['119398303']);
export const RETIRED_PROJECT_IDS = new Set(['101653523865359516']);
export const RETIRED_PACKAGES = new Set(['bikerider.huawei', 'com.bikerider.huawei']);

// The app that was created on 2026-10-22 in project 101653523865399891.
export const CURRENT_PROJECT_ID = '101653523865399891';
export const CURRENT_APP_ID = '119458707';
export const CURRENT_PACKAGE = 'com.bikerider.game';

// Reads applicationId out of the Gradle module — the app's identity on the store.
export const applicationId = () => {
  const src = fs.readFileSync(GRADLE_FILE, 'utf8');
  return (src.match(/applicationId\s+'([^']+)'/) || [])[1] || '';
};

// Reads the flat KEY=VALUE credential file. Uncommented lines only.
export const readEnvFile = () => {
  const out = {};
  if (!fs.existsSync(ENV_FILE)) return out;
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
};

// Reads the client section of the console-issued agconnect-services.json.
export const readAgcClient = () => {
  if (!fs.existsSync(AGC_FILE)) return null;
  try {
    return (JSON.parse(fs.readFileSync(AGC_FILE, 'utf8')).client) || {};
  } catch {
    return null;
  }
};

// The Gradle wrapper must stay on 8.x: AGP 8.2.1 + the Huawei AGCP plugin fail on 9.x.
export const gradleMajor = () => {
  const src = fs.readFileSync(WRAPPER_FILE, 'utf8');
  return Number(((src.match(/gradle-(\d+)\./) || [])[1]) || 0);
};

// The Connect API host follows the APP's data-processing region, and the token endpoint must
// be the same host as the API it authenticates (Huawei's Connect API docs). agconnect-services.json
// carries that region — "RU" for Russia, which is what this project's app was created with.
// Hardcoding the default China host works for CN projects and silently misroutes everything else.
const REGION_HOSTS = {
  CN: 'connect-api-drcn',
  SG: 'connect-api-dra',
  DE: 'connect-api-dre',
  RU: 'connect-api-drru',
};

export const apiHost = () => {
  const region = appRegion();
  return REGION_HOSTS[region] || 'connect-api';
};

export const appRegion = () => {
  try {
    return String(JSON.parse(fs.readFileSync(AGC_FILE, 'utf8')).region || '').toUpperCase();
  } catch { /* no config yet */ }
  return '';
};

export const apiBase = () => `https://${apiHost()}.cloud.huawei.com`;

