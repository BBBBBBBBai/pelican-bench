// zoom the model picker 2.4x for craft inspection (transform only, no layout change)
const st = document.createElement('style');
st.textContent = `
  .model-pick { transform: scale(2.4); transform-origin: top right; z-index: 999; position: relative; }
  .model-pick .mp-grid { max-height: 400px !important; }
`;
document.head.appendChild(st);
document.querySelector('.model-pick').scrollIntoView({ block: 'start' });
await new Promise(r => setTimeout(r, 400));
const r = document.querySelector('.model-pick').getBoundingClientRect();
// centre it horizontally in the viewport
const wrap = document.querySelector('.model-pick');
wrap.style.position = 'fixed';
wrap.style.top = '40px';
wrap.style.right = '60px';
await new Promise(r => setTimeout(r, 250));
return { rect: (() => { const b = wrap.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })() };
