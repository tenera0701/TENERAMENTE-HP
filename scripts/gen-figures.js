#!/usr/bin/env node
/**
 * 記事内の図版を生成する（SVG → PNG）。
 *
 *   node scripts/gen-figures.js          … data/figures.json のうち PNG が無いものだけ生成
 *   node scripts/gen-figures.js --force  … 全部作り直す
 *
 * 出力先:
 *   site: "teneramente" → assets/img/figures/<id>.png（紙白 × 黒 × 青のエディトリアル）
 *   site: "mieroom"     → mieroom/assets/figures/<id>.png（ミエルームの配色）
 *
 * 依存は gen-covers.js と同じ（@resvg/resvg-js とフォント。無ければスキップしてビルドは止めない）。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOOLS = path.join(os.homedir(), '.teneramente/cover-tools');
const ROOT = path.join(__dirname, '..');

function loadResvg() {
  for (const c of ['@resvg/resvg-js', path.join(TOOLS, 'node_modules/@resvg/resvg-js')]) {
    try { return require(c).Resvg; } catch (e) { /* 次の候補へ */ }
  }
  return null;
}
function fontFiles() {
  const dir = path.join(TOOLS, 'fonts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(ttf|otf)$/i.test(f)).map(f => path.join(dir, f));
}

const PALETTE = {
  teneramente: {
    bg: '#F4F2ED', card: '#FFFFFF', alt: '#FBFAF7', soft: '#ECE9E1', ink: '#121317', ink2: '#46484F', ink3: '#767984',
    accent: '#2340F5', accentSoft: '#E4E7FD', warm: '#8A6A3B', warmSoft: '#F1EADC', line: '#D9D5CB', mark: 'TENERAMENTE',
  },
  mieroom: {
    bg: '#F6FAF8', card: '#FFFFFF', alt: '#FCFEFD', soft: '#E4F5F0', ink: '#12302B', ink2: '#3A544C', ink3: '#6F847B',
    accent: '#0F8C74', accentSoft: '#DDF1EB', warm: '#C4644A', warmSoft: '#FBEAE3', line: '#DCE7E2', mark: 'MIEROOM',
  },
};
const SANS = 'Zen Kaku Gothic New, Noto Sans JP, Yu Gothic, sans-serif';
const MONO = 'IBM Plex Mono, Consolas, monospace';
const W = 1600, PAD = 64;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const emWidth = t => [...String(t)].reduce((w, c) => w + (c.charCodeAt(0) < 256 ? 0.55 : 1), 0);

/** maxPx 幅・fontSize に収まるよう折り返す（行頭・行末の禁則つき） */
function wrap(text, maxPx, fontSize, maxLines) {
  const perLine = maxPx / fontSize;
  const tokens = String(text).match(/[\x20-\x7E]+|./gu) || [];
  const NO_HEAD = '・、。，．？！…」』】〉》）';
  const NO_TAIL = '「『【（〈《';
  const lines = [];
  let line = '', w = 0, cut = false;
  for (const tk of tokens) {
    const tw = emWidth(tk);
    if (w + tw > perLine && line && !NO_HEAD.includes(tk)) {
      if (lines.length === maxLines - 1) { cut = true; break; }
      lines.push(line); line = tk; w = tw;
    } else { line += tk; w += tw; }
  }
  if (line) lines.push(line);
  for (let i = 0; i < lines.length - 1; i++) {
    const cs = [...lines[i]];
    if (cs.length > 1 && NO_TAIL.includes(cs[cs.length - 1])) {
      lines[i] = cs.slice(0, -1).join('');
      lines[i + 1] = cs[cs.length - 1] + lines[i + 1];
    }
  }
  if (cut) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = [...last].slice(0, -1).join('') + '…';
  }
  return lines;
}

