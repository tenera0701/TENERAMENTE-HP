#!/usr/bin/env node
/**
 * カバー画像まわりの共通ユーティリティ。
 *
 * 以前は gen-covers.js に直接書いていたものを、レイアウト集（cover-layouts.js）からも
 * 使えるように切り出した。gen-covers.js は互換のためここの関数をそのまま再エクスポートする。
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

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 全角=1、半角=0.55 として文字列の見た目の幅を概算する */
function textWidth(t) {
  return [...String(t)].reduce((w, c) => w + (c.charCodeAt(0) < 256 ? 0.55 : 1), 0);
}

/** 文字の種類。改行位置の良し悪しを見るのに使う */
function charKind(ch) {
  if (/[ぁ-ゖ]/.test(ch)) return 'hira';
  if (/[ァ-ヺーｦ-ﾟ]/.test(ch)) return 'kata';
  if (/[\u4E00-\u9FFF々〆]/.test(ch)) return 'kanji';
  if (/[\x20-\x7E]/.test(ch)) return 'ascii';
  return 'other';
}

/**
 * 行末 prev / 行頭 next で折ったときの自然さ。大きいほど良い改行位置。
 * 熟語・カタカナ語・かなの途中で折れるのを避け、区切り記号や助詞のあとで折る。
 */
function breakScore(prev, next) {
  if (!prev || !next) return 0;
  if ('｜|／/'.includes(prev)) return 100;
  if ('、。，．！？'.includes(prev)) return 90;
  if ('）」』】〉》'.includes(prev)) return 60;
  if (prev === '・') return 10;
  const a = charKind(prev), b = charKind(next);
  if (a === 'hira' && b !== 'hira') return 50;
  if (a === 'kanji' && b === 'hira') return 10;
  if (a === 'kata' && b === 'kata') return -60;
  if (a === 'ascii' && b === 'ascii') return -60;
  if (a === 'kanji' && b === 'kanji') return -40;
  if (a === 'hira' && b === 'hira') return -25;
  return 0;
}

/**
 * タイトルを折り返す（全角=1、半角=0.55として概算）。
 * 先に行数を決めてから各行の幅をそろえるので、最終行に1文字だけ残らない。
 * 幅がほぼ同じ候補が並ぶときは breakScore の高い位置、つまり語の切れ目で折る。
 */
function wrapTitle(title, perLine = 16, maxLines = 3) {
  const tokens = String(title).match(/[\x20-\x7E]+|./gu) || [];
  if (!tokens.length) return [];
  const widths = tokens.map(textWidth);
  const total = widths.reduce((a, b) => a + b, 0);
  const NO_HEAD = '・、。？！…」』】〉》）｜';
  const NO_TAIL = '「『【（〈《“';

  // 行数を先に決める。わずかな超過で1行増えるのを防ぐため少しだけ許容する
  let n = 1;
  while (n < maxLines && total / n > perLine * 1.15) n++;
  const maxW = Math.max(perLine * 1.35, total / n);

  const lines = [];
  let i = 0;
  for (let ln = 0; ln < n && i < tokens.length; ln++) {
    if (ln === n - 1) { lines.push(tokens.slice(i).join('')); i = tokens.length; break; }
    let rest = 0;
    for (let k = i; k < tokens.length; k++) rest += widths[k];
    const tgt = rest / (n - ln);
    let best = -1, bestScore = -Infinity, fallback = i, w = 0;
    for (let j = i; j < tokens.length - 1; j++) {
      w += widths[j];
      if (w > maxW) break;
      fallback = j;
      const head = tokens[j + 1][0];
      const tail = tokens[j].slice(-1);
      if (NO_HEAD.includes(head) || NO_TAIL.includes(tail)) continue;
      const dev = Math.abs(w - tgt);
      if (dev > 2.6) { if (w < tgt) continue; else break; }
      const s = breakScore(tail, head) - dev * 12;
      if (s > bestScore) { bestScore = s; best = j; }
    }
    if (best < 0) best = fallback;
    lines.push(tokens.slice(i, best + 1).join(''));
    i = best + 1;
  }

  // 収まりきらない分は最終行を詰めて…にする
  const last = lines.length - 1;
  if (last >= 0 && textWidth(lines[last]) > perLine * 1.6) {
    const cs = [...lines[last]];
    while (cs.length > 1 && textWidth(cs.join('')) + 1 > perLine * 1.6) cs.pop();
    lines[last] = cs.join('') + '…';
  }
  return lines;
}

module.exports = { TOOLS, loadResvg, fontFiles, escXml, wrapTitle, textWidth };
