/**
 * blog-cards.js — ブログ一覧のカードの HTML。
 * ブラウザ（blog-index.js）とビルド（scripts/build-index.js が blog.html に静的に書き込む）の両方で使う。
 * 同じ HTML を2か所で書くとズレるので、カードの見た目を変えるときはここだけ直す。
 */
(function (root) {
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  }

  function featuredHTML(p) {
    return `
      <article class="featured-card reveal" data-cat="${esc(p.categoryGroup)}">
        <div>
          <span class="featured-tag">Featured / ${esc(p.date.slice(0, 7).replace('-', '.'))}</span>
          <h2><a href="${encodeURIComponent(p.slug)}.html">${esc(p.title)}</a></h2>
          <p class="lead">${esc(p.excerpt)}</p>
          <div class="meta">
            <span>${esc(p.categoryLabel)}</span><span class="dot"></span>
            <span>${p.readMin} min read</span><span class="dot"></span>
            <span>${esc(p.dateLabel)}</span>
          </div>
        </div>
        <div class="featured-visual">
          ${p.image
            ? `<img src="${esc(p.imageHero || p.image)}" alt="" width="1200" height="630" fetchpriority="high" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`
            : `<div class="glyph">${esc(p.glyph || 'A')}</div>`}
        </div>
      </article>`;
  }

  // extraClass: ビルドが静的に書くとき、2ページ目以降のカードに page-off を付けて隠す（JS が動く前のちらつき防止）
  function cardHTML(p, extraClass) {
    const visualClass = p.visual && p.visual !== 'default' ? ` ${p.visual}` : '';
    return `
      <a class="article-card reveal${extraClass ? ' ' + extraClass : ''}" href="${encodeURIComponent(p.slug)}.html" data-cat="${esc(p.categoryGroup)}">
        <div class="visual${visualClass}">${p.image
          ? `<img src="${esc(p.imageCard || p.image)}" alt="" width="640" height="336" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`
          : `<div class="gl"><div class="gl-text">${esc(p.number)}</div></div>`}</div>
        <div class="meta-row">
          <span class="cat">${esc(p.categoryLabel)}</span>
          <span class="dot"></span>
          <span>${esc(p.dateLabel)}</span>
        </div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.excerpt)}</p>
        <span class="read">${p.readMin} min read</span>
      </a>`;
  }

  const api = { esc, featuredHTML, cardHTML };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BlogCards = api;
})(typeof window !== 'undefined' ? window : this);
