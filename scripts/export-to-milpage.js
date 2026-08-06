#!/usr/bin/env node
/**
 * export-to-milpage.js — 既存ブログをミルページへ引っ越すための一度きりのスクリプト。
 *
 * posts/*.md（既存記事）を読み、ミルページの
 *   設定 → データ管理 → 「バックアップから復元」
 * にそのまま読み込ませられる JSON を export/milpage-import.json に書き出す。
 *
 * 実行:  node scripts/export-to-milpage.js
 *
 * 引っ越し後の日常運用は逆向き（ミルページ → posts/*.md）で、
 * scripts/sync-milpage.js が担当する。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const OUT_DIR = path.join(ROOT, 'export');
const OUT_FILE = path.join(OUT_DIR, 'milpage-import.json');
const SITE_URL = (process.env.SITE_URL || 'https://teneramente.jp').replace(/\/$/, '');

// HP側のカテゴリ記号 → ミルページ上の表示名。sync-milpage.js と必ず同じ表にすること。
const CATEGORY_LABEL = {
  meo: 'MEO',
  aio: 'AIO',
  app: 'Web App',
  hp: 'HP / LP',
  ai: 'AI',
};

// ミルページ側に「注目記事」の項目が無いので、このタグで代用する（sync-milpage.js が復元する）
const FEATURED_TAG = 'featured';

const META_RE = /<!--META\s+([\s\S]*?)\s+META-->/;

function extractMeta(raw, file) {
  const m = raw.match(META_RE);
  if (!m) throw new Error(`${file}: <!--META ... META--> ブロックがありません`);
  try { return JSON.parse(m[1]); }
  catch (e) { throw new Error(`${file}: META の JSON が壊れています — ${e.message}`); }
}

function main() {
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md')).sort();
  if (!files.length) {
    console.error('posts/*.md が0件です');
    process.exit(1);
  }

  const now = new Date().toISOString();
  const posts = files.map((file, i) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const meta = extractMeta(raw, file);
    const body = raw.replace(META_RE, '').trim();
    const slug = file.replace(/\.md$/, '');
    const label = CATEGORY_LABEL[meta.category];
    if (!label) throw new Error(`${file}: 未知のカテゴリ "${meta.category}"`);

    const cover = path.join(ROOT, 'assets', 'img', 'covers', `${slug}.png`);
    const tags = (meta.tags || []).slice();
    if (meta.featured && !tags.includes(FEATURED_TAG)) tags.push(FEATURED_TAG);
    return {
      id: `posts_hp${String(i + 1).padStart(3, '0')}`,
      slug,
      title: meta.title,
      category: label,
      status: 'published',
      publishAt: meta.date,
      body,
      excerpt: meta.excerpt || '',
      tags,
      thumb: fs.existsSync(cover) ? `${SITE_URL}/assets/img/covers/${slug}.png` : '',
      seoTitle: '',
      seoDesc: meta.excerpt || '',
      createdAt: `${meta.date}T09:00:00.000Z`,
      updatedAt: now,
    };
  });

  // ミルページの一覧は新しい順で見たいので、新しい記事を先頭にする
  posts.sort((a, b) => (a.publishAt < b.publishAt ? 1 : a.publishAt > b.publishAt ? -1 : 0));

  const data = {
    posts,
    blogConfig: {
      industryDetail: 'AI×WEBアプリ開発・HP/LP制作・MEO/AIO運用',
      target: '中小企業の経営者・店舗オーナー',
      area: '全国（オンライン対応）',
      keywords: ['AI業務改善', 'WEBアプリ開発', 'MEO対策', 'AIO', 'ホームページ制作'],
      tone: '落ち着いた・専門的',
      ng: [],
      cta: '無料相談',
      blogUrl: `${SITE_URL}/blog.html`,
      defaultLength: 'long',
      categories: Object.values(CATEGORY_LABEL),
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const withThumb = posts.filter(p => p.thumb).length;
  console.log(`✓ ${posts.length}本を書き出しました → export/milpage-import.json`);
  console.log(`  カバー画像あり: ${withThumb}本 / カテゴリ: ${data.blogConfig.categories.join('・')}`);
  console.log('  ミルページの「設定 → データ管理 → バックアップから復元」で読み込んでください。');
}

main();
