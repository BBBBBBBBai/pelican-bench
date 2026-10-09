/* Third probe: settle what width measurement cannot.
   (a) CJK weight: ink density via canvas, plus the 1em-per-glyph rule.
   (b) roster sub-line against a REAL long model name, not the demo's short one.
   (c) tag slot invariant in the smallest real cell. Read-only. */
const out = { cjkGlyph: {}, ink: {}, roster: {}, tagSmall: {} };

const advance = (css, text) => {
  const el = document.createElement('span');
  el.textContent = text;
  el.style.cssText = `position:fixed;left:-9999px;top:0;font-size:100px;line-height:1;white-space:pre;letter-spacing:0;${css}`;
  document.body.appendChild(el);
  const w = el.getBoundingClientRect().width;
  el.remove();
  return +w.toFixed(2);
};

// (a1) is one Han glyph exactly 1em, the way any CJK face is?
out.cjkGlyph['1 han @100px'] = advance("font-family:var(--font-silk)", '保');
out.cjkGlyph['2 han @100px'] = advance("font-family:var(--font-silk)", '保存');
out.cjkGlyph['1 han @50px'] = advance('font-family:var(--font-silk);font-size:50px', '保');
out.cjkGlyph['1 latin @100px Archivo'] = advance("font-family:var(--font-silk)", 'A');

// (a2) ink density: does font-weight 700 actually darken Chinese, or is it the same face?
const inkOf = (css, text, w = 260, h = 90) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#000';
  g.font = `700 64px ${css}`;
  g.textBaseline = 'middle';
  g.fillText(text, 6, h / 2);
  const d = g.getImageData(0, 0, w, h).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 255 - d[i];
  return Math.round(sum / 1000);
};
const YAHEI = "'Microsoft YaHei'";
const ARCHIVO = "'Archivo'";
for (const wt of [400, 700]) {
  out.ink[`zh YaHei ${wt}`] = inkOf(YAHEI, '保存思考过程');
  out.ink[`latin Archivo ${wt}`] = (() => {
    const c = document.createElement('canvas');
    c.width = 260;
    c.height = 90;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 260, 90);
    g.fillStyle = '#000';
    g.font = `${wt} 64px ${ARCHIVO}`;
    g.textBaseline = 'middle';
    g.fillText('SETTINGS', 6, 45);
    const d = g.getImageData(0, 0, 260, 90).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 255 - d[i];
    return Math.round(sum / 1000);
  })();
}
out.ink.note = 'ink = darker is more; identical values across 400/700 mean one face only';

// (b) the roster sub-line with model names that actually exist in the wild
const SUBS = [
  'gpt-6.1-sol · OI · T=1 · MAX=8192',
  'claude-sonnet-4-5-20250929 · ANTH · T=1 · MAX=64000',
  'deepseek-v3.2-reasoner-preview · OI · T=0.7 · TOPP=0.95 · MAX=32768',
];
for (const [label, w] of [['col348', 348], ['col300', 300]]) {
  for (const size of ['11px', '10.5px']) {
    const c = document.createElement('div');
    c.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px`;
    c.innerHTML = '<button class="slot"><span class="slot-body"><span class="slot-sub"></span></span></button>';
    document.body.appendChild(c);
    const sub = c.querySelector('.slot-sub');
    sub.style.fontSize = size;
    for (const s of SUBS) {
      sub.textContent = s;
      out.roster[`${label} ${size} ${s.slice(0, 18)}`] = {
        avail: sub.clientWidth,
        need: sub.scrollWidth,
        over: sub.scrollWidth - sub.clientWidth,
      };
    }
    c.remove();
  }
}

// (c) the smallest real cell: 132px cell, longest EN and ZH tag, at the proposed 10.5px
for (const w of [132, 148]) {
  const c = document.createElement('div');
  c.className = 'ch';
  c.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px`;
  c.innerHTML = '<div class="ch-silk"><div class="tags"><span class="tag">MODEL MISMATCH</span><span class="tag fault">RENDER FAILED</span></div></div>';
  document.body.appendChild(c);
  const tags = c.querySelector('.tags');
  out.tagSmall[`w${w} curr`] = { slot: tags.getBoundingClientRect().height, over: tags.scrollWidth - tags.clientWidth };
  for (const t of c.querySelectorAll('.tag')) {
    t.style.fontSize = '10.5px';
    t.style.letterSpacing = '0.09em';
  }
  out.tagSmall[`w${w} @10.5`] = {
    slot: tags.getBoundingClientRect().height,
    over: tags.scrollWidth - tags.clientWidth,
    widths: [...c.querySelectorAll('.tag')].map((t) => Math.round(t.getBoundingClientRect().width)),
  };
  c.remove();
}
return JSON.stringify(out, null, 1);
