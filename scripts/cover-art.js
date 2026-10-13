#!/usr/bin/env node
/**
 * カバー背景の絵柄をその場で描く（assets/img/cover-bg/*.jpg と同じ作りを自動生成）。
 *
 * 既存の背景画像は「紙の地 × 黒 × 青の2色、右側だけに幾何学的な図形の群れ、左半分は余白、文字なし」
 * という作りになっている。この作りはベクターで描けるので、画像生成に頼らず記事ごとに描き起こす。
 *
 * slug を種にした擬似乱数で構図を決めるので、記事が違えば違う絵になり、
 * 同じ記事なら何度ビルドしても同じ絵になる（再現性がある）。
 *
 * 同じ絵に見えないようにするための決まりごと（2026-10-13〜）:
 *   1. 絵柄の型は 12 種類ある。型は日付ではなく slug から決め、
 *      assignMotifs() が「近い時期の記事とは必ず違う型」になるよう割り当てる
 *   2. 型が同じでも、中心の位置・大きさ・傾き・要素の数・差し色の位置は記事ごとに変える（stageFrom）
 *   3. 散らばる小さな図形（shapeCloud）は全部の絵には付けない。付けると全部同じ顔になる
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
/** lo〜hi の実数 */
function rr(rng, lo, hi) { return lo + rng() * (hi - lo); }
/** lo〜hi の整数（両端を含む） */
function ri(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

/* ───────── 描画の小道具 ───────── */

function rc(x, y, w, h, o = {}) {
  const a = [`x="${r1(x)}"`, `y="${r1(y)}"`, `width="${r1(w)}"`, `height="${r1(h)}"`];
  if (o.rx) a.push(`rx="${o.rx}"`);
  a.push(`fill="${o.fill || 'none'}"`);
  if (o.stroke) a.push(`stroke="${o.stroke}"`, `stroke-width="${o.sw || 1.4}"`);
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  if (o.rot) a.push(`transform="rotate(${r1(o.rot)} ${r1(x + w / 2)} ${r1(y + h / 2)})"`);
  return `<rect ${a.join(' ')}/>`;
}

function dot(cx, cy, rad, fill, opacity) {
  return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(rad)}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ''}/>`;
}

function ring(cx, cy, rad, stroke, sw, dash, opacity) {
  return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(rad)}" fill="none" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}${opacity != null ? ` opacity="${opacity}"` : ''}/>`;
}

function seg(x1, y1, x2, y2, stroke, sw, dash) {
  return `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

function curve(x1, y1, cx, cy, x2, y2, stroke, sw, dash) {
  return `<path d="M${r1(x1)} ${r1(y1)} Q${r1(cx)} ${r1(cy)} ${r1(x2)} ${r1(y2)}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

function arc(cx, cy, rad, a0, a1, stroke, sw, dash) {
  const p0 = [cx + rad * Math.cos(a0), cy + rad * Math.sin(a0)];
  const p1 = [cx + rad * Math.cos(a1), cy + rad * Math.sin(a1)];
  const big = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `<path d="M${r1(p0[0])} ${r1(p0[1])} A${r1(rad)} ${r1(rad)} 0 ${big} 1 ${r1(p1[0])} ${r1(p1[1])}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

/** 点の列をつないだ折れ線／多角形 */
function poly(pts, o = {}) {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p[0])} ${r1(p[1])}`).join(' ') + (o.close ? ' Z' : '');
  const a = [`d="${d}"`, `fill="${o.fill || 'none'}"`];
  if (o.stroke) a.push(`stroke="${o.stroke}"`, `stroke-width="${o.sw || 1.4}"`, 'stroke-linejoin="round"', 'stroke-linecap="round"');
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  return `<path ${a.join(' ')}/>`;
}

