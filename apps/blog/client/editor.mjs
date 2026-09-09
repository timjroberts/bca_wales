import { Editor } from '@tiptap/core';
import { extensions, imageDefaults } from './editor-schema.mjs';
import { validateDocument, safeUrl } from '../src/document.mjs';
import { api, button, element, field, getSession, login, report, rescue } from './api.mjs';
import { mountReveals } from './reveals.mjs';
let editor, dirty = false, saved, account, pending = null;
const empty = () => ({ schemaVersion:1,title:'Untitled post',excerpt:'',doc:{ type:'doc',content:[{ type:'paragraph' }] } });
export async function mountAccount() {
  const main = document.querySelector('main'); account = await getSession(); main.replaceChildren(element('h1','Your BCA Wales account'));
  if (!account.authenticated) { main.append(element('p',account.expired ? 'Your session expired. Sign in again.' : 'Use Facebook to comment or manage posts.'),button('Sign in with Facebook',login)); return; }
  main.append(element('p',`Signed in as ${account.name}.`),element('p',`Your private administrator enrollment identifier: ${account.subject}`),element('p','Only share this identifier privately with the BCA Wales operator. Signing in does not enroll you as an administrator.'));
  if (account.administrator) main.append(element('a','Manage posts',{ href:'/admin/' }));
  main.append(button('Sign out',async()=>{ try { await api('/api/logout',{ method:'POST',csrf:account.csrf }); location.assign('/account/'); } catch(error) { report(error.message); } }));
  main.append(button('Delete my contributions',()=>{
    const dialog = element('dialog'), confirmText = element('input');
    dialog.append(element('h2','Permanently delete your contributions'),element('p','Your comments will be deleted and posts you originally authored will be withdrawn and erased. Administrator access will be removed. This cannot be undone. Protected backups expire within 30 days.'),field('Type DELETE MY CONTRIBUTIONS',confirmText));
    dialog.append(button('Request deletion',async()=>{ try { const result = await api('/api/account/delete',{ method:'POST',csrf:account.csrf,body:{ confirm:confirmText.value } }); location.assign(result.statusUrl); } catch(error) { report(error.message); } }),button('Cancel',()=>dialog.close())); document.body.append(dialog); dialog.addEventListener('close',()=>dialog.remove()); dialog.showModal();
  }));
}
export async function mountEditor({ store }) {
  account = await getSession(); if (!account.authenticated || !account.administrator) { location.replace('/account/'); return; }
  const main = document.querySelector('main');
  const postId = new URL(location.href).searchParams.get('post');
  if (!postId) {
    main.replaceChildren(element('h1','Posts'),element('a','Account and sign out',{ href:'/account/' }));
    const list = await api('/api/admin/posts');
    for (const post of list) {
      const state = post.state === 'published' ? post.draftRevision !== post.publicRevision ? 'Published · Unpublished changes' : 'Published' : 'Draft';
      main.append(element('p',undefined)); main.lastChild.append(element('a',`${post.slug} — ${state}`,{ href:`/admin/?post=${post.id}` }));
    }
    const form = element('form'), slug = element('input',undefined,{ required:true,pattern:'[a-z0-9]+(-[a-z0-9]+)*',maxLength:100 }), consent = element('input',undefined,{ type:'checkbox',required:true });
    form.append(field('New post URL slug',slug),field(`I understand that my Facebook name (${account.name}) will be public when I publish.`,consent),element('button','Create private draft',{ type:'submit' }));
    let createKey = crypto.randomUUID(); slug.addEventListener('input',()=>createKey=crypto.randomUUID());
    form.addEventListener('submit',async event=>{ event.preventDefault(); try { const post = await api('/api/admin/posts',{ method:'POST',csrf:account.csrf,key:createKey,body:{ slug:slug.value,consent:'public-attribution-v1' } }); location.assign(`/admin/?post=${post.id}`); } catch(error) { report(error.message); } }); main.append(form); return;
  }
  saved = await api(`/api/admin/posts/${postId}`);
  const original = saved.source || empty();
  try { validateDocument(original); }
  catch(error) { main.replaceChildren(element('h1','This draft needs a compatible editor'),element('p','Your original content has been preserved. Saving and publication are blocked.'),button('Download original private document',()=>rescue(original))); report(error.message); return; }
  main.replaceChildren(element('a','All posts',{ href:'/admin/' }),element('h1','Write a post'));
  const title = element('input',undefined,{ value:original.title,maxLength:160,required:true }), excerpt = element('textarea',undefined,{ value:original.excerpt,maxLength:300,rows:2 });
  const toolbar = element('div',undefined,{ className:'toolbar' }); toolbar.setAttribute('aria-label','Text formatting');
  const surface = element('div',undefined,{ className:'editor-surface' }), status = element('p','Saved draft',{ className:'save-state' }); status.setAttribute('role','status');
  main.append(field('Title',title),field('Safe sharing summary (no sensitive details)',excerpt),toolbar,surface,status);
  const read = () => ({ schemaVersion:1,title:title.value,excerpt:excerpt.value,doc:editor.getJSON() });
  const changed = () => { dirty = true; pending = null; status.textContent = 'Unsaved changes'; };
  const showError = error => { status.textContent = error.status === 409 ? 'Conflict: your local work is preserved. Download it before loading the newer draft.' : `Save failed: ${error.message}`; report(error.message); };
  let componentDialog;
  function editComponent(type, attrs = {}) {
    componentDialog?.close(); const dialog = element('dialog',undefined,{ className:'component-dialog' }); componentDialog = dialog;
    dialog.append(element('h2',type === 'image' ? 'Image' : 'Callout'));
    const error = element('p'); error.setAttribute('role','alert');
    if (type === 'callout') {
      const tone = element('select'); ['note','warning'].forEach(v=>tone.append(element('option',v,{ value:v }))); tone.value = attrs.tone || 'note';
      const text = element('textarea',undefined,{ maxLength:2000,rows:4 });
      dialog.append(field('Tone',tone)); if (!editor.isActive('callout')) dialog.append(field('Callout text (format it in the editor after insertion)',text));
      dialog.append(button('Apply callout',()=>{ if (editor.isActive('callout')) editor.chain().focus().updateAttributes('callout',{ tone:tone.value }).run(); else editor.chain().focus().insertContent({ type:'callout',attrs:{ version:1,tone:tone.value },content:text.value ? [{ type:'text',text:text.value }] : [] }).run(); dialog.close(); }));
    } else {
      let image = { ...imageDefaults,...attrs }, uploaded = !!image.assetId, selectedFile = null, uploadKey = crypto.randomUUID(), xhr;
      const alt = element('input',undefined,{ value:image.alt,maxLength:500 }), caption = element('textarea',undefined,{ value:image.caption,maxLength:1000,rows:2 }), credit = element('input',undefined,{ value:image.credit,maxLength:1000 });
      const sensitive = element('input',undefined,{ type:'checkbox',checked:image.sensitive }), decorative = element('input',undefined,{ type:'checkbox',checked:image.decorative }), warning = element('input',undefined,{ value:image.warning,maxLength:300 });
      const placeholder = element('select'); placeholder.append(element('option','Pixelated preview',{ value:'pixel' }),element('option','Neutral block (safer for recognizable scenes)',{ value:'neutral' }));
      const file = element('input',undefined,{ type:'file',accept:'image/jpeg,image/png,image/webp' }), progress = element('progress',undefined,{ max:100,value:0 }), thumbnail = element('img',undefined,{ alt:'Safe image preview',className:'pixelated' });
      if (uploaded) thumbnail.src = `/preview/media/${postId}/buffer/${image.assetId}/pixel`;
      const upload = button('Upload / retry',()=>{
        if (!selectedFile) { error.textContent = 'Choose a JPEG, PNG or WebP file.'; return; }
        uploaded = false; upload.disabled = true; progress.value = 0; error.textContent = 'Uploading and processing…';
        xhr = new XMLHttpRequest(); xhr.open('POST',`/api/admin/posts/${postId}/images`);
        for (const [name,value] of Object.entries({ 'Content-Type':selectedFile.type,'X-CSRF-Token':account.csrf,'Idempotency-Key':uploadKey,'X-Image-Sensitive':String(sensitive.checked),'X-Image-Placeholder':placeholder.value })) xhr.setRequestHeader(name,value);
        xhr.upload.onprogress = event=>{ if(event.lengthComputable) progress.value = event.loaded/event.total*100; };
        xhr.onload = ()=>{ upload.disabled = false; try { const result = JSON.parse(xhr.responseText); if(xhr.status !== 201) throw new Error(result.error || 'Upload failed'); image = { ...image,assetId:result.assetId,policyVersion:result.policyVersion,sensitive:result.sensitive }; uploaded = true; thumbnail.src = result.pixel; error.textContent = 'Upload complete. Review the safe preview, alt text and warning.'; } catch(failure) { error.textContent = failure.message; } };
        xhr.onerror = ()=>{ upload.disabled = false; error.textContent = 'Upload failed. Your draft is preserved; retry when ready.'; };
        xhr.onabort = ()=>{ upload.disabled = false; error.textContent = 'Upload cancelled. No image has been inserted.'; };
        xhr.send(selectedFile);
      });
      file.addEventListener('change',()=>{ selectedFile = file.files[0]; uploaded = false; sensitive.checked = true; decorative.checked = false; alt.value = ''; warning.value = imageDefaults.warning; uploadKey = crypto.randomUUID(); });
      for (const control of [sensitive,placeholder]) control.addEventListener('change',()=>{ uploadKey = crypto.randomUUID(); if(selectedFile) uploaded = false; });
      dialog.append(field('Upload / replace (maximum 10 MiB)',file),field('Sensitive image (new uploads default to sensitive)',sensitive),field('Safe placeholder',placeholder),upload,button('Cancel upload',()=>xhr?.abort()),progress,thumbnail,field('Meaningful alt text',alt),field('Decorative (ordinary images only)',decorative),field('Non-graphic warning',warning),field('Caption',caption),field('Credit',credit));
      dialog.append(button('Apply image',()=>{
        try {
          if(!uploaded) throw new Error('Complete the upload before inserting the image.');
          const next = { ...image,alt:alt.value,caption:caption.value,credit:credit.value,warning:warning.value,decorative:decorative.checked,sensitive:image.sensitive || sensitive.checked };
          const candidate = { ...empty(),doc:{ type:'doc',content:[{ type:'image',attrs:next }] } }; validateDocument(candidate);
          if (editor.isActive('image')) editor.chain().focus().updateAttributes('image',next).run(); else editor.chain().focus().insertContent({ type:'image',attrs:next }).run(); dialog.close();
        } catch(failure) { error.textContent = failure.message; }
      }));
      dialog.addEventListener('close',()=>xhr?.abort());
    }
    dialog.append(error,button('Cancel',()=>dialog.close())); document.body.append(dialog); dialog.addEventListener('close',()=>dialog.remove()); dialog.showModal();
  }
  editor = new Editor({ injectCSS:false,element:surface,extensions:extensions({ editComponent,post:postId }),content:original.doc,editorProps:{ attributes:{ role:'textbox','aria-label':'Post body','aria-multiline':'true' } },onUpdate:changed });
  title.addEventListener('input',changed); excerpt.addEventListener('input',changed);
  const commands = [
    ['Paragraph',()=>editor.chain().focus().setParagraph().run()],['H2',()=>editor.chain().focus().toggleHeading({ level:2 }).run()],['H3',()=>editor.chain().focus().toggleHeading({ level:3 }).run()],['Bold',()=>editor.chain().focus().toggleBold().run()],['Italic',()=>editor.chain().focus().toggleItalic().run()],['Bullet list',()=>editor.chain().focus().toggleBulletList().run()],['Numbered list',()=>editor.chain().focus().toggleOrderedList().run()],['Quote',()=>editor.chain().focus().toggleBlockquote().run()],['Undo',()=>editor.chain().focus().undo().run()],['Redo',()=>editor.chain().focus().redo().run()],
    ['Link',()=>{ const value = prompt('HTTP(S) or site-relative link; leave empty to remove',editor.getAttributes('link').href || ''); if(value === null) return; try { if(value) editor.chain().focus().setLink({ href:safeUrl(value) }).run(); else editor.chain().focus().unsetLink().run(); } catch(error) { report(error.message); } }],
    ['Image',()=>editComponent('image',editor.getAttributes('image'))],['Callout',()=>editComponent('callout',editor.getAttributes('callout'))],
    ['Remove component',()=>{ if(editor.isActive('image')) editor.chain().focus().deleteSelection().run(); else if(editor.isActive('callout')) editor.chain().focus().setNode('paragraph').run(); }],
    ['Move block up',()=>move(-1)],['Move block down',()=>move(1)]
  ]; commands.forEach(([label,action])=>toolbar.append(button(label,action)));
  function move(direction) {
    const { $from } = editor.state.selection, from = $from.depth ? $from.before(1) : editor.state.selection.from, node = editor.state.doc.nodeAt(from); if(!node) return;
    const siblings = []; editor.state.doc.forEach((n,pos)=>siblings.push({ n,pos })); const index = siblings.findIndex(s=>s.pos===from), other = siblings[index+direction]; if(!other) return;
    const target = direction<0 ? other.pos : other.pos+other.n.nodeSize-node.nodeSize;
    const tr = editor.state.tr.delete(from,from+node.nodeSize).insert(target,node); editor.view.dispatch(tr); editor.commands.focus();
  }
  let busy = false;
  async function save() {
    if(busy) return; busy=true; status.textContent='Saving…';
    try {
      const source = read(); validateDocument(source); pending ||= { key:crypto.randomUUID(),body:{ version:saved.version,source } };
      const operation = pending;
      const result = await api(`/api/admin/posts/${postId}/save`,{ method:'POST',csrf:account.csrf,...operation });
      saved={ ...saved,version:result.version,draftRevision:result.revision,source:operation.body.source }; if(pending===operation) pending=null;
      dirty=JSON.stringify(read())!==JSON.stringify(saved.source); status.textContent=dirty?'Saved snapshot; newer local changes are unsaved':`Saved at ${new Date().toLocaleTimeString()}`;
    } catch(error) { showError(error); } finally { busy=false; }
  }
  const actions = element('div',undefined,{ className:'editor-actions' });
  actions.append(button('Save draft',save),button('Private preview',async()=>{
    try {
      const source=read(),result=await api(`/api/admin/posts/${postId}/preview`,{ method:'POST',csrf:account.csrf,body:{ source } });
      const dialog=element('dialog',undefined,{ className:'preview-dialog' }), body=element('div'); body.innerHTML=result.html;
      dialog.append(element('h2',`Private preview${dirty?' — unsaved changes':''}`),element('h1',result.title),body,button('Close preview',()=>dialog.close())); document.body.append(dialog); dialog.addEventListener('close',()=>dialog.remove()); dialog.showModal();
      const imageAttrs=[]; const visit=n=>{ if(n.type==='image') imageAttrs.push(n.attrs); (n.content||[]).forEach(visit); }; visit(source.doc);
      const resetPreview=mountReveals(body,{ store,post:postId,revision:'buffer',private:true,report,details:async (asset,_revision,index)=>({ ...imageAttrs[index],display:`/preview/media/${postId}/buffer/${asset}/display` }) });
      dialog.append(button('Reset preview reveals',()=>resetPreview()));
    } catch(error) { showError(error); }
  }),button('Publish',()=>{
    if(busy || dirty || !saved.draftRevision) { report('Save your draft first, then deliberately publish.'); return; }
    const dialog=element('dialog'); dialog.append(element('h2',saved.state==='published'?'Publish changes':'Publish post'),element('p',saved.source.title),element('p',saved.source.excerpt||'News and updates from BCA Wales.'),element('img',undefined,{ src:'/static/share.png',alt:'Neutral BCA Wales sharing card',width:400 }),element('p','This saved revision becomes public immediately. All images use the neutral social card. Review the title and summary for safe sharing.'));
    const reviewed={ version:saved.version,revision:saved.draftRevision };
    const publishKey=crypto.randomUUID(); dialog.append(button('Confirm publication',async()=>{ try { if(dirty || busy || saved.version!==reviewed.version) throw new Error('The draft changed. Close this panel and review publication again.'); const result=await api(`/api/admin/posts/${postId}/publish`,{ method:'POST',csrf:account.csrf,key:publishKey,body:reviewed }); saved={ ...saved,version:result.version,publicRevision:result.revision,state:'published' }; status.textContent='Published'; dialog.close(); } catch(error) { showError(error); } }),button('Cancel',()=>dialog.close())); document.body.append(dialog); dialog.addEventListener('close',()=>dialog.remove()); dialog.showModal();
  }),button('Download local private draft',()=>rescue(read())),button('Load latest saved draft',()=>{ if(!dirty||confirm('Discard the local buffer and load the latest saved draft? Download your local draft first if you need it.')) { dirty=false; location.reload(); } }),button('Unpublish',async()=>{
    if(!confirm('Withdraw this post now? The saved draft will remain private.')) return;
    try { const result=await api(`/api/admin/posts/${postId}/unpublish`,{ method:'POST',csrf:account.csrf,key:crypto.randomUUID(),body:{ version:saved.version } }); saved={ ...saved,version:result.version,state:'draft',publicRevision:null }; status.textContent='Unpublished'; } catch(error) { showError(error); }
  }),button('Delete post',async()=>{
    if(saved.state==='published') { report('Unpublish before permanently deleting.'); return; }
    if(prompt('This permanently deletes the post, comments and images. Type DELETE POST to confirm.')!=='DELETE POST') return;
    try { await api(`/api/admin/posts/${postId}/delete`,{ method:'POST',csrf:account.csrf,key:crypto.randomUUID(),body:{ version:saved.version,confirm:'DELETE POST' } }); dirty=false; location.assign('/admin/'); } catch(error) { showError(error); }
  })); main.append(actions);
  main.append(element('p',`Public URL: /blog/${saved.slug}/`),button('Change URL slug',async()=>{
    const slug=prompt('New lowercase URL slug; previous URLs remain reserved aliases.',saved.slug); if(!slug||slug===saved.slug) return;
    try { const result=await api(`/api/admin/posts/${postId}/slug`,{ method:'POST',csrf:account.csrf,key:crypto.randomUUID(),body:{ version:saved.version,slug } }); saved={ ...saved,version:result.version,slug }; report(`URL changed to /blog/${slug}/`); } catch(error) { showError(error); }
  }));
  addEventListener('beforeunload',event=>{ if(dirty) { event.preventDefault(); event.returnValue=''; } });
  document.addEventListener('keydown',event=>{ if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s') { event.preventDefault(); void save(); } });
  document.addEventListener('click',event=>{ const a=event.target.closest('a'); if(a&&dirty&&!confirm('Leave this page and discard unsaved changes?')) event.preventDefault(); });
}
