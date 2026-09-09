import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const packagePath = createRequire(import.meta.url).resolve('maplibre-gl/package.json');
const { version } = JSON.parse(await readFile(packagePath, 'utf8'));
// Copy both ESM files: Next's asset pipeline does not emit the worker's sibling.
// Versioned URLs keep an older cached page paired with its own worker build.
const destination = new URL(`../public/maplibre/${version}/`, import.meta.url);
await mkdir(destination, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(path.join(path.dirname(packagePath), 'dist', file), new URL(file, destination));
}
