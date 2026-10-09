// --do 文件：键盘能不能走进这块编辑面、焦点环看得见吗、对比度够不够。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cfg = () => fetch('/api/config').then((r) => r.json());
const before = (await cfg()).modelPresets;

document.querySelector('.preset-head')?.scrollIntoView({ block: 'center' });
await sleep(300);

const out = {};

// ① 焦点环：手动 focus 到某个名字格，看 outline 是不是 1px 琥珀且内缩
const name = document.querySelector('.preset-name');
name.focus();
await sleep(200);
const cs = getComputedStyle(name);
out.focusRing = {
  outlineColor: cs.outlineColor,
  outlineWidth: cs.outlineWidth,
  outlineOffset: cs.outlineOffset,
  boxShadow: cs.boxShadow,
  isActive: document.activeElement === name,
};

// ② 键盘能不能走到叉上（Tab 序列）
const focusables = () => {
  const all = [...document.querySelectorAll('.preset-head button, .preset-list input, .preset-list button')];
  return all.length;
};
out.focusableCount = focusables();

// ③ 对比度：名字格文字 vs 自身底色
const lum = (rgb) => {
  const [r, g, b] = rgb.match(/\d+/g).map(Number).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, bg) => {
  const [l1, l2] = [lum(a), lum(bg)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
};
out.nameContrast = ratio(cs.color, cs.backgroundColor);
const dropBtn = document.querySelector('button.preset-drop');
const ds = getComputedStyle(dropBtn);
out.dropContrast = ratio(ds.color, ds.backgroundColor);

// ④ 表尾空槽不该是个落点
const tailDrop = document.querySelector('.preset-list > .preset-row:last-child .preset-drop');
out.tailDropTag = tailDrop.tagName.toLowerCase();
out.tailDropFocusable = tailDrop.tabIndex >= 0;

out.restoredStillSame = JSON.stringify((await cfg()).modelPresets) === JSON.stringify(before);
return out;
