#!/usr/bin/env node
/**
 * カバー画像のレイアウト集。
 *
 * 「毎日同じ絵に見える」のを避けるため、構図そのものを複数持ち、記事の日付で順に切り替える。
 * 日付が1日進むと必ず別の構図になるので、連日の記事が並んでも見た目が重ならない。
 *
 * 絵の作りは、やわらかいグラデーションの背景・街のシルエット・影のついた重なったカード・
 * 吹き出しといった要素で組み立てる。配色はサイトごと（TENERAMENTE = 青 / ミエルーム = 緑）に
 * palette で渡す。外部の画像に依存するのはロゴと photo レイアウトの背景写真だけ。
 *
 * 数字の捏造を避けるため、飾りの中には数値・評価・星を描かない。
 * 文字が入る位置はグレーの棒で表す（日付と年号だけが実在の数値）。
 */
const fs = require('fs');
const path = require('path');
const { escXml, wrapTitle, textWidth } = require('./cover-lib');
const { artworkSVG } = require('./cover-art');

const JP = 'Zen Kaku Gothic New, Noto Sans JP, Yu Gothic, sans-serif';
const MONO = 'IBM Plex Mono, Consolas, monospace';

function r(n) { return Math.round(n * 10) / 10; }

/* ───────── 基本の部品 ───────── */

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
  const a = [`x="${r(x)}"`, `y="${r(y)}"`, `width="${r(Math.max(0, w))}"`, `height="${r(Math.max(0, h))}"`];
  if (o.rx) a.push(`rx="${o.rx}"`);
  a.push(`fill="${o.fill || 'none'}"`);
  if (o.stroke) a.push(`stroke="${o.stroke}"`, `stroke-width="${o.sw || 1}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  if (o.filter) a.push(`filter="url(#${o.filter})"`);
  return `<rect ${a.join(' ')}/>`;
}

function circle(cx, cy, rad, o = {}) {
  const a = [`cx="${r(cx)}"`, `cy="${r(cy)}"`, `r="${r(rad)}"`, `fill="${o.fill || 'none'}"`];
  if (o.stroke) a.push(`stroke="${o.stroke}"`, `stroke-width="${o.sw || 1}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  if (o.filter) a.push(`filter="url(#${o.filter})"`);
  return `<circle ${a.join(' ')}/>`;
}

/** 文字の代わりのグレーの棒。偽の文言や数値を描かないための部品 */
function bar(x, y, w, h, fill, opacity = 1) {
  return rect(x, y, w, h, { rx: h / 2, fill, opacity });
}

/** 影つきの白いカード */
function card(x, y, w, h, o = {}) {
  return rect(x, y, w, h, { rx: o.rx || 22, fill: o.fill || '#FFFFFF', filter: o.flat ? null : 'soft' });
}

/* ───────── 背景 ───────── */

/** やわらかいグラデーションとぼかした色面 */
function backdrop(W, H, P) {
  return rect(0, 0, W, H, { fill: 'url(#bg)' })
    + circle(W * 0.86, H * 0.12, 210, { fill: P.accent, opacity: 0.1, filter: 'blur' })
    + circle(W * 0.1, H * 0.86, 190, { fill: P.accent, opacity: 0.08, filter: 'blur' })
    + circle(W * 0.56, H * 0.06, 130, { fill: P.accent, opacity: 0.06, filter: 'blur' });
}

/** 下端に敷く街のシルエット。文字に干渉しないよう低く抑える */
function skyline(W, H, P, o = {}) {
  const baseY = H - (o.lift || 0);
  const op = o.opacity != null ? o.opacity : 0.1;
  const col = o.fill || P.accent;
  const blocks = [
    [0, 78, 46], [84, 50, 62], [142, 104, 36], [222, 64, 76], [292, 88, 50],
    [388, 56, 66], [452, 96, 40], [556, 70, 58], [634, 50, 46], [692, 92, 70],
    [792, 64, 42], [864, 84, 62], [956, 54, 50], [1018, 98, 38], [1124, 62, 64],
  ];
  let s = '';
  for (const [bx, bw, bh] of blocks) {
    if (bx > W) continue;
    s += rect(bx, baseY - bh, Math.min(bw, W - bx), bh, { rx: 4, fill: col, opacity: op });
    for (let wy = baseY - bh + 13; wy < baseY - 12; wy += 19) {
      for (let wx = bx + 12; wx < bx + bw - 12; wx += 20) {
        s += rect(wx, wy, 6, 8, { rx: 2, fill: o.win || '#FFFFFF', opacity: op * 4 });
      }
    }
  }
  // 下端の文字が読めるよう、地色のフェードをかぶせる（濃い帯の上では使わない）
  if (o.fade !== false) s += rect(0, baseY - 96, W, 96, { fill: 'url(#fade)' });
  return s;
}

/** 木（街のシルエットのアクセント） */
function tree(cx, baseY, s, P, op = 0.16) {
  return rect(cx - 2.5 * s, baseY - 18 * s, 5 * s, 18 * s, { fill: P.accent, opacity: op })
    + circle(cx, baseY - 30 * s, 15 * s, { fill: P.accent, opacity: op });
}

/* ───────── ロゴ ───────── */

const BRAND_DIR = path.join(__dirname, '..', 'assets', 'img', 'brand');
const logoCache = new Map();
function logoUri(name) {
  if (logoCache.has(name)) return logoCache.get(name);
  const file = path.join(BRAND_DIR, name + '.png');
  const uri = fs.existsSync(file) ? 'data:image/png;base64,' + fs.readFileSync(file).toString('base64') : null;
  logoCache.set(name, uri);
  return uri;
}

/** 左上のロゴ。素材が無ければ文字で代替する */
function brandMark(x, y, P, o = {}) {
  const mark = logoUri('mark-dark');
  const word = logoUri('word-dark');
  if (o.useLogo !== false && mark && word) {
    const mh = 38, mw = mh * (427 / 271);
    const wh = 20, ww = wh * (823 / 66);
    return `<image href="${mark}" x="${r(x)}" y="${r(y)}" width="${r(mw)}" height="${r(mh)}"/>`
      + `<image href="${word}" x="${r(x + mw + 14)}" y="${r(y + (mh - wh) / 2 + 1)}" width="${r(ww)}" height="${r(wh)}"/>`;
  }
  return rect(x, y + 12, 10, 10, { fill: P.accent })
    + txt(x + 24, y + 22, o.brand || '', { family: MONO, size: 16, weight: 700, fill: P.ink, ls: 3 });
}

/* ───────── 見出しまわり ───────── */

/** 傾いたバッジ（2026年版 など） */
function badge(x, y, label, P, o = {}) {
  const size = o.size || 26;
  const h = o.h || 56;
  const pad = 26;
  const w = pad * 2 + textWidth(label) * size;
  const rot = o.rot != null ? o.rot : -2.4;
  const inner = rect(0, 0, w, h, { rx: 16, fill: o.bg || P.accent, filter: 'soft' })
    + txt(pad, h / 2 + size * 0.36, label, { size, weight: 700, fill: o.fg || '#FFFFFF' });
  return { svg: `<g transform="translate(${r(x)} ${r(y)}) rotate(${rot} ${r(w / 2)} ${r(h / 2)})">${inner}</g>`, w, h };
}

/** タイトル。1行目の後半にマーカーを敷く */
function title(x, topY, lines, size, P, o = {}) {
  const lineH = size * (o.lh || 1.42);
  let s = '';
  // マーカー（見本の下線ハイライト）
  if (o.mark !== false && lines.length) {
    const w0 = textWidth(lines[0]) * size;
    const my = topY + size * 0.98;
    s += rect(x - 4, my, Math.min(w0 + 8, o.markMax || 9999), size * 0.34, { rx: 4, fill: P.accent, opacity: 0.16 });
  }
  lines.forEach((l, i) => {
    s += txt(x, topY + size * 0.85 + i * lineH, l, {
      size, weight: 700, fill: o.fill || P.ink, ls: -1, anchor: o.anchor,
    });
  });
  return { svg: s, bottomY: topY + size * 0.85 + (lines.length - 1) * lineH };
}

/** タイトル下のひとこと */
function hookLine(x, y, hook, P, o = {}) {
  if (!hook) return '';
  const lines = wrapTitle(hook, o.perLine || 22, 2);
  let s = rect(x, y - 18, 30, 4, { rx: 2, fill: P.accent });
  lines.forEach((l, i) => {
    s += txt(x, y + 22 + i * 32, l, { size: 22, weight: 500, fill: o.fill || P.ink3, anchor: o.anchor });
  });
  return s;
}

/* ───────── アイコンつきのタグ ───────── */

function icon(kind, cx, cy, P, col) {
  const c = col || P.accent;
  if (kind === 0) { // ピン
    return `<path d="M${r(cx)} ${r(cy + 8)} L${r(cx - 6)} ${r(cy - 1)} A8 8 0 1 1 ${r(cx + 6)} ${r(cy - 1)} Z" fill="${c}"/>`
      + circle(cx, cy - 3, 2.6, { fill: '#FFFFFF' });
  }
  if (kind === 1) { // 吹き出し
    return rect(cx - 9, cy - 8, 18, 13, { rx: 4, fill: c })
      + `<path d="M${r(cx - 4)} ${r(cy + 5)} L${r(cx - 1)} ${r(cy + 9)} L${r(cx + 2)} ${r(cy + 5)} Z" fill="${c}"/>`;
  }
  // 棒グラフ
  return rect(cx - 8, cy - 1, 4, 8, { rx: 1.5, fill: c })
    + rect(cx - 2, cy - 6, 4, 13, { rx: 1.5, fill: c })
    + rect(cx + 4, cy - 10, 4, 17, { rx: 1.5, fill: c });
}

function pill(x, y, label, P, o = {}) {
  const size = o.size || 18;
  const h = o.h || 44;
  const pad = o.pad || 18;
  const iconW = o.icon === false ? 0 : 26;
  const w = pad * 2 + iconW + textWidth(label) * size;
  const svg = rect(x, y, w, h, { rx: h / 2, fill: o.bg || '#FFFFFF', filter: o.flat ? null : 'soft' })
    + (iconW ? icon(o.kind || 0, x + pad + 8, y + h / 2, P, o.iconFill) : '')
    + txt(x + pad + iconW, y + h / 2 + size * 0.36, label, { size, weight: 700, fill: o.fg || P.ink });
  return { svg, w, h };
}

function pillRow(x, y, labels, P, o = {}) {
  const gap = o.gap || 14;
  let cx = x, out = '';
  labels.forEach((l, i) => {
    const p = pill(cx, y, l, P, Object.assign({}, o, { kind: i % 3 }));
    if (cx - x + p.w > (o.maxW || 9999)) return;
    out += p.svg;
    cx += p.w + gap;
  });
  return out;
}

/* ───────── 画面のモック ───────── */

/** 検索バーつきのブラウザカード。body は中身を描く関数 */
function browser(x, y, w, h, P, query, body) {
  let s = card(x, y, w, h);
  s += `<path d="M${r(x)} ${r(y + 22)} a22 22 0 0 1 22 -22 h${r(w - 44)} a22 22 0 0 1 22 22 v34 h${r(-w)} z" fill="${P.paper}"/>`;
  s += circle(x + 26, y + 28, 5, { fill: P.ink, opacity: 0.14 });
  s += circle(x + 44, y + 28, 5, { fill: P.ink, opacity: 0.14 });
  s += circle(x + 62, y + 28, 5, { fill: P.ink, opacity: 0.14 });
  const fy = y + 72;
  s += rect(x + 22, fy, w - 44, 52, { rx: 26, fill: '#FFFFFF', stroke: P.ink, sw: 1.2, opacity: 1 });
  s += rect(x + 22, fy, w - 44, 52, { rx: 26, fill: 'none', stroke: P.ink, sw: 1.2, opacity: 0.12 });
  s += circle(x + 52, fy + 26, 8.5, { stroke: P.accent, sw: 2.6 });
  s += `<line x1="${r(x + 58)}" y1="${r(fy + 32)}" x2="${r(x + 64)}" y2="${r(fy + 38)}" stroke="${P.accent}" stroke-width="2.6" stroke-linecap="round"/>`;
  s += txt(x + 76, fy + 34, query, { size: 20, weight: 500, fill: P.ink3 });
  const bodyH = y + h - (fy + 68) - 20;
  if (body && bodyH > 40) s += body(x, fy + 68, w, bodyH);
  return s;
}

/** 地図（道路・公園・ピン） */
function mapBody(P) {
  return (x, y, w, h) => {
    const mx = x + 22, mw = w - 44;
    let s = rect(mx, y, mw, h, { rx: 14, fill: P.mapBg || '#EDF3F1' });
    s += `<clipPath id="mc"><rect x="${r(mx)}" y="${r(y)}" width="${r(mw)}" height="${r(h)}" rx="14"/></clipPath>`;
    let g = '';
    // 公園と川
    g += rect(mx + 14, y + h * 0.52, mw * 0.2, h * 0.42, { rx: 10, fill: P.accent, opacity: 0.2 });
    g += `<path d="M${r(mx)} ${r(y + h * 0.82)} Q${r(mx + mw * 0.45)} ${r(y + h * 0.58)} ${r(mx + mw)} ${r(y + h * 0.78)}" fill="none" stroke="${P.accent}" stroke-opacity="0.16" stroke-width="16"/>`;
    // 道路は本数を絞り、太い白で通す
    g += rect(mx, y + h * 0.42 - 6, mw, 12, { fill: '#FFFFFF', opacity: 0.95 });
    g += rect(mx + mw * 0.34 - 6, y, 12, h, { fill: '#FFFFFF', opacity: 0.95 });
    g += rect(mx + mw * 0.72 - 5, y, 10, h, { fill: '#FFFFFF', opacity: 0.8 });
    s += `<g clip-path="url(#mc)">${g}</g>`;
    s += markerPin(x + w * 0.5, y + h * 0.56, 1.45, P.accent);
    s += markerPin(x + w * 0.27, y + h * 0.8, 0.85, P.accent);
    s += markerPin(x + w * 0.75, y + h * 0.42, 0.85, P.accent);
    return s;
  };
}

/** 表・ダッシュボードの中身 */
function tableBody(P) {
  return (x, y, w, h) => {
    let s = '';
    const rows = Math.max(2, Math.floor((h - 8) / 38));
    for (let i = 0; i < rows; i++) {
      const ry = y + i * 38;
      s += rect(x + 22, ry, w - 44, 30, { rx: 8, fill: i % 2 ? P.paper : '#FFFFFF' });
      s += circle(x + 42, ry + 15, 7, { fill: P.accent, opacity: i === 0 ? 0.9 : 0.25 });
      s += bar(x + 60, ry + 11, (w - 44) * 0.3, 8, P.ink, 0.22);
      s += bar(x + 60 + (w - 44) * 0.36, ry + 11, (w - 44) * 0.18, 8, P.ink, 0.13);
      s += rect(x + w - 108, ry + 8, 62, 15, { rx: 7, fill: P.accent, opacity: i === 0 ? 0.22 : 0.1 });
    }
    return s;
  };
}

/** チャット・AI回答の中身 */
function chatBody(P) {
  return (x, y, w, h) => {
    let s = '';
    s += rect(x + 22, y, (w - 44) * 0.55, 46, { rx: 14, fill: P.paper });
    s += bar(x + 40, y + 19, (w - 44) * 0.34, 8, P.ink, 0.2);
    const by = y + 60;
    s += rect(x + w - 22 - (w - 44) * 0.78, by, (w - 44) * 0.78, Math.max(46, h - 66), { rx: 14, fill: P.accent, opacity: 0.12 });
    const bx = x + w - 22 - (w - 44) * 0.78 + 18;
    s += bar(bx, by + 18, (w - 44) * 0.6, 8, P.accent, 0.55);
    s += bar(bx, by + 36, (w - 44) * 0.48, 8, P.accent, 0.35);
    if (h > 120) s += bar(bx, by + 54, (w - 44) * 0.54, 8, P.accent, 0.35);
    return s;
  };
}

/** サイトのワイヤーフレーム */
function siteBody(P) {
  return (x, y, w, h) => {
    let s = rect(x + 22, y, w - 44, Math.min(70, h * 0.45), { rx: 12, fill: P.accent, opacity: 0.14 });
    s += bar(x + 42, y + 22, (w - 44) * 0.42, 10, P.accent, 0.55);
    s += bar(x + 42, y + 42, (w - 44) * 0.28, 8, P.accent, 0.3);
    const cy = y + Math.min(70, h * 0.45) + 16;
    const cw = (w - 44 - 24) / 3;
    for (let i = 0; i < 3; i++) {
      s += rect(x + 22 + i * (cw + 12), cy, cw, Math.max(24, h - (cy - y) - 8), { rx: 10, fill: P.paper });
    }
    return s;
  };
}

function markerPin(cx, cy, s, fill) {
  return `<path d="M${r(cx)} ${r(cy)} L${r(cx - 11 * s)} ${r(cy - 17 * s)} A${r(14 * s)} ${r(14 * s)} 0 1 1 ${r(cx + 11 * s)} ${r(cy - 17 * s)} Z" fill="${fill}"/>`
    + circle(cx, cy - 24 * s, 5 * s, { fill: '#FFFFFF' });
}

/** 吹き出し（アバター + グレーの棒。星や数値は描かない） */
function bubble(x, y, w, P, o = {}) {
  const h = o.h || 74;
  let s = card(x, y, w, h, { rx: 18 });
  s += `<path d="M${r(x + 26)} ${r(y + h - 2)} L${r(x + 18)} ${r(y + h + 14)} L${r(x + 46)} ${r(y + h - 2)} Z" fill="#FFFFFF"/>`;
  s += circle(x + 32, y + h / 2, 17, { fill: P.accent, opacity: 0.16 });
  s += circle(x + 32, y + h / 2 - 5, 6, { fill: P.accent, opacity: 0.6 });
  s += `<path d="M${r(x + 21)} ${r(y + h / 2 + 12)} a11 11 0 0 1 22 0 z" fill="${P.accent}" opacity="0.6"/>`;
  s += bar(x + 60, y + 22, w - 84, 9, P.ink, 0.22);
  s += bar(x + 60, y + 40, (w - 84) * 0.66, 9, P.ink, 0.14);
  return { svg: s, h };
}

/** 小さな統計カード（棒グラフ。目盛りも数値も入れない） */
function miniChart(x, y, w, h, P, tagLabel) {
  let s = card(x, y, w, h, { rx: 18 });
  s += bar(x + 20, y + 22, w * 0.28, 9, P.ink, 0.26);
  const base = y + h - 22;
  const n = 4, bw = (w - 44) / (n * 1.7);
  const hs = [0.32, 0.52, 0.74, 1];
  const span = base - y - 54;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const bx = x + 20 + i * bw * 1.7;
    const bh = span * hs[i];
    s += rect(bx, base - bh, bw, bh, { rx: 6, fill: P.accent, opacity: i === n - 1 ? 1 : 0.2 });
    pts.push([bx + bw / 2, base - bh - 13]);
  }
  // 右肩上がりの線。矢印の頭は最後の線分の向きに合わせる
  s += `<polyline points="${pts.map(q => `${r(q[0])},${r(q[1])}`).join(' ')}" fill="none" stroke="${P.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>`;
  const [ax, ay] = pts[n - 1], [qx, qy] = pts[n - 2];
  const ang = Math.atan2(ay - qy, ax - qx);
  const hd = sp => [r(ax - 13 * Math.cos(ang - sp)), r(ay - 13 * Math.sin(ang - sp))];
  const h1 = hd(0.45), h2 = hd(-0.45);
  s += `<path d="M${h1[0]} ${h1[1]} L${r(ax)} ${r(ay)} L${h2[0]} ${h2[1]}" fill="none" stroke="${P.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (tagLabel) {
    const tw = 22 * 2 + textWidth(tagLabel) * 18;
    s += rect(x + w - tw - 14, y + 12, tw, 38, { rx: 19, fill: P.accent })
      + txt(x + w - tw - 14 + 22, y + 12 + 25, tagLabel, { size: 18, weight: 700, fill: '#FFFFFF' });
  }
  return s;
}

/** 記事カテゴリに応じた画面の中身を選ぶ */
function bodyFor(scene, P) {
  if (scene === 'map') return mapBody(P);
  if (scene === 'chat') return chatBody(P);
  if (scene === 'site') return siteBody(P);
  return tableBody(P);
}

/* ───────── 共通の footer ───────── */

function footer(o) {
  const { W, H, P, date, domain } = o;
  return txt(72, H - 44, date, { family: MONO, size: 15, weight: 500, fill: P.ink3, ls: 3 })
    + txt(W - 72, H - 44, domain, { family: MONO, size: 15, weight: 500, fill: P.ink3, ls: 3, anchor: 'end' });
}

function topRight(o) {
  const { W, P, label } = o;
  return txt(W - 72, 82, label, { family: MONO, size: 15, weight: 700, fill: P.accent, ls: 3, anchor: 'end' });
}

/** 絵柄の上に重ねる文字（photo / art で共通）。絵は右側なので文字は左半分に収める */
function onArtwork(o) {
  const { W, H, P, tags } = o;
  const lines = wrapTitle(o.title, 10, 4);
  const size = lines.length >= 4 ? 43 : lines.length === 3 ? 48 : 54;
  const blockH = lines.length * size * 1.44;
  const topY = (H - blockH) / 2 + 6;
  const t = title(72, topY, lines, size, P, { markMax: 450, lh: 1.44 });
  return `${rect(0, 0, W, H, { fill: o.scrim || 'url(#scrim)' })}
  ${brandMark(70, 50, P, o)}
  ${txt(72, 124, o.label, { family: MONO, size: 15, weight: 700, fill: P.accent, ls: 3 })}
  ${t.svg}
  ${o.hook ? hookLine(72, t.bottomY + 54, o.hook, P) : pillRow(72, Math.min(t.bottomY + 38, H - 142), tags.slice(0, 2), P, { maxW: 470 })}
  ${txt(72, H - 44, o.date + '   ' + o.domain, { family: MONO, size: 15, weight: 500, fill: P.ink3, ls: 3 })}`;
}

/* ───────── レイアウト ───────── */

const LAYOUTS = {
  /** 見本に近い形。左に見出し、右に画面とカードを重ねる */
  hero(o) {
    const { W, H, P, tags, year, scene } = o;
    const colW = 560;
    const lines = wrapTitle(o.title, 11, 4);
    const size = lines.length >= 4 ? 44 : lines.length === 3 ? 50 : 58;
    const b = badge(70, 128, year, P);
    const t = title(72, 208, lines, size, P, { markMax: colW });
    const belowY = Math.min(t.bottomY + 34, H - 150);
    const sx = 660, sw = W - sx - 56;
    const br = browser(sx, 140, sw, 262, P, o.query, bodyFor(scene, P));
    const bub = bubble(616, 376, 272, P, { h: 72 });
    const mc = miniChart(W - 56 - 250, 418, 250, 140, P, o.tag);
    return `${backdrop(W, H, P)}${skyline(W, H, P, { opacity: 0.075 })}
  ${tree(96, H, 1.5, P, 0.13)}${tree(150, H, 1.05, P, 0.1)}
  ${brandMark(70, 56, P, o)}${topRight(o)}
  ${b.svg}${t.svg}
  ${o.hook ? hookLine(72, belowY + 22, o.hook, P) : pillRow(72, belowY, tags.slice(0, 3), P, { maxW: colW })}
  ${br}${bub.svg}${mc}
  ${footer(o)}`;
  },

  /** 右側に色面のパネルを立て、その中に画面を置く */
  panel(o) {
    const { W, H, P, tags, year, scene } = o;
    const px = 620;
    const lines = wrapTitle(o.title, 10, 4);
    const size = lines.length >= 4 ? 44 : lines.length === 3 ? 50 : 56;
    const b = badge(70, 130, year, P);
    const t = title(72, 212, lines, size, P, { markMax: 500 });
    const belowY = Math.min(t.bottomY + 34, H - 146);
    const br = browser(px + 58, 128, W - px - 116, 300, P, o.query, bodyFor(scene, P));
    const bub = bubble(px + 8, 404, 300, P, { h: 78 });
    return `${backdrop(W, H, P)}
  ${rect(px, -40, W - px + 60, H + 80, { rx: 60, fill: P.accent, opacity: 0.1 })}
  ${skyline(W, H, P, { opacity: 0.07 })}
  ${brandMark(70, 56, P, o)}${topRight(o)}
  ${b.svg}${t.svg}
  ${o.hook ? hookLine(72, belowY + 22, o.hook, P) : pillRow(72, belowY, tags.slice(0, 2), P, { maxW: 520 })}
  ${br}${bub.svg}
  ${footer(o)}`;
  },

  /** 下にブランドカラーの帯。帯にカードが半分かかる */
  band(o) {
    const { W, H, P, tags, year, scene } = o;
    const bandH = Math.round(H * 0.38);
    const bandY = H - bandH;
    const lines = wrapTitle(o.title, 13, 3);
    const size = lines.length >= 3 ? 44 : lines.length === 2 ? 54 : 60;
    const b = badge(70, 120, year, P);
    const t = title(72, 188, lines, size, P, { markMax: 620 });
    const br = browser(W - 424, bandY - 104, 360, 214, P, o.query, bodyFor(scene, P));
    return `${backdrop(W, H, P)}
  ${rect(0, bandY, W, bandH, { fill: 'url(#band)' })}
  ${skyline(W, H, P, { opacity: 0.14, fill: '#FFFFFF', win: P.accentDeep || P.accent, fade: false })}
  ${circle(W * 0.18, bandY + bandH * 0.55, 120, { fill: '#FFFFFF', opacity: 0.07 })}
  ${brandMark(70, 56, P, o)}${topRight(o)}
  ${b.svg}${t.svg}
  ${o.hook ? hookLine(72, Math.min(t.bottomY + 56, bandY + 62), o.hook, P, { fill: '#FFFFFF' }) : pillRow(72, bandY + 56, tags.slice(0, 3), P, { maxW: W - 540 })}
  ${br}
  ${txt(72, H - 44, o.date, { family: MONO, size: 15, weight: 500, fill: '#FFFFFF', ls: 3, opacity: 0.85 })}
  ${txt(W - 72, H - 44, o.domain, { family: MONO, size: 15, weight: 500, fill: '#FFFFFF', ls: 3, anchor: 'end', opacity: 0.85 })}`;
  },

  /** 画面を大きく1枚。見出しは左に寄せる */
  focus(o) {
    const { W, H, P, tags, year, scene } = o;
    const lines = wrapTitle(o.title, 10, 4);
    const size = lines.length >= 4 ? 43 : lines.length === 3 ? 49 : 55;
    const b = badge(70, 128, year, P);
    const t = title(72, 206, lines, size, P, { markMax: 470 });
    const belowY = Math.min(t.bottomY + 34, H - 146);
    const br = browser(608, 116, W - 608 - 56, H - 200, P, o.query, bodyFor(scene, P));
    return `${backdrop(W, H, P)}${skyline(W, H, P, { opacity: 0.07 })}
  ${tree(W - 40, H, 1.3, P, 0.12)}
  ${brandMark(70, 56, P, o)}${topRight(o)}
  ${b.svg}${t.svg}
  ${o.hook ? hookLine(72, belowY + 22, o.hook, P) : pillRow(72, belowY, tags.slice(0, 2), P, { maxW: 500 })}
  ${br}
  ${footer(o)}`;
  },

  /** 中央寄せ。下に街と画面カードを並べる */
  stage(o) {
    const { W, H, P, tags, year, scene } = o;
    const lines = wrapTitle(o.title, 15, 3);
    const size = lines.length >= 3 ? 46 : lines.length === 2 ? 54 : 60;
    const b = badge(0, 0, year, P, { rot: -1.6 });
    const t = title(W / 2, 194, lines, size, P, { anchor: 'middle', mark: false });
    const pills = tags.slice(0, 3);
    const totalW = pills.reduce((a, l) => a + 18 * 2 + 26 + textWidth(l) * 18 + 14, 0) - 14;
    const br = browser(W / 2 - 215, H - 190, 430, 136, P, o.query, null);
    return `${backdrop(W, H, P)}${skyline(W, H, P, { opacity: 0.08 })}
  ${brandMark(70, 56, P, o)}${topRight(o)}
  <g transform="translate(${r((W - b.w) / 2)} 118)">${b.svg}</g>
  ${t.svg}
  ${rect((W - 96) / 2, t.bottomY + 26, 96, 5, { rx: 3, fill: P.accent, opacity: 0.85 })}
  ${o.hook ? hookLine(W / 2, t.bottomY + 76, o.hook, P, { anchor: 'middle' }) : pillRow((W - totalW) / 2, t.bottomY + 56, pills, P, {})}
  ${br}
  ${txt(72, H - 44, o.date, { family: MONO, size: 15, weight: 500, fill: P.ink3, ls: 3 })}
  ${txt(W - 72, H - 44, o.domain, { family: MONO, size: 15, weight: 500, fill: P.ink3, ls: 3, anchor: 'end' })}`;
  },

  /** 背景写真の上に見出しを重ねる（従来の形） */
  /** 用意した背景画像の上に見出しを重ねる */
  photo(o) {
    const { W, H, P, bgUri } = o;
    return `${rect(0, 0, W, H, { fill: P.paper })}
  <image href="${bgUri}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  ${onArtwork(o)}`;
  },

  /** 背景の絵柄をその場で描いて、その上に見出しを重ねる（画像ファイル不要） */
  art(o) {
    const { W, H, P } = o;
    return `${artworkSVG(W, H, P, { seed: o.seed || o.title, motif: o.motif })}
  ${onArtwork(Object.assign({}, o, { scrim: 'url(#artscrim)' }))}`;
  },
};

