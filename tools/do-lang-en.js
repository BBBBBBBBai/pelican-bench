// 切到英文，然后**不切回来** —— 这样紧接着的截图才是真的英文界面。
// 用完必须再用 tools/do-lang-zh.js 跑一次把它切回去（切语言会 PATCH config.json 的 uiLang）。
// 用法：node tools/edge-cdp.mjs shot <url> <out.png> --expand --do=tools/do-lang-en.js
const en = [...document.querySelectorAll('.busbar .sw button')].find(
  (b) => b.textContent.trim() === 'EN',
);
if (!en) return { switched: false };
if (en.getAttribute('aria-pressed') !== 'true') {
  en.click();
  await new Promise((r) => setTimeout(r, 700));
}
return { switched: true, htmlLang: document.documentElement.lang };
