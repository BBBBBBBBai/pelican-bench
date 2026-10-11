import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

export default defineConfig({
  // 与 vite.config.ts 同一个根。不写这一行的话 vitest 拿进程的当前目录当根，
  // 在仓库根跑 `npm test` 时 `src/**` 会指向一个不存在的地方（结果是一句
  // 「No test files found」，看起来像测试没写一样）。
  root: here,
  resolve: {
    alias: {
      '@shared': path.join(root, 'shared'),
    },
  },
  test: {
    // 这一套测试全是纯逻辑：SVG 抽取与清洗、记录读写（走 fake-indexeddb）、
    // zip 往返、代理路由判定。没有一样需要真实 DOM，所以不装 jsdom。
    //
    // 也**不挂** @vitejs/plugin-react：这些被测模块里没有一行 JSX，
    // 而插件是按 `vite` 的类型实例化的，vitest 自带一份自己的 vite ——
    // 挂上它换来的只是两个 vite 版本之间的类型打架。
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
