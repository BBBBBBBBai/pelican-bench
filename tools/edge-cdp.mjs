/**
 * edge-cdp.mjs —— 用无头 Edge + DevTools 协议看页面。
 *
 * 为什么不用 `msedge --screenshot`：那样只能截到视口顶端，没法滚动、没法量尺寸、
 * 也没法在页面里跑对比度检查。设计收尾需要的是「量出来的事实」，不是猜。
 *
 * 用法：
 *   node tools/edge-cdp.mjs shot <url> <out.png> --width=1440 --height=1800 [--expand] [--mobile] [--scale=1]
 *   node tools/edge-cdp.mjs probe <url> [--width=1440 --height=1800] [--expr=file.js]
 *
 * --reduce：模拟系统开了「减少动态效果」。动效的替代路径只能这样验——
 *           改代码里那个 media query 会验到一段不在生产上跑的代码。
 *
 * --focus：让页面相信自己是活动的（Emulation.setFocusEmulationEnabled）。无头 Edge 里
 *          document.hasFocus() 是 false，`el.blur()` 因此不会派发真的 focusout ——
 *          凡是要验「输入完 → 失焦提交」的探针都得加这个，否则会误判成功能坏了。
 *
 * --expand：临时拆掉 height:100vh / overflow:hidden 这类约束，让页面长到自然高度，
 *           这样一张图能装下整面机架（只影响截图，不改源码）。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9333);

const argv = process.argv.slice(2);
const cmd = argv[0];
const positional = argv.filter((a, i) => i > 0 && !a.startsWith('--'));
const flags = Object.fromEntries(
  argv
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.slice(2).split('=');
      return [k, v ?? true];
    }),
);

const url = positional[0];
const out = positional[1];
const width = Number(flags.width ?? 1440);
const height = Number(flags.height ?? 1800);
const scale = Number(flags.scale ?? 1);

if (!cmd || !url) {
  console.error('usage: node tools/edge-cdp.mjs <shot|probe> <url> [out.png] [--width=] [--height=] [--expand] [--mobile] [--scale=] [--expr=file]');
  process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), 'edge-cdp-'));
const child = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    `--window-size=${width},${height}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* 还没起来 */
    }
    await sleep(250);
  }
  throw new Error('DevTools 端点没有就绪');
}

