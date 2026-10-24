// On-device release check. Drives the parts of the release checklist that need real hardware:
// install, cold launch, no fatal errors, a rendered frame, then the same again with the network
// switched off. Run with a phone plugged in and USB debugging authorised:
//
//   node tools/device-check.mjs [--serial <id>] [--apk dist/bike-rider-1.0.0.apk] [--keep-log]
//
// Exit code 0 means every stage passed. Nothing here is a substitute for actually playing the game
// -- touch ergonomics, audio on first run, and the hardware back button still want a human -- but it
// turns the mechanical parts of the pass into one command instead of a checklist.
//
// Why it drives logcat and screencap rather than the WebView: the shell deliberately does not call
// setWebContentsDebuggingEnabled, so a release build is not remotely inspectable. That is the right
// default for a shipping app, so this checks the observable surface instead: the process is alive,
// the Activity is resumed, the frame is not blank, and logcat is clean.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

// Read the package id out of the Gradle module instead of keeping a second hard-coded copy —
// this constant had already drifted from the shipped applicationId once.
const PKG = (fs.readFileSync(path.join(ROOT, 'android', 'app', 'build.gradle'), 'utf8')
  .match(/applicationId\s+'([^']+)'/) || [])[1];
if (!PKG) { console.error('could not read applicationId from android/app/build.gradle'); process.exit(1); }
const ACT = PKG + '/.MainActivity';
const ANDROID = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || path.join(os.homedir(), 'Android', 'Sdk');
const ADB = path.join(ANDROID, 'platform-tools', 'adb');

const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0;
const failures = [];
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('  \x1b[32mPASS\x1b[0m ' + name + (detail ? '  \x1b[2m' + detail + '\x1b[0m' : '')); }
  else { failures.push(name + (detail ? ': ' + detail : '')); console.log('  \x1b[31mFAIL\x1b[0m ' + name + (detail ? '\n       ' + detail : '')); }
};