const ORDER = ['hero', 'band', 'art', 'panel', 'stage', 'focus'];

/** 日付から使うレイアウトを決める。1日ずれれば必ず別のレイアウトになる */
function pickLayout(date, offset = 0) {
  const d = Date.parse(String(date) + 'T00:00:00Z');
  const day = Number.isNaN(d) ? 0 : Math.floor(d / 86400000);
  return ORDER[(((day + offset) % ORDER.length) + ORDER.length) % ORDER.length];
}

function defs(P) {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.55" stop-color="${P.paper}"/>
      <stop offset="1" stop-color="${P.tint || P.accentSoft}"/>
    </linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${P.accent}"/>
      <stop offset="1" stop-color="${P.accentDeep || P.accent}"/>
    </linearGradient>
    <linearGradient id="artscrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${P.paper}" stop-opacity="0.96"/>
      <stop offset="0.4" stop-color="${P.paper}" stop-opacity="0.92"/>
      <stop offset="0.58" stop-color="${P.paper}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${P.paper}" stop-opacity="0.98"/>
      <stop offset="0.46" stop-color="${P.paper}" stop-opacity="0.96"/>
      <stop offset="0.62" stop-color="${P.paper}" stop-opacity="0.72"/>
      <stop offset="0.82" stop-color="${P.paper}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.tint || P.paper}" stop-opacity="0"/>
      <stop offset="1" stop-color="${P.tint || P.paper}" stop-opacity="0.94"/>
    </linearGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="${P.shadow || P.ink}" flood-opacity="0.13"/>
    </filter>
    <filter id="blur"><feGaussianBlur stdDeviation="60"/></filter>
  </defs>`;
}

/**
 * カバーの SVG を組み立てる。
 * opt: { W, H, palette, title, date, brand, domain, label, tags, hook, year, query,
 *        scene('map'|'chat'|'dash'|'site'), tag, bgUri, variant, useLogo }
 */
function buildCover(opt) {
  const o = Object.assign({ tags: [], hook: '', year: '', query: '', scene: 'dash', tag: '' }, opt);
  o.P = o.palette;
  let name = o.variant;
  if (!LAYOUTS[name]) name = 'hero';
  if (name === 'photo' && !o.bgUri) name = 'art';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.W}" height="${o.H}">
  ${defs(o.P)}
  ${LAYOUTS[name](o)}
</svg>`;
}

module.exports = { buildCover, pickLayout, ORDER, LAYOUTS };
