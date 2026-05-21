import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * The extension is built in three independent passes because each artifact has
 * incompatible output requirements:
 *
 *  - `content`    -> a single self-contained IIFE bundle (content scripts cannot
 *                    be ES modules and must not leak globals into the page).
 *  - `background` -> an ES module (MV3 service worker / Firefox module script).
 *  - `popup`      -> a normal HTML + React app.
 *
 * `scripts/build.mjs` orchestrates the passes, selecting one via BUILD_TARGET
 * and the destination browser via BROWSER.
 */
const target = process.env.BUILD_TARGET || 'popup';
const browser = process.env.BROWSER || 'chrome';
const isProd = process.env.NODE_ENV === 'production';

const projectRoot = process.cwd();
const outRoot = resolve(projectRoot, 'dist', browser);
const srcAlias = { '@': resolve(projectRoot, 'src') };

const shared = {
  resolve: { alias: srcAlias },
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    __DEV__: JSON.stringify(!isProd),
  },
};

export default defineConfig(() => {
  if (target === 'content') {
    return {
      ...shared,
      build: {
        outDir: outRoot,
        emptyOutDir: false,
        sourcemap: !isProd,
        target: 'es2020',
        minify: isProd,
        lib: {
          entry: resolve(projectRoot, 'src/content/index.ts'),
          name: 'FloatTubeContent',
          formats: ['iife'],
          fileName: () => 'content.js',
        },
      },
    };
  }

  if (target === 'background') {
    return {
      ...shared,
      build: {
        outDir: outRoot,
        emptyOutDir: false,
        sourcemap: !isProd,
        target: 'es2020',
        minify: isProd,
        lib: {
          entry: resolve(projectRoot, 'src/background/service-worker.ts'),
          formats: ['es'],
          fileName: () => 'background.js',
        },
      },
    };
  }

  // popup
  return {
    ...shared,
    root: resolve(projectRoot, 'src/popup'),
    base: './',
    plugins: [react()],
    build: {
      outDir: resolve(outRoot, 'popup'),
      emptyOutDir: false,
      sourcemap: !isProd,
      target: 'es2020',
      minify: isProd,
    },
  };
});
