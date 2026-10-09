// select a provider so the run button gate is reachable, then pick a model
const slot = document.querySelector('.slot');
if (slot) slot.click();
await new Promise(r => setTimeout(r, 300));
const el = document.querySelector('.model-pick');
if (el) el.scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 350));
return {
  slotClicked: !!slot,
  selectedSlots: document.querySelectorAll('.slot[aria-selected="true"], .slot.on, .slot.sel').length,
};
