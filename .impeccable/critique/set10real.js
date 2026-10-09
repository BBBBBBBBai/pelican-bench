// Sets modelPresets to the EXACT factory list from shared/types.ts:196-207.
const r = await fetch('/api/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelPresets: [
      'gpt-6.1-sol',
      'gpt-6.1',
      'gpt-5.2-turbo',
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-1-20250805',
      'deepseek-v3.2-reasoner-preview',
      'gemini-2.5-pro',
      'qwen3-max',
      'glm-4.6',
      'kimi-k2-0905-preview',
    ],
  }),
});
return { status: r.status };
