const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const before = document.documentElement.lang;
const zh = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '中');
if (zh && before !== 'zh-CN') { zh.click(); await sleep(600); }
return JSON.stringify({ before, after: document.documentElement.lang });