/** 楕円（軌道に使う） */
function ellipse(cx, cy, rx, ry, rot, stroke, sw, dash) {
  return `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="none" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} transform="rotate(${r1(rot)} ${r1(cx)} ${r1(cy)})"/>`;
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
      const w = (22 + near * 66 * rng() + 10) * k;
      const h = w * (0.9 + rng() * 0.7);
      s += rc(x - w / 2, y - h / 2, w, h, { fill: col, rot: (rng() - 0.5) * 34 });
    } else if (pick < 0.46) {
      const w = (30 + near * 62 * rng() + 12) * k;
      const h = w * (0.9 + rng() * 0.6);
      s += rc(x - w / 2, y - h / 2, w, h, { stroke: col, sw: 1.5, rot: (rng() - 0.5) * 30 });
    } else if (pick < 0.68) {
      s += dot(x, y, (3 + near * 8 * rng()) * k, col);
    } else if (pick < 0.84) {
      const len = (26 + near * 56 * rng()) * k;
      const a = rng() * Math.PI;
      s += seg(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2,
        x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2, col, 1.5);
    } else {
      const rad2 = (30 + rng() * 70) * k;
      const a0 = rng() * Math.PI * 2;
      s += arc(x, y, rad2, a0, a0 + 0.7 + rng() * 1.5, col, 1.5);
    }
  }
  return s;
}

/* ───────── 構図の土台 ───────── */

/**
 * 記事ごとに構図の土台を決める。中心の位置・大きさ・傾き・要素の多さが記事ごとに変わるので、
 * 同じ型が当たっても同じ絵にはならない。
 */
function stageFrom(rng, W, H) {
  return {
    cx: W * rr(rng, 0.69, 0.83),
    cy: H * rr(rng, 0.38, 0.60),
    k: rr(rng, 0.84, 1.22),       // 大きさの倍率
    tilt: rr(rng, -7, 7),          // 傾き（度）
    minX: W * 0.5,
    dense: rng(),                  // 要素の多さ
    garnish: rng(),                // 散らばる図形を添えるか
    flip: rng() < 0.5 ? 1 : -1,    // 上下の向き
  };
}

/** 傾きをかける */
function tilted(body, g, deg) {
  if (!deg) return body;
  return `<g transform="rotate(${r1(deg)} ${r1(g.cx)} ${r1(g.cy)})">${body}</g>`;
}

/**
 * 散らばる図形の飾り。全部の絵に付けると、型が違っても同じ顔に見えるため、
 * 記事のおよそ4割にだけ、量を変えて付ける。
 */
function garnish(W, H, rng, P, g) {
  if (g.garnish > 0.42) return '';
  return shapeCloud(W * rr(rng, 0.84, 0.93), H * rr(rng, 0.35, 0.65), W * rr(rng, 0.09, 0.17), rng, P,
    { count: ri(rng, 10, 28), minX: W * 0.6, minR: rr(rng, 0.2, 0.5), scale: rr(rng, 0.55, 0.9) });
}

/* ───────── 絵柄の型 ───────── */

/** 節点が右へ広がっていく流れ図 */
function motifFlow(W, H, P, rng, g) {
  const cy = g.cy, k = g.k;
  let s = '';
  let x = Math.max(W * 0.52, g.cx - rr(rng, 190, 260) * k);
  s += dot(x, cy, 5 * k, P.ink);
  const stops = ri(rng, 2, 4);
  const accentAt = ri(rng, 0, stops - 1);
  for (let i = 0; i < stops && x < W * 0.78; i++) {
    const gap = rr(rng, 16, 32) * k;
    s += seg(x, cy, x + gap, cy, P.ink, 1.6);
    x += gap;
    const size = rr(rng, 28, 52) * k;
    s += rc(x, cy - size / 2, size, size, i === accentAt ? { fill: P.accent } : { stroke: P.ink, sw: 1.5 });
    x += size;
  }
  // 束ねた平行線
  const bars = ri(rng, 4, 8);
  const pitch = rr(rng, 7, 12) * k;
  const barLen = rr(rng, 52, 86) * k;
  for (let i = 0; i < bars; i++) {
    const dy = (i - (bars - 1) / 2) * pitch;
    s += seg(x, cy + dy, x + barLen, cy + dy, P.ink, 1.1);
  }
  // 右へ広がる枝
  const fanX = x + barLen;
  const branches = ri(rng, 4, 7);
  for (let i = 0; i < branches; i++) {
    const spread = (i - (branches - 1) / 2) / ((branches - 1) / 2 || 1) * g.flip;
    const fromY = cy + spread * (bars - 1) / 2 * pitch;
    const endX = Math.min(W - 40, fanX + rr(rng, 110, 250) * k);
    const endY = cy + spread * rr(rng, 90, 190) * k;
    s += curve(fanX, fromY, (fanX + endX) / 2, fromY, endX, endY, P.ink, 1.3, i % 2 ? '3 6' : null);
    s += dot(endX, endY, rr(rng, 3.5, 6) * k, i % 3 === 0 ? P.accent : P.ink);
  }
  return s + garnish(W, H, rng, P, g);
}

