// Mirrors the canonical build into public/ — the folder that is actually deployed and the folder
// that gets baked into the APK.
//
//   node tools/sync-public.mjs [--check]
//
// The repo has two copies on purpose: the root is the working source, public/ is the release
// bundle with the icons and music alongside it. Hand-editing the copy is how they drift, so the
// copy is always overwritten from the source and --check reports drift instead of fixing it.
//
// public/icons/ is bundle-only and is never touched.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public');
const CHECK = process.argv.includes('--check');

// Files mirrored from the root. public/ owns icons/; everything else flows one way.
const FILES = ['index.html', 'sw.js', 'manifest.webmanifest', 'browserconfig.xml', 'robots.txt', 'sitemap.xml',
               // the Three.js licence has to travel with every build that vendors Three.js
               'CREDITS.txt', 'licence.md',
               // machine-readable project summary for LLMs/crawlers
               'llms.txt'];
// tools/make-icons.py writes the root icons/; public/icons/ is the deploy copy. They must not drift.
// music/ is deliberately NOT mirrored. It held 668 MB of stems that nothing in the game ever
// loaded and has since been deleted; the exclusion stays so a reappearance cannot leak into the APK.
const DIRS = ['vendor', 'icons'];

let drifted = 0;
const rel = f => path.relative(ROOT, f);

const compare = (from, to) => {
  if (!fs.existsSync(from)) return 'missing source';
  if (!fs.existsSync(to)) return 'not in public/';
  const a = fs.readFileSync(from), b = fs.readFileSync(to);
  if (a.equals(b)) return null;
  const al = a.toString('utf8').split('\n').length, bl = b.toString('utf8').split('\n').length;
  return `differs (${al} lines in source, ${bl} in public)`;
};

console.log('sync public/ <- repo root');
for (const f of FILES) {
  const from = path.join(ROOT, f), to = path.join(SRC, f);
  const state = compare(from, to);
  if (!state) { console.log('  same      ' + f); continue; }
  drifted++;
  console.log('  ' + (CHECK ? 'DRIFT' : 'update') + '    ' + f + ' — ' + state);
  if (!CHECK) fs.copyFileSync(from, to);
}
for (const d of DIRS) {
  const from = path.join(ROOT, d), to = path.join(SRC, d);
  if (!fs.existsSync(from)) { console.log('  missing   ' + d + '/'); continue; }
  let files = 0, changed = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (!e.isFile()) continue;
    files++;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b))) continue;
    changed++;
    if (!CHECK) { fs.mkdirSync(to, { recursive: true }); fs.copyFileSync(a, b); }
  }
  if (changed) { drifted++; console.log('  ' + (CHECK ? 'DRIFT' : 'update') + '    ' + d + '/ — ' + changed + ' of ' + files + ' files'); }
  else console.log('  same      ' + d + '/ (' + files + ' files)');
}

if (CHECK) {
  if (drifted) {
    console.log('\n' + drifted + ' file(s) out of sync — run: npm run sync:public');
    process.exit(1);
  }
  console.log('\npublic/ matches the source');
} else {
  console.log(drifted ? '\nupdated ' + drifted + ' path(s)' : '\npublic/ was already current');
}
