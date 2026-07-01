#!/usr/bin/env node
/**
 * posts/*.md を読んで data/posts.json と sitemap.xml を再生成する。
 * frontmatter は <!--META { ... } META--> 形式の JSON。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_JSON = path.join(DATA_DIR, 'posts.json');
const OUT_SITEMAP = path.join(ROOT, 'sitemap.xml');
const SITE_URL = (process.env.SITE_URL || 'https://teneramente.jp').replace(/\/$/, '');

// カテゴリ定義（slug → 表示名 + フィルタグループ）
// フィルタグループ: MEO/AIO は同じタブにまとめる。
const CATEGORIES = {
  meo: { label: 'MEO',     group: 'meo', glyph: 'M' },
  aio: { label: 'AIO',     group: 'meo', glyph: 'A' },
  app: { label: 'Web App', group: 'app', glyph: 'W' },
  hp:  { label: 'HP / LP', group: 'hp',  glyph: 'H' },
  ai:  { label: 'AI',      group: 'ai',  glyph: 'A' },
};

const VISUALS = ['default', 'v-violet', 'v-cyan'];
const META_RE = /<!--META\s+([\s\S]*?)\s+META-->/;

function extractMeta(raw, file) {
  const m = raw.match(META_RE);
  if (!m) throw new Error(`${file}: missing <!--META ... META--> block`);
  try { return JSON.parse(m[1]); }
  catch (e) { throw new Error(`${file}: invalid JSON in META — ${e.message}`); }
}

function stripMeta(raw) {
  return raw.replace(META_RE, '').trim();
}

function jpCharCount(body) {
  return body.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
}

function readMinutes(body) {
  // 日本語 ~600字/分 を目安
  return Math.max(3, Math.round(jpCharCount(body) / 600));
}

function buildTOC(body) {
  const toc = [];
  const lines = body.split('\n');
  let inCode = false;
  let i = 0;
  for (const line of lines) {
    if (/^```/.test(line)) inCode = !inCode;
    if (inCode) continue;
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      i++;
      toc.push({ id: 'h' + i, n: String(i).padStart(2, '0'), label: m[1].trim() });
    }
  }
  return toc;
}

function formatDate(d) {
  const dt = new Date(d + 'T00:00:00Z');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function main() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error('posts/ ディレクトリが見つかりません');
    process.exit(1);
  }

  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  if (!files.length) {
    console.error('posts/*.md が0件です');
    process.exit(1);
  }

  const posts = files.map(file => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const meta = extractMeta(raw, file);
    const body = stripMeta(raw);
    const slug = file.replace(/\.md$/, '');

    // 必須フィールド検証
    ['title', 'date', 'category', 'excerpt'].forEach(k => {
      if (!meta[k]) throw new Error(`${file}: required field "${k}" is missing`);
    });
    const cat = CATEGORIES[meta.category];
    if (!cat) throw new Error(`${file}: unknown category "${meta.category}"`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: date must be YYYY-MM-DD`);

    return {
      slug,
      title: meta.title,
      date: meta.date,
      dateLabel: formatDate(meta.date),
      category: meta.category,
      categoryLabel: cat.label,
      categoryGroup: cat.group,
      excerpt: meta.excerpt,
      tags: meta.tags || [],
      readMin: meta.readMin || readMinutes(body),
      glyph: meta.glyph || cat.glyph,
      featured: !!meta.featured,
      toc: buildTOC(body),
    };
  });

  // 新しい順
  posts.sort((a, b) => b.date.localeCompare(a.date));

  // featured は最新の1本のみに正規化（複数指定があれば最新だけ残す）
  let featuredFound = false;
  posts.forEach(p => {
    if (p.featured && !featuredFound) featuredFound = true;
    else p.featured = false;
  });
  if (!featuredFound && posts.length) posts[0].featured = true;

  // 一覧カードのビジュアル&番号を自動採番
  posts.forEach((p, i) => {
    p.visual = VISUALS[i % VISUALS.length];
    p.number = String(i + 1).padStart(2, '0');
  });

  // カバー画像を自動生成し、存在する記事に image を付与(無くてもビルドは続行)
  try {
    const covered = require('./gen-covers').generate(posts, ROOT);
    posts.forEach(p => { if (covered.has(p.slug)) p.image = `assets/img/covers/${p.slug}.png`; });
  } catch (e) {
    console.warn('△ カバー画像の生成に失敗:', e.message);
  }

  // 書き出し
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(posts, null, 2) + '\n', 'utf8');

  // 記事ごとの静的ページ <slug>.html を生成(SNSのOGP・canonical対策)。
  // blog-post.html をテンプレートに <head> のメタだけ差し替える。本文は従来どおりJSで描画。
  // 旧生成物(記事slug形式の .html)は削除してから作り直す。
  const POST_PAGE_RE = /^\d{4}-\d{2}-\d{2}-[A-Za-z0-9-]+\.html$/;
  fs.readdirSync(ROOT).filter(f => POST_PAGE_RE.test(f))
    .forEach(f => fs.unlinkSync(path.join(ROOT, f)));

  const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const template = fs.readFileSync(path.join(ROOT, 'blog-post.html'), 'utf8');

  posts.forEach(p => {
    const url = `${SITE_URL}/${p.slug}.html`;
    const metas = {
      'description': p.excerpt,
      'og:title': p.title,
      'og:description': p.excerpt,
      'og:url': url,
      'twitter:title': p.title,
      'twitter:description': p.excerpt,
    };
    if (p.image) {
      metas['og:image'] = `${SITE_URL}/${p.image}`;
      metas['twitter:image'] = `${SITE_URL}/${p.image}`;
    }
    let html = template.replace(/<title data-meta="title">[\s\S]*?<\/title>/,
      () => `<title data-meta="title">${escAttr(p.title)} — TENERAMENTE Blog</title>`);
    for (const [k, v] of Object.entries(metas)) {
      html = html.replace(new RegExp(`(data-meta="${k}" content=")[^"]*(")`),
        (m, a, b) => a + escAttr(v) + b);
    }
    html = html.replace(/(data-canonical href=")[^"]*(")/, (m, a, b) => a + url + b);
    const ld = {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: p.title, description: p.excerpt,
      datePublished: p.date, dateModified: p.date, inLanguage: 'ja',
      mainEntityOfPage: url,
      image: p.image ? `${SITE_URL}/${p.image}` : `${SITE_URL}/assets/img/ogp.png`,
      author: { '@type': 'Person', name: '加藤 聖矢' },
      publisher: { '@type': 'Organization', name: '株式会社TENERAMENTE',
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/img/favicon-512.png` } },
      keywords: (p.tags || []).join(', '),
    };
    html = html.replace('</head>',
      `<script>window.__POST_SLUG__=${JSON.stringify(p.slug)};</script>\n` +
      `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n</head>`);
    fs.writeFileSync(path.join(ROOT, `${p.slug}.html`), html, 'utf8');
  });

  // sitemap.xml
  const today = new Date().toISOString().slice(0, 10);
  const staticUrls = [
    '', 'services.html', 'company.html', 'contact.html', 'blog.html',
    'lp-ai-app.html', 'lp-hplp.html', 'lp-meo.html',
    'lp-milpage.html', 'lp-ldash.html', 'ミエルームLP/ミエルーム.html',
  ];
  const postUrls = posts.map(p => `${p.slug}.html`);
  const all = [...staticUrls, ...postUrls];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url><loc>${SITE_URL}/${encodeURI(u).replace(/&/g, '&amp;')}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(OUT_SITEMAP, sitemap, 'utf8');

  console.log(`✓ posts.json (${posts.length}本) と sitemap.xml を出力しました`);
}

main();
