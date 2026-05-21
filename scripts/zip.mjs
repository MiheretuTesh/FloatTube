/**
 * Packages a built `dist/<browser>` folder into a store-ready zip archive.
 */
import { createWriteStream } from 'node:fs';
import archiver from 'archiver';

/**
 * Zip the contents of `sourceDir` into `zipPath`.
 * @param {string} sourceDir directory whose *contents* go in the archive root
 * @param {string} zipPath   destination .zip path
 * @returns {Promise<number>} archive size in bytes
 */
export function createZip(sourceDir, zipPath) {
  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolvePromise(archive.pointer()));
    archive.on('warning', (err) => {
      if (err.code !== 'ENOENT') reject(err);
    });
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}
