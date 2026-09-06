#!/usr/bin/env node
/**
 * build-mieroom.js — ミルページで書いたミエルームの記事を、サイトのページに起こす。
 *
 *   mieroom/posts/<slug>.md
 *     → mieroom/articles/<slug>.html を生成（既存記事とまったく同じ見た目）
 *     → mieroom/blog.html の一覧に記事カードを差し込む
 *
 * 手書きの既存記事7本には触らない。ミルページ由来の記事だけを、
 * blog.html の <!-- MILPAGE:START --> 〜 <!-- MILPAGE:END --> の間で管理する。
 * サイトマップは build-index.js が mieroom/articles/*.html を列挙するので自動で載る。
 */
const fs = require('fs');
const path = require('path');
const covers = require('./gen-covers-mieroom');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'mieroom', 'posts');
const ARTICLES_DIR = path.join(ROOT, 'mieroom', 'articles');
const BLOG_HTML = path.join(ROOT, 'mieroom', 'blog.html');
const SITE_URL = (process.env.SITE_URL || 'https://teneramente.jp').replace(/\/$/, '');

const META_RE = /<!--META\s+([\s\S]*?)\s+META-->/;
const MARK_START = '<!-- MILPAGE:START ミルページで書いた記事。ここは自動生成なので直接編集しないでください -->';
const MARK_END = '<!-- MILPAGE:END -->';