/** 同心円に矢印が集まる */
function motifRadial(W, H, P, rng, g) {
  const cx = g.cx, cy = g.cy, k = g.k;
  let s = '';
  const rings = ri(rng, 3, 6);
  const step = rr(rng, 26, 42) * k;
  const base = rr(rng, 34, 54) * k;
  const openRings = rng() < 0.4;   // 円を全部は閉じない作り
  for (let i = 0; i < rings; i++) {
    const rad = base + i * step;
    if (openRings) {
      const a0 = rr(rng, -2.6, -0.6);
      s += arc(cx, cy, rad, a0, a0 + rr(rng, 2.6, 5.4), P.ink, 1.3, i % 2 ? '4 7' : null);
    } else {
      s += ring(cx, cy, rad, P.ink, 1.3, i % 2 ? '4 7' : null);
    }
  }
  s += dot(cx, cy, rr(rng, 11, 24) * k, P.accent);
  const arrows = ri(rng, 5, 9);
  const outer = base + (rings - 1) * step;
  const a00 = rng() * Math.PI * 2;
  for (let i = 0; i < arrows; i++) {
    const a = a00 + (i / arrows) * Math.PI * 2 + rr(rng, -0.18, 0.18);
    const from = outer + rr(rng, 55, 140) * k;
    const to = outer + rr(rng, 6, 18) * k;
    const x1 = cx + Math.cos(a) * from, y1 = cy + Math.sin(a) * from;
    const x2 = cx + Math.cos(a) * to, y2 = cy + Math.sin(a) * to;
    if (x1 < W * 0.52 || x1 > W + 30) continue;
    s += curve(x1, y1, (x1 + x2) / 2 + rr(rng, -40, 40), (y1 + y2) / 2 + rr(rng, -40, 40), x2, y2, P.ink, 1.3, i % 2 ? '3 6' : null);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    s += seg(x2, y2, x2 - Math.cos(ang - 0.4) * 11, y2 - Math.sin(ang - 0.4) * 11, P.ink, 1.3);
    s += seg(x2, y2, x2 - Math.cos(ang + 0.4) * 11, y2 - Math.sin(ang + 0.4) * 11, P.ink, 1.3);
  }
  return s + garnish(W, H, rng, P, g);
}

/** 波が重なる */
function motifWave(W, H, P, rng, g) {
  const x0 = W * 0.5;
  const lines = ri(rng, 6, 12);
  const top = H * rr(rng, 0.12, 0.26);
  const span = H * rr(rng, 0.48, 0.72);
  const humps = ri(rng, 3, 6);
  const accentA = ri(rng, 0, lines - 1);
  const accentB = ri(rng, 0, lines - 1);
  let s = '';
  for (let i = 0; i < lines; i++) {
    const y = top + (i / Math.max(1, lines - 1)) * span;
    const amp = rr(rng, 14, 38) * g.k * (1 - Math.abs(i / (lines - 1) - 0.5) * 0.5);
    const blue = i === accentA || i === accentB;
    const w = (W - x0) / humps;
    let d = `M${r1(x0)} ${r1(y)}`;
    for (let m = 0; m < humps; m++) d += ` q${r1(w / 2)} ${r1((m % 2 ? -1 : 1) * amp * g.flip)} ${r1(w)} 0`;
    s += `<path d="${d}" fill="none" stroke="${blue ? P.accent : P.ink}" stroke-width="${blue ? 2 : 1.3}" opacity="${blue ? 1 : 0.75}"${i % 3 === 2 ? ' stroke-dasharray="4 7"' : ''}/>`;
  }
  const nodes = ri(rng, 6, 16);
  for (let i = 0; i < nodes; i++) {
    s += dot(x0 + rng() * (W - x0), top + rng() * span, rr(rng, 3, 8) * g.k, rng() < 0.3 ? P.accent : P.ink);
  }
  return s + garnish(W, H, rng, P, g);
}

