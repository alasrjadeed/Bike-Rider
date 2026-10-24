// Builds the Huawei AppGallery release bundle (.aab) with Gradle.
//
//   node tools/build-aab.mjs
//
// The APK path (tools/build-apk.mjs) is the offline, no-plugin build used for sideloading.
// AppGallery submissions need an .aab, which only the Android Gradle Plugin can produce, so this
// script runs the Gradle project in android/ instead. Everything it needs is committed:
//   android/settings.gradle, android/build.gradle, android/app/build.gradle,
//   android/app/src/main/AndroidManifest.xml, android/release.keystore
//
// Steps: sync public/ into the APK/AAB asset folder, refresh the launcher icons, then
// `gradlew bundleRelease` and copy the bundle to dist/ with the versioned, AppGallery-friendly name.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeSums } from './build-web.mjs';
import { RETIRED_APP_IDS, RETIRED_PROJECT_IDS, RETIRED_PACKAGES } from './agc-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = path.join(ROOT, 'android');
const OUT = path.resolve(ROOT, (process.argv.indexOf('--out') >= 0 ? process.argv[process.argv.indexOf('--out') + 1] : 'dist'));

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const VERSION_CODE = Number(pkg.versionCode || 1);

// The applicationId is the app's identity on AppGallery: read it back out of the manifest-side
// gradle file so a rename can never leave the output filename describing the old package.
const appGradle = fs.readFileSync(path.join(ANDROID, 'app', 'build.gradle'), 'utf8');
const APP_ID = (appGradle.match(/applicationId\s+'([^']+)'/) || [])[1];
if (!APP_ID) die('could not read applicationId from android/app/build.gradle');

// JAVA_HOME: the shell this runs in may have no `java` on PATH, which is how gradlew fails
// with the classic "no Java runtime" message. Prefer an explicit JAVA_HOME, then the JDK that
// past Gradle runs have used on this machine.
const JAVA_HOME = process.env.JAVA_HOME || ['/home/oem/tools/jdk-17.0.20.1+1'].find(d => fs.existsSync(path.join(d, 'bin', 'java'))) || '';
if (!JAVA_HOME) die('set JAVA_HOME to a JDK 17 install');

// The Gradle wrapper must stay on 8.x. AGP 8.2.1 and the Huawei AGCP plugin mutate the release
// compile classpath late, and Gradle 9 rejects that with "Cannot mutate the dependencies of
// configuration ':app:releaseCompileClasspath'" at :app:processReleaseResources — 35 seconds
// into the build, with a message that says nothing about versions. The wrapper drifted to 9.7.1
// once already, so the check lives here instead of in a doc.
const checkGradleWrapper = () => {
  const props = fs.readFileSync(path.join(ANDROID, 'gradle', 'wrapper', 'gradle-wrapper.properties'), 'utf8');
  const major = Number(((props.match(/gradle-(\d+)\./) || [])[1]) || 0);
  if (major >= 9) die(
    'the Gradle wrapper is pinned to ' + (props.match(/gradle-[\d.]+/) || ['?'])[0] + ', but this build needs Gradle 8.x.\n'
    + '  AGP 8.2.1 + the Huawei AGCP plugin fail on Gradle 9 with "Cannot mutate the dependencies\n'
    + "  of configuration ':app:releaseCompileClasspath'.\n"
    + '  Fix: set distributionUrl to gradle-8.2.1-all.zip in android/gradle/wrapper/gradle-wrapper.properties.');
};

const say = m => console.log(m);
const die = m => { console.error('build failed: ' + m); process.exit(1); };

checkGradleWrapper();

