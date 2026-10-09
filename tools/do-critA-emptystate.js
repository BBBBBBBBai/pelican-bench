const out = {};
const g = (s) => document.querySelector(s);
const ga = (s) => [...document.querySelectorAll(s)];
g('.model-pick').scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 300));
const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; };

// exact empty-state colors + computed contrast, to nail the AA question
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(g('.mp-input'), 'zzzz'); g('.mp-input').dispatchEvent(new Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 300));
{
  const em = g('.mp-empty'), grid = g('.mp-grid');
  const cs = getComputedStyle(em);
  let node = em, bg = null;
  while (node && node !== document.documentElement) {
    const c = getComputedStyle(node).backgroundColor;
    if (c && c !== 'rgba(0, 0, 0, 0)') { bg = c; break; }
    node = node.parentElement;
  }
  out.emptyState = { emRect: R(em), gridRect: R(grid), color: cs.color, effectiveBg: bg, gridBg: getComputedStyle(grid).backgroundColor, fontSize: cs.fontSize, fontFamily: cs.fontFamily.split(',')[0], text: em.textContent };
}

// note that follows the picker (it is a sibling of .model-pick inside .field)
const hint = [...document.querySelectorAll('.field .note')].find(n => /先定一个模型名/.test(n.textContent));
out.hintNote = hint ? { text: hint.textContent, rect: R(hint), color: getComputedStyle(hint).color, size: getComputedStyle(hint).fontSize, width: getComputedStyle(hint).maxWidth } : null;
out.modelPickParent = g('.model-pick')?.parentElement?.className;
out.noteIsSibling = hint ? (hint.parentElement === g('.model-pick')?.parentElement) : null;

// provider note (the other prerequisite) — visible?
out.providerNote = ga('.bay-section .note').map(n => ({ text: n.textContent.trim().slice(0, 40), rect: R(n) }));

// heading of the section that owns the picker
out.sectionHeads = ga('.bay-section').map(s => ({ head: (s.querySelector('.head')?.textContent || s.querySelector('.silk')?.textContent || '').trim().slice(0, 20), rect: R(s) }));

// restore a clean selected state for the shot
setter.call(g('.mp-input'), ''); g('.mp-input').dispatchEvent(new Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
ga('.mp-cell')[6].click();
await new Promise(r => setTimeout(r, 350));
out.final = { value: g('.mp-input').value, rows: ga('.mp-cell').length, pick: R(g('.model-pick')), grid: R(g('.mp-grid')) };
return out;
