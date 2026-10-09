// Sets modelPresets to the 10-item factory default (shared/types.ts DEFAULT_MODEL_PRESETS).
const r = await fetch('/api/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelPresets: [
      'gpt-6.1-sol',
      'gpt-6-astra',
      'deepseek-v4.1-flash',
      'deepseek-v3.2-reasoner-preview',
      'claude-sonnet-4.6',
      'claude-opus-4.5',
      'gemini-3.1-pro',
      'gemini-2.5-flash',
      'qwen3.5-max',
      'glm-5.2',
    ],
  }),
});
return { status: r.status, body: (await r.text()).slice(0, 400) };
