#!/usr/bin/env node
/**
 * ミエルーム記事のカバー画像を生成（SVG → PNG 1200x675）
 *
 * build-mieroom.js から呼ばれる。mieroom/assets/covers/<slug>.png が無い記事だけ作る。
 * TENERAMENTE 側（scripts/gen-covers.js）と同じ考え方で、記事テーマの背景画像を敷き、
 * 左半分にタイトルと一言のフック（META の "hook"）を重ねる。配色はミエルーム（緑×テラコッタ）。
 *
 * 背景は mieroom/assets/cover-bg/<name>.jpg を使う。同じ絵柄の .webp はページ側で使うので残す
 * （resvg は webp を読めないため、埋め込み用に jpg を置いている）。
 * 作り直したいときは PNG を消して再ビルドする。
 *
 * 依存は gen-covers.js と同じ（@resvg/resvg-js と ~/.teneramente/cover-tools/fonts）。
 * 見つからない場合は生成をスキップし、ページ側は従来どおり背景画像だけのカバーになる。
 */
const fs = require('fs');
const path = require('path');
const { wrapTitle, escXml, loadResvg, fontFiles } = require('./gen-covers');

const W = 1200, H = 675;
const PAPER = '#F6FAF8', INK = '#12302B', INK3 = '#6F847B', ACCENT = '#0F8C74', LINE = '#12302B';

// カテゴリの英語ラベル（カバー右上に出る）
const LABELS = {
  '売上管理': 'SALES', '業務効率化': 'OPERATIONS', '集客・広告': 'MARKETING',
  '組織・育成': 'TEAM', 'DX': 'DX',
};

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
  const label = LABELS[p.category] || 'BLOG';
  const bg = bgDataUri(p.coverBg);
  const hook = (p.hook || '').trim();

  // 背景がある場合は左半分に収める。フックを置く分だけタイトルの行数を抑える
  const maxLines = hook ? 3 : 4;
  const lines = wrapTitle(p.title, 12, maxLines);
  const fontSize = lines.length >= 4 ? 46 : lines.length === 3 ? 50 : 56;
  const lineH = fontSize * 1.46;
  const hookH = hook ? 74 : 0;
  const blockHeight = lines.length * lineH + hookH;
  const firstY = (H - blockHeight) / 2 + fontSize * 0.85 + 8;
  const jp = 'Zen Kaku Gothic New, Noto Sans JP, Yu Gothic, sans-serif';
  const mono = 'IBM Plex Mono, Consolas, monospace';

  const titleText = lines.map((l, i) =>
    `<text x="72" y="${firstY + i * lineH}" font-family="${jp}" font-size="${fontSize}" font-weight="700" fill="${INK}" letter-spacing="-0.5">${escXml(l)}</text>`
  ).join('\n  ');

  // フック（記事を読みたくなる一言）。タイトルの下にアクセント色の罫線つきで置く
  const hookY = firstY + (lines.length - 1) * lineH + 52;
  const hookLines = hook ? wrapTitle(hook, 21, 2) : [];
  const hookText = hook ? `<rect x="72" y="${hookY - 16}" width="34" height="3" fill="${ACCENT}"/>
  ` + hookLines.map((l, i) =>
    `<text x="72" y="${hookY + 26 + i * 32}" font-family="${jp}" font-size="22" font-weight="500" fill="${INK3}">${escXml(l)}</text>`
  ).join('\n  ') : '';

  const date = String(p.date || '').replace(/-/g, '.');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${bg ? `<image href="${bg}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  <defs><linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${PAPER}" stop-opacity="0.97"/>
    <stop offset="0.44" stop-color="${PAPER}" stop-opacity="0.90"/>
    <stop offset="0.74" stop-color="${PAPER}" stop-opacity="0"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>` : ''}
  <!-- 上部：ラベル -->
  <rect x="72" y="70" width="8" height="8" fill="${ACCENT}"/>
  <text x="94" y="79" font-family="${mono}" font-size="15" font-weight="500" fill="${INK3}" letter-spacing="3">MIEROOM — BLOG</text>
  <text x="${W - 72}" y="79" text-anchor="end" font-family="${mono}" font-size="15" font-weight="500" fill="${INK}" letter-spacing="3">${escXml(label)}</text>
  <line x1="72" y1="100" x2="${W - 72}" y2="100" stroke="${LINE}" stroke-opacity="0.16"/>
  <!-- タイトルとフック -->
  ${titleText}
  ${hookText}
  <!-- 下部：日付・サイト名 -->
  <line x1="72" y1="${H - 88}" x2="${W - 72}" y2="${H - 88}" stroke="${LINE}" stroke-opacity="0.16"/>
  <text x="72" y="${H - 54}" font-family="${mono}" font-size="15" font-weight="500" fill="${INK3}" letter-spacing="3">${escXml(date)}</text>
  <text x="${W - 72}" y="${H - 54}" text-anchor="end" font-family="${mono}" font-size="15" font-weight="500" fill="${INK3}" letter-spacing="3">teneramente.jp/mieroom</text>
</svg>`;
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

module.exports = { generate, coverSVG };
