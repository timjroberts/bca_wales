export async function api(path, { method = 'GET', body, csrf, key, signal, headers = {} } = {}) {
  const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', signal, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(key ? { 'Idempotency-Key': key } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  let result; try { result = await response.json(); } catch { result = {}; }
  if (!response.ok) { const error = new Error(result.error || `Request failed (${response.status}). Keep your work and retry.`); error.status = response.status; throw error; }
  return result;
}
export function element(tag, text, props = {}) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; Object.assign(node,props); return node; }
export function button(text, action) { const b = element('button',text,{ type: 'button' }); b.addEventListener('click',action); return b; }
export function field(label, input) { const container = element('label',label); container.append(input); return container; }
export function report(message) { document.querySelector('#global-status').textContent = message; }
export async function login() {
  try { const { url } = await api('/auth/login', { method: 'POST', headers: { 'X-BCA-Login': '1' } }); location.assign(url); } catch (error) { report(error.message); }
}
export async function getSession() { try { return await api('/api/session'); } catch (error) { if (error.status === 401) return { authenticated: false, expired: true }; throw error; } }
export function rescue(value, name = 'bca-private-draft.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{ type: 'application/json' })); const a = element('a', '', { href: url, download: name }); a.click(); URL.revokeObjectURL(url);
}
