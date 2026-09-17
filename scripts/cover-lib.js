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

// タイトルを最大 maxLines 行に折り返す(全角=1、半角=0.55として概算)
// 半角英数の連続(例: 2026, Google)は途中で改行せず、行頭禁則(・、。など)も避ける
function wrapTitle(title, perLine = 16, maxLines = 3) {
  const tokens = String(title).match(/[\x20-\x7E]+|./gu) || [];
  const NO_HEAD = '・、。？！…」』】〉》）';
  const lines = [];
  let line = '', w = 0, truncated = false;
  for (const tk of tokens) {
    const tw = textWidth(tk);
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
    if (textWidth(last) + 1 > perLine) last = [...last].slice(0, -1).join('');
    lines[lines.length - 1] = last + '…';
  }
  return lines;
}

module.exports = { TOOLS, loadResvg, fontFiles, escXml, wrapTitle, textWidth };