// カテゴリごとの色とアイコン（既存記事から起こした。未知のカテゴリは既定を使う）
const STYLES = {
  '売上管理':   { grad: '135deg,#2bbfa3,#0c7b66', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  '業務効率化': { grad: '135deg,#37c0a6,#0e8a72', icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>' },
  '集客・広告': { grad: '135deg,#f2a98f,#e07a5f', icon: '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>' },
  '組織・育成': { grad: '135deg,#f2a98f,#e07a5f', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/>' },
  'DX':         { grad: '135deg,#2bbfa3,#0c7b66', icon: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>' },
};
const DEFAULT_STYLE = { grad: '135deg,#2bbfa3,#0c7b66', icon: '<path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3v6h6"/>' };

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function extractMeta(raw, file) {
  const m = raw.match(META_RE);
  if (!m) throw new Error(`${file}: <!--META ... META--> ブロックがありません`);
  try { return JSON.parse(m[1]); }
  catch (e) { throw new Error(`${file}: META の JSON が壊れています — ${e.message}`); }
}

/** 日本語 ~600字/分。既存記事の表記に合わせる */
function readMinutes(body) {
  const n = body.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
  return Math.max(3, Math.round(n / 600));
}

/** 2026-06-08 → 2026.06.08（既存記事の表記） */
const dotDate = (d) => String(d || '').replace(/-/g, '.');

/**
 * 素のMarkdown → 記事本文のHTML。
 * 見出し・段落・箇条書き・番号付き・強調・リンク・表を扱い、
 * 行頭が < で始まる行は生HTMLとしてそのまま通す（callout や FAQ を書けるように）。
 * 外部ライブラリを足さないのは、npm install なしに動かすため。
 *
 * H2 には目次用の id を振り、その一覧を toc として返す（TENERAMENTE 側と同じ形）。
 * 戻り値: { html, toc: [{ id, n, label }] }
 */
function mdToHtml(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = [];
  const toc = [];
  let para = [], list = null, h2n = 0;

  const inline = (t) => esc(t)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  // Markdown の表（| … | の3行以上）。区切り行のコロンで列の寄せを決める
  const isRow = (s) => /^\|.*\|$/.test(s);
  const isDivider = (s) => /^\|[\s:|-]+\|$/.test(s) && s.includes('-');
  const cells = (s) => s.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }

    if (line.startsWith('<')) { flushPara(); flushList(); out.push(raw); continue; }

    if (isRow(line) && isDivider((lines[i + 1] || '').trim())) {
      flushPara(); flushList();
      const head = cells(line);
      const align = cells(lines[i + 1].trim()).map(d =>
        /^:-+:$/.test(d) ? ' style="text-align:center"' : /-+:$/.test(d) ? ' style="text-align:right"' : ''
      );
      const body = [];
      let j = i + 2;
      for (; j < lines.length && isRow(lines[j].trim()); j++) body.push(cells(lines[j].trim()));
      i = j - 1;
      out.push('<div class="tw"><table>');
      out.push('<thead><tr>' + head.map((c, k) => `<th${align[k] || ''}>${inline(c)}</th>`).join('') + '</tr></thead>');
      if (body.length) {
        out.push('<tbody>' + body.map(r =>
          '<tr>' + r.map((c, k) => `<td${align[k] || ''}>${inline(c)}</td>`).join('') + '</tr>'
        ).join('\n') + '</tbody>');
      }
      out.push('</table></div>');
      continue;
    }

    const h = line.match(/^(#{2,4})\s+(.+)$/);
    if (h) {
      flushPara(); flushList();
      const lv = Math.min(h[1].length, 4);
      const label = h[2].trim();
      if (lv === 2) {
        h2n++;
        const id = 'h' + h2n;
        toc.push({ id, n: String(h2n).padStart(2, '0'), label: label.replace(/^\d{2}[\s.．:：]+/, '') });
        out.push(`<h2 id="${id}">${inline(label)}</h2>`);
      } else {
        out.push(`<h${lv}>${inline(label)}</h${lv}>`);
      }
      continue;
    }
    const ul = line.match(/^[-*・]\s+(.+)$/);
    if (ul) {
      flushPara();
      if (list !== 'ul') { flushList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\d+[.)]\s+(.+)$/);
    if (ol) {
      flushPara();
      if (list !== 'ol') { flushList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return { html: out.join('\n'), toc };
}

/** 目次。H2 が2本以上あるときだけ出す（TENERAMENTE の記事ページと同じ見せ方） */
function tocHtml(toc) {
  if (!toc || toc.length < 2) return '';
  const items = toc.map(t =>
    `      <a href="#${t.id}"><span class="n">${t.n}</span><span>${esc(t.label)}</span></a>`
  ).join('\n');
  return `<nav class="post-toc" aria-label="目次">
    <div class="post-toc-t">目次</div>
    <div class="post-toc-list">
${items}
    </div>
  </nav>`;
}

/**
 * 本文の先頭（リード段落・結論ボックス）の直後に目次を差し込む。
 * TENERAMENTE の記事と同じ「リード → 結論 → 目次 → 本文」の順にする。
 */
function insertToc(bodyHtml, toc) {
  const nav = tocHtml(toc);
  if (!nav) return bodyHtml;
  const firstH2 = bodyHtml.indexOf('<h2 id=');
  if (firstH2 < 0) return bodyHtml;
  return bodyHtml.slice(0, firstH2) + nav + '\n' + bodyHtml.slice(firstH2);
}

/** 記事ページのHTML（既存記事と同じ構造・同じCSSを使う） */
function articleHtml(p) {
  const st = STYLES[p.category] || DEFAULT_STYLE;
  const url = `${SITE_URL}/mieroom/articles/${p.slug}.html`;
  const tags = (p.tags || []).map(t => `<span class="pt">#${esc(t)}</span>`).join('');
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: p.title, description: p.excerpt,
    datePublished: p.date, dateModified: p.date, inLanguage: 'ja',
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'ミエルーム編集部' },
    publisher: {
      '@type': 'Organization', name: '株式会社TENERAMENTE',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/img/favicon-512.png` },
    },
    keywords: (p.tags || []).join(', '),
  };
  // <script> の中に JSON を書くので "<" を逃がす（"</script>" で閉じられるのを防ぐ）
  const ldJson = JSON.stringify(ld).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.title)}｜ミエルーム ブログ</title>
<meta name="description" content="${esc(p.excerpt)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.excerpt)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="ミエルーム">
${p.cover ? `<meta property="og:image" content="${SITE_URL}/mieroom/${p.cover}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="675">
` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/site.css">
<script type="application/ld+json">${ldJson}</script>
<style id="mp-nav-fit">
/* 狭い画面ではヘッダーのボタンを小さくして、右にはみ出さないようにする */
@media (max-width: 640px) {
  .nav-cta { gap: 6px; }
  .nav-cta .btn { padding: 9px 11px; font-size: 13px; }
}
</style>
</head>
<body>

<header class="site">
  <div class="wrap nav">
    <a class="brand" href="../index.html">
      <img class="logo" src="../assets/logo-mark-sm.webp" alt="ミエルーム">
      <span class="name"><b>ミエ</b><i>ルーム</i></span>
    </a>
    <nav class="nav-links">
      <a href="../index.html">ホーム</a>
      <a href="../features.html">機能・事例</a>
      <a href="../compare.html">比較</a>
      <a href="../blog.html" class="on">ブログ</a>
      <a href="../index.html#faq">料金</a>
    </nav>
    <div class="nav-cta">
      <a class="btn btn-ghost" href="https://app.mieroom.cloud/app-login" style="border-color:transparent;opacity:.8">ログイン</a>
      <a class="btn btn-ghost" href="https://app.mieroom.cloud/apply" target="_blank" rel="noopener">デモアカウント発行</a>
      <a class="btn btn-line" href="https://line-harness.teneramente0701.workers.dev/r/lp" target="_blank" rel="noopener"><svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 5.7 2 10.3c0 4.1 3.6 7.5 8.5 8.1.3.1.8.2.9.5.1.3.1.7 0 1l-.1.8c-.1.4-.4 1.5 1.3.8s8.9-5.2 12.1-9c2.2-2.4-1.2-10.3-12.7-10.3Z"/></svg>LINEで相談</a>
    </div>
  </div>
</header>
<article>
<section class="post-hero">
  <span class="blob" style="width:240px;height:240px;top:-70px;right:-40px;background:radial-gradient(circle,#74d3bd,#bdeede);opacity:.5;animation:sway 9s ease-in-out infinite"></span>
  <div class="wrap">
    <div class="post-narrow">
      <div class="crumb" style="margin-bottom:16px;font-size:12.5px;color:var(--ink-3);font-weight:600;display:flex;gap:6px;flex-wrap:wrap">
        <a href="../index.html" style="color:inherit">ホーム</a><span style="opacity:.5">/</span>
        <a href="../blog.html" style="color:inherit">ブログ</a><span style="opacity:.5">/</span>
        <span>${esc(p.category)}</span>
      </div>
      <span class="post-cat" style="background:linear-gradient(${st.grad})">${esc(p.category)}</span>
      <h1>${esc(p.title)}</h1>
      <div class="post-meta">
        <span class="av">ミ</span>
        <span>ミエルーム編集部</span>
        <span class="sep"></span>
        <span>${dotDate(p.date)}</span>
        <span class="sep"></span>
        <span>${p.readMin}分で読める</span>
      </div>
    </div>
  </div>
</section>
<div class="post-cover">
  ${p.cover ? `<div class="band band--img"><img src="../${p.cover}" alt="${esc(p.title)}" width="1200" height="675"></div>`
  : coverName(p) ? `<div class="band band--img"><img src="../assets/cover-bg/${coverName(p)}.webp" alt="" width="1200" height="675"></div>`
  : `<div class="band" style="background:linear-gradient(${st.grad})">
    <span class="ring" style="width:220px;height:220px;top:-50px;right:60px"></span>
    <span class="ring" style="width:130px;height:130px;bottom:-30px;left:80px"></span>
    <svg viewBox="0 0 24 24">${st.icon}</svg>
  </div>`}
</div>
<div class="post-body">
${p.bodyHtml}
${tags ? `\n  <div class="post-tags">${tags}</div>` : ''}
</div>
<div class="inline-cta">
  <div class="box">
    <div>
      <h3>記事のノウハウ、ミエルームで実践できます。</h3>
      <p>後AD・申込管理から媒体別ROIまで。賃貸仲介の数字を、ひとつの画面に。お申し込みから最短即日でスタートできます。</p>
    </div>
    <a class="btn btn-primary" href="https://app.mieroom.cloud/apply" target="_blank" rel="noopener" style="flex:none">デモアカウント発行</a>
  </div>
</div>
</article>
<div data-chrome="footer"></div>
<script src="../assets/site.js"></script>
<script src="../../assets/milpage.js" async></script>
</body>
</html>
`;
}

// 記事テーマに合わせたカバー画像（mieroom/assets/cover-bg/*.webp）
const COVER_BY_SLUG = {"moushikomi-kanrihyo-tsukurikata": "moushikomi", "gyomu-kaizen-tool-teichaku": "teichaku", "tenpo-muke-tool-hitsuyo-kino": "nagare", "fudosan-chukai-gyomu-kaizen-tool-donyu": "teichaku", "fudosan-kaigyo-junbi-checklist": "kaigyo", "hitori-fudosan-kaigyo-tool": "kaigyo", "fudosan-ai-katsuyo-bamen": "ai-katsuyo", "fudosan-gyomu-tool-minaoshi": "nagare"};
const COVER_BY_CATEGORY = {"売上管理": "moushikomi", "業務効率化": "nagare", "集客・広告": "ai-katsuyo", "組織・育成": "kaigyo", "DX": "teichaku"};
function coverName(p) { return COVER_BY_SLUG[p.slug] || COVER_BY_CATEGORY[p.category] || ''; }

/** blog.html に差し込む記事カード */
function cardHtml(p) {
  const st = STYLES[p.category] || DEFAULT_STYLE;
  const searchText = [p.title, ...(p.tags || [])].join(' ');
  return `      <a class="bpost" data-cat="${esc(p.category)}" data-text="${esc(searchText)}" href="articles/${encodeURIComponent(p.slug)}.html">
        ${p.cover ? `<div class="bcover bcover--img"><img src="${p.cover}" alt="${esc(p.title)}" loading="lazy" width="1200" height="675"></div>`
        : coverName(p) ? `<div class="bcover bcover--img"><img src="assets/cover-bg/${coverName(p)}.webp" alt="" loading="lazy" width="1200" height="675"></div>`
        : `<div class="bcover" style="background:linear-gradient(${st.grad})">
          <span class="ring" style="width:150px;height:150px;top:-30px;right:-30px"></span>
          <span class="ring" style="width:90px;height:90px;bottom:-20px;left:30px"></span>
          <svg viewBox="0 0 24 24">${st.icon}</svg>
        </div>`}
        <div class="bbody">
          <div class="bmeta"><span class="bcat">${esc(p.category)}</span><span class="bdate">${dotDate(p.date)}</span></div>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.excerpt)}</p>
          <span class="bread">${p.readMin}分で読める <span class="arr">→</span></span>
        </div>
      </a>`;
}

function main() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.log('mieroom/posts/ がまだありません（ミルページで記事を公開すると作られます）');
    return;
  }
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

  const posts = files.map(file => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const meta = extractMeta(raw, file);
    const body = raw.replace(META_RE, '').trim();
    ['title', 'date', 'category', 'excerpt'].forEach(k => {
      if (!meta[k]) throw new Error(`${file}: 「${k}」が空です`);
    });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: 公開日は YYYY-MM-DD 形式にしてください`);
    const slug = file.replace(/\.md$/, '');
    const { html, toc } = mdToHtml(body);
    return {
      slug,
      title: meta.title, date: meta.date, category: meta.category,
      excerpt: meta.excerpt, tags: meta.tags || [],
      hook: meta.hook || '',
      readMin: meta.readMin || readMinutes(body),
      toc,
      bodyHtml: insertToc(html, toc),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));

  // カバー画像（記事タイトル入り）。作れた記事は生成PNG、作れなければ従来の背景画像を使う
  posts.forEach(p => { p.coverBg = coverName(p); });
  const withCover = covers.generate(posts, ROOT);
  posts.forEach(p => { p.cover = withCover.has(p.slug) ? `assets/covers/${p.slug}.png` : ''; });

  // 記事ページ（ミルページ由来のものだけを作り直す。手書きの既存記事には触らない）
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  const wantFiles = new Set(posts.map(p => `${p.slug}.html`));
  posts.forEach(p => {
    fs.writeFileSync(path.join(ARTICLES_DIR, `${p.slug}.html`), articleHtml(p), 'utf8');
  });

  // 一覧に差し込む（マーカーの間だけを入れ替える）
  let blog = fs.readFileSync(BLOG_HTML, 'utf8');
  const cards = posts.length ? '\n' + posts.map(cardHtml).join('\n\n') + '\n' : '\n';
  const block = MARK_START + cards + MARK_END;
  if (blog.includes(MARK_START) && blog.includes(MARK_END)) {
    blog = blog.replace(new RegExp(MARK_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + MARK_END), block);
  } else {
    const anchor = '<div class="blog-grid stagger" id="grid">';
    if (!blog.includes(anchor)) throw new Error('mieroom/blog.html に記事一覧の入れ物が見つかりません');
    blog = blog.replace(anchor, anchor + '\n' + block);
  }
  fs.writeFileSync(BLOG_HTML, blog, 'utf8');

  console.log(`✓ ミエルーム: 記事 ${posts.length}本を生成し、blog.html の一覧に反映しました`);
  posts.forEach(p => console.log(`    ・${p.date} [${p.category}] ${p.title.slice(0, 34)}`));
  const stale = fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.html') && !wantFiles.has(f));
  console.log(`  （手書きの既存記事 ${stale.length}本には触れていません）`);
}

main();
