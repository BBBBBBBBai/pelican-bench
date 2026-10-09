/* 展开横杆之后，日期带还钉不钉得住？横杆展开有 350px，若把带子挤到身下就是回归。
   `stuck` 的判定不能只看第一条带子（滚过第一段它本来就该走），要列全部。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (v) => Math.round(v * 10) / 10;
const q = (s) => document.querySelector(s);
const bands = () => [...document.querySelectorAll('.rack-band')].map((b) => px(b.getBoundingClientRect().y));
const railBox = () => {
  const r = q('.rail').getBoundingClientRect();
  return { vpY: px(r.y), h: px(r.height), bottom: px(r.bottom) };
};

const out = { bandsAt0: bands() };

// 只展开横杆，条件不动，滚到画廊中段
q('.rail-toggle').click();
await sleep(500);
out.railOpen = railBox();
window.scrollTo(0, Math.round(q('.bay').getBoundingClientRect().top + window.scrollY + 1200));
await sleep(400);
out.openScrolled = { scrollY: Math.round(window.scrollY), rail: railBox(), bands: bands() };
// 有没有哪条带子正好钉在横杆下沿
out.pinnedUnderRail = out.openScrolled.bands.filter((y) => Math.abs(y - (out.openScrolled.rail.bottom + 1)) < 3);
// 带子有没有被横杆盖住（在横杆区间内）
out.bandsUnderRail = out.openScrolled.bands.filter((y) => y > 0 && y < out.openScrolled.rail.bottom - 2);
out.hitJustUnderRail = (() => {
  const el = document.elementFromPoint(180, Math.round(q('.rail').getBoundingClientRect().bottom) + 4);
  return el ? el.tagName + '.' + String(el.className).slice(0, 22) : null;
})();

// 收起后再量一次
q('.rail-toggle').click();
await sleep(500);
out.closedScrolled = { scrollY: Math.round(window.scrollY), rail: railBox(), bands: bands() };
out.closedPinned = out.closedScrolled.bands.filter((y) => Math.abs(y - (out.closedScrolled.rail.bottom + 1)) < 3);

// 「只看有异常的」开关（在 .rail-groups 里，不是 .rail-full 的直接子节点）
q('.rail-toggle').click();
await sleep(450);
const issues = [...document.querySelectorAll('.rail-groups .sw > button')].find((b) => /异常|ISSUE/i.test(b.textContent));
out.issuesFound = Boolean(issues);
issues?.click();
await sleep(500);
out.afterIssues = { cur: q('.rail-cur').textContent.trim(), shown: q('.rail-line .read').textContent.trim() };
return out;
