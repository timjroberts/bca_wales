import { authEnabled, verifySignedRequest } from './auth.mjs';
import { first } from './storage.mjs';
import { readBytes, requireThat } from './errors.mjs';
import { requestErasure } from './recovery.mjs';
import { pageHtml } from './html.mjs';

export const lifecycleCallback = path => ['/auth/deletion', '/auth/deauthorize'].includes(path);
export const deletionStatus = path => /^\/deletion-status\/[A-Za-z0-9_-]{43}$/.test(path);

export async function facebookLifecycle(request, env) {
  const path = new URL(request.url).pathname;
  if (lifecycleCallback(path)) {
    requireThat(request.method === 'POST', 405, 'Method not allowed');
    requireThat(authEnabled(env), 503, 'Facebook lifecycle callback is not configured');
    requireThat(request.headers.get('content-type')?.split(';')[0] === 'application/x-www-form-urlencoded', 415);
    const params = new URLSearchParams(new TextDecoder().decode(await readBytes(request, 20000)));
    requireThat(params.getAll('signed_request').length === 1, 400);
    const subject = await verifySignedRequest(env, params.get('signed_request'));
    const result = await requestErasure(env, subject, params.get('signed_request'));
    return Response.json({ url: `${env.ORIGIN}/deletion-status/${result.id}`, confirmation_code: result.id });
  }
  requireThat(deletionStatus(path), 404, 'Not found');
  requireThat(['GET', 'HEAD'].includes(request.method), 405, 'Method not allowed');
  const job = await first(env, 'SELECT status FROM deletion_jobs WHERE id=?', path.slice(17)); requireThat(job, 404, 'Not found');
  const message = job.status === 'complete' ? 'Live data deletion is complete. Protected backups expire within 30 days.' : 'Deletion is pending. If it has been more than 24 hours, email <a href="mailto:bca@timjroberts.com">bca@timjroberts.com</a>.';
  return new Response(pageHtml(env, { title: 'Data deletion', private: true, interactive: false, html: `<h1>Data deletion</h1><p>${message}</p>` }), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
