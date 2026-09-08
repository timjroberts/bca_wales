export class RevealStore {
  constructor(storage, report = () => {}) {
    this.values = new Set(); this.storage = storage; this.report = report;
    try {
      const saved = JSON.parse(storage?.getItem('bca-image-reveals-v1') || '[]');
      if (Array.isArray(saved)) saved.filter(v => typeof v === 'string' && v.length <= 2000 && /^\[/.test(v)).forEach(v => this.values.add(v));
    } catch { this.storage = null; report('Image choices are held in memory. Refresh may reset them.'); }
  }
  has(key) { return this.values.has(key); }
  set(key, visible) { if (visible) this.values.add(key); else this.values.delete(key); this.persist(); }
  clear() { this.values.clear(); this.persist(); }
  persist() { try { this.storage?.setItem('bca-image-reveals-v1', JSON.stringify([...this.values])); } catch { this.storage = null; this.report('Image choices are held in memory. Refresh may reset them.'); } }
}
export function revealKey(namespace, post, asset, policy) { return JSON.stringify([namespace, post, asset, policy]); }
export function mountReveals(root, { store, post, revision, private: isPrivate = false, details, report }) {
  const resets = [];
  for (const figure of root.querySelectorAll('figure[data-sensitive]')) {
    const button = figure.querySelector('button'), image = figure.querySelector('img'), status = figure.querySelector('.image-status');
    status.setAttribute('role','status');
    const asset = figure.dataset.asset, key = revealKey(isPrivate ? 'preview' : 'public', post, asset, figure.dataset.policy);
    const pixel = image.getAttribute('src'); let shown = false, loading = false, generation = 0;
    const hide = () => {
      generation++; shown = false; loading = false; image.src = pixel; image.alt = ''; image.classList.add('pixelated');
      figure.querySelector('figcaption')?.remove(); button.textContent = 'Show image'; button.removeAttribute('aria-busy'); button.setAttribute('aria-expanded','false'); status.textContent = 'Image hidden'; store.set(key,false);
    };
    const show = async () => {
      if(loading) return; loading = true; const attempt = ++generation; button.setAttribute('aria-busy','true'); status.textContent = 'Loading image…';
      try {
        const data = await details(asset, revision);
        // Fetch after explicit/remembered reveal. A failed load never records consent.
        const response = await fetch(data.display, { cache: 'no-store', credentials: 'same-origin' }); if (!response.ok) throw new Error('Image unavailable');
        const blob = await response.blob(), url = URL.createObjectURL(blob), probe = new Image(); probe.src = url;
        try { await probe.decode(); if (attempt !== generation || !root.contains(figure)) return;
          image.src = url; await image.decode(); image.alt = data.alt; image.classList.remove('pixelated');
          const caption = document.createElement('figcaption'); caption.textContent = [data.caption,data.credit].filter(Boolean).join(' — '); figure.append(caption);
          shown = true; store.set(key,true); button.textContent = 'Hide image'; button.setAttribute('aria-expanded','true'); status.textContent = 'Image shown';
        } finally { URL.revokeObjectURL(url); }
      } catch { if (attempt === generation) { status.textContent = 'Image unavailable. Try again.'; button.textContent = 'Retry image'; report?.('Image could not be loaded'); } }
      finally { if (attempt === generation) { loading = false; button.removeAttribute('aria-busy'); } }
    };
    button.addEventListener('click', () => { if (shown) hide(); else void show(); });
    resets.push(hide); if (store.has(key)) void show();
  }
  return () => resets.forEach(reset => reset());
}
