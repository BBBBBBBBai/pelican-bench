// type a query with no hits → empty state
const i = document.querySelector('.mp-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(i, 'zzz');
i.dispatchEvent(new Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 300));
document.querySelector('.model-pick').scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 350));
return { cells: document.querySelectorAll('.mp-cell').length, gridH: document.querySelector('.mp-grid').getBoundingClientRect().height };
