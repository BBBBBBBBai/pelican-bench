// Restores modelPresets to the exact pre-critique state read from config.json.
const r = await fetch('/api/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelPresets: ['gpt-6.1-sol', 'gpt-6-astra', 'deepseek-v4.1-flash'],
  }),
});
return { status: r.status, body: (await r.text()).slice(0, 400) };
