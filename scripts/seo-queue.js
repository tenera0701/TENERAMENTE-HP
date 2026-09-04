#!/usr/bin/env node
/**
 * seo-queue.js — 狙いキーワードの待ち行列を操作する。
 *
 *   node scripts/seo-queue.js next                     次の todo を1件（JSON）表示。無ければ何も出さない
 *   node scripts/seo-queue.js done <id> <slug>         その id を done にし、記事 slug と日付を記録する
 *   node scripts/seo-queue.js list                     全件を状態つきで表示
 *   node scripts/seo-queue.js remaining                todo の件数だけ表示
 *
 *   --site=mieroom を付けると data/seo-keywords-mieroom.json（ミエルーム ブログ用）を操作する。
 *   省略時は data/seo-keywords.json（TENERAMENTE ブログ用）。
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const siteArg = argv.find(a => a.startsWith('--site='));
const site = siteArg ? siteArg.replace('--site=', '') : 'teneramente';
const args = argv.filter(a => !a.startsWith('--'));
const FILE = path.join(__dirname, '..', 'data', site === 'mieroom' ? 'seo-keywords-mieroom.json' : 'seo-keywords.json');

const q = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const cmd = args[0];

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
} else if (cmd === 'list') {
  q.items.forEach(i => console.log(`${i.status.padEnd(4)} ${i.id.padEnd(6)} ${i.category.padEnd(6)} ${i.keyword}${i.slug ? '  → ' + i.slug : ''}`));
} else if (cmd === 'remaining') {
  console.log(q.items.filter(i => i.status === 'todo').length);
} else {
  console.log('usage: seo-queue.js next | done <id> <slug> | list | remaining   [--site=mieroom]');
}
