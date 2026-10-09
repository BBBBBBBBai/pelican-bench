/**
 * 拿真实记录回读一次服务端吐出来的 SVG，确认两件事同时成立：
 *   「渲染给人看」的那层：<rect> 的 rx/ry 被抹平，<ellipse> 的 rx/ry 原样保留
 *   「源码层」：落盘文件仍然带着 rx，没有被改写
 *
 * 为什么 smoke-sanitize 不够：它跑的是 mock-evil 那条人造样本，验证的是规则成立；
 * 这里跑的是用户真实调用留下的那幅画，验证的是规则落在真东西上也对。
 *
 * 需要服务在 8787 上跑着。用法：
 *   node tools/check-served.mjs [记录 id] [日期目录]
 */
import { readFileSync } from 'node:fs';
import { get } from 'node:http';

const ID = process.argv[2] ?? '20261007-003452-wwxim';
const DAY = process.argv[3] ?? '2026-10-06';
const API = 'http://127.0.0.1:8787';

function fetchSvg(id) {
  return new Promise((resolve, reject) => {
    get(`${API}/api/records/${id}/svg`, (r) => {
      let b = '';
      r.setEncoding('utf8');
      r.on('data', (d) => (b += d));
      r.on('end', () => resolve({ type: r.headers['content-type'] ?? '', body: b }));
    }).on('error', reject);
  });
}

const { type, body } = await fetchSvg(ID);
const raw = readFileSync(`data/records/${DAY}/${ID}.svg`, 'utf8');

const firstRect = (s) => (s.match(/<rect[^>]*>/i) ?? ['(none)'])[0];
const ellipsePairs = (s) =>
  [...s.matchAll(/<ellipse[^>]*>/gi)].map(
    (m) => `${(m[0].match(/\brx="([^"]*)"/) ?? [, '?'])[1]}/${(m[0].match(/\bry="([^"]*)"/) ?? [, '?'])[1]}`,
  );

const servedEllipses = ellipsePairs(body);
const rawEllipses = ellipsePairs(raw);

let failures = 0;
const check = (name, got, want) => {
  const pass = got === want;
  if (!pass) failures++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (!pass) console.log(`        实际: ${JSON.stringify(got)}\n        期望: ${JSON.stringify(want)}`);
};

console.log(`记录 ${ID}（${DAY}）· content-type: ${type}`);
check('带 image/svg+xml 内容类型', type.includes('image/svg+xml'), true);
console.log(`  服务出去的 rect : ${firstRect(body)}`);
console.log(`  落盘的 rect     : ${firstRect(raw)}`);
check('服务出去的 <rect> 已无 rx/ry', /<rect[^>]*\b(?:rx|ry)\s*=/i.test(body), false);
check('落盘源码仍保留 <rect> 的 rx（可回溯）', /<rect[^>]*\brx=/i.test(raw), true);
console.log(`  服务出去的 ellipse: ${servedEllipses.join(', ')}`);
check('服务出去的 <ellipse> 数量与落盘一致', servedEllipses.length, rawEllipses.length);
check('服务出去的 <ellipse> rx/ry 逐个保留', servedEllipses.join(','), rawEllipses.join(','));
check('服务出去的内容确实经过清洗（两者不再逐字节相同）', raw.trim() === body.trim(), false);

console.log(`\n${failures === 0 ? '全部通过' : `${failures} 项失败`}`);
if (failures > 0) process.exitCode = 1;