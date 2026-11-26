#!/usr/bin/env node
/**
 * mieroom.cloud に載せる一式を作る。元はこのリポジトリの mieroom/ フォルダで、直す場所は今までどおり。
 * .github/workflows/publish-mieroom-site.yml が main への push のたびに実行し、公開用リポジトリ（tenera0701/mieroom-site）へ送る。
 *
 *   使い方: node scripts/build-mieroom-site.js <出力先フォルダ>
 *
 * mieroom/ をサイトの一番上に置き直すので、次の3つを変換する。
 *   ・https://teneramente.jp/mieroom/… → https://mieroom.cloud/…
 *   ・mieroom/ の外を指す相対リンク（運営会社・プライバシーポリシー）→ teneramente.jp の絶対URL
 *   ・旧URLから新URLへ送るスクリプト（<script data-moved>）は新サイトでは要らないので外す
 * assets/milpage.js と assets/analytics.js は mieroom/ の外にあるが、新サイトでも動かすのでコピーする。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'mieroom');
const NEW = 'https://mieroom.cloud';
const OLD = 'https://teneramente.jp';
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!OUT) { console.error('使い方: node scripts/build-mieroom-site.js <出力先フォルダ>'); process.exit(1); }

// 載せないもの（下書き・記事の元原稿・もう使っていない旧ページ）
const SKIP = new Set(['drafts', 'posts', 'publish', 'uploads', 'ミエルーム_公開用.html', 'desktop.ini']);
// mieroom/ の外にあるが、新サイトにも同じ位置（/assets/…）で置くファイル
const SHARED = ['assets/milpage.js', 'assets/analytics.js'];

function fixLinks(html, dir) {
  return html.replace(/\b(href|src|action)="(\.\.\/[^"#?]*)([^"]*)"/g, (all, attr, url, rest) => {
    const to = path.posix.normalize(path.posix.join(dir, url));
    if (to === 'mieroom' || to.startsWith('mieroom/')) return all;
    if (SHARED.includes(to)) return `${attr}="${path.posix.relative(dir.replace(/^mieroom\/?/, '') || '.', to)}${rest}"`;
    return `${attr}="${OLD}/${to === 'index.html' ? '' : to}${rest}"`;
  });
}

// ミエルームの「HP連携」（株式会社デモのアカウント）でこのサイトのアクセス・ヒートマップを見るためのタグ（2026-11-26 社長の指示）。
// 合言葉はページのソースに出るもの（秘密ではない）。数えるのは mieroom.cloud から届いたものだけ（ミエルーム側で決めている）
const HP_TAG = '<script src="https://app.mieroom.cloud/hp-t/ERteAwdkksu72KYeq9Esbo6H.js" async data-mieroom-hp></script>';

function addHpTag(html) {
  if (html.includes('data-mieroom-hp') || !/<\/head>/i.test(html)) return html;
  return html.replace(/<\/head>/i, HP_TAG + '\n</head>');
}

function convert(html, dir) {
  return addHpTag(fixLinks(html, dir)
    .replace(/<script data-moved>[\s\S]*?<\/script>\r?\n?/g, '')
    .replace(/<meta http-equiv="refresh"[^>]*data-moved>\r?\n?/g, '')
    .replace(/https:\/\/teneramente\.jp\/mieroom(?=[/"'\s<])\/?/g, `${NEW}/`));
}

let pages = 0;
function copyTree(from, to, dir) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (SKIP.has(name)) continue;
    const a = path.join(from, name);
    const b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) { copyTree(a, b, `${dir}/${name}`); continue; }
    if (name.endsWith('.html')) { fs.writeFileSync(b, convert(fs.readFileSync(a, 'utf8'), dir), 'utf8'); pages++; continue; }
    fs.copyFileSync(a, b);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
copyTree(SRC, OUT, 'mieroom');

for (const f of SHARED) {
  const b = path.join(OUT, f);
  if (fs.existsSync(b)) { console.error(`同じ名前のファイルがあります: ${f}`); process.exit(1); }
  fs.copyFileSync(path.join(ROOT, f), b);
}

fs.writeFileSync(path.join(OUT, 'CNAME'), 'mieroom.cloud\n', 'utf8');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8');
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *
Allow: /

# 資料請求のあとに配る PDF（request.html から入ってもらう）
Disallow: /assets/docs/mieroom-overview.pdf

Sitemap: ${NEW}/sitemap.xml
`, 'utf8');
fs.writeFileSync(path.join(OUT, '404.html'), `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>ページが見つかりません｜ミエルーム</title>
<link rel="icon" type="image/png" href="/assets/logo-mark-sm.png">
<link rel="stylesheet" href="/assets/site.css">
</head><body style="display:grid;place-items:center;min-height:100vh;padding:24px;text-align:center">
<main><h1 style="font-size:24px;margin:0 0 12px">ページが見つかりません</h1>
<p style="margin:0 0 24px">移動または削除された可能性があります。</p>
<a class="btn btn-primary" href="/">ミエルームのトップへ</a></main>
</body></html>
`, 'utf8');

// 壊れた一式で本番を上書きしないための安全弁
if (!fs.existsSync(path.join(OUT, 'index.html')) || !fs.existsSync(path.join(OUT, 'sitemap.xml')) || pages < 50) {
  console.error(`一式が足りません（ページ数 ${pages}）。公開を止めます`);
  process.exit(1);
}
console.log(`✓ mieroom.cloud 用の一式を作りました（${pages}ページ）: ${OUT}`);
