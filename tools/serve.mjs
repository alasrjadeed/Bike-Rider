// Static file server for the regression harness. Serves the project root over http so the service worker,
// the vendored three.js and relative asset paths all behave exactly as they do in production.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
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
  return new Promise(res => server.listen(port, '127.0.0.1', () => res({ server, port, close: () => new Promise(r => server.close(r)) })));
}
