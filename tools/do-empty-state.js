// 空态核对：筛选组合到「一个都不匹配」时，.empty 与它的「重置」是不是真的出现、
// 点了之后是不是真的把五个筛选一起清掉。
// 用法：node tools/edge-cdp.mjs shot <url> <out.png> --do=tools/do-empty-state.js
const out = {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setPrompt = async (i) => {
  const sel = document.querySelector('.rail select');
  sel.value = sel.options[i].value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(260);
};

const detents = [...document.querySelectorAll('.rail .detents button')];
const sel = document.querySelector('.rail select');
out.providers = detents.map((b) => b.textContent.trim());
out.prompts = [...sel.options].map((o) => o.textContent.trim());

// 逐家供应商 × 第 2 个题目，找第一组空结果
out.trials = [];
let hit = null;
for (let p = 1; p < detents.length && !hit; p += 1) {
  detents[p].click();
  await sleep(220);
  await setPrompt(1);
  const n = document.querySelectorAll('.ch').length;
  out.trials.push(`${detents[p].textContent.trim()}/${sel.options[1].textContent.trim()}=${n}`);
  if (n === 0) hit = p;
}

out.emptyShown = Boolean(document.querySelector('.empty'));
if (out.emptyShown) {
  const empty = document.querySelector('.empty');
  out.emptyText = empty.innerText.replace(/\n+/g, ' | ');
  out.shownCounter = document.querySelector('.rail .read')?.textContent.trim();
  out.resetLabel = empty.querySelector('button')?.innerText.trim() ?? null;
  const reset = empty.querySelector('button');
  if (reset) {
    reset.click();
    await sleep(420);
  }
  out.cellsAfterReset = document.querySelectorAll('.ch').length;
  out.emptyGone = !document.querySelector('.empty');
  out.shownAfterReset = document.querySelector('.rail .read')?.textContent.trim();
  out.pressedAfterReset = [...document.querySelectorAll('.rail .detents button')]
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent.trim());
  out.promptAfterReset = document.querySelector('.rail select').selectedOptions[0].textContent.trim();
  out.resetButtonGone = !document.querySelector('.rail .btn.quiet');
}

return out;
