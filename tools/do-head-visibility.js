/**
 * 量一件事：点「保存」的那一刻，「供应商」标题行到底在不在眼里。
 *
 * 背景：右栏 .panel-scroll 是自己的滚动容器（styles.css:1121-1125），而
 * 「供应商」标题行在它的最顶上，保存键在表单最底下（ControlPanel.tsx:386）。
 * 中间隔着名册（一行一个供应商）+ 编辑/删除行 + 六个字段。如果标题行那时候
 * 已经被滚出视野，那「把回执放到标题旁边」就是在一个看不见的地方显示回执。
 *
 * 用法：node tools/edge-cdp.mjs probe <url> --width=1440 --height=900 --do=tools/do-head-visibility.js
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const scroller = document.querySelector('.panel-scroll');
const section = document.querySelector('.panel .bay-section');
const head = section.querySelector('.bay-head');

// 打开编辑表单：选中第一个供应商，再按「编辑供应商」。
document.querySelector('.roster .slot')?.click();
await sleep(120);
const editBtn = [...document.querySelectorAll('.prov-slot-out button')].find((b) => b.textContent.trim());
editBtn?.click();
await sleep(600); // 抽屉打开 0.26s

const form = document.querySelector('.prov-form');
const saveBtn = form.querySelector('button[type="submit"]');

const geo = (tag) => {
  const s = scroller.getBoundingClientRect();
  const h = head.getBoundingClientRect();
  const v = saveBtn.getBoundingClientRect();
  return {
    tag,
    scrollTop: Math.round(scroller.scrollTop),
    panelView: { top: Math.round(s.top), bottom: Math.round(s.bottom), h: Math.round(s.height) },
    head: { top: Math.round(h.top), bottom: Math.round(h.bottom) },
    save: { top: Math.round(v.top), bottom: Math.round(v.bottom) },
    // 标题行下沿在视野上沿之上多少 px（正数 = 已经滚出去了）
    headPxAboveView: Math.round(s.top - h.bottom),
    headInView: h.bottom > s.top && h.top < s.bottom,
    saveInView: v.bottom > s.top && v.top < s.bottom,
  };
};

const out = {
  providerCount: document.querySelectorAll('.roster .slot').length,
  panelScrollHeight: scroller.scrollHeight,
  panelClientHeight: scroller.clientHeight,
  saveLabel: saveBtn.textContent.trim(),
  asFound: geo('刚打开表单'),
};

// 像真人一样：把面板滚到「保存键刚好露出来」
scroller.scrollTop += saveBtn.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom + 12;
await sleep(150);
out.scrolledToSave = geo('滚到保存键可见');

// 填完表单最可能的状态：面板滚到底
scroller.scrollTop = scroller.scrollHeight;
await sleep(150);
out.scrolledToBottom = geo('面板滚到底');

// 底部居中那条 toast 离保存键有多远（现在的实况）
out.toastVsSave = (() => {
  const v = saveBtn.getBoundingClientRect();
  const saveCenter = v.top + v.height / 2;
  const toastCenter = window.innerHeight - 22 - 20; // bottom:22px + 约 40px 高的一半
  return {
    saveCenterY: Math.round(saveCenter),
    toastCenterY: Math.round(toastCenter),
    gapPx: Math.round(toastCenter - saveCenter),
    viewportH: window.innerHeight,
  };
})();

scroller.scrollTop = 0;
return out;
