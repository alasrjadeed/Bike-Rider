// Static integrity check for the single-file build.
//
// Android WebViews and older desktop WebKit fail in ways a modern browser papers over:
// a duplicated id silently makes a settings toggle write to the wrong control, and a
// $('x') that resolves to null takes a whole screen down. Neither shows up in the
// Chrome regression run, so they get their own cheap static pass.
//
//   node tools/audit.mjs [file...]
//
// Checks: syntax of the game script, duplicate ids, unresolvable $()/getElementById
// lookups, ids referenced but never declared, unescaped user text in innerHTML, and
// forbidden network dependencies.

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = process.argv.slice(2).length ? process.argv.slice(2) : [path.join(ROOT, 'index.html')];

let failures = 0;
const fail = (file, msg) => { failures++; console.log('  FAIL  ' + path.relative(ROOT, file) + ': ' + msg); };
const pass = msg => console.log('  ok    ' + msg);

// Pull the game script out of the HTML so it can be syntax-checked on its own.
function extractScripts(src) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) {
    if (/\bsrc\s*=/i.test(m[1])) continue;      // external, checked separately
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(m[1])) continue;   // SEO structured data, not code
    out.push({ attrs: m[1], body: m[2], index: m.index });
  }
  return out;
}

function auditHtml(file) {
  const src = fs.readFileSync(file, 'utf8');

  // --- ids ------------------------------------------------------------------------
  const declared = new Map();
  // markup ids, both literal and inside template literals (settings panels are built in JS)
  for (const m of src.matchAll(/\bid\s*=\s*"([A-Za-z][\w:-]*)"/g)) declared.set(m[1], (declared.get(m[1]) || 0) + 1);
  // ids assigned as properties, e.g. box.id='saveIO'
  for (const m of src.matchAll(/\.id\s*=\s*'([A-Za-z][\w:-]*)'/g)) declared.set(m[1], (declared.get(m[1]) || 0) + 1);

  // Static markup must be unique. Template-literal branches legitimately share an id
  // (a ternary renders one of two variants), so those are checked live in the DOM by
  // the regression suite instead of statically here.
  const staticSrc = src.replace(/`(?:[^`\\]|\\.)*`/g, '``');
  const staticIds = new Map();
  for (const m of staticSrc.matchAll(/\bid\s*=\s*"([A-Za-z][\w:-]*)"/g)) staticIds.set(m[1], (staticIds.get(m[1]) || 0) + 1);
  const dupes = [...staticIds].filter(([, n]) => n > 1).map(([id, n]) => id + ' x' + n);
  if (dupes.length) fail(file, 'duplicate static ids: ' + dupes.join(', '));
  else pass('no duplicate static ids (' + staticIds.size + ' in markup)');

  // --- $('x') / getElementById('x') resolve ----------------------------------------
  const refs = new Set();
  for (const m of src.matchAll(/\$\('([A-Za-z][\w:-]*)'\)/g)) refs.add(m[1]);
  for (const m of src.matchAll(/getElementById\('([A-Za-z][\w:-]*)'\)/g)) refs.add(m[1]);
  const unresolved = [...refs].filter(id => !declared.has(id));
  if (unresolved.length) fail(file, 'element ids referenced but never declared: ' + unresolved.join(', '));
  else pass('all ' + refs.size + ' element lookups resolve');

  // --- external network dependencies -----------------------------------------------
  const external = [...src.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
  const remote = external.filter(u => /^https?:|^\/\//i.test(u));
  if (remote.length) fail(file, 'remote script dependencies: ' + remote.join(', '));
  else pass('no remote script dependencies (' + external.join(', ') + ')');

  // Google Fonts is a progressive enhancement. The rule that actually matters: every
  // font-family must resolve to a generic family, so a blocked CDN degrades to system
  // type instead of invisible or wrongly-shaped text.
  const generic = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded)$/;
  const vars = new Map();
  for (const m of src.matchAll(/(--[\w-]+)\s*:\s*([^;}\n]+)/g)) vars.set(m[1], m[2]);
  const resolve = expr => {
    let e = expr.trim(), guard = 0;
    while (/var\(/.test(e) && guard++ < 5) e = e.replace(/var\((--[\w-]+)\)/g, (_, n) => vars.get(n) || 'sans-serif');
    return e;
  };
  let noFallback = 0;
  for (const m of src.matchAll(/font-family\s*:\s*([^;}\n]+)/g)) {
    const last = resolve(m[1]).split(',').pop().trim().replace(/["']/g, '');
    if (!generic.test(last)) { noFallback++; fail(file, 'font-family without a generic fallback: ' + m[1].trim()); }
  }
  if (!noFallback) {
    const remoteCss = [...src.matchAll(/<link[^>]+href=["'](https?:)?\/\//gi)].length;
    pass('every font-family ends in a generic family (' + remoteCss + ' remote font link(s) degrade cleanly)');
  }

  // --- audio stays synthesised -------------------------------------------------------
  // Every bundled sound is WebAudio. public/music/ once held 668 MB of stems that predated the synth
  // engine and is loaded by nothing. A reference creeping back in means a missing-file bug on a
  // phone and a 334 MB APK, so it is a hard failure.
  //
  // The MUSIC player (index.html) loads only files the *player* picks at runtime, via FileReader
  // object URLs. That is not a bundled asset, so `accept="audio/*"` and blob: URLs are fine here.
  const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba|webm)$/i;
  const audioRefs = new Set();
  for (const m of src.matchAll(/["'`]((?:\.\/)?(?:music|audio)\/[^"'`\s]+)["'`]/g)) {
    if (AUDIO_EXT.test(m[1])) audioRefs.add(m[1]);           // a real file, not an accept= glob
  }
  for (const m of src.matchAll(/["'`]((?:\.\/)?(?:music|audio)\/[^"'`\s]+)["'`]\s*\)?\s*(?:,|\))/g)) {
    if (AUDIO_EXT.test(m[1])) audioRefs.add(m[1]);
  }
  for (const m of src.matchAll(/new\s+Audio\s*\(\s*["'`]([^"'`]+)["'`]/g)) audioRefs.add(m[1]);
  for (const m of src.matchAll(/["'`](?:https?:)?\/\/[^"'`\s]+\.(?:mp3|m4a|aac|ogg|oga|opus|wav|flac|weba)["'`]/gi)) {
    audioRefs.add(m[1]);                                       // a remote track is a network dep
  }
  if (audioRefs.size) {
    fail(file, 'audio is synthesised — these file references must not come back: ' + [...audioRefs].join(', '));
  } else {
    pass('no bundled audio references (all sound is WebAudio synthesis)');
  }


  // --- innerHTML safety --------------------------------------------------------------
  // The one genuine XSS sink in a build like this is a value that came from a player:
  // a text input, a file picker, or a pasted string. Those must reach the DOM through
  // textContent or esc(). Literals baked into the code are a review question, not a bug.
  // Curated list of expressions that carry player- or file-supplied data.
  const SINKS = /\.value\b|\.files\b|FileReader|readAsDataURL|dataURL|dataUrl|\.result\b|riderName|coName|coLogo|\.logo\b|\.city\b/;
  const INNER = /(?:innerHTML|insertAdjacentHTML)\s*=\s*[`'"]([\s\S]{0,4000}?)[`'"]/g;
  let risky = 0;
  for (const m of src.matchAll(INNER)) {
    for (const t of m[1].matchAll(/\$\{([^}]*)\}/g)) {
      const expr = t[1].trim();
      if (/esc\(|textContent/.test(expr)) continue;
      if (!SINKS.test(expr)) continue;              // a code literal, not player data
      risky++;
      fail(file, 'player data interpolated into innerHTML without esc(): ${' + expr + '}');
    }
  }
  if (!risky) pass('no player-supplied value reaches innerHTML unescaped');

  // --- referenced files actually exist -------------------------------------------
  // A resource referenced but not shipped is invisible in a desktop browser that 404s quietly,
  // and on Android it is a blank screen with no stack trace. This is the check that catches an
  // asset left out of public/ before it becomes a device bug.
  const dir = path.dirname(file);
  const local = new Set();
  for (const m of src.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const u = m[1];
    if (!u || u.includes('${')) continue;            // a runtime value, e.g. a logo data URL
    if (u.startsWith('#') || u.startsWith('data:') || u.startsWith('blob:')) continue;
    if (/^(https?:)?\/\//i.test(u) || u.startsWith('//')) continue;
    local.add(u);
  }
  const missingFiles = [...local].filter(u => !fs.existsSync(path.resolve(dir, u)));
  if (missingFiles.length) fail(file, 'referenced files that do not exist: ' + missingFiles.join(', '));
  else if (local.size) pass('all ' + local.size + ' referenced files exist beside the html');
  else pass('no local file references to check');

  return { declared: declared.size, refs: refs.size, files: local.size };
}

// The manifest and the service worker's precache list are part of the same deployable bundle:
// a missing icon in the manifest is a broken install prompt, and a stale CORE entry is a 404 the
// browser logs once and forgets. Both are invisible to the page-level checks above.
function auditBundle(dir) {
  const manPath = path.join(dir, 'manifest.webmanifest');
  if (fs.existsSync(manPath)) {
    const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
    const icons = (man.icons || []).map(i => i.src);
    if (!icons.length) fail(manPath, 'the manifest declares no icons');
    const missing = icons.filter(src => !fs.existsSync(path.resolve(dir, src)));
    if (missing.length) fail(manPath, 'manifest icons that do not exist: ' + missing.join(', '));
    else pass('all ' + icons.length + ' manifest icons exist');
    if (!man.name || !man.short_name) fail(manPath, 'the manifest needs name and short_name');
  }
  // Root icons/ is the source of truth and this bundle's icons/ is a mirror of it. Installing the
  // app icon straight into the mirror looks like it works and is then silently reverted by the next
  // public sync, which ships the old launcher icon with no error anywhere -- so compare them here.
  for (const rel of ['apple-touch-icon.png', 'favicon.ico', 'favicon.svg', 'favicon-32.png',
                     'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png']) {
    const src = path.join(ROOT, 'icons', rel), dst = path.join(dir, 'icons', rel);
    if (!fs.existsSync(src) || !fs.existsSync(dst)) continue;
    const a = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
    const b = crypto.createHash('sha256').update(fs.readFileSync(dst)).digest('hex');
    if (a !== b) fail(path.join(dir, 'icons', rel),
      'differs from the source icons/ -- run node tools/sync-public.mjs');
  }
  const swPath = path.join(dir, 'sw.js');
  if (fs.existsSync(swPath)) {
    const sw = fs.readFileSync(swPath, 'utf8');
    const m = sw.match(/const CORE\s*=\s*\[([\s\S]*?)\]/);
    if (!m) { fail(swPath, 'no CORE precache list found'); return; }
    const entries = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
    const missing = entries
      .map(e => (e === './' ? 'index.html' : e.replace(/^\.\//, '')))
      .filter(e => !fs.existsSync(path.resolve(dir, e)));
    if (missing.length) fail(swPath, 'CORE entries with no file: ' + missing.join(', '));
    else pass('all ' + entries.length + ' service-worker CORE entries exist');
    if (!/const VERSION\s*=/.test(sw)) fail(swPath, 'the cache VERSION constant is missing');
  }
}

function auditSyntax(file) {
  const src = fs.readFileSync(file, 'utf8');
  const scripts = extractScripts(src);
  if (!scripts.length) { fail(file, 'no inline script found to check'); return; }
  const vm = require_vm();
  for (const s of scripts) {
    try { new vm.Script(s.body); }
    catch (e) { fail(file, 'syntax error in inline script: ' + e.message); return; }
  }
  pass('all ' + scripts.length + ' inline scripts parse');
}

// node:vm without the import ceremony, kept local so audit.mjs stays a single file.
function require_vm() { return vmMod; }
let vmMod;
try { vmMod = (await import('node:vm')).default ?? (await import('node:vm')); }
catch { vmMod = { Script: class { constructor(b) { new Function(b); } } }; }

console.log('audit ' + files.map(f => path.relative(ROOT, f)).join(', '));
for (const f of files) {
  if (!fs.existsSync(f)) { fail(f, 'file not found'); continue; }
  if (f.endsWith('.html')) { auditHtml(f); auditSyntax(f); }
  // the bundle checks run once, against the directory the deployables are copied from
  if (path.basename(f) === 'index.html' && path.basename(path.dirname(f)) === 'public') auditBundle(path.dirname(f));
}
console.log(failures ? '\n' + failures + ' problem(s) found' : '\nno problems found');
process.exit(failures ? 1 : 0);
