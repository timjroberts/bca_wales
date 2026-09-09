export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireThat(condition, status = 400, message = 'Invalid request') {
  if (!condition) throw new HttpError(status, message);
}
export const now = () => Math.floor(Date.now() / 1000);
export const uuid = () => crypto.randomUUID();
export async function digest(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
export async function readJson(request, limit = 1048576) {
  requireThat(request.headers.get('content-type')?.split(';')[0] === 'application/json', 415, 'JSON required');
  const bytes = await readBytes(request, limit);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, 'Invalid JSON'); }
}
export async function readBytes(request, limit) {
  requireThat(Number(request.headers.get('content-length') || 0) <= limit, 413, 'Request too large');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new HttpError(413, 'Request too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
