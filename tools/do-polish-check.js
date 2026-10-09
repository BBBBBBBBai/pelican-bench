// 打磨收尾核对：disabled 三态的实算颜色 + 英文文案全量扫描。
// 注意：--do 的文件体就是 async 函数体，直接顶层 return，不要再包一层 IIFE
// （包了的话外层返回 undefined，工具就不打印 --do → 了）。
// 用法：node tools/edge-cdp.mjs shot <url> <out.png> --do=tools/do-polish-check.js
const out = {};

const probe = (el) => {
  const cs = getComputedStyle(el);
  return {
    color: cs.color,
    bg: cs.backgroundColor,
    border: cs.borderTopColor,
    shadow: cs.boxShadow,
  };
};

// 造一个游离元素，量的是真实层叠结果，不是猜的
const synth = (cls, disabled, wrap) => {
  const host = document.createElement(wrap || 'div');
  host.style.position = 'absolute';
  host.style.left = '-9999px';
  host.style.top = '0';
  if (wrap) host.className = cls.split(' ')[0];
  const b = document.createElement('button');
  b.type = 'button';
  b.className = wrap ? cls.split(' ').slice(1).join(' ') : cls;
  b.disabled = disabled;
  b.textContent = '开始生成';
  host.appendChild(b);
  document.body.appendChild(host);
  const r = probe(b);
  host.remove();
  return r;
};

// 1) 真实的首屏 disabled 主操作
const arm = document.querySelector('.btn.arm.xl.wide');
if (arm) {
  out.armDisabled = Object.assign(probe(arm), {
    label: arm.textContent.trim(),
    disabled: arm.disabled,
  });
}

// 2) ControlPanel「删除供应商」在 busy 时就是这一态
out.haltDisabled = synth('btn quiet halt', true);
out.haltEnabled = synth('btn quiet halt', false);

// 3) Switch 的 disabled（当前无渲染点，量一下规则本身）
out.swDisabled = synth('sw inner', true, 'sw');

// 4) 英文文案扫描：找像 i18n key 的漏网字符串
const langs = [...document.querySelectorAll('.busbar .sw button')];
const en = langs.find((b) => b.textContent.trim() === 'EN');
if (en) {
  en.click();
  await new Promise((r) => setTimeout(r, 600));
}
out.langSwitched = Boolean(en);
out.htmlLang = document.documentElement.lang;

const text = document.body.innerText;
const words = text.split(/[\s，。、：；「」（）()〔〕]+/);
const keyish = words.filter((w) => /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(w));
out.suspiciousKeys = [...new Set(keyish)];

out.enHead = document.querySelector('.busbar')?.innerText.replace(/\n+/g, ' | ');
out.enRail = document.querySelector('.rail')?.innerText.replace(/\n+/g, ' | ');
out.enChSilk = document.querySelector('.ch-silk')?.innerText.replace(/\n+/g, ' | ');
out.enPanel = document.querySelector('.panel')?.innerText.replace(/\n+/g, ' | ').slice(0, 400);

// 切语言会 PATCH config.json（uiLang），量完必须切回来，不留副作用
const zh = [...document.querySelectorAll('.busbar .sw button')].find(
  (b) => b.textContent.trim() === '中',
);
if (zh) {
  zh.click();
  await new Promise((r) => setTimeout(r, 600));
}
out.revertedToZh = document.documentElement.lang === 'zh';

return out;
