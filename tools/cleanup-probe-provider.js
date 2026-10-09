// 清掉截图探针留下的那个一次性供应商。走到名册里找它、选中、两段式删除。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const byText = (sel, texts) =>
  [...document.querySelectorAll(sel)].find((el) => texts.includes(el.textContent.trim())) ?? null;

const target = [...document.querySelectorAll('.slot')].find((s) =>
  s.querySelector('.slot-name')?.textContent.includes('zz-'),
);
if (!target) return { removed: false, roster: [...document.querySelectorAll('.slot-name')].map((n) => n.textContent) };
target.click();
await sleep(300);
byText('.prov-slot-out button', ['删除', 'DELETE'])?.click();
await sleep(250);
byText('.prov-slot-out button', ['确认删除', 'CONFIRM DELETE'])?.click();
await sleep(900);
return {
  removed: true,
  receipt: document.querySelector('.prov-receipt')?.textContent ?? null,
  roster: [...document.querySelectorAll('.slot-name')].map((n) => n.textContent),
};
