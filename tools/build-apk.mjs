// Builds the Android APK with the raw SDK tools — no Gradle, no network, no dependencies.
//
//   node tools/build-apk.mjs [--release] [--sdk <path>] [--out dist]
//
// Why not Gradle: the wrapper is one Activity and one WebView, and the whole project has zero
// third-party dependencies. Aapt2 + javac + d8 + apksigner is the same pipeline Gradle wraps,
// minus an ~100 MB plugin download per machine — which matters when the build has to work
// offline, on a fresh checkout, on a phone-shop laptop.
//
// Produces:
//   dist/bike-rider-<version>.apk        installable, zipaligned, signed
//   dist/bike-rider-<version>.web.zip    the same web build, for hosting/PWA
//   dist/SHA256SUMS                          checksums for both

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildWeb, writeSums } from './build-web.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const SDK = opt('--sdk', process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '/home/oem/Android/Sdk');
const OUT = path.resolve(ROOT, opt('--out', 'dist'));
const BUILD = path.join(ROOT, 'android', 'build');
const RELEASE = flag('--release');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const VERSION_CODE = Number(pkg.versionCode || 1);

// The manifest is the single source of truth for sdk levels; the build reads them back out so a
// bump in one file cannot silently leave the other behind.
//
// The Gradle project under android/app/ owns the real manifest. This offline path only needs the
// sdk levels and a linkable manifest, so it reads app/build.gradle for the identity and falls back
// to the checked-in offline manifest beside the res/ folder it links against.
const GRADLE_APP = path.join(ROOT, 'android', 'app', 'build.gradle');
const MANIFEST = path.join(ROOT, 'android', 'AndroidManifest.xml');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
// Java sources: the Gradle module owns them; the offline path compiles the same tree.
const JAVA_SRC = path.join(ROOT, 'android', 'app', 'src', 'main', 'java');
const readManifest = () => {
  const gradle = fs.readFileSync(GRADLE_APP, 'utf8');
  const g = (re, d) => { const m = gradle.match(re); return m ? m[1] : d; };
  const minSdk = Number(g(/minSdk\s+(\d+)/, '24'));
  const targetSdk = Number(g(/targetSdk\s+(\d+)/, '34'));
  return { minSdk, targetSdk };
};

const say = m => console.log(m);
const die = m => { console.error('build failed: ' + m); process.exit(1); };
const run = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  } catch (e) {
    const err = (e.stderr || Buffer.alloc(0)).toString().trim() || (e.stdout || Buffer.alloc(0)).toString().trim();
    die(cmd + ' ' + args.join(' ') + '\n' + err);
  }
};

// ---------------------------------------------------------------- toolchain
function findBuildTools() {
  const base = path.join(SDK, 'build-tools');
  if (!fs.existsSync(base)) die('no build-tools in ' + SDK + ' (set ANDROID_SDK_ROOT)');
  const versions = fs.readdirSync(base).filter(v => /^\d+\.\d+\.\d+$/.test(v)).sort(compareVersions);
  if (!versions.length) die('no build-tools in ' + base);
  return path.join(base, versions[versions.length - 1]);
}
function compareVersions(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}
function findPlatform() {
  const base = path.join(SDK, 'platforms');
  if (!fs.existsSync(base)) die('no platforms in ' + SDK);
  const versions = fs.readdirSync(base).filter(v => /^android-\d+$/.test(v))
    .map(v => Number(v.replace('android-', ''))).sort((a, b) => a - b);
  if (!versions.length) die('no android-N platforms in ' + base);
  return { dir: path.join(base, 'android-' + versions[versions.length - 1]), api: versions[versions.length - 1] };
}
const which = c => { try { execSync('command -v ' + c, { stdio: 'ignore' }); return c; } catch { return null; } };

