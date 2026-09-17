#!/usr/bin/env node
/**
 * カバー画像のレイアウト集。
 *
 * 「毎日同じ絵に見える」のを避けるため、構図そのものを複数持ち、記事の日付で順に切り替える。
 * 日付が1日進むと必ず別のレイアウトになるので、連日の記事が並んでも見た目が重ならない。
 *
 * 配色はサイトごと（TENERAMENTE = 紙白×黒×青 / ミエルーム = 緑）に palette で渡す。
 * 形はすべて SVG で描いていて外部画像に依存しない（photo だけ背景写真を使う）。
 *
 * 数字の捏造を避けるため、飾りの中には数値を描かない（日付と年号だけ）。
 */
const { escXml, wrapTitle, textWidth } = require('./cover-lib');

const JP = 'Zen Kaku Gothic New, Noto Sans JP, Yu Gothic, sans-serif';
const MONO = 'IBM Plex Mono, Consolas, monospace';

/* ───────── 部品 ───────── */

function txt(x, y, s, o = {}) {
  const a = [
    `x="${r(x)}"`, `y="${r(y)}"`,
    `font-family="${o.family || JP}"`,
    `font-size="${o.size || 18}"`,
    `font-weight="${o.weight || 500}"`,
    `fill="${o.fill || '#000'}"`,
  ];
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
  if (o.ls) a.push(`letter-spacing="${o.ls}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  return `<text ${a.join(' ')}>${escXml(s)}</text>`;
}

function rect(x, y, w, h, o = {}) {
  const a = [`x="${r(x)}"`, `y="${r(y)}"`, `width="${r(w)}"`, `height="${r(h)}"`];
  if (o.rx) a.push(`rx="${o.rx}"`);
  a.push(`fill="${o.fill || 'none'}"`);
  if (o.stroke) a.push(`stroke="${o.stroke}"`, `stroke-width="${o.sw || 1}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  return `<rect ${a.join(' ')}/>`;
}

function line(x1, y1, x2, y2, stroke, opacity = 1, sw = 1) {
  return `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${sw}"/>`;
}

function r(n) { return Math.round(n * 10) / 10; }

/** 影つきの白いカード */
function card(x, y, w, h, P, o = {}) {
  const rx = o.rx || 20;
  return rect(x + 3, y + 8, w, h, { rx, fill: '#000', opacity: 0.05 })
    + rect(x, y, w, h, { rx, fill: o.fill || '#FFFFFF', stroke: o.stroke || P.line, sw: 1, opacity: 1 })
    + (o.stroke === undefined ? rect(x, y, w, h, { rx, fill: 'none', stroke: P.ink, sw: 1, opacity: 0.07 }) : '');
}

/** 角丸のタグ。戻り値に実幅を含める */
function pill(x, y, label, P, o = {}) {
  const size = o.size || 21;
  const h = o.h || 46;
  const pad = o.pad || 24;
  const dotW = o.dot === false ? 0 : 24;
  const w = pad * 2 + dotW + textWidth(label) * size;
  const fg = o.fg || P.ink;
  const svg = rect(x, y, w, h, { rx: h / 2, fill: o.bg || P.accentSoft })
    + (dotW ? `<circle cx="${r(x + pad + 6)}" cy="${r(y + h / 2)}" r="5" fill="${o.dotFill || P.accent}"/>` : '')
    + txt(x + pad + dotW, y + h / 2 + size * 0.36, label, { size, weight: 700, fill: fg });
  return { svg, w, h };
}

/** タグを横に並べる（幅に収まる分だけ） */
function pillRow(x, y, labels, P, o = {}) {
  const gap = o.gap || 14;
  const max = o.maxW || 9999;
  let cx = x, out = '';
  for (const l of labels) {
    const p = pill(cx, y, l, P, o);
    if (cx - x + p.w > max) break;
    out += p.svg;
    cx += p.w + gap;
  }
  return out;
}

/** 年号バッジ（例: 2026年版）。アクセント色ベタ */
function ribbon(x, y, label, P, o = {}) {
  const size = o.size || 24;
  const h = o.h || 52;
  const pad = 26;
  const w = pad * 2 + textWidth(label) * size;
  const svg = rect(x, y, w, h, { rx: 14, fill: o.bg || P.accent })
    + txt(x + pad, y + h / 2 + size * 0.36, label, { size, weight: 700, fill: o.fg || '#FFFFFF' });
  return { svg, w, h };
}

/** 地図ピン */
function pin(cx, cy, scale, fill) {
  const s = scale;
  return `<path d="M${r(cx)} ${r(cy)} L${r(cx - 11 * s)} ${r(cy - 17 * s)} A${r(14 * s)} ${r(14 * s)} 0 1 1 ${r(cx + 11 * s)} ${r(cy - 17 * s)} Z" fill="${fill}"/>`
    + `<circle cx="${r(cx)}" cy="${r(cy - 24 * s)}" r="${r(5 * s)}" fill="#FFFFFF"/>`;
}

/** チェックマーク */
function check(x, y, color, s = 1) {
  return `<path d="M${r(x)} ${r(y)} l${r(7 * s)} ${r(7 * s)} l${r(13 * s)} ${r(-15 * s)}" fill="none" stroke="${color}" stroke-width="${r(3 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** 文字の代わりのグレーの棒（ダミーテキスト）。数字や偽の文言を描かないための部品 */
function bar(x, y, w, h, fill, opacity = 1) {
  return rect(x, y, w, h, { rx: h / 2, fill, opacity });
}

/* ───────── 絵（シーン） ───────── */

/** 検索窓のあるパネル */
function sceneSearch(x, y, w, P, query) {
  const h = 196;
  let s = card(x, y, w, h, P);
  s += `<circle cx="${r(x + 28)}" cy="${r(y + 28)}" r="5" fill="${P.ink}" opacity="0.16"/>`;
  s += `<circle cx="${r(x + 46)}" cy="${r(y + 28)}" r="5" fill="${P.ink}" opacity="0.16"/>`;
  s += `<circle cx="${r(x + 64)}" cy="${r(y + 28)}" r="5" fill="${P.ink}" opacity="0.16"/>`;
  s += line(x, y + 52, x + w, y + 52, P.ink, 0.08);
  // 検索フィールド
  const fy = y + 74;
  s += rect(x + 24, fy, w - 48, 56, { rx: 28, fill: P.paper, stroke: P.ink, sw: 1, opacity: 1 });
  s += rect(x + 24, fy, w - 48, 56, { rx: 28, fill: 'none', stroke: P.ink, sw: 1, opacity: 0.1 });
  s += `<circle cx="${r(x + 56)}" cy="${r(fy + 27)}" r="9" fill="none" stroke="${P.accent}" stroke-width="2.6"/>`;
  s += line(x + 63, fy + 34, x + 69, fy + 40, P.accent, 1, 2.6);
  s += txt(x + 82, fy + 35, query, { size: 21, weight: 500, fill: P.ink3 });
  // タブ風の下線
  const ty = fy + 84;
  s += bar(x + 24, ty, 76, 8, P.accent);
  s += bar(x + 114, ty, 58, 8, P.ink, 0.12);
  s += bar(x + 186, ty, 66, 8, P.ink, 0.12);
  return { svg: s, h };
}

/** 検索結果のカード（文字は棒で表現し、偽の数値や評価は描かない） */
function sceneResult(x, y, w, P, kind) {
  const h = 148;
  let s = card(x, y, w, h, P);
  s += rect(x + 22, y + 26, 96, 96, { rx: 14, fill: P.accentSoft });
  if (kind === 'pin') {
    s += pin(x + 70, y + 92, 0.9, P.accent);
  } else {
    // 書類のマーク（地図ピンが合わない記事向け）
    s += rect(x + 50, y + 46, 40, 56, { rx: 6, fill: '#FFFFFF' });
    s += bar(x + 58, y + 58, 24, 5, P.accent, 0.85);
    s += bar(x + 58, y + 70, 24, 5, P.accent, 0.4);
    s += bar(x + 58, y + 82, 16, 5, P.accent, 0.4);
  }
  const tx = x + 136;
  s += bar(tx, y + 34, Math.min(w - 170, 190), 13, P.ink, 0.78);
  s += bar(tx, y + 60, Math.min(w - 170, 140), 9, P.ink, 0.18);
  s += bar(tx, y + 80, Math.min(w - 170, 168), 9, P.ink, 0.18);
  s += rect(tx, y + 100, 92, 26, { rx: 13, fill: P.accentSoft });
  s += bar(tx + 16, y + 111, 60, 6, P.accent, 0.75);
  return { svg: s, h };
}

/** 右肩上がりの棒グラフ（目盛りや数値は入れない） */
function sceneChart(x, y, w, h, P) {
  let s = card(x, y, w, h, P);
  const base = y + h - 46;
  const n = 5;
  const bw = 46;
  const gap = (w - 72 - bw * n) / (n - 1);
  const heights = [0.26, 0.4, 0.52, 0.72, 1];
  const top = y + 74;
  for (let i = 0; i < n; i++) {
    const bx = x + 36 + i * (bw + gap);
    const bh = (base - top) * heights[i];
    s += rect(bx, base - bh, bw, bh, { rx: 8, fill: i === n - 1 ? P.accent : P.accentSoft });
  }
  s += line(x + 30, base + 1, x + w - 30, base + 1, P.ink, 0.12);
  // 右肩上がりの線。矢印の頭は最後の線分の向きに合わせる
  const pts = [];
  for (let i = 0; i < n; i++) {
    const bx = x + 36 + i * (bw + gap) + bw / 2;
    pts.push([bx, base - (base - top) * heights[i] - 24]);
  }
  s += `<polyline points="${pts.map(p => `${r(p[0])},${r(p[1])}`).join(' ')}" fill="none" stroke="${P.accent}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
  const [ax, ay] = pts[pts.length - 1];
  const [px, py] = pts[pts.length - 2];
  const ang = Math.atan2(ay - py, ax - px);
  const head = (spread) => [
    r(ax - 16 * Math.cos(ang - spread)), r(ay - 16 * Math.sin(ang - spread)),
  ];
  const h1 = head(0.42), h2 = head(-0.42);
  s += `<path d="M${h1[0]} ${h1[1]} L${r(ax)} ${r(ay)} L${h2[0]} ${h2[1]}" fill="none" stroke="${P.accent}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += bar(x + 36, y + 36, 120, 11, P.ink, 0.7);
  return s;
}

/** 地図モチーフ */
function sceneMap(x, y, w, h, P) {
  let s = card(x, y, w, h, P, { fill: P.paper });
  s += `<clipPath id="mapclip"><rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="20"/></clipPath>`;
  let g = '';
  for (let i = 1; i < 6; i++) g += line(x, y + (h / 6) * i, x + w, y + (h / 6) * i, P.ink, 0.07, 6);
  for (let i = 1; i < 5; i++) g += line(x + (w / 5) * i, y, x + (w / 5) * i, y + h, P.ink, 0.07, 6);
  g += `<path d="M${r(x)} ${r(y + h * 0.7)} Q${r(x + w * 0.4)} ${r(y + h * 0.42)} ${r(x + w)} ${r(y + h * 0.62)}" fill="none" stroke="${P.accent}" stroke-opacity="0.18" stroke-width="14"/>`;
  s += `<g clip-path="url(#mapclip)">${g}</g>`;
  s += pin(x + w * 0.5, y + h * 0.56, 1.5, P.accent);
  s += pin(x + w * 0.24, y + h * 0.76, 0.85, P.accent);
  s += pin(x + w * 0.76, y + h * 0.82, 0.85, P.accent);
  return s;
}

/** チェックリストのカード */
function sceneCheck(x, y, w, P, items) {
  const rows = items.slice(0, 4);
  const h = 60 + rows.length * 54;
  let s = card(x, y, w, h, P);
  s += bar(x + 26, y + 30, 100, 10, P.ink, 0.65);
  rows.forEach((label, i) => {
    const ry = y + 62 + i * 54;
    s += `<circle cx="${r(x + 42)}" cy="${r(ry + 14)}" r="15" fill="${P.accentSoft}"/>`;
    s += check(x + 35, ry + 13, P.accent, 0.95);
    s += txt(x + 70, ry + 22, label, { size: 20, weight: 500, fill: P.ink });
  });
  return { svg: s, h };
}

/* ───────── 共通のヘッダ・フッタ ───────── */

function chromeTop(o) {
  const { W, P, brand, label } = o;
  return rect(72, 66, 8, 8, { fill: P.accent })
    + txt(94, 75, brand, { family: MONO, size: 15, weight: 500, fill: P.ink3, ls: 3 })
    + txt(W - 72, 75, label, { family: MONO, size: 15, weight: 500, fill: P.ink, ls: 3, anchor: 'end' })
    + line(72, 96, W - 72, 96, P.line, 0.18);
}

function chromeBottom(o) {
  const { W, H, P, date, domain } = o;
  return line(72, H - 84, W - 72, H - 84, P.line, 0.18)
    + txt(72, H - 52, date, { family: MONO, size: 15, weight: 500, fill: P.ink3, ls: 3 })
    + txt(W - 72, H - 52, domain, { family: MONO, size: 15, weight: 500, fill: P.ink3, ls: 3, anchor: 'end' });
}

/** タイトルを描く。返り値は { svg, bottomY } */
function titleBlock(x, topY, lines, size, P, o = {}) {
  const lineH = size * (o.lh || 1.44);
  let s = '';
  lines.forEach((l, i) => {
    s += txt(x, topY + size * 0.85 + i * lineH, l, {
      size, weight: 700, fill: o.fill || P.ink, ls: -0.5, anchor: o.anchor,
    });
  });
  return { svg: s, bottomY: topY + size * 0.85 + (lines.length - 1) * lineH };
}

/** タイトル下のひとこと（ミエルームの hook など） */
function hookBlock(x, y, hook, P, o = {}) {
  if (!hook) return '';
  const lines = wrapTitle(hook, o.perLine || 20, 2);
  let s = rect(x, y - 16, 34, 3, { fill: P.accent });
  lines.forEach((l, i) => {
    s += txt(x, y + 24 + i * 32, l, { size: 22, weight: 500, fill: P.ink3, anchor: o.anchor });
  });
  return s;
}

/* ───────── レイアウト本体 ───────── */

const LAYOUTS = {
  /** 背景写真 + 左にタイトル（従来のデザイン） */
  photo(o) {
    const { W, H, P, title, bgUri } = o;
    const lines = wrapTitle(title, 12, 4);
    const size = lines.length >= 4 ? 44 : lines.length === 3 ? 48 : 54;
    const blockH = lines.length * size * 1.5;
    const topY = (H - blockH) / 2;
    const t = titleBlock(72, topY, lines, size, P, { lh: 1.5 });
    return `${rect(0, 0, W, H, { fill: P.paper })}
  <image href="${bgUri}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  <defs><linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${P.paper}" stop-opacity="0.97"/>
    <stop offset="0.42" stop-color="${P.paper}" stop-opacity="0.88"/>
    <stop offset="0.72" stop-color="${P.paper}" stop-opacity="0"/>
  </linearGradient></defs>
  ${rect(0, 0, W, H, { fill: 'url(#scrim)' })}
  ${chromeTop(o)}${t.svg}${hookBlock(72, t.bottomY + 52, o.hook, P)}${chromeBottom(o)}`;
  },

  /** 左にタイトル、右に検索画面と結果カードを重ねる */
  console(o) {
    const { W, H, P, title, tags, year } = o;
    const colW = 560;
    const lines = wrapTitle(title, 11, 4);
    const size = lines.length >= 4 ? 44 : lines.length === 3 ? 49 : 54;
    const rb = ribbon(72, 132, year, P);
    const t = titleBlock(72, 206, lines, size, P);
    const pills = pillRow(72, Math.min(t.bottomY + 40, H - 150), tags.slice(0, 3), P, { maxW: colW, size: 19, h: 42 });
    const sx = 664, sw = W - sx - 64;
    const sr = sceneSearch(sx, 148, sw, P, o.query);
    const res = sceneResult(sx + 34, 148 + sr.h + 22, sw - 34, P, o.thumb);
    return `${rect(0, 0, W, H, { fill: P.paper })}
  ${blob(W, H, P)}${chromeTop(o)}${rb.svg}${t.svg}${o.hook ? hookBlock(72, t.bottomY + 56, o.hook, P) : pills}
  ${sr.svg}${res.svg}${chromeBottom(o)}`;
  },

  /** 上にタイトル、下にアクセント色の帯とタグ */
  band(o) {
    const { W, H, P, title, tags, year } = o;
    const bandH = Math.round(H * 0.36);
    const bandY = H - bandH;
    const lines = wrapTitle(title, 17, 3);
    const size = lines.length >= 3 ? 50 : lines.length === 2 ? 58 : 64;
    const rb = ribbon(72, 126, year, P);
    const t = titleBlock(72, 198, lines, size, P);
    return `${rect(0, 0, W, H, { fill: P.paper })}
  ${rect(0, bandY, W, bandH, { fill: P.accent })}
  <circle cx="${r(W - 128)}" cy="${r(bandY + bandH / 2)}" r="118" fill="#FFFFFF" opacity="0.08"/>
  <circle cx="${r(W - 128)}" cy="${r(bandY + bandH / 2)}" r="74" fill="#FFFFFF" opacity="0.08"/>
  ${chromeTop(o)}${rb.svg}${t.svg}
  ${o.hook ? hookBlock(72, t.bottomY + 50, o.hook, P) : ''}
  ${pillRow(72, bandY + 44, tags.slice(0, 3), P, { bg: 'rgba(255,255,255,0.2)', fg: '#FFFFFF', dotFill: '#FFFFFF', size: 20, maxW: W - 260 })}
  ${txt(72, bandY + bandH - 38, o.date, { family: MONO, size: 15, weight: 500, fill: '#FFFFFF', ls: 3, opacity: 0.8 })}
  ${txt(W - 72, bandY + bandH - 38, o.domain, { family: MONO, size: 15, weight: 500, fill: '#FFFFFF', ls: 3, anchor: 'end', opacity: 0.8 })}`;
  },

  /** 巨大なゴースト文字を背景に、左にタイトルとチェックリスト */
  ghost(o) {
    const { W, H, P, title, tags, glyphWord } = o;
    const lines = wrapTitle(title, 13, 3);
    const size = lines.length >= 3 ? 50 : lines.length === 2 ? 58 : 64;
    const t = titleBlock(72, 176, lines, size, P);
    const items = tags.slice(0, 3);
    let list = '';
    items.forEach((label, i) => {
      const y = t.bottomY + 60 + i * 50;
      list += `<circle cx="${r(86)}" cy="${r(y)}" r="15" fill="${P.accentSoft}"/>` + check(79, y - 1, P.accent, 0.95)
        + txt(116, y + 8, label, { size: 21, weight: 500, fill: P.ink });
    });
    return `${rect(0, 0, W, H, { fill: P.paper })}
  ${rect(W - 232, 0, 232, H, { fill: P.accentSoft, opacity: 0.6 })}
  ${txt(W - 272, H - 116, glyphWord, { size: 232, weight: 700, fill: P.ink, ls: -12, anchor: 'end', opacity: 0.055 })}
  <circle cx="${r(W - 116)}" cy="${r(H * 0.5)}" r="66" fill="#FFFFFF" opacity="0.8"/>
  ${pin(W - 116, H * 0.5 + 30, 1.7, P.accent)}
  ${chromeTop(o)}${t.svg}${o.hook ? hookBlock(72, t.bottomY + 54, o.hook, P) : list}${chromeBottom(o)}`;
  },

  /** 左にタイトル、右に棒グラフのカード */
  chart(o) {
    const { W, H, P, title, tags, year } = o;
    const lines = wrapTitle(title, 11, 4);
    const size = lines.length >= 4 ? 44 : lines.length === 3 ? 49 : 55;
    const rb = ribbon(72, 130, year, P);
    const t = titleBlock(72, 204, lines, size, P);
    const cx = 640, cw = W - cx - 72;
    const ch = H - 300;
    return `${rect(0, 0, W, H, { fill: P.paper })}
  ${blob(W, H, P)}${chromeTop(o)}${rb.svg}${t.svg}
  ${o.hook ? hookBlock(72, t.bottomY + 56, o.hook, P) : pillRow(72, Math.min(t.bottomY + 42, H - 150), tags.slice(0, 2), P, { maxW: 520, size: 19, h: 42 })}
  ${sceneChart(cx, 150, cw, ch, P)}
  ${chromeBottom(o)}`;
  },

  /** 中央寄せ。下に柔らかい弧を敷く */
  center(o) {
    const { W, H, P, title, tags, year } = o;
    const lines = wrapTitle(title, 16, 3);
    const size = lines.length >= 3 ? 48 : lines.length === 2 ? 56 : 62;
    const rb = ribbon(0, 0, year, P, { size: 22, h: 46 });
    const t = titleBlock(W / 2, 208, lines, size, P, { anchor: 'middle', lh: 1.4 });
    const pills = tags.slice(0, 3);
    const gap = 14;
    const totalW = pills.reduce((a, l) => a + 24 * 2 + 24 + textWidth(l) * 19 + gap, 0) - gap;
    return `${rect(0, 0, W, H, { fill: P.paper })}
  ${rect(-80, H - 132, W + 160, 300, { rx: 150, fill: P.accentSoft, opacity: 0.6 })}
  ${pin(132, H - 74, 1.1, P.accent)}${pin(W - 142, H - 92, 0.85, P.accent)}
  ${chromeTop(o)}
  <g transform="translate(${r((W - rb.w) / 2)}, 132)">${rb.svg}</g>
  ${t.svg}
  ${rect((W - 110) / 2, t.bottomY + 30, 110, 4, { rx: 2, fill: P.accent })}
  ${pillRow((W - totalW) / 2, t.bottomY + 64, pills, P, { size: 19, h: 42, bg: '#FFFFFF' })}
  ${chromeBottom(o)}`;
  },
};

/** 背景にうっすら置く円（のっぺりしないように） */
function blob(W, H, P) {
  return rect(W - 420, -160, 520, 520, { rx: 260, fill: P.accentSoft, opacity: 0.5 })
    + rect(-120, H - 260, 380, 380, { rx: 190, fill: P.accentSoft, opacity: 0.35 });
}

const ORDER = ['console', 'band', 'chart', 'ghost', 'center', 'photo'];

/** 日付から使うレイアウトを決める。1日ずれれば必ず別のレイアウトになる */
function pickLayout(date, offset = 0) {
  const d = Date.parse(String(date) + 'T00:00:00Z');
  const day = Number.isNaN(d) ? 0 : Math.floor(d / 86400000);
  return ORDER[(((day + offset) % ORDER.length) + ORDER.length) % ORDER.length];
}

/**
 * カバーの SVG を組み立てる。
 * opt: { W, H, palette, title, date, brand, domain, label, tags, hook, year, query, glyphWord, bgUri, variant }
 */
function buildCover(opt) {
  const o = Object.assign({ tags: [], hook: '', year: '', query: '', glyphWord: 'T', thumb: 'doc' }, opt);
  o.P = o.palette;
  let name = o.variant;
  if (!LAYOUTS[name]) name = 'console';
  if (name === 'photo' && !o.bgUri) name = 'console';
  const inner = LAYOUTS[name](o);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.W}" height="${o.H}">\n  ${inner}\n</svg>`;
}

module.exports = { buildCover, pickLayout, ORDER, LAYOUTS };