/** 細い格子と枝分かれ */
function motifGrid(W, H, P, rng, g) {
  const x0 = W * 0.53;
  const cell = rr(rng, 34, 58);
  const dash = rng() < 0.5 ? '2 6' : '1 5';
  let s = '';
  for (let x = x0; x <= W; x += cell) s += seg(x, H * 0.08, x, H * 0.92, P.ink, 0.8, dash);
  for (let y = H * 0.1; y <= H * 0.92; y += cell) s += seg(x0, y, W, y, P.ink, 0.8, dash);
  let px = x0 + rr(rng, 10, 50), py = H * rr(rng, 0.3, 0.7);
  const steps = ri(rng, 4, 8);
  for (let i = 0; i < steps; i++) {
    const nx = px + rr(rng, 50, 120);
    const ny = Math.min(H * 0.88, Math.max(H * 0.12, py + rr(rng, -130, 130)));
    s += curve(px, py, (px + nx) / 2, py, nx, ny, P.ink, 1.6);
    s += dot(nx, ny, rr(rng, 4, 6.5), i % 2 ? P.accent : P.ink);
    if (nx > W - 70) break;
    px = nx; py = ny;
  }
  // 格子の上に置く塊。散らばる飾りと重ねると画面が騒がしくなるので、数は控えめにする
  const blocks = ri(rng, 3, 8);
  for (let i = 0; i < blocks; i++) {
    const x = x0 + rng() * (W - x0 - 40), y = H * 0.1 + rng() * H * 0.76;
    const sz = rr(rng, 14, 40) * g.k;
    s += rc(x, y, sz, sz, rng() < 0.28 ? { fill: P.accent } : { stroke: P.ink, sw: 1.4 });
  }
  return s;   // 格子そのものが密なので飾りは足さない
}

/** 重なる長方形 */
function motifStack(W, H, P, rng, g) {
  const layers = ri(rng, 3, 6);
  const w0 = rr(rng, 170, 240) * g.k;
  const h0 = rr(rng, 120, 170) * g.k;
  const stepX = rr(rng, 20, 42) * (rng() < 0.5 ? 1 : -1);
  const stepY = rr(rng, 18, 38) * g.flip;
  const accentAt = ri(rng, 0, layers - 1);
  const withLines = rng() < 0.7;
  let s = '';
  for (let i = 0; i < layers; i++) {
    const w = w0 - i * (w0 * 0.08), h = h0 - i * (h0 * 0.08);
    const x = Math.max(W * 0.52, g.cx - w / 2 + (i - (layers - 1) / 2) * stepX);
    const y = g.cy - h / 2 + (i - (layers - 1) / 2) * stepY;
    s += rc(x, y, w, h, i === accentAt ? { fill: P.accent } : { stroke: P.ink, sw: 1.6 });
    if (withLines && i !== accentAt) {
      s += seg(x + 16, y + 26, x + w - 16, y + 26, P.ink, 1.2);
      s += seg(x + 16, y + 44, x + w * 0.6, y + 44, P.ink, 1.2);
    }
  }
  return tilted(s, g, g.tilt * 0.6) + garnish(W, H, rng, P, g);
}

