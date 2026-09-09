import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument, renderDocument, safeUrl } from '../src/document.mjs';
export const source = (title = 'Public title') => ({ schemaVersion: 1, title, excerpt: 'Safe summary', doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A <script>alert(1)</script> story', marks: [{ type: 'bold' }] }] }] } });
test('strict inert document renders escaped content through sanitized AST', () => {
  const original = source(); validateDocument(original);
  assert.match(renderDocument(original, () => {}), /<strong>A &#x3C;script>/);
  assert.deepEqual(original, source());
});
test('unknown versions, properties, marks and malformed nesting fail without modifying buffer', () => {
  for (const change of [s => s.schemaVersion = 2, s => s.doc.content.push({ type: 'iframe' }), s => s.doc.content[0].attrs = { onclick: 'evil' }, s => s.doc.content[0].content[0].marks = [{ type: 'code' }], s => s.doc.content = [{ type: 'text', text: 'invalid nesting' }]]) {
    const value = source(); change(value); const before = JSON.stringify(value);
    assert.throws(() => validateDocument(value)); assert.equal(JSON.stringify(value), before);
  }
});
test('URL allowlist rejects credentials, protocol confusion and control encodings', () => {
  for (const url of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'https://a:b@evil.test', 'data:text/html,hello', 'https://ok.test/%0aevil', ' https://ok.test', '/a%5cb']) assert.throws(() => safeUrl(url), undefined, url);
  for (const url of ['/blog/story/', 'https://example.org/a?b=c', 'http://example.org/']) assert.equal(safeUrl(url), url);
});
test('sensitive initial HTML contains only pixel raster and no distressing description', () => {
  const value = source(); value.doc.content.push({ type: 'image', attrs: { version: 1, assetId: '12345678-1234-1234-1234-123456789012', policyVersion: 1, sensitive: false, decorative: false, warning: 'Sensitive landscape image', alt: 'Private detailed description', caption: 'Distressing caption', credit: '', } });
  const html = renderDocument(value, () => ({ sensitive: true, pixel: '/media/pixel', display: '/media/clear-secret' }));
  assert.match(html, /Show image/); assert.match(html, /data-asset=/); assert.match(html, /\/media\/pixel/);
  assert.doesNotMatch(html, /clear-secret|Private detailed|Distressing caption/);
});
test('source depth, image count and size are bounded', () => {
  const value = source(); let current = value.doc;
  for (let i = 0; i < 13; i++) { current.content = [{ type: 'blockquote', content: [] }]; current = current.content[0]; }
  assert.throws(() => validateDocument(value));
  assert.throws(() => validateDocument(source('x'.repeat(161))));
});
