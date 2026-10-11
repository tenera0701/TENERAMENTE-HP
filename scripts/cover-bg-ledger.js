/**
 * カバーの背景画像の使用台帳。
 * 背景の絵柄は 1 記事につき 1 回だけ使う（一度使った絵柄は、ほかの記事には二度と使わない）。
 * 台帳（data/cover-bg-used*.json）に「絵柄の名前 → 使った記事の slug」を残し、コミットして持ち越す。
 * 空いている絵柄が無くなったら、その記事は slug から描くコード生成の絵（記事ごとに違う絵）になる。
 */
const fs = require('fs');
const path = require('path');

function open(file) {
  let map = {};
  try { map = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { map = {}; }
  let dirty = false;
  return {
    /** その記事が使っている絵柄（無ければ null） */
    owned(slug) { return Object.keys(map).find(k => map[k] === slug) || null; },
    /** 候補を上から見て、まだ誰も使っていない絵柄を1つその記事に割り当てる */
    take(slug, candidates) {
      const cur = this.owned(slug);
      if (cur) return cur;
      for (const c of candidates) {
        if (c && !(c in map)) { map[c] = slug; dirty = true; return c; }
      }
      return null;
    },
    save() {
      if (!dirty) return;
      const sorted = {};
      Object.keys(map).sort().forEach(k => { sorted[k] = map[k]; });
      fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
      dirty = false;
    },
  };
}

/** 背景フォルダにある絵柄の名前一覧（拡張子なし・名前順） */
function listBgs(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir)
    .filter(f => exts.includes(path.extname(f).toLowerCase()))
    .map(f => f.replace(/\.[^.]+$/, ''));
  return Array.from(new Set(names)).sort();
}

/**
 * まだカバーが無い記事に絵柄を割り当てる。
 *   1. 記事専用の絵柄（own(post) が返す名前）を先に、その記事に渡す
 *   2. 残りの空いている絵柄を、古い記事から順に1枚ずつ渡す
 * どこかの記事の専用に指定されている絵柄は 2 では使わない。
 */
function assign(ledger, needing, pool, own) {
  const byAge = needing.slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const reserved = new Set();
  byAge.forEach(p => { const n = own(p); if (n) reserved.add(n); });
  // 同じ専用の絵柄が複数の記事に指定されていても、使えるのは一番古い記事だけ
  byAge.forEach(p => { const n = own(p); if (n) ledger.take(p.slug, [n]); });
  const free = pool.filter(n => !reserved.has(n));
  byAge.forEach(p => ledger.take(p.slug, free));
}

module.exports = { open, listBgs, assign };
