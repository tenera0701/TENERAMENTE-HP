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
          ${p.image
            ? `<img src="${esc(p.imageHero || p.image)}" alt="" width="1200" height="630" fetchpriority="high" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`
            : `<div class="glyph">${esc(p.glyph || 'A')}</div>`}
        </div>
      </article>`;
  }

  function cardHTML(p) {
    const visualClass = p.visual && p.visual !== 'default' ? ` ${p.visual}` : '';
    return `
      <a class="article-card reveal" href="${encodeURIComponent(p.slug)}.html" data-cat="${esc(p.categoryGroup)}">
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

  // 一覧は 12件ずつのページ送り。カードは DOM に残したまま CSS で出し入れする
  const PER_PAGE = 12;
  const pagerHost = document.querySelector('[data-pager]');
  const fHost = document.querySelector('[data-featured-host]');
  const featuredEl = document.querySelector('.featured-card');
  const cards = Array.prototype.slice.call(grid.querySelectorAll('.article-card'));
  let curFilter = 'all';
  let curPage = 1;

  function pagerButton(label, page, opts) {
    const o = opts || {};
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (o.current) b.setAttribute('aria-current', 'page');
    if (o.disabled) b.disabled = true;
    else b.addEventListener('click', () => { go(page); });
    return b;
  }

  function renderPager(totalPages) {
    if (!pagerHost) return;
    pagerHost.innerHTML = '';
    if (totalPages <= 1) return;
    pagerHost.appendChild(pagerButton('前へ', curPage - 1, { disabled: curPage === 1 }));
    for (let i = 1; i <= totalPages; i++) {
      pagerHost.appendChild(pagerButton(String(i).padStart(2, '0'), i, { current: i === curPage }));
    }
    pagerHost.appendChild(pagerButton('次へ', curPage + 1, { disabled: curPage === totalPages }));
  }

  function syncUrl() {
    const q = [];
    if (curFilter !== 'all') q.push('cat=' + encodeURIComponent(curFilter));
    if (curPage > 1) q.push('p=' + curPage);
    const url = location.pathname + (q.length ? '?' + q.join('&') : '');
    history.replaceState(null, '', url);
  }

  function apply(scroll) {
    const matched = [];
    cards.forEach(c => {
      const match = curFilter === 'all' || c.getAttribute('data-cat') === curFilter;
      c.classList.toggle('hidden', !match);
      if (match) matched.push(c);
    });

    const totalPages = Math.max(1, Math.ceil(matched.length / PER_PAGE));
    if (curPage > totalPages) curPage = totalPages;
    const start = (curPage - 1) * PER_PAGE;
    matched.forEach((c, i) => {
      c.classList.toggle('page-off', i < start || i >= start + PER_PAGE);
    });

    // 大きく出す Featured は「すべて・1ページ目」のときだけ
    let visible = matched.length;
    if (featuredEl && fHost) {
      const fMatch = curFilter === 'all' || featuredEl.getAttribute('data-cat') === curFilter;
      fHost.style.display = (fMatch && curPage === 1) ? '' : 'none';
      if (fMatch) visible++;
    }

    if (countEl) countEl.textContent = String(visible).padStart(2, '0') + ' articles';
    renderPager(totalPages);
    syncUrl();
    if (scroll) {
      const top = document.querySelector('.articles');
      if (top) window.scrollTo({ top: top.offsetTop - 80, behavior: 'smooth' });
    }
  }

  function go(page) {
    curPage = Math.max(1, page);
    apply(true);
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      curFilter = t.getAttribute('data-filter');
      curPage = 1;
      apply(false);
    });
  });

  // URL（?cat=meo&p=2）から初期状態を復元する
  const params = new URLSearchParams(location.search);
  const cat = params.get('cat');
  if (cat) {
    const hit = Array.prototype.slice.call(tabs).find(t => t.getAttribute('data-filter') === cat);
    if (hit) { tabs.forEach(x => x.classList.remove('active')); hit.classList.add('active'); curFilter = cat; }
  }
  const p = parseInt(params.get('p'), 10);
  if (p > 1) curPage = p;

  apply(false);

  // shared.js の reveal IntersectionObserver はロード時に一度しか走らないので、
  // 動的に追加した要素は手動で `.in` を付けて表示する。
  document.querySelectorAll('[data-articles] .reveal, [data-featured-host] .reveal').forEach(el => {
    el.classList.add('in');
  });
})();