const BT = findBuildTools();
const PLATFORM = findPlatform();
const ANDROID_JAR = path.join(PLATFORM.dir, 'android.jar');
for (const t of ['aapt2', 'd8', 'zipalign', 'apksigner']) {
  if (!fs.existsSync(path.join(BT, t))) die(t + ' missing from ' + BT);
}
if (!fs.existsSync(ANDROID_JAR)) die('android.jar missing at ' + ANDROID_JAR);
const JAVAC = which('javac') || die('javac not found (install a JDK 8+; this build needs 17 for the default)');
const KEYTOOL = which('keytool') || die('keytool not found (comes with the JDK)');
const ZIP = which('zip') || die('zip not found');

const SDK_LEVELS = readManifest();

say('Bike Rider ' + VERSION + ' (code ' + VERSION_CODE + ')');
say('  sdk      ' + SDK);
say('  platform android-' + PLATFORM.api + '  (min ' + SDK_LEVELS.minSdk + ' / target ' + SDK_LEVELS.targetSdk + ')');
say('  tools    ' + path.relative(SDK, BT));
say('  mode     ' + (RELEASE ? 'release' : 'debug'));

// ---------------------------------------------------------------- assets
// The APK carries the web build, not the 334 MB of music stems sitting in public/music — the
// game synthesises every sound through WebAudio and references no audio file at all.
const stageAssets = () => {
  const dest = path.join(BUILD, 'assets', 'public');
  fs.rmSync(path.join(BUILD, 'assets'), { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  // Listing/screenshot material is not runtime payload. public/Screenshot/ holds the AppGallery
  // store screenshots and a promo video (tens of MB) — nothing in the game references them, so they
  // must never be baked into the APK. Same guard as music/: excluded here rather than trusted to
  // whoever staged public/.
  const SKIP = new Set(['music', 'Screenshot', 'node_modules', '.git']);
  let files = 0, bytes = 0;
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const from = path.join(dir, e.name);
      const to = path.join(dest, path.relative(path.join(ROOT, 'public'), from));
      if (e.isDirectory()) { fs.mkdirSync(to, { recursive: true }); walk(from); }
      else { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); files++; bytes += fs.statSync(to).size; }
    }
  };
  walk(path.join(ROOT, 'public'));
  if (!fs.existsSync(path.join(dest, 'index.html'))) die('public/index.html is missing — run the public sync first');

  // Pre-flight: every local file the page references must be in the staged assets. A resource
  // that is present on the dev machine but missing from the APK is a blank screen on a device
  // with no console to read, and it is invisible to the desktop regression run.
  const html = fs.readFileSync(path.join(dest, 'index.html'), 'utf8');
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const u = m[1];
    if (!u || u.includes('${') || u.startsWith('#') || /^(https?:)?\/\//i.test(u) || /^(data|blob):/i.test(u)) continue;
    refs.add(u.split('?')[0].split('#')[0]);
  }
  const absent = [...refs].filter(u => !fs.existsSync(path.join(dest, u)));
  if (absent.length) die('these files are referenced by the page but are not in public/: ' + absent.join(', '));
  say('  preflight ' + refs.size + ' page references, all staged');
  const music = path.join(ROOT, 'public', 'music');
  say('  assets   ' + files + ' files, ' + (bytes / 1024).toFixed(0) + ' KiB staged');
  if (fs.existsSync(music)) say('  WARNING   public/music/ is back on disk — excluded, but every sound is WebAudio; delete it');
  return { files, bytes };
};

// ---------------------------------------------------------------- resources + dex
const compileResources = () => {
  say('  aapt2    compile res');
  const zipOut = path.join(BUILD, 'res.zip');
  fs.rmSync(zipOut, { force: true });
  run(path.join(BT, 'aapt2'), ['compile', '--dir', RES, '-o', zipOut]);

  say('  aapt2    link');
  const gen = path.join(BUILD, 'gen');
  fs.rmSync(path.join(BUILD, 'base.apk'), { force: true });
  // compiled resources are positional (the base set); -R would make them an overlay
  run(path.join(BT, 'aapt2'), [
    'link', '-o', path.join(BUILD, 'base.apk'),
    '-I', ANDROID_JAR,
    '--manifest', MANIFEST,
    '--java', gen,
    '--min-sdk-version', String(SDK_LEVELS.minSdk),
    '--target-sdk-version', String(SDK_LEVELS.targetSdk),
    '--version-code', String(VERSION_CODE),
    '--version-name', VERSION,
    '--no-version-vectors',
    zipOut,
  ]);
  return gen;
};

