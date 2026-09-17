#!/usr/bin/env node
/**
 * ミエルーム記事のカバー画像を生成（SVG → PNG 1200x675）
 *
 * build-mieroom.js から呼ばれる。mieroom/assets/covers/<slug>.png が無い記事だけ作る。
 * 構図は TENERAMENTE 側と同じ scripts/cover-layouts.js を使い、配色だけミエルーム（緑）にする。
 * レイアウトは日付で切り替わる。TENERAMENTE 側とは開始位置をずらしてあるので、
 * 同じ日に出る2本（TENERAMENTE / ミエルーム）が同じ構図になることはない。
 *
 * photo レイアウトのときだけ背景 mieroom/assets/cover-bg/<name>.jpg を使う。
 * 同じ絵柄の .webp はページ側で使うので残す（resvg は webp を読めないため jpg を置いている）。
 * 作り直したいときは PNG を消して再ビルドする。
 *
 * 依存は gen-covers.js と同じ（@resvg/resvg-js と ~/.teneramente/cover-tools/fonts）。
 * 見つからない場合は生成をスキップし、ページ側は従来どおり背景画像だけのカバーになる。
 */
const fs = require('fs');
const path = require('path');
const { loadResvg, fontFiles } = require('./cover-lib');
const { buildCover, pickLayout } = require('./cover-layouts');

const W = 1200, H = 675;

const PALETTE = {
  paper: '#F4FAF7',
  ink: '#12302B',
  ink3: '#6F847B',
  accent: '#0F8C74',
  accentSoft: '#DCEFE8',
  accentDeep: '#0A6B58',
  tint: '#DDF0E9',
  mapBg: '#E8F2EE',
  shadow: '#0A3B2E',
  line: '#12302B',
};

// カテゴリの英語ラベル（カバー右上に出る）
const LABELS = {
  '売上管理': 'SALES', '業務効率化': 'OPERATIONS', '集客・広告': 'MARKETING',
  '組織・育成': 'TEAM', 'DX': 'DX',
};
// 検索窓の中に出す文字列（実在の数値は入れない）
const QUERIES = {
  '売上管理': '賃貸仲介 売上管理', '業務効率化': '不動産 業務効率化', '集客・広告': '賃貸 反響 集客',
  '組織・育成': '不動産 開業 準備', 'DX': '不動産 DX',
};

// TENERAMENTE 側と同じ日に同じ構図にならないよう、選ぶ位置をずらす
const LAYOUT_OFFSET = 2;
// 右側に描く画面の中身と、小さなカードに乗せる短いラベル
const SCENES = {
  '売上管理': 'dash', '業務効率化': 'dash', '集客・広告': 'map',
  '組織・育成': 'site', 'DX': 'chat',
};
// 記事ごとにレイアウトを固定したいときだけ指定する
const VARIANT_BY_SLUG = {};

const BG_DIR = path.join(__dirname, '..', 'mieroom', 'assets', 'cover-bg');
const bgCache = new Map();

function bgDataUri(name) {
  if (!name) return null;
  if (bgCache.has(name)) return bgCache.get(name);
  const file = path.join(BG_DIR, name + '.jpg');
  const uri = fs.existsSync(file)
    ? 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64')
    : null;
  bgCache.set(name, uri);
  return uri;
}

function coverSVG(p) {
  const date = String(p.date || '');
  const label = LABELS[p.category] || 'BLOG';
  return buildCover({
    W, H,
    palette: PALETTE,
    variant: VARIANT_BY_SLUG[p.slug] || pickLayout(date, LAYOUT_OFFSET),
    title: p.title,
    date: date.replace(/-/g, '.'),
    brand: 'MIEROOM — BLOG',
    domain: 'teneramente.jp/mieroom',
    label,
    glyphWord: label,
    query: QUERIES[p.category] || '賃貸仲介 管理',
    tags: Array.isArray(p.tags) ? p.tags : [],
    scene: SCENES[p.category] || 'dash',
    tag: p.category || '',
    useLogo: false,
    hook: (p.hook || '').trim(),
    year: (date.slice(0, 4) || '') + '年版',
    bgUri: bgDataUri(p.coverBg),
  });
}

/**
 * posts を受け取り、まだ無いカバーだけ生成する。
 * 生成できた（または既にある）slug の Set を返す。呼び出し側はこれで出し分ける。
 */
function generate(posts, rootDir) {
  const outDir = path.join(rootDir, 'mieroom', 'assets', 'covers');
  const existing = () => new Set(fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter(f => f.endsWith('.png')).map(f => f.replace(/\.png$/, ''))
    : []);

  const Resvg = loadResvg();
  if (!Resvg) {
    console.warn('△ @resvg/resvg-js が見つからないためミエルームのカバー画像はスキップしました');
    return existing();
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
  if (created) console.log(`✓ ミエルーム: カバー画像を${created}枚生成しました (mieroom/assets/covers/)`);
  return done;
}

module.exports = { generate, coverSVG, PALETTE };
