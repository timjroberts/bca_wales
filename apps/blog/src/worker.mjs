import { HttpError, requireThat } from './errors.mjs';
import { first, publicArticle, publicIndex, deliverMedia } from './storage.mjs';
import { pageHtml, articleHtml, indexHtml } from './html.mjs';
import { escapeHtml } from './document.mjs';

export const json = (value, status = 200) => Response.json(value, { status });
export const html = value => new Response(value, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
async function route(request, env) {
  const url = new URL(request.url), path = url.pathname;
  const origin = new URL(env.ORIGIN);
  if (url.origin !== origin.origin) {
    if (['GET','HEAD'].includes(request.method) && ['bca.wales','www.bca.wales'].includes(url.hostname) && origin.origin === 'https://bca.wales' && !/^\/(auth|api|preview|media)\//.test(path)) return new Response(null, { status: 308, headers: { Location: `${env.ORIGIN}${path}${url.search}` } });
    throw new HttpError(400, 'Unexpected origin');
  }
  requireThat(env.RESTRICTED !== 'true' && (await first(env, "SELECT value FROM settings WHERE key='restricted'"))?.value !== 'true', 503, 'Blog temporarily unavailable during recovery');
  requireThat(['GET','HEAD'].includes(request.method), 405, 'Method not allowed');
  if (path.startsWith('/static/') && env.ASSETS) return env.ASSETS.fetch(request);
  if (path === '/') return html(pageHtml(env, { html: '<h1>BCA Wales</h1><p>Landscape, community and recovery.</p><p><a data-nav href="/blog/">Read the blog</a> · <a href="https://explore.bca.wales">Explore the landscape</a></p>' }));
  if (path === '/api/blog/posts') return json(await publicIndex(env));
  if (path === '/api/session') return json({ authenticated: false, loginEnabled: false });
  if (path.startsWith('/media/')) return deliverMedia(env, request, path.slice(7).split('/'));
  if (path.startsWith('/admin') || path.startsWith('/preview') || path.startsWith('/api/admin')) throw new HttpError(401, 'Sign in required');
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