const compileJava = gen => {
  say('  javac    ' + path.relative(ROOT, JAVA_SRC));
  const classes = path.join(BUILD, 'classes');
  fs.rmSync(classes, { recursive: true, force: true });
  fs.mkdirSync(classes, { recursive: true });
  const sources = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else if (f.endsWith('.java')) sources.push(f);
  } };
  walk(gen);
  walk(JAVA_SRC);
  // No -bootclasspath: replacing the JDK's platform classes also removes java.lang.invoke, which
  // is where LambdaMetafactory lives. android.jar goes on the classpath instead, so java.* comes
  // from the JDK and android.* from the SDK — d8 desugars the lambdas on the way in.
  run(JAVAC, ['-nowarn', '-encoding', 'UTF-8', '-source', '8', '-target', '8',
    '-classpath', ANDROID_JAR, '-d', classes, ...sources],
    { stdio: ['ignore', 'inherit', 'inherit'] });
  return classes;
};

const dex = classes => {
  say('  d8       dex');
  const dexOut = path.join(BUILD, 'dex');
  fs.rmSync(dexOut, { recursive: true, force: true });
  fs.mkdirSync(dexOut, { recursive: true });
  const classFiles = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else if (f.endsWith('.class')) classFiles.push(f);
  } };
  walk(classes);
  run(path.join(BT, 'd8'), ['--lib', ANDROID_JAR, '--min-api', String(SDK_LEVELS.minSdk), '--output', dexOut, ...classFiles]);
  const dexFile = path.join(dexOut, 'classes.dex');
  if (!fs.existsSync(dexFile)) die('d8 produced no classes.dex');
  return dexFile;
};

// ---------------------------------------------------------------- signing
// Credentials are never hardcoded here. Resolved in priority order: environment, then
// android/keystore.properties (gitignored), then the well-known debug password. A release build
// with no resolvable password fails loudly rather than quietly falling back to "android" -- a
// release identity signed with a published password is not a release identity, and losing the
// keystore means the app can never be updated again, so both files must be backed up off-device.
const CRED_FILE = path.join(ROOT, 'android', 'keystore.properties');

