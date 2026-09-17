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
const bgCache = new Map();
function bgDataUri(post) {
  const name = BG_BY_SLUG[post.slug] || BG_BY_CATEGORY[post.category];
  if (!name) return null;
  if (bgCache.has(name)) return bgCache.get(name);
  const file = path.join(BG_DIR, name + '.jpg');
  const uri = fs.existsSync(file)
    ? 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64')
    : null;
  bgCache.set(name, uri);
  return uri;
}

function coverSVG(post) {
  const date = String(post.date || '');
  return buildCover({
    W, H,
    palette: PALETTE,
    variant: VARIANT_BY_SLUG[post.slug] || pickLayout(date),
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
    year: (date.slice(0, 4) || '') + '年版',
    bgUri: bgDataUri(post),
  });
}

/** posts配列を受け取り、無いカバーだけ生成。生成/既存の slug 一覧を返す */
function generate(posts, rootDir) {
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
    if (!fs.existsSync(out)) {
      const png = new Resvg(coverSVG(p), {
        font: { loadSystemFonts: true, fontFiles: fonts, defaultFontFamily: 'Zen Kaku Gothic New' },
      }).render().asPng();
      fs.writeFileSync(out, png);
      created++;
    }
    done.add(p.slug);
  }
  if (created) console.log(`✓ カバー画像を${created}枚生成しました (assets/img/covers/)`);
  return done;
}

module.exports = {
  generate, coverSVG, wrapTitle, escXml, loadResvg, fontFiles, textWidth,
  PALETTE, ORDER, pickLayout,
};
