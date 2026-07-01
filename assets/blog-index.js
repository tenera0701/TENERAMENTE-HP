/**
 * blog.html: data/posts.json を読んで Featured + 一覧カードを描画。
 * カテゴリフィルタは categoryGroup でマッチ (meo タブが meo + aio を拾う等)。
 */
(async function () {
  const featHost = document.querySelector('[data-featured-host] .container');
  const grid = document.querySelector('[data-articles]');
  const tabs = document.querySelectorAll('[data-filter-set] .tab');
  const countEl = document.querySelector('[data-count-display]');
  if (!featHost || !grid) return;

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
          <div class="glyph">${esc(p.glyph || 'A')}</div>
        </div>
      </article>`;
  }

  function cardHTML(p) {
    const visualClass = p.visual && p.visual !== 'default' ? ` ${p.visual}` : '';
    return `
      <a class="article-card reveal" href="${encodeURIComponent(p.slug)}.html" data-cat="${esc(p.categoryGroup)}">
        <div class="visual${visualClass}"><div class="gl"><div class="gl-text">${esc(p.number)}</div></div></div>
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

  let posts = [];
  try {
    const res = await fetch('data/posts.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    posts = await res.json();
  } catch (e) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 60px 0; text-align: center; color: var(--fg-muted); font-size: 14px;">記事一覧の読み込みに失敗しました。<br/>後ほど再読み込みしてください。</div>`;
    console.error('[blog-index] failed to load posts.json:', e);
    return;
  }

  if (!posts.length) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 60px 0; text-align: center; color: var(--fg-muted);">記事はまだありません。</div>`;
    return;
  }

  // Featured = featured:true な記事1本。なければ最新1本。残りを一覧へ。
  const featured = posts.find(p => p.featured) || posts[0];
  const others = posts.filter(p => p.slug !== featured.slug);

  featHost.innerHTML = featuredHTML(featured);
  grid.innerHTML = others.map(cardHTML).join('');

  // Filter
  const featuredEl = document.querySelector('.featured-card');
  const cards = grid.querySelectorAll('.article-card');

  function applyFilter(f) {
    let visible = 0;
    cards.forEach(c => {
      const match = f === 'all' || c.getAttribute('data-cat') === f;
      c.classList.toggle('hidden', !match);
      if (match) visible++;
    });
    const fHost = document.querySelector('[data-featured-host]');
    if (featuredEl && fHost) {
      const fMatch = f === 'all' || featuredEl.getAttribute('data-cat') === f;
      fHost.style.display = fMatch ? '' : 'none';
      if (fMatch) visible++;
    }
    if (countEl) countEl.textContent = String(visible).padStart(2, '0') + ' articles';
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      applyFilter(t.getAttribute('data-filter'));
    });
  });

  applyFilter('all');

  // shared.js の reveal IntersectionObserver はロード時に一度しか走らないので、
  // 動的に追加した要素は手動で `.in` を付けて表示する。
  document.querySelectorAll('[data-articles] .reveal, [data-featured-host] .reveal').forEach(el => {
    el.classList.add('in');
  });
})();
