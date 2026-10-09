// 审计用：验证 server/runner.ts 的 modelMatches() 在真实模型名对上的行为。
// 目的：确认「前缀家族降级」是否会被漏判成干净成功。
// 跑法：node tools/probe-modelmatch.mjs
import { modelMatches } from '../server/runner.ts';

const cases = [
  ['gpt-4o', 'gpt-4o-mini'],
  ['gpt-4o-mini', 'gpt-4o'],
  ['gpt-6.1-sol', 'gpt-6.1-sol'],
  ['claude-sonnet-4-5-20250929', 'claude-sonnet-4-5'],
  ['gpt-4o', 'gpt-4o-2024-08-06'],
  ['deepseek-v3.2-reasoner-preview', 'deepseek-v3'],
  ['gpt-4o', 'gpt-3.5-turbo'],
  ['model-a', 'model-b'],
  ['gpt-4o', null],
];

for (const [a, b] of cases) {
  console.log(`${JSON.stringify(a)} -> ${JSON.stringify(b)} = ${modelMatches(a, b)}`);
}
