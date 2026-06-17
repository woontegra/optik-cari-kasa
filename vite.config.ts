import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import { copyFileSync, existsSync } from 'fs';
import path from 'path';

function copyAppIcon() {
  const src = path.resolve(__dirname, 'build/icon.ico');
  const dest = path.resolve(__dirname, 'dist-electron/icon.ico');
  if (existsSync(src)) {
    copyFileSync(src, dest);
  }
}

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          plugins: [
            {
              name: 'copy-app-icon',
              closeBundle: copyAppIcon,
            },
          ],
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
