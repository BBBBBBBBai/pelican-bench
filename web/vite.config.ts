import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

export default defineConfig({
  root: here,
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
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        // SSE 需要关闭缓冲
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['cache-control'] = 'no-cache, no-transform';
          });
        },
      },
    },
  },
  build: {
    outDir: path.join(root, 'dist', 'web'),
    emptyOutDir: true,
  },
});