// The AgConnect config is issued PER APP by Huawei's console and is not interchangeable. After a
// package rename it is easy to rewrite the `package_name` strings inside this file and believe the job
// is done — but app_id/client_id/api_key still point at the OLD AGC app record, and the build succeeds
// anyway (AGCP only needs valid JSON). The result is a bundle that uploads cleanly and then attaches to
// a superseded listing instead of the new project. This guard exists to catch exactly that.
const AGC = path.join(ANDROID, 'app', 'agconnect-services.json');
if (!fs.existsSync(AGC)) die(
  'android/app/agconnect-services.json is missing.\n'
  + '  The Gradle build applies the com.huawei.agconnect plugin, which needs this file. More to the\n'
  + '  point, a bundle built without it cannot be attributed to an AppGallery app.\n'
  + '  Fix: create the app in AppGallery Connect (package ' + APP_ID + '), download its\n'
  + '  agconnect-services.json, and drop it in android/app/ before building.');
{
  let agc;
  try { agc = JSON.parse(fs.readFileSync(AGC, 'utf8')); }
  catch (e) { die('android/app/agconnect-services.json is not valid JSON: ' + e.message); }
  const client = agc.client || {};
  if (client.package_name && client.package_name !== APP_ID) die(
    'agconnect-services.json package_name (' + client.package_name + ') does not match applicationId (' + APP_ID + ').\n'
    + '  Download agconnect-services.json again from the matching AppGallery Connect app.');
  // app_ids known to belong to superseded listings. Add to this set when an app is retired.
  if (RETIRED_APP_IDS.has(String(client.app_id))) die(
    'agconnect-services.json still belongs to the OLD AppGallery app record (app_id ' + client.app_id + ').\n'
    + '  The package_name may have been rewritten but the credentials were not, so this bundle would\n'
    + '  attach to the superseded listing instead of the new project.\n'
    + '  Fix: create the new app in AppGallery Connect, download its agconnect-services.json, and\n'
    + '  drop it in android/app/ before building.');
  // The project id is the other half of the identity: a file downloaded from the deleted project
  // carries the deleted project's id even after its package_name strings are rewritten.
  if (RETIRED_PROJECT_IDS.has(String(client.project_id))) die(
    'agconnect-services.json belongs to a DELETED AppGallery project (project_id ' + client.project_id + ').\n'
    + '  The bundle would upload cleanly and attach to a project that no longer exists.\n'
    + '  Fix: download agconnect-services.json from the current app page and drop it in android/app/.');
  if (RETIRED_PACKAGES.has(String(client.package_name))) die(
    'agconnect-services.json uses a retired package name (' + client.package_name + ').\n'
    + '  Fix: download agconnect-services.json from the current app page (package ' + APP_ID + ').');
}
const run = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { stdio: 'inherit', ...opts });
  } catch (e) {
    die(cmd + ' ' + args.join(' ') + '\n' + ((e.stderr || Buffer.alloc(0)).toString().trim() || e.message));
  }
};

const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// ---------------------------------------------------------------- assets
// The bundle carries the deployable web build, staged into the module's assets folder. root -> public
// is done by sync-public.mjs (run by the npm script); here public/ -> android assets.
const stageAssets = () => {
  const src = path.join(ROOT, 'public');
  const dest = path.join(ANDROID, 'app', 'src', 'main', 'assets', 'public');
  // Listing/screenshot material is not runtime payload. public/Screenshot/ holds the AppGallery
  // store screenshots and a promo video — nothing in the game references them, so they must never be
  // baked into the bundle. Same guard as music/.
  const SKIP = new Set(['music', 'Screenshot', 'node_modules', '.git']);
  if (!fs.existsSync(path.join(src, 'index.html'))) die('public/index.html is missing — run: npm run sync:public');

  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  let files = 0, bytes = 0;
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const from = path.join(dir, e.name);
      const to = path.join(dest, path.relative(src, from));
      if (e.isDirectory()) { fs.mkdirSync(to, { recursive: true }); walk(from); }
      else { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); files++; bytes += fs.statSync(to).size; }
    }
  };
  walk(src);
  say('  assets  ' + files + ' files, ' + (bytes / 1024).toFixed(0) + ' KiB staged from public/');
};

// ---------------------------------------------------------------- icons
// Launcher icons come from the same generated set as the PWA icons, so the home screen and the
// installed web app can never show different logos.
const stageIcons = () => {
  const gen = fs.readFileSync(path.join(ROOT, 'tools', 'make-icons.py'), 'utf8');
  say('  icons   ' + (gen ? 'make-icons.py present' : 'missing') + ' (run: npm run icons)');
};

// ---------------------------------------------------------------- main
say('Bike Rider bundle ' + VERSION + ' (code ' + VERSION_CODE + ')  ' + APP_ID);
say('  java    ' + JAVA_HOME);
say('  mode    release .aab');

stageAssets();
stageIcons();

const gradlew = path.join(ANDROID, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
fs.chmodSync(gradlew, 0o755);
run(gradlew, ['bundleRelease', '--no-daemon', '--console=plain'], {
  cwd: ANDROID,
  env: { ...process.env, JAVA_HOME, ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || '/home/oem/Android/Sdk', ANDROID_HOME: process.env.ANDROID_HOME || '/home/oem/Android/Sdk' },
});

const built = path.join(ANDROID, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
if (!fs.existsSync(built)) die('gradle produced no app-release.aab');

fs.mkdirSync(OUT, { recursive: true });
const aabName = `BikeRider-${VERSION}-${APP_ID}.aab`;
const aab = path.join(OUT, aabName);
fs.copyFileSync(built, aab);

const kb = n => (n / 1024).toFixed(0) + ' KiB';
say('');
say('  ' + aabName.padEnd(46) + kb(fs.statSync(aab).size));
say('  sha256  ' + sha256(aab));

// dist/SHA256SUMS is shared with the APK/web build. writeSums() rewrites it from every release
// artifact present in dist/, so running this build alone cannot drop the APK or web-zip entries.
writeSums([aab]);
const sumsLines = fs.readFileSync(path.join(OUT, 'SHA256SUMS'), 'utf8').trim().split('\n').length;
say('  SHA256SUMS updated (' + sumsLines + ' artifact' + (sumsLines === 1 ? '' : 's') + ')');
say('');
say('  upload: AppGallery Console -> App bundle -> ' + path.relative(ROOT, aab));