function text(x, y, s, opt) {
  const o = opt || {};
  const size = o.size || 26, weight = o.weight || 500, fill = o.fill || '#000';
  const family = o.family || SANS, anchor = o.anchor || 'start', ls = o.ls || 0;
  return '<text x="' + x + '" y="' + y + '" font-family="' + family + '" font-size="' + size
    + '" font-weight="' + weight + '" fill="' + fill + '"'
    + (anchor !== 'start' ? ' text-anchor="' + anchor + '"' : '')
    + (ls ? ' letter-spacing="' + ls + '"' : '') + '>' + esc(s) + '</text>';
}
function block(x, y, s, opt) {
  const o = opt || {};
  const size = o.size || 26, lh = o.lh || 1.55, maxPx = o.maxPx || 400, maxLines = o.maxLines || 4;
  return wrap(s, maxPx, size, maxLines).map((l, i) => text(x, y + i * size * lh, l, o)).join('');
}
function blockH(s, opt) {
  const o = opt || {};
  const size = o.size || 26, lh = o.lh || 1.55, maxPx = o.maxPx || 400, maxLines = o.maxLines || 4;
  return wrap(s, maxPx, size, maxLines).length * size * lh;
}

/* ── レイアウト ───────────────────────────────── */

/** 横並びのステップ（3〜5個） */
function steps(f, P) {
  const items = f.items, n = items.length, gap = 22;
  const bw = (W - PAD * 2 - gap * (n - 1)) / n;
  const inner = bw - 56;
  const top = f._top;
  // タイトルの行数が違っても本文の開始位置がそろうように、最大の高さで合わせる
  let titleH = 0;
  for (const it of items) {
    const h = blockH(it.title, { size: 29, maxPx: inner, maxLines: 2 });
    if (h > titleH) titleH = h;
  }
  let bodyH = 0;
  for (const it of items) {
    const h = 128 + titleH + (it.note ? 16 + blockH(it.note, { size: 23, maxPx: inner, maxLines: 4, lh: 1.6 }) : 0);
    if (h > bodyH) bodyH = h;
  }
  let s = '';
  items.forEach((it, i) => {
    const x = PAD + i * (bw + gap);
    s += '<rect x="' + x + '" y="' + top + '" width="' + bw + '" height="' + bodyH + '" rx="18" fill="' + P.card + '" stroke="' + P.line + '"/>';
    s += '<rect x="' + x + '" y="' + top + '" width="' + bw + '" height="6" rx="3" fill="' + (i === 0 ? P.accent : P.accentSoft) + '"/>';
    s += text(x + 28, top + 66, String(i + 1).padStart(2, '0'), { size: 30, weight: 600, fill: P.accent, family: MONO, ls: 1 });
    s += block(x + 28, top + 114, it.title, { size: 29, weight: 700, fill: P.ink, maxPx: inner, maxLines: 2 });
    if (it.note) {
      s += block(x + 28, top + 114 + titleH + 18, it.note, { size: 23, weight: 500, fill: P.ink3, maxPx: inner, maxLines: 4, lh: 1.6 });
    }
    if (i < n - 1) {
      const cx = x + bw + gap / 2, cy = top + bodyH / 2;
      s += '<path d="M' + (cx - 5) + ' ' + (cy - 8) + ' l7 8 -7 8" fill="none" stroke="' + P.ink3 + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    }
  });
  return { svg: s, h: bodyH };
}