/** 棒が並ぶ（数字・推移） */
function motifBars(W, H, P, rng, g) {
  const n = ri(rng, 6, 13);
  let gap = rr(rng, 6, 16) * g.k;
  let bw = rr(rng, 18, 34) * g.k;
  // 右半分に収まる幅まで縮める（はみ出すとタイトルに重なる）
  const left = W * 0.56, maxSpan = W - 40 - left;
  let span = n * (bw + gap);
  if (span > maxSpan) { const f = maxSpan / span; bw *= f; gap *= f; span = maxSpan; }
  const x0 = Math.max(left, Math.min(W - span - 36, g.cx - span / 2));
  const base = g.cy + rr(rng, 60, 120) * g.k;
  const maxH = rr(rng, 110, 210) * g.k;
  const accentAt = ri(rng, 0, n - 1);
  const trend = rng() < 0.6;
  let s = seg(x0 - 10, base, x0 + span + 6, base, P.ink, 1.4);
  const tops = [];
  for (let i = 0; i < n; i++) {
    const t = 0.3 + 0.7 * Math.abs(Math.sin(i * rr(rng, 0.5, 1.2) + rng()));
    const h = maxH * t;
    const x = x0 + i * (bw + gap);
    tops.push([x + bw / 2, base - h]);
    s += rc(x, base - h, bw, h, i === accentAt ? { fill: P.accent } : { stroke: P.ink, sw: 1.4 });
  }
  if (trend) s += poly(tops, { stroke: P.ink, sw: 1.3, dash: '4 6' });
  if (rng() < 0.5) for (const t of tops) if (rng() < 0.4) s += dot(t[0], t[1], 4 * g.k, P.ink);
  return tilted(s, g, g.tilt * 0.4) + garnish(W, H, rng, P, g);
}

/** 軌道と衛星 */
function motifOrbit(W, H, P, rng, g) {
  const cx = g.cx, cy = g.cy, k = g.k;
  const orbits = ri(rng, 2, 4);
  const rot = rr(rng, -40, 40);
  let s = dot(cx, cy, rr(rng, 10, 20) * k, P.accent);
  s += ring(cx, cy, rr(rng, 26, 40) * k, P.ink, 1.3, '3 6');
  for (let i = 0; i < orbits; i++) {
    const rx = rr(rng, 90, 150) * k + i * rr(rng, 34, 58) * k;
    const ry = rx * rr(rng, 0.42, 0.78);
    const rt = rot + i * rr(rng, 18, 46);
    s += ellipse(cx, cy, rx, ry, rt, P.ink, 1.3, i % 2 ? '5 8' : null);
    const sats = ri(rng, 1, 3);
    for (let j = 0; j < sats; j++) {
      const a = rng() * Math.PI * 2;
      const px = cx + rx * Math.cos(a), py = cy + ry * Math.sin(a);
      const rad = rt * Math.PI / 180;
      const x = cx + (px - cx) * Math.cos(rad) - (py - cy) * Math.sin(rad);
      const y = cy + (px - cx) * Math.sin(rad) + (py - cy) * Math.cos(rad);
      if (x < W * 0.52) continue;
      if (rng() < 0.4) {
        const sz = rr(rng, 16, 30) * k;
        s += rc(x - sz / 2, y - sz / 2, sz, sz, { stroke: P.ink, sw: 1.5, rot: rr(rng, -25, 25) });
      } else {
        s += dot(x, y, rr(rng, 4, 9) * k, rng() < 0.35 ? P.accent : P.ink);
      }
    }
  }
  return s + garnish(W, H, rng, P, g);
}

/** 絞り込まれていく段（反響→来店→申込のような段階） */
function motifFunnel(W, H, P, rng, g) {
  const stages = ri(rng, 3, 5);
  const topW = rr(rng, 230, 310) * g.k;
  const botW = topW * rr(rng, 0.26, 0.5);
  const hStage = rr(rng, 42, 62) * g.k;
  const gapY = rr(rng, 6, 16);
  const totalH = stages * hStage + (stages - 1) * gapY;
  const cx = Math.max(W * 0.52 + topW / 2, g.cx);
  let y = g.cy - totalH / 2;
  const accentAt = ri(rng, 0, stages - 1);
  let s = '';
  for (let i = 0; i < stages; i++) {
    const t0 = i / stages, t1 = (i + 1) / stages;
    const w0 = topW + (botW - topW) * t0;
    const w1 = topW + (botW - topW) * t1;
    const pts = [[cx - w0 / 2, y], [cx + w0 / 2, y], [cx + w1 / 2, y + hStage], [cx - w1 / 2, y + hStage]];
    s += poly(pts, i === accentAt ? { fill: P.accent, close: true } : { stroke: P.ink, sw: 1.5, close: true });
    if (i !== accentAt && rng() < 0.6) s += seg(cx - w1 / 2 + 14, y + hStage / 2, cx - w1 / 2 + 14 + w1 * 0.45, y + hStage / 2, P.ink, 1.1, '3 5');
    y += hStage + gapY;
  }
  // 脇に落ちる点
  const drops = ri(rng, 2, 6);
  for (let i = 0; i < drops; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const dx = cx + side * (topW / 2 + rr(rng, 24, 90));
    const dy = g.cy - totalH / 2 + rng() * totalH;
    if (dx < W * 0.52 || dx > W - 20) continue;
    s += dot(dx, dy, rr(rng, 3, 7) * g.k, P.ink, 0.8);
  }
  return tilted(s, g, g.tilt * 0.5) + garnish(W, H, rng, P, g);
}

