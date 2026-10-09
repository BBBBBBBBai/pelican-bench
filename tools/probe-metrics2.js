/* Second metrics probe: weight availability in the CJK fallback, which mono face
   actually resolves, and fit/height checks for the proposed role ramp. Read-only. */
const out = { weights: {}, mono: {}, heights: {}, fits: {} };
const S = (css, text) => {
  const el = document.createElement('span');
  el.textContent = text;
  el.style.cssText = `position:fixed;left:-9999px;top:0;font-size:200px;line-height:1;white-space:nowrap;letter-spacing:0;${css}`;
  document.body.appendChild(el);
  const w = el.getBoundingClientRect().width;
  el.remove();
  return +w.toFixed(2);
};
const style = document.createElement('style');
style.textContent = `
  @font-face { font-family: 'probe-cascadia'; src: local('Cascadia Mono'); }
  @font-face { font-family: 'probe-consolas'; src: local('Consolas'); }
  @font-face { font-family: 'probe-courier'; src: local('Courier New'); }
`;
document.head.appendChild(style);
await new Promise((r) => setTimeout(r, 120));

// 1. does the CJK fallback have intermediate weights, or only Regular + Bold?
for (const w of [400, 500, 600, 700]) {
  out.weights['zh ' + w] = S(`font-family:var(--font-silk);font-variation-settings:'wdth' 92;font-weight:${w}`, '保存思考过程');
}
for (const w of [400, 500, 600, 700]) {
  out.weights['latin ' + w] = S(`font-family:'Archivo';font-variation-settings:'wdth' 92;font-weight:${w}`, 'PROVIDERS');
}

// 2. which face actually renders for --font-read today?
const MONO = 'IN 1234  OUT 5678  548ms';
out.mono['read stack'] = S('font-family:var(--font-read)', MONO);
out.mono.azeret = S("font-family:'Azeret Mono'", MONO);
out.mono.cascadia = S("font-family:'probe-cascadia'", MONO);
out.mono.consolas = S("font-family:'probe-consolas'", MONO);
out.mono.courier = S("font-family:'probe-courier'", MONO);
out.mono.generic = S('font-family:monospace', MONO);

// 3. the tag slot height invariant: .tags min-height 19px must survive a 10.5px tag
const cell = document.createElement('div');
cell.className = 'ch';
cell.style.cssText = 'position:fixed;left:-9999px;top:0;width:220px';
cell.innerHTML = '<div class="ch-silk"><div class="tags"><span class="tag">MODEL MISMATCH</span></div></div>';
document.body.appendChild(cell);
const tagsEl = cell.querySelector('.tags');
const tagEl = cell.querySelector('.tag');
out.heights.tagSlot = tagsEl.getBoundingClientRect().height;
out.heights.tag = tagEl.getBoundingClientRect().height;
out.heights.tagWidth = +tagEl.getBoundingClientRect().width.toFixed(1);
tagEl.style.fontSize = '10.5px';
tagEl.style.letterSpacing = '0.03em';
out.heights.tag105_zhTrack = tagEl.getBoundingClientRect().height;
out.heights.tagWidth105 = +tagEl.getBoundingClientRect().width.toFixed(1);
tagEl.style.fontVariationSettings = "'wdth' 68";
tagEl.style.letterSpacing = '0.09em';
out.heights.tagWidth105en = +tagEl.getBoundingClientRect().width.toFixed(1);
cell.remove();

// 4. proposed ramp fits, measured on real markup
const box = document.createElement('div');
box.style.cssText = 'position:fixed;left:-9999px;top:0;width:306px;padding:16px';
document.body.appendChild(box);
const probe = (html) => {
  box.innerHTML = html;
  const el = box.firstElementChild;
  return { w: Math.round(el.getBoundingClientRect().width), sw: el.scrollWidth, cw: el.clientWidth };
};
out.fits.sheetDtLongestEn = probe('<dl class="facts"><dt>RESPONSE ID</dt><dd>resp_abc</dd></dl>');
out.fits.hintEn_12p5 = probe('<div class="hint">The model answered, but the response contains no SVG. The raw text is in the record below.</div>');
out.fits.hintZh_12p5 = probe('<div class="hint">模型回了话，但响应里没有 SVG。原始文本在下面的记录里。</div>');
out.fits.fieldLabelEn_11p5 = probe('<label>MODEL (BLANK = FROM PROVIDER)</label>');
box.remove();

// 5. the proposed section header, at the tightest real column, against the longest EN copy
const COL = { col348: 348 - 32, col300: 300 - 32 };
out.headers = {};
for (const [k, w] of Object.entries(COL)) {
  const c = document.createElement('div');
  c.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px`;
  c.innerHTML = '<div class="bay-head"><span class="silk silk-hi">LABEL</span><span class="rule"></span></div>';
  document.body.appendChild(c);
  const span = c.querySelector('.silk');
  for (const txt of ['PROVIDERS', 'THIS RUN', 'GLOBAL SETTINGS', 'FACTS', 'FLAGS', 'ERROR', '供应商', '本次运行', '全局设置']) {
    span.textContent = txt;
    out.headers[`${k} ${txt}`] = Math.round(span.getBoundingClientRect().width);
  }
  c.remove();
}

// 6. the cell head line: does the fact (duration) still fit beside `第 26 条` at every density?
out.chHead = {};
for (const w of [148, 220, 320, 132, 168, 210]) {
  const c = document.createElement('div');
  c.className = 'ch';
  c.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px`;
  c.innerHTML = `<div class="ch-head"><span class="lamp"></span><span class="ch-no">第 26 条</span><span class="spacer"></span><span class="ch-dur">1.4s</span></div>`;
  document.body.appendChild(c);
  const head = c.querySelector('.ch-head');
  out.chHead[w] = { head: Math.round(head.getBoundingClientRect().width), scroll: head.scrollWidth, over: head.scrollWidth - head.clientWidth };
  c.remove();
}

// 7. the roster sub-line (quantified, may never be truncated) at 348 and 300 columns
out.rosterSub = {};
for (const w of [348, 300]) {
  const c = document.createElement('div');
  c.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px`;
  c.innerHTML = '<button class="slot"><span class="slot-body"><span class="slot-name">a6</span><span class="slot-sub">gpt-6.1-sol · OI · T=1 · MAX=8192</span></span></button>';
  document.body.appendChild(c);
  const sub = c.querySelector('.slot-sub');
  out.rosterSub[w] = { content: sub.clientWidth, needed: sub.scrollWidth, over: sub.scrollWidth - sub.clientWidth };
  c.remove();
}
return JSON.stringify(out, null, 1);
