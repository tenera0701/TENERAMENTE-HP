#!/usr/bin/env node
/**
 * 記事カバー画像の自動生成(SVG → PNG 1200x630)
 *
 * build-index.js から呼ばれる。assets/img/covers/<slug>.png が無い記事だけ生成する。
 * デザインはサイトのデザイン言語(グラデーション+装飾図形+カテゴリグリフ)に合わせ、
 * slug から決まる乱数で図形配置を変える(同じ記事は何度生成しても同じ絵になる)。
 *
 * 依存: @resvg/resvg-js。Googleドライブ上の node_modules は破損するため、
 * ローカルディスク(C:/Users/<user>/.teneramente/cover-tools)に置いたものを参照する。
 * 見つからない場合は生成をスキップする(ビルド自体は止めない)。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function loadResvg() {
  const candidates = [
    '@resvg/resvg-js',
    path.join(os.homedir(), '.teneramente/cover-tools/node_modules/@resvg/resvg-js'),
  ];
  for (const c of candidates) {
    try { return require(c).Resvg; } catch (e) { /* 次の候補へ */ }
  }
  return null;
}

const W = 1200, H = 630;

// カテゴリ別の配色(サイトのアクセントカラーに合わせる)
const THEMES = {
  meo: { g1: '#ff9d3d', g2: '#e8741a', glyph: 'M', label: 'MEO' },
  aio: { g1: '#8b7cf0', g2: '#5f4bdb', glyph: 'A', label: 'AIO' },
  ai:  { g1: '#1ba1e2', g2: '#6c5ce7', glyph: 'A', label: 'AI' },
  app: { g1: '#1ba1e2', g2: '#1668b8', glyph: 'W', label: 'Web App' },
  hp:  { g1: '#36c08a', g2: '#1f9d63', glyph: 'H', label: 'HP / LP' },
};

// slug文字列 → 決定的な乱数生成器
function seededRandom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function () {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// タイトルを最大3行に折り返す(全角=1、半角=0.55として概算)
// 半角英数の連続(例: 2026, Google)は途中で改行せず、行頭禁則(・、。など)も避ける
function wrapTitle(title, perLine = 15, maxLines = 3) {
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
  if (truncated) {
    let last = lines[lines.length - 1];
    if (width(last) + 1 > perLine) last = [...last].slice(0, -1).join('');
    lines[lines.length - 1] = last + '…';
  }
  return lines;
}

function coverSVG(post) {
  const t = THEMES[post.category] || THEMES.app;
  const rnd = seededRandom(post.slug);
  const R = (a, b) => a + rnd() * (b - a);

  // 装飾図形(半透明の円・リング・角丸四角)をランダム配置
  let deco = '';
  for (let i = 0; i < 3; i++) {
    deco += `<circle cx="${R(0, W)}" cy="${R(0, H)}" r="${R(90, 220)}" fill="#ffffff" opacity="${R(0.05, 0.1)}"/>`;
  }
  deco += `<circle cx="${R(W * 0.6, W)}" cy="${R(0, H * 0.5)}" r="${R(28, 44)}" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.35"/>`;
  deco += `<rect x="${R(W * 0.55, W * 0.9)}" y="${R(H * 0.55, H * 0.85)}" width="${R(20, 34)}" height="${R(20, 34)}" rx="7" fill="#ffffff" opacity="0.3" transform="rotate(${R(-25, 25)} ${W * 0.75} ${H * 0.7})"/>`;
  deco += `<circle cx="${R(W * 0.05, W * 0.3)}" cy="${R(H * 0.6, H * 0.9)}" r="${R(8, 14)}" fill="#ffffff" opacity="0.4"/>`;

  const lines = wrapTitle(post.title);
  const fontSize = lines.length >= 3 ? 56 : lines.length === 2 ? 62 : 68;
  const lineH = fontSize * 1.42;
  const blockH = lines.length * lineH;
  const firstY = (H - blockH) / 2 + fontSize * 0.9 + 20;
  const titleText = lines.map((l, i) =>
    `<text x="72" y="${firstY + i * lineH}" font-family="Yu Gothic, Meiryo, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff">${escXml(l)}</text>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.g1}"/><stop offset="1" stop-color="${t.g2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="${W - 40}" y="${H - 60}" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="420" font-weight="bold" fill="#ffffff" opacity="0.14">${t.glyph}</text>
  ${deco}
  <rect x="72" y="64" rx="22" width="${44 + t.label.length * 17}" height="44" fill="#ffffff" opacity="0.92"/>
  <text x="${72 + (44 + t.label.length * 17) / 2}" y="94" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="bold" fill="${t.g2}">${t.label}</text>
  ${titleText}
  <text x="72" y="${H - 56}" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff" opacity="0.85">TENERAMENTE Blog</text>
  <text x="72" y="${H - 56}" dx="252" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#ffffff" opacity="0.6">${escXml(post.date || '')}</text>
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
  const done = new Set();
  let created = 0;
  for (const p of posts) {
    const out = path.join(outDir, `${p.slug}.png`);
    if (!fs.existsSync(out)) {
      const png = new Resvg(coverSVG(p), { font: { loadSystemFonts: true } }).render().asPng();
      fs.writeFileSync(out, png);
      created++;
    }
    done.add(p.slug);
  }
  if (created) console.log(`✓ カバー画像を${created}枚生成しました (assets/img/covers/)`);
  return done;
}

module.exports = { generate };