let nextId = 1;
function makeSession(ws) {
  const pending = new Map();
  const waited = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`));
      else res(msg.result);
      return;
    }
    if (msg.method) {
      for (let i = waited.length - 1; i >= 0; i -= 1) {
        if (waited[i].method === msg.method) {
          waited[i].resolve(msg.params);
          waited.splice(i, 1);
        }
      }
    }
  });
  const send = (method, params = {}) =>
    new Promise((res, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: res, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const once = (method, timeoutMs = 20000) =>
    new Promise((res, reject) => {
      const entry = { method, resolve: res };
      waited.push(entry);
      setTimeout(() => {
        const i = waited.indexOf(entry);
        if (i >= 0) {
          waited.splice(i, 1);
          reject(new Error(`等待 ${method} 超时`));
        }
      }, timeoutMs);
    });
  return { send, once };
}

async function main() {
  const target = await findTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, reject) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const { send, once } = makeSession(ws);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: Boolean(flags.mobile),
  });

  // 动效的替代路径要真的按系统设置来验，不能靠在源码里改 media query。
  if (flags.reduce) {
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  }

  /* 让页面相信自己是「活动的」。无头 Edge 里 document.hasFocus() 是 false，
     后果不只是 `:focus` 少一档样式：`el.focus()` 之后 `el.blur()` **不会**派发
     真的 focusout，于是「打完一条按回车、失焦提交」这类行为在探针里完全测不到 ——
     看起来像功能坏了，其实只是浏览器没在听。任何要验「输入 → 失焦」的探针都得开这个。 */
  if (flags.focus) {
    await send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  }

  /* 触控仿真。`--mobile` 只改了视口尺寸，`pointer` / `hover` 这些媒体特性仍然是桌面值——
     而适配里判断「手指还是鼠标」恰恰要靠它们。打开触摸仿真之后 `(pointer: coarse)`
     才会真的命中，跟真机上看到的是同一段代码。 */
  if (flags.touch || flags.drag) {
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }).catch(() => {});
    await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }).catch(() => {});
  }

  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded.catch(() => {});
  await sleep(2600); // 让 React 把 /api 拉完再动手

  if (flags.expand) {
    await send('Page.addScriptToEvaluateOnNewDocument', { source: '' }).catch(() => {});
    await send('Runtime.evaluate', {
      expression: `(() => {
        const s = document.createElement('style');
        s.textContent = \`
          html, body, #root { height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .app, .bench { height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .bay, .panel, .rack-scroll, .panel-scroll { height: auto !important; max-height: none !important; overflow: visible !important; }
        \`;
        document.head.appendChild(s);
        return true;
      })()`,
      returnByValue: true,
    });
    await sleep(700);
  }

  if (flags.do) {
    const doFile = resolve(String(flags.do));
    if (!existsSync(doFile)) throw new Error(`--do 找不到文件：${doFile}`);
    const res = await send('Runtime.evaluate', {
      expression: `(async () => { ${readFileSync(doFile, 'utf8')} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) throw new Error(`--do 抛错：${JSON.stringify(res.exceptionDetails)}`);
    if (res.result?.value !== undefined) console.log('--do →', JSON.stringify(res.result.value));
    await sleep(900);
  }

  /* 真手指。合成事件（页面里 dispatchEvent 造一个 touchstart）骗不过浏览器：
     它不开滚动、不进入触摸模态，量出来的「滑不动」是假的。所以这里走 CDP 的
     Input.dispatchTouchEvent，让浏览器自己把这一串触摸当成真的手势处理。
     --drag=x,y1,y2：在 (x, y1) 按下，沿 y 轴拖到 y2，中途分步移动。
     返回：拖动前后目标区域与整页各自的滚动量。 */
  if (flags.drag) {
    const [dx, dy1, dy2] = String(flags.drag)
      .split(',')
      .map((v) => Number(v));
    const id = () => [{ x: dx, y: dy1, id: 1, radiusX: 12, radiusY: 12, force: 1 }];
    const at = (y) => [{ x: dx, y, id: 1, radiusX: 12, radiusY: 12, force: 1 }];
    const measure = async () =>
      (
        await send('Runtime.evaluate', {
          expression: `(() => {
            const el = document.elementFromPoint(${dx}, ${dy1});
            const inner = el && el.closest('.rack-scroll, .mp-grid, .panel-scroll');
            return {
              win: Math.round(window.scrollY),
              innerCls: inner ? inner.className : null,
              innerTop: inner ? Math.round(inner.scrollTop) : null,
              hit: el ? el.tagName + '.' + String(el.className).slice(0, 24) : null,
              sheet: Boolean(document.querySelector('.sheet-plate')),
              /* 手指滑过可滚列表时最怕的副作用是「顺手选中了某一格」。
                 每次都把它读出来，免得只看见滚动量就以为没事。 */
              sel: document.querySelectorAll('.mp-grid .mp-cell[aria-selected="true"]').length,
              input: document.querySelector('#o-model')?.value ?? null,
            };
          })()`,
          returnByValue: true,
        })
      ).result.value;
    const before = await measure();
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: id() });
    const steps = 10;
    for (let i = 1; i <= steps; i += 1) {
      await send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: at(dy1 + ((dy2 - dy1) * i) / steps),
      });
      await sleep(16);
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(700);
    const after = await measure();
    console.log('--drag →', JSON.stringify({ before, after, deltaWin: after.win - before.win, deltaInner: (after.innerTop ?? 0) - (before.innerTop ?? 0) }));
    await sleep(300);
  }

  if (cmd === 'probe') {
    const exprFile = flags.expr ? resolve(String(flags.expr)) : null;
    const expr = exprFile && existsSync(exprFile) ? readFileSync(exprFile, 'utf8') : AUDIT;
    const res = await send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = res.result?.value;
    console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  } else {
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: Boolean(flags.expand),
    });
    const target2 = resolve(String(out));
    writeFileSync(target2, Buffer.from(shot.data, 'base64'));
    console.log(`wrote ${target2} (${Buffer.from(shot.data, 'base64').length} bytes)`);
  }

  ws.close();
  child.kill();
}

/** 默认审计：几何 + 对比度 + 溢出，全部从浏览器里量出来 */
const AUDIT = `(() => {
  const px = (v) => Math.round(parseFloat(v) * 10) / 10;
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }; };

  // ── 通道格：行高是否齐、画面比例是否一致 ────────────────────────────────
  const cells = [...document.querySelectorAll('.ch')];
  const cellRows = {};
  for (const c of cells) {
    const b = box(c);
    const key = Math.round(b.y / 4) * 4;
    cellRows[key] = (cellRows[key] ?? []).concat([{ addr: c.querySelector('.ch-no')?.textContent?.trim(), h: b.h, w: b.w }]);
  }
  const plates = [...document.querySelectorAll('.ch-plate')].map((p) => {
    const b = box(p);
    return { addr: p.closest('.ch')?.querySelector('.ch-no')?.textContent?.trim(), w: b.w, h: b.h, ratio: px(b.w / b.h) };
  });
  const silk = [...document.querySelectorAll('.ch-silk')].map((s) => {
    const b = box(s);
    return { addr: s.closest('.ch')?.querySelector('.ch-no')?.textContent?.trim(), h: b.h };
  });

  // ── 对比度：正文 ≥4.5:1，大字 ≥3:1 ─────────────────────────────────────
  const lum = (rgb) => {
    const f = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const parse = (s) => {
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((v) => parseFloat(v));
    return { rgb: parts.slice(0, 3), a: parts.length > 3 ? parts[3] : 1 };
  };
  const bgOf = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.85) return c.rgb;
      node = node.parentElement;
    }
    return [12, 12, 11];
  };
  const contrast = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    return px((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
  };
  const offenders = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.5) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const ratio = contrast(fg.rgb, bgOf(el));
    if (ratio >= need) continue;
    const key = el.className + '|' + ratio;
    if (seen.has(key)) continue;
    seen.add(key);
    offenders.push({ text: text.slice(0, 42), cls: String(el.className).slice(0, 40), size, ratio, need, color: cs.color, bg: 'rgb(' + bgOf(el).join(',') + ')' });
  }

  // ── 溢出：有没有横向滚动条 / 有没有被裁掉的元素 ────────────────────────
  const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const clipped = [...document.querySelectorAll('body *')]
    .filter((el) => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).overflowX !== 'scroll')
    .slice(0, 12)
    .map((el) => ({ cls: String(el.className).slice(0, 40), scrollW: el.scrollWidth, clientW: el.clientWidth }));

  // ── 触控目标：可点元素是否 ≥24×24 ──────────────────────────────────────
  const small = [...document.querySelectorAll('button, a, select, input, summary')]
    .map((el) => ({ el, b: box(el) }))
    .filter(({ b }) => b.w > 0 && (b.w < 24 || b.h < 24))
    .slice(0, 12)
    .map(({ el, b }) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 30), label: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 22), w: b.w, h: b.h }));

  return {
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    counts: { cells: cells.length, plates: plates.length },
    rowCount: Object.keys(cellRows).length,
    cellHeights: Object.values(cellRows).map((r) => r[0].h),
    plateRatios: [...new Set(plates.map((p) => p.ratio))],
    silkHeights: [...new Set(silk.map((s) => s.h))],
    overflowX,
    contrastOffenders: offenders,
    clipped,
    smallTargets: small,
  };
})()`;

main().catch((err) => {
  console.error(String(err?.stack ?? err));
  child.kill();
  process.exit(1);
});
