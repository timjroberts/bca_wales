import { sanitize } from 'hast-util-sanitize';
import { toHtml } from 'hast-util-to-html';
import { requireThat } from './errors.mjs';

export const RENDERER_VERSION = 1;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
export function exact(value, keys) {
  requireThat(object(value) && Object.keys(value).every(k => keys.includes(k)), 422, 'Unsupported fields or document version; preserve your original');
}
export function bounded(value, max, min = 0) {
  requireThat(typeof value === 'string' && [...value].length >= min && [...value].length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 422, 'Invalid text length or characters');
  return value;
}
export function safeUrl(value) {
  bounded(value, 2048, 1);
  requireThat(!/[\s\\\u0000-\u001f\u007f]/u.test(value) && !/%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value), 422, 'Unsafe link');
  const relative = value.startsWith('/') && !value.startsWith('//');
  let url; try { url = new URL(value, 'https://bca.wales'); } catch { requireThat(false, 422, 'Unsafe link'); }
  requireThat((relative || /^https?:\/\//i.test(value)) && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 422, 'Unsafe link');
  return value;
}
export function validateDocument(source) {
  requireThat(new TextEncoder().encode(JSON.stringify(source)).length <= 1048576, 413, 'Document too large');
  exact(source, ['schemaVersion', 'title', 'excerpt', 'doc']);
  requireThat(source.schemaVersion === 1, 422, 'Unsupported document version; export your original');
  bounded(source.title, 160, 1); requireThat(source.title.trim().length, 422, 'Title required'); bounded(source.excerpt, 300);
  let count = 0; const assets = [];
  const blocks = ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'image', 'callout'];
  function visit(node, parent, depth) {
    requireThat(++count <= 5000 && depth <= 12, 422, 'Document is too complex');
    exact(node, ['type', 'attrs', 'content', 'text', 'marks']);
    requireThat(typeof node.type === 'string', 422, 'Node type required');
    const type = node.type;
    const allowed = parent === null ? ['doc'] : parent === 'doc' || parent === 'blockquote' ? blocks : parent === 'listItem' ? ['paragraph', 'bulletList', 'orderedList', 'blockquote'] : ['bulletList', 'orderedList'].includes(parent) ? ['listItem'] : ['paragraph', 'heading', 'callout'].includes(parent) ? ['text', 'hardBreak'] : [];
    requireThat(allowed.includes(type), 422, 'Unsupported node or nesting; preserve your original');
    const attrs = node.attrs || {};
    if (type === 'heading') { exact(attrs, ['level']); requireThat([2, 3].includes(attrs.level), 422, 'Only H2 and H3 are supported'); }
    else if (type === 'orderedList') { exact(attrs, ['start','type']); requireThat(attrs.type === undefined || attrs.type === null || attrs.type === '1', 422); requireThat(attrs.start === undefined || Number.isInteger(attrs.start) && attrs.start >= 1 && attrs.start <= 9999, 422); }
    else if (type === 'callout') { exact(attrs, ['version', 'tone']); requireThat(attrs.version === 1 && ['note', 'warning'].includes(attrs.tone), 422, 'Unsupported callout'); }
    else if (type === 'image') {
      exact(attrs, ['version', 'assetId', 'policyVersion', 'sensitive', 'warning', 'alt', 'decorative', 'caption', 'credit']);
      requireThat(attrs.version === 1 && /^[a-f0-9-]{36}$/.test(attrs.assetId) && Number.isSafeInteger(attrs.policyVersion) && attrs.policyVersion >= 1 && typeof attrs.sensitive === 'boolean' && typeof attrs.decorative === 'boolean', 422, 'Invalid image reference');
      bounded(attrs.alt, 500); bounded(attrs.caption, 1000); bounded(attrs.credit, 1000); bounded(attrs.warning, 300);
      requireThat(attrs.sensitive ? !attrs.decorative && attrs.alt.trim() && attrs.warning.trim() : attrs.decorative ? attrs.alt === '' : attrs.alt.trim(), 422, 'Review image alt text and warning');
      assets.push(attrs.assetId); requireThat(assets.length <= 30, 422, 'At most 30 images');
    } else exact(attrs, []);
    if (type === 'text') {
      bounded(node.text, 100000, 1); requireThat(node.content === undefined, 422);
      requireThat(node.marks === undefined || Array.isArray(node.marks) && node.marks.length <= 3, 422);
      const seen = new Set();
      for (const mark of node.marks || []) {
        exact(mark, ['type', 'attrs']); requireThat(['bold', 'italic', 'link'].includes(mark.type) && !seen.has(mark.type), 422, 'Unsupported mark'); seen.add(mark.type);
        if (mark.type === 'link') {
          exact(mark.attrs, ['href', 'target', 'rel', 'class']); safeUrl(mark.attrs.href);
          requireThat(mark.attrs.target === undefined || mark.attrs.target === null || mark.attrs.target === '_blank', 422);
          requireThat(mark.attrs.rel === undefined || mark.attrs.rel === null || mark.attrs.rel === 'noopener noreferrer nofollow' || mark.attrs.rel === 'noopener noreferrer', 422);
          requireThat(mark.attrs.class === undefined || mark.attrs.class === null, 422);
        } else exact(mark.attrs || {}, []);
      }
    } else {
      requireThat(node.text === undefined && node.marks === undefined, 422);
      if (['image', 'hardBreak'].includes(type)) requireThat(node.content === undefined, 422);
      else {
        requireThat(node.content === undefined || Array.isArray(node.content), 422);
        const children = node.content || [];
        if (['doc', 'bulletList', 'orderedList', 'listItem'].includes(type)) requireThat(children.length > 0, 422, 'Empty structural node');
        if (type === 'listItem') requireThat(children[0]?.type === 'paragraph', 422, 'List item needs a paragraph');
        children.forEach(child => visit(child, type, depth + 1));
        if (type === 'callout') requireThat(children.reduce((n, c) => n + (c.text?.length || 0), 0) <= 2000, 422, 'Callout too long');
      }
    }
  }
  visit(source.doc, null, 0);
  return { source, assets: [...new Set(assets)] };
}