/** 縦に並ぶ番号つきの行（5〜8個） */
function rows(f, P) {
  const items = f.items, top = f._top;
  const titleW = f.titleW || 470;
  const noteX = PAD + 100 + titleW + 40;
  const noteW = W - PAD - noteX - 28;
  let y = top, s = '';
  items.forEach((it, i) => {
    const th = blockH(it.title, { size: 29, maxPx: titleW, maxLines: 2 });
    const nh = it.note ? blockH(it.note, { size: 24, maxPx: noteW, maxLines: 3, lh: 1.5 }) : 0;
    const h = Math.max(th, nh) + 40;
    s += '<rect x="' + PAD + '" y="' + y + '" width="' + (W - PAD * 2) + '" height="' + h + '" rx="16" fill="' + (i % 2 ? P.alt : P.card) + '" stroke="' + P.line + '"/>';
    s += '<circle cx="' + (PAD + 48) + '" cy="' + (y + h / 2) + '" r="23" fill="' + P.accentSoft + '"/>';
    s += text(PAD + 48, y + h / 2 + 9, String(i + 1), { size: 25, weight: 600, fill: P.accent, family: MONO, anchor: 'middle' });
    s += block(PAD + 100, y + h / 2 - th / 2 + 23, it.title, { size: 29, weight: 700, fill: P.ink, maxPx: titleW, maxLines: 2 });
    if (it.note) s += block(noteX, y + h / 2 - nh / 2 + 19, it.note, { size: 24, weight: 500, fill: P.ink3, maxPx: noteW, maxLines: 3, lh: 1.5 });
    y += h + 12;
  });
  return { svg: s, h: y - top - 12 };
}

/** 2〜3列の対比 */
function compare(f, P) {
  const cols = f.columns, n = cols.length, gap = 26;
  const bw = (W - PAD * 2 - gap * (n - 1)) / n;
  const inner = bw - 100;
  const top = f._top;
  let bodyH = 0;
  for (const c of cols) {
    let h = 128;
    for (const it of c.items) h += blockH(it, { size: 25, maxPx: inner, maxLines: 3, lh: 1.5 }) + 18;
    if (h + 16 > bodyH) bodyH = h + 16;
  }
  let s = '';
  cols.forEach((c, i) => {
    const tone = c.tone === 'good' ? P.accent : c.tone === 'bad' ? P.warm : P.ink2;
    const toneSoft = c.tone === 'good' ? P.accentSoft : c.tone === 'bad' ? P.warmSoft : P.soft;
    const x = PAD + i * (bw + gap);
    s += '<rect x="' + x + '" y="' + top + '" width="' + bw + '" height="' + bodyH + '" rx="20" fill="' + P.card + '" stroke="' + P.line + '"/>';
    s += '<path d="M' + x + ' ' + (top + 20) + ' a20 20 0 0 1 20 -20 h' + (bw - 40) + ' a20 20 0 0 1 20 20 v52 h' + (-bw) + ' z" fill="' + toneSoft + '"/>';
    s += text(x + 32, top + 48, c.head, { size: 29, weight: 700, fill: tone });
    let y = top + 128;
    for (const it of c.items) {
      const h = blockH(it, { size: 25, maxPx: inner, maxLines: 3, lh: 1.5 });
      if (c.tone === 'bad') {
        s += '<path d="M' + (x + 34) + ' ' + (y - 18) + ' l13 13 M' + (x + 47) + ' ' + (y - 18) + ' l-13 13" stroke="' + tone + '" stroke-width="2.6" stroke-linecap="round"/>';
      } else {
        s += '<path d="M' + (x + 33) + ' ' + (y - 12) + ' l8 8 14 -16" fill="none" stroke="' + tone + '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
      }
      s += block(x + 68, y, it, { size: 25, weight: 500, fill: P.ink2, maxPx: inner, maxLines: 3, lh: 1.5 });
      y += h + 18;
    }
  });
  return { svg: s, h: bodyH };
}

