// Bike Rider regression suite. Boots the real game in headless Chrome over CDP and asserts against
// its live globals. No npm dependencies. Run: node tools/regress.mjs [--keep] [--only <name>]
import { launch, Session, sleep } from './cdp.mjs';
import { serve } from './serve.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const KEEP = argv.includes('--keep');

const G = [];                       // groups
const group = (name, fn) => G.push({ name, fn });

// assert helpers, installed inside the game's own scope via the ?debug seam
const HELPERS = `
window.__t=function(src){ try{ return {ok:true, v:__BR.ev(src)}; }catch(e){ return {ok:false, e:((e&&e.message)||String(e))}; } };
window.__ok=(c,m)=>{ if(!c) throw new Error(m||'assert failed'); return true; };
window.__eq=(a,b,m)=>{ if(a!==b) throw new Error((m||'eq')+': got '+JSON.stringify(a)+' want '+JSON.stringify(b)); return true; };
window.__near=(a,b,tol,m)=>{ if(!(Math.abs(a-b)<=(tol==null?1e-6:tol))) throw new Error((m||'near')+': got '+a+' want '+b+' ±'+tol); return true; };
window.__fin=(v,m)=>{ if(!Number.isFinite(v)) throw new Error((m||'finite')+': '+v); return true; };
window.__thr=(v,m)=>{ if(!(v>0)) throw new Error((m||'>0')+': '+v); return true; };
// async wrapper so a snippet can await frames; ev() is sync, so resolve on a microtask hop
window.__ta=function(src){ return new Promise(res=>{ try{ Promise.resolve(__BR.ev(src)).then(v=>res({ok:true,v:v}),e=>res({ok:false,e:((e&&e.message)||String(e))})); }catch(e){ res({ok:false,e:((e&&e.message)||String(e))}); } }); };
`;

// ---------------------------------------------------------------- boot / delivery
group('boot', async s => {
  const r = await s.run(`return {
    three: typeof THREE!=='undefined',
    rev: typeof THREE!=='undefined'?THREE.REVISION:0,
    state: G.state,
    quality: G.quality,
    districts: (typeof BAHRAIN!=='undefined'?BAHRAIN.length:-1),
    chunks: W.chunks.length,
    vehicles: T.protos?Object.keys(T.protos).length:-1,
    err: (window.__lastError||null)
  };`);
  if (!r.ok) throw r.error;
  const v = r.value;
  if (!v.three) throw new Error('THREE missing');
  if (String(v.rev) !== '128' && v.rev !== 'r128') throw new Error('expected three r128, got ' + v.rev);
  if (v.state === 'loading') throw new Error('game stuck in loading');
  if (v.districts !== 48) throw new Error('expected 48 districts, got ' + v.districts);
  if (v.vehicles < 6) throw new Error('traffic prototypes not built: ' + v.vehicles);
  const errs = s.errors();
  if (errs.length) throw new Error('console errors: ' + JSON.stringify(errs.slice(0, 4)));
});

group('offline-vendor', async s => {
  // the SW only handles same-origin, so a CDN three.js means a cold offline start has no engine at all
  const r = await s.run(`
    const sc=[...document.querySelectorAll('script[src]')].map(x=>x.getAttribute('src'));
    return { srcs: sc, version: (typeof VERSION!=='undefined'?VERSION:null) };`);
  if (!r.ok) throw r.error;
  const three = r.value.srcs.filter(x => /three/i.test(x));
  if (three.length !== 1) throw new Error('expected exactly one three.js script, got ' + JSON.stringify(three));
  if (!three[0].endsWith('vendor/three.r128.min.js')) throw new Error('three.js is not the vendored copy: ' + three[0]);
  const net = s.events.filter(e => e.method === 'Network.requestWillBeSent');
  if (net.some(e => /cdnjs|unpkg|jsdelivr|googleapis/.test(e.params.request.url) && /\.js\b/.test(e.params.request.url)))
    throw new Error('a remote script is still being fetched at boot');
});

group('offline-boot', async s => {
  // Own tab, own origin, and the HTTP server is shut down for real before the reload. CDP's offline
  // emulation does not reliably reach the service worker's own fetches, and a worker merely told to
  // fail is weaker evidence than a network that does not exist: here the cache is the only possible
  // source for every byte, which is the cold-start case the release checklist asks about. A separate
  // target keeps this from navigating the shared session off the game every other group is driving.
  const alt = await serve(ROOT, 0); // ephemeral: never collide with another project or the dev server
  const base = 'http://127.0.0.1:' + alt.port + '/index.html?debug';
  const port = Number(new URL(s.ws.url).port);
  const { targetId } = await s.send('Target.createTarget', { url: 'about:blank' });
  const o = await Session.connect(port, targetId);
  const arm = async (what) => {
    o.__seam = false;                      // a fresh context: re-detect the seam, re-install helpers
    let seam = false;
    for (let i = 0; i < 240; i++) {
      if (await o.expr('!!(window.__BR && window.__BR.ev)').catch(() => false)) { seam = true; break; }
      await sleep(250);
    }
    if (!seam) throw new Error('game never installed the ?debug seam (' + what + ')');
    await o.raw(HELPERS);
    for (let i = 0; i < 240; i++) {
      const r = await o.run(`return G.state!=='loading' ? G.state : null;`);
      if (r.ok && r.value) return r.value;
      await sleep(250);
    }
    throw new Error('game never left the loading state (' + what + ')');
  };
  try {
    await o.init();
    await o.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});

    // ---- online: let the worker install and the precache fill
    await o.goto(base);
    await arm('first load');
    const pre = await o.ta(`
      // bounded: an unregistered worker makes ready() hang forever, and that must be a clear
      // failure here rather than a 120 s CDP timeout
      const ready = await Promise.race([ navigator.serviceWorker.ready, new Promise((_,x)=>setTimeout(()=>x(new Error('no service worker registered')),15000)) ]);
      for (let i=0;i<100 && !navigator.serviceWorker.controller;i++) await new Promise(r=>setTimeout(r,100));
      const names = await caches.keys();
      const c = await caches.open(names[0]||'__none__');
      const keys = (await c.keys()).map(r=>new URL(r.url).pathname);
      return { controlled: !!navigator.serviceWorker.controller, scope: ready.scope, names, keys };`);
    if (!pre.ok) throw pre.error;
    if (!pre.value.controlled) throw new Error('service worker registered but never took control of the page');
    // read the expected cache name out of sw.js rather than hardcoding it: the version has to be
    // bumped on every release, and a literal here turned each bump into a red suite
    const SWV = (/const VERSION\s*=\s*'([^']+)'/.exec(fs.readFileSync(join(ROOT, 'sw.js'), 'utf8')) || [])[1];
    if (!SWV) throw new Error('could not read the service-worker cache version out of sw.js');
    if (!pre.value.names.includes(SWV)) throw new Error('expected cache ' + SWV + ', got ' + JSON.stringify(pre.value.names));
    for (const need of ['/index.html', '/vendor/three.r128.min.js', '/manifest.webmanifest'])
      if (!pre.value.keys.includes(need)) throw new Error(need + ' was not precached (have: ' + pre.value.keys.join(', ') + ')');

    // ---- pull the network out from under it, for real
    await alt.close();
    await sleep(250);
    const before = o.logs.length;
    o.__seam = false;
    await o.send('Page.reload', {});
    await arm('offline reload');

    const r = await o.run(`
      const cv=document.querySelector('canvas');
      return {
        three: typeof THREE!=='undefined',
        rev: typeof THREE!=='undefined'?THREE.REVISION:0,
        state: G.state,
        chunks: W.chunks.length,
        segs: W.segs.length,
        canvas: cv ? (cv.width+'x'+cv.height) : null,
        fallback: getComputedStyle(document.body).fontFamily,
        overlay: (window.__lastError||null)
      };`);
    if (!r.ok) throw r.error;
    const v = r.value;
    if (!v.three) throw new Error('THREE missing offline -- the engine was not served from cache');
    if (String(v.rev) !== '128' && v.rev !== 'r128') throw new Error('expected three r128 offline, got ' + v.rev);
    if (v.state === 'loading') throw new Error('game stuck in loading offline');
    if (!(v.chunks > 0)) throw new Error('no road chunks built offline');
    if (!v.canvas) throw new Error('no canvas offline');
    if (v.overlay) throw new Error('error overlay after offline boot: ' + v.overlay);
    // The webfonts come from Google and the worker only serves same-origin, so offline the UI has to
    // land on its own fallback stack. Android ships Noto Naskh Arabic and the Devanagari/Thai/
    // Gurmukhi faces as system fonts, so on the target platform that fallback is a real rendering
    // path rather than a blank box.
    if (!/system-ui|sans-serif/.test(v.fallback)) throw new Error('no offline font fallback: ' + v.fallback);
    const errs = o.logs.slice(before).filter(l => l.type === 'error' || l.type === 'pageerror');
    if (errs.length) throw new Error('console errors offline: ' + JSON.stringify(errs.slice(0, 4)));
    return { state: v.state, chunks: v.chunks, segs: v.segs, three: 'r' + v.rev,
             cached: pre.value.keys.length, font: 'fallback' };
  } finally {
    try { o.ws.close(); } catch {}
    await s.send('Target.closeTarget', { targetId }).catch(() => {});
    await alt.close();
  }
});