const el = (tagName, properties = {}, children = []) => ({ type: 'element', tagName, properties, children });
const txt = value => ({ type: 'text', value });
const schema = {
  tagNames: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'a', 'br', 'aside', 'figure', 'figcaption', 'img', 'button', 'span'],
  attributes: { '*': ['className'], a: ['href', 'target', 'rel'], ol: ['start'], img: ['src', 'alt', 'loading', 'width', 'height'], figure: ['dataAsset', 'dataPolicy', 'dataSensitive'], button: ['type', 'dataReveal', 'ariaExpanded'], aside: ['role'] },
  protocols: { href: ['http', 'https'], src: ['https', 'http'] }
};
export function renderDocument(source, resolveImage) {
  validateDocument(source);
  const render = node => {
    const children = (node.content || []).map(render);
    const a = node.attrs || {};
    switch (node.type) {
      case 'doc': return { type: 'root', children };
      case 'text': {
        let result = txt(node.text);
        for (const mark of node.marks || []) result = mark.type === 'link' ? el('a', { href: safeUrl(mark.attrs.href), target: '_blank', rel: ['noopener', 'noreferrer'] }, [result]) : el(mark.type === 'bold' ? 'strong' : 'em', {}, [result]);
        return result;
      }
      case 'image': {
        const media = resolveImage(a);
        requireThat(media && typeof media.sensitive === 'boolean', 422, 'Image unavailable');
        const sensitive = a.sensitive || media.sensitive;
        if (sensitive) return el('figure', { className: ['sensitive'], dataAsset: a.assetId, dataPolicy: JSON.stringify([a.policyVersion,a.sensitive,a.warning]), dataSensitive: 'true' }, [
          el('img', { src: safeUrl(media.pixel), alt: '', loading: 'lazy', className: ['pixelated'] }),
          el('p', {}, [txt(a.warning || 'Sensitive image. Reveal only if you choose.')]),
          el('button', { type: 'button', dataReveal: a.assetId, ariaExpanded: 'false' }, [txt('Show image')]),
          el('span', { className: ['image-status'] }, [])
        ]);
        return el('figure', {}, [el('img', { src: safeUrl(media.display), alt: a.alt, loading: 'lazy' }), el('figcaption', {}, [txt([a.caption, a.credit].filter(Boolean).join(' — '))])]);
      }
      case 'callout': return el('aside', { className: ['callout', a.tone] }, children);
      default: return el(({ paragraph: 'p', heading: `h${a.level}`, bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote', hardBreak: 'br' })[node.type], node.type === 'orderedList' ? { start: a.start || 1 } : {}, children);
    }
  };
  return toHtml(sanitize(render(source.doc), schema));
}
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
