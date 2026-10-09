// 键盘路径核对：全页 tab 序列（本仓库没有任何正 tabindex，所以 DOM 序即 tab 序）、
// 组合框是不是只占一个 tab stop、以及 :focus-visible 的规则到底有没有活在样式表里。
//
// 关于 :focus-visible：脚本调 .focus() 不会给 Chromium 打上「键盘模态」这个标记，
// 所以 el.matches(':focus-visible') 恒为 false —— 那是探针的限制，不是缺陷。
// 能在这儿验的是「规则解析出来了、选择器覆盖到了每一类控件、颜色在调色板上」。
// 用法：node tools/edge-cdp.mjs shot <url> <out.png> --do=tools/do-keyboard.js
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// tab 序 = 这些元素里 tabIndex 不为 -1 的那些，按 DOM 序
const stops = [...document.querySelectorAll(FOCUSABLE)].filter(
  (el) => el.tabIndex !== -1 && el.offsetParent !== null,
);

const label = (el) => {
  const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
  const cls = el.className ? '.' + String(el.className).split(' ')[0] : '';
  return `${el.tagName.toLowerCase()}${cls}${t ? '「' + t.slice(0, 16) + '」' : ''}`;
};

const out = {};
out.tabStopCount = stops.length;
out.tabOrder = stops.map(label);

// 组合框：十个候选取不占 tab stop、输入框本身占一个
out.combobox = {
  optionStops: stops.filter((el) => el.getAttribute('role') === 'option').length,
  gridStops: stops.filter((el) => el.id === 'mp-grid').length,
  inputStops: stops.filter((el) => el.getAttribute('role') === 'combobox').length,
};

// :focus-visible 的规则：从 CSSOM 里读出来，证明它们是被解析过的活规则
const rings = [];
for (const sheet of document.styleSheets) {
  let rules;
  try {
    rules = sheet.cssRules;
  } catch {
    continue;
  }
  const walk = (list) => {
    for (const r of list) {
      // 先看 selectorText：Chromium 里 CSSStyleRule 也有 cssRules（空列表，但为真），
      // 先判 cssRules 会把每一条普通规则都当成容器跳过去，一个选择器都读不到。
      if (r.selectorText && r.selectorText.includes('focus-visible')) {
        rings.push({ selector: r.selectorText, css: r.style.cssText.replace(/\s+/g, ' ').trim() });
      }
      if (r.cssRules && r.cssRules.length) walk(r.cssRules);
    }
  };
  walk(rules);
}
out.focusVisibleRules = rings;

// 每类控件是否被某条 focus-visible 规则覆盖到。
// 注意：元素在没被键盘聚焦时永远不匹配 `:focus-visible`，所以这里比的是
// 「把 :focus-visible 摘掉之后的选择器」——那才是这条规则管谁。
const covered = (el) =>
  rings.some((r) =>
    r.selector.split(',').some((part) => {
      const base = part.trim().replace(/:focus-visible.*$/, '').trim();
      if (!base) return true; // 全局 `:focus-visible { … }`
      try {
        return el.matches(base);
      } catch {
        return false;
      }
    }),
  );
out.controlCoverage = [
  ['button.btn', '.btn:not([disabled])'],
  ['button.sw', '.sw > button'],
  ['button.detents', '.detents button'],
  ['button.ch', '.ch'],
  ['input', '.model-pick input[type="text"]'],
  ['select', '.rail select'],
  ['input.check', '.check input'],
  ['summary', 'summary'],
  ['a', 'a[href]'],
].map(([name, sel]) => {
  const el = document.querySelector(sel);
  if (!el) return { name, present: false };
  // focus({focusVisible:true}) 会真的把元素置成 focus-visible 态，
  // 于是这里读到的是「键盘走到这颗键上时，浏览器实际画出来的那圈线」。
  el.focus({ focusVisible: true });
  const own = getComputedStyle(el);
  return {
    name,
    present: true,
    focused: document.activeElement === el,
    focusVisible: el.matches(':focus-visible'),
    outline: `${own.outlineWidth} ${own.outlineStyle} ${own.outlineColor}`,
    offset: own.outlineOffset,
    boxShadow: own.boxShadow.slice(0, 60),
    borderColor: own.borderTopColor,
    focusVisibleRule: covered(el),
  };
});

// 组合框的键盘操作：方向键 → aria-activedescendant → Enter 定名
const input = document.querySelector('input[role="combobox"]');
if (input) {
  input.focus();
  const send = (key) => input.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
  out.comboboxAria = {
    role: input.getAttribute('role'),
    expanded: input.getAttribute('aria-expanded'),
    controls: input.getAttribute('aria-controls'),
  };
  send('ArrowDown');
  await new Promise((r) => setTimeout(r, 120));
  out.afterArrowDown = {
    activeDescendant: input.getAttribute('aria-activedescendant'),
    activeCell: document.querySelector('.mp-cell[data-active="true"]')?.textContent.trim() ?? null,
  };
  send('Enter');
  await new Promise((r) => setTimeout(r, 200));
  out.committedValue = input.value;
  out.startEnabledAfterPick = !document.querySelector('.btn.arm.xl.wide')?.disabled;
  const clear = document.querySelector('.mp-clear');
  if (clear) {
    clear.click();
    await new Promise((r) => setTimeout(r, 200));
  }
  out.clearedBackTo = input.value;
  out.startDisabledAgain = document.querySelector('.btn.arm.xl.wide')?.disabled;
}

return out;