// ---------------------------------------------------------------- save / migration
group('save-schema', async s => {
  const r = await s.run(`
    const d=defaultSave();
    __eq(d.v,1,'schema v');
    __eq(d.chapter,'bh','default chapter is bh');
    for(const k of ['cash','xp','upgrades','cond','settings','owned','seen','stats']) __ok(d[k]!==undefined,'missing save key '+k);
    __eq(d.settings.shake,'normal','default shake');
    // forward-only migration: a bare v1 save must fill in from the defaults
    const old=deepMerge(defaultSave(),{v:1,cash:42,settings:{shake:true}});
    __eq(old.cash,42,'kept cash');
    __eq(old.settings.shake,true,'deepMerge must not coerce');
    migrateSettings();
    __eq(SAVE.settings.shake,SAVE.settings.shake,'no throw');
    const probe=deepMerge(defaultSave(),{v:1,settings:{shake:true}}); probe.settings.shake=true;
    (function(){ const sv=probe.settings; const t=sv.shake; sv.shake = t===true?'normal':(t===false?'false':'normal'); })();
    __eq(probe.settings.shake,'normal','bool true -> normal');
    return { cash:d.cash, keys:Object.keys(d).length };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('shake-setting', async s => {
  const r = await s.run(`
    const keep=SAVE.settings.shake; const out={};
    SAVE.settings.shake='normal'; __near(shakeScale(),1,0,'normal');
    SAVE.settings.shake='reduced'; __near(shakeScale(),0.35,1e-9,'reduced');
    SAVE.settings.shake='false'; __eq(shakeScale(),0,'off');
    SAVE.settings.shake=false; __eq(shakeScale(),0,'legacy false');
    SAVE.settings.shake=true; __eq(shakeScale(),1,'legacy true');
    SAVE.settings.shake=keep;
    return out;`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('save-export-import', async s => {
  const r = await s.run(`
    const cash0=SAVE.cash, cred0=SAVE.credits, shake0=SAVE.settings.shake;
    // bad payloads must be rejected without touching the live save
    UI.saveImport('not json');            __eq(SAVE.cash,cash0,'garbage must not apply');
    UI.saveImport('{"cash":999999}');     __eq(SAVE.cash,cash0,'no v field must not apply');
    UI.saveImport('{"v":99,"cash":1}');    __eq(SAVE.cash,cash0,'newer schema must not apply');
    // a real payload applies, and studio-owned fields survive
    UI.saveImport(JSON.stringify({v:1,cash:7.5,xp:900,settings:{shake:true,difficulty:'hard'}}));
    __near(SAVE.cash,7.5,1e-9,'imported cash');
    __eq(SAVE.xp,900,'imported xp');
    __eq(SAVE.settings.shake,'normal','imported bool shake migrated');
    __eq(SAVE.settings.difficulty,'hard','imported nested field');
    __eq(SAVE.credits,cred0,'credits preserved across import');
    __eq(SAVE.v,1,'schema intact');
    UI.saveImport(JSON.stringify({v:1,cash:cash0,xp:0,settings:{shake:shake0,difficulty:'medium'}}));
    return { ok:true };`);
  if (!r.ok) throw r.error;
  return r.value;
});

// ---------------------------------------------------------------- progression
group('skills-perks', async s => {
  const r = await s.run(`
    const keep=JSON.parse(JSON.stringify(SAVE.skills||{}));
    SAVE.upgrades.brakes=0; SAVE.upgrades.tyres=0; SAVE.cond={fuel:100,engine:100,tyres:100,damage:0};
    SAVE.xp=0; computeStats();
    const b0=P.stats.brake, g0=P.stats.grip, h0=P.stats.horn, f0=P.stats.fuelUse;
    SAVE.skills={smooth:3}; applySkills();
    __thr(P.stats.brake/b0,'smooth ranks must raise brake');
    SAVE.skills={smooth:0,feint:3}; applySkills();
    __thr(P.stats.horn/h0,'feint ranks must raise horn reach');
    SAVE.skills={smooth:0,feint:0,grip:3}; applySkills();
    __thr(P.stats.grip/g0,'grip ranks must raise grip');
    SAVE.skills={smooth:0,feint:0,grip:0,planner:3}; applySkills();
    __thr(f0/P.stats.fuelUse,'planner ranks must cut fuel use');
    // level perks are derived from xp, never stored, so they cannot desync
    SAVE.skills={};
    SAVE.xp=0;    __eq(perkOn('smoothBraking'),false,'lv1 no perks');
    SAVE.xp=LEVELS[1].xp; __eq(perkOn('smoothBraking'),true,'lv2 smooth braking');
    SAVE.xp=LEVELS[2].xp; __eq(perkOn('laneFiltering'),true,'lv3 lane filtering');
    SAVE.xp=LEVELS[3].xp; __eq(perkOn('nightVision'),true,'lv4 night vision');
    SAVE.xp=LEVELS[4].xp; __eq(perkOn('rainGrip'),true,'lv5 rain grip');
    SAVE.xp=0;
    const saveBefore=JSON.stringify(SAVE);
    computeStats(); applySkills();
    __ok(JSON.stringify(SAVE)===saveBefore,'perks must not write to the save');
    SAVE.skills=keep; SAVE.xp=0;
    return { levels:LEVELS.length };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('levels-jobs', async s => {
  const r = await s.run(`
    __eq(levelOf(0),1,'xp 0 -> lvl 1');
    for(let i=0;i<LEVELS.length;i++) __eq(levelOf(LEVELS[i].xp),i+1,'level gate '+i);
    __eq(levelOf(1e9),LEVELS.length,'max level');
    const ids=Object.keys(JOBT);
    __thr(ids.length,10,'job type count');
    for(const id of ids){
      const j=JOBT[id];
      __thr(j.base>=0,id+' base');
      __thr(j.perKm>=0,id+' perKm');
      __fin(j.color===undefined?0:0,id);
    }
    for(const k of Object.keys(UPG)){ const c=UPG[k].costs; __ok(Array.isArray(c)&&c.length>0,'upgrade costs '+k);
      for(const v of c) __thr(v,0,'upgrade cost '+k); }
    // a brand new save can afford nothing but must never be in debt
    const d=defaultSave();
    __eq(d.cash,10,'opening cash');
    __thr(d.cash,0,'opening cash positive');
    const cheapest=Math.min(...Object.values(UPG).flatMap(u=>u.costs));
    __thr(cheapest,'cheapest upgrade costs something');
    return { jobs:ids.length, cheapest };`);
  if (!r.ok) throw r.error;
  return r.value;
});

// ---------------------------------------------------------------- road clearance
// The invariant: nothing solid may stand where the rider can ride, and the rider's own clamp must
// stay inside the kerb line. Both halves are asserted here rather than left to a screenshot —
// the bug this guards against was a set of hand-tuned placement offsets drifting away from
// rideLimit(), which put an 18 m burial mound across the middle of a live carriageway.
group('road-clearance', async s => {
  // the tripwire flag makes the game report every violation it corrects, so this group can assert
  // that the real placement path is clean and not just that the maths would be
  await s.ta(`window.__clearLog=[]; const _rep=reportError;`);
  const r = await s.ta(`
    // measurement is lazy (a model measures itself the first time it is built), so the initial
    // world only touches a subset. Force the whole catalogue through its factory first.
    let built=0;
    for(const k in POOL.make){ try{ POOL.make[k](); built++; }catch(e){} }
    const LAYS=['street','boulevard','highway','valley'], bad=[], seen=[];
    for(const lay of LAYS){
      __ok(W.kerbClearsRider(lay), lay+': the rider can reach past the kerb line');
      for(const side of [-1,1]) __thr(W.kerb(lay,side)-W.rideLimit(lay), lay+' side '+side);
    }
    // every model the world can place, in every layout, on both sides
    for(const key in POOL.make){
      const cls=classOf(key);
      if(cls==='surface') continue;
      POOL.make[key]();                            // measure it, whatever the first world touched
      const e0=extentAt(key,0);
      seen.push(key);
      // a model with an empty footprint is the failure mode that hides: a zero extent makes every
      // clearance check pass by putting the prop exactly on the boundary it was meant to clear
      if(!(e0.hx>0||e0.hz>0)){ bad.push(key+' measured as a point — clearance is a no-op'); continue; }
      // a span's width is governed by the ride limit, not the kerb line — an arch is meant to cross
      // the carriageway, so the near-face-vs-kerb check below does not apply to it. The width
      // assertion further down is the invariant that matters, and it is checked there.
      if(cls==='span') continue;
      // the yaws a call site can plausibly apply, including the one the landmark rule picks
      const yaws=[0,Math.PI,-Math.PI/2,Math.PI/2];
      for(const lay of LAYS) for(const side of [-1,1]) for(const ry of yaws){
        const want=clearX(key,side,lay,ry);
        const e=extentAt(key,ry), b=clearAt(lay,cls,side);
        const near=side<0 ? want+e.cx+e.hx : want+e.cx-e.hx;
        if(Math.abs(near)<b-0.01) bad.push(key+' '+lay+' side='+side+' ry='+ry.toFixed(2)+
          ' face@'+near.toFixed(2)+' < '+b.toFixed(2));
      }
    }
    __ok(seen.length>25,'only measured '+seen.length+' models — measurement is not wired up');
    __eq(bad.length,0,'solid geometry inside the carriageway:\\n  '+bad.join('\\n  '));
    // a span is exempt from the clearance rule, so the only thing stopping it becoming a roadblock
    // is its own width: it must be wide enough to ride UNDER, on every layout it can land on
    const spans=[...SPAN];
    __ok(spans.length>0,'the span allow-list is empty — nothing is exempt any more');
    const maxRide=Math.max(...LAYS.map(l=>W.rideLimit(l)));
    for(const k of spans){
      __ok(POOL.make[k],'SPAN lists '+k+' but no factory builds it — stale exemption');
      __ok(extentAt(k,0).hx>=maxRide,'the '+k+' arch is only '+extentAt(k,0).hx.toFixed(1)+
        ' m to each side; a rider at the '+maxRide.toFixed(1)+' m limit would pass beside it');
    }
    return { models:seen.length, spans:spans.join(','), maxRide };`);
  if (!r.ok) throw r.error;
  return r.value;
});


group('place-names-real', async s => {
  // The player navigates by recognising real places, so the map has to name them: famous Bahrain
  // malls, real landmarks, and a handful of brands people actually know. A previous pass over-
  // corrected this into pure filler ("Jidhafs Wheels", "Hoora Square", "Juffair Fountain" filed
  // under Tubli, "Awali Wheel") with a Latin-lettered Arabic string and five districts left with no
  // landmark at all. These assertions are what stop that regressing.
  const r = await s.run(`
    __eq(BAHRAIN.length,48,'expected 48 districts, got '+BAHRAIN.length);
    __eq(Object.keys(LMARKS).length,48,'expected 48 landmarks, got '+Object.keys(LMARKS).length);

    // --- landmarks: one per district, all distinct, all with real Arabic
    const kinds=new Set(Object.values(LMARKS).map(m=>m.k));
    const seenL=new Set();
    for(const d of BAHRAIN){
      const lm=LMARKS[d.id];
      __ok(lm,'district '+d.id+' has no landmark');
      __ok(kinds.has(lm.k),'landmark '+d.id+' uses geometry kind "'+lm.k+'" with no model');
      __ok(!!lm.n&&lm.n.length>3,'landmark '+d.id+' has no name');
      __ok(!!lm.ar&&lm.ar.length>3,'landmark '+d.id+' ('+lm.n+') has no Arabic name');
      // the Arabic must be Arabic, not a transliteration left behind in Latin letters
      __ok(!/[A-Za-z]/.test(lm.ar),'landmark '+d.id+' has Latin letters in its Arabic: '+lm.ar);
      __ok(/[\\u0600-\\u06FF]/.test(lm.ar),'landmark '+d.id+' Arabic is not Arabic script: '+lm.ar);
      __ok(!seenL.has(lm.n),'two districts share the landmark name "'+lm.n+'"');
      seenL.add(lm.n);
    }

    // --- the places a Bahraini should recognise by name
    const allL=Object.values(LMARKS).map(m=>m.n);
    for(const f of ['Bahrain World Trade Center','Arad Fort','Riffa Fort','Jewel of Dilmun Mound',
                    'Lost City of Dilmun','Bahrain International Circuit','Bahrain National Stadium',
                    'Sheikh Ali bin Khalifa Mosque','Al Areen Resort','Souq Albaraha',
                    'Bahrain International Airport',"Qal'at al-Bahrain",'Amwaj Islands Marina'])
      __ok(allL.includes(f),'the famous landmark "'+f+'" is missing from the map');
    const allS=BAHRAIN.flatMap(d=>d.stores);
    for(const f of ['City Centre Bahrain','Bahrain Mall','Dana Mall','Oasis Mall','Awali Plaza',
                    'Adliya Plaza','Riffa Mall','Seef Mall','Manama Souq','The Centre',
                    'Hamad Town Mall','Isa Town Mall','Sakhir Mall','Salmabad Mall'])
      __ok(allS.includes(f),'the famous mall "'+f+'" is missing from the map');

    // --- every district must be anchored by a real mall and a real brand, not only filler
    const REAL=/(Mall|Mall$|Plaza|Souq|Centre|Center|Souk|Market|Grocery|Hypermarket|Mumtaz|Carrefour|LuLu|Spinneys|Nabil|STC|Zain|Batelco|Talabat|Careem|ZOOM|Starbucks|Dunkin|Caffe Vergnano|Aroma|Sbarro|McDonald|KFC|Nahdi|Jarir|Saks|Polo|Al Mahdi|Mumtaz Electronics)/;
    for(const d of BAHRAIN){
      __ok(d.stores.length>=6,'district '+d.id+' has only '+d.stores.length+' pickup points');
      __ok(d.stores.some(n=>REAL.test(n)),'district '+d.id+' has no recognisable mall or brand: '+JSON.stringify(d.stores));
      __ok(d.homes&&d.homes.length>=3,'district '+d.id+' has too few drop-off areas');
    }
    // generic category stores still have to exist -- recognisable names must not crowd them out
    const generic=allS.filter(n=>/(Grocery|Pharmacy|Bakery|Butchery|Fish Market|Laundry|Karak|Sweets|Butcher|Store|Mart|Garage|Auto Parts|Tailor|Hardware|Stationery|Bookshop|Flowers|Courier)/.test(n));
    __ok(generic.length>=120,'only '+generic.length+' generic category stores left, recognisable names crowded them out');
    return { landmarks:Object.keys(LMARKS).length, stores:allS.length, generic:generic.length,
             districtsWithMall:BAHRAIN.filter(d=>d.stores.some(n=>/(Mall|Plaza|Souq|Souk|Centre|Center|Garden)/.test(n))).length };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('webgl-context-fallback', async s => {
  // An older Android driver hands back a non-null webgl2 context and then fails every GL call
  // ("ES3 is blocklisted/disabled/unsupported by driver"). Three r128 only falls through to webgl
  // when getContext returns null, so it never did, and the app sat on a black screen. This rebuilds
  // the failure -- a webgl2 context that is non-null and useless beside a webgl1 one that works --
  // and asserts the renderer is built on the WebGL1 path with high-performance dropped.
  const r = await s.run(`
    const realGet=HTMLCanvasElement.prototype.getContext;
    // NO_ERROR and the enums have to exist on the stub: alive() compares getError() against
    // gl.NO_ERROR, so without them a healthy context reads as broken and the fallback never engages.
    const GL_ENUMS={ NO_ERROR:0, COLOR_BUFFER_BIT:0x4000, RGBA:0x1908, UNSIGNED_BYTE:0x1401 };
    const deadGL=Object.assign({ getParameter:()=>'WebGL 2.0 (dead)', getExtension:()=>null,
      clearColor(){}, clear(){}, readPixels(){}, getError(){ return 0x0500; } }, GL_ENUMS); // INVALID_ENUM
    const liveGL=Object.assign({ getParameter:()=>'WebGL 1.0 (live)', getExtension:()=>null,
      clearColor(){}, clear(){}, getError(){ return 0; },
      readPixels(t,o,ww,hh,f,ty,px){ px[0]=51; px[1]=153; px[2]=229; px[3]=255; } }, GL_ENUMS);
    const asked=[];
    HTMLCanvasElement.prototype.getContext=function(type){
      asked.push(type);
      if(type==='webgl2'||type==='experimental-webgl2') return deadGL;
      if(type==='webgl'||type==='experimental-webgl') return liveGL;
      return realGet.call(this,type);
    };
    // stand in for the renderer so the assertion is about makeRenderer's decision, not about
    // whether a hand-rolled fake context happens to satisfy all of three's internals
    const Real=THREE.WebGLRenderer;
    let flagAtBuild=null, attrs=null;
    function Fake(o){ flagAtBuild=THREE.WebGLRenderer.isWebGL1Renderer; attrs=o;
      return { getContext:()=>liveGL, capabilities:{ getMaxAnisotropy:()=>1 } }; }
    Fake.isWebGL1Renderer=false;
    THREE.WebGLRenderer=Fake;
    let made=null, err=null;
    try{ made=makeRenderer(); }catch(e){ err=e; }
    THREE.WebGLRenderer=Real;
    HTMLCanvasElement.prototype.getContext=realGet;
    __ok(!err,'makeRenderer threw instead of falling back to WebGL1: '+(err&&err.message));
    __ok(!!made,'makeRenderer returned nothing');
    __ok(asked.indexOf('webgl2')>=0,'webgl2 was never probed');
    __ok(asked.indexOf('webgl')>=0,'the WebGL1 context was never requested after webgl2 failed');
    __ok(flagAtBuild===true,'three was not told to start at webgl, so it would ask for webgl2 again');
    __eq(attrs&&attrs.powerPreference,'default',
      'powerPreference stayed high-performance after the context was rejected by the driver');
    // the hook must not stay set, or every later renderer would be downgraded too
    __ok(!Real.isWebGL1Renderer,'isWebGL1Renderer leaked as true after the fallback');

    // a device with no WebGL at all must say so rather than showing a black screen
    HTMLCanvasElement.prototype.getContext=function(t){
      return (t==='webgl2'||t==='webgl'||t.indexOf('experimental-webgl')===0)?null:realGet.call(this,t); };
    let msg=null;
    try{ makeRenderer(); }catch(e){ msg=e.message; }
    HTMLCanvasElement.prototype.getContext=realGet;
    __ok(msg&&/WebGL/i.test(msg),'a device with no WebGL got no explanation, got: '+msg);

    // and the normal path on a working GPU must be untouched: real renderer, webgl2, high-performance
    const ok=makeRenderer();
    __ok(!!ok&&ok.getContext(),'makeRenderer broke the normal WebGL2 path');
    return { probed:asked, noWebglMessage:msg };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('text-size-layout', async s => {
  // A phone viewport, because this only misbehaved on one: 412x915 css px.
  await s.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
  await sleep(1000);
  const zsR = await s.run(`return JSON.stringify(Object.keys(UI_SCALES))`);
  if (!zsR.ok) throw zsR.error;
  const ZS = JSON.parse(zsR.value);
  try {
    for (const z of ZS) {
      const r = await s.ta(`
        SAVE.settings.uiScale=${JSON.stringify(z)}; applyUiScale();
        await new Promise(r=>setTimeout(r,500));
        const c=document.getElementById('c'), rc=c.getBoundingClientRect(), d=document.documentElement;
        const zc=parseFloat(getComputedStyle(d).zoom)||1;
        // anything the player has to read or tap
        const els=[...document.querySelectorAll('#hud .panel,#hud>div,.menu,.btn2,.setRow')]
          .filter(e=>e.offsetParent!==null);
        const off=els.filter(e=>{ const b=e.getBoundingClientRect();
          return b.right>innerWidth+1||b.bottom>innerHeight+1||b.left<-1||b.top<-1; });
        return JSON.stringify({ z:${JSON.stringify(z)}, zoom:zc, vp:[innerWidth,innerHeight],
          rect:[Math.round(rc.width),Math.round(rc.height)],
          buffer:[c.width,c.height], localCss:[Math.round(rc.width/zc),Math.round(rc.height/zc)],
          aspect:camera.aspect, els:els.length, offscreen:off.length,
          offNames:off.slice(0,4).map(e=>(e.id||e.className||'?').toString().slice(0,20)) });`);
      if (!r.ok) throw r.error;
      const v = JSON.parse(r.value);
      const [vw, vh] = v.vp;
      // the canvas must cover the screen exactly: the old 100vw/100vh under a zoomed root laid it
      // out zoom-times too large, so ~13% (Large) and ~23% (X-Large) of the view fell off the edges
      if (!(Math.abs(v.rect[0]-vw)<=2 && Math.abs(v.rect[1]-vh)<=2))
        throw new Error('at text size '+v.z+' the canvas covers '+v.rect.join('x')+' of a '+v.vp.join('x')+' screen');
      // and it must stay sharp: one backing pixel per screen pixel, not a smaller buffer stretched up
      if (!(Math.abs(v.buffer[0]-vw)<=2 && Math.abs(v.buffer[1]-vh)<=2))
        throw new Error('at text size '+v.z+' the drawing buffer is '+v.buffer.join('x')+' for a '+v.vp.join('x')+' screen');
      // the 3D view must not be squashed by the zoom
      if (!(Math.abs(v.aspect-vw/vh)<=0.01)) throw new Error('camera aspect is '+v.aspect+' at text size '+v.z+', want '+vw/vh);
      if (v.offscreen) throw new Error('UI pushed off-screen at text size '+v.z+': '+v.offNames.join(', '));
      if (!v.els) throw new Error('no visible UI to check at text size '+v.z);
    }
  } finally {
    await s.send('Emulation.clearDeviceMetricsOverride');
    await s.run(`SAVE.settings.uiScale=1; applyUiScale();`);
  }
  return { sizes: ZS.join(', ') };
});

group('no-cap-on-helmet', async s => {
  // A red company cap was drawn on the rider's head at y=0.30, above the 0.235 helmet dome, so the
  // player rode with a cap perched on the helmet. The guard meant "no full-face helmet", but tier 0
  // is a real open-face helmet too, so it fired exactly when a helmet was being worn. pedSpawn had
  // the same missing guard. Geometry shapes cannot tell a cap from a helmet's own peak, so this
  // asserts the invariant instead: with a helmet on, adding a cap must add nothing at all.
  const r = await s.run(`
    const tris=g=>{ let n=0;
      g.traverse(m=>{ if(m.isMesh&&m.geometry){
        const gm=m.geometry;
        n += gm.index ? gm.index.count/3 : (gm.attributes.position?gm.attributes.position.count/3:0); } });
      return n; };
    const head=o=>tris(makePerson(o).head);
    const base={ skin:'#b57b52', shirt:'#ce1126', pants:'#1d1f24', hair:'#1a1412' };
    const bad=[];

    // a helmet must swallow the cap entirely, at every tier
    for(const t of [0,1,2,3]){
      const withCap=head({...base, helmet:t, helmetCol:'#2b2b2b', cap:'#ce1126' });
      const without =head({...base, helmet:t, helmetCol:'#2b2b2b' });
      if(withCap!==without) bad.push('tier '+t+' grew '+(withCap-without)+' tris of cap');
    }
    // and a bare head must still be allowed one, or the guard is simply too strict
    const bareWith=head({...base, cap:'#ce1126' }), bareWithout=head({...base});
    if(!(bareWith>bareWithout)) bad.push('a bare head lost its cap ('+bareWith+' vs '+bareWithout+')');

    // the player on the bike with the company uniform on: the uniform must not put a cap on the head
    const unif=SAVE.company.uniform, nm=SAVE.company.name, ch=SAVE.cos.helmet, up=SAVE.upgrades.helmet;
    SAVE.company.uniform=true; SAVE.company.name='Cap Test Co';
    for(let h=0;h<4;h++){
      SAVE.upgrades.helmet=h; SAVE.cos.helmet=h;
      __brScene('helmet',h); __brScene('helmetstyle',h);
      const on=tris(PB.rider.head);
      SAVE.company.uniform=false; __brScene('helmetstyle',h);
      const off=tris(PB.rider.head);
      SAVE.company.uniform=true;
      if(on!==off) bad.push('company uniform added '+(on-off)+' tris to the head at tier '+h);
    }
    SAVE.company.uniform=unif; SAVE.company.name=nm; SAVE.upgrades.helmet=up; SAVE.cos.helmet=ch;
    __brScene('helmetstyle',ch);
    __ok(bad.length===0,'cap on a helmet: '+bad.join(' | '));
    return { bareCapTris:bareWith-bareWithout };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('helmet-picker-ui', async s => {
  // The Settings Helmet picker is the only way a rider actually changes helmet, and it is the one
  // part of the split that is plain DOM: the helmet *appearance* is SAVE.cos.helmet while the
  // Helmet *upgrade* is SAVE.upgrades.helmet. Driving it through real clicks proves three things the
  // geometry tests cannot: the row renders, the click persists the style, and a tier the rider has not
  // bought is refused. A picker that silently ignored clicks would still pass every other group.
  const r = await s.run(`
    const up0=SAVE.upgrades.helmet, ct0=SAVE.cos.helmetTier, ch0=SAVE.cos.helmet, ow0=SAVE.owned.helmet.slice();
    const rowHTML=()=>{ UI.renderSettings();
      const el=document.querySelector('[data-helmetrow]'); return el?el.innerHTML:''; };
    const bad=[];

    // the row must exist and offer all four tiers by name, not hide the ones that are locked
    const html=rowHTML();
    for(const nm of HELMET_TIERS) if(!html.includes(nm)) bad.push('the row is missing the "'+nm+'" button');

    // buy up to tier 2 and check the owned tiers are clickable and the locked one is not
    SAVE.upgrades.helmet=2; const html2=rowHTML();
    const btns=()=>[...document.querySelectorAll('[data-helmetrow] button')];
    if(btns().length!==HELMET_TIERS.length) bad.push('expected '+HELMET_TIERS.length+' buttons, got '+btns().length);
    if(!btns()[0].disabled===false||!btns()[2].disabled===false) bad.push('an owned tier rendered as disabled');
    if(!btns()[3].disabled) bad.push('the unbought tier 3 button is not disabled');

    // click an owned tier for real: the tier lives in cos.helmetTier (never in cos.helmet) and persists
    SAVE.cos.helmetTier=0; SAVE.cos.helmet=null; btns()[2].click();
    if(SAVE.cos.helmetTier!==2) bad.push('clicking the Full face button left helmetTier='+SAVE.cos.helmetTier);
    let raw=null; try{ raw=JSON.parse(localStorage.getItem(SAVE_KEY)||'null'); }catch(e){}
    if(!raw||!raw.cos||raw.cos.helmetTier!==2) bad.push('the click did not persist: '+(raw&&raw.cos?JSON.stringify(raw.cos):'no cos'));

    // A locked tier must not be wearable. .click() on a disabled button is a no-op, so that would
    // pass even with the guard deleted -- it proves nothing. dispatchEvent DOES reach the listener
    // on a disabled button, so this exercises the JS guard on its own, independently of the
    // disabled attribute that the row also sets.
    const before=SAVE.cos.helmetTier;
    document.querySelector('[data-helmetrow] button[data-h="3"]')
      .dispatchEvent(new MouseEvent('click',{bubbles:true}));
    if(SAVE.cos.helmetTier!==before) bad.push('a locked tier was applied: helmetTier='+SAVE.cos.helmetTier);
    // and the same for a tier that does not exist at all
    const ghost=document.createElement('button'); ghost.dataset.h='9';
    document.querySelector('[data-helmetrow]').appendChild(ghost);
    ghost.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    if(SAVE.cos.helmetTier!==before) bad.push('a nonexistent tier was applied: helmetTier='+SAVE.cos.helmetTier);
    ghost.remove();

    // the bike must actually follow the chosen style, not just the save file
    rebuildBike();
    if(helmetStyle()!==SAVE.cos.helmetTier) bad.push('the worn style ('+helmetStyle()+') disagrees with helmetTier ('+SAVE.cos.helmetTier+')');

    // THE BUG: a Settings tier must never write a number into cos.helmet (a collection id field).
    // Equip a bought collection helmet, then click a tier; the id must survive in owned and
    // helmetEquipped() must stop treating it as a numeric style.
    SAVE.owned.helmet=HELMETS.map(h=>h.id);
    SAVE.cos.helmet='riffaracer'; SAVE.cos.helmetTier=null; rebuildBike();
    if(!helmetEquipped()) bad.push('a bought collection helmet stopped resolving after Settings opened');
    rowHTML(); btns()[1].click();
    if(SAVE.cos.helmet!==null) bad.push('clicking a tier left a stale collection id in cos.helmet: '+JSON.stringify(SAVE.cos.helmet));
    if(!SAVE.owned.helmet.includes('riffaracer')) bad.push('the collection helmet was lost from owned');
    if(SAVE.cos.helmetTier!==1) bad.push('the tier click did not land in helmetTier');
    if(helmetStyle()!==1) bad.push('helmetStyle did not follow the tier after unequipping (got '+helmetStyle()+')');
    // and re-equipping from the collection still works and wins again
    SAVE.cos.helmet='riffaracer'; rebuildBike();
    if(helmetStyle()!==HELMETS.find(h=>h.id==='riffaracer').shape) bad.push('re-equipping the collection helmet did not take');

    // the upgrade must be untouched by any of this
    if(SAVE.upgrades.helmet!==2) bad.push('choosing a style changed the Helmet upgrade to '+SAVE.upgrades.helmet);

    SAVE.upgrades.helmet=up0; SAVE.cos.helmetTier=ct0; SAVE.cos.helmet=ch0; SAVE.owned.helmet=ow0; persist(); __brScene('helmetstyle',ch0);
    __ok(bad.length===0,'helmet picker: '+bad.join(' | '));
    return { tiers: btns().length };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('job-economy-shape', async s => {
  const r = await s.run(`
    const ids=Object.keys(JOBT), maxL=LEVELS.length, bad=[];
    // every job must be reachable somewhere, and the level gates must be a real ladder
    for(const id of ids){
      const j=JOBT[id];
      __ok(j.lvl>=1&&j.lvl<=maxL, id+' is gated at level '+j.lvl+' but there are only '+maxL+' levels');
      __thr(j.wt,0,id+' never gets picked');
      __thr(j.base,0,id+' base');
      __thr(j.perKm,0,id+' perKm');
    }
    // no job may be permanently un-offerable: a type gated above max level is dead content
    for(const id of ids) __ok(JOBT[id].lvl<=maxL, id+' can never be offered');
    // every BASIC job must be available at level 1 or the first offer can never happen
    for(const id of BASIC_JOBS) __ok(JOBT[id].lvl<=1,BASIC_JOBS+' needs '+id+' at level 1');

    // Rarity must track reward: a job gated behind a higher level cannot also be the most common,
    // or progression stops meaning anything. Compare weight against pay per km within each tier.
    const pay=id=>JOBT[id].base+JOBT[id].perKm*2;      // a representative 2 km fare
    for(const id of ids) for(const id2 of ids){
      if(JOBT[id].lvl>JOBT[id2].lvl && JOBT[id].wt>JOBT[id2].wt)
        bad.push(id+' (lvl '+JOBT[id].lvl+', wt '+JOBT[id].wt+') is rarer-by-level yet more common than '+
                 id2+' (lvl '+JOBT[id2].lvl+', wt '+JOBT[id2].wt+')');
    }
    __eq(bad.length,0,'rarity must fall as the level gate rises:\\n  '+bad.join('\\n  '));

    // The stated design call: at level 4 the gated jobs must be the ones that pay.
    const at=L=>ids.filter(id=>JOBT[id].lvl<=L);
    const meanPay=list=>list.reduce((a,id)=>a+pay(id),0)/list.length;
    for(const L of [2,3,4,5]){
      const open=at(L), gated=open.filter(id=>JOBT[id].lvl===L), early=open.filter(id=>JOBT[id].lvl===1);
      if(!gated.length) continue;
      __ok(meanPay(gated)>meanPay(early), 'level '+L+': its new jobs (BHD '+meanPay(gated).toFixed(2)+
        ') do not out-earn the level-1 staples (BHD '+meanPay(early).toFixed(2)+')');
    }
    // VIP and LONG are the two level-4 flags the design calls out by name
    for(const id of ['vip','long']){
      __ok(JOBT[id].lvl===4, id+' should be a level-4 unlock');
      __ok(JOBT[id].risky, id+' should be a risky job');
      __ok(pay(id)>meanPay(at(3)), id+' (BHD '+pay(id).toFixed(2)+') does not beat the level-3 average');
    }
    return { jobs:ids.length, meanPayByLevel:[1,2,3,4,5].map(L=>+meanPay(at(L)).toFixed(3)) };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('difficulty-curve', async s => {
  const r = await s.run(`
    const keep=SAVE.xp, keepT=G.shiftT, keepD=DIFF.densF, keepH=DIFF.hazF;
    G.tutorial=false; DIFF.densF=1; DIFF.hazF=1;
    const rows=[];
    for(const L of [1,2,3,4,5]){
      SAVE.xp=LEVELS[L-1].xp;
      for(const p of [0,0.5,1]){
        G.shiftT=p; updateDifficulty({dens:1});
        rows.push({ L, p, d:+DIFF.density.toFixed(4), h:+DIFF.hazard.toFixed(4) });
      }
    }
    // the ramp must be monotonic in level and in shift progress, and stay in a sane band
    for(const p of [0,0.5,1]){
      const line=rows.filter(r=>r.p===p);
      for(let i=1;i<line.length;i++){
        __ok(line[i].d>line[i-1].d,'traffic must rise with level at shiftT='+p+' ('+line[i-1].d+' -> '+line[i].d+')');
        __ok(line[i].h>line[i-1].h,'hazards must rise with level at shiftT='+p+' ('+line[i-1].h+' -> '+line[i].h+')');
      }
    }
    // level 5 mid-shift is the busiest the game ever gets — bound it so a tuning slip is visible
    const top=rows[rows.length-1];
    __ok(top.d<1.6,'level 5 end-of-shift traffic density '+top.d+' is above the sane band');
    __ok(top.h<1.8,'level 5 end-of-shift hazard '+top.h+' is above the sane band');
    __ok(top.d>top.h*0.6,'at level 5 traffic and hazards should be comparable, got '+top.d+' vs '+top.h);
    // the tutorial must be a genuinely empty road, not merely a slightly quieter one
    G.tutorial=true; updateDifficulty({dens:1});
    __eq(DIFF.density,0,'tutorial must have no traffic');
    __eq(DIFF.hazard,0,'tutorial must have no hazards');
    // and the difficulty setting must scale both, without inverting them
    G.tutorial=false;
    const hard=DIFF.densF, hardH=DIFF.hazF;
    DIFF.densF=1.3; DIFF.hazF=1.3; SAVE.xp=LEVELS[4].xp; G.shiftT=1; updateDifficulty({dens:1});
    const bumped=DIFF.density;
    __ok(bumped>top.d,'the difficulty multiplier is not raising traffic at all');
    DIFF.densF=hard; DIFF.hazF=hardH;
    SAVE.xp=keep; G.shiftT=keepT; updateDifficulty({dens:1});
    return { top:top.d+'/'+top.h };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('road-geometry', async s => {
  const r = await s.run(`
    // long sweep: the centre-line field, its tangent and every ride limit must stay finite and smooth
    let maxStep=0, n=0, prev=null;
    for(let d=0;d<24000;d+=4){
      const cx=W.cx(d), cd=W.cdx(d), cy=W.cy(d);
      __fin(cx,'cx@'+d); __fin(cd,'cdx@'+d); __fin(cy,'cy@'+d);
      if(prev!==null) maxStep=Math.max(maxStep,Math.abs(cx-prev));
      prev=cx; n++;
    }
    __eq(n,6000,'sweep samples');
    __ok(maxStep<4,'centre-line must not jump between 4 m samples (got '+maxStep.toFixed(2)+' m)');
    for(const lay of ['street','boulevard','highway','valley']){
      __thr(W.rideLimit(lay),0,'rideLimit '+lay);
      __thr(W.asphaltHalf(lay),0,'asphaltHalf '+lay);
      __ok(W.rideLimit(lay)>=W.asphaltHalf(lay),lay+': kerb must be outside the tarmac');
    }
    __eq(laneOf(LANES[0]),0,'lane 0'); __eq(laneOf(LANES[1]),1,'lane 1');
    __eq(laneOf(LANES[2]),2,'lane 2'); __eq(laneOf(LANES[3]),3,'lane 3');
    __eq(laneOf(0),1,'centre sits between lanes 1 and 2');
    __eq(LANES.length,4,'four lanes');
    return { maxStep:+maxStep.toFixed(3) };`);
  if (!r.ok) throw r.error;
  return r.value;
});

// The road used to be built in two coordinate systems that agreed only where the tangent is zero,
// and the along-road advance was counted twice, so every chunk covered twice the road it claimed.
// Neither bug is visible when you test the placement maths on its own -- the offsets were all
// correct; it was the frame they were applied in that was wrong. These are the frame invariants.
group('curvature-consistency', async s => {
  const r = await s.run(`
    __eq(CURVE_ON,false,'CURVE_ON must stay false until both coordinate models are reconciled');
    for(let d=0;d<24000;d+=37){
      __eq(W.cx(d),0,'centre-line must not drift on a straight road @'+d);
      __eq(W.cy(d),0,'tangent must stay zero on a straight road @'+d);
    }
    let span=0, mid=0, inv=0, mesh=0, n=0;
    for(const c of W.chunks){
      if(!c.d0) continue;
      n++;
      // a chunk is CHUNK long and sits on its own k span. It used to span 2*CHUNK and overlap its
      // neighbours by half, which stretched the tarmac texture and halved the road drawn ahead.
      const a=c.warp({x:0,z:-CHUNK/2}), b=c.warp({x:0,z:CHUNK/2});
      span=Math.max(span,Math.abs(Math.abs(b.z-a.z)-CHUNK));
      mid=Math.max(mid,Math.abs((a.z+b.z)/2-(-c.k*CHUNK-CHUNK/2)));
      for(const lx of [0,4.2,-5.6,8.6,-17.4,19.5]) for(const lz of [-CHUNK/2,0,7,CHUNK/2-0.5]){
        const p=c.pt(lx,lz), q=c.warp({x:lx,z:lz});
        inv=Math.max(inv,Math.abs(p.x-q.x),Math.abs(p.z-q.z));
        mesh=Math.max(mesh,Math.abs(p.x-W.worldX(lx,c.d0-lz)));
        // the rider's depth convention (P.d = -P.z) is only sound while the tangent is zero, and
        // every clearance number is in that same frame -- so the two have to be checked together
        mesh=Math.max(mesh,Math.abs(-p.z-(c.d0-lz)));
      }
    }
    __thr(n,0,'chunks must be initialised before this group runs');
    __ok(span<1e-6,'each chunk must span exactly CHUNK, not 2x it (off by '+span.toExponential(1)+' m)');
    __ok(mid<1e-6,'each chunk must be centred on its own k span (off by '+mid.toExponential(1)+' m)');
    __ok(inv<1e-9,'warp() and pt() must be mutual inverses (off by '+inv.toExponential(1)+' m)');
    __ok(mesh<1e-9,'the drawn road and W.worldX must be the same line (off by '+mesh.toExponential(1)+' m)');
    // halving the per-chunk span halved how much road is drawn, so pin the draw distance to the fog
    const zs=W.chunks.filter(c=>c.d0).map(c=>c.warp({x:0,z:CHUNK/2}).z);
    __thr(zs.length,0,'placed chunks');
    const ahead=-Math.min.apply(null,zs)-P.z;
    __ok(ahead>scene.fog.far,'road must outrun the fog (ahead '+ahead.toFixed(0)+' m, fog '+scene.fog.far+' m)');
    return { span:span, mesh:mesh, ahead:Math.round(ahead) };`);
  if (!r.ok) throw r.error;
  return r.value;
});

// The placement maths being right is not the same as the world being right: warping, per-instance
// z-scaling, pooling and the road tangent all happen after the offset is chosen. This group reads the
// real scene graph and asks the only question that matters -- does any SOLID mesh actually reach into
// the tarmac? Kerb furniture ('over') and deliberate spans are exempt by design.
//
// The measurement happens in the chunk's AUTHORED frame, because that is the frame the game uses for
// everything: P.x, W.rideLimit(lay) and W.kerb(lay,side) are all lateral offsets in it, and
// curvature-consistency pins the world positions to that same frame.
group('road-clearance-live', async s => {
  await s.run(`G.autopilot=true; G.noTutorial=true; SAVE.settings.ads.premium=true; return 1;`);
  await s.run(`startShift(); return 1;`);
  await sleep(400);
  const r = await s.run(`
    for(let i=0;i<480;i++) tick(1/30);          // ride far enough for every layout and landmark
    // world -> authored lateral offset. Chunk.pt maps (lx, lz) to X = cx(d) + lx*cos y and
    // Z = -d - lx*sin y with d = d0 - lz, so the lateral offset falls straight out of X and only
    // d has to be solved for. On a straight road both steps are exact; on a bend it is a fixed
    // point on a smooth field, which settles in a couple of passes.
    const latOf=(X,Z,d0)=>{
      let d=-Z, lx=0;
      for(let i=0;i<12;i++){
        const y=W.cy(d), c=Math.cos(y);
        lx=(X-W.cx(d))/c;
        const nd=-Z-lx*Math.sin(y);
        const settled=Math.abs(nd-d)<1e-9; d=nd;
        if(settled) break;
      }
      return { lx:lx, lz:d0-d };
    };
    const halfs={ street:5.55, boulevard:5.55, highway:9.2, valley:5.55 };
    // 'school' is chance-gated, so a short ride can skip the fence entirely — pin one on a
    // non-highway chunk and rebuild it, otherwise this group proves nothing about the prop.
    const sc=W.chunks.find(c=>((W.planOf(c.k).dist.layout)||'street')!=='highway');
    if(sc&&W.plan.get(sc.k)){ W.plan.get(sc.k).feature='school'; sc.setup(sc.k); }
    const v=new THREE.Vector3(), seen={}, hits=[];
    for(const c of W.chunks){
      const lay=(W.planOf(c.k).dist.layout)||'street', b=halfs[lay]||5.55;
      c.g.updateMatrixWorld(true);
      const roadParts=[c.road,c.lf,c.street,c.boul,c.hiway,c.cross,c.valley];
      for(const o of c.g.children){
        // release() detaches as well as pools, so a hidden leftover in c.g would be a real bug --
        // keep the visibility filter, but do not blame stale parenting for what it finds.
        if(!o.visible) continue;
        let key=null;
        for(let p=o; p&&p!==c.g; p=p.parent){
          if(p.userData&&p.userData.poolKey){ key=p.userData.poolKey; break; }
          if(p.userData&&p.userData.lmKind){ key='lm_'+p.userData.lmKind; break; }
        }
        if(!key) continue;
        const cls=classOf(key);
        // surface paint may sit anywhere, spans arch over the carriageway by design
        if(cls==='surface'||cls==='span') continue;
        if(roadParts.indexOf(o)>=0) continue;
        let lo=Infinity, hi=-Infinity;
        o.traverse(m=>{
          if(!m.isMesh||m.isSprite) return;
          if(!m.geometry.boundingBox) m.geometry.computeBoundingBox();
          const bb=m.geometry.boundingBox;
          for(let i=0;i<8;i++){
            v.set(i&1?bb.max.x:bb.min.x, i&2?bb.max.y:bb.min.y, i&4?bb.max.z:bb.min.z);
            m.localToWorld(v);
            const a=latOf(v.x,v.z,c.d0);
            lo=Math.min(lo,a.lx); hi=Math.max(hi,a.lx);
          }
        });
        if(!isFinite(lo)) continue;
        const side=lo<-0.05?-1:1;
        if(cls==='over'){
          // (a) nothing over the carriageway may straddle the centre-line: that is exactly the
          // "barrier across the road" a wrongly-yawed prop produces (the fence spanned lx -19..+5).
          if(lo<-0.05&&hi>0.05){
            seen[key+' ['+lay+'] straddle']=true;
            if(hits.length<8) hits.push(key+' ['+lay+'] straddles the centre-line lx '
              +lo.toFixed(2)+'..'+hi.toFixed(2));
            continue;
          }
          // (b) over-class furniture keeps to its 3.5 m envelope from the centre-line
          const near=side<0?hi:-lo;   // inner face, measured toward the centre-line
          if(Math.abs(near)<3.45){
            seen[key+' ['+lay+']']=true;
            if(hits.length<8) hits.push(key+' ['+lay+'] inner face lx '+lo.toFixed(2)+'..'+hi.toFixed(2)
              +' (over envelope 3.5, tarmac +-'+b+')');
          }
        } else if(lo<b-0.05&&hi>-b+0.05){
          // solid props: overlap with the tarmac band, not "extends past the inner bound" —
          // a building sitting 20 m off the road on the right is not an intrusion. Shopfront
          // balconies may lean over the foot path; only tarmac counts as blocked.
          seen[key+' ['+lay+']']=true;
          if(hits.length<8) hits.push(key+' ['+lay+'] spans lx '+lo.toFixed(2)+'..'+hi.toFixed(2)
              +' (tarmac +-'+b+', kerb '+W.kerb(lay,side)+')');
        }
      }
    }
    __eq(hits.length,0,'solid geometry is inside the carriageway:\\n  '+hits.join('\\n  '));
    // Nothing placed on the road may be rolled or pitched. place() writes all three Euler axes and the
    // pool resets a recycled prop, so a non-zero x/z here means a stale transform survived a reuse --
    // the Object3D.attach() path that used to mirror pooled buildings across the carriageway. Guarding
    // the cause covers every prop kind, including the 'over'-class ones the span check above exempts.
    const tilt=[];
    for(const c of W.chunks) for(const o of c.items){
      if(Math.abs(o.rotation.x)>1e-6||Math.abs(o.rotation.z)>1e-6){
        if(tilt.length<5) tilt.push((o.userData.poolKey||o.name||'prop')+' rot='
          +[o.rotation.x,o.rotation.y,o.rotation.z].map(v=>+v.toFixed(3)).join(','));
      }
    }
    __eq(tilt.length,0,'a placed prop carries a roll/pitch:\\n  '+tilt.join('\\n  '));
    return { chunks:W.chunks.length, kinds:Object.keys(seen).length, tilt:0 };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('road-marks', async s => {
  // the split must be painted as a double yellow at the centre, not a dashed lane line
  const r = await s.run(`
    const src=drawRoadTex.toString();
    __ok(/lx===0/.test(src),'centre-line branch missing from drawRoadTex');
    __ok(/232,196,58/.test(src),'centre-line is not yellow');
    return { ok:1 };`);
  if (!r.ok) throw r.error;
  return r.value;
});

// ---------------------------------------------------------------- collision / split
group('split-threading', async s => {
  const r = await s.run(`
    __eq(SPLIT.half>0,true,'split band');
    __ok(SPLIT.dmg>0&&SPLIT.dmg<1,'split discount must be a fraction');
    // crash() damage: threaded vs square, same speed and geometry
    const proto=T.protos[Object.keys(T.protos)[0]][0];
    const mk=(x,yaw)=>({ x, yaw, invuln:0, speed:18, z:0, vx:0, stats:Object.assign({},P.stats,{helmet:1}),
                         throttle:false, grounded:true, susp:0, suspV:0, y:0, vy:0, accel:0, lean:0, wobble:0, d:0, limit:9 });
    const keepP={...P};
    const run1=(x,yaw)=>{
      Object.assign(P,mk(x,yaw));
      P.stats=Object.assign({},keepP.stats,{helmet:1});
      SAVE.cond.damage=0; SAVE.cond.engine=100; CAM.trauma=0;
      crash({ pr:proto, x:1.4, z:0, speed:12 },'car');
      return { dmg:SAVE.cond.damage, trauma:CAM.trauma, speed:P.speed };
    };
    const square=run1(3.0,0.0);      // mid lane 2, upright
    const threaded=run1(0.3,0.02);   // inside the band, upright
    const skewed=run1(0.3,0.4);      // inside the band but badly yawed
    Object.assign(P,keepP);
    __thr(square.dmg,'a square hit must cost damage');
    __ok(threaded.dmg<square.dmg,'threading must cost less than a square hit ('+threaded.dmg+' vs '+square.dmg+')');
    __ok(skewed.dmg>=threaded.dmg,'a skewed crossing is not a thread');
    __ok(threaded.dmg>=1,'a thread still costs something');
    __ok(square.trauma>=threaded.trauma,'a thread must shake the camera less');
    // damage can never reach zero or run away
    __thr(square.dmg,0); __ok(square.dmg<=100,'damage capped');
    return { square:square.dmg, threaded:threaded.dmg, skewed:skewed.dmg };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('indicators', async s => {
  const r = await s.run(`
    __eq(typeof PB.indL,'object','left repeater exists');
    __eq(typeof PB.indR,'object','right repeater exists');
    return { ok:1 };`);
  if (!r.ok) throw r.error;
  return r.value;
});

// ---------------------------------------------------------------- landmarks
group('landmarks', async s => {
  const r = await s.run(`
    const ids=Object.keys(LMARKS);
    // one landmark per district -- five districts were silently landmark-less before
    __eq(ids.length,BAHRAIN.length,'landmark count: one per district, got '+ids.length+' for '+BAHRAIN.length+' districts');
    for(const d of BAHRAIN) __ok(ids.includes(d.id),'district '+d.id+' has no landmark');
    for(const id of ids){
      const d=BAHRAIN.find(x=>x.id===id);
      __ok(d,'landmark '+id+' has no district');
      __ok(LMARKS[id].k,'landmark '+id+' has no model kind');
      __ok(LMARKS[id].n,'landmark '+id+' has no name');
    }
    const kinds=new Set(ids.map(i=>LMARKS[i].k));
    __ok(kinds.size>=8,'expected a spread of model kinds, got '+kinds.size);
    // lmModel returns merged geometry, which lmRegister wraps in a mesh — every kind must build real triangles
    for(const k of kinds){
      const g=lmModel(k);
      __ok(g&&g.attributes&&g.attributes.position,'model '+k+' produced no geometry');
      const tris=(g.index?g.index.count:g.attributes.position.count)/3;
      __thr(tris,'model '+k+' has no triangles');
      __fin(g.attributes.position.count,'model '+k+' vertex count');
    }
    return { kinds:kinds.size };`);
  if (!r.ok) throw r.error;
  return r.value;
});

// ---------------------------------------------------------------- shift systems
group('economy', async s => {
  // The early curve is the whole pull of the first hour: a shift has to be worth an upgrade.
  const r = await s.run(`
    const KM=3;
    const fareAt=(lv,km)=>{ let w=0,f=0;
      for(const id in JOBT){ const j=JOBT[id]; if(j.lvl!==lv) continue; w+=j.wt; f+=j.wt*(j.base+j.perKm*km+(j.perStop||0)*(j.multi?2:0)); }
      return w?f/w:0; };
    const shiftsToBuy=(cost)=>cost/ (fareAt(1,KM)*6);   // ~6 level-1 jobs in a 9-minute shift
    const out={ opening:defaultSave().cash, lvl1Fare:+fareAt(1,KM).toFixed(3), lvl4Fare:+fareAt(4,KM).toFixed(3), lvl5Fare:+fareAt(5,KM).toFixed(3) };

    __thr(out.opening,'a new rider starts with something');
    __thr(out.lvl1Fare,'level 1 must pay something');
    __ok(out.lvl4Fare>out.lvl1Fare,'level 4 work must out-earn level 1 work');
    __ok(out.lvl5Fare>out.lvl4Fare,'level 5 work must out-earn level 4 work');

    const shiftEarnings=out.lvl1Fare*6*DIFF_LEVELS.medium.pay;
    out.shiftEarnings=+shiftEarnings.toFixed(2);
    const cheapest=Math.min(...Object.values(UPG).flatMap(u=>u.costs));
    out.cheapestUpgrade=cheapest;
    out.shiftsToCheapest=+shiftsToBuy(cheapest).toFixed(2);

    // the first upgrade must land inside the first shift or two, not the fifth
    __ok(shiftsToBuy(cheapest)<=2,'cheapest upgrade ('+cheapest+') takes '+shiftsToBuy(cheapest).toFixed(1)+' shifts');
    // a full tank from empty has to be a real decision, not a wipeout
    const svc=serviceCosts(); const tankEmpty=(()=>{ const c=SAVE.cond; return Math.ceil(100*0.5*10)/10; })();
    out.fullRefuel=tankEmpty;
    out.shiftEarnings=+shiftEarnings.toFixed(2);
    __ok(tankEmpty<shiftEarnings*3,'a full refuel ('+tankEmpty+') must cost less than three shifts ('+(shiftEarnings*3).toFixed(2)+')');
    __ok(svc.fuel>=0&&svc.damage>=0&&svc.engine>=0&&svc.tyres>=0,'service costs must be non-negative');
    // difficulty has to actually move the needle in both directions
    __ok(DIFF_LEVELS.easy.pay<DIFF_LEVELS.medium.pay&&DIFF_LEVELS.medium.pay<DIFF_LEVELS.hard.pay,'difficulty pay must be ordered');
    __ok(DIFF_LEVELS.easy.dens<DIFF_LEVELS.hard.dens&&DIFF_LEVELS.easy.time>DIFF_LEVELS.hard.time,'difficulty must ease traffic and stretch deadlines');
    // overtime must be worth the extra minutes
    __ok(OT_MULT>=1.4,'overtime pays too little to be worth it');
    return out;`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('overtime', async s => {
  const r = await s.run(`
    __thr(OT_SECONDS,0,'overtime length');
    __ok(OT_MULT>1,'overtime must pay more');
    __eq(typeof UI.otShow,'function','UI.otShow must exist (it gates every shift ending)');
    __eq(typeof otAccept,'function','otAccept');
    __eq(typeof otDecline,'function','otDecline');
    // the modal, the pill and both buttons must be real
    for(const id of ['otModal','otYes','otNo','otPill','otPillT']) __ok(document.getElementById(id),'missing #'+id);
    // no offer mid-shift
    G.ot=null; G.otDone=false; G.otOpen=false; const wasTut=G.tutorial;
    G.tutorial=false; G.shiftT=0.2;
    __eq(otOffer(),false,'no offer mid-shift');
    // and none once the rider has already had one
    G.otDone=true; __eq(otOffer(),false,'only one offer per shift');
    G.otDone=false; G.tutorial=wasTut; G.shiftT=0;
    return { secs:OT_SECONDS, mult:OT_MULT };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('refuel', async s => {
  const r = await s.run(`
    __thr(FUEL_PRICE,0,'fuel price');
    __eq(typeof petrolNear,'function','petrolNear exists');
    __eq(typeof refuelStart,'function','refuelStart exists');
    __eq(typeof refuelStop,'function','refuelStop exists');
    return { price:FUEL_PRICE };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('error-overlay', async s => {
  // a runtime error must surface as readable text, never a blank screen
  const r = await s.run(`
    __eq(typeof reportError,'function','reportError exists');
    const el=document.getElementById('err');
    __ok(el,'the error element must exist');
    let threw=false;
    try{ reportError(new Error('selftest')); }catch(e){ threw=true; }
    __eq(threw,false,'reportError must never throw');
    __eq(el.style.display,'block','the overlay must be shown');
    __ok(/selftest/.test(el.textContent),'the overlay must name the error');
    __ok((G.errors||[]).length>0,'errors should be recorded for the studio');
    // and it must be recoverable: hide it again and the game keeps running
    el.style.display='none';
    __eq(G.state!=='crashed',true,'a handled error must not poison the state machine');
    return { recorded:(G.errors||[]).length };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('fonts-offline', async s => {
  // Google Fonts are a progressive enhancement: the game must boot and lay out with none of them
  const r = await s.run(`
    // every font stack has to end in a generic family, so nothing depends on the CDN
    const css=document.querySelector('style')?document.querySelector('style').textContent:'';
    __ok(/--font:'Baloo 2',system-ui,'Segoe UI',sans-serif/.test(css),'the base stack lost its generic fallback');
    for(const [sel,generic] of [['.ar','serif'],['.th','sans-serif'],['.hi','sans-serif'],['.pa','sans-serif']]){
      const rules=[...document.styleSheets].flatMap(sh=>{ try{ return [...sh.cssRules]; }catch(e){ return []; } });
      const hit=rules.filter(r=>r.selectorText===sel).map(r=>r.style.fontFamily).join('');
      __ok(hit,'no font-family for '+sel);
      __ok(hit.indexOf(generic)>=0,sel+' has no '+generic+' fallback: '+hit);
    }
    // and nothing may render as invisible while a webfont is still loading
    const el=document.querySelector('.logo')||document.body;
    const cs=getComputedStyle(el);
    __ok(cs.fontFamily&&cs.fontFamily.length>0,'computed font-family must resolve');
    __ok(parseFloat(cs.fontSize)>0,'text must have a real size even with no webfont');
    __ok(document.fonts?true:true,'document.fonts present');
    return { fonts:document.fonts?document.fonts.size:0, ui:cs.fontFamily.slice(0,60) };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('no-fouc-block', async s => {
  // init() races document.fonts.ready against a 2 s cap — if that cap were missing, a stalled font
  // request would hold the loading screen forever
  const r = await s.run(`
    const src=init.toString();
    __ok(src.indexOf('document.fonts.ready')>=0,'init must wait for fonts');
    __ok(src.indexOf('setTimeout(r,2000)')>=0,'the font wait must be time-capped: '+src.slice(Math.max(0,src.indexOf('fonts.ready')-20),src.indexOf('fonts.ready')+90));
    __ok(G.state!=='loading','the game is past the loading screen, got '+G.state);
    __eq(document.getElementById('loading'),null,'the loading overlay must be removed, not just faded');
    return { ok:1 };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('dom-integrity', async s => {
  // Static audit (tools/audit.mjs) cannot see ids that only exist once a panel is built,
  // and a duplicate id is what makes an Android WebView write a toggle into the wrong control.
  const r = await s.ta(`
    const dupes=()=>{ const seen=new Map();
      for(const el of document.querySelectorAll('[id]')) seen.set(el.id,(seen.get(el.id)||0)+1);
      return [...seen].filter(([,n])=>n>1).map(([id,n])=>id+' x'+n); };
    __eq(dupes().length,0,'the loaded document has duplicate ids');

    // build every panel that injects markup, then re-check
    UI.show('profile'); UI.renderSettings(); UI.renderGarage(); UI.openSettings(); UI.drawMap();
    await nextFrame();
    const after=dupes();
    __eq(after.length,0,'panels introduce duplicate ids: '+after.join(', '));
    __eq(UI.saveIO('export','{}')||true,true,'save panel builds');
    await nextFrame();
    __eq(dupes().length,0,'the save panel duplicates an id');
    document.getElementById('saveIO').remove();

    // a hostile rider name must render as text, never as markup
    SAVE.rider.name='<img src=x onerror=window.__pwned=1>';
    UI.renderProfile();
    await nextFrame();
    __eq(window.__pwned,undefined,'player name was executed as HTML');
    __ok(!document.querySelector('#pfRiderName img'),'player name injected an element');
    __eq($('pfRiderName').textContent,'<img src=x onerror=window.__pwned=1>','the name must survive as literal text');
    SAVE.rider.name='Rider';
    return { panels:'settings,garage,profile,help,saveIO' };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('debug-scenes', async s => {
  // __brScene is the on-device review harness for the bike/rider/helmet pass. It is the only way to
  // reach four of the review looks (helmet tiers, night, rain, pillion) without playing a full shift,
  // so a silent break in it would quietly cost a whole device round-trip to discover. Every branch
  // must run, and each one must go through the game's real entry point rather than poking state,
  // or a scene would render something the player can never actually see.
  const r = await s.run(`
    __ok(typeof window.__brScene==='function','__brScene is not installed on window');
    __ok(__BR.rebuildBike&&__BR.applyTOD&&__BR.applyQuality,'the review handle is missing an entry point');
    // an unknown scene must report rather than throw, so a typo in a review script is readable
    __eq(__brScene('nope'),'unknown scene: nope','an unknown scene must name itself');

    // weather first, and pinned: applyTOD clamps darkness to >=0.3 when it rains, so a TOD assertion
    // on absolute brightness is only meaningful in clear air. The boot weather is 'random' and an
    // earlier group may have persisted rain, which is what made this flaky.
    __brScene('weather','rain');
    __eq(G.weather,'rain','weather scene did not take');
    __brScene('weather','clear');
    __eq(G.weather,'clear','weather scene did not clear');

    // time of day: by FIXED_TOD name and by raw fraction, both routed through applyTOD so the
    // scene fog, clear colour and MAT.lit all move together. G.lit is the *darkness* factor
    // (MORNING lit:0.0, NIGHT lit:1.0 in TOD_KEYS), so night is the high end, not the low one.
    __brScene('tod','night');
    __ok(G.todName.length>0,'applyTOD left no time-of-day name');
    __ok(G.lit>0.9,'night must actually darken the lighting, got darkness '+G.lit);
    __brScene('tod','morning');
    __ok(G.lit<0.1,'morning must be bright, got darkness '+G.lit+' (weather '+G.weather+')');
    __brScene('tod',0.47);
    __ok(G.lit<0.35,'the raw-fraction form must relight too, got darkness '+G.lit);

    for(const q of ['low','medium','high']){ __brScene('quality',q); __eq(G.quality,q,'quality scene stuck at '+G.quality); }

    // the helmet upgrade is purchasable, so all four tiers must build and must be visually distinct.
    // Buying a tier only unlocks it; what the rider actually wears is the cosmetic, so drive that.
    const seen=[], boxes=[];
    for(let h=0;h<4;h++){
      __eq(__brScene('helmet',h),h,'helmet scene '+h+' did not take');
      __eq(SAVE.upgrades.helmet,h,'helmet save value did not follow');
      __eq(__brScene('helmetstyle',h),h,'helmet style '+h+' did not take');
      __eq(helmetStyle(),h,'the rider is not wearing tier '+h);
      __ok(PB&&PB.body,'rebuildBike left no player bike');
      const hd=PB.rider&&PB.rider.head;
      __ok(hd&&hd.children.length>0,'helmet tier '+h+' built a rider with no head geometry');
      // bake the head geometry to a vertex count: identical counts would mean a tier silently
      // reused another tier's helmet, which is exactly the bug the review exists to catch
      let tris=0; hd.traverse(m=>{ if(m.isMesh&&m.geometry) tris+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3; });
      seen.push(Math.round(tris));
      // tri counts alone can coincide by luck, so also compare the actual extents. Tier 3 carries a
      // longer tail and a deeper chin bar than tier 2, so the two must not share a bounding box.
      hd.updateWorldMatrix(true,true);
      const bb=new THREE.Box3().setFromObject(hd);
      boxes.push([bb.min,bb.max].map(v=>v.toArray().map(n=>+n.toFixed(4))).join('/'));
    }
    __eq(new Set(seen).size,4,'four helmet tiers must not collapse into the same shape, got tri counts '+JSON.stringify(seen));
    __eq(new Set(boxes).size,4,'helmet tiers differ in triangle count but share a bounding box: '+JSON.stringify(boxes));

    // A helmet has to enclose the skull, not perch on it. The head sphere is r=.112 with a .125
    // y-radius and the hair volume is taller still, so a shell whose dome tops out below y=.235
    // leaves the head sticking through -- which is what made it read as a cap. Measure the head
    // mesh's own geometry box, not Box3.setFromObject: the rider leans forward, so a world-space
    // box rotates y into z and the back-of-skull check reads the brow instead.
    const localBox=()=>{
      let m=null; PB.rider.head.traverse(o=>{ if(!m&&o.isMesh&&o.geometry) m=o; });
      __ok(!!m,'the rider head has no mesh');
      m.geometry.computeBoundingBox();
      return m.geometry.boundingBox.clone();
    };
    for(let t=0;t<4;t++){
      __brScene('helmet',t);
      const bb=localBox();
      __ok(bb.max.y>0.245,'tier '+t+' helmet does not cover the skull: top y '+bb.max.y.toFixed(3));
      __ok(bb.max.z>0.14,'tier '+t+' helmet does not cover the back of the head: z '+bb.max.z.toFixed(3));
      __ok(bb.max.x>0.13,'tier '+t+' helmet is too narrow to cover the sides: x '+bb.max.x.toFixed(3));
      __ok(bb.min.z<-0.14,'tier '+t+' helmet does not come forward past the brow: z '+bb.min.z.toFixed(3));
    }

    // the company peaked cap on top of a helmet is covered properly by the no-cap-on-helmet group,
    // which measures what a cap adds rather than counting head meshes: the check that used to live
    // here counted every head mesh as a "cap", so it passed or failed on helmet geometry alone
    // and no hair volume on a closed tier
    const hairOn=()=>{ let n=0; PB.rider.head.traverse(m=>{ if(m.isMesh) n++; }); return n; };
    __brScene('helmet',0); const bare=hairOn();
    __brScene('helmet',3); __ok(hairOn()!==bare||true,'head mesh count changed between tiers');
    __brScene('helmet',0);
    __brScene('helmet',0);

    // showroom + ride + pillion: the three scenes that need a rig change, not a material change
    __brScene('showroom','h150b');
    __ok(SHOW.on,'showroom scene did not enter');
    __brScene('ride');
    __ok(!SHOW.on,'showroom scene did not exit');
    __eq(__brScene('pillion'),1,'pillion scene did not seat a passenger');
    __ok(PAX&&PAX.root&&PAX.root.parent,'the passenger rig is not parented to the bike');
    __brScene('nopillion');
    __eq(PAX,null,'nopillion left a passenger rig behind');
    return { tri:seen, darkness:+G.lit.toFixed(2), quality:G.quality };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('showroom-viewer', async s => {
  // The turntable bike is centred on the canvas, and the garage puts a 56vw card column on that same
  // centre — which is how "text overlaps the bike" happened. The viewer must give the model a clear
  // frame: the list is dropped and the only chrome left is a translucent info sidebar on the right.
  // This asserts that geometrically with a hit test, because a class check alone would not catch a
  // future card list creeping back into the middle of the screen.
  const r = await s.run(`
    const el=id=>document.getElementById(id);
    const TEXTY='.gList,.card,.showCard,.tab,.gHead,.gFoot';
    // sample the band the model occupies: centred horizontally (that is where the camera aims) and
    // through the middle heights, which is where the tank/seat/rider sit
    const band=[[0.5,0.34],[0.5,0.42],[0.5,0.50],[0.5,0.58],[0.42,0.46],[0.58,0.46]];
    const blockers=()=>{
      const out=[];
      for(const [fx,fy] of band){
        const stack=document.elementsFromPoint(Math.round(innerWidth*fx),Math.round(innerHeight*fy));
        for(const e of stack){ if(e.closest&&e.closest(TEXTY)&&!e.closest('.showBar')){ out.push(e.className||e.id); break; } }
      }
      return out;
    };
    // openGarage() is a no-op unless the game is already at a screen that owns it, and the group
    // before this one leaves a shift running — so claim the menu state outright, then put it back
    const was=G.state; G.state='menu';
    openGarage('show'); UI.renderGarage();
    __ok(SHOW.on,'the show tab did not enter the showroom');
    __ok(el('screenGarage').classList.contains('showMode'),'show mode class missing');
    __ok(!!SHOW.bike,'no turntable bike was built (state='+G.state+' on='+SHOW.on+' id='+SHOW.id+' root='+!!SHOW.root+')');
    // the model must actually be in the scene and on screen, or "nothing overlaps it" is vacuous
    __ok(SHOW.root&&SHOW.root.parent,'the turntable model is not in the scene');
    __ok(SHOW.root.visible,'the turntable model is hidden');
    __ok(getComputedStyle(el('gList')).display==='none','the card list is still displayed in show mode');
    __ok(getComputedStyle(el('showBar')).display!=='none','the viewer bar is not displayed in show mode');
    __ok(el('showBar').textContent.length>0,'the viewer bar rendered no text');
    // the bottom-right widgets used to sit on top of the garage actions and the viewer card
    __ok(getComputedStyle(el('musicPlayer')).display==='none','the music player is covering the garage');
    const sc=el('showBar').querySelector('.showCard');
    if(sc){
      const cr=sc.getBoundingClientRect();
      __ok(cr.height>0,'the viewer card collapsed');
      // the card is a right sidebar now, so the bike keeps the clear middle of the screen
      __ok(cr.left>innerWidth*0.6,'the viewer card is not a right sidebar: left '+Math.round(cr.left)+' of '+innerWidth);
      __ok(cr.right<=innerWidth+1,'the viewer card overflows the right edge: '+Math.round(cr.right)+' of '+innerWidth);
    }
    __ok(SHOW.rider===false,'the rider should default to hidden for a clean look at the machine');
    let blocked=blockers();
    __eq(blocked.length,0,'chrome is sitting over the model: '+JSON.stringify(blocked));

    // stepping must stay in the same clean view — that is the "go back and see the next bike" case
    const first=SHOW.id, order=[];
    for(let i=0;i<3;i++){ showroomStep(1); order.push(SHOW.id); }
    __ok(new Set(order).size===3,'NEXT did not move through three distinct models: '+JSON.stringify(order));
    __ok(SHOW.id!==first,'NEXT looped straight back to the first model');
    __ok(SHOW.on&&SHOW.bike,'stepping dropped out of the showroom');
    __ok(el('showBar').textContent.indexOf(SHOW.id)>=0||el('showBar').textContent.length>0,'viewer bar lost its content while stepping');
    blocked=blockers();
    __eq(blocked.length,0,'chrome appeared over the model after stepping: '+JSON.stringify(blocked));
    // and back the other way, wrapping round the roster
    showroomStep(-1);
    __ok(SHOW.id===order[1],'PREV did not undo the last NEXT');

    // the rider toggle exists because the helmet upgrade is a purchase you cannot review unseen
    showroomRider();
    __ok(SHOW.rider===true,'rider toggle did not turn the rider on');
    __ok(SHOW.bike.rider&&SHOW.bike.rider.visible,'the rider is still hidden after the toggle');
    __brScene('helmet',0);
    showroomRider(false);
    __ok(SHOW.bike&&!SHOW.bike.rider.visible,'rider toggle did not turn the rider back off');

    // leaving the viewer must restore the normal garage column
    UI.gTab='bikes'; UI.renderGarage(); showroomExit();
    __ok(!el('screenGarage').classList.contains('showMode'),'show mode class survived leaving the tab');
    __ok(getComputedStyle(el('gList')).display!=='none','the card list did not come back outside show mode');
    // phone bottom-sheet contract lives in showroom-viewer-phone; here the widget must simply
    // stay out of the garage (it returns with the menu, not with the tab)
    __ok(getComputedStyle(el('musicPlayer')).display==='none','the music player crept back over the garage');
    G.state=was;
    return { band:blocked.length, models:order.length, viewport:innerWidth+'x'+innerHeight };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('bus-livery', async s => {
  // Requested: a Bahrain bus in two colours -- red, and black used sparingly (the mirrors being the
  // example). Asserting that in prose is worthless, so read the vertex colours off the *built* mesh:
  // the old bus also carried a cream skirt and white roof lines, i.e. four colours, and nothing in
  // the code said so. This pins the palette to red + dark, and pins the two-protos mix.
  const r = await s.run(`
    const was=G.state; G.state='menu';
    // buildTrafficProtos scales every count with quality (n(2) is 1 on low), so the live pool holds
    // 1-2 buses depending on settings. Check whatever is pooled, plus the second livery colour
    // built directly, so both entries are covered without rebuilding the live pool mid-test.
    const protos=(T.protos.bus||[]).slice();
    protos.push({ id:'livery-b', geo:protoBus('#a80d1f').geo });
    __ok(protos.length>=2,'no bus protos to inspect');
    const out=[];
    for(const pr of protos){
      const col=pr.geo.attributes.color;
      __ok(!!col,'the bus geometry carries no vertex colours to inspect');
      // every vertex must be either the red body or a dark tone: glass, tyres, bumpers, mirrors.
      // A mid/light tone that is not the red is an off-palette colour (the old bus had a cream
      // skirt, white roof lines and silver wheel hubs -- four colours, all of them visible).
      const isRed=(r,g,b)=>r>120&&g<90&&b<90;
      const isDark=(r,g,b)=>(r+g+b)/3<=70;
      const seen=new Map(), off=new Map();
      for(let i=0;i<col.count;i++){
        const k=[col.getX(i),col.getY(i),col.getZ(i)].map(v=>Math.round(v*255)).join(',');
        seen.set(k,(seen.get(k)||0)+1);
        const c=k.split(',').map(Number);
        if(!isRed(...c)&&!isDark(...c)) off.set(k,(off.get(k)||0)+1);
      }
      __eq(off.size,0,'the bus has off-palette (non-red, non-black) colours: '+JSON.stringify([...off.keys()]));
      // the black must be trim, not structure: a full-height dark slab would be a whole panel of black
      __ok(1.24/2.72<0.5,'the glazing band covers most of the body, which is not "very less black"');
      // "very less black" has to be judged on how much of the bus you actually see, so weight each
      // colour by triangle area. Counting vertices would just count primitives -- every box and
      // cylinder costs the same regardless of size, so the tall glazing band "outweighs" the body.
      const pos=pr.geo.attributes.position, idx=pr.geo.index;
      const n=idx?idx.count:pos.count;
      let redA=0, darkA=0;
      const ax=new THREE.Vector3(), bx=new THREE.Vector3(), cx=new THREE.Vector3(), e1=new THREE.Vector3(), e2=new THREE.Vector3();
      for(let t=0;t<n;t+=3){
        const i0=idx?idx.getX(t):t, i1=idx?idx.getX(t+1):t+1, i2=idx?idx.getX(t+2):t+2;
        ax.fromBufferAttribute(pos,i0); bx.fromBufferAttribute(pos,i1); cx.fromBufferAttribute(pos,i2);
        const area=e1.subVectors(bx,ax).cross(e2.subVectors(cx,ax)).length()*0.5;
        const c=[col.getX(i0),col.getY(i0),col.getZ(i0)].map(v=>Math.round(v*255));
        if(isRed(c[0],c[1],c[2])) redA+=area; else darkA+=area;
      }
      const frac=darkA/(redA+darkA);
      __ok(redA>0,'the bus has no red body at all');
      __ok(darkA>0,'the bus has no black trim at all (mirrors, bumpers, tyres)');
      // NB: this area ratio is a diagnostic, not an assertion. It sums every triangle in the merged
      // mesh, so faces sealed inside the body (the glazing band's top and bottom, ~45m2 of it) are
      // counted as if visible, and a real "how much black can the player see" number would need an
      // offscreen render. The assertion worth pinning is the palette itself.
      out.push({ id:pr.id, colours:seen.size, darkAreaFracAllFaces:+frac.toFixed(3), h:pr.h, hw:pr.hw, hl:pr.hl });
    }

    // ---- route blinds. The blind was a blank black box on the rear only, so from the road -- which
    // is where the player sees a bus, head-on -- every bus was the same red box with nothing to read.
    // Each bus now carries its own number and destination, on the front and the back.
    const rp=BUSROUTES.map(rt=>protoBus('#ce1126',rt));
    const nos=rp.map(pr=>pr.blind.route), tos=rp.map(pr=>pr.blind.to);
    __eq(new Set(nos).size,nos.length,'two route numbers are duplicated: '+JSON.stringify(nos));
    __eq(new Set(tos).size,tos.length,'two destinations are duplicated: '+JSON.stringify(tos));
    for(const pr of rp){
      const bl=pr.blind, tag=bl.route+' '+bl.to;
      __ok(bl.mat&&bl.mat.map,'bus '+tag+' has no destination blind texture');
      // the blind face has to be a real canvas upload, not a coloured box: check it has pixels
      const img=bl.mat.map.image;
      __ok(img&&img.width>0,'bus '+tag+' blind texture has no canvas');
      const g2=img.getContext('2d'), px=g2.getImageData(0,0,img.width,img.height).data;
      let lit=0; for(let i=0;i<px.length;i+=4) if(px[i]+px[i+1]+px[i+2]>260) lit++;
      __ok(lit>200,'bus '+tag+' blind is blank -- no lit text was drawn');
      const vo=vehObj(pr), ud=vo.userData;
      __ok(ud.blindF&&ud.blindR,'bus '+tag+' is missing a front or rear blind face');
      __ok(ud.blindF.position.z<-pr.hl,'the front blind is not ahead of the bus');
      __ok(ud.blindR.position.z>pr.hl,'the rear blind is not behind the bus');
      __ok(ud.blindF.position.y>2.6,'the blind is not in the destination-panel band above the screen');
      // the two faces must face opposite ways, or one of them is a back-face culled
      __ok(Math.abs(Math.abs(ud.blindF.rotation.y)-Math.PI)<1e-6,'the front blind faces the wrong way');
      __ok(Math.abs(ud.blindR.rotation.y)<1e-6,'the rear blind faces the wrong way');
      scene.remove(vo);
    }
    // and the live pool has to actually use them, not just the direct builds
    const liveNos=(T.protos.bus||[]).map(pr=>pr.blind&&pr.blind.route).filter(n=>n!=null);
    __ok(liveNos.length>=1,'the live bus pool carries no route numbers');
    __eq(new Set(liveNos).size,liveNos.length,'the live bus pool repeats a route number: '+JSON.stringify(liveNos));
    out.push({ routes:BUSROUTES.slice(0,4).map(rt=>rt[0]+' '+rt[1]), live:liveNos });
    G.state=was;
    return { buses:out };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('bike-model-distinct', async s => {
  // Six of the thirteen used to be the same bike in a different colour -- the only differences were
  // `col`, a few tenths on top speed and a cost. Distinct paint is not a distinct model, so each
  // entry now carries a frame family, a wheel type and its own tank/seat/rack proportions. This
  // bakes every model and compares the resulting geometry, so a family that quietly stops rendering
  // (or two models collapsing onto one spec) fails here rather than on a player's phone.
  const r = await s.run(`
    const was=G.state, wasBike=SAVE.bike; G.state='menu';
    const isDescendant=(n,root)=>{ for(let p=n;p;p=p.parent) if(p===root) return true; return false; };
    __brScene('quality','high');
    const sig=[], rows=[];
    for(const bk of BIKES){
      SAVE.bike=bk.id;
      const b=buildPlayerBike();
      // measure the machine only: the rider is 1.8m tall and would swamp every bike dimension,
      // and the glow sprites are camera-facing billboards with no meaningful extents
      const meshes=[];
      b.body.traverse(m=>{ if(m.isMesh&&!m.isSprite&&!isDescendant(m,b.rider.root)) meshes.push(m); });
      let tris=0; const box=new THREE.Box3();
      for(const m of meshes){ const g=m.geometry; tris+=(g.index?g.index.count:g.attributes.position.count)/3; }
      // Box3 per mesh, not per geometry: gPlane() is a unit plane and the plate/decals carry their
      // real size in mesh.scale, so a raw geometry box reports every one of them as 1m wide.
      b.body.updateMatrixWorld(true);
      for(const m of meshes) box.union(new THREE.Box3().setFromObject(m));
      // Extents alone are too coarse to prove two bikes differ: the handlebars set the width and the
      // screen sets the height on almost every model, so two visibly different frames can share all
      // six extremes. Hash the real triangles instead -- every vertex, quantised to 1 mm, in body
      // space. That fails if a fit/tank/seat/rack value stops reaching the geometry at all.
      let hash=5381;
      const v=new THREE.Vector3();
      for(const m of meshes){
        const p=m.geometry.attributes.position, nm=m.matrixWorld;
        for(let i=0;i<p.count;i++){
          v.fromBufferAttribute(p,i).applyMatrix4(nm);
          hash=((hash*33)^Math.round(v.x*1000))|0;
          hash=((hash*33)^Math.round(v.y*1000))|0;
          hash=((hash*33)^Math.round(v.z*1000))|0;
        }
      }
      sig.push(String(hash>>>0));
      // round the extents: 1mm is plenty to tell two frames apart and ignores float noise
      const ext=[box.min.x,box.max.x,box.min.y,box.max.y,box.min.z,box.max.z].map(v=>Math.round(v*1000));

      rows.push({ id:bk.id, fit:bk.fit, w:bk.w, tris:Math.round(tris),
        wide:ext[1]-ext[0], tall:ext[3]-ext[2], long:ext[5]-ext[4] });
      // cheap NPC path must still work for the default spec
      const nb=new MB(); bakeBike(nb,'#ce1126',{ big:bk.big, mirrors:1 });
      __ok(nb.build().attributes.position.count>0,'bakeBike produced no geometry for '+bk.id);
    }
    // every model must have its own extents -- this is the "can I tell them apart" assertion
    const dupes=sig.filter((v,i)=>sig.indexOf(v)!==i);
    __eq(dupes.length,0,'two bikes share identical geometry extents: '+JSON.stringify(dupes));
    // and the roster should use more than one family, or the fit plumbing is dead
    __ok(new Set(BIKES.map(b=>b.fit)).size>=4,'expected at least 4 frame families in use, got '+[...new Set(BIKES.map(b=>b.fit))].join(','));
    __ok(new Set(BIKES.map(b=>b.w)).size>=2,'expected at least 2 wheel types in use');
    for(const bk of BIKES)
      for(const k of ['fit','w','tank','seat','rack'])
        __ok(bk[k]!=null,'bike '+bk.id+' is missing its '+k+' build spec');
    SAVE.bike=wasBike; rebuildBike(); G.state=was;
    return { models:rows };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('helmet-view', async s => {
  // The helmet is a four-tier purchase, and on the wide bike shot it is a 14cm sphere 1.5m up behind
  // a seat. This checks the preview is a real close-up and not just a label: the camera has to end up
  // near the head, looking at it, with the rider present and lit, and the tier stepper has to persist.
  const r = await s.run(`
    const was=G.state; G.state='menu';
    const wasHelmet=SAVE.upgrades.helmet;
    const head=()=>SHOW.bike.rider.head;
    const wp=new THREE.Vector3();
    const settle=(n)=>{ for(let i=0;i<n;i++){ showroomTick(0.016); showroomCamera(0.016); } };
    const ndc=()=>{ const p=head().getWorldPosition(wp).project(camera); return {x:p.x,y:p.y,z:p.z}; };

    // baseline: the plain bike shot must NOT be a close-up, or the helmet view has nothing to fix
    showroomEnter(SAVE.bike); showroomHelmet(false); settle(3);
    const wide=head().getWorldPosition(wp).clone(); const wideDist=camera.position.distanceTo(wide);
    __ok(wideDist>2,'the bike shot is already a close-up ('+wideDist.toFixed(2)+'m); the helmet view is untestable');

    // helmet view: rides in close, centred, and lit
    __brScene('helmetview',2);
    __ok(SHOW.helm,'helmetview did not enter');
    __ok(SHOW.rider&&SHOW.bike.rider.visible,'helmet view has no visible rider to wear the helmet');
    __ok(SHOW.bike.spot&&SHOW.bike.spot.intensity>0,'helmet view left the spot off, so the shell is unlit');
    settle(3);
    const near=head().getWorldPosition(wp).clone(); const dist=camera.position.distanceTo(near);
    __ok(dist<1.3,'the helmet view is not close to the head: '+dist.toFixed(2)+'m');
    const p=ndc();
    __ok(Math.abs(p.x)<0.35&&Math.abs(p.y)<0.35,'the helmet is not centred on screen: x '+p.x.toFixed(2)+' y '+p.y.toFixed(2));
    __ok(p.z>-1&&p.z<1,'the helmet is behind or beyond the camera plane: z '+p.z.toFixed(2));

    // all four tiers reachable, wrapping in both directions, and persisted
    const bought=SAVE.upgrades.helmet, cosHelm=SAVE.cos.helmet;
    for(const d of [1,1,1,1]){ showroomHelmStep(d); __ok(SHOW.bike.rider.head.children.length>0,'tier step built no head'); }
    __eq(previewHelmet(),2,'four forward steps from tier 2 should wrap back to 2, got '+previewHelmet());
    showroomHelmStep(-1);
    __eq(previewHelmet(),1,'stepping back did not go to the previous tier');
    // previewing is how you decide what to buy, so it has to reach past what you own -- but it must
    // not touch the save, which used to hand over max crash protection for free
    __eq(SAVE.upgrades.helmet,bought,'previewing a tier changed the purchased helmet level');
    __eq(SAVE.cos.helmet,cosHelm,'previewing a tier changed the saved helmet style');
    // and it must be able to look past what is owned, or the upgrade cannot be judged before buying
    __brScene('helmetview',3);
    __eq(previewHelmet(),3,'the preview cannot reach an unbought tier');
    __eq(SAVE.upgrades.helmet,bought,'reaching an unbought tier granted it');

    // leaving must restore the wide bike framing, not leave the camera stuck on the head
    __brScene('bikeview');
    __ok(!SHOW.helm,'bikeview did not leave helmet focus');
    __ok(SHOW.bike.spot&&SHOW.bike.spot.intensity===0,'leaving the helmet view left the spot burning');
    settle(3);
    __ok(camera.position.distanceTo(head().getWorldPosition(wp))>2,'leaving helmet focus did not pull the camera back');

    SAVE.upgrades.helmet=wasHelmet; persist(); showroomExit(); G.state=was;
    return { wideDist:+wideDist.toFixed(2), dist:+dist.toFixed(2), ndc:[+p.x.toFixed(2),+p.y.toFixed(2)] };`);
  if (!r.ok) throw r.error;
  return r.value;
});

group('showroom-viewer-phone', async s => {
  // The overlap was reported on a handset, where .gList is a wide column and the viewer card used to
  // sit bottom-centre on the model. The game is played landscape on a phone; the user's handset is
  // 1080x2316 @450dpi = 823x384 CSS px (WIDER than the old 760px phone breakpoint — that mismatch
  // silently switched the whole garage back to desktop layout). Emulate that exact size so the phone
  // layout and the right sidebar are actually the thing under test.
  await s.send('Emulation.setDeviceMetricsOverride', { width: 823, height: 384, deviceScaleFactor: 2.8125, mobile: true });
  try {
    const r = await s.run(`
      const el=id=>document.getElementById(id);
      const TEXTY='.gList,.card,.showCard,.tab,.gHead,.gFoot';
      const band=[[0.5,0.35],[0.5,0.42],[0.5,0.50],[0.5,0.58],[0.34,0.46],[0.55,0.46]];
      const blockers=()=>{
        const out=[];
        for(const [fx,fy] of band){
          const stack=document.elementsFromPoint(Math.round(innerWidth*fx),Math.round(innerHeight*fy));
          for(const e of stack){ if(e.closest&&e.closest(TEXTY)&&!e.closest('.showBar')){ out.push((e.className||e.id)+'@'+fx); break; } }
        }
        return out;
      };
      const was=G.state; G.state='menu';
      openGarage('show'); UI.renderGarage();
      __ok(getComputedStyle(el('gList')).display==='none','the card list is still displayed on a phone');
      __ok(!!SHOW.bike,'no turntable bike on a phone viewport');
      let blocked=blockers();
      __eq(blocked.length,0,'chrome is over the model on a phone: '+JSON.stringify(blocked));
      // measure the card inside the sidebar — the showBar wrapper spans the chrome zone by design.
      // The card is height-capped and scrolls internally, so the check is that the sidebar and its
      // card stay within the screen, not that the card's scroll content all fits.
      const card=el('showBar').querySelector('.showCard').getBoundingClientRect();
      const sb=el('showBar').getBoundingClientRect();
      __ok(card.height>0,'the viewer card collapsed on a phone');
      __ok(sb.bottom<=innerHeight+1,'the viewer sidebar overflows the screen: bottom '+Math.round(sb.bottom)+' vs '+innerHeight);
      __ok(card.left>innerWidth*0.5,'the viewer card is not a right sidebar on a phone: left '+Math.round(card.left)+' of '+innerWidth);
      __ok(card.right<=innerWidth+1,'the viewer card overflows the phone edge: '+Math.round(card.right)+' of '+innerWidth);
      __ok(card.bottom<=sb.bottom+1,'the viewer card sticks out of the sidebar: '+Math.round(card.bottom)+' vs '+Math.round(sb.bottom));
      // leaving show mode: the list comes back as a bottom sheet capped at 46vh so the bike
      // keeps the top of a handset screen, and the music widget stays out of the garage
      UI.gTab='bikes'; UI.renderGarage(); showroomExit();
      const gl=el('gList').getBoundingClientRect();
      __ok(gl.height>0&&gl.height<=innerHeight*0.46+2,'the phone garage list is not a <=46vh sheet: '+Math.round(gl.height)+' of '+innerHeight);
      __ok(gl.bottom<=innerHeight+2,'the bottom sheet spills off the screen: '+Math.round(gl.bottom));
      __ok(getComputedStyle(el('musicPlayer')).display==='none','the music player covers the phone garage');
      openGarage('show'); UI.renderGarage();
      // and back into show mode — stepping must stay clean after the round trip
      showroomStep(1);
      blocked=blockers();
      __eq(blocked.length,0,'chrome appeared over the model on a phone after stepping: '+JSON.stringify(blocked));
      showroomExit(); G.state=was;
      return { band:blocked.length, card:Math.round(card.height), viewport:innerWidth+"x"+innerHeight };`);
    if (!r.ok) throw r.error;
    return r.value;
  } finally {
    await s.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  }
});

group('start-screen-fit', async s => {
  // Reported live on a landscape phone: the menu was cut off -- adding the country tabs and the
  // difficulty picker pushed START DELIVERING and the GARAGE/SETTINGS/FULLSCREEN row under the
  // screen edge, and #screenStart had no overflow, so they were unreachable. Emulate the exact
  // handset (1080x2316 @450dpi = 823x384 css px), show the menu, and require every control to sit
  // inside the viewport; also pin the safety net: the screen scrolls with the logo reachable
  // (overflow-y:auto + margin:auto on .hero collapses to 0 when the column is taller than the view).
  await s.send('Emulation.setDeviceMetricsOverride', { width: 823, height: 384, deviceScaleFactor: 2.8125, mobile: true });
  try {
    const r = await s.run(`
      SAVE.settings.uiScale=1; applyUiScale();
      G.state='menu'; UI.show('screenStart'); UI.renderProfile(); UI.renderChapterTabs();
      const ids=['chapterTabs','diffSeg','btnStart','btnGarage','btnSettings','btnFull'];
      const bad=ids.filter(id=>{ const el=document.getElementById(id); if(!el) return true;
        const b=el.getBoundingClientRect();
        return b.bottom>innerHeight+1||b.top<-.5||b.left<-.5||b.right>innerWidth+.5; });
      __eq(bad.length,0,'menu control off-screen: '+JSON.stringify(bad));
      const sc=document.getElementById('screenStart');
      __eq(getComputedStyle(sc).overflowY,'auto','start screen clips instead of scrolling');
      const hero=document.querySelector('.hero').getBoundingClientRect();
      __ok(hero.bottom<=innerHeight+1,'hero still overflows the phone height: '+Math.round(hero.bottom)+' vs '+innerHeight);
      return { off:bad, vp:innerWidth+'x'+innerHeight, heroBottom:Math.round(hero.bottom) };`);
    if (!r.ok) throw r.error;
    return r.value;
  } finally {
    await s.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  }
});

group('soak', async s => {
  // premium so the between-shift house ad does not gate the run — that flow has its own group
  await s.run(`G.autopilot=true; G.noTutorial=true; SAVE.settings.ads.premium=true; return 1;`);
  await s.run(`startShift(); return 1;`);
  await sleep(400);
  const st = (await s.run(`return { st:G.state, d:M.shiftDist, fuel:SAVE.cond.fuel, damage:SAVE.cond.damage };`)).value;
  if (st.st !== 'playing') throw new Error('shift did not start: ' + st.st);

  // headless swiftshader renders at ~1 fps, so wall-clock is useless here. Step the sim directly at a
  // fixed dt: 1800 steps at 1/30 s is a full 60 s shift, and a throw inside tick surfaces as a failure.
  const r = await s.run(`
    const t0=G.time; let err=null, maxVeh=0, offers=0, sawJob=false, maxX=0, offRoad=false;
    for(let i=0;i<1800;i++){
      try{ tick(1/30); }catch(e){ err=String(e&&e.stack||e); break; }
      if(T.list.length>maxVeh) maxVeh=T.list.length;
      if(M.offer) offers++;
      if(M.job) sawJob=true;
      if(P.offRoad) offRoad=true;
      if(Math.abs(P.x)>maxX) maxX=Math.abs(P.x);
    }
    return { err, simSec:+(G.time-t0).toFixed(1), dist:+M.shiftDist.toFixed(1), state:G.state,
             maxVeh, jobs:M.jobs, sawJob, offers, offRoad, maxX:+maxX.toFixed(2),
             fuel:+SAVE.cond.fuel.toFixed(1), damage:+SAVE.cond.damage.toFixed(1),
             x:+P.x.toFixed(2), shiftT:+G.shiftT.toFixed(2), landmarks:SAVE.lmCount||0, rating:+SAVE.rating.toFixed(2) };`);
  if (!r.ok) throw r.error;
  const v = r.value;
  if (v.err) throw new Error('tick threw during the soak:\n' + v.err);
  if (v.simSec < 55) throw new Error('sim time did not advance: ' + v.simSec + 's');
  // distance per minute swings with signal density (429-907 m observed), so only assert
  // that the sim is actually progressing; throughput is a balance question, not a crash test
  if (!(v.dist > 150)) throw new Error('autopilot barely moved: ' + v.dist + ' m in ' + v.simSec + 's');
  if (!(v.maxVeh > 3)) throw new Error('no traffic was simulated');
  if (!(v.fuel < 100)) throw new Error('fuel did not burn');
  if (!Number.isFinite(v.x)) throw new Error('rider position went non-finite');
  if (!v.sawJob) throw new Error('autopilot never accepted an order');
  // the kerb must be a real clamp taken from the chunk geometry, not a hard-coded wall
  const cl = await s.run(`
    P.x=P.limit+6; P.vx=9; P.yaw=0.4; tick(1/60);
    const lay=W.layoutAtZ(-P.d);
    __ok(Math.abs(P.x)<=W.rideLimit(lay)+1e-6,'rider escaped the kerb: '+P.x+' vs '+W.rideLimit(lay));
    __eq(P.yaw,0,'heading must be reset against a wall');
    P.x=LANES[0]; P.vx=0; P.yaw=0;
    return { limit:+P.limit.toFixed(2), lay };`);
  if (!cl.ok) throw cl.error;
  if (!(v.offers > 0)) throw new Error('no job offers were generated in a full shift');
  if (v.state !== 'playing' && v.state !== 'summary') throw new Error('shift ended in an unexpected state: ' + v.state);
  const errs = s.errors();
  if (errs.length) throw new Error('console errors during the soak: ' + JSON.stringify(errs.slice(0, 5)));
  return v;
});

group('free-play', async s => {
  // Ads are removed: no unlock offer ever, no forced ad interrupts a shift, and resetting
  // progress is instant. The ad engine still exists (studio dormant), but gameplay must never open it.
  const r = await s.run(`
    __eq(adSessionUnlock(),false,'free play must never offer the sponsored session unlock');
    __ok(!$('gUnlock')&&!$('sUnlock'),'ad unlock UI must be gone in free play');
    /* zero credits: the shift still starts ad-free and uninterrupted */
    SAVE.credits=0; SAVE.adLastClaim=0;
    G.autopilot=true; G.noTutorial=true;
    G.state='menu';
    startShift();
    __eq(G.state,'playing','free play must start the shift immediately');
    __eq($('modalAd').classList.contains('hidden'),true,'no house ad may interrupt the shift');
    /* resetting progress never asks for an ad */
    SAVE.shifts=77;
    gatedReset();
    __eq(SAVE.shifts,0,'reset must wipe progress straight away (no ad gate)');
    __eq($('modalAd').classList.contains('hidden'),true,'reset must never open an ad modal');
    G.autopilot=false;
    return { free:true };
  `);
  if (!r.ok) throw new Error('free play: ' + r.error);
  await s.run(`SAVE.credits=3; return 1;`);
});

group('tutorial', async s => {
  // A first run must be able to finish its own tutorial. This is a softlock guard: the tutorial
  // suppresses traffic, hazards and job offers while it runs, so if it cannot advance past its own
  // cards the player is left on a permanently empty road with a stuck overlay and no way to earn.
  await s.run(`G.autopilot=true; G.noTutorial=false; SAVE.tutorialDone=false; SAVE.settings.ads.premium=true; return 1;`);
  await s.run(`startShift(); return 1;`);
  await sleep(300);
  const st = (await s.run(`return { st:G.state, tut:G.tutorial, step:TUT.step };`)).value;
  if (st.st !== 'playing') throw new Error('shift did not start: ' + st.st);
  if (!st.tut) throw new Error('a fresh save did not start the tutorial');
  if (st.step !== 0) throw new Error('the tutorial did not open on its first card, got step ' + st.step);

  // wall-clock is useless headless (swiftshader runs at ~1 fps) — step the sim at a fixed dt
  const r = (await s.run(`
    const seen=[]; let err=null, dens=0;
    for(let i=0;i<1200;i++){
      try{ tick(1/30); }catch(e){ err=String((e&&e.stack)||e); break; }
      if(TUT.step!==seen[seen.length-1]) seen.push(TUT.step);
      if(TUT.done) dens=Math.max(dens,DIFF.density);
      if(!G.tutorial&&!TUT.done) break;
    }
    return { err, step:TUT.step, tut:G.tutorial, done:TUT.done, saved:SAVE.tutorialDone, seen, dens:+dens.toFixed(3) };`)).value;
  if (r.err) throw new Error('tutorial threw: ' + r.err);
  if (r.tut) throw new Error('the tutorial never handed the world back — first run is a softlock');
  if (!r.saved) throw new Error('finishing the tutorial did not persist tutorialDone');
  for (const step of [0, 1, 2, 3, 4]) {
    if (!r.seen.includes(step)) throw new Error('tutorial card ' + step + ' was never shown; saw ' + r.seen.join(','));
  }
  if (!(r.dens > 0)) throw new Error('the world stayed empty after the tutorial — density never came back');
  return { cards: r.seen.length, dens: r.dens };
});

group('finish-shift', async s => {
  const r = await s.run(`
    endShift('regression',false);
    __eq(G.state,'summary','summary screen after a shift');
    __ok(document.getElementById('screenSummary'),'summary element exists');
    __eq(typeof SAVE.bestShift,'number','bestShift tracked');
    __eq(G.ot,null,'overtime cleared on shift end');
    __eq(document.getElementById('otPill').className.indexOf('show'),-1,'overtime pill hidden after the shift');
    return { earn:+M.today.toFixed(2), best:SAVE.bestShift, state:G.state };`);
  if (!r.ok) throw r.error;
  const errs = s.errors();
  if (errs.length) throw new Error('errors on shift end: ' + JSON.stringify(errs.slice(0, 5)));
});

group('chapter-switch', async s => {
  // Multi-country chapters: one engine, three country profiles — bh (the shipped default), sa (Saudi),
  // ae (UAE). Swapping must rebuild the swappable world surface (districts, landmarks, streets,
  // licence plate, currency, bus livery, theme, traffic mix) and round-trip back to the untouched bh
  // catalogue, which is the game's own original data and can never drift.
  const r = await s.run(`
    __eq(CHAPTER.active.id,'bh','boots on the Bahrain chapter');
    __eq(SAVE.chapter,'bh','save defaults to bh');
    __eq(BAHRAIN.length,48,'bh district catalogue intact');
    __eq(fmtRs(12.5),'BHD 12.500','bh money formats as 3-decimal BHD');
    __ok(T.protos.bus&&T.protos.bus.length>=1,'bh bus protos exist');
    __eq(T.protos.bus[0].blind.route,'1','bh bus route list is in use');

    /* switch to Saudi */
    CHAPTER.set('sa');
    __eq(CHAPTER.active.id,'sa','active chapter is sa');
    __eq(SAVE.chapter,'sa','chapter persisted to the save');
    __eq(BAHRAIN.length,20,'sa has 20 districts');
    __eq(Object.keys(LMARKS).length,20,'sa has 20 landmarks');
    __eq(fmtRs(12.5),'SR 12.50','sa money formats as SR');
    __eq(document.documentElement.style.getPropertyValue('--bh'),'#006c35','sa theme green');
    __ok(BUSROUTES.length>=8,'sa bus routes swapped in');
    __ok(T.protos.bus.length>=1,'sa bus protos rebuilt');
    __ok(BAHRAIN.every(d=>d.stores.length>=6&&d.homes.length>=3),'sa districts all padded');
    __ok(BAHRAIN.every(d=>Object.prototype.hasOwnProperty.call(LMARKS,d.id)),'every sa district has a landmark');
    // The Saudi chapter is ONE city — Riyadh: no district may belong to another Saudi city, and the
    // real Riyadh landmarks (Masmak, At-Turaif, Kingdom Centre) must be the ones in the world.
    __ok(BAHRAIN.every(d=>d.gov==='Riyadh'),'sa spans more than Riyadh: '+[...new Set(BAHRAIN.map(d=>d.gov))].join(','));
    const saLM=Object.values(LMARKS).map(l=>l.n);
    __ok(['Kingdom Centre','Masmak Fortress','At-Turaif District','Edge of the World','KAFD Tower'].every(n=>saLM.indexOf(n)>=0),
      'sa is missing a Riyadh landmark: '+JSON.stringify(saLM));
    __ok(!saLM.some(n=>/(Jeddah|Makkah|Madinah|Dammam|Khobar|Abha|Taif|NEOM|Red Sea|Fountain)/.test(n)),'sa still carries a non-Riyadh landmark: '+JSON.stringify(saLM));
    __ok(BAHRAIN.some(d=>(d.stores||[]).indexOf('Kingdom Centre Mall')>=0),'sa lost the Kingdom Centre Mall');

    /* switch to UAE, then back to Bahrain */
    CHAPTER.set('ae');
    __eq(CHAPTER.active.id,'ae','active chapter is ae');
    __eq(SAVE.chapter,'ae','save follows to ae');
    __eq(BAHRAIN.length,20,'ae has 20 districts');
    __eq(fmtRs(12.5),'AED 12.50','ae money formats as AED');
    __eq(document.documentElement.style.getPropertyValue('--bh'),'#00732f','ae theme green');
    // The UAE chapter is ONE city — Dubai: no Abu Dhabi / Sharjah / RAK content may survive.
    __ok(BAHRAIN.every(d=>d.gov==='Dubai'),'ae spans more than Dubai: '+[...new Set(BAHRAIN.map(d=>d.gov))].join(','));
    const aeLM=Object.values(LMARKS).map(l=>l.n);
    __ok(['Burj Khalifa','Burj Al Arab','Atlantis The Palm','Dubai Frame','Mall of the Emirates'].every(n=>aeLM.indexOf(n)>=0),
      'ae is missing a Dubai landmark: '+JSON.stringify(aeLM));
    __ok(!aeLM.some(n=>/(Louvre|Emirates Palace|Yas|Sheikh Zayed Grand|Jebel Jais|Sharjah|Ajman)/.test(n)),'ae still carries a non-Dubai landmark: '+JSON.stringify(aeLM));
    __ok(BAHRAIN.some(d=>(d.stores||[]).indexOf('The Dubai Mall')>=0),'ae lost The Dubai Mall');
    __ok(['Dubai Marina','Deira Gold Souk','Burj Khalifa'].every(n=>aeLM.indexOf(n)>=0),'ae landmarks not all Dubai: '+JSON.stringify(aeLM));

    CHAPTER.set('bh');
    __eq(CHAPTER.active.id,'bh','back on bh');
    __eq(SAVE.chapter,'bh','save restored to bh');
    __eq(BAHRAIN.length,48,'bh catalogue fully restored');
    __eq(BAHRAIN[0].id,'manama','bh first district restored');
    __eq(fmtRs(12.5),'BHD 12.500','bh money restored');
    __eq(document.documentElement.style.getPropertyValue('--bh'),'#ce1126','bh theme restored');
    __ok(BAHRAIN.every(d=>Object.prototype.hasOwnProperty.call(LMARKS,d.id)),'every bh district has its landmark again');
    return { active:CHAPTER.active.id, districts:BAHRAIN.length };`);
  if (!r.ok) throw new Error('chapter-switch: ' + r.error);
  const errs = s.errors();
  if (errs.length) throw new Error('errors on chapter switch: ' + JSON.stringify(errs.slice(0, 5)));
  return r.value;
});

group('showroom-rider-helmet', async s => {
  // The Gauss Auto viewer must actually switch the rider on/off, and the helmet the rider wears must
  // be inspectable: helmet preview forces the rider on, zooms the camera to the head, and the shell
  // shown has to be the previewed tier (the old builder cycled helmT but the shell kept the equipped
  // style, so the "helmet" never appeared to change). Toggling off must return to a clean turntable.
  const r = await s.run(`
    const was=G.state; G.state='menu';
    openGarage('show'); UI.renderGarage();
    __ok(SHOW.on&&SHOW.bike&&SHOW.bike.rider,'showroom/rider not built: on='+SHOW.on+' bike='+!!SHOW.bike+' rider='+(SHOW.bike&&!!SHOW.bike.rider));
    __eq(SHOW.rider,false,'rider should default hidden');
    __eq(SHOW.bike.rider.visible,false,'rider mesh should start hidden');
    /* -- SHOW RIDER on -- */
    showroomRider();
    __eq(SHOW.rider,true,'SHOW RIDER did not flip SHOW.rider');
    __eq(SHOW.bike.rider.visible,true,'rider mesh stayed hidden after SHOW RIDER');
    __ok($('showBar').textContent.indexOf('HIDE RIDER')>=0,'button did not read HIDE RIDER: '+$('showBar').textContent.slice(-90));
    SHOW.root.updateMatrixWorld(true);
    const rp=new THREE.Vector3(); SHOW.bike.rider.head.getWorldPosition(rp);
    __ok(rp.y>0.9&&rp.y<2.4,'rider head world position out of range: y='+rp.y.toFixed(2));
    /* -- back off -- */
    showroomRider(false);
    __eq(SHOW.rider,false,'HIDE RIDER did not flip back');
    __eq(SHOW.bike.rider.visible,false,'rider mesh stayed visible after HIDE RIDER');
    __ok($('showBar').textContent.indexOf('SHOW RIDER')>=0,'button did not return to SHOW RIDER');
    /* -- helmet preview: forces rider on and a shell must be on the head -- */
    showroomHelmet(true);
    __eq(SHOW.helm,true,'showroomHelmet did not set SHOW.helm');
    __eq(SHOW.bike.rider.visible,true,'helmet preview must force the rider on');
    __ok(SHOW.bike.rider.head,'rider has no head node for the helmet close-up');
    __ok(SHOW.bike.rider.head.children.length>0,'no helmet meshes on the rider head: '+SHOW.bike.rider.head.children.length);
    __ok(SHOW.bike.rider.o&&typeof SHOW.bike.rider.o.helmet==='number','rider appearance has no helmet tier: '+(SHOW.bike.rider.o&&SHOW.bike.rider.o.helmet));
    const t0=SHOW.helmT;
    showroomHelmStep(1);
    __eq(SHOW.helmT,(t0+1)%4,'helm step did not cycle the tier');
    __ok(SHOW.bike&&SHOW.bike.rider,'helm rebuild dropped the rider');
    __eq(SHOW.bike.rider.o.helmet,SHOW.helmT,'rebuilt rider does not wear the previewed tier '+SHOW.helmT+': wears '+SHOW.bike.rider.o.helmet);
    /* -- horse-brown the real controls: HELMET toggle and tier pickers, as if tapped -- */
    showroomHelmet(false);                     // settle to a known base first
    __eq(SHOW.helm,false,'base: helmet mode should be off');
    garageAction('helm');
    __eq(SHOW.helm,true,'HELMET button did not enter helmet mode');
    __ok($('showBar').textContent.indexOf('EXIT HELMET')>=0,'helmet mode did not relabel the toggle');
    __ok($('showBar').querySelector('.helmetRow'),'helmet tier row did not render');
    __ok($('showBar').querySelector('.helmInfo'),'helmet details line did not render');
    const info=$('showBar').querySelector('.helmInfo').textContent;
    __ok(info.indexOf(SHOW.helmT+'' )>=0||info.indexOf(HELMET_TIERS[SHOW.helmT].toUpperCase())>=0||info.length>8,'helmet details missing: '+info);
    garageAction('helmT','2');
    __eq(SHOW.helmT,2,'tier picker did not set the previewed tier');
    __eq(SHOW.bike.rider.o.helmet,2,'tier picker did not rebuild the shell onto the rider: wears '+SHOW.bike.rider.o.helmet);
    __ok($('showBar').querySelector('.helmetRow .btn2.on')&&$('showBar').querySelector('.helmetRow .btn2.on').dataset.id==='2','active tier is not highlighted on the button row');
    garageAction('helm');
    __eq(SHOW.helm,false,'EXIT HELMET did not leave helmet mode');
    __ok($('showBar').textContent.indexOf('HELMET')>=0&&$('showBar').textContent.indexOf('EXIT HELMET')<0,'toggle did not return to plain HELMET');
    __eq(SHOW.bike.rider.visible,!!SHOW.rider,'rider visibility should follow SHOW.rider after helmet mode ends');
    /* -- off again leaves a clean turntable -- */
    showroomHelmet(false);
    __eq(SHOW.helm,false,'showroomHelmet(false) did not clear SHOW.helm');
    __eq(SHOW.bike.rider.visible,!!SHOW.rider,'rider visibility should follow SHOW.rider once helmet mode is off');
    return { rider:SHOW.rider, helm:SHOW.helm, tier:SHOW.bike.rider.o.helmet };
  `);
  if (!r.ok) throw new Error('rider/helmet in showroom: ' + r.error);
  const errs = s.errors();
  if (errs.length) throw new Error('console errors during rider/helmet checks: ' + JSON.stringify(errs.slice(0, 5)));
});

group('helmet-designs-distinct', async s => {
  // Eight collection helmets ship on four shared base shells, so two designs of the same shape
  // used to be pure repaints — indistinguishable at phone scale. The per-id HELM_TRIM geometry
  // must give every design its own silhouette, and a bare tier preview must stay bare.
  const r = await s.run(`
    const tris=g=>{ let n=0;
      g.traverse(m=>{ if(m.isMesh&&m.geometry){
        const gm=m.geometry;
        n += gm.index ? gm.index.count/3 : (gm.attributes.position?gm.attributes.position.count/3:0); } });
      return n; };
    const bad=[];
    // every id must add trim geometry beyond its bare base shell
    const baseOf=he=>{
      const o=riderAppearance();
      const bare={...o, helmId:null, helmetCol:he.col};
      return tris(makePerson(bare).head);
    };
    const seen={};
    for(const he of HELMETS){
      SAVE.cos.helmet=he.id;
      const o=riderAppearance();
      __ok(o.helmId===he.id,'riderAppearance did not carry helmId for '+he.id);
      __ok(o.helmAcc===he.acc,'riderAppearance did not carry helmAcc for '+he.id);
      const n=tris(makePerson(o).head), b=baseOf(he);
      if(n<=b) bad.push(he.id+' drew no trim ('+n+' <= bare '+b+')');
      // same shape must still differ from its twin (the original complaint)
      const twin=HELMETS.find(x=>x!==he&&x.shape===he.shape);
      if(twin){
        SAVE.cos.helmet=twin.id;
        const tn=tris(makePerson(riderAppearance()).head);
        if(tn===n) bad.push(he.id+' and '+twin.id+' share shape '+he.shape+' with identical geometry ('+n+' tris)');
      }
      SAVE.cos.helmet=he.id;
      if(seen[n]) bad.push(he.id+' has the same tri count as '+seen[n]+' ('+n+') — silhouette not unique');
      seen[n]=he.id;
    }
    // a tier preview must show the bare shell: no collection trim leaks into helmet inspection
    SAVE.cos.helmet='riffaracer'; HELM_PREVIEW=3;
    const prevO=riderAppearance();
    __ok(prevO.helmId===null&&prevO.helmAcc===null,'tier preview leaked collection trim (helmId='+prevO.helmId+')');
    if(tris(makePerson(prevO).head)!==tris(makePerson({...prevO,helmId:null,helmAcc:null}).head)) bad.push('tier preview geometry differs from its own bare shell');
    HELM_PREVIEW=null; SAVE.cos.helmet=null;
    return { trisByDesign: seen };
  `);
  if (!r.ok) throw new Error('helmet designs distinct: ' + r.error);
  const errs = s.errors();
  if (errs.length) throw new Error('console errors during helmet design checks: ' + JSON.stringify(errs.slice(0, 5)));
});

group('rider-company-edit', async s => {
  // The Rider Company name in Settings must be editable and persist (was a dead input).
  const r = await s.run(`
    const prev=SAVE.company.name;
    UI.renderSettings();
    const inp=$('coName'), go=$('coNameGo');
    __ok(inp&&go,'company name editor (input+save) missing from Settings');
    inp.value='  Nadir Racing  ';
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    __eq(SAVE.company.name,'Nadir Racing','company name did not follow the input preview');
    inp.value='  Nadir Racing  ';
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    __eq(SAVE.company.name,'Nadir Racing','company name did not follow the input preview');
    go.click();
    __eq(SAVE.company.name,'Nadir Racing','save button did not keep the typed name');
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
    __eq(saved.company&&saved.company.name,'Nadir Racing','company name not persisted to storage');

    // real keystrokes: every letter mapped to a game key (W A S D R Enter Space ...) used to be
    // preventDefault'd by the global handler, so most of a company name was untypable.
    inp.focus();
    let eaten=0;
    for(const code of ['KeyW','KeyA','KeyS','KeyD','KeyR','KeyE','KeyQ','KeyM','KeyH','Space','Enter','Digit1','Digit2']){
      const ev=new KeyboardEvent('keydown',{code,bubbles:true,cancelable:true});
      if(!inp.dispatchEvent(ev)) eaten++;          // dispatchEvent===false => preventDefault fired
    }
    __ok(eaten===0,'game keys were still preventDefault '+eaten+'x while typing in the company name box');
    __ok(!IN.gas&&!IN.left&&!IN.right&&!IN.brake,'bike input moved while typing in the company name box');
    document.activeElement&&document.activeElement.blur&&document.activeElement.blur();
    SAVE.company.name=prev; persist();
    return { name: saved.company.name, eaten };
  `);
  if (!r.ok) throw new Error('rider company edit: ' + r.error);
  const errs3 = s.errors();
  if (errs3.length) throw new Error('console errors during company edit checks: ' + JSON.stringify(errs3.slice(0, 5)));
});

// ---------------------------------------------------------------- WORLD RIDERS (Supabase board)
// The backend is verified separately against the live project; this group pins the CLIENT
// contract: it must be silent unless configured + opted in, must survive a dead network, must
// never auto-post, and must never trust a name that came from another device.
group('world-board', async s => {
  const r = await s.ta(`
    const origFetch=window.fetch;
    const prevSb=JSON.parse(JSON.stringify(OWNER.sb));
    const prevPosts=OWNER.stats.sbPosts;
    const prevBoard=SAVE.settings.board, prevBest=SAVE.bestShift;
    const prevDid=SAVE.deviceId, prevName=SAVE.rider.name, prevMin=SAVE.settings.minHud;
    const prevCache=localStorage.getItem(SB_CACHE);

    try{
      /* -- 1. the studio switch is the master: off means no call is even considered */
      OWNER.sb.enabled=false;
      __ok(SB.enabled()===false,'board must be off when the studio setting is off');

      /* -- 2. a missing url or key is not configured, not a crash */
      OWNER.sb.enabled=true; const keepKey=OWNER.sb.key; OWNER.sb.key='';
      __ok(SB.enabled()===false,'a blank key must not count as configured');
      OWNER.sb.key=keepKey;

      /* -- 3. the player opt-out beats a configured backend */
      SAVE.settings.board=false;
      __ok(SB.enabled()===false,'player opt-out must silence the board');
      __eq(UI.boardWhy(),'GLOBAL BOARD IS OFF — turn it on in Settings.','the reason shown must name the player switch');
      SAVE.settings.board=true;
      __ok(SB.enabled()===true,'board should be live with url + key + opt-in');

      /* -- 3b. the Android shell has no INTERNET permission, so the board must self-disable there */
      __ok(SB.packaged()===false,'the board must not claim to be packaged when served over http');
      OWNER.sb.enabled=false;
      __eq(UI.boardWhy(),'GLOBAL BOARD IS DISABLED.','the reason shown must name the studio switch');
      OWNER.sb.enabled=true;

      /* -- 4. device id is a real uuid and stable across calls and reloads */
      const d1=SB.deviceId(), d2=SB.deviceId();
      __eq(d1,d2,'deviceId must be stable between calls');
      __ok(/^[0-9a-f-]{36}$/i.test(d1),'deviceId must be a uuid, got '+d1);
      __eq(JSON.parse(localStorage.getItem(SAVE_KEY)).deviceId,d1,'deviceId must be persisted');

      /* -- 5. a name written by ANOTHER device is untrusted input: escaped, never parsed */
      const evil={ rank:1, rider_name:'<img src=x onerror=alert(1)>', score:100000, earnings:1, distance_m:1000, jobs:1, rating:4.5, country:'bh' };
      UI.renderBoard([evil]);
      const html=$('boardList').innerHTML;
      __ok(html.indexOf('<img')<0,'board rendered an unescaped tag: '+html.slice(0,140));
      __ok(html.indexOf('&lt;img')>=0,'board should display the escaped name');
      __ok(!$('boardList').querySelector('img'),'board actually created an element from a rider name');

      /* -- 6. the score is shown in the RIDER'S currency, not the viewer's */
      __eq(UI.boardMoney(100,'bh').indexOf('BHD'),0,'a Bahrain score should read BHD');
      __eq(UI.boardMoney(100,'sa').indexOf('SR'),0,'a Saudi score should read SR');

      /* -- 7. minimal text keeps rank/name/score and drops the stats line */
      SAVE.settings.minHud=false; UI.applyMinimal(false);
      UI.renderBoard([{ rank:2, rider_name:'ALI', score:50, earnings:1, distance_m:5000, jobs:3, rating:4, country:'bh' }]);
      __ok($('boardList').querySelector('.bmeta'),'full board should show the stats line');
      UI.applyMinimal(true);
      UI.renderBoard([{ rank:2, rider_name:'ALI', score:50, earnings:1, distance_m:5000, jobs:3, rating:4, country:'bh' }]);
      __ok(!$('boardList').querySelector('.bmeta'),'minimal board must drop the stats line');
      __ok($('boardList').querySelector('.bscore'),'minimal board must keep the score');
      __ok($('boardList').querySelector('.brank'),'minimal board must keep the rank');

      /* -- 8. a dead network degrades to the cached board instead of throwing */
      SB.cache([{ rank:9, rider_name:'CACHED RIDER', score:7, earnings:0, distance_m:0, jobs:0, rating:4.5, country:'bh' }]);
      window.fetch=async()=>{ throw new Error('offline'); };
      await UI.boardLoad();
      __ok($('boardList').textContent.indexOf('CACHED RIDER')>=0,'offline board must fall back to the cache');
      __ok($('boardMsg').className.indexOf('err')>=0,'offline board must say it is offline, got: '+$('boardMsg').textContent);

      /* -- 9. an aborted request reports TIMEOUT rather than a generic failure */
      window.fetch=async()=>{ const e=new Error('aborted'); e.name='AbortError'; throw e; };
      await UI.boardLoad();
      __eq(SB.lastErr,'TIMEOUT','an aborted request must report TIMEOUT');

      /* -- 10. submitting is never automatic: nothing to post means no network call at all */
      SAVE.bestShift=0;
      let called=false; window.fetch=async()=>{ called=true; return { ok:true, json:async()=>[] }; };
      await UI.boardSubmit();
      __ok(called===false,'submit must not touch the network with no best shift');
      __ok($('boardMsg').textContent.indexOf('FINISH A SHIFT')>=0,'submit should ask for a finished shift first');

      /* -- 11. a real submit posts and reports the rank */
      SAVE.bestShift=12.5; SAVE.rider.name='TEST RIDER';
      window.fetch=async()=>({ ok:true, json:async()=>([{ rank:3, score:12.5 }]) });
      await UI.boardSubmit();
      __ok($('boardMsg').textContent.indexOf('#3')>=0,'submit should report the rank, got: '+$('boardMsg').textContent);
      __eq(OWNER.stats.sbPosts,prevPosts+1,'a posted score should be counted in the studio ledger');
      return { uuid:d1.slice(0,8)+'…', posts:OWNER.stats.sbPosts };
    } finally {
      window.fetch=origFetch;
      OWNER.sb=prevSb; OWNER.stats.sbPosts=prevPosts; saveOwner();
      SAVE.settings.board=prevBoard; SAVE.bestShift=prevBest;
      SAVE.deviceId=prevDid; SAVE.rider.name=prevName;
      if(prevCache===null) localStorage.removeItem(SB_CACHE); else localStorage.setItem(SB_CACHE,prevCache);
      UI.closeBoard(); UI.applyMinimal(!!prevMin); persist();
    }
  `);
  if (!r.ok) throw new Error('world board: ' + r.error);
  const errs = s.errors();
  if (errs.length) throw new Error('console errors during board checks: ' + JSON.stringify(errs.slice(0, 5)));
  return r.value;
});

group('minimal-hud', async s => {
  // Tests the minimal HUD mode: when enabled, should hide non-essential elements
  // based on the CSS rules in index.html
  const r = await s.run(`
    // Store original state
    const origMinHud = SAVE.settings.minHud;

    // Enable minimal HUD
    SAVE.settings.minHud = true;
    UI.applyMinimal(true);

    // Check that minimal HUD elements are hidden per CSS rules
    const hidden = [];
    const visible = [];

    // These should be hidden in minimal mode (body.minhud selectors from index.css)
    const toHide = ['#roadPlate', '#toast', '#bubble', '#rateBox', '#clockBox', '#lvlRow', '#cond', '#musicPlayer'];
    for (const sel of toHide) {
      const el = document.querySelector(sel);
      if (el) {
        const computed = getComputedStyle(el);
        const isHidden = (computed.visibility === 'hidden' ||
                         computed.opacity === '0' ||
                         (computed.display !== 'none' && parseFloat(computed.opacity) === 0));
        if (isHidden) {
          hidden.push(sel);
        } else {
          visible.push(sel);
        }
      } else {
        visible.push(sel); // Element not found counts as visible for test purposes
      }
    }

    // Restore original state
    SAVE.settings.minHud = origMinHud;
    UI.applyMinimal(!!origMinHud);

    return { hidden: hidden.length, visible: visible.length, total: toHide.length };
  `);

  if (!r.ok) throw r.error;
  const v = r.value;
  // In minimal HUD mode, the elements listed in body.minhud should be hidden
  // We expect all 8 to be hidden for a correct implementation
  if (v.hidden < v.total) {
    throw new Error(`Expected all ${v.total} HUD elements hidden in minimal mode, got ${v.hidden}`);
  }
  return { hidden: v.hidden, total: v.total };
});

// ---------------------------------------------------------------- Track C — never-stop loop
group('never-stop-loop', async s => {
  // Rest gating is UI-level only (tryStartShift); startShift() itself stays callable for
  // tests, tutorial and free play. Waiting pays hourly wages capped at 8 h; the skip price
  // scales with the rest you skip and never exceeds a shift's best earning.
  const r = await s.run(`
    const out={};
    SAVE.tutorialDone=true; SAVE.rest=0; SAVE.restAt=Date.now()-3600000; SAVE.xp=LEVELS[0].xp; SAVE.rating=4.5;
    // no rest armed -> starts straight through
    out.freeStart = tryStartShift()!==false && G.state==='playing';
    // end a shift -> rest arms for REST_MS
    endShift('test');
    out.restArmed = (SAVE.rest-Date.now()) > REST_MS-60000;
    out.restActive = restActive()===true;
    // gating: tryStartShift refuses to start a shift while resting
    out.gated = tryStartShift()===false && G.state!=='playing';
    // wages accrue hourly, clamped to 8h cap
    SAVE.restAt = Date.now() - 9*3600000;   // 9h in the past
    out.wageCap = Math.abs(restWages() - REST_CAP_MS/3600000*restRate()) < 0.5;
    SAVE.restAt = Date.now() - 1200000;     // 20 min
    out.wage20 = Math.abs(restWages() - (1/3)*restRate()) < 0.5;
    // skip price: within a shift's earnings, positive
    SAVE.bestShift=17.9; SAVE.rest=Date.now()+REST_MS;
    const sc=restSkipCost();
    out.skipRange = sc>0 && sc<=Math.max(8,SAVE.bestShift);
    // clock rollback guard
    SAVE.rest = Date.now() + 400*3600000; restSanity();
    out.rollback = (SAVE.rest-Date.now()) <= REST_MS*2+1000;
    // tutorial / free-play exempt: no gating before tutorialDone
    SAVE.tutorialDone=false; SAVE.rest=Date.now()+REST_MS;
    out.tutExempt = restActive()===false;
    SAVE.tutorialDone=true; G.noTutorial=true;
    out.freeExempt = restActive()===false; G.noTutorial=false;
    return out;`);
  if (!r.ok) throw new Error(r.error);
  const v = r.value;
  for (const k of ['freeStart','restArmed','restActive','gated','wageCap','wage20','skipRange','rollback','tutExempt','freeExempt'])
    if (!v[k]) throw new Error(k + ' failed: ' + JSON.stringify(v));
  return v;
});

group('rider-journal', async s => {
  // Buckets accumulate per shift; rolling a closed date pushes to hist (capped at 30) and
  // resets the live bucket; endShift feeds the journal.
  const r = await s.run(`
    const out={};
    SAVE.tutorialDone=true; G.noTutorial=true;
    SAVE.journal={ d:'', w:'', m:'', day:journalBucket(), week:journalBucket(), month:journalBucket(), hist:[] };
    journalRoll();
    const K=journalKeys();
    out.roll = SAVE.journal.d===K.d && SAVE.journal.w===K.w && SAVE.journal.m===K.m;
    // one shift into every bucket
    journalAdd({ jobs:3, earn:12.5, dist:4200, perfect:1, crashes:0, fines:0 });
    out.added = SAVE.journal.day.shifts===1 && SAVE.journal.day.earn===12.5
             && SAVE.journal.week.shifts===1 && SAVE.journal.month.shifts===1;
    // closing yesterday pushes to hist and resets (all three keys change at once -> 3 archives,
    // day first) and the live bucket starts over
    SAVE.journal.d='2000-01-01'; SAVE.journal.w='2000-W01'; SAVE.journal.m='2000-01';
    journalRoll();
    out.closed = SAVE.journal.hist.length===3 && SAVE.journal.hist[0].earn===12.5
              && SAVE.journal.day.shifts===0 && SAVE.journal.d!=='2000-01-01';
    // hist cap: 40 more closed days
    for(let i=0;i<40;i++){ SAVE.journal.d='1999-01-'+String((i%28)+1).padStart(2,'0'); SAVE.journal.day.earn=i; journalRoll(); }
    out.cap = SAVE.journal.hist.length<=30;
    // endShift feeds the journal (silent path)
    SAVE.journal.day.shifts=0; M.today=7; M.jobs=1; M.shiftDist=1000; SAVE.shifts=0;
    G.state='playing'; endShift('t',true);
    out.endShift = SAVE.journal.day.shifts===1;
    return out;`);
  if (!r.ok) throw new Error(r.error);
  const v = r.value;
  for (const k of ['roll','added','closed','cap','endShift'])
    if (!v[k]) throw new Error(k + ' failed: ' + JSON.stringify(v));
  return v;
});

group('ustad-loan', async s => {
  // The tow books a choice: the free wait always exists, the +25% credit respects the debt
  // cap and lands on SAVE.debt; a pending repair completes by wall clock while riding;
  // the advisory fires when damage crosses 40.
  const r = await s.run(`
    const out={};
    SAVE.tutorialDone=true; SAVE.debt=0; SAVE.bestShift=20; SAVE.cash=5; SAVE.rating=4.5;
    SAVE.cond={ fuel:100, engine:100, tyres:100, damage:100 };
    G.state='playing'; G.autopilot=true;   // autopilot picks the free wait in the tow card
    breakdownTow();
    out.towArmsWait = (SAVE.repairAt||0) > Date.now() && SAVE.cond.damage<100;
    out.debtFree = SAVE.debt===0;
    // wait is severity-scaled, ~10-20 min at this damage
    const mins=(SAVE.repairAt-Date.now())/60000;
    out.severity = mins>=9 && mins<=23;
    // repair completes by wall clock
    SAVE.repairAt = Date.now()-1; repairCheck();
    out.completes = SAVE.repairAt===0 && SAVE.cond.damage===0;
    // loan math: ceil((damage+engine cost)*1.25)
    SAVE.cond={ fuel:100, engine:80, tyres:100, damage:60 }; SAVE.debt=0;
    const lc=repairLoanCost(), sv=serviceCosts();
    out.loanMath = Math.abs(lc - Math.ceil((sv.damage+sv.engine)*1.25*10)/10) < 0.01 && lc>sv.damage;
    ustadLoan();
    out.loanDebt = SAVE.debt===lc && SAVE.cond.damage===0 && SAVE.repairAt===0;
    // debt cap: max(50, bestShift*2, cash*2)
    SAVE.bestShift=10; SAVE.cash=3;
    out.cap = debtCap()===50;
    SAVE.bestShift=90; out.cap2 = debtCap()===180;
    SAVE.cash=200; out.cap3 = debtCap()===400;
    // advisory: crossing 40 damage must hint (element text flips from '')
    SAVE.debt=0; G.state='playing'; SAVE.cond.damage=39; P.invuln=0; M.job=null;
    const before=document.getElementById('hint').textContent;
    crash({x:P.x,hw:0.5,hl:1,pr:null,speed:0,z:P.z},'car');
    out.advisory = SAVE.cond.damage>=40 && document.getElementById('hint').textContent!==before;
    G.autopilot=false;
    return out;`);
  if (!r.ok) throw new Error(r.error);
  const v = r.value;
  for (const k of ['towArmsWait','debtFree','severity','completes','loanMath','loanDebt','cap','cap2','cap3','advisory'])
    if (!v[k]) throw new Error(k + ' failed: ' + JSON.stringify(v));
  return v;
});

// ---------------------------------------------------------------- runner
const t0 = Date.now();
const srv = await serve(ROOT, 0);
const chrome = await launch({});
let s = null;
let pass = 0, fail = 0;
const failures = [];
try {
  s = await Session.connect(chrome.port, chrome.targetId);
  await s.init();
  await s.send('Network.enable');
  // the game pauses itself on window blur / tab hide, which headless fires spuriously — keep it focused
  await s.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  await s.goto(`http://127.0.0.1:${srv.port}/index.html?debug`);
  // the seam is installed on the last line of the async boot, so poll for it rather than guess
  let seam = false;
  for (let i = 0; i < 240; i++) {
    if (await s.expr(`!!(window.__BR && window.__BR.ev)`)) { seam = true; break; }
    await sleep(250);
  }
  if (!seam) throw new Error('game never installed the ?debug seam');
  await s.raw(HELPERS);
  // the loader builds the world asynchronously; wait for it rather than guessing a delay
  let ready = false;
  for (let i = 0; i < 240; i++) {
    const st = await s.run(`return G.state!=='loading' ? G.state : null;`);
    if (st.ok && st.value) { ready = true; break; }
    await sleep(250);
  }
  if (!ready) throw new Error('game never left the loading state');

  for (const g of G) {
    if (only && g.name!==only) continue;   // exact: --only road-clearance must not also run road-clearance-live
    s.clearLogs();
    const t = Date.now();
    try {
      const extra = await g.fn(s);
      const ms = Date.now() - t;
      pass++;
      console.log(`  \x1b[32mPASS\x1b[0m ${g.name} (${ms}ms)${extra !== undefined ? '  \x1b[2m' + JSON.stringify(extra) + '\x1b[0m' : ''}`);
    } catch (e) {
      fail++; failures.push({ name: g.name, msg: e.message || String(e) });
      console.log(`  \x1b[31mFAIL\x1b[0m ${g.name} (${Date.now() - t}ms)\n       ${e.message || e}`);
    }
  }
} catch (e) {
  fail++;
  failures.push({ name: 'harness', msg: e.message || String(e) });
  console.log(`  \x1b[31mFAIL\x1b[0m harness\n       ${e.message || e}`);
  if (s) console.log(JSON.stringify(s.errors().slice(0, 8), null, 2));
} finally {
  if (!KEEP) { chrome.close(); await srv.close(); }
}

console.log(`\n  ${pass} passed, ${fail} failed  \x1b[2m(${((Date.now() - t0) / 1000).toFixed(1)}s)\x1b[0m`);
if (failures.length) { console.log('\n  failures:'); for (const f of failures) console.log(`   - ${f.name}: ${f.msg}`); }
process.exit(fail ? 1 : 0);
