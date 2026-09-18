#!/usr/bin/env node
/**
 * seo-queue.js — 狙いキーワードの待ち行列を操作する。
 *
 *   node scripts/seo-queue.js next                次の todo を1件（JSON）表示。無ければ何も出さない
 *   node scripts/seo-queue.js done <id> <slug>    その id を done にし、記事 slug と日付を記録する。
 *                                                 ChatGPT で作った画像の在庫（coverImage）があれば、
 *                                                 その記事のカバーとして covers/<slug>.png にコピーする
 *   node scripts/seo-queue.js upcoming [n]        次の n 件（既定3）を、画像の在庫の有無つきで JSON 表示
 *   node scripts/seo-queue.js list                全件を状態つきで表示
 *   node scripts/seo-queue.js remaining           todo の件数だけ表示
 *
 *   --site=mieroom を付けると data/seo-keywords-mieroom.json（ミエルーム ブログ用）を操作する。
 *   省略時は data/seo-keywords.json（TENERAMENTE ブログ用）。
 *
 * 画像の在庫は scripts/place-ai-cover.py が作る（assets/img/cover-queue/<id>.png、
 * ミエルームは mieroom/assets/cover-queue/<id>.png）。在庫がある項目には coverTitle が入っていて、
 * 記事のタイトルはそれと一字一句同じにする（画像にそのタイトルが描かれているため）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const siteArg = argv.find(a => a.startsWith('--site='));
const site = siteArg ? siteArg.replace('--site=', '') : 'teneramente';
const args = argv.filter(a => !a.startsWith('--'));
const FILE = path.join(ROOT, 'data', site === 'mieroom' ? 'seo-keywords-mieroom.json' : 'seo-keywords.json');
// 記事のカバーの置き場所。ビルドはここに画像があれば作り直さない
const COVER_DIR = site === 'mieroom'
  ? path.join(ROOT, 'mieroom', 'assets', 'covers')
  : path.join(ROOT, 'assets', 'img', 'covers');

const q = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const cmd = args[0];
const hasStock = it => !!(it.coverImage && fs.existsSync(path.join(ROOT, it.coverImage)));

if (cmd === 'next') {
  const it = q.items.find(i => i.status === 'todo');
  if (it) console.log(JSON.stringify(it, null, 2));
} else if (cmd === 'done') {
  const [, id, slug] = args;
  const it = q.items.find(i => i.id === id);
  if (!it) { console.error(`id が見つかりません: ${id}`); process.exit(1); }
  it.status = 'done';
  it.slug = slug || it.slug || '';
  it.doneAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(FILE, JSON.stringify(q, null, 2) + '\n', 'utf8');
  console.log(`✓ ${id} を消し込みました → ${it.slug}`);
  if (it.slug && hasStock(it)) {
    fs.mkdirSync(COVER_DIR, { recursive: true });
    const dest = path.join(COVER_DIR, `${it.slug}.png`);
    fs.copyFileSync(path.join(ROOT, it.coverImage), dest);
    console.log(`✓ ChatGPT で作ったカバーを使います → ${path.relative(ROOT, dest).replace(/\\/g, '/')}`);
  }
} else if (cmd === 'upcoming') {
  const n = parseInt(args[1], 10) || 3;
  const list = q.items.filter(i => i.status === 'todo').slice(0, n)
    .map(i => ({ id: i.id, category: i.category, keyword: i.keyword, sub: i.sub, title: i.title, intent: i.intent,
      coverTitle: i.coverTitle || '', hasCover: hasStock(i) }));
  console.log(JSON.stringify(list, null, 2));
} else if (cmd === 'list') {
  q.items.forEach(i => console.log(`${i.status.padEnd(4)} ${i.id.padEnd(6)} ${i.category.padEnd(6)} ${i.keyword}${i.slug ? '  → ' + i.slug : ''}${hasStock(i) && i.status === 'todo' ? '  [画像あり]' : ''}`));
} else if (cmd === 'remaining') {
  console.log(q.items.filter(i => i.status === 'todo').length);
} else {
  console.log('usage: seo-queue.js next | done <id> <slug> | upcoming [n] | list | remaining   [--site=mieroom]');
}
