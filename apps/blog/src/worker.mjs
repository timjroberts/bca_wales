import { HttpError, requireThat, readJson, readBytes } from './errors.mjs';
import { first, publicArticle, publicIndex, deliverMedia, checkAuthority, rows, createPost, saveDraft, draft, publish, withdraw, renameSlug, preview } from './storage.mjs';
import { pageHtml, articleHtml, indexHtml } from './html.mjs';
import { escapeHtml } from './document.mjs';
import { authEnabled, beginLogin, completeLogin, session, csrfToken, mutation, logout, verifySignedRequest } from './auth.mjs';
import { listComments, commentCapabilities, submitComment, moderateComment, inspectComment, deleteComment } from './comments.mjs';
import { createBackup, expireBackups } from './backup.mjs';
import { uploadImage, imageDetails } from './media.mjs';
import { privacyHtml } from './privacy.mjs';
import { monitorHealth, recordMaintenance } from './health.mjs';
import { flushOutbox, requestErasure, maintenance } from './recovery.mjs';

export const json = (value, status = 200) => Response.json(value, { status });
export const html = value => new Response(value, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
async function route(request, env) {
  const url = new URL(request.url), path = url.pathname;
  const origin = new URL(env.ORIGIN);
  if (url.origin !== origin.origin) {
    if (['GET','HEAD'].includes(request.method) && ['bca.wales','www.bca.wales'].includes(url.hostname) && origin.origin === 'https://bca.wales' && !/^\/(auth|api|preview|media)\//.test(path)) return new Response(null, { status: 308, headers: { Location: `${env.ORIGIN}${path}${url.search}` } });
    throw new HttpError(400, 'Unexpected origin');
  }
  // Public policy and its fixed stylesheet stay readable during recovery, without D1/R2 access.
  if (['/privacy', '/privacy/', '/blog/privacy', '/blog/privacy/'].includes(path)) {
    requireThat(['GET', 'HEAD'].includes(request.method), 405, 'Method not allowed');
    if (path !== '/privacy') return new Response(null, { status: 308, headers: { Location: '/privacy' } });
    return html(privacyHtml(env));
  }
  if (path === '/static/blog.css' && ['GET', 'HEAD'].includes(request.method) && env.ASSETS) {
    const assetUrl = new URL(request.url); assetUrl.pathname = '/blog.css';
    return env.ASSETS.fetch(new Request(assetUrl, request));
  }
  if (path === '/api/ops/health') return monitorHealth(request, env);
  requireThat(env.RESTRICTED !== 'true' && (await first(env, "SELECT value FROM settings WHERE key='restricted'"))?.value !== 'true', 503, 'Blog temporarily unavailable during recovery');
  const reading = ['GET','HEAD'].includes(request.method);
  if (path === '/auth/login' && request.method === 'POST') return beginLogin(request, env);
  if (path === '/auth/callback' && request.method === 'GET') return completeLogin(request, env);
  if (['/auth/deletion','/auth/deauthorize'].includes(path) && request.method === 'POST') {
    requireThat(authEnabled(env), 503, 'Facebook lifecycle callback is not configured');
    requireThat(request.headers.get('content-type')?.split(';')[0] === 'application/x-www-form-urlencoded', 415);
    const params = new URLSearchParams(new TextDecoder().decode(await readBytes(request, 20000)));
    requireThat(params.getAll('signed_request').length === 1, 400);
    const subject = await verifySignedRequest(env, params.get('signed_request'));
    const result = await requestErasure(env, subject, params.get('signed_request'));
    return json({ url: `${env.ORIGIN}/deletion-status/${result.id}`, confirmation_code: result.id });
  }
  if (path.startsWith('/deletion-status/') && reading) {
    const job = await first(env, 'SELECT status FROM deletion_jobs WHERE id=?', path.slice(17)); requireThat(job, 404, 'Not found');
    return html(pageHtml(env, { title: 'Data deletion', private: true, html: `<h1>Data deletion</h1><p>${job.status === 'complete' ? 'Live data deletion is complete. Protected backups expire within 30 days.' : 'Deletion is pending. If it has been more than 24 hours, email <a href="mailto:bca@timjroberts.com">bca@timjroberts.com</a>.'}</p>` }));
  }
  if (path === '/api/session' && reading) {
    const actor = await session(request, env, true);
    if (!actor) return json({ authenticated: false, loginEnabled: authEnabled(env) });
    let administrator = true; try { await checkAuthority(env, actor); } catch (error) { if (error.status !== 403) throw error; administrator = false; }
    return json({ authenticated: true, administrator, name: actor.attribution.name, subject: actor.subject, csrf: await csrfToken(env, actor), expiresAt: actor.exp });
  }
  if (path === '/api/logout' && request.method === 'POST') {
    const actor = await session(request, env); await mutation(request, env, actor);
    const cleared = await logout(env, actor); await flushOutbox(env);
    return new Response(null, { status: 204, headers: { 'Set-Cookie': cleared } });
  }
  if (path === '/api/account/delete' && request.method === 'POST') {
    const actor = await session(request, env); await mutation(request, env, actor);
    const body = await readJson(request, 1000); requireThat(body.confirm === 'DELETE MY CONTRIBUTIONS', 422, 'Confirm permanent deletion');
    const result = await requestErasure(env, actor.subject, `${actor.sid}:${request.headers.get('idempotency-key') || 'delete-contributions'}`); return json({ statusUrl: `/deletion-status/${result.id}` }, 202);
  }
  const image = path.match(/^\/api\/blog\/posts\/([a-f0-9-]{36})\/images\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/);
  if (image && reading) return json(await imageDetails(env,image[1],image[2],image[3],Number(url.searchParams.get('index') || 0)));
  const comments = path.match(/^\/api\/blog\/posts\/([a-f0-9-]{36})\/comments(?:\/(capabilities))?$/);
  if (comments) {
    if (reading && !comments[2]) return json(await listComments(env, comments[1], url.searchParams.get('after')));
    const actor = await session(request, env);
    if (reading && comments[2]) return json(await commentCapabilities(env, actor, comments[1]));
    requireThat(request.method === 'POST' && !comments[2], 405); await mutation(request, env, actor);
    return json(await submitComment(env, actor, comments[1], await readJson(request, 16000), request.headers.get('idempotency-key'), request.headers.get('cf-connecting-ip')), 201);
  }
  const ownComment = path.match(/^\/api\/comments\/([a-f0-9-]{36})$/);
  if (ownComment && request.method === 'DELETE') {
    const actor = await session(request, env); await mutation(request, env, actor);
    const result = await deleteComment(env, actor, ownComment[1], request.headers.get('idempotency-key')); await flushOutbox(env); return json(result);
  }
  if (path.startsWith('/api/admin/')) {
    const actor = await session(request, env); await checkAuthority(env, actor);
    if (!reading) await mutation(request, env, actor);
    if (path === '/api/admin/health' && reading) return json({ pendingErasure:(await first(env,"SELECT COUNT(*) AS n FROM deletion_jobs WHERE status!='complete'")).n,pendingRecovery:(await first(env,'SELECT COUNT(*) AS n FROM recovery_outbox WHERE delivered_at IS NULL')).n,staleStaging:(await first(env,'SELECT COUNT(*) AS n FROM staging WHERE expires_at<?',Math.floor(Date.now()/1000))).n,lastBackup:Number((await first(env,"SELECT value FROM settings WHERE key='last_backup'"))?.value||0) });
    if (path === '/api/admin/posts') {
      if (reading) return json(await rows(env, 'SELECT id,slug,version,state,draft_revision AS draftRevision,public_revision AS publicRevision FROM posts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 200'));
      requireThat(request.method === 'POST', 405); return json(await createPost(env, actor, await readJson(request, 1000), request.headers.get('idempotency-key')), 201);
    }
    const upload = path.match(/^\/api\/admin\/posts\/([a-f0-9-]{36})\/images$/);
    if (upload && request.method === 'POST') {
      requireThat(['true','false'].includes(request.headers.get('x-image-sensitive')), 422, 'Review sensitivity');
      return json(await uploadImage(env, actor, upload[1], await readBytes(request, 10*1024*1024), { type:request.headers.get('content-type'),sensitive:request.headers.get('x-image-sensitive') === 'true',placeholder:request.headers.get('x-image-placeholder') || 'pixel' }, request.headers.get('idempotency-key')),201);
    }
    const post = path.match(/^\/api\/admin\/posts\/([a-f0-9-]{36})(?:\/(save|publish|unpublish|delete|slug|preview))?$/);
    if (post) {
      if (reading && !post[2]) return json(await draft(env, actor, post[1]));
      requireThat(request.method === 'POST' && post[2], 405); const body = await readJson(request), key = request.headers.get('idempotency-key');
      if (post[2] === 'preview') return json(await preview(env, actor, post[1], body.source));
      if (post[2] === 'delete') requireThat(body.confirm === 'DELETE POST', 422, 'Confirm permanent post deletion');
      const handler = { save: saveDraft, publish, unpublish: withdraw, delete: (e,a,id,b,k) => withdraw(e,a,id,b,k,true), slug: renameSlug }[post[2]];
      const result = await handler(env, actor, post[1], body, key);
      if (['unpublish','delete'].includes(post[2])) await flushOutbox(env);
      return json(result);
    }
    const comment = path.match(/^\/api\/admin\/comments\/([a-f0-9-]{36})\/(inspect|moderate)$/);
    if (comment) {
      requireThat(request.method === 'POST', 405);
      if (comment[2] === 'inspect') return json(await inspectComment(env, actor, comment[1]));
      const result = await moderateComment(env, actor, comment[1], await readJson(request, 2000), request.headers.get('idempotency-key')); await flushOutbox(env); return json(result);
    }
    throw new HttpError(404, 'Not found');
  }
  if (path.startsWith('/preview/media/') && reading) return deliverMedia(env, request, path.slice(15).split('/'), await session(request, env));
  requireThat(reading, 405, 'Method not allowed');
  if (path.startsWith('/static/') && env.ASSETS) { const assetUrl = new URL(request.url); assetUrl.pathname = path.slice(7); return env.ASSETS.fetch(new Request(assetUrl, request)); }
  if (path === '/') return html(pageHtml(env, { html: '<h1>BCA Wales</h1><p>Landscape, community and recovery.</p><p><a data-nav href="/blog/">Read the blog</a> · <a href="https://explore.bca.wales">Explore the landscape</a></p>' }));
  if (path === '/api/blog/posts') return json(await publicIndex(env));
  if (path.startsWith('/media/')) return deliverMedia(env, request, path.slice(7).split('/'));
  if (path === '/account/') return html(pageHtml(env, { title:'Your account', private:true, html:'<h1>Your account</h1><p>Loading account controls…</p><noscript>Enable JavaScript to sign in with Facebook.</noscript>' }));
  if (path === '/admin/') { const actor = await session(request,env); await checkAuthority(env,actor); return html(pageHtml(env,{ title:'Manage posts',private:true,html:'<h1>Manage posts</h1><p>Loading editor…</p>' })); }
  if (path.startsWith('/admin') || path.startsWith('/preview') || path.startsWith('/api/admin')) throw new HttpError(401, 'Sign in required');
  if (path === '/blog/guidelines/') return html(pageHtml(env,{ title:'Community guidelines',html:'<h1>Community guidelines</h1><p>Comments appear immediately. Keep discussion relevant and respectful. Do not post abuse, harassment, identifying personal information, discriminatory language or spam. Administrators may hide nonconforming comments with a private reason and may restore them. Only you can permanently delete your own comments; administrators cannot restore deleted text.</p><p>Hiding changes the next authoritative read. Already displayed screens, external copies and social-network caches cannot be recalled.</p>' }));
  if (path === '/blog') return new Response(null, { status: 308, headers: { Location: '/blog/' } });
  if (path === '/blog/') return html(pageHtml(env, { html: indexHtml(await publicIndex(env)) }));
  const match = path.match(/^\/(api\/blog\/posts|blog)\/([a-z0-9-]+)\/?$/);
  if (match) {
    const article = await publicArticle(env, match[2]);
    if (article.redirect) return new Response(null, { status: 308, headers: { Location: match[1].startsWith('api') ? `/api/blog/posts/${article.redirect.split('/')[2]}` : article.redirect } });
    if (match[1] === 'api/blog/posts') return json(article);
    if (!path.endsWith('/')) return new Response(null, { status: 308, headers: { Location: `${path}/` } });
    return html(pageHtml(env, { ...article, article: true, html: articleHtml(article) }));
  }
  throw new HttpError(404, 'Not found');
}
const worker = {
  async scheduled(_event, env) {
    try {
      const result = await maintenance(env);
      if(env.BACKUPS_ENABLED === 'true') {
        const last = Number((await first(env, "SELECT value FROM settings WHERE key='last_backup'"))?.value || 0);
        if(Date.now()/1000-last>=86400) await createBackup(env);
        await expireBackups(env);
      }
      const stale = await first(env, 'SELECT COUNT(*) AS n FROM staging WHERE expires_at<?', Math.floor(Date.now()/1000));
      if(result.pendingDeletion || stale.n) throw new Error('Blog maintenance needs operator attention');
      await recordMaintenance(env, 'success');
    } catch {
      try { await recordMaintenance(env, 'failure'); } catch { /* A failed database write is detected by the stale success marker. */ }
      throw new Error('Blog maintenance failed or needs attention; inspect the private operator status.');
    }
  },
  async fetch(request, env) {
    let response;
    try { response = await route(request, env); }
    catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      const message = error instanceof HttpError ? error.message : 'Temporarily unavailable. Please retry.';
      // Never log exception details: storage/provider errors can carry private values.
      response = new URL(request.url).pathname.startsWith('/api/') ? json({ error: message }, status) : new Response(`<!doctype html><html lang="en"><meta name="robots" content="noindex"><title>${status}</title><main><h1>${status}</h1><p>${escapeHtml(message)}</p><a href="/blog/">Blog</a></main></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'same-origin');
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (response.status === 503 || response.status === 429) headers.set('Retry-After', '60');
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
  }
};

export default worker;
