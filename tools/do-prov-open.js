// --do 文件：把供应商表单打开并留在打开态，供截图看真实样子。
// do-prov-slot.js 会在结尾关回去（它要量关闭轨迹），所以截图那张图拍不到表单。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const firstSlot = document.querySelector('.roster .slot');
if (firstSlot) firstSlot.click();
await sleep(150);

// 用「编辑供应商」进，这样表单里带真实数据，比空表单更能看出层级
const editBtn = [...document.querySelectorAll('.prov-slot-out button')].find(
  (b) => b.textContent.trim() === '编辑供应商',
);
if (editBtn) editBtn.click();
else {
  const addBtn = [...document.querySelectorAll('.bay-head button')].find((b) => b.textContent.trim() === '新建');
  addBtn?.click();
}
await sleep(500);
document.querySelector('.prov-slot')?.scrollIntoView({ block: 'center' });
await sleep(200);
return {
  open: document.querySelector('.prov-slot')?.classList.contains('open'),
  fields: [...document.querySelectorAll('.prov-slot-in input, .prov-slot-in select')].map((el) => ({
    id: el.id,
    value: el.value,
  })),
};
