#!/usr/bin/env node
/**
 * 記事カバー画像の自動生成(SVG → PNG 1200x630)
 *
 * build-index.js から呼ばれる。assets/img/covers/<slug>.png が無い記事だけ生成する。
 * デザインはサイトのデザイン言語(紙白 × 黒 × 青1色のエディトリアル)に合わせる。
 * 作り直したいときは PNG を削除して再ビルドする。
 *
 * レイアウトは1種類ではなく scripts/cover-layouts.js の複数の構図を日付で切り替える。
 * 毎日投稿しても連日で同じ絵にならない（1日ずれれば必ず別の構図になる）。
 * 記事ごとに構図を指定したいときは下の VARIANT_BY_SLUG に slug を足す。
 *
 * 依存: @resvg/resvg-js。Googleドライブ上の node_modules は破損するため、
 * ローカルディスク(C:/Users/<user>/.teneramente/cover-tools)に置いたものを参照する。
 * フォントも同じ場所(cover-tools/fonts)に置く(Zen Kaku Gothic New / IBM Plex Mono / Shippori Mincho)。
 * 見つからない場合は生成をスキップする(ビルド自体は止めない)。
 */
const fs = require('fs');
const path = require('path');

const { loadResvg, fontFiles, escXml, wrapTitle, textWidth } = require('./cover-lib');
const { buildCover, pickLayout, ORDER } = require('./cover-layouts');

const W = 1200, H = 630;

const PALETTE = {
  paper: '#F7F6F2',
  ink: '#121317',
  ink3: '#7E818B',
  accent: '#2340F5',
  accentSoft: '#E3E8FD',
  accentDeep: '#1327B5',
  tint: '#E9EDFD',
  mapBg: '#EEF1F8',
  shadow: '#101A4A',
  line: '#121317',
};

const LABELS = { meo: 'MEO', aio: 'AIO', ai: 'AI', app: 'WEB APP', hp: 'HP / LP' };
const GLYPHS = { meo: 'MEO', aio: 'AIO', ai: 'AI', app: 'APP', hp: 'HP' };
// 検索窓の中に出す文字列。カテゴリごとの典型的な検索の形（実在の数値は入れない）
const QUERIES = {
  meo: '名古屋 カフェ', aio: 'AI検索 対策', ai: '社内 AI 活用',
  app: '業務アプリ 開発', hp: 'ホームページ 制作',
};
// 右側に描く画面の中身（地図 / チャット / 表 / サイト）
const SCENES = { meo: 'map', aio: 'chat', ai: 'chat', app: 'dash', hp: 'site' };
// 小さなカードに乗せる短いラベル。カテゴリ名そのものを使い、効果の断定はしない
const TAGS = { meo: 'マップ集客', aio: 'AI検索', ai: 'AI活用', app: '業務アプリ', hp: 'サイト制作' };
// 自動生成する背景の絵柄（cover-art.js の型）
const MOTIFS = { meo: 'radial', aio: 'grid', ai: 'wave', app: 'flow', hp: 'stack' };

// 絵柄の型は cover-art.js の assignMotifs() が記事ごとに割り当てる。
// 日付で順番に回すと型の数だけ日が空いたときに同じ絵へ戻るため、slug から選び、
// 近い時期の記事とは必ず違う型になるようずらす（古い記事の割り当ては後から変わらない）。
const { assignMotifs } = require('./cover-art');
let motifMap = {};
function motifFor(post) {
  return motifMap[post.slug];   // 未割り当てのときは cover-art 側が slug から選ぶ
}
// 記事ごとにレイアウトを固定したいときだけ指定する（未指定は日付で自動）
const VARIANT_BY_SLUG = {};

// 記事ごと・カテゴリごとの背景画像（assets/img/cover-bg/*.jpg）。
// photo レイアウトのときだけ使う。無ければ別のレイアウトに自動で切り替わる。
const BG_BY_SLUG = {
  '2026-09-04-hojin-ai-kenshu-erabikata': 'ai-kenshu',
  '2026-09-04-gyomu-kaizen-ai-tsukaikata': 'ai-shiwake',
  '2026-09-04-ai-gyomu-kaizen-susumekata': 'app-5steps',
  '2026-09-04-ai-app-kaihatsu-hiyo-kikan': 'app-cost',
  '2026-09-04-ai-tool-kaihatsu-irai-junbi': 'app-7items',
  '2026-09-04-claude-code-app-kaihatsu-chigai': 'app-claudecode',
  '2026-09-04-ai-kaihatsu-kigyo-erabikata': 'app-erabikata',
  '2026-09-08-meo-taisaku-jibun-de-yarikata': 'meo-diy',
};
const BG_BY_CATEGORY = { meo: 'meo-map', aio: 'aio-grid', ai: 'ai-wave', app: 'app-flow', hp: 'aio-grid' };
const BG_DIR = path.join(__dirname, '..', 'assets', 'img', 'cover-bg');

// 背景の絵柄は1記事につき1回だけ使う（使用台帳 data/cover-bg-used.json）。
const ledger = require('./cover-bg-ledger');
const LEDGER_FILE = path.join(__dirname, '..', 'data', 'cover-bg-used.json');
let bgLedger = null;

