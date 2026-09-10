// Temporary staging entry point; normal builds always use src/worker.mjs.
import worker from '../src/worker.mjs';
export function admitted(request, env) {
  const url = new URL(request.url), deadline = Number(env.STAGING_IMAGE_UNTIL), time = Date.now() / 1000;
  return url.origin === env.ORIGIN && /^https:\/\/bca-wales-blog-staging\.[a-z0-9-]+\.workers\.dev$/.test(env.ORIGIN || '') && env.RESTRICTED === 'true' && env.PUBLISH_PAUSED === 'true' && env.AUTH_ENABLED === 'false' && Number.isSafeInteger(deadline) && deadline > time && deadline <= time + 1800 && /^[A-Za-z0-9_-]{43}$/.test(env.STAGING_IMAGE_TOKEN || '') && request.headers.get('x-bca-image-test') === env.STAGING_IMAGE_TOKEN;
}
const staging = {
  ...worker,
  async fetch(request, env) {
    if (!admitted(request, env)) return worker.fetch(request, env);
    const path = new URL(request.url).pathname;
    if (path === '/staging/image-ready' && request.method === 'GET') return Response.json({ ready: true }, { headers: { 'Cache-Control': 'private, no-store' } });
    const allowed = path === '/api/session' || path === '/api/admin/posts' || /^\/api\/admin\/posts\/[a-f0-9-]{36}(\/(images|save|publish|unpublish|delete|preview))?$/.test(path) || /^\/(preview\/)?media\//.test(path) || /^\/blog\/image-e2e-[a-z0-9-]+\/$/.test(path);
    if (!allowed) return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    // Only admitted test requests see these flags. Normal visitors remain closed.
    // Authentication, CSRF, administrator checks and storage logic are unchanged.
    return worker.fetch(request, { ...env, RESTRICTED: 'false', AUTH_ENABLED: 'true', PUBLISH_PAUSED: 'false' });
  }
};
export default staging;
