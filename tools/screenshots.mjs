// AppGallery store screenshots: boots the real game in headless Chrome over CDP, walks the
// screens a player actually sees, and writes PNGs to public/Screenshot/ at 1600x900
// (downscaled to 800x450 afterwards — capture big for clean antialiasing).
// No npm dependencies. Run: node tools/screenshots.mjs
import { launch, Session, sleep } from './cdp.mjs';
import { serve } from './serve.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'Screenshot');
fs.mkdirSync(OUT, { recursive: true });

const srv = await serve(ROOT, 0);
const chrome = await launch({ width: 1600, height: 900 });
let failed = false;

try {
  const s = await Session.connect(chrome.port, chrome.targetId);
  await s.init();
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await s.goto(`http://127.0.0.1:${srv.port}/index.html?debug`);
  // The harness helper regress.mjs installs page-side — must come AFTER goto (navigation wipes it)
  await s.raw(`window.__t=function(src){ try{ return {ok:true, v:__BR.ev(src)}; }catch(e){ return {ok:false, e:((e&&e.message)||String(e))}; } };`);
  for (let i = 0; i < 200; i++) {
    const st = await s.expr(`(window.__BR && __BR.G.state) || 'loading'`);
    if (st && st !== 'loading') break;
    await sleep(100);
  }
  await sleep(4000);   // world chunks, fonts, first render — let the scene settle for real

  // s.run() returns {ok:false} instead of throwing — a silent failure once cost a whole
  // screenshot run (every shot was the menu). Every run must assert ok.
  const run = async src => {
    const r = await s.run(src);
    if (!r.ok) throw new Error('game snippet failed: ' + r.error);
    return r.value;
  };
  const want = async (label, st) => {
    const cur = await s.expr(`__BR.G.state`);
    if (cur !== st) throw new Error(label + ': expected state "' + st + '", got "' + cur + '"');
  };

  const snap = async name => {
    const { data } = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(join(OUT, name + '.png'), Buffer.from(data, 'base64'));
    console.log('shot', name);
  };

  // --- seed a lived-in rider profile so the menu/journal/summary read like real progress
  await run(`
    const S=SAVE;
    S.tutorialDone=true; G.noTutorial=true; G.autopilot=true;
    S.cash=18.450; S.totalEarnings=642.800; S.jobs=214; S.rating=4.70; S.xp=3800;
    S.shifts=78; S.distance=690000; S.bestShift=4.100; S.rest=0; S.restAt=Date.now();
    S.settings.ads=S.settings.ads||{}; S.settings.ads.premium=true;
    S.settings.hudMode='full';
    journalRoll(); const J=S.journal;
    Object.assign(J.day,{shifts:6,jobs:18,earn:9.450,dist:52300,perfect:4,crashes:1,best:3.200});
    Object.assign(J.week,{shifts:31,jobs:94,earn:48.750,dist:271000,perfect:22,crashes:5,best:4.100});
    Object.assign(J.month,{shifts:78,jobs:240,earn:126.300,dist:690000,perfect:57,crashes:11,best:4.100});
    J.hist=[{p:'d',k:'2026-10-17',shifts:7,jobs:21,earn:11.200,dist:60100,perfect:5,crashes:0,best:3.650}];
    G.state='menu'; UI.show('screenStart'); return 1;`);
  await want('start menu', 'menu');
  await sleep(1500);
  await snap('01-start-menu');

  // --- Track C: rest card with wages waiting (hides START, shows SKIP REST + wages)
  await run(`SAVE.rest=Date.now()+18*60000; SAVE.restAt=Date.now()-3.5*3600e3; UI.renderRest(); return 1;`);
  await sleep(800);
  await snap('02-rest-and-wages');

  // --- afternoon ride, autopilot steering, full HUD
  await run(`SAVE.rest=0; SAVE.settings.weather='clear'; SAVE.settings.time='afternoon'; startShift(); return 1;`);
  await want('afternoon ride', 'playing');
  await sleep(7000);
  await snap('03-ride-afternoon');

  // --- night rain for variety
  await run(`__brScene('weather','rain'); __brScene('tod','night'); return 1;`);
  await sleep(4000);
  await snap('04-ride-night-rain');

  // --- shift summary with real numbers (M is reset by startShift, so seed it here)
  await run(`
    Object.assign(M,{today:4.750,jobs:6,shiftDist:14200,starsSum:29,crashes:1,fuelSpent:1.15,
      fines:0,violations:1,perfect:4,failed:0,bonusSum:0.3,penSum:0,
      xpStart:SAVE.xp-120,levelStart:levelOf(SAVE.xp),ratingStart:SAVE.rating});
    endShift(''); return 1;`);
  await want('shift summary', 'summary');
  await sleep(2500);
  await snap('05-shift-summary');

  // --- Ustad's garage, service tab = damage/condition advisory (costs after a rough shift)
  await run(`openGarage(); UI.gTab='service'; UI.renderGarage(); return 1;`);
  await want('garage', 'garage');
  await sleep(1500);
  await snap('06-ustad-garage-service');

  // --- GAUSS AUTO showroom (3D bike viewer)
  await run(`openGarage('show'); return 1;`);
  await sleep(3000);
  await snap('07-showroom-gauss-auto');

  // --- Track C: wrecked-bike wait-or-loan modal over the paused ride
  await run(`goMenu(); return 1;`);
  await sleep(800);
  await run(`G.autopilot=false; startShift(); return 1;`);
  await sleep(2500);
  await run(`breakdownTow(); return 1;`);
  await want('ustad modal', 'paused');
  const modalOpen = await s.expr(`!__BR.$('modalUstad').classList.contains('hidden')`);
  if (!modalOpen) throw new Error('ustad modal did not open');
  await sleep(1500);
  await snap('08-ustad-wait-or-loan');

  const errs = s.errors();
  if (errs.length) { failed = true; console.error('page errors:', errs.slice(0, 5)); }
} catch (e) {
  failed = true;
  console.error('screenshot run failed:', e.message);
} finally {
  chrome.close();
  srv.close();
}
process.exit(failed ? 1 : 0);
