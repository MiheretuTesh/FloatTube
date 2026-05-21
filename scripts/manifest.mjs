/**
 * Generates the per-browser manifest.
 *
 * Chromium and Firefox share Manifest V3 but differ in how the background
 * context is declared (service worker vs. background scripts) and in the
 * `browser_specific_settings` block. Keeping one generator avoids the two
 * manifests drifting apart.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(here, '..', 'package.json');

const ICONS = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
};

const COMMANDS = {
  'toggle-pip': {
    suggested_key: { default: 'Alt+Shift+P' },
    description: 'Toggle the floating Picture-in-Picture player',
  },
  'exit-pip': {
    suggested_key: { default: 'Alt+Shift+O' },
    description: 'Exit the floating player',
  },
  'focus-next-video': {
    suggested_key: { default: 'Alt+Shift+N' },
    description: 'Float the next detected video',
  },
};

/**
 * Build the manifest object for a given browser.
 * @param {'chrome'|'firefox'} browser
 */
export async function buildManifest(browser) {
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));

  /** Fields common to every engine. */
  const manifest = {
    manifest_version: 3,
    name: 'Universal Floating Video',
    short_name: 'FloatVideo',
    version: pkg.version,
    description: pkg.description,
    icons: ICONS,
    action: {
      default_popup: 'popup/index.html',
      default_title: 'Universal Floating Video',
      default_icon: ICONS,
    },
    // Least-privilege: only `storage` for settings. Page access is requested
    // via host_permissions because a *universal* video tool must run anywhere.
    permissions: ['storage'],
    host_permissions: ['<all_urls>'],
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        css: ['content.css'],
        // Inject into iframes too, so embedded players are detected even when
        // they are cross-origin (each frame gets its own content-script copy).
        all_frames: true,
        match_about_blank: true,
        run_at: 'document_idle',
      },
    ],
    commands: COMMANDS,
  };

  if (browser === 'firefox') {
    // Firefox MV3 uses background scripts (no service worker) and requires an
    // explicit add-on id.
    manifest.background = { scripts: ['background.js'], type: 'module' };
    manifest.browser_specific_settings = {
      gecko: {
        id: 'universal-floating-video@floattube.app',
        strict_min_version: '128.0',
      },
    };
  } else {
    // Chromium MV3 service worker, loaded as an ES module.
    manifest.background = { service_worker: 'background.js', type: 'module' };
    manifest.minimum_chrome_version = '111';
  }

  return manifest;
}

/** Write `manifest.json` into `outDir`. */
export async function generateManifest(browser, outDir) {
  const manifest = await buildManifest(browser);
  await writeFile(
    resolve(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}
