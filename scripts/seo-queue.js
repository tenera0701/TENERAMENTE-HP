#!/usr/bin/env node
/**
 * seo-queue.js — 毎日の自動投稿が使う「狙いキーワードの待ち行列」（data/seo-keywords.json）を操作する。
 *
 *   node scripts/seo-queue.js next              … 次に書くキーワード1件を JSON で表示（無ければ何も出さず終了コード 0）
 *   node scripts/seo-queue.js done <id> <slug>  … そのキーワードを消し込む（status=done, slug, doneAt を記録）
 *   node scripts/seo-queue.js list              … 全件の状態を一覧
 *   node scripts/seo-queue.js remaining         … 未消化の件数を表示
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'seo-keywords.json');
const q = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const items = Array.isArray(q.items) ? q.items : [];
const cmd = process.argv[2];

if (cmd === 'next') {
  const it = items.find(i => i.status === 'todo');
  if (it) console.log(JSON.stringify(it, null, 2));
} else if (cmd === 'done') {
  const [id, slug] = process.argv.slice(3);
  const it = items.find(i => i.id === id);
  if (!it) { console.error(`id が見つかりません: ${id}`); process.exit(1); }
  it.status = 'done';
  it.slug = slug || it.slug || '';
  it.doneAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(FILE, JSON.stringify(q, null, 2) + '\n');
  console.log(`✓ ${id} を消し込みました → ${it.slug}`);
} else if (cmd === 'list') {
  items.forEach(i => console.log(`${i.status.padEnd(4)} ${i.id} ${i.category.padEnd(4)} ${i.keyword}${i.slug ? '  → ' + i.slug : ''}`));
} else if (cmd === 'remaining') {
  console.log(items.filter(i => i.status === 'todo').length);
} else {
  console.log('usage: node scripts/seo-queue.js next | done <id> <slug> | list | remaining');
}
