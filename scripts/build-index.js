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

  // 書き出し
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(posts, null, 2) + '\n', 'utf8');

  // sitemap.xml
  const today = new Date().toISOString().slice(0, 10);
  const staticUrls = ['', 'services.html', 'company.html', 'contact.html', 'blog.html'];
  const postUrls = posts.map(p => `blog-post.html?slug=${p.slug}`);
  const all = [...staticUrls, ...postUrls];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url><loc>${SITE_URL}/${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(OUT_SITEMAP, sitemap, 'utf8');

  console.log(`✓ posts.json (${posts.length}本) と sitemap.xml を出力しました`);
}

main();
