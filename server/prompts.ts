import fs from 'node:fs';
import type { PromptEntry, PromptPool } from '../shared/types.ts';
import { getPromptsPath } from './config.ts';

export const DEFAULT_PROMPTS: PromptPool = {
  animals: [
    '鹈鹕',
    '水豚',
    '穿山甲',
    '鸭嘴兽',
    '树懒',
    '袋鼠',
    '犀牛',
    '长颈鹿',
    '企鹅',
    '考拉',
    '羊驼',
    '河马',
    '海獭',
    '刺猬',
    '狐猴',
    '大熊猫',
    '章鱼',
    '蜗牛',
    '骆驼',
    '猫头鹰',
  ],
  template: '请生成一张 SVG 图片：一只骑着自行车的{animal}。只输出 SVG 代码，不要任何解释文字，不要 Markdown 代码块。',
  templateEn:
    'Generate an SVG image of a {animal} riding a bicycle. Output only the SVG code, with no explanation and no Markdown code fence.',
  extras: [
    {
      id: 'bicycle-only',
      label: '一辆自行车（无动物）',
      text: '请生成一张 SVG 图片：一辆自行车。只输出 SVG 代码，不要任何解释文字，不要 Markdown 代码块。',
    },
  ],
};

const ANIMALS_EN: Record<string, string> = {
  鹈鹕: 'pelican',
  水豚: 'capybara',
  穿山甲: 'pangolin',
  鸭嘴兽: 'platypus',
  树懒: 'sloth',
  袋鼠: 'kangaroo',
  犀牛: 'rhinoceros',
  长颈鹿: 'giraffe',
  企鹅: 'penguin',
  考拉: 'koala',
  羊驼: 'alpaca',
  河马: 'hippopotamus',
  海獭: 'sea otter',
  刺猬: 'hedgehog',
  狐猴: 'lemur',
  大熊猫: 'giant panda',
  章鱼: 'octopus',
  蜗牛: 'snail',
  骆驼: 'camel',
  猫头鹰: 'owl',
};

export function readPromptPool(): PromptPool {
  const file = getPromptsPath();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${JSON.stringify(DEFAULT_PROMPTS, null, 2)}\n`, 'utf8');
    return DEFAULT_PROMPTS;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<PromptPool>;
    const animals = Array.isArray(raw.animals) ? raw.animals.filter((a) => typeof a === 'string' && a.trim()) : [];
    return {
      animals: animals.length ? animals : DEFAULT_PROMPTS.animals,
      template: typeof raw.template === 'string' && raw.template ? raw.template : DEFAULT_PROMPTS.template,
      templateEn:
        typeof raw.templateEn === 'string' && raw.templateEn ? raw.templateEn : DEFAULT_PROMPTS.templateEn,
      extras: Array.isArray(raw.extras)
        ? raw.extras
            .filter((e): e is PromptEntry => Boolean(e && typeof e.text === 'string' && e.text.trim()))
            .map((e, i) => ({ id: e.id || `extra-${i}`, label: e.label || e.id || `额外题目 ${i + 1}`, text: e.text }))
        : [],
    };
  } catch (err) {
    console.error('[prompts] prompts.json 解析失败，使用内置题池：', err);
    return DEFAULT_PROMPTS;
  }
}

/** 把整池展开成可选题目列表 */
export function listPrompts(lang: 'zh' | 'en'): PromptEntry[] {
  const pool = readPromptPool();
  const tpl = lang === 'en' ? pool.templateEn : pool.template;
  const animalEntries: PromptEntry[] = pool.animals.map((animal) => {
    const display = lang === 'en' ? (ANIMALS_EN[animal] ?? animal) : animal;
    return {
      id: `animal:${animal}`,
      label: display,
      text: tpl.replaceAll('{animal}', display),
    };
  });
  return [...animalEntries, ...pool.extras.map((e) => ({ ...e, id: `extra:${e.id}` }))];
}

/** 随机抽一题；promptId 传入时按 id 精确取 */
export function pickPrompt(lang: 'zh' | 'en', promptId?: string): PromptEntry {
  const all = listPrompts(lang);
  if (promptId) {
    const found = all.find((p) => p.id === promptId);
    if (found) return found;
  }
  const idx = Math.floor(Math.random() * all.length);
  return all[idx] ?? all[0];
}