/** 等高線のように重なる閉じた線 */
function motifContour(W, H, P, rng, g) {
  const cx = g.cx, cy = g.cy;
  const layers = ri(rng, 4, 8);
  const pts = ri(rng, 7, 11);
  const base = rr(rng, 34, 56) * g.k;
  const step = rr(rng, 16, 28) * g.k;
  const wob = [];
  for (let i = 0; i < pts; i++) wob.push(rr(rng, 0.76, 1.3));
  let s = '';
  for (let L = 0; L < layers; L++) {
    const rad = base + L * step;
    const ring2 = [];
    for (let i = 0; i <= pts; i++) {
      const a = (i % pts) / pts * Math.PI * 2;
      const w = wob[i % pts] * (1 + L * 0.02);
      ring2.push([cx + Math.cos(a) * rad * w * 1.08, cy + Math.sin(a) * rad * w * 0.9]);
    }
    // 角を丸めるため、中点をつないだ曲線にする
    let d = '';
    for (let i = 0; i < ring2.length - 1; i++) {
      const p0 = ring2[i], p1 = ring2[i + 1];
      const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      d += i === 0 ? `M${r1(m[0])} ${r1(m[1])}` : ` Q${r1(p0[0])} ${r1(p0[1])} ${r1(m[0])} ${r1(m[1])}`;
    }
    d += ' Z';
    s += `<path d="${d}" fill="none" stroke="${P.ink}" stroke-width="${L === 0 ? 1.8 : 1.2}" opacity="${0.45 + 0.55 * (1 - L / layers)}"${L % 3 === 2 ? ' stroke-dasharray="5 7"' : ''}/>`;
  }
  s += dot(cx, cy, rr(rng, 9, 18) * g.k, P.accent);
  if (rng() < 0.6) {
    const marks = ri(rng, 2, 5);
    for (let i = 0; i < marks; i++) {
      const a = rng() * Math.PI * 2, rad = base + rng() * layers * step;
      const x = cx + Math.cos(a) * rad * 1.08, y = cy + Math.sin(a) * rad * 0.9;
      if (x < W * 0.52) continue;
      s += seg(x - 7, y, x + 7, y, P.ink, 1.3) + seg(x, y - 7, x, y + 7, P.ink, 1.3);
    }
  }
  return s + garnish(W, H, rng, P, g);
}

/** 点と線のつながり（網） */
function motifMesh(W, H, P, rng, g) {
  const x0 = W * 0.52;
  const n = ri(rng, 10, 20);
  const nodes = [];
  for (let i = 0; i < n; i++) {
    nodes.push([x0 + rng() * (W - x0 - 24), H * rr(rng, 0.1, 0.9)]);
  }
  const reach = rr(rng, 120, 210) * g.k;
  let s = '';
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i][0] - nodes[j][0], dy = nodes[i][1] - nodes[j][1];
      if (Math.hypot(dx, dy) < reach) {
        s += seg(nodes[i][0], nodes[i][1], nodes[j][0], nodes[j][1], P.ink, 1, rng() < 0.3 ? '3 6' : null);
      }
    }
  }
  const accentAt = new Set([ri(rng, 0, n - 1), ri(rng, 0, n - 1)]);
  nodes.forEach((p, i) => {
    if (accentAt.has(i)) s += dot(p[0], p[1], rr(rng, 9, 15) * g.k, P.accent);
    else if (rng() < 0.25) {
      const sz = rr(rng, 16, 28) * g.k;
      s += rc(p[0] - sz / 2, p[1] - sz / 2, sz, sz, { stroke: P.ink, sw: 1.4, rot: rr(rng, -20, 20) });
    } else s += dot(p[0], p[1], rr(rng, 3.5, 7) * g.k, P.ink);
  });
  return s + garnish(W, H, rng, P, g);
}

