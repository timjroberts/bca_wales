import { button, element, field } from './api.mjs';

export function sharingImageEditor({ postId, csrf, original, changed }) {
  let selected = original;
  const section = element('section'), preview = element('img',undefined,{ width:400,className:'sharing-preview' }), summary = element('p');
  section.append(element('h2','Sharing image'),element('p','Choose an optional image that is safe for anyone to see when this post is shared. Otherwise, the association card is used.'),preview,summary);
  const refresh = () => {
    preview.src = selected ? `/preview/media/${postId}/buffer/${selected.assetId}/share` : '/static/share.png';
    preview.alt = selected?.alt || 'Blorenge Commoners Association sharing card';
    summary.textContent = selected ? 'Custom image selected. Save the draft before publishing.' : 'Association card selected.';
  };
  section.append(button('Choose sharing image',()=>{
    const dialog = element('dialog'), file = element('input',undefined,{ type:'file',accept:'image/jpeg,image/png,image/webp' });
    const alt = element('input',undefined,{ maxLength:500 }), consent = element('input',undefined,{ type:'checkbox' });
    const progress = element('progress',undefined,{ max:100,value:0 }), resultPreview = element('img',undefined,{ width:400,className:'sharing-preview' });
    const status = element('p'); status.setAttribute('role','status');
    let result, xhr, generation = 0, uploadKey = crypto.randomUUID();
    function invalidate() { generation++; xhr?.abort(); result = null; uploadKey = crypto.randomUUID(); resultPreview.removeAttribute('src'); upload.disabled = false; }
    file.addEventListener('change',()=>{ invalidate(); consent.checked = false; status.textContent = ''; });
    consent.addEventListener('change',invalidate);
    const upload = button('Upload sharing image / retry',()=>{
      const bytes = file.files[0];
      if (!bytes || !alt.value.trim() || !consent.checked) { status.textContent = 'Choose an image, describe it and confirm it is safe for public sharing.'; return; }
      if (bytes.size > 10*1024*1024) { status.textContent = 'Choose an image no larger than 10 MiB.'; return; }
      const ticket = ++generation; result = null; upload.disabled = true; progress.value = 0;
      xhr = new XMLHttpRequest(); xhr.open('POST',`/api/admin/posts/${postId}/sharing-image`);
      for (const [name,value] of Object.entries({ 'Content-Type':bytes.type,'X-CSRF-Token':csrf,'Idempotency-Key':uploadKey,'X-Sharing-Consent':'public-sharing-v1' })) xhr.setRequestHeader(name,value);
      xhr.upload.onprogress = event=>{ if(ticket===generation && event.lengthComputable) progress.value = event.loaded/event.total*100; };
      xhr.onload = ()=>{
        if(ticket!==generation) return; upload.disabled = false;
        try { const response = JSON.parse(xhr.responseText); if(xhr.status!==201) throw new Error(response.error || 'Upload failed'); result = response; resultPreview.src = `/preview/media/${postId}/buffer/${result.assetId}/share`; resultPreview.alt = alt.value; status.textContent = 'Review the cropped image before using it.'; }
        catch(error) { status.textContent = error.message; }
      };
      xhr.onerror = ()=>{ if(ticket===generation) { upload.disabled=false; status.textContent='Upload failed. Retry when ready.'; } };
      status.textContent = 'Uploading and preparing the sharing image…'; xhr.send(bytes);
    });
    dialog.append(element('h2','Choose a public sharing image'),element('p','The image is cropped to a wide sharing card. It stays private until publication. After sharing, social networks may retain copies even if you replace or delete it.'),field('Sharing image file (maximum 10 MiB)',file),field('Sharing image description',alt),field('I confirm this image is safe for unrestricted public sharing.',consent),upload,progress,resultPreview,status,button('Use this sharing image',()=>{
      if(!result || !alt.value.trim() || !consent.checked) { status.textContent = 'Complete the upload, describe the image and confirm public sharing first.'; return; }
      selected = { assetId:result.assetId,policyVersion:result.policyVersion,alt:alt.value.trim(),consent:'public-sharing-v1' }; refresh(); changed(); dialog.close();
    }),button('Cancel',()=>dialog.close()));
    dialog.addEventListener('close',()=>{ generation++; xhr?.abort(); dialog.remove(); }); document.body.append(dialog); dialog.showModal();
  }),button('Use association card',()=>{ if(selected) { selected=undefined; refresh(); changed(); } }));
  refresh(); return { element:section,read:()=>selected ? { ...selected } : undefined };
}
