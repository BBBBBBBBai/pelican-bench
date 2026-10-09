/* Metrics probe for the typeset pass. Read-only: injects probe @font-face rules,
   measures advances, and simulates the empty state at mobile width. */
const out = { fallback: {}, cjkFace: {}, fits: {}, emptyOverflow: {} };
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
  @font-face { font-family: 'probe-segoe'; src: local('Segoe UI'); }
  @font-face { font-family: 'probe-arial'; src: local('Arial'); }
  @font-face { font-family: 'probe-yahei'; src: local('Microsoft YaHei'); }
  @font-face { font-family: 'probe-simsun'; src: local('SimSun'); }
  @font-face { font-family: 'probe-consolas'; src: local('Consolas'); }
  @font-face { font-family: 'probe-cascadia'; src: local('Cascadia Mono'); }
`;
document.head.appendChild(style);
await new Promise((r) => setTimeout(r, 120));

const LAT = 'HAMBURGEFONTSIV 0123456789';
const MONO = '0123456789 IN OUT TOT 548ms';
out.fallback.archivo = S("font-family:'Archivo';font-variation-settings:'wdth' 92", LAT);
out.fallback.segoe = S("font-family:'probe-segoe'", LAT);
out.fallback.arial = S("font-family:'probe-arial'", LAT);
out.fallback.yaheiLat = S("font-family:'probe-yahei'", LAT);
out.fallback.azeret = S("font-family:'Azeret Mono'", MONO);
out.fallback.consolas = S("font-family:'probe-consolas'", MONO);
out.fallback.cascadia = S("font-family:'probe-cascadia'", MONO);

const ZH = '第 26 条 输出截断';
out.cjkFace.inReadStack = S('font-family:var(--font-read)', ZH);
out.cjkFace.yahei = S("font-family:'probe-yahei'", ZH);
out.cjkFace.simsun = S("font-family:'probe-simsun'", ZH);
out.cjkFace.azeretOnly = S("font-family:'Azeret Mono'", ZH);

// candidate label/tag widths at the proposed ramp, inside the narrowest cell
const cell = document.createElement('div');
cell.style.cssText = 'position:fixed;left:-9999px;width:156px';
cell.innerHTML = '<div class="ch-silk"><div class="tags"><span class="tag"></span></div></div>';
document.body.appendChild(cell);
const tagEl = cell.querySelector('.tag');
const cellContent = cell.querySelector('.ch-silk').clientWidth - 18;
out.fits.cellContentWidth_at156 = cellContent;
for (const [label, txt, size, wdth, ls] of [
  ['tag EN 11/68/.09', 'MODEL MISMATCH', 11, 68, 0.09],
  ['tag EN 11/74/.09', 'MODEL MISMATCH', 11, 74, 0.09],
  ['tag ZH 11/68/.02', '模型名不一致', 11, 68, 0.02],
  ['tag ZH 11/68/.09', '模型名不一致', 11, 68, 0.09],
]) {
  tagEl.textContent = txt;
  tagEl.style.fontSize = size + 'px';
  tagEl.style.fontVariationSettings = `'wdth' ${wdth}`;
  tagEl.style.letterSpacing = ls + 'em';
  out.fits[label] = { px: +tagEl.getBoundingClientRect().width.toFixed(1), cellContent };
}
cell.remove();

// the empty state: does `.empty .silk` overflow at 390px with the English hint?
for (const [lang, brand, hint] of [
  ['zh', '还没有记录', '还没有记录。先在右边选一家供应商，然后按「开始生成」发出第一道题。'],
  ['en', 'NO RECORDS YET', 'No records yet. Pick a provider on the right, then press START RUN to send the first drawing prompt.'],
]) {
  for (const w of [390, 700, 1092]) {
    const box = document.createElement('div');
    box.className = 'empty';
    box.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px`;
    box.innerHTML = `<span class="silk">${brand}</span><div class="silk">${hint}</div>`;
    document.body.appendChild(box);
    const kids = [...box.children];
    out.emptyOverflow[`${lang}@${w}`] = {
      boxOverflow: box.scrollWidth - box.clientWidth,
      silk: kids.map((k) => ({ w: Math.round(k.getBoundingClientRect().width), sw: k.scrollWidth, cw: k.clientWidth })),
    };
    box.remove();
  }
}
// same question for the raw-English prose sizes
out.fits.proseEN_14px = { px: +(out.fallback.archivo / 200 * 14 * 2.2).toFixed(1) };
return JSON.stringify(out, null, 1);
