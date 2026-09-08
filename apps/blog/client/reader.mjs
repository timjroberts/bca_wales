import { api, button, element, field, getSession, login, report } from './api.mjs';
import { RevealStore, mountReveals } from './reveals.mjs';
let storage; try { storage = sessionStorage; } catch { report('Image choices are held in memory. Refresh may reset them.'); }
const store = new RevealStore(storage, report); let reset = () => {}, navigation = 0;
const buffers = new Map();
function attribution(target, data) {
  const name = data?.name || 'BCA Wales contributor';
  if (data?.link) target.append(element('a', name, { href: data.link, target: '_blank', rel: 'noopener noreferrer', ariaLabel: `${name} on Facebook (opens a new tab; access may be restricted)` })); else target.append(element('span', name));
}
async function renderComments(post, ticket) {
  const section = document.querySelector('#comments'); if (!section) return;
  const [page, account] = await Promise.all([api(`/api/blog/posts/${post}/comments`), getSession()]);
  if (ticket !== navigation) return;
  section.replaceChildren(element('h2','Comments'));
  const list = element('ol',undefined,{ className: 'comments' }); section.append(list);
  let capabilities = { deletable: [] };
  if (account.authenticated) capabilities = await api(`/api/blog/posts/${post}/comments/capabilities`);
  const draw = row => {
    const item = element('li',undefined,{ id: `comment-${row.id}` });
    if (row.status === 'visible') { const by = element('p'); attribution(by,row.attribution); item.append(by,element('p',row.body,{ className: 'comment-text' })); }
    else item.append(element('p',row.message));
    item.append(element('a','Permalink',{ href: `#comment-${row.id}` }));
    if (capabilities.deletable.includes(row.id)) item.append(button('Delete my comment', async () => {
      if (!confirm('Permanently delete this comment? Its text and attribution cannot be restored.')) return;
      try { await api(`/api/comments/${row.id}`,{ method:'DELETE',csrf:account.csrf,key:crypto.randomUUID() }); await renderComments(post,navigation); } catch (error) { report(error.message); }
    }));
    if (account.administrator && row.status !== 'deleted') item.append(button('Inspect / moderate', async () => {
      try {
        const original = await api(`/api/admin/comments/${row.id}/inspect`,{ method:'POST',csrf:account.csrf });
        const dialog = element('dialog'); dialog.append(element('h2','Private moderation'),element('p','This inspection is recorded. Hiding affects the next authoritative read; already displayed copies cannot be recalled.'),element('p',original.body,{ className:'comment-text' }));
        const select = element('select'); ['abuse/harassment','identifying personal information','discriminatory language','spam','other'].forEach(reason => select.append(element('option',reason,{ value:reason })));
        const explanation = element('input',undefined,{ maxLength:300 });
        dialog.append(field('Private reason',select),field('Explanation (required for other)',explanation));
        if (original.reason) dialog.append(element('p',`Previous reason: ${original.reason}`));
        const action = original.hidden ? 'restore' : 'hide';
        dialog.append(button(action === 'hide' ? 'Hide comment' : 'Restore comment', async () => {
          try { await api(`/api/admin/comments/${row.id}/moderate`,{ method:'POST',csrf:account.csrf,key:crypto.randomUUID(),body:{ action,version:original.version,reason:select.value,explanation:explanation.value } }); dialog.close(); await renderComments(post,navigation); } catch(error) { report(error.message); }
        }),button('Cancel',()=>dialog.close()));
        dialog.addEventListener('close',()=>dialog.remove()); document.body.append(dialog); dialog.showModal();
      } catch(error) { report(error.message); }
    }));
    list.append(item);
  };
  page.comments.forEach(draw);
  let cursor = page.next;
  const more = button('More comments',async () => { try { const next = await api(`/api/blog/posts/${post}/comments?after=${encodeURIComponent(cursor)}`); next.comments.forEach(draw); cursor = next.next; more.hidden = !cursor; } catch(error) { report(error.message); } }); more.hidden = !cursor; section.append(more);
  if (!account.authenticated) { section.append(element('p',account.expired ? 'Your session expired. Your comment is still held in this tab.' : 'Sign in with Facebook to comment.'),button('Sign in with Facebook',login)); return; }
  const form = element('form'), input = element('textarea',undefined,{ rows:5,maxLength:2000,required:true,value:buffers.get(post)?.text || '' }), consent = element('input',undefined,{ type:'checkbox',required:true });
  const submit = element('button','Post comment',{ type:'submit' });
  form.append(field('Your comment',input),field(`I understand that my comment and Facebook name (${account.name}) will be public.`,consent),submit);
  input.addEventListener('input',()=>buffers.set(post,{ text:input.value,key:crypto.randomUUID() }));
  form.addEventListener('submit',async event => {
    event.preventDefault(); submit.disabled = true;
    const pending = buffers.get(post) || { text:input.value,key:crypto.randomUUID() }; buffers.set(post,pending);
    try {
      const row = await api(`/api/blog/posts/${post}/comments`,{ method:'POST',csrf:account.csrf,key:pending.key,body:{ text:input.value,consent:'public-attribution-v1' } });
      buffers.delete(post); input.value = ''; capabilities.deletable.push(row.id);
      if (!document.getElementById(`comment-${row.id}`)) draw(row);
      document.getElementById(`comment-${row.id}`)?.scrollIntoView({ block:'center' }); report('Comment posted.');
    } catch(error) { report(error.message); } finally { submit.disabled = false; }
  }); section.append(form);
}
function head(article) {
  document.title = `${article.title} · BCA Wales`;
  for (const [selector,value] of [['meta[name="description"]',article.excerpt],['meta[property="og:title"]',article.title],['meta[property="og:description"]',article.excerpt],['meta[property="og:url"]',location.href],['meta[property="og:type"]',article.id?'article':'website']]) document.querySelector(selector)?.setAttribute('content',value);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href',location.origin + location.pathname);
}
async function enhance(ticket = navigation) {
  const main = document.querySelector('main'), post = main.dataset.post;
  if (!post) return;
  reset = mountReveals(main,{ store,post,revision:main.dataset.revision,details:(asset,revision,index)=>api(`/api/blog/posts/${post}/images/${revision}/${asset}?index=${index}`),report });
  await renderComments(post,ticket);
}
async function navigate(path, push = true, focus = true) {
  const match = path.match(/^\/blog\/(?:([a-z0-9-]+)\/?)?$/); if (!match) { location.assign(path); return; }
  const ticket = ++navigation, main = document.querySelector('main');
  try {
    if (match[1]) {
      const article = await api(`/api/blog/posts/${match[1]}`); if (ticket !== navigation) return;
      if (article.rendererVersion !== 1) { location.assign(path); return; }
      main.replaceChildren(); const h1 = element('h1',article.title), by = element('p'); attribution(by,article.attribution); by.append(` · Updated ${new Date(article.updatedAt*1000).toLocaleDateString('en-GB')}`);
      const body = element('article'); body.append(h1,by); const content = element('div'); content.innerHTML = article.html; body.append(content);
      main.append(body,element('section',undefined,{ id:'comments' })); main.dataset.post = article.id; main.dataset.revision = article.revision;
      if (push) history.pushState({},'',`/blog/${article.slug}/`); head(article);
    } else {
      const posts = await api('/api/blog/posts'); if (ticket !== navigation) return;
      main.replaceChildren(element('h1','BCA Wales blog')); main.dataset.post = ''; main.dataset.revision = '';
      for (const post of posts) { const article = element('article'), h2 = element('h2'), link = element('a',post.title,{ href:`/blog/${post.slug}/` }); link.dataset.nav = ''; h2.append(link); article.append(h2,element('p',post.excerpt)); main.append(article); }
      if (!posts.length) main.append(element('p','No posts have been published yet.'));
      if (push) history.pushState({},'','/blog/'); head({ title:'BCA Wales blog',excerpt:'News and updates from BCA Wales.' });
    }
    if (focus) main.focus(); await enhance(ticket);
  } catch(error) {
    if (ticket !== navigation) return;
    // Fail closed instead of leaving a previously fetched article/comment on screen.
    main.replaceChildren(element('h1',error.status === 404 ? 'Post unavailable' : 'Temporarily unavailable'),element('p',error.message),button('Retry',()=>navigate(path,false))); main.dataset.post = ''; report(error.message);
  }
}
document.addEventListener('click',event => {
  const link = event.target.closest('a[data-nav]'); if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault(); void navigate(new URL(link.href).pathname);
});
document.querySelector('#reset-reveals')?.addEventListener('click',()=>{ store.clear(); reset(); report('Image reveals reset in this tab.'); });
addEventListener('popstate',()=>void navigate(location.pathname,false));
addEventListener('focus',()=>{ if (location.pathname.startsWith('/blog/') && !['/blog/privacy/','/blog/guidelines/'].includes(location.pathname)) void navigate(location.pathname,false,false); });
if (location.pathname.startsWith('/admin/')) import('./editor.mjs').then(module=>module.mountEditor({ store })).catch(error=>report(error.message));
else if (location.pathname === '/account/') import('./editor.mjs').then(module=>module.mountAccount()).catch(error=>report(error.message));
else enhance().catch(error=>report(error.message));
