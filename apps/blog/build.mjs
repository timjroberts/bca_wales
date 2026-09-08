import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir(new URL('./dist', import.meta.url), { recursive: true });
await build({ entryPoints: [new URL('./src/worker.mjs', import.meta.url).pathname], outfile: new URL('./dist/worker.mjs', import.meta.url).pathname, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, sourcemap: false });
