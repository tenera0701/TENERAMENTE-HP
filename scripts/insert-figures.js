#!/usr/bin/env node
/**
 * data/figures.json の図版を、記事の本文に差し込む。
 *
 *   node scripts/insert-figures.js
 *
 * 入れる場所は figures.json の anchor（H2 の見出し文）の、最初の段落の直後。
 * すでに同じ図版が入っている記事は飛ばすので、何度実行しても増えない。
 * ミエルーム側の変換器は「行頭が < の行」をそのまま通すので、figure は1行で書く。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** PNG の幅と高さを読む */
function pngSize(file) {
  const b = fs.readFileSync(file).subarray(0, 26);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function main() {
  const figures = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'figures.json'), 'utf8')).figures;
  let added = 0, skipped = 0;
  for (const f of figures) {
    const mdPath = path.join(ROOT, f.article);
    const pngPath = f.site === 'mieroom'
      ? path.join(ROOT, 'mieroom', 'assets', 'figures', f.id + '.png')
      : path.join(ROOT, 'assets', 'img', 'figures', f.id + '.png');
    if (!fs.existsSync(mdPath)) { console.warn('△ 記事が見つかりません: ' + f.article); continue; }
    if (!fs.existsSync(pngPath)) { console.warn('△ 画像が見つかりません: ' + f.id); continue; }

    const src = f.site === 'mieroom' ? '../assets/figures/' + f.id + '.png' : 'assets/img/figures/' + f.id + '.png';
    const md = fs.readFileSync(mdPath, 'utf8');
    if (md.includes(src)) { skipped++; continue; }

    const { w, h } = pngSize(pngPath);
    const html = '<figure class="fig"><img src="' + src + '" alt="' + esc(f.alt) + '" width="' + w + '" height="' + h
      + '" loading="lazy" decoding="async"><figcaption>' + esc(f.caption) + '</figcaption></figure>';

    const lines = md.replace(/\r/g, '').split('\n');
    const at = lines.findIndex(l => l.trim() === '## ' + f.anchor);
    if (at < 0) { console.warn('△ 見出しが見つかりません: ' + f.anchor + '（' + f.article + '）'); continue; }

    // 見出しの次の段落の終わりを探す
    let i = at + 1;
    while (i < lines.length && !lines[i].trim()) i++;
    while (i < lines.length && lines[i].trim()) i++;

    lines.splice(i, 0, '', html);
    fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');
    added++;
  }
  console.log('✓ 図版を' + added + '本の記事に差し込みました（すでに入っていた記事: ' + skipped + '）');
}

if (require.main === module) main();