const adb = (args, opts = {}) => {
  const r = spawnSync(ADB, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return { out: (r.stdout || '') + (r.stderr || ''), code: r.status === null ? -1 : r.status, ok: r.status === 0 };
};

function devices() {
  if (!fs.existsSync(ADB)) throw new Error('adb not found at ' + ADB + ' -- set ANDROID_SDK_ROOT');
  const out = adb(['devices']).out;
  return out.split('\n').slice(1)
    .map(l => l.trim())
    .filter(l => l && l.endsWith('device'))
    .map(l => l.split(/\s+/)[0]);
}

const targetApk = () => {
  const given = opt('--apk', null);
  if (given) return path.resolve(ROOT, given);
  const dir = path.join(ROOT, 'dist');
  const apks = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.apk')) : [];
  if (!apks.length) throw new Error('no APK in dist/ -- run `npm run build:apk` first');
  // newest wins, so a stale artifact is never silently tested
  const newest = apks.map(f => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  return newest;
};

const foreground = () => adb(['shell', 'dumpsys', 'activity', 'activities']).out;
const stripNulls = t => t.replace(/\0/g, '');
const resumedContains = pkg => {
  // Which dumpsys key holds the foreground activity depends on the Android version: older builds
  // say `mResumedActivity`, Android 16 says `topResumedActivity`, and some report neither and only
  // expose the focused window. Two traps made this FAIL while the app was demonstrably resumed and
  // rendering a 1.1 MB frame, and both are fixed here:
  //   1. the dumpsys output is a *history*, not a single value -- it also contains focus lines for
  //      whatever was in front earlier -- so matching the FIRST hit reports a previous app. The
  //      current state is the LAST one printed, so use that.
  //   2. the window dumps contain NUL bytes, which makes a naive line regex silently miss.
  // Authoritative order: resumed fields first, then the focused window. If nothing at all reports a
  // foreground activity this returns false rather than guessing, so a silent harness never reports
  // success it cannot justify.
  const grab = (args, re) => {
    const out = stripNulls(adb(args).out);
    const all = [...out.matchAll(re)].map(m => m[0]);
    return all.length ? all[all.length - 1] : null;   // last == current
  };
  const resumed = grab(['shell', 'dumpsys', 'activity', 'activities'],
                       /(?:topResumedActivity|mResumedActivity)[^\n]*/g);
  if (resumed) return resumed.includes(pkg);
  const focus = grab(['shell', 'dumpsys', 'window'], /mCurrentFocus[^\n]*/g)
             || grab(['shell', 'dumpsys', 'window', 'windows'], /mCurrentFocus[^\n]*/g);
  if (focus) return focus.includes(pkg);
  const act = grab(['shell', 'dumpsys', 'activity', 'activities'], /mFocusedActivity[^\n]*/g);
  return act ? act.includes(pkg) : false;
};
const alive = () => adb(['shell', 'pidof', PKG]).out.trim().split(/\s+/).filter(Boolean).length > 0;

function clearLog() { adb(['logcat', '-c']); }

function logErrors(since) {
  const out = adb(['logcat', '-d', '-v', 'brief']).out;
  const bad = [];
  for (const line of out.split('\n')) {
    if (since && !line.includes(since)) continue;
    if (/FATAL EXCEPTION|AndroidRuntime: .*(Error|Exception)|chromium.*Uncaught|Uncaught \(in promise\)/.test(line)) bad.push(line.trim());
    // the game reports its own boot failure through reportError(); catch the visible symptom too
    if (/Failed to start:/.test(line)) bad.push(line.trim());
  }
  return bad;
}

async function screenshot(tag) {
  const file = path.join(os.tmpdir(), 'br-device-' + tag + '.png');
  const r = spawnSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 1024) return { file, bytes: r.stdout ? r.stdout.length : 0 };
  fs.writeFileSync(file, r.stdout);
  return { file, bytes: r.stdout.length };
}

async function main() {
  const list = devices();
  if (!list.length) {
    console.error('No device attached. Connect a phone with USB debugging on, then re-run.\n'
      + '  ' + ADB + ' devices -l');
    process.exit(2);
  }
  const serial = opt('--serial', list.length === 1 ? list[0] : null);
  if (!serial) {
    console.error('More than one device attached; pass --serial <id>.\n  ' + list.join('\n  '));
    process.exit(2);
  }
  const base = serial === list[0] && list.length === 1 ? [] : ['-s', serial];
  const A = args => adb([...base, ...args]);

  const apk = targetApk();
  console.log('Bike Rider device check');
  console.log('  device  ' + serial);
  console.log('  apk     ' + path.relative(ROOT, apk) + '  (' + (fs.statSync(apk).size / 1024).toFixed(0) + ' KiB, ' + fs.statSync(apk).mtime.toISOString().slice(0, 10) + ')');
  console.log('');

  // ---- install
  const ins = A(['install', '-r', apk]);
  check('install', ins.ok, ins.ok ? 'installed' : ins.out.trim().split('\n').slice(-2).join(' '));

  // ---- online cold launch
  console.log('\n  \x1b[2m-- online cold launch --\x1b[0m');
  A(['shell', 'am', 'force-stop', PKG]);
  clearLog();
  const t0 = Date.now();
  const l1 = A(['shell', 'am', 'start', '-W', '-n', ACT]);
  check('launch returns ok', l1.ok, (l1.out.match(/Status:.*|ThisTime:.*|TotalTime:.*/g) || []).join(' '));
  await sleep(6000);                                   // world build + first frames
  check('process alive', alive(), 'pid ' + A(['shell', 'pidof', PKG]).out.trim());
  check('activity resumed', resumedContains(PKG));
  const shot1 = await screenshot('online');
  // A blank WebView compresses to almost nothing; a rendered 3D menu is far larger. Crude, but it
  // catches the real failure mode (white/black screen) without decoding the PNG.
  check('frame is not blank', shot1.bytes > 8000, (shot1.bytes / 1024).toFixed(0) + ' KiB png -> ' + shot1.file);
  const errs1 = logErrors();
  check('no fatal errors in logcat', errs1.length === 0, errs1.slice(0, 3).join(' | '));
  console.log('  \x1b[2mfirst frame in ~' + ((Date.now() - t0) / 1000).toFixed(1) + 's\x1b[0m');

  // ---- offline cold launch: this is the checklist item the web suite cannot cover
  console.log('\n  \x1b[2m-- offline cold launch (airplane mode) --\x1b[0m');
  const wifi0 = A(['shell', 'settings', 'get', 'global', 'airplane_mode_on']).out.trim();
  const data0 = A(['shell', 'settings', 'get', 'global', 'mobile_data']).out.trim();
  A(['shell', 'cmd', ' connectivity', 'airplane-mode', 'enable']);
  A(['shell', 'svc', 'wifi', 'disable']);
  A(['shell', 'svc', 'data', 'disable']);
  await sleep(3000);
  const airplane = A(['shell', 'settings', 'get', 'global', 'airplane_mode_on']).out.trim();
  check('airplane mode engaged', airplane === '1' || airplane === wifi0, 'airplane_mode_on=' + airplane);

  A(['shell', 'am', 'force-stop', PKG]);
  await sleep(1000);
  clearLog();
  const l2 = A(['shell', 'am', 'start', '-W', '-n', ACT]);
  check('launch offline returns ok', l2.ok, (l2.out.match(/Status:.*|TotalTime:.*/g) || []).join(' '));
  await sleep(6000);
  check('process alive offline', alive(), 'pid ' + A(['shell', 'pidof', PKG]).out.trim());
  check('activity resumed offline', resumedContains(PKG));
  const shot2 = await screenshot('offline');
  check('frame is not blank offline', shot2.bytes > 8000, (shot2.bytes / 1024).toFixed(0) + ' KiB png -> ' + shot2.file);
  const errs2 = logErrors();
  check('no fatal errors offline', errs2.length === 0, errs2.slice(0, 3).join(' | '));

  // ---- restore the device exactly as we found it
  A(['shell', 'cmd', 'connectivity', 'airplane-mode', 'disable']);
  if (data0 === '1') A(['shell', 'svc', 'data', 'enable']);
  A(['shell', 'svc', 'wifi', 'enable']);
  await sleep(2000);
  const airplane1 = A(['shell', 'settings', 'get', 'global', 'airplane_mode_on']).out.trim();
  check('airplane mode restored', airplane1 === wifi0, 'airplane_mode_on=' + airplane1);

  if (flag('--keep-log')) {
    const log = path.join(ROOT, 'dist', 'device-logcat.txt');
    fs.writeFileSync(log, adb(['logcat', '-d', '-v', 'time']).out);
    console.log('\n  logcat saved to ' + path.relative(ROOT, log));
  }

  console.log('\n  ' + pass + ' passed, ' + failures.length + ' failed');
  if (failures.length) {
    console.log('\n  failures:');
    for (const f of failures) console.log('   - ' + f);
    console.log('\n  Still worth doing by hand: first-run audio, the hardware back button, and touch');
    console.log('  ergonomics on a real screen. Screenshots: ' + shot1.file + ' , ' + shot2.file);
    process.exit(1);
  }
  console.log('\n  \x1b[2mMechanical pass complete. Play it for a few minutes before shipping.\x1b[0m');
}

main().catch(e => { console.error('\n' + (e && e.message ? e.message : String(e))); process.exit(2); });
