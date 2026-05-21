/**
 * Build orchestrator.
 *
 *   node scripts/build.mjs <chrome|firefox> [--watch] [--package]
 *
 * Runs the three Vite passes (popup, background, content) into
 * `dist/<browser>`, then writes the generated manifest and icons. With
 * `--watch` the passes stay live for development; with `--package` the result
 * is zipped for store submission.
 */
import { build } from 'vite';
import { rm, mkdir, cp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateManifest } from './manifest.mjs';
import { writeIcons } from './gen-icons.mjs';
import { createZip } from './zip.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const browser = process.argv[2] === 'firefox' ? 'firefox' : 'chrome';
const watch = process.argv.includes('--watch');
const pkg = process.argv.includes('--package');

// A watch build is a dev build; a one-shot build is a production build.
process.env.NODE_ENV = watch ? 'development' : 'production';

const outDir = resolve(root, 'dist', browser);
const configFile = resolve(root, 'vite.config.ts');

/** Vite passes, in dependency-free order. */
const TARGETS = ['popup', 'background', 'content'];

async function runVite(target) {
  process.env.BUILD_TARGET = target;
  process.env.BROWSER = browser;
  await build({
    configFile,
    logLevel: 'warn',
    build: watch ? { watch: {} } : {},
  });
}

async function main() {
  console.log(`\n▶ Building Universal Floating Video for ${browser}…`);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // Static assets first so a watch build has them immediately.
  await generateManifest(browser, outDir);
  await writeIcons(resolve(outDir, 'icons'));
  await cp(resolve(root, 'src/content/overlay.css'), resolve(outDir, 'content.css'));

  for (const target of TARGETS) {
    await runVite(target);
  }

  if (pkg) {
    const zipPath = resolve(root, 'dist', `floattube-${browser}-v${process.env.npm_package_version ?? 'dev'}.zip`);
    const bytes = await createZip(outDir, zipPath);
    console.log(`📦 Packaged ${(bytes / 1024).toFixed(1)} kB -> ${zipPath}`);
  }

  console.log(`✔ Done. Load the unpacked extension from: dist/${browser}`);
  if (watch) console.log('  Watching for changes… (Ctrl+C to stop)\n');
}

main().catch((err) => {
  console.error('✖ Build failed:', err);
  process.exit(1);
});
