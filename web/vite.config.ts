import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

export default defineConfig({
  root: here,
  /**
   * 相对路径产物。
   *
   * 部署在 Vercel 的根域名下时 `/` 和 `./` 没有区别；但一个以 `/` 开头的资源地址
   * 在子路径（项目页、内网某个目录、`vite preview` 挂在非根路径）下会指到别人的东西上。
   * 而这个产物就是一堆静态文件 —— 它不该挑自己被放在哪儿。
   */
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.join(root, 'shared'),
    },
  },
  server: {
    port: 5174,
    strictPort: false,
    open: false,
    watch: {
      // 编辑工具落盘走「写临时文件 + 原子改名」，临时产物形如
      // `.Foo.tsx.<pid>.<uuid>.tmpdir/Foo.tsx.tmp`。chokidar 会去 watch 它，
      // 而改名窗口里那个文件是锁住的 → EBUSY 直接把整个 dev server 打挂。
      // 这些临时产物永远不需要 HMR。
      ignored: ['**/.*.tmpdir/**', '**/*.tmp'],
    },
    proxy: {
      // 这两条是 `vercel.json` 里那两条 rewrite 的本地版。官方站不接受浏览器直连
      // （预检就被拒），部署到 Vercel 上由平台把 `/api-proxy/*` 转到上游；
      // 本地 dev 想走通这条路径，就得自己也转一次 —— 否则「经本站代理」这个开关
      // 在本地永远只有失败这一种结果，测不出真假。
      '/api-proxy/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api-proxy\/openai/, ''),
      },
      '/api-proxy/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api-proxy\/anthropic/, ''),
      },
    },
  },
  build: {
    outDir: path.join(root, 'dist', 'web'),
    emptyOutDir: true,
  },
});
