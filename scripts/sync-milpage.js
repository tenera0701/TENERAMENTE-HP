#!/usr/bin/env node
/**
 * sync-milpage.js — ミルページで書いた記事を、このサイトの posts/*.md に取り込む。
 *
 *   ミルページ管理画面（公開中の記事）
 *     → GET /api/public/posts?store=<店舗ID>
 *       → posts/<slug>.md を生成・更新
 *         → scripts/build-index.js が posts.json・<slug>.html・sitemap.xml を再生成
 *
 * 記事の見た目・URL・SEO の仕組みは今までのまま。変わるのは「本文の書き場所」だけ。
 *
 * 実行:
 *   node scripts/sync-milpage.js            取り込みのみ
 *   node scripts/sync-milpage.js --build    取り込み後に build-index.js まで実行
 *   node scripts/sync-milpage.js --prune    ミルページ側で消された記事の .md も削除する
 *   node scripts/sync-milpage.js --dry-run  書き込まずに差分だけ表示
 *
 * 接続先は data/milpage.json（環境変数 MILPAGE_API / MILPAGE_STORE で上書き可）。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const CONFIG_FILE = path.join(ROOT, 'data', 'milpage.json');

// ミルページ上の表示名 → HP側のカテゴリ記号。export-to-milpage.js と必ず同じ表にすること。
const CATEGORY_KEY = {
  'MEO': 'meo',
  'AIO': 'aio',
  'Web App': 'app',
  'HP / LP': 'hp',
  'AI': 'ai',
};
// ミルページ既定のカテゴリが選ばれていた場合の受け皿（ビルドを止めないため）
const FALLBACK_CATEGORY = 'ai';

// ミルページ側に「注目記事」の項目が無いので、このタグを付けた記事を Featured 扱いにする。
// （タグ自体は記事に表示されないよう取り除く。無指定なら最新記事が自動で Featured）
const FEATURED_TAGS = ['featured', '注目', '注目記事'];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PRUNE = args.includes('--prune');
const BUILD = args.includes('--build');

function loadConfig() {
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch (e) { throw new Error(`data/milpage.json の JSON が壊れています — ${e.message}`); }
  }
  const api = (process.env.MILPAGE_API || cfg.apiBase || '').replace(/\/$/, '');
  const store = process.env.MILPAGE_STORE || cfg.storeId || '';
  if (!api) {
    throw new Error('data/milpage.json に apiBase（ミルページのURL）がありません');
  }
  return { api, store };
}

/** 記事本文から要約を作る（ミルページ側が空欄だったときの保険） */
function autoExcerpt(body) {
  const text = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/[*_`>|-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 90);
}

/** ミルページの記事1件 → posts/<slug>.md の中身 */
function toMarkdown(post) {
  const meta = {
    title: post.title,
    date: post.date,
    category: post.category,
    excerpt: post.excerpt,
    tags: post.tags,
  };
  if (post.featured) meta.featured = true;
  // tags は1行に畳む（既存ファイルと同じ体裁にして、毎日の同期で無駄な差分を出さない）
  const tagsLine = '[' + (meta.tags || []).map(t => JSON.stringify(t)).join(', ') + ']';
  const json = JSON.stringify(meta, null, 2)
    .replace(/"tags": \[[\s\S]*?\]/, () => '"tags": ' + tagsLine);
  return `<!--META\n${json}\nMETA-->\n\n${post.body.trim()}\n`;
}

/** 日付を YYYY-MM-DD に正規化（build-index.js の検証に合わせる） */
function normalizeDate(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return '';
}

/** slug を安全な形（半角英数とハイフン）に整える */
function safeSlug(post) {
  const raw = String(post.slug || '').trim();
  const cleaned = raw.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned;
}

async function main() {
  const { api, store } = loadConfig();
  if (!store) {
    console.log('店舗IDが未設定なので同期をスキップしました（サイトは posts/*.md のまま動きます）。');
    console.log('  ミルページの「連携 → サイト連携」で店舗IDを確認し、data/milpage.json の storeId に貼ってください。');
    return;
  }
  const url = `${api}/api/public/posts?store=${encodeURIComponent(store)}`;

  let res;
  try {
    res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  } catch (e) {
    throw new Error(`ミルページに接続できませんでした（${api}）— ${e.message}`);
  }
  if (!res.ok) {
    const detail = res.status === 404 ? '店舗IDが違う可能性があります' : '';
    throw new Error(`ミルページの応答が ${res.status} でした ${detail}`.trim());
  }
  const data = await res.json();
  const remote = Array.isArray(data.posts) ? data.posts : [];
  console.log(`ミルページ「${data.storeName || store}」から ${remote.length}本を取得しました`);

  fs.mkdirSync(POSTS_DIR, { recursive: true });

  const written = [];
  const skipped = [];
  const seen = new Set();

  for (const p of remote) {
    const slug = safeSlug(p);
    const date = normalizeDate(p.date);
    if (!slug) { skipped.push(`「${p.title || '(無題)'}」— URL名（スラッグ）が未入力`); continue; }
    if (!p.title) { skipped.push(`${slug} — タイトルが空`); continue; }
    if (!date) { skipped.push(`${slug} — 公開日が不正（${p.date}）`); continue; }
    if (seen.has(slug)) { skipped.push(`${slug} — URL名が他の記事と重複`); continue; }
    if (!String(p.body || '').trim()) { skipped.push(`${slug} — 本文が空`); continue; }
    seen.add(slug);

    const category = CATEGORY_KEY[p.category];
    if (!category) {
      console.warn(`△ ${slug}: カテゴリ「${p.category}」はサイト側に無いので ${FALLBACK_CATEGORY} として扱います`);
    }

    const rawTags = p.tags || [];
    const featured = rawTags.some(t => FEATURED_TAGS.includes(String(t).trim().toLowerCase()));
    const md = toMarkdown({
      title: p.title,
      date,
      category: category || FALLBACK_CATEGORY,
      excerpt: (p.excerpt || '').trim() || autoExcerpt(p.body),
      tags: rawTags.filter(t => !FEATURED_TAGS.includes(String(t).trim().toLowerCase())),
      featured,
      body: p.body,
    });

    const file = path.join(POSTS_DIR, `${slug}.md`);
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (before === md) continue;              // 中身が同じなら触らない
    if (!DRY_RUN) fs.writeFileSync(file, md, 'utf8');
    written.push(`${before === null ? '新規' : '更新'} ${slug}`);
  }

  // ミルページ側から消えた記事
  const localSlugs = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3));
  const orphans = localSlugs.filter(s => !seen.has(s));
  if (orphans.length) {
    if (PRUNE) {
      orphans.forEach(s => {
        if (!DRY_RUN) fs.unlinkSync(path.join(POSTS_DIR, `${s}.md`));
        written.push(`削除 ${s}`);
      });
    } else {
      console.log(`  ミルページに無い記事 ${orphans.length}本はそのまま残します（消すなら --prune）:`);
      orphans.forEach(s => console.log(`    ・${s}`));
    }
  }

  if (skipped.length) {
    console.log(`  取り込まなかった記事 ${skipped.length}本:`);
    skipped.forEach(s => console.log(`    ・${s}`));
  }

  if (!written.length) {
    console.log('✓ 変更はありません（サイトはすでに最新です）');
    return;
  }
  console.log(`${DRY_RUN ? '（試し実行）' : '✓'} ${written.length}件:`);
  written.forEach(w => console.log(`    ・${w}`));

  if (BUILD && !DRY_RUN) {
    console.log('--- build-index.js を実行します ---');
    execFileSync(process.execPath, [path.join(__dirname, 'build-index.js')], { stdio: 'inherit', cwd: ROOT });
  }
}

main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
