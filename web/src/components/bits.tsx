import { useEffect, useMemo, useState } from 'react';
import type { Flag, FlagCode, GenParams, RunRecord } from '@shared/types';
import type { T } from '../i18n';
import { Icon } from './Icon';

/* ────────────────────────────────────────────────────────────────────────────
   通道地址：这一次运行的永久引用。它在缩略图、标本页和截图里都一样，
   不随筛选、排序、删除而改变。
   ──────────────────────────────────────────────────────────────────────────── */

/** 机架 = 落盘那天。取 createdAt 的日期部分。 */
export function rackOf(record: RunRecord): string {
  return record.createdAt.slice(0, 10);
}

/** 排在后面落盘的记录（老记录或还没回填号）没有通道号，用一个稳定的下位替代。 */
export function channelOf(record: RunRecord, fallbackIndex = 0): number {
  return typeof record.channel === 'number' && record.channel > 0 ? record.channel : fallbackIndex + 1;
}

export function channelText(n: number): string {
  return String(n).padStart(2, '0');
}

/* ────────────────────────────────────────────────────────────────────────────
   指示灯：这个世界唯一发光的东西，它的颜色只陈述事实。
   ──────────────────────────────────────────────────────────────────────────── */

export type LampState = 'off' | 'ok' | 'warn' | 'fault' | 'live';

/* 红只留给「真出事」：请求打不通、超时、浏览器根本渲染不出来。
   截断、非 SVG、被中止、模型名不符都是琥珀——它们照样要看见，
   但不该把整面机架染红，更不该盖过画本身。（方向契约 OWN-WORLD） */
export const FAULT_FLAGS: FlagCode[] = ['http-error', 'timeout', 'render-failed'];

export function isFault(code: FlagCode): boolean {
  return FAULT_FLAGS.includes(code);
}

/** 只是把记录里已有的事实翻译成灯色，不做任何打分。 */
export function lampOf(record: RunRecord): LampState {
  if (record.flags.some((f) => isFault(f.code))) return 'fault';
  if (record.flags.length > 0) return 'warn';
  if (record.ok) return 'ok';
  return 'off';
}

export function Lamp({ state, title }: { state: LampState; title?: string }) {
  return <span className={`lamp ${state === 'off' ? '' : state}`} title={title} aria-hidden="true" />;
}

/* ────────────────────────────────────────────────────────────────────────────
   事实标记：刻在面板上的小铭牌，不是药丸。
   ──────────────────────────────────────────────────────────────────────────── */

/* 标记只有两种色调：出事（红）与要注意（琥珀）。同一条事实在格子的画面、
   灯和铭牌上必须是同一种颜色，否则一格之内会自相矛盾。 */
export function flagTone(code: FlagCode): 'fault' | 'warn' {
  return isFault(code) ? 'fault' : 'warn';
}

export function FlagTags({ flags, t }: { flags: Flag[]; t: T }) {
  /* 没有标记也要渲染这个容器：它占着一行固定高度，机架的行高才不会被
     「这一家恰好没出错」压矮。CSS 里 .tags 的 min-height 就是为它留的。 */
  return (
    <div className="tags">
      {flags.map((f) => (
        <span key={f.code} className={`tag ${flagTone(f.code)}`} title={f.detail}>
          {t(`flag.${f.code}`)}
        </span>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   拨档开关：选中那一档是陷进去的，不是亮起来的。
   ──────────────────────────────────────────────────────────────────────────── */

export function Switch<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (

    <div className="sw" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>

  );
}

/* ────────────────────────────────────────────────────────────────────────────
   格式：一切量化事实都靠这里产出，保证读数排版一致。
   ──────────────────────────────────────────────────────────────────────────── */

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTime(iso: string, lang: 'zh' | 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  const base = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  return lang === 'en' ? `${base}:${p(d.getSeconds())}` : base;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function paramsLine(p: Partial<GenParams>): string {
  const bits: string[] = [];
  if (typeof p.temperature === 'number') bits.push(`T=${p.temperature}`);
  if (typeof p.maxTokens === 'number') bits.push(`MAX=${p.maxTokens}`);
  if (typeof p.topP === 'number') bits.push(`TOPP=${p.topP}`);
  // 思考强度是这一趟真正发出去的档位，所以它跟 T=/MAX= 并排印在同一行 ——
  // 记录卡片一帧之内要能自证，而强度现在是逐次运行可变的，不印就不自证了。
  // 老的 `THINK` 布尔不再印：它已经被 effort 取代（而且它只对 Anthropic 生效过）。
  if (p.effort) bits.push(`EFFORT=${p.effort.toUpperCase()}`);
  return bits.join(' · ') || '—';
}

export function usageLine(usage: RunRecord['usage']): string {
  if (!usage) return '—';
  const parts: string[] = [];
  if (typeof usage.input === 'number') parts.push(`IN ${usage.input}`);
  if (typeof usage.output === 'number') parts.push(`OUT ${usage.output}`);
  if (typeof usage.total === 'number') parts.push(`TOT ${usage.total}`);
  return parts.join('  ') || '—';
}

/* ────────────────────────────────────────────────────────────────────────────
   复制：按下去有行程，复制完自己复原。
   ──────────────────────────────────────────────────────────────────────────── */

export function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(false), 1400);
    return () => window.clearTimeout(id);
  }, [done]);
  return (
    <button
      type="button"
      className="btn quiet"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(
          () => setDone(true),
          () => setDone(false),
        );
      }}
    >
      <Icon name={done ? 'check' : 'copy'} />
      {done ? copiedLabel : label}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   从记录里长出来的两个查找表，给筛选下拉用。
   ──────────────────────────────────────────────────────────────────────────── */

export function useProviderNames(records: RunRecord[]): string[] {
  return useMemo(() => {
    const set = new Set<string>();
    for (const r of records) set.add(r.providerName);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [records]);
}

export function usePromptLabels(records: RunRecord[]): Array<{ id: string; label: string }> {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records) if (!map.has(r.promptId)) map.set(r.promptId, r.promptLabel);
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [records]);
}
