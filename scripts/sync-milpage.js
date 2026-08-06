#!/usr/bin/env node
/**
 * sync-milpage.js — ミルページで書いた記事を、このサイトの記事ファイルに取り込む。
 *
 *   ミルページ管理画面（公開中の記事）
 *     → GET /api/public/posts?store=<店舗ID>
 *       → <postsDir>/<slug>.md を生成・更新
 *         → 各サイトのビルドスクリプトがページ・一覧・サイトマップを再生成
 *
 * 記事の見た目・URL・SEO の仕組みは今までのまま。変わるのは「本文の書き場所」だけ。
 *
 * 対応サイト（data/milpage.json の sites）:
 *   ・TENERAMENTE … posts/*.md      → scripts/build-index.js
 *   ・ミエルーム   … mieroom/posts/*.md → scripts/build-mieroom.js
 *
 * 実行:
 *   node scripts/sync-milpage.js            取り込みのみ
 *   node scripts/sync-milpage.js --build    取り込み後にビルドまで実行
 *   node scripts/sync-milpage.js --prune    ミルページ側で消された記事の .md も削除する
 *   node scripts/sync-milpage.js --dry-run  書き込まずに差分だけ表示
 *   node scripts/sync-milpage.js --site=ミエルーム   特定のサイトだけ処理
 *
 * 接続先は data/milpage.json（環境変数 MILPAGE_API で上書き可）。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'data', 'milpage.json');

// ミルページ側に「注目記事」の項目が無いので、このタグを付けた記事を Featured 扱いにする。
// （タグ自体は記事に表示されないよう取り除く。無指定なら最新記事が自動で Featured）
const FEATURED_TAGS = ['featured', '注目', '注目記事'];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PRUNE = args.includes('--prune');
const BUILD = args.includes('--build');
const ONLY = (args.find(a => a.startsWith('--site=')) || '').replace('--site=', '');

function loadConfig() {
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch (e) { throw new Error(`data/milpage.json の JSON が壊れています — ${e.message}`); }
  }
  const api = (process.env.MILPAGE_API || cfg.apiBase || '').replace(/\/$/, '');
  if (!api) throw new Error('data/milpage.json に apiBase（ミルページのURL）がありません');

  // 旧形式（storeId 直書き）にも対応しておく
  let sites = Array.isArray(cfg.sites) ? cfg.sites : [];
  if (!sites.length && cfg.storeId) {
    sites = [{ name: 'サイト', storeId: cfg.storeId, postsDir: 'posts', build: 'build-index.js' }];
  }
  // 環境変数でひとつだけ差し替えたい場合（CI やお試し用）
  if (process.env.MILPAGE_STORE && sites.length) sites[0].storeId = process.env.MILPAGE_STORE;
  if (ONLY) sites = sites.filter(s => s.name === ONLY);
  return { api, sites };
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

/** ミルページの記事1件 → <slug>.md の中身 */
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

/** 日付を YYYY-MM-DD に正規化 */
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
  return String(post.slug || '').trim()
    .replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** 1サイト分の取り込み */
async function syncSite(api, site) {
  const label = site.name || site.storeId;
  if (!site.storeId) {
    console.log(`［${label}］店舗IDが未設定なのでスキップしました`);
    return false;
  }
  const url = `${api}/api/public/posts?store=${encodeURIComponent(site.storeId)}`;
  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (e) {
    throw new Error(`［${label}］ミルページに接続できませんでした（${api}）— ${e.message}`);
  }
  if (!res.ok) {
    const detail = res.status === 404 ? '店舗IDが違う可能性があります' : '';
    throw new Error(`［${label}］ミルページの応答が ${res.status} でした ${detail}`.trim());
  }
  const data = await res.json();
  const remote = Array.isArray(data.posts) ? data.posts : [];
  console.log(`［${label}］ミルページ「${data.storeName || site.storeId}」から ${remote.length}本を取得`);

  const postsDir = path.join(ROOT, site.postsDir);
  fs.mkdirSync(postsDir, { recursive: true });

  const written = [], skipped = [], seen = new Set();
  const catMap = site.categoryMap || null;

  for (const p of remote) {
    const slug = safeSlug(p);
    const date = normalizeDate(p.date);
    if (!slug) { skipped.push(`「${p.title || '(無題)'}」— URL名（スラッグ）が未入力`); continue; }
    if (!p.title) { skipped.push(`${slug} — タイトルが空`); continue; }
    if (!date) { skipped.push(`${slug} — 公開日が不正（${p.date}）`); continue; }
    if (seen.has(slug)) { skipped.push(`${slug} — URL名が他の記事と重複`); continue; }
    if (!String(p.body || '').trim()) { skipped.push(`${slug} — 本文が空`); continue; }
    seen.add(slug);

    // カテゴリ: 変換表があるサイトは記号へ、無いサイトはミルページの表示名をそのまま使う
    let category = p.category || '';
    if (catMap) {
      const mapped = catMap[p.category];
      if (!mapped) console.warn(`  △ ${slug}: カテゴリ「${p.category}」は変換表に無いので ${site.fallbackCategory} として扱います`);
      category = mapped || site.fallbackCategory || 'ai';
    }

    const rawTags = p.tags || [];
    const isFeatured = rawTags.some(t => FEATURED_TAGS.includes(String(t).trim().toLowerCase()));
    const md = toMarkdown({
      title: p.title,
      date,
      category,
      excerpt: (p.excerpt || '').trim() || autoExcerpt(p.body),
      tags: rawTags.filter(t => !FEATURED_TAGS.includes(String(t).trim().toLowerCase())),
      featured: isFeatured,
      body: p.body,
    });

    const file = path.join(postsDir, `${slug}.md`);
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (before === md) continue;
    if (!DRY_RUN) fs.writeFileSync(file, md, 'utf8');
    written.push(`${before === null ? '新規' : '更新'} ${slug}`);
  }

  // ミルページ側から消えた記事
  const localSlugs = fs.readdirSync(postsDir).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3));
  const orphans = localSlugs.filter(s => !seen.has(s));
  if (orphans.length) {
    if (PRUNE) {
      orphans.forEach(s => {
        if (!DRY_RUN) fs.unlinkSync(path.join(postsDir, `${s}.md`));
        written.push(`削除 ${s}`);
      });
    } else {
      console.log(`  ミルページに無い記事 ${orphans.length}本はそのまま残します（消すなら --prune）`);
    }
  }
  if (skipped.length) {
    console.log(`  取り込まなかった記事 ${skipped.length}本:`);
    skipped.forEach(s => console.log(`    ・${s}`));
  }
  if (!written.length) {
    console.log('  変更はありません');
    return false;
  }
  console.log(`  ${DRY_RUN ? '（試し実行）' : '✓'} ${written.length}件:`);
  written.forEach(w => console.log(`    ・${w}`));
  return true;
}

async function main() {
  const { api, sites } = loadConfig();
  if (!sites.length) {
    console.log('取り込む対象のサイトがありません（data/milpage.json の sites を確認してください）');
    return;
  }
  let changed = false;
  for (const site of sites) {
    if (await syncSite(api, site)) changed = true;
  }

  if (BUILD && !DRY_RUN) {
    // 変更が無くてもビルドは通す（前回の生成物が欠けている場合に備える）
    const builds = [...new Set(sites.map(s => s.build).filter(Boolean))];
    for (const b of builds) {
      console.log(`--- ${b} を実行します ---`);
      execFileSync(process.execPath, [path.join(__dirname, b)], { stdio: 'inherit', cwd: ROOT });
    }
  } else if (!changed) {
    console.log('✓ サイトはすでに最新です');
  }
}

main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
