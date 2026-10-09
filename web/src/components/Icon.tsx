/**
 * 自绘图标。
 *
 * 规矩：16 格网格、1.5 描边、方头方角、绝不用 Unicode 字符或 emoji 冒充图标。
 * 图标只出现在塞不下文字的地方（关闭、复制、下载、删除、停止）。
 */

type IconName = 'x' | 'copy' | 'download' | 'trash' | 'stop' | 'check' | 'chevron' | 'key';

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  /** 纯装饰时传 true，图标旁的文字已经说明动作 */
  decorative?: boolean;
}

const PATHS: Record<IconName, JSX.Element> = {
  x: (
    <>
      <path d="M3.5 3.5 L12.5 12.5" />
      <path d="M12.5 3.5 L3.5 12.5" />
    </>
  ),
  copy: (
    <>
      <rect x="2.5" y="5.5" width="8" height="8" />
      <path d="M5.5 5.5 L5.5 2.5 L13.5 2.5 L13.5 10.5 L10.5 10.5" />
    </>
  ),
  download: (
    <>
      <path d="M8 2 L8 10" />
      <path d="M4.5 6.5 L8 10 L11.5 6.5" />
      <path d="M2.5 13.5 L13.5 13.5" />
    </>
  ),
  trash: (
    <>
      <path d="M2.5 4.5 L13.5 4.5" />
      <path d="M3.5 4.5 L4.5 13.5 L11.5 13.5 L12.5 4.5" />
      <path d="M6.5 7 L6.5 11" />
    </>
  ),
  stop: <rect x="4" y="4" width="8" height="8" />,
  check: <path d="M3 8.5 L6.5 12 L13 4" />,
  chevron: <path d="M5.5 3.5 L10.5 8 L5.5 12.5" />,
  key: (
    <>
      <circle cx="5.5" cy="10.5" r="3" />
      <path d="M7.6 8.4 L13 3" />
      <path d="M10.5 5.5 L12.5 7.5" />
    </>
  ),
};

export function Icon({ name, size = 14, className, decorative = true }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      style={{ flex: 'none', display: 'block' }}
    >
      {PATHS[name]}
    </svg>
  );
}
