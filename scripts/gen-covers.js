#!/usr/bin/env node
/**
 * 記事カバー画像の自動生成(SVG → PNG 1200x630)
 *
 * build-index.js から呼ばれる。assets/img/covers/<slug>.png が無い記事だけ生成する。
 * デザインはサイトのデザイン言語(紙白 × 黒 × 青1色のエディトリアル)に合わせる。
 * 作り直したいときは PNG を削除して再ビルドする。
 *
 * 依存: @resvg/resvg-js。Googleドライブ上の node_modules は破損するため、
 * ローカルディスク(C:/Users/<user>/.teneramente/cover-tools)に置いたものを参照する。
 * フォントも同じ場所(cover-tools/fonts)に置く(Zen Kaku Gothic New / IBM Plex Mono / Shippori Mincho)。
 * 見つからない場合は生成をスキップする(ビルド自体は止めない)。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOOLS = path.join(os.homedir(), '.teneramente/cover-tools');

function loadResvg() {
  const candidates = ['@resvg/resvg-js', path.join(TOOLS, 'node_modules/@resvg/resvg-js')];
  for (const c of candidates) {
    try { return require(c).Resvg; } catch (e) { /* 次の候補へ */ }
  }
  return null;
}

function fontFiles() {
  const dir = path.join(TOOLS, 'fonts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(ttf|otf)$/i.test(f)).map(f => path.join(dir, f));
}

const W = 1200, H = 630;
const PAPER = '#F4F2ED', INK = '#121317', INK3 = '#7E818B', LINE = '#121317', ACCENT = '#2340F5', GLYPH = '#E1DDD3';
const LABELS = { meo: 'MEO', aio: 'AIO', ai: 'AI', app: 'WEB APP', hp: 'HP / LP' };
const GLYPHS = { meo: 'M', aio: 'A', ai: 'A', app: 'W', hp: 'H' };

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// タイトルを最大3行に折り返す(全角=1、半角=0.55として概算)
// 半角英数の連続(例: 2026, Google)は途中で改行せず、行頭禁則(・、。など)も避ける
function wrapTitle(title, perLine = 16, maxLines = 3) {
  const tokens = title.match(/[\x20-\x7E]+|./gu) || [];
  const width = t => [...t].reduce((w, c) => w + (c.charCodeAt(0) < 256 ? 0.55 : 1), 0);
  const NO_HEAD = '・、。？！…」』】〉》）';
  const lines = [];
  let line = '', w = 0, truncated = false;
  for (const tk of tokens) {
    const tw = width(tk);
    if (w + tw > perLine && line && !NO_HEAD.includes(tk)) {
      if (lines.length === maxLines - 1) { truncated = true; break; }
      lines.push(line);
      line = tk; w = tw;
    } else {
      line += tk; w += tw;
    }
  }
  if (line) lines.push(line);
  // 行末禁則: 開き括弧で行が終わらないように次行へ送る
  const NO_TAIL = '「『【（〈《“';
  for (let i = 0; i < lines.length - 1; i++) {
    const cs = [...lines[i]];
    if (cs.length > 1 && NO_TAIL.includes(cs[cs.length - 1])) {
      lines[i] = cs.slice(0, -1).join('');
      lines[i + 1] = cs[cs.length - 1] + lines[i + 1];
    }
  }
  if (truncated) {
    let last = lines[lines.length - 1];
    if (width(last) + 1 > perLine) last = [...last].slice(0, -1).join('');
    lines[lines.length - 1] = last + '…';
  }
  return lines;
}

function coverSVG(post) {
  const label = LABELS[post.category] || 'JOURNAL';
  const glyph = GLYPHS[post.category] || 'T';
  const lines = wrapTitle(post.title);
  const fontSize = lines.length >= 3 ? 54 : lines.length === 2 ? 60 : 66;
  const lineH = fontSize * 1.5;
  const blockH = lines.length * lineH;
  const firstY = (H - blockH) / 2 + fontSize * 0.85 + 6;
  const titleText = lines.map((l, i) =>
    `<text x="72" y="${firstY + i * lineH}" font-family="Zen Kaku Gothic New, Noto Sans JP, Yu Gothic, sans-serif" font-size="${fontSize}" font-weight="700" fill="${INK}" letter-spacing="-0.5">${escXml(l)}</text>`
  ).join('');
  const date = String(post.date || '').replace(/-/g, '.');
  const mono = 'IBM Plex Mono, Consolas, monospace';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <!-- 右下の大きなカテゴリ文字（薄く） -->
  <text x="${W - 40}" y="${H + 60}" text-anchor="end" font-family="Zen Kaku Gothic New, Noto Sans JP, sans-serif" font-size="520" font-weight="500" fill="${GLYPH}" letter-spacing="-30">${glyph}</text>
  <!-- 上部：ラベル -->
  <rect x="72" y="66" width="8" height="8" fill="${ACCENT}"/>
  <text x="94" y="75" font-family="${mono}" font-size="15" font-weight="500" fill="${INK3}" letter-spacing="3">TENERAMENTE — JOURNAL</text>
  <text x="${W - 72}" y="75" text-anchor="end" font-family="${mono}" font-size="15" font-weight="500" fill="${INK}" letter-spacing="3">${escXml(label)}</text>
  <line x1="72" y1="96" x2="${W - 72}" y2="96" stroke="${LINE}" stroke-opacity="0.18"/>
  <!-- タイトル -->
  ${titleText}
  <!-- 下部：日付・URL -->
  <line x1="72" y1="${H - 84}" x2="${W - 72}" y2="${H - 84}" stroke="${LINE}" stroke-opacity="0.18"/>
  <text x="72" y="${H - 52}" font-family="${mono}" font-size="15" font-weight="500" fill="${INK3}" letter-spacing="3">${escXml(date)}</text>
  <text x="${W - 72}" y="${H - 52}" text-anchor="end" font-family="${mono}" font-size="15" font-weight="500" fill="${INK3}" letter-spacing="3">teneramente.jp</text>
</svg>`;
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

module.exports = { generate, coverSVG };
