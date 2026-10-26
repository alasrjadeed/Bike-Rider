// Static file server for the regression harness. Serves the project root over http so the service worker,
// the vendored three.js and relative asset paths all behave exactly as they do in production.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.wav': 'audio/wav', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

export function serve(root, port = 8391) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    let st;
    try { st = statSync(file); } catch { res.writeHead(404); return res.end('not found'); }
    if (st.isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    });
    createReadStream(file).pipe(res);
  });
  // No host argument: Node binds :: with dual-stack, so 127.0.0.1, [::1] (what "localhost"
  // often resolves to first) and the LAN address all reach the server.
  return new Promise(res => server.listen(port, () => res({ server, port, close: () => new Promise(r => server.close(r)) })));
}

// `npm run dev` (and `npm run serve`) start this file directly; the harness imports serve().
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 8391;
  await serve(process.cwd(), port);
  console.log(`serving on port ${port} — http://localhost:${port}/  (Ctrl-C to stop)`);
}

