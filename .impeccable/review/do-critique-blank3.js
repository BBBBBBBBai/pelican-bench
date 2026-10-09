// Why do rows 3 and 4 render blank? Inspect textContent codepoints and computed visibility.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mp = document.querySelector('.model-pick');
if (mp) mp.scrollIntoView({ block: 'center' });
await wait(300);

const cells = [...document.querySelectorAll('.mp-cell')];
const out = cells.map((c, i) => {
  const n = c.querySelector('.mp-name');
  const t = n ? n.textContent : '';
  const b = n ? n.getBoundingClientRect() : null;
  const cs = n ? getComputedStyle(n) : null;
  return {
    i,
    text: t,
    len: t.length,
    codepoints: [...t].map((ch) => ch.codePointAt(0).toString(16)).join(','),
    json: JSON.stringify(t),
    nameBox: b ? { w: Math.round(b.width), h: Math.round(b.height) } : null,
    visibility: cs ? cs.visibility : null,
    display: cs ? cs.display : null,
    opacity: cs ? cs.opacity : null,
    color: cs ? cs.color : null,
    widthStyle: cs ? cs.width : null,
    overflow: cs ? cs.overflow : null,
    // what a screen reader would announce
    innerText: n ? n.innerText : null,
    // raw html of the row
    rowHTML: c.outerHTML.slice(0, 400),
  };
});

// Also: what does the React element actually hold? read the MODELS array from the bundle at runtime
// by scanning the built bundle text via fetch
let bundleSnippet = null;
try {
  const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.src);
  const src = scripts.find((s) => /assets\/index-.*\.js$/.test(s));
  const txt = await fetch(src).then((r) => r.text());
  const idx = txt.indexOf('gpt-6.1-sol');
  bundleSnippet = { src, around: txt.slice(idx - 60, idx + 260) };
} catch (e) {
  bundleSnippet = { error: String(e) };
}

return { rows: out, bundleSnippet };
