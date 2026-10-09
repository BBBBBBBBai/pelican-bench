/**
 * 双语约束核验（PRODUCT.md 硬约束：「文案长度按较长的那一种预留，不允许换语言就撑破布局」）。
 * 目标模块：被测模型选择器。切到 EN 后重量 label / 提示句 / 空态文案 / 候选行是否溢出。
 * 同时核 prefers-reduced-motion 下模块有没有动画。
 */
const out = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const measure = (tag) => {
  const q = (s) => document.querySelector(s);
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  };
  const label = [...document.querySelectorAll('label')].find((l) => l.htmlFor === 'o-model');
  const hint = q('.model-pick')?.parentElement?.querySelector('.note');
  const grid = q('.mp-grid');
  const name = q('.mp-name');
  const info = {
    tag,
    lang: document.documentElement.lang,
    labelText: label?.textContent ?? null,
    labelRect: rect(label),
    // 标签是否被裁（scrollWidth 大于 clientWidth 说明文字放不下）
    labelClipped: label ? label.scrollWidth > label.clientWidth + 1 : null,
    inputRect: rect(q('#o-model')),
    gridRect: rect(grid),
    firstCellRect: rect(q('.mp-cell')),
    firstNameRect: rect(name),
    // 候选名是否被省略号吃掉
    firstNameClipped: name ? name.scrollWidth > name.clientWidth + 1 : null,
    firstNameScrollVsClient: name ? [name.scrollWidth, name.clientWidth] : null,
    hintText: hint?.textContent ?? null,
    hintRect: rect(hint),
    hintClipped: hint ? hint.scrollWidth > hint.clientWidth + 1 : null,
    listboxAriaLabel: grid?.getAttribute('aria-label') ?? null,
    docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
  };
  return info;
};

const setInput = (v) => {
  const el = document.getElementById('o-model');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

// 语言是一个两挡 Switch：先找到「EN」那一挡，别点到已经选中的「中」上。
const langBtn = () => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'EN');

out.beforeLang = document.documentElement.lang;
out.zh = measure('zh');
out.langBtnText = langBtn()?.textContent?.trim() ?? null;

// 切到英文
const lb = langBtn();
if (lb) { lb.click(); await sleep(500); }
out.afterLang = document.documentElement.lang;
out.en = measure('en');

// EN 下空态文案（最长的那一条）量一次
setInput('zzzz');
await sleep(300);
const empty = document.querySelector('.mp-empty');
out.enEmpty = {
  text: empty?.textContent ?? null,
  rect: (() => { if (!empty) return null; const r = empty.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })(),
  clipped: empty ? empty.scrollWidth > empty.clientWidth + 1 : null,
  fontFamily: empty ? getComputedStyle(empty).fontFamily.split(',')[0] : null,
  fontSize: empty ? getComputedStyle(empty).fontSize : null,
  textTransform: empty ? getComputedStyle(empty).textTransform : null,
  color: empty ? getComputedStyle(empty).color : null,
  bg: empty ? getComputedStyle(empty).backgroundColor : null,
};
setInput('');
await sleep(200);

// reduced-motion：这个模块里有没有会动的属性
out.reducedMotion = {
  matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
  transitionsOnPicker: ['.mp-input', '.mp-grid', '.mp-cell', '.mp-dot'].map((s) => {
    const el = document.querySelector(s);
    if (!el) return { s, none: true };
    const st = getComputedStyle(el);
    return { s, transition: st.transition, animation: st.animationName };
  }),
};

// 把语种切回去
const lb2 = langBtn();
if (lb2) { lb2.click(); await sleep(400); }
out.restoredLang = document.documentElement.lang;

return JSON.stringify(out, null, 1);
