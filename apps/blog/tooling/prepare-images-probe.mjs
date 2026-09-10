// Generates only local disposable assets; never deploys or creates credentials.
import sharp from 'sharp';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';

const directory = new URL('../dist/images-probe/', import.meta.url);
const fixtureFile = new URL('./images-probe-fixtures.json', import.meta.url);
const fixtures = [];
for (const [format, width, height] of [['jpeg', 6000, 4000], ['png', 320, 240], ['webp', 6000, 4000]]) {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 3;
    raw[offset] = x % 251; raw[offset + 1] = y % 241; raw[offset + 2] = (x + y) % 239;
  }
  const bytes = await sharp(raw, { raw: { width, height, channels: 3 } }).withMetadata({ exif: { IFD0: { Artist: 'Synthetic probe metadata' } } }).toFormat(format).toBuffer();
  if (bytes.length > 10 * 1024 * 1024) throw Error('Fixture exceeds application input limit');
  fixtures.push({ type: `image/${format}`, width, height, base64: bytes.toString('base64') });
}
await mkdir(directory, { recursive: true });
await writeFile(fixtureFile, JSON.stringify(fixtures), { flag: 'wx' });
try {
  await build({ entryPoints: [new URL('./images-probe-worker.mjs', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: new URL('worker.mjs', directory).pathname });
} finally { await rm(fixtureFile, { force: true }); }
await writeFile(new URL('wrangler.jsonc', directory), JSON.stringify({ name: 'bca-wales-blog-images-probe', main: 'worker.mjs', compatibility_date: '2026-08-01', workers_dev: true, preview_urls: false, observability: { enabled: false }, images: { binding: 'IMAGES' }, vars: { PROBE_UNTIL: '0' } }, null, 2) + '\n');
console.log(JSON.stringify({ generated: directory.pathname, fixtures: fixtures.map(({ type, width, height, base64 }) => ({ type, width, height, bytes: Buffer.byteLength(base64, 'base64') })), maximumDistinctTransformations: 12, deployed: false }));
