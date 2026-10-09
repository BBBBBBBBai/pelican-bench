const g = (s) => document.querySelector(s);
const ga = (s) => [...document.querySelectorAll(s)];
g('.model-pick').scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 300));
ga('.mp-cell')[5].click();
await new Promise(r => setTimeout(r, 400));
return { value: g('.mp-input').value, rows: ga('.mp-cell').length, gridH: g('.mp-grid').getBoundingClientRect().height };
