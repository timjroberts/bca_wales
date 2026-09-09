// Shared public presentation keeps direct requests and SPA navigation identical.
// Only already-public metadata and the verified, sanitized article body enter here.
const e = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
export function attributionHtml(attribution) {
  const name = e(attribution?.name || 'BCA Wales contributor');
  return attribution?.link ? `<a href="${e(attribution.link)}" target="_blank" rel="noopener noreferrer" aria-label="${name} on Facebook (opens a new tab; access may be restricted)">${name}</a>` : name;
}
function dateHtml(timestamp) {
  const date = new Date(timestamp * 1000);
  return Number.isFinite(date.getTime()) ? `<time datetime="${date.toISOString()}">${date.toLocaleDateString('en-GB', { timeZone:'UTC',dateStyle:'long' })}</time>` : '';
}
export function articleHtml(article) {
  return `<article class="editorial"><div class="article-intro"><a class="back-link" data-nav href="/blog/"><span aria-hidden="true">←</span> All stories</a><p class="eyebrow">BCA Wales · Blog</p><h1>${e(article.title)}</h1><p class="article-deck">${e(article.excerpt)}</p><div class="article-details"><p class="eyebrow">Written by</p><p class="author-name">${attributionHtml(article.attribution)}</p><p class="byline">${article.publishedAt ? `Published ${dateHtml(article.publishedAt)}<br>` : ''}Updated ${dateHtml(article.updatedAt)}</p></div><a class="discussion-link" href="#comments">Join the conversation <span aria-hidden="true">↘</span></a></div><div class="article-paper"><div class="article-body">${article.html}</div><div class="article-end"><span aria-hidden="true">✳</span><p>Landscape. Community. Recovery.</p><a data-nav href="/blog/">More from BCA Wales →</a></div></div></article><section id="comments" aria-label="Comments"><h2>Comments</h2><p>Loading comments…</p></section>`;
}
function card(post, index) {
  const variant = [...post.slug].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;
  return `<article class="story-card${index === 0 ? ' story-feature' : ''}"><div class="card-copy"><p class="card-meta">${dateHtml(post.publishedAt || post.updatedAt)}<span aria-hidden="true"> / </span>BCA Wales</p><h${index === 0 ? '2' : '3'}><a class="story-link" data-nav href="/blog/${e(post.slug)}/">${e(post.title)}</a></h${index === 0 ? '2' : '3'}><p class="card-excerpt">${e(post.excerpt)}</p><div class="card-bottom"><span class="card-author">${attributionHtml(post.attribution)}</span><span class="card-arrow" aria-hidden="true">↗</span></div></div><div class="card-art landscape-${variant}" aria-hidden="true"><span class="art-label">BCA / WALES</span><span class="art-caption">Landscape &amp; community</span></div></article>`;
}
export function indexHtml(posts) {
  return `<section class="journal-heading"><div><p class="eyebrow">Landscape · Community · Recovery</p><h1><span class="sr-only">BCA Wales </span>blog<span class="title-stop" aria-hidden="true">.</span></h1></div><p>Stories from our landscape.<br>Ideas for what comes next.</p></section><section class="story-index" aria-label="Published stories"><div class="section-rule"><h2>Latest stories</h2><span>${posts.length ? `${posts.length}${posts.length === 100 ? '+' : ''} ${posts.length === 1 ? 'story' : 'stories'}` : 'From BCA Wales'}</span></div>${posts.length ? `${card(posts[0],0)}${posts.length > 1 ? `<div class="story-grid">${posts.slice(1).map((post,index)=>card(post,index+1)).join('')}</div>` : ''}` : '<div class="journal-empty"><div><p class="eyebrow">A space for our stories</p><h2>Every landscape has a story.</h2><p>No posts have been published yet.</p><p>In the meantime, discover the places that connect us.</p><a class="text-link" href="https://explore.bca.wales">Explore the landscape <span aria-hidden="true">↗</span></a></div><div class="card-art landscape-0" aria-hidden="true"><span class="art-label">BCA / WALES</span><span class="art-caption">Landscape &amp; community</span></div></div>'}</section>`;
}