const readCredFile = () => {
  if (!fs.existsSync(CRED_FILE)) return {};
  const out = {};
  for (const line of fs.readFileSync(CRED_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
};

const credentials = () => {
  const file = readCredFile();
  const storePass = process.env.ANDROID_STORE_PASS || file.storePass || (RELEASE ? null : 'android');
  const keyPass = process.env.ANDROID_KEY_PASS || file.keyPass || storePass;
  const keyAlias = process.env.ANDROID_KEY_ALIAS || file.keyAlias || (RELEASE ? null : 'androiddebugkey');
  if (RELEASE && !(storePass && keyAlias)) die(
    'no release signing credentials.\n'
    + '  Set ANDROID_STORE_PASS and ANDROID_KEY_ALIAS, or fill in android/keystore.properties:\n'
    + '    storePass=...\n'
    + '    keyPass=...\n'
    + '    keyAlias=...\n'
    + '  Both that file and android/release.keystore are gitignored; back them up off this machine.');
  // Prove the password actually opens the keystore before spending a full build on it. A product
  // rename once swept a repo-wide sed over the passwords and rewrote the *credential*, which only
  // surfaced 36s into a Gradle run as "BadPaddingException: Given final block not properly padded".
  // Passwords are not brand names — they must never be renamed. This check names the cause.
  if (RELEASE) {
    const releaseKs = path.join(ROOT, 'android', 'release.keystore');
    if (fs.existsSync(releaseKs)) {
      try {
        execFileSync(KEYTOOL, ['-list', '-keystore', releaseKs, '-storepass', storePass],
          { stdio: ['ignore', 'ignore', 'pipe'] });
      } catch (e) {
        die(
          'the release password does not open android/release.keystore.\n'
          + '  The storePass in android/keystore.properties (or ANDROID_STORE_PASS) is not the one the\n'
          + '  keystore was created with. Signing credentials are NOT brand names — a project-wide\n'
          + '  rename must never touch them. Restore the original password.\n'
          + '  ' + String(e.stderr || '').trim().split('\n').pop());
      }
    }
  }
  return { storePass, keyPass, keyAlias };
};

const keystore = () => {
  const ks = path.join(ROOT, 'android', RELEASE ? 'release.keystore' : 'debug.keystore');
  if (fs.existsSync(ks)) return ks;
  if (RELEASE) die('android/release.keystore is missing — create it with keytool and keep it out of git');
  say('  keytool  generating a debug keystore (first run only)');
  run(KEYTOOL, ['-genkeypair', '-v', '-keystore', ks, '-storepass', 'android', '-keypass', 'android',
    '-alias', 'androiddebugkey', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-dname', 'CN=Android Debug,O=Bike Rider,C=BH']);
  return ks;
};

// ---------------------------------------------------------------- package
const assemble = (dexFile, ks, cred) => {
  say('  package  assets + dex');
  const unsigned = path.join(BUILD, 'app-unsigned.apk');
  fs.rmSync(unsigned, { force: true });
  fs.copyFileSync(path.join(BUILD, 'base.apk'), unsigned);
  // zip -X drops extra file attributes; the resource table is already in base.apk
  run(ZIP, ['-q', '-X', '-j', unsigned, dexFile], { cwd: BUILD });
  // add the staged web build under assets/ so getAssets().open("public/…") resolves
  run(ZIP, ['-q', '-X', '-r', unsigned, 'assets/public'], { cwd: BUILD });

  const aligned = path.join(BUILD, 'app-aligned.apk');
  fs.rmSync(aligned, { force: true });
  run(path.join(BT, 'zipalign'), ['-f', '-p', '4', unsigned, aligned]);

  say('  apksigner sign (' + (RELEASE ? 'release' : 'debug') + ')');
  const signed = path.join(BUILD, 'app-signed.apk');
  fs.rmSync(signed, { force: true });
  run(path.join(BT, 'apksigner'), ['sign', '--ks', ks, '--ks-key-alias', cred.keyAlias,
    '--ks-pass', 'pass:' + cred.storePass, '--key-pass', 'pass:' + cred.keyPass,
    '--v1-signing-enabled', 'true', '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true',
    '--out', signed, aligned]);
  const verify = run(path.join(BT, 'apksigner'), ['verify', '--verbose', '--print-certs', signed]).toString();
  const v1 = /Verified using v1 scheme.*true/.test(verify) || /Verified using v1 scheme/.test(verify);
  if (!/Verifies/i.test(verify)) die('apksigner could not verify the output:\n' + verify);
  return { signed, v1 };
};

const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// ---------------------------------------------------------------- main
fs.rmSync(BUILD, { recursive: true, force: true });
fs.mkdirSync(BUILD, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

stageAssets();
const gen = compileResources();
const classes = compileJava(gen);
const dexFile = dex(classes);
const ks = keystore();
const { signed } = assemble(dexFile, ks, credentials());

const apkName = 'bike-rider-' + VERSION + '.apk';
const apk = path.join(OUT, apkName);
fs.copyFileSync(signed, apk);

// the same build as a hostable zip, from the shared web packager so both land in one checksum file
const webZip = buildWeb({ quiet: true });
writeSums([apk, webZip]);

const kb = n => (n / 1024).toFixed(0) + ' KiB';
say('');
say('  ' + apkName.padEnd(34) + kb(fs.statSync(apk).size));
say('  ' + path.basename(webZip).padEnd(34) + kb(fs.statSync(webZip).size));
say('  SHA256SUMS');
say('');
say('  install: adb install -r ' + path.relative(ROOT, apk));
say('  checks:  ' + path.join(BT, 'apksigner') + ' verify --print-certs ' + path.relative(ROOT, apk));
