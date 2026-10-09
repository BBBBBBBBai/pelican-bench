// 把界面切回中文 —— 任何切过语言的探针跑完都要用它收尾（切语言会 PATCH config.json 的 uiLang）。
// 用法：node tools/edge-cdp.mjs probe <url> --expr=... 之后单独跑
//      node tools/edge-cdp.mjs shot <url> <out.png> --do=tools/do-lang-zh.js
const zh = [...document.querySelectorAll('.busbar .sw button')].find(
  (b) => b.textContent.trim() === '中',
);
if (!zh) return { switched: false };
if (zh.getAttribute('aria-pressed') !== 'true') {
  zh.click();
  await new Promise((r) => setTimeout(r, 700));
}
return { switched: true, htmlLang: document.documentElement.lang };
