/**
 * blog-post.html: ?slug=... を読んで posts/<slug>.md を描画する。
 * - data/posts.json から該当記事のメタを取得
 * - posts/<slug>.md を fetch して marked でレンダリング
 * - H2 に番号 + アンカー、TOC 自動生成、関連記事3本
 * - meta description / og:* を書き換え
 */
(async function () {
  const SITE = window.location.origin + window.location.pathname.replace(/blog-post\.html$/, '');
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const bodyHost = document.querySelector('[data-post="body"]');

  function setText(sel, text) {
    document.querySelectorAll(`[data-post="${sel}"]`).forEach(el => { el.textContent = text; });
  }
  function setMeta(name, content) {
    document.querySelectorAll(`[data-meta="${name}"]`).forEach(el => {
      if (el.tagName === 'TITLE') el.textContent = content;
      else el.setAttribute('content', content);
    });
  }

  function showError(msg) {
    bodyHost.innerHTML = `
      <p style="color: var(--fg-muted); padding: 40px 0;">${msg}</p>
      <p><a href="blog.html" style="color: var(--primary);">← 記事一覧に戻る</a></p>`;
  }

  if (!slug) {
    showError('記事が指定されていません。');
    return;
  }

  // メタ取得
  let posts, post;
  try {
    const res = await fetch('data/posts.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    posts = await res.json();
    post = posts.find(p => p.slug === slug);
    if (!post) {
      showError('指定された記事が見つかりませんでした。');
      return;
    }
  } catch (e) {
    console.error('[blog-post] meta load failed:', e);
    showError('記事メタの読み込みに失敗しました。');
    return;
  }

  // 本文取得
  let rawMd;
  try {
    const res = await fetch(`posts/${encodeURIComponent(slug)}.md`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawMd = await res.text();
  } catch (e) {
    console.error('[blog-post] body load failed:', e);
    showError('記事本文の読み込みに失敗しました。');
    return;
  }

  // META ブロックを除去
  const body = rawMd.replace(/<!--META\s+[\s\S]*?\s+META-->\s*/, '').trim();

  // メタ反映 (タイトル、カテゴリ、日付、読了時間、グリフ)
  document.title = `${post.title} — TENERAMENTE Blog`;
  setMeta('title', `${post.title} — TENERAMENTE Blog`);
  setMeta('description', post.excerpt);
  setMeta('og:title', post.title);
  setMeta('og:description', post.excerpt);

  // SEO: canonical / og:url / Twitter / 構造化データ(Article)
  var SITE_ABS = 'https://teneramente.co.jp/';
  var postUrl = SITE_ABS + 'blog-post.html?slug=' + encodeURIComponent(slug);
  setMeta('og:url', postUrl);
  setMeta('twitter:title', post.title);
  setMeta('twitter:description', post.excerpt);
  var canon = document.querySelector('[data-canonical]');
  if (canon) canon.setAttribute('href', postUrl);
  try {
    var ld = {
      "@context": "https://schema.org", "@type": "BlogPosting",
      "headline": post.title, "description": post.excerpt,
      "datePublished": post.date, "dateModified": post.date, "inLanguage": "ja",
      "mainEntityOfPage": postUrl,
      "image": SITE_ABS + "assets/img/ogp.png",
      "author": { "@type": "Person", "name": "加藤 聖矢" },
      "publisher": { "@type": "Organization", "name": "株式会社TENERAMENTE", "logo": { "@type": "ImageObject", "url": SITE_ABS + "assets/img/favicon-512.png" } },
      "keywords": (post.tags || []).join(', ')
    };
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  } catch (e) {}

  setText('title', post.title);
  setText('category', post.categoryLabel);
  setText('date', post.dateLabel);
  setText('read', `${post.readMin} min read`);
  setText('glyph', post.glyph || 'A');
  setText('crumb', post.categoryLabel.toUpperCase());

  // Markdown レンダリング
  marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });
  const html = marked.parse(body);
  bodyHost.innerHTML = html;

  // 表を横スクロール対応のラッパで包む
  bodyHost.querySelectorAll('table').forEach(tbl => {
    if (tbl.parentElement && tbl.parentElement.classList.contains('table-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    tbl.parentNode.insertBefore(wrap, tbl);
    wrap.appendChild(tbl);
  });

  // 先頭の <p> を lead 表示に
  const firstP = bodyHost.querySelector('p');
  if (firstP) {
    firstP.classList.add('lead');
    Object.assign(firstP.style, {
      fontSize: '19px',
      lineHeight: '1.8',
      color: 'var(--fg-muted)',
      marginBottom: '32px',
    });
  }

  // H2 に番号 + アンカー
  const h2s = bodyHost.querySelectorAll('h2');
  const toc = [];
  h2s.forEach((h, i) => {
    const n = String(i + 1).padStart(2, '0');
    h.id = 'h' + (i + 1);
    const num = document.createElement('span');
    num.className = 'h-num';
    num.textContent = n;
    h.prepend(num);
    // TOC ラベルは数字 span を除いたテキスト
    const label = Array.from(h.childNodes)
      .filter(n => n.nodeType === 3 || (n.nodeType === 1 && !n.classList.contains('h-num')))
      .map(n => n.textContent).join('').trim();
    toc.push({ id: h.id, n, label });
  });

  // TOC 描画
  const tocEl = document.querySelector('[data-toc]');
  if (tocEl) {
    tocEl.innerHTML = toc.map((t, i) => `
      <a href="#${t.id}"${i === 0 ? ' class="active"' : ''}><span class="n">${t.n}</span>${t.label}</a>
    `).join('');
  }

  // TOC アクティブ追従
  const tocLinks = document.querySelectorAll('[data-toc] a');
  const tocMap = {};
  tocLinks.forEach(a => { tocMap[a.getAttribute('href').slice(1)] = a; });
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && tocMap[e.target.id]) {
        tocLinks.forEach(l => l.classList.remove('active'));
        tocMap[e.target.id].classList.add('active');
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  h2s.forEach(h => io.observe(h));

  // post-foot (タグ + シェア) を末尾に追加
  const footTpl = document.getElementById('tpl-post-foot');
  if (footTpl && post.tags && post.tags.length) {
    const foot = footTpl.content.cloneNode(true);
    const tagsHost = foot.querySelector('[data-post="tags"]');
    tagsHost.innerHTML = post.tags.map(t => `<span>#${t}</span>`).join('');
    foot.querySelector('[data-share="x"]').addEventListener('click', () => {
      const url = location.href;
      const text = post.title;
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    });
    foot.querySelector('[data-share="copy"]').addEventListener('click', () => {
      navigator.clipboard.writeText(location.href);
    });
    bodyHost.appendChild(foot);
  }

  // 関連記事3本: 同カテゴリグループ優先、なければ最新
  const relatedHost = document.querySelector('[data-related]');
  if (relatedHost) {
    const sameGroup = posts.filter(p => p.slug !== slug && p.categoryGroup === post.categoryGroup);
    const others = posts.filter(p => p.slug !== slug && p.categoryGroup !== post.categoryGroup);
    const related = [...sameGroup, ...others].slice(0, 3);
    relatedHost.innerHTML = related.map(p => `
      <a class="related-card" href="blog-post.html?slug=${encodeURIComponent(p.slug)}">
        <span class="cat">${p.categoryLabel}</span>
        <h4>${escapeHtml(p.title)}</h4>
      </a>
    `).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  }
})();
