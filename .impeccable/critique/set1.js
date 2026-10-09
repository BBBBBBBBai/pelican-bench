// Trims modelPresets to a single entry.
const r = await fetch('/api/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ modelPresets: ['gpt-6.1-sol'] }),
});
return { status: r.status, body: (await r.text()).slice(0, 400) };