/** 階段状に積み上がる塊 */
function motifSteps(W, H, P, rng, g) {
  const n = ri(rng, 4, 7);
  let bw = rr(rng, 48, 78) * g.k;
  const rise = rr(rng, 26, 46) * g.k;
  // 棒と同じく、右半分に収まる幅まで縮める
  const left = W * 0.56, maxSpan = W - 40 - left;
  let span = n * bw;
  if (span > maxSpan) { bw = maxSpan / n; span = maxSpan; }
  const x0 = Math.max(left, Math.min(W - span - 36, g.cx - span / 2));
  const base = g.cy + rr(rng, 70, 130) * g.k;
  const up = g.flip;
  const accentAt = ri(rng, 0, n - 1);
  let s = '';
  for (let i = 0; i < n; i++) {
    const h = rise * (i + 1);
    const x = x0 + i * bw;
    const y = up > 0 ? base - h : base - rise * (n - i);
    const hh = up > 0 ? h : rise * (n - i);
    s += rc(x, y, bw - rr(rng, 2, 10), hh, i === accentAt ? { fill: P.accent } : { stroke: P.ink, sw: 1.5 });
  }
  s += seg(x0 - 10, base, x0 + span + 8, base, P.ink, 1.5);
  if (rng() < 0.7) {
    const gp = [];
    for (let i = 0; i <= n; i++) gp.push([x0 + i * bw, (up > 0 ? base - rise * i : base - rise * (n - i + 1))]);
    s += poly(gp, { stroke: P.ink, sw: 1.2, dash: '4 6' });
  }
  return tilted(s, g, g.tilt * 0.4) + garnish(W, H, rng, P, g);
}

/** 同じ大きさの区画が並ぶ（台帳・一覧のイメージ） */
function motifTiles(W, H, P, rng, g) {
  const cols = ri(rng, 3, 6);
  const rows = ri(rng, 3, 5);
  const cell = rr(rng, 44, 78) * g.k;
  const gap = rr(rng, 5, 14);
  let wAll = cols * cell + (cols - 1) * gap;
  const hAll = rows * cell + (rows - 1) * gap;
  // 区画の総幅が右半分に収まらないときは、1区画を小さくする
  const left = W * 0.56, maxW = W - 30 - left;
  let cellW = cell;
  if (wAll > maxW) { cellW = (maxW - (cols - 1) * gap) / cols; wAll = maxW; }
  const x0 = Math.max(left, Math.min(W - wAll - 30, g.cx - wAll / 2));
  const y0 = Math.max(26, Math.min(H - hAll - 26, g.cy - hAll / 2));
  const fillRate = rr(rng, 0.1, 0.3);
  const accentRate = rr(rng, 0.06, 0.18);
  let s = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * (cellW + gap), y = y0 + r * (cell + gap);
      const v = rng();
      if (v < accentRate) s += rc(x, y, cellW, cell, { fill: P.accent });
      else if (v < accentRate + fillRate) s += rc(x, y, cellW, cell, { fill: P.ink, opacity: 0.85 });
      else {
        s += rc(x, y, cellW, cell, { stroke: P.ink, sw: 1.3 });
        if (rng() < 0.45) s += seg(x + 10, y + cell * 0.62, x + cellW - 10, y + cell * 0.62, P.ink, 1, '3 5');
      }
    }
  }
  return tilted(s, g, g.tilt * 0.7) + garnish(W, H, rng, P, g);
}

