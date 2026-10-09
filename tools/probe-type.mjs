/* Type probe: reports CJK tracking, role ramp in the wild, and font resolution.
   Usage: node tools/probe-type.mjs [--do=file.js] */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT || 9334);
const url = process.argv[2] || 'http://127.0.0.1:5174/';
const width = Number((process.argv.find((a) => a.startsWith('--width=')) || '').slice(8) || 1440);
const height = Number((process.argv.find((a) => a.startsWith('--height=')) || '').slice(9) || 900);
const mobile = process.argv.includes('--mobile');

const userDir = mkdtempSync(join(tmpdir(), 'edge-type-'));
const args = [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
  `--window-size=${width},${height}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-features=Translate', url,
];
const child = spawn(EDGE, args, { stdio: 'ignore', detached: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('no devtools target');
}

const EXPR = `(() => {
  const CJK = /[\\u3400-\\u9fff\\uf900-\\ufaff\\u3000-\\u303f\\uff00-\\uffef]/;
  const out = { viewport: [innerWidth, innerHeight], cjkTracked: [], ramp: [], fonts: {}, familyMiss: [] };
  const els = [...document.querySelectorAll('body *')];
  for (const el of els) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!own) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const isCjk = CJK.test(own);
    const lsPx = parseFloat(cs.letterSpacing) || 0;
    const lsEm = lsPx / (parseFloat(cs.fontSize) || 1);
    if (isCjk && lsEm > 0.05) {
      out.cjkTracked.push({ cls: el.className.toString().slice(0, 48), text: own.slice(0, 22), size: cs.fontSize, lsEm: +lsEm.toFixed(3) });
    }
    out.ramp.push({
      cls: el.className.toString().slice(0, 40) || el.tagName,
      text: own.slice(0, 18),
      size: cs.fontSize, ls: cs.letterSpacing, w: Math.round(r.width),
      fam: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      varSet: cs.fontVariationSettings, weight: cs.fontWeight,
      cjk: isCjk, color: cs.color,
    });
  }
  // dedupe ramp by class+size
  const seen = new Set();
  out.ramp = out.ramp.filter((r) => { const k = r.cls + '|' + r.size + '|' + r.wt; if (seen.has(k)) return false; seen.add(k); return true; });
  out.ramp = out.ramp.filter((r, i, a) => a.findIndex((x) => x.cls === r.cls) === i);
  // which faces actually loaded
  for (const f of document.fonts) out.fonts[f.family + ' ' + f.weight + ' ' + f.status] = f.status;
  // elements whose text is wider than their box (ellipsis or clip)
  out.overflow = [...document.querySelectorAll('body *')].filter((el) => el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
    .map((el) => ({ cls: el.className.toString().slice(0, 40) || el.tagName, text: (el.textContent || '').trim().slice(0, 26), sw: el.scrollWidth, cw: el.clientWidth }))
    .filter((v, i, a) => a.findIndex((x) => x.cls === v.cls) === i).slice(0, 14);
  return JSON.stringify(out, null, 1);
})()`;

const ws = new WebSocket(await wsUrl());
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.addEventListener('open', r));
await send('Runtime.enable');
if (mobile) await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 3, mobile: true });
await sleep(3200);
const doFile = (process.argv.find((a) => a.startsWith('--do=')) || '').slice(5);
if (doFile) {
  const body = (await import('node:fs')).readFileSync(doFile, 'utf8');
  const doRes = await send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
  const dv = doRes.result?.result?.value;
  if (doFile.includes('metrics')) {
    const raw = typeof dv === 'string' ? dv : JSON.stringify(doRes.result, null, 1);
    const outFile = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6);
    if (outFile) writeFileSync(outFile, raw, 'utf8'); else console.log(raw);
    child.kill();
    process.exit(0);
  }
  await sleep(1200);
}
const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
const raw = r.result?.result?.value ?? JSON.stringify(r.result);
const outFile = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6);
if (outFile) writeFileSync(outFile, raw, 'utf8');
else console.log(raw);
child.kill();
process.exit(0);
