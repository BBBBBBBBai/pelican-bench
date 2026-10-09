/* 把 .impeccable/review/adapt-sweep.txt 里每一档的 `--do` 结果压成一行。
   直接读文件，不重新起浏览器。 */
import { readFileSync } from 'node:fs';

const text = readFileSync('.impeccable/review/adapt-sweep.txt', 'utf8');
const blocks = text.split(/^=== (.+?) ===$/m).slice(1);
const rows = [];
for (let i = 0; i < blocks.length; i += 2) {
  const head = blocks[i].trim();
  const body = blocks[i + 1] ?? '';
  // 只按 `--do` 认行：PowerShell 的管道会把 `→` 从 UTF-8 二次解码成别的字符，
  // 拿箭头去比会对不上，而 JSON 体本身在（花括号之后全是 ASCII）。
  const line = body.split('\n').find((l) => l.startsWith('--do'));
  if (!line) {
    rows.push(`${head} | NO --do`);
    continue;
  }
  const j = JSON.parse(line.slice(line.indexOf('{')));
  rows.push(
    [
      head,
      `rows=${j.rows}`,
      `areas=${j.areas}`,
      `busH=${j.busbar.h}`,
      `railH=${j.rail.h}`,
      `line=${j.rail.lineLineH}`,
      `fullH=${j.rail.fullH}`,
      `panelW=${j.panel.w}`,
      `panelH=${j.panel.h}`,
      `mpGrid=${j.run.mpGrid.h}`,
      `startY=${j.startY}`,
      `first=${j.startInFirstScreen}`,
      `bandUnderRail=${j.stuck?.hitJustUnderRail ?? '-'}`,
    ].join(' | '),
  );
}
console.log(rows.join('\n'));