/** 弧が束になって伸びる（経路・導線） */
function motifArcs(W, H, P, rng, g) {
  const cx = Math.max(W * 0.5, g.cx - rr(rng, 120, 220) * g.k);
  const cy = g.cy;
  const n = ri(rng, 5, 10);
  const base = rr(rng, 70, 120) * g.k;
  const step = rr(rng, 22, 40) * g.k;
  // 弧は必ず右向きに開かせる。向きを反転させると左半分（タイトルの上）まで回り込むため、
  // 上下の違いは開き始めの角度のゆらぎだけで出す。
  const open = rr(rng, 1.0, 2.0);
  const a0 = -open / 2 + rr(rng, -0.3, 0.3) * g.flip;
  const accentAt = ri(rng, 0, n - 1);
  let s = '';
  for (let i = 0; i < n; i++) {
    const rad = base + i * step;
    const col = i === accentAt ? P.accent : P.ink;
    s += arc(cx, cy, rad, a0, a0 + open, col, i === accentAt ? 2.2 : 1.3, i % 3 === 2 ? '5 8' : null);
    if (rng() < 0.4) {
      const a = a0 + open * rng();
      s += dot(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, rr(rng, 3.5, 7) * g.k, col);
    }
  }
  s += dot(cx, cy, rr(rng, 7, 14) * g.k, P.ink);
  return s + garnish(W, H, rng, P, g);
}

const MOTIFS = {
  flow: motifFlow, radial: motifRadial, wave: motifWave, grid: motifGrid, stack: motifStack,
  bars: motifBars, orbit: motifOrbit, funnel: motifFunnel, contour: motifContour,
  mesh: motifMesh, steps: motifSteps, tiles: motifTiles, arcs: motifArcs,
};
const MOTIF_NAMES = Object.keys(MOTIFS);

/**
 * 記事ごとに絵柄の型を割り当てる。
 *
 * 日付で順番に回すと、型の数だけ日が空いたときに同じ型へ戻ってしまう（5種類なら5日後に同じ絵）。
 * ここでは slug から型を選び、直前の記事が使った型（AVOID 件）とは必ず別の型になるまでずらす。
 * 古い記事から順に決めるので、あとで記事が増えても、すでに決まった記事の型は変わらない。
 *
 * @param {{slug:string,date:string}[]} items 記事の一覧（順不同でよい）
 * @param {string} salt ブログごとに違う文字列。同じ日に両ブログが同じ型になるのを防ぐ
 * @returns {Object<string,string>} slug → 型の名前
 */
function assignMotifs(items, salt = '') {
  const AVOID = Math.min(MOTIF_NAMES.length - 1, 7);
  const sorted = (items || []).slice().sort((a, b) =>
    String(a.date).localeCompare(String(b.date)) || String(a.slug).localeCompare(String(b.slug)));
  const out = {};
  const recent = [];
  for (const it of sorted) {
    const h = hashSeed(salt + ':' + it.slug);
    let pick = null;
    for (let i = 0; i < MOTIF_NAMES.length; i++) {
      const cand = MOTIF_NAMES[(h + i) % MOTIF_NAMES.length];
      if (!recent.includes(cand)) { pick = cand; break; }
    }
    if (!pick) pick = MOTIF_NAMES[h % MOTIF_NAMES.length];
    out[it.slug] = pick;
    recent.push(pick);
    if (recent.length > AVOID) recent.shift();
  }
  return out;
}

/**
 * 背景の絵柄を描く。
 * seed が同じなら毎回同じ絵になる。motif を省くと seed から選ぶ。
 */
function artworkSVG(W, H, P, opts = {}) {
  const seed = opts.seed || 'teneramente';
  const rng = rngFrom(seed);
  const name = MOTIFS[opts.motif] ? opts.motif : MOTIF_NAMES[hashSeed(seed) % MOTIF_NAMES.length];
  const bg = paper(W, H, P, rng);
  const stage = stageFrom(rng, W, H);
  return bg + MOTIFS[name](W, H, P, rng, stage);
}

module.exports = { artworkSVG, MOTIF_NAMES, assignMotifs, rngFrom, hashSeed };