/**
 * 背景画像の探し方。上から順に見て、最初に見つかったものを使う。
 *   1. assets/img/cover-bg/<slug>.jpg … その記事専用。置くだけで使われる（設定不要）
 *   2. BG_BY_SLUG の指定
 *   3. まだ誰も使っていない絵柄（古い記事から順に1枚ずつ）
 * 一度使った絵柄は台帳に残り、ほかの記事には二度と使わない（BG_BY_CATEGORY は使わない）。
 * 空いている絵柄が無ければ、slug から描くコード生成の絵（art）になる。
 * ChatGPT などで作った絵を 1 の名前で置けば、その記事のカバーがその絵になる。
 * 対応する拡張子は .jpg / .jpeg / .png（resvg は webp を読めない）。
 */
const BG_EXT = ['.jpg', '.jpeg', '.png'];
function findBg(name) {
  if (!name) return null;
  for (const ext of BG_EXT) {
    const file = path.join(BG_DIR, name + ext);
    if (fs.existsSync(file)) return file;
  }
  return null;
}
const bgCache = new Map();
function bgDataUri(post) {
  const name = bgLedger ? bgLedger.owned(post.slug) : null;
  const file = findBg(name);
  if (!file) return null;
  if (bgCache.has(file)) return bgCache.get(file);
  const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const uri = 'data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64');
  bgCache.set(file, uri);
  return uri;
}

/** ChatGPT で作った画像を置いた記事の slug（作り直しの対象から外す） */
function stockSlugs() {
  const set = new Set();
  try {
    const q = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seo-keywords.json'), 'utf8'));
    q.items.forEach(i => { if (i.slug && (i.coverImage || i.coverTitle)) set.add(i.slug); });
  } catch (e) { /* 待ち行列が読めないときは何も除外しない */ }
  return set;
}

function coverSVG(post) {
  const date = String(post.date || '');
  // 背景の絵柄（記事専用／BG_BY_SLUG／カテゴリ共通のどれか）が見つかれば、その絵を使う。
  // 空いている絵柄が無いときは、slug から描く記事ごとに違う絵（art）にする。
  const variant = VARIANT_BY_SLUG[post.slug]
    || (bgDataUri(post) ? 'photo' : 'art');
  return buildCover({
    W, H,
    palette: PALETTE,
    variant,
    title: post.title,
    date: date.replace(/-/g, '.'),
    brand: 'TENERAMENTE — JOURNAL',
    domain: 'teneramente.jp',
    label: LABELS[post.category] || 'JOURNAL',
    glyphWord: GLYPHS[post.category] || 'T',
    query: QUERIES[post.category] || '名古屋 AI 開発',
    tags: Array.isArray(post.tags) ? post.tags : [],
    scene: SCENES[post.category] || 'dash',
    tag: TAGS[post.category] || '',
    motif: motifFor(post),
    seed: post.slug,
    year: (date.slice(0, 4) || '') + '年版',
    bgUri: bgDataUri(post),
  });
}

/** posts配列を受け取り、無いカバーだけ生成。生成/既存の slug 一覧を返す */
function generate(posts, rootDir) {
  motifMap = assignMotifs(posts, 'teneramente');
  bgLedger = ledger.open(LEDGER_FILE);
  const coverDir = path.join(rootDir, 'assets', 'img', 'covers');
  const needing = posts.filter(p => !fs.existsSync(path.join(coverDir, `${p.slug}.png`)));
  const slugs = new Set(posts.map(p => p.slug));
  const pool = ledger.listBgs(BG_DIR, BG_EXT).filter(n => !slugs.has(n));
  ledger.assign(bgLedger, needing, pool, p => findBg(p.slug) ? p.slug : (findBg(BG_BY_SLUG[p.slug]) ? BG_BY_SLUG[p.slug] : null));
  // COVER_REGEN=1 を付けて実行すると、コード生成の絵（art）のカバーを作り直す。
  // ChatGPT で作った画像を置いた記事（待ち行列の coverImage）と、背景画像を使う記事は上書きしない。
  const force = process.env.COVER_REGEN === '1';
  const stock = force ? stockSlugs() : new Set();
  const Resvg = loadResvg();
  const outDir = path.join(rootDir, 'assets', 'img', 'covers');
  if (!Resvg) {
    console.warn('△ @resvg/resvg-js が見つからないためカバー画像の生成をスキップしました');
    return new Set(fs.existsSync(outDir)
      ? fs.readdirSync(outDir).filter(f => f.endsWith('.png')).map(f => f.replace(/\.png$/, ''))
      : []);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const fonts = fontFiles();
  const done = new Set();
  let created = 0;
  for (const p of posts) {
    const out = path.join(outDir, `${p.slug}.png`);
    const redraw = force && !stock.has(p.slug) && !bgDataUri(p) && !VARIANT_BY_SLUG[p.slug];
    if (!fs.existsSync(out) || redraw) {
      const png = new Resvg(coverSVG(p), {
        font: { loadSystemFonts: true, fontFiles: fonts, defaultFontFamily: 'Zen Kaku Gothic New' },
      }).render().asPng();
      fs.writeFileSync(out, png);
      created++;
    }
    done.add(p.slug);
  }
  if (created) console.log(`✓ カバー画像を${created}枚${force ? '作り直し' : '生成'}ました (assets/img/covers/)`);
  bgLedger.save();
  return done;
}

module.exports = {
  generate, coverSVG, wrapTitle, escXml, loadResvg, fontFiles, textWidth,
  PALETTE, ORDER, pickLayout,
};