/** 業務の流れ（4〜6段）と各段の一言 */
function pipeline(f, P) {
  const st = f.stages, n = st.length, gap = 16;
  const bw = (W - PAD * 2 - gap * (n - 1)) / n;
  const top = f._top, chipH = 92;
  let noteH = 0;
  for (const s0 of st) {
    const h = s0.sub ? blockH(s0.sub, { size: 23, maxPx: bw - 20, maxLines: 3, lh: 1.55 }) : 0;
    if (h > noteH) noteH = h;
  }
  let s = '';
  st.forEach((s0, i) => {
    const x = PAD + i * (bw + gap);
    const on = s0.on !== false;
    s += '<rect x="' + x + '" y="' + top + '" width="' + bw + '" height="' + chipH + '" rx="14" fill="' + (on ? P.accentSoft : P.soft) + '"/>';
    s += text(x + bw / 2, top + chipH / 2 + 11, s0.name, { size: 30, weight: 700, fill: on ? P.accent : P.ink3, anchor: 'middle' });
    if (i < n - 1) {
      const cx = x + bw + gap / 2, cy = top + chipH / 2;
      s += '<path d="M' + (cx - 4) + ' ' + (cy - 7) + ' l6 7 -6 7" fill="none" stroke="' + P.ink3 + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    if (s0.sub) s += block(x + 10, top + chipH + 46, s0.sub, { size: 23, weight: 500, fill: P.ink3, maxPx: bw - 20, maxLines: 3, lh: 1.55 });
  });
  let h = chipH + (noteH ? noteH + 32 : 0);
  if (f.foot) {
    const fh = blockH(f.foot, { size: 25, maxPx: W - PAD * 2 - 56, maxLines: 2, lh: 1.5 });
    s += '<rect x="' + PAD + '" y="' + (top + h + 26) + '" width="' + (W - PAD * 2) + '" height="' + (fh + 44) + '" rx="14" fill="' + P.card + '" stroke="' + P.line + '"/>';
    s += block(PAD + 28, top + h + 26 + 40, f.foot, { size: 25, weight: 500, fill: P.ink2, maxPx: W - PAD * 2 - 56, maxLines: 2, lh: 1.5 });
    h += fh + 70;
  }
  return { svg: s, h: h };
}

const LAYOUTS = { steps: steps, rows: rows, compare: compare, pipeline: pipeline };

function figureSVG(f) {
  const P = PALETTE[f.site] || PALETTE.teneramente;
  const headH = f.label ? 152 : 112;
  f._top = headH;
  const body = LAYOUTS[f.type](f, P);
  const H = Math.round(headH + body.h + 92);
  let head = '';
  if (f.label) {
    head += '<rect x="' + PAD + '" y="48" width="8" height="8" fill="' + P.accent + '"/>';
    head += text(PAD + 22, 57, f.label, { size: 19, weight: 500, fill: P.ink3, family: MONO, ls: 3 });
  }
  head += text(PAD, headH - 32, f.title, { size: 40, weight: 700, fill: P.ink });
  const foot = '<line x1="' + PAD + '" y1="' + (H - 62) + '" x2="' + (W - PAD) + '" y2="' + (H - 62) + '" stroke="' + P.line + '"/>'
    + text(W - PAD, H - 34, P.mark, { size: 19, weight: 500, fill: P.ink3, family: MONO, anchor: 'end', ls: 3 });
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
    + '<rect width="' + W + '" height="' + H + '" fill="' + P.bg + '"/>'
    + head + body.svg + foot + '</svg>';
}

function outPath(f) {
  return f.site === 'mieroom'
    ? path.join(ROOT, 'mieroom', 'assets', 'figures', f.id + '.png')
    : path.join(ROOT, 'assets', 'img', 'figures', f.id + '.png');
}

function main() {
  const force = process.argv.includes('--force');
  const specPath = path.join(ROOT, 'data', 'figures.json');
  if (!fs.existsSync(specPath)) { console.warn('△ data/figures.json がありません'); return; }
  const figures = JSON.parse(fs.readFileSync(specPath, 'utf8')).figures;
  const Resvg = loadResvg();
  if (!Resvg) { console.warn('△ @resvg/resvg-js が見つからないため図版の生成をスキップしました'); return; }
  const fonts = fontFiles();
  let made = 0;
  for (const f of figures) {
    const out = outPath(f);
    if (!force && fs.existsSync(out)) continue;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const png = new Resvg(figureSVG(f), {
      font: { loadSystemFonts: true, fontFiles: fonts, defaultFontFamily: 'Zen Kaku Gothic New' },
    }).render().asPng();
    fs.writeFileSync(out, png);
    made++;
  }
  console.log('✓ 図版を' + made + '枚生成しました（全' + figures.length + '件）');
}

if (require.main === module) main();
module.exports = { figureSVG: figureSVG, outPath: outPath };
