#!/usr/bin/env node
/**
 * カバー背景の絵柄をその場で描く（assets/img/cover-bg/*.jpg と同じ作りを自動生成）。
 *
 * 既存の背景画像は「紙の地 × 黒 × 青の2色、右側だけに幾何学的な図形の群れ、左半分は余白、文字なし」
 * という作りになっている。この作りはベクターで描けるので、画像生成に頼らず記事ごとに描き起こす。
 *
 * slug を種にした擬似乱数で配置を決めるので、記事が違えば必ず違う絵になり、
 * 同じ記事なら何度ビルドしても同じ絵になる（再現性がある）。
 *
 * 返すのは <svg> の中身だけ。左半分には何も描かないので、その上にタイトルを重ねられる。
 */

/** 文字列から 32bit の種を作る */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 種から同じ並びを再現する擬似乱数 */
function rngFrom(seed) {
  let a = hashSeed(seed) || 1;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function r1(n) { return Math.round(n * 10) / 10; }

/* ───────── 描画の小道具 ───────── */

function rc(x, y, w, h, o = {}) {
  const a = [`x="${r1(x)}"`, `y="${r1(y)}"`, `width="${r1(w)}"`, `height="${r1(h)}"`];
  if (o.rx) a.push(`rx="${o.rx}"`);
  a.push(`fill="${o.fill || 'none'}"`);
  if (o.stroke) a.push(`stroke="${o.stroke}"`, `stroke-width="${o.sw || 1.4}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  if (o.rot) a.push(`transform="rotate(${r1(o.rot)} ${r1(x + w / 2)} ${r1(y + h / 2)})"`);
  return `<rect ${a.join(' ')}/>`;
}

function dot(cx, cy, rad, fill, opacity) {
  return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(rad)}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ''}/>`;
}

function seg(x1, y1, x2, y2, stroke, sw, dash) {
  return `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

function curve(x1, y1, cx, cy, x2, y2, stroke, sw, dash) {
  return `<path d="M${r1(x1)} ${r1(y1)} Q${r1(cx)} ${r1(cy)} ${r1(x2)} ${r1(y2)}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

function arc(cx, cy, rad, a0, a1, stroke, sw) {
  const p0 = [cx + rad * Math.cos(a0), cy + rad * Math.sin(a0)];
  const p1 = [cx + rad * Math.cos(a1), cy + rad * Math.sin(a1)];
  const big = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `<path d="M${r1(p0[0])} ${r1(p0[1])} A${r1(rad)} ${r1(rad)} 0 ${big} 1 ${r1(p1[0])} ${r1(p1[1])}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

/** 紙の地。resvg は feTurbulence を描けないので、細かい点で質感を作る */
function paper(W, H, P, rng) {
  let s = rc(0, 0, W, H, { fill: P.paper });
  for (let i = 0; i < 1400; i++) {
    const x = rng() * W, y = rng() * H;
    s += dot(x, y, rng() * 0.9 + 0.2, P.ink, 0.03 + rng() * 0.03);
  }
  return s;
}

/**
 * 図形の群れ。既存の背景画像に共通する「右側で図形がはじけている」部分。
 * 中心から離れるほど小さく、まばらになる。
 */
function shapeCloud(cx, cy, R, rng, P, o = {}) {
  const n = o.count || 40;
  const minX = o.minX != null ? o.minX : 0;
  const minR = o.minR || 0;      // 中心を空けたいときに使う
  const k = o.scale || 1;        // 図形の大きさの倍率
  let s = '';
  for (let i = 0; i < n; i++) {
    // 中心寄りに集まるように半径を取る
    const t = minR + (1 - minR) * Math.pow(rng(), 0.62);
    const ang = rng() * Math.PI * 2;
    const rad = R * t;
    const x = cx + rad * Math.cos(ang) * 1.05;
    const y = cy + rad * Math.sin(ang) * 0.92;
    if (x < minX || x > 1e9) continue;
    const near = 1 - t; // 中心に近いほど大きく
    const pick = rng();
    const blue = rng() < 0.22;
    const col = blue ? P.accent : P.ink;

    if (pick < 0.3) {
      // 塗りの長方形
      const w = (22 + near * 66 * rng() + 10) * k;
      const h = w * (0.9 + rng() * 0.7);
      s += rc(x - w / 2, y - h / 2, w, h, { fill: col, rot: (rng() - 0.5) * 34 });
    } else if (pick < 0.46) {
      // 線だけの長方形
      const w = (30 + near * 62 * rng() + 12) * k;
      const h = w * (0.9 + rng() * 0.6);
      s += rc(x - w / 2, y - h / 2, w, h, { stroke: col, sw: 1.5, rot: (rng() - 0.5) * 30 });
    } else if (pick < 0.68) {
      // 点
      s += dot(x, y, (3 + near * 8 * rng()) * k, col);
    } else if (pick < 0.84) {
      // 短い直線
      const len = (26 + near * 56 * rng()) * k;
      const a = rng() * Math.PI;
      s += seg(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2,
        x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2, col, 1.5);
    } else {
      // 弧
      const rad2 = (30 + rng() * 70) * k;
      const a0 = rng() * Math.PI * 2;
      s += arc(x, y, rad2, a0, a0 + 0.7 + rng() * 1.5, col, 1.5);
    }
  }
  return s;
}

/* ───────── 絵柄の型 ───────── */

/** 節点が右へ広がっていく流れ図（業務アプリ向け） */
function motifFlow(W, H, P, rng) {
  const cy = H * (0.44 + rng() * 0.12);
  const startX = W * 0.5;
  let s = '';
  // 左から伸びる背骨
  s += dot(startX, cy, 5, P.ink);
  s += seg(startX, cy, startX + 62, cy, P.ink, 1.6);
  s += rc(startX + 62, cy - 17, 34, 34, { stroke: P.ink, sw: 1.5 });
  s += seg(startX + 96, cy, startX + 116, cy, P.ink, 1.6);
  s += rc(startX + 116, cy - 19, 38, 38, { fill: P.accent });
  s += seg(startX + 154, cy, startX + 174, cy, P.ink, 1.6);
  const hub = startX + 174;
  s += rc(hub, cy - 38, 76, 76, { stroke: P.ink, sw: 1.6 });
  // 右へ広がる線
  const fanX = hub + 76;
  for (let i = 0; i < 7; i++) {
    const dy = (i - 3) * 9;
    s += seg(fanX, cy + dy, fanX + 74, cy + dy, P.ink, 1.1);
  }
  for (let i = 0; i < 6; i++) {
    const spread = (i - 2.5) / 2.5;
    const fromY = cy + (i - 2.5) * 9;           // 平行線の先端から続ける
    const endX = fanX + 140 + rng() * 130;
    const endY = cy + spread * (130 + rng() * 90);
    s += curve(fanX + 74, fromY, fanX + 136, fromY,
      endX, endY, P.ink, 1.3, i % 2 ? '3 6' : null);
    s += dot(endX, endY, 4.5, i % 3 === 0 ? P.accent : P.ink);
  }
  s += shapeCloud(W * 0.9, H * 0.5, W * 0.17, rng, P, { count: 34, minX: W * 0.72, minR: 0.28, scale: 0.85 });
  return s;
}

/** 同心円に矢印が集まる（MEO・ローカル検索向け） */
function motifRadial(W, H, P, rng) {
  const cx = W * 0.78, cy = H * (0.46 + rng() * 0.1);
  let s = '';
  const rings = [46, 78, 112, 150];
  rings.forEach((rad, i) => {
    s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${rad}" fill="none" stroke="${P.ink}" stroke-width="1.3"${i % 2 ? ' stroke-dasharray="4 7"' : ''}/>`;
  });
  s += dot(cx, cy, 20, P.accent);
  // 外から中心へ向かう線
  for (let i = 0; i < 8; i++) {
    // 真上・真下からの線は短くて汚くなるので、横向き寄りの角度だけ使う
    const a = (i / 8) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const from = 215 + rng() * 95;
    const to = 160 + rng() * 12;
    const x1 = cx + Math.cos(a) * from, y1 = cy + Math.sin(a) * from;
    const x2 = cx + Math.cos(a) * to, y2 = cy + Math.sin(a) * to;
    if (x1 < W * 0.5) continue;
    s += curve(x1, y1, (x1 + x2) / 2 + (rng() - 0.5) * 60, (y1 + y2) / 2 + (rng() - 0.5) * 60,
      x2, y2, P.ink, 1.3, i % 2 ? '3 6' : null);
    // 矢印の先
    const ang = Math.atan2(y2 - y1, x2 - x1);
    s += seg(x2, y2, x2 - Math.cos(ang - 0.4) * 11, y2 - Math.sin(ang - 0.4) * 11, P.ink, 1.3);
    s += seg(x2, y2, x2 - Math.cos(ang + 0.4) * 11, y2 - Math.sin(ang + 0.4) * 11, P.ink, 1.3);
  }
  s += shapeCloud(cx, cy, W * 0.25, rng, P, { count: 26, minX: W * 0.56, minR: 0.6, scale: 0.7 });
  return s;
}

/** 波が重なる（AI・AIO向け） */
function motifWave(W, H, P, rng) {
  const x0 = W * 0.5;
  let s = '';
  for (let i = 0; i < 9; i++) {
    const y = H * 0.2 + i * (H * 0.075);
    const amp = 24 + rng() * 26;
    const blue = i === 3 || i === 6;
    let d = `M${r1(x0)} ${r1(y)}`;
    for (let k = 0; k < 4; k++) {
      const seg1 = (W - x0) / 4;
      d += ` q${r1(seg1 / 2)} ${r1((k % 2 ? -1 : 1) * amp)} ${r1(seg1)} 0`;
    }
    s += `<path d="${d}" fill="none" stroke="${blue ? P.accent : P.ink}" stroke-width="${blue ? 2 : 1.3}" opacity="${blue ? 1 : 0.75}"${i % 3 === 2 ? ' stroke-dasharray="4 7"' : ''}/>`;
  }
  // 結節点
  for (let i = 0; i < 12; i++) {
    const x = x0 + rng() * (W - x0);
    const y = H * 0.2 + rng() * H * 0.6;
    s += dot(x, y, 3 + rng() * 5, rng() < 0.3 ? P.accent : P.ink);
  }
  s += shapeCloud(W * 0.89, H * 0.5, W * 0.13, rng, P, { count: 20, minX: W * 0.75, scale: 0.78 });
  return s;
}

/** 細い格子と枝分かれ（構造化・AI検索向け） */
function motifGrid(W, H, P, rng) {
  const x0 = W * 0.52;
  let s = '';
  for (let x = x0; x <= W; x += 46) s += seg(x, H * 0.1, x, H * 0.9, P.ink, 0.8, '2 6');
  for (let y = H * 0.12; y <= H * 0.9; y += 46) s += seg(x0, y, W, y, P.ink, 0.8, '2 6');
  // 枝分かれする経路
  let px = x0 + 20, py = H * 0.5;
  for (let i = 0; i < 6; i++) {
    const nx = px + 60 + rng() * 60;
    const ny = py + (rng() - 0.5) * 150;
    s += curve(px, py, (px + nx) / 2, py, nx, ny, P.ink, 1.6);
    s += dot(nx, ny, 5, i % 2 ? P.accent : P.ink);
    if (nx > W - 80) break;
    px = nx; py = ny;
  }
  for (let i = 0; i < 10; i++) {
    const x = x0 + rng() * (W - x0), y = H * 0.12 + rng() * H * 0.76;
    const sz = 14 + rng() * 34;
    s += rc(x, y, sz, sz, rng() < 0.3 ? { fill: P.accent } : { stroke: P.ink, sw: 1.4 });
  }
  s += shapeCloud(W * 0.88, H * 0.5, W * 0.12, rng, P, { count: 18, minX: W * 0.74, scale: 0.78 });
  return s;
}

/** 重なる長方形（サイト制作向け） */
function motifStack(W, H, P, rng) {
  const cx = W * 0.76;
  let s = '';
  for (let i = 0; i < 4; i++) {
    const w = 210 - i * 22, h = 150 - i * 14;
    const x = cx - w / 2 + (i - 1.5) * 34;
    const y = H * 0.5 - h / 2 + (i - 1.5) * 30;
    s += rc(x, y, w, h, i === 1 ? { fill: P.accent } : { stroke: P.ink, sw: 1.6 });
    if (i !== 1) {
      s += seg(x + 16, y + 26, x + w - 16, y + 26, P.ink, 1.2);
      s += seg(x + 16, y + 44, x + w * 0.6, y + 44, P.ink, 1.2);
    }
  }
  s += shapeCloud(W * 0.91, H * 0.5, W * 0.14, rng, P, { count: 22, minX: W * 0.79, minR: 0.3, scale: 0.78 });
  return s;
}

const MOTIFS = { flow: motifFlow, radial: motifRadial, wave: motifWave, grid: motifGrid, stack: motifStack };
const MOTIF_NAMES = Object.keys(MOTIFS);

/**
 * 背景の絵柄を描く。
 * seed が同じなら毎回同じ絵になる。motif を省くと seed から選ぶ。
 */
function artworkSVG(W, H, P, opts = {}) {
  const rng = rngFrom(opts.seed || 'teneramente');
  const name = MOTIFS[opts.motif] ? opts.motif : MOTIF_NAMES[hashSeed(opts.seed || '') % MOTIF_NAMES.length];
  return paper(W, H, P, rng) + MOTIFS[name](W, H, P, rng);
}

module.exports = { artworkSVG, MOTIF_NAMES, rngFrom, hashSeed };
