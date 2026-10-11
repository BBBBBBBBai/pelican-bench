import type { PromptEntry, PromptPool } from './types';

/**
 * 内置题池。
 *
 * 这一段原本住在 `server/prompts.ts`，和后端一起被搬到了 shared —— 它一个字都不需要
 * 文件系统，纯数据 + 两个纯函数。搬到 shared 之后前端可以直接把它打进包里，
 * 于是「没有后端」这件事不再需要任何兜底：题池永远存在，prompts.json 只是可选的覆盖。
 *
 * 内容与原版逐字相同：20 种动物 + 一条「一辆自行车（无动物）」。
 */
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

/** 动物名的英文对照。题面里出现的是给模型看的词，所以这里必须翻。 */
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

/**
 * 把整池展开成可选题目列表。
 *
 * 与原版唯一的差别是签名：题池改为从外面传进来。原版内部调 `readPromptPool()` 读磁盘，
 * 现在题池的真源在 IndexedDB，而这一层保持纯函数 —— 好测，也好在别处复用。
 */
export function listPrompts(pool: PromptPool, lang: 'zh' | 'en'): PromptEntry[] {
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

/** 抽题失败时的最后一道兜底：题池被清空也不至于让一次运行崩在抽题上。 */
const FALLBACK_ENTRY: PromptEntry = {
  id: 'animal:鹈鹕',
  label: '鹈鹕',
  text: DEFAULT_PROMPTS.template.replaceAll('{animal}', '鹈鹕'),
};

/** 随机抽一题；promptId 传入时按 id 精确取 */
export function pickPrompt(pool: PromptPool, lang: 'zh' | 'en', promptId?: string): PromptEntry {
  const all = listPrompts(pool, lang);
  if (promptId) {
    const found = all.find((p) => p.id === promptId);
    if (found) return found;
  }
  if (all.length === 0) return FALLBACK_ENTRY;
  const idx = Math.floor(Math.random() * all.length);
  return all[idx] ?? all[0] ?? FALLBACK_ENTRY;
}
