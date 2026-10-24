// Minimal Chrome DevTools Protocol client. No npm dependencies: Node 22+ ships a global WebSocket.
// Used by tools/regress.mjs to boot the real game in headless Chrome and assert against its live globals.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ port, width = 1280, height = 720 } = {}) {
  // A fixed debugging port is a trap. If a previous run leaked its browser, the new chrome cannot
  // bind, but /json/list still answers -- from the OLD browser, with the OLD profile. Every
  // assertion then silently runs against stale state, which is how a test can "pass" while the
  // feature it covers is switched off. Take a free port, and refuse to continue if one is in use.
  port = port || await freePort();
  if (await browserAlive(port)) {
    throw new Error('port ' + port + ' already has a chrome on it -- refusing to attach to someone else\'s browser');
  }
  const profile = mkdtempSync(join(tmpdir(), 'br-chrome-'));
  const bin = process.env.CHROME_BIN || 'google-chrome';
  const proc = spawn(bin, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--no-sandbox', '--disable-gpu-sandbox', '--no-first-run', '--no-default-browser-check',
    '--disable-dev-shm-usage', '--mute-audio',
    // swiftshader gives headless a real WebGL context, so the world builder and renderer actually run
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-features=Translate,BackForwardCache',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  proc.stderr.on('data', () => {});

  let target = null;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch {}
    await sleep(100);
  }
  if (!target) { proc.kill('SIGKILL'); throw new Error('chrome did not expose a page target'); }
  return {
    proc, port, targetId: target.id, profile,
    close: () => {
      try { proc.kill('SIGKILL'); } catch {}
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
    },
  };
}

const freePort = async () => {
  const { createServer } = await import('node:net');
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => res(p));
    });
  });
};

const browserAlive = async port => {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(700) });
    return r.ok;
  } catch { return false; }
};

export class Session {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; this.logs = []; }
  static async connect(port, targetId) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const t = targetId ? list.find(x => x.id === targetId) : list.find(x => x.type === 'page');
    if (!t) throw new Error('target gone');
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error('ws: ' + e.message)); });
    const s = new Session(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id != null) {
        const p = s.pending.get(m.id); s.pending.delete(m.id);
        if (!p) return;
        m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
      } else {
        s.events.push(m);
        if (m.method === 'Runtime.consoleAPICalled') {
          const txt = (m.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' ');
          s.logs.push({ type: m.params.type, txt });
        } else if (m.method === 'Runtime.exceptionThrown') {
          const d = m.params.exceptionDetails;
          s.logs.push({ type: 'pageerror', txt: (d.exception && (d.exception.description || d.exception.value)) || d.text });
        } else if (m.method === 'Log.entryAdded') {
          const en = m.params.entry;
          if (en.level === 'error' || en.source === 'network') s.logs.push({ type: 'log:' + en.level, txt: en.text + (en.url ? ' ' + en.url : '') });
        }
      }
    };
    return s;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.delete(id)) rej(new Error('CDP timeout: ' + method)); }, 120000);
    });
  }
  async init() {
    await this.send('Runtime.enable');
    await this.send('Page.enable');
    await this.send('Log.enable');
  }
  async goto(url) {
    await this.send('Page.navigate', { url });
    for (let i = 0; i < 200; i++) {
      const r = await this.expr('document.readyState');
      if (r === 'complete') return;
      await sleep(50);
    }
    throw new Error('load timeout: ' + url);
  }
  // evaluate a statement list verbatim (no return wrapping)
  async raw(src) {
    const r = await this.send('Runtime.evaluate', { expression: src, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('page raw: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
    }
    return r.result.value;
  }
  // evaluate a bare expression and return its value
  async expr(src) {
    const r = await this.send('Runtime.evaluate', {
      expression: `(function(){ return (${src}); })()`, returnByValue: true, awaitPromise: true, userGesture: true,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('page expr: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
    }
    return r.result.value;
  }
  // The game is one big IIFE, so its internals are only reachable through the ?debug seam's
  // __BR.ev() — a direct eval inside that scope, which is why these snippets can see G, W, SAVE…
  async run(src) {
    if (!this.__seam) {
      const ok = await this.expr(`!!(window.__BR && window.__BR.ev)`);
      if (!ok) return { ok: false, error: 'no ?debug seam — load index.html?debug' };
      this.__seam = true;
    }
    // the seam's direct eval is strict-mode, so a top-level `return` is a SyntaxError — wrap the
    // snippet in a real function so test bodies can return like normal
    const r = await this.send('Runtime.evaluate', {
      expression: `window.__t("(function(){\\n" + ${JSON.stringify(src)} + "\\n})()")`,
      returnByValue: true, awaitPromise: true, userGesture: true,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      return { ok: false, error: 'harness: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text) };
    }
    const v = r.result.value;
    return v && v.ok ? { ok: true, value: v.v } : { ok: false, error: (v && v.e) || 'unknown page error' };
  }
  // Same as run(), but the snippet is an async IIFE, so it can await frames, fonts or timers.
  // Goes through the page's own __ta wrapper, which turns a rejection into {ok:false}.
  async ta(src) {
    const r = await this.send('Runtime.evaluate', {
      expression: `window.__ta("(async function(){\\n" + ${JSON.stringify(src)} + "\\n})()")`,
      returnByValue: true, awaitPromise: true, userGesture: true,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      return { ok: false, error: 'harness: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text) };
    }
    const v = r.result.value;
    return v && v.ok ? { ok: true, value: v.v } : { ok: false, error: (v && v.e) || 'unknown page error' };
  }
  // define the page-side assert helpers inside the game's scope
  async installHelpers(src) { return this.run(src); }
  errors() { return this.logs.filter(l => l.type === 'error' || l.type === 'pageerror' || l.type === 'log:error'); }
  clearLogs() { this.logs.length = 0; }
}

export { sleep };
