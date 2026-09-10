// Standalone rehearsal Worker. No application storage, login or user uploads.
import fixtures from './images-probe-fixtures.json';
import { imageType, stripPngMetadata } from '../src/media.mjs';

const probe = {
  async fetch(request, env) {
    const reply = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
    const deadline = Number(env.PROBE_UNTIL), time = Date.now() / 1000;
    if (!Number.isSafeInteger(deadline) || deadline <= time || deadline > time + 1800 || !/^[A-Za-z0-9_-]{43}$/.test(env.PROBE_TOKEN || '') || request.headers.get('authorization') !== `Bearer ${env.PROBE_TOKEN}`) return reply({ error: 'Unavailable' }, 404);
    const url = new URL(request.url);
    const match = /^\/probe\/([0-2])$/.exec(url.pathname);
    if (request.method !== 'POST' || !match || url.search || request.body !== null) return reply({ error: 'Invalid request' }, 400);
    const start = Date.now();
    try {
      const fixture = fixtures[Number(match[1])];
      const bytes = Uint8Array.from(atob(fixture.base64), c => c.charCodeAt(0));
      const stream = () => new Blob([bytes]).stream();
      if (bytes.length > 10 * 1024 * 1024 || imageType(bytes) !== fixture.type) throw Error();
      const info = await env.IMAGES.info(stream());
      if (info.format !== fixture.type || info.width !== fixture.width || info.height !== fixture.height) throw Error();
      const results = [];
      for (const width of [640, 1280, 1920, 16]) {
        const options = width === 16 ? { width: 16, height: 16, fit: 'scale-down' } : { width: Math.min(width, info.width), fit: 'scale-down' };
        const output = await env.IMAGES.input(stream()).transform(options).output({ format: 'image/png', anim: false });
        const response = output.response();
        if (!response.ok) throw Error();
        const clean = stripPngMetadata(new Uint8Array(await response.arrayBuffer()));
        if (clean.length > 10 * 1024 * 1024) throw Error();
        const decoded = await env.IMAGES.info(new Blob([clean]).stream());
        if (decoded.format !== 'image/png' || decoded.width < 1 || decoded.height < 1 || decoded.width > width || (width === 16 && decoded.height > 16)) throw Error();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', clean))].map(x => x.toString(16).padStart(2, '0')).join('');
        results.push({ width: decoded.width, height: decoded.height, bytes: clean.length, sha256: hash });
      }
      return reply({ passed: true, fixture: Number(match[1]), input: { format: info.format, width: info.width, height: info.height, bytes: bytes.length }, outputs: results, elapsedMilliseconds: Date.now() - start }, 200);
    } catch {
      return reply({ passed: false, fixture: Number(match[1]), elapsedMilliseconds: Date.now() - start }, 422);
    }
  }
};
export default probe;
