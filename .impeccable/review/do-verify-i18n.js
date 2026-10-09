/**
 * do-verify-i18n.js —— 模型选择器在 EN 与窄视口下的排版复测。
 * 用法：node tools/edge-cdp.mjs probe <url> --width=W --height=H --do=.impeccable/review/do-verify-i18n.js
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rect = (el) => {
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { x: +b.x.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), scrollW: el.scrollWidth, clientW: el.clientWidth };
};
const txt = (el) => (el ? el.textContent.trim() : null);

const snap = () => {
  const pick = document.querySelector('.model-pick');
  const label = document.querySelector('.field-head > label');
  const status = document.querySelector('.mp-status');
  const inp = document.querySelector('.mp-input');
  const row = document.querySelector('.mp-row');
  const grid = document.querySelector('.mp-grid');
  const clear = document.querySelector('.mp-clear');
  const note = document.querySelector('#o-model-hint');
  return {
    label: txt(label), labelBox: rect(label),
    status: txt(status), statusBox: rect(status),
    fieldHeadOverflow: (() => { const h = document.querySelector('.field-head'); return h ? h.scrollWidth - h.clientWidth : null; })(),
    inputBox: rect(inp),
    rowBox: rect(row),
    clearBox: rect(clear),
    gridBox: rect(grid),
    noteText: txt(note),
    noteBox: rect(note),
    pickBox: rect(pick),
    docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

const out = {};
out.zh = snap();

// 语言开关：按文本为 EN 的那一颗
const enBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'EN');
out.enSwitchFound = !!enBtn;
if (enBtn) { enBtn.click(); await wait(500); }
out.en = snap();

// EN 下的空态文案
const setVal = (v) => {
  const el = document.querySelector('.mp-input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
setVal('zzz');
await wait(220);
out.enEmpty = (() => {
  const e = document.querySelector('.mp-empty');
  return { text: txt(e), box: rect(e), fontFamily: e ? getComputedStyle(e).fontFamily.split(',')[0] : null, fontSize: e ? getComputedStyle(e).fontSize : null };
})();
out.enGridAfterEmpty = rect(document.querySelector('.mp-grid'));

// 切回中文
const zhBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '中');
if (zhBtn) { zhBtn.click(); await wait(400); }
setVal('zzz');
await wait(220);
out.zhEmpty = txt(document.querySelector('.mp-empty'));
setVal('');
await wait(150);

return JSON.stringify(out, null, 2);
