// Packages the deployable web build.
//
//   node tools/build-web.mjs [--out dist]
//
// Produces dist/bike-rider-<version>.web.zip — the contents of public/, minus the 334 MB of
// music stems under public/music/ which the game never loads (every sound is WebAudio synthesis).
// That exclusion is the difference between a 619 KiB upload and a 334 MB one, so it is enforced
// here rather than left to whoever runs the zip.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const OUT = path.resolve(ROOT, (argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : 'dist'));

export const EXCLUDE = ['music/*', 'Screenshot/*', '.git/*', 'node_modules/*', '*.DS_Store', 'Thumbs.db'];

const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/** Writes the web zip and returns its path. Shared with the APK build so both land in SHA256SUMS. */
export function buildWeb({ quiet = false } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const src = path.join(ROOT, 'public');
  if (!fs.existsSync(path.join(src, 'index.html'))) {
    throw new Error('public/index.html is missing — run: npm run sync:public');
  }
  fs.mkdirSync(OUT, { recursive: true });

  const zip = path.join(OUT, 'bike-rider-' + pkg.version + '.web.zip');
  fs.rmSync(zip, { force: true });
  // zip takes exclusions as repeated `-x <pattern>` pairs
  const exclude = EXCLUDE.flatMap(pattern => ['-x', pattern]);
  execFileSync('zip', ['-q', '-X', '-r', zip, '.', ...exclude],
    { cwd: src, stdio: 'ignore' });

  // `music/*` stays in EXCLUDE as a guard, not as a habit: 668 MB of unreferenced stems used to sit
  // in this repo and a silent exclusion is how that survives a year of deploys. If the directory ever
  // comes back, say so loudly rather than dropping it again.
  const music = path.join(src, 'music');
  if (fs.existsSync(music)) {
    let n = 0, b = 0;
    const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f); else { n++; b += fs.statSync(f).size; }
    } };
    walk(music);
    console.log('  WARNING   public/music/ is back — ' + n + ' files, ' + (b / 1048576).toFixed(0) +
      ' MiB, excluded from the zip but still on disk. Every sound is WebAudio; delete it.');
  }

  // read the archive back so the reported file count is the truth, not the zip command's opinion
  const listed = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n').filter(l => l && !l.endsWith('/')).length;
  if (!listed) throw new Error('the web zip came out empty');

  if (!quiet) {
    const bytes = fs.statSync(zip).size;
    console.log('  web       ' + path.relative(ROOT, zip) + '  ' + listed + ' files, ' +
      (bytes / 1024).toFixed(0) + ' KiB');
  }
  return zip;
}

/**
 * Rewrites dist/SHA256SUMS so it describes **every release artifact present in dist/**, not just the
 * ones this particular build happened to produce. The APK, web zip and AppGallery .aab are built by
 * separate commands, so a truncating write from whichever ran last silently dropped the other two
 * entries — which is exactly how a checksum file stops being trusted.
 */
export function writeSums(files) {
  fs.mkdirSync(OUT, { recursive: true });
  // Anything already documented here, plus the artifacts this run produced. Versioned artifacts win;
  // superseded ones from older versions are dropped by the version filter below.
  const ARTIFACT = /\.(apk|aab|zip)$/;
  const present = new Set([
    ...files,
    ...fs.readdirSync(OUT).filter(f => ARTIFACT.test(f)).map(f => path.join(OUT, f)),
  ]);
  const kept = [...present].filter(f => fs.existsSync(f));
  // Keep only the newest version of each kind so a stale 1.0.3 line cannot linger beside 1.0.4.
  const version = f => (path.basename(f).match(/(\d+\.\d+\.\d+)/) || [])[1] || '';
  const newest = kept.map(version).sort().pop() || '';
  const lines = kept
    .filter(f => version(f) === newest)
    .sort()
    .map(f => sha256(f) + '  ' + path.basename(f) + '\n').join('');
  fs.writeFileSync(path.join(OUT, 'SHA256SUMS'), lines);
  return lines;
}

// pathToFileURL, not string concatenation: this repo's path contains spaces, which URL-encode.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Bike Rider web build');
  const zip = buildWeb();
  writeSums([zip]);
  console.log('  sums      ' + path.relative(ROOT, path.join(OUT, 'SHA256SUMS')));
}
