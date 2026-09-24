/**
 * ミエルーム「機能の使い方」ページを作る
 * ------------------------------------------------------------------
 *   中身  : scripts/mieroom-guide-data.js（16機能ぶん。出典はアプリの使い方ガイドだけ）
 *   画像  : mieroom/assets/guide/<名前>.webp（scripts/make-mieroom-guide-shots.py で切り出し）
 *   出力  : mieroom/guide/<slug>.html ＋ SNS用の画像 mieroom/assets/guide/og/<slug>.jpg
 *   入口  : トップ（mieroom/index.html）の「主要機能」16カードから各ページへリンク
 *
 * 使い方: node scripts/build-mieroom-guide.js
 * 毎朝の自動投稿（build-mieroom.js / build-index.js）とは別。中身を直したときだけ手で実行する。
 * sitemap.xml への掲載は build-index.js が mieroom/guide/*.html を拾って行う。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE_URL = 'https://teneramente.jp';
const OUT_DIR = path.join(ROOT, 'mieroom', 'guide');
const SHOT_DIR = path.join(ROOT, 'mieroom', 'assets', 'guide');
const OG_DIR = path.join(SHOT_DIR, 'og');
const FEATURES = require('./mieroom-guide-data');
const PUBLISHED = '2026-09-24';   // 構造化データの公開日（中身を大きく直したら MODIFIED を更新）
const MODIFIED = '2026-09-24';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 日本語のぶら下がり防止：文末の4文字（「。」「？」で終わる文は3文字＋句点）以上を、文節の切れ目からひと固まり（折り返さない）にして、
 *  「す。」「集計。」だけが次の行に落ちるのを防ぐ。
 *  切れ目はまず「、」の後ろ・「（」の前・助詞（を に で が… から より）の後ろで探し、無ければ「・」「／」「〜した／〜する」の後ろで探す。
 *  単語の途中で固めると、そこが折り返し位置になって「お問い／合わせ」のように割れるため、切れ目が無ければ何もしない */
const OG_TAIL = '。、」』）!?！？';
const og = s => {
  const t = String(s == null ? '' : s).replace(/\s+$/, '');
  const ch = Array.from(t);
  let end = ch.length;
  while (end > 0 && OG_TAIL.includes(ch[end - 1])) end--;
  if (end < 7) return esc(t);
  const min = /[。？！?!]$/.test(t) ? 3 : 4;   // 文末が「。」「？」なら「出ます。」の3文字＋句点までを最小の固まりにする（長すぎる固まりの手前に短い行ができるのを減らす）
  const pm = t.match(/（[^（）]{1,12}）[。、]?$/);   // 末尾の「（最初の1回だけ）」などは、かっこごとひと固まりにする
  if (pm && pm.index > 0) return esc(t.slice(0, pm.index)) + `<span class="og">${esc(pm[0])}</span>`;
  for (const weak of [false, true]) {
    for (let i = end - min; i >= Math.max(1, end - 14); i--) {
      const prev = ch[i - 1], next = ch[i], hira = /[ぁ-ゟ]/.test(next);
      if ('」』）'.includes(prev) && hira) continue;                  // 「既読」／で出ます、のように閉じかっこと助詞の間では切らない
      if (prev === 'の' && 'そこあど'.includes(ch[i - 2])) continue;   // その／他費用、その／場で、のように割らない
      const cut = weak
        ? '・／'.includes(prev) || ('たる'.includes(prev) && /[一-鿿゠-ヿ]/.test(next))   // 目標・／達成率、逆算した／期限
        : '、。」』） ›'.includes(prev) || '「（『'.includes(next)   // 半角スペースと「›」の後ろも切れ目（営業資料作成 › ／マイソクを作成）
          || ('をにでがはのともへや'.includes(prev) && (!hira || 'おご'.includes(next)   // 次がひらがなのときは切らない（「できます」の「で」など。「お問い合わせ」「ご利用」の お・ご は切ってよい）
            || 'をは'.includes(prev)))                                              // を・は はいつも助詞なので、次がひらがなでも切ってよい（LINEとは／つなげますか）
          || (['その', 'この'].includes(next + (ch[i + 1] || '')) && 'をにでがはともへやて'.includes(prev))   // お客様を／その場で確認、撮って／そのまま（「など／の」「横／の」は割らない）
          || (['から', 'より'].includes((ch[i - 2] || '') + prev) && !hira)         // どこから／集まりますか
          || (next + (ch[i + 1] || '') === 'こと' && /[ぁ-ゟ]/.test(prev));          // 入れる／こともできます（「から／直接入れることもできます。」の長い固まりを避ける）
      if (cut) return esc(ch.slice(0, i).join('')) + `<span class="og">${esc(ch.slice(i).join(''))}</span>`;
    }
  }
  return esc(t);
};

/** 関連機能の名前：切れ目の前も固まりにして、折り返す場所を文節の切れ目1か所だけにする（Safari の「契約書類｜の自動作成」を防ぐ） */
const ogName = s => {
  const h = og(s);
  const i = h.indexOf('<span class="og">');
  return i > 0 ? '<span class="og">' + h.slice(0, i) + '</span>' + h.slice(i) : h;
};

/** 画像の縦横（HTML の width/height に入れて、読み込み中のガタつきを防ぐ） */
function imgSize(file) {
  const b = fs.readFileSync(file);
  // WebP: VP8 / VP8L / VP8X の3形式
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === 'VP8L') {
    const n = b.readUInt32LE(21);
    return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  throw new Error('WebP の大きさを読めません: ' + file);
}

function shot(name, alt, cls, eager) {
  const file = path.join(SHOT_DIR, name + '.webp');
  if (!fs.existsSync(file)) throw new Error('画像がありません: ' + file);
  const { w, h } = imgSize(file);
  const tall = h > w * 1.2 ? ' g-shot--tall' : '';   // スマホの縦長の画面だけ細く出す
  return `<figure class="g-shot${tall}${cls ? ' ' + cls : ''}"><a href="../assets/guide/${name}.webp" target="_blank" rel="noopener" title="画像を大きく開く"><img src="../assets/guide/${name}.webp" alt="${esc(alt)}" width="${w}" height="${h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></a></figure>`;
}

/** SNS で共有されたときの画像（WebP を読めない SNS があるので JPEG で作る）。
 *  見出し画像を別の画像に替えたときも取りこぼさないよう、毎回ぜんぶ作り直す（中身が同じなら同じファイルになる） */
function makeOgAll(features) {
  fs.mkdirSync(OG_DIR, { recursive: true });
  const args = features.flatMap(p => [path.join(SHOT_DIR, p.hero + '.webp'), path.join(OG_DIR, p.slug + '.jpg')]);
  const py = [
    'import sys',
    'from PIL import Image',
    'a = sys.argv[1:]',
    'for src, out in zip(a[0::2], a[1::2]):',
    '    im = Image.open(src).convert("RGB")',
    '    W, H = 1200, 630',
    '    r = max(W / im.width, H / im.height)',
    '    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)',
    '    im = im.crop((0, 0, W, H))',
    '    im.save(out, "JPEG", quality=82, optimize=True)',
  ].join('\n');
  for (const cmd of ['python', 'python3']) {
    try { execFileSync(cmd, ['-c', py, ...args], { stdio: 'ignore' }); return; } catch (e) { /* 次へ */ }
  }
  console.warn('△ SNS用の画像を作れませんでした（Python/Pillow が必要）');
}

function pageHtml(p) {
  const url = `${SITE_URL}/mieroom/guide/${p.slug}.html`;
  const ogUrl = `${SITE_URL}/mieroom/assets/guide/og/${p.slug}.jpg`;
  const bySlug = Object.fromEntries(FEATURES.map(f => [f.slug, f]));
  const related = p.related.map(s => bySlug[s]).filter(Boolean);
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ミエルーム', item: `${SITE_URL}/mieroom/` },
        { '@type': 'ListItem', position: 2, name: '主要機能', item: `${SITE_URL}/mieroom/#features` },
        { '@type': 'ListItem', position: 3, name: `${p.name}の使い方`, item: url },
      ],
    },
    {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: p.title, description: p.description, image: ogUrl,
      inLanguage: 'ja', mainEntityOfPage: url, datePublished: PUBLISHED, dateModified: MODIFIED,
      author: { '@type': 'Organization', name: 'ミエルーム編集部' },
      publisher: {
        '@type': 'Organization', name: '株式会社TENERAMENTE',
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/img/favicon-512.png` },
      },
    },
  ];
  const ldJson = JSON.stringify(ld).replace(/</g, '\\u003c');

  const steps = p.steps.map((s, i) => `      <li class="g-step">
        <span class="g-num">${i + 1}</span>
        <div class="g-step-body">
          <h3>${og(s.t)}</h3>
          <p>${og(s.d)}</p>
          ${s.img && s.img !== p.hero ? shot(s.img, `${p.name}：${s.t}（デモ画面）`) : ''}
        </div>
      </li>`).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.title)}｜ミエルーム</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="ミエルーム">
<meta property="og:image" content="${ogUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/site.css">
<link rel="stylesheet" href="../assets/guide.css">
<link rel="icon" type="image/png" href="../assets/logo-mark-sm.png">
<link rel="apple-touch-icon" href="../assets/logo-mark-sm.png">
<script type="application/ld+json">${ldJson}</script>
<style id="mp-nav-fit">
/* 狭い画面ではヘッダーのボタンを小さくして、右にはみ出さないようにする */
@media (max-width: 640px) {
  .nav-cta { gap: 6px; }
  .nav-cta .btn { padding: 9px 11px; font-size: 13px; }
}
</style>
</head>
<body>

<header class="site">
  <div class="wrap nav">
    <a class="brand" href="../index.html">
      <img class="logo" src="../assets/logo-mark-sm.webp" alt="ミエルーム">
      <span class="name"><b>ミエ</b><i>ルーム</i></span>
    </a>
    <nav class="nav-links">
      <a href="../index.html">ホーム</a>
      <a href="../features.html" class="on">機能・事例</a>
      <a href="../compare.html">比較</a>
      <a href="../blog.html">ブログ</a>
      <a href="../index.html#faq">料金</a>
    </nav>
    <div class="nav-cta">
      <a class="btn btn-ghost" href="https://app.mieroom.cloud/app-login" style="border-color:transparent;opacity:.8">ログイン</a>
      <a class="btn btn-ghost" href="https://app.mieroom.cloud/apply" target="_blank" rel="noopener"><span>無料デモ<span class="lbl-full">アカウント発行</span></span></a>
      <a class="btn btn-line" href="https://line-harness.teneramente0701.workers.dev/r/lp" target="_blank" rel="noopener"><svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 5.7 2 10.3c0 4.1 3.6 7.5 8.5 8.1.3.1.8.2.9.5.1.3.1.7 0 1l-.1.8c-.1.4-.4 1.5 1.3.8s8.9-5.2 12.1-9c2.2-2.4-1.2-10.3-12.7-10.3Z"/></svg>LINEで相談</a>
    </div>
  </div>
</header>
<article class="g-page">
<section class="post-hero">
  <span class="blob" style="width:240px;height:240px;top:-70px;right:-40px;background:radial-gradient(circle,#74d3bd,#bdeede);opacity:.5;animation:sway 9s ease-in-out infinite"></span>
  <div class="wrap">
    <div class="post-narrow">
      <nav class="crumb" aria-label="パンくずリスト">
        <a href="../index.html">ホーム</a><span class="sep">/</span>
        <a href="../index.html#features">主要機能</a><span class="sep">/</span>
        <span>${esc(p.name)}</span>
      </nav>
      <div class="g-head">
        <img class="g-icon" src="../assets/icons/${p.icon}.webp" alt="" width="720" height="480">
        <div class="g-head-text">
          <div class="g-label">FEATURE ${p.no}${p.option ? `<span class="g-opt">${p.optionPart ? '一部オプション' : 'オプション'}</span>` : ''}</div>
          <h1><span class="ph">${esc(p.name)}</span><span class="ph">の使い方</span></h1>
        </div>
      </div>
      <p class="g-lead">${og(p.lead)}</p>
    </div>
  </div>
</section>
<div class="g-cover">
  ${shot(p.hero, `${p.name}の画面（デモ画面）`, 'g-shot--hero', true)}
  <p class="g-note">${og('画面はデモ用のデータです。画像を押すと大きく開きます。')}</p>
</div>
<div class="post-body">
  <h2><span class="ph">こんな</span><span class="ph">困りごとに</span></h2>
  <ul class="g-pains">
${p.pains.map(t => `    <li>${og(t)}</li>`).join('\n')}
  </ul>

  <h2><span class="ph">この機能で</span><span class="ph">できること</span></h2>
  <ul>
${p.can.map(t => `    <li>${og(t)}</li>`).join('\n')}
  </ul>
  <p class="g-where"><span class="g-where-l">メニューの場所</span>${og(p.where)}</p>
${p.option ? `
  <div class="callout"><div class="ct"><span class="ci">!</span><span>${p.optionPart ? '<span class="ph">一部の機能は</span><span class="ph">オプションです</span>' : '<span class="ph">オプション</span><span class="ph">機能です</span>'}</span></div><p>${og(p.option)}<br>${og('ご利用の条件は、お気軽にお問い合わせください。')}</p></div>
` : ''}
  <h2><span class="ph">使い方</span><span class="ph">（3ステップ）</span></h2>
  <ol class="g-steps">
${steps}
  </ol>

  <h2>よくある質問</h2>
${p.faq.map(f => `  <details class="faq"><summary>${esc(f.q)}</summary><div class="faq-a">${og(f.a)}</div></details>`).join('\n')}

  <h2><span class="ph">あわせて</span><span class="ph">使いたい機能</span></h2>
  <div class="g-related">
${related.map(r => `    <a class="g-rel" href="./${r.slug}.html">
      <img src="../assets/icons/${r.icon}.webp" alt="" width="720" height="480" loading="lazy" decoding="async">
      <span class="g-rel-body"><span class="g-rel-no">FEATURE ${r.no}</span><span class="g-rel-name">${ogName(r.name)}</span><span class="g-rel-catch">${og(r.catch)}</span></span>
    </a>`).join('\n')}
  </div>
  <p class="g-back"><a href="../index.html#features">← 主要機能の一覧にもどる</a></p>
</div>
<div class="inline-cta">
  <div class="box">
    <div>
      <h3>${og('賃貸仲介の業務を、ミエルームひとつに。')}</h3>
      <p>${og('後AD・申込管理から媒体別ROIまで。賃貸仲介の数字を、ひとつの画面に。お申し込みから最短即日でスタートできます。')}</p>
    </div>
    <a class="btn btn-primary" href="https://app.mieroom.cloud/apply" target="_blank" rel="noopener" style="flex:none"><span>無料デモ<span class="lbl-full">アカウント発行</span></span></a>
  </div>
</div>
</article>
<footer class="site">
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        <div class="foot-logo">
          <img src="../assets/logo-mark-sm.webp" alt="ミエルーム" loading="lazy">
          <span class="name">ミ<b>エ</b>ルーム</span>
        </div>
        <p>${og('反響・接客・売上・申込・契約書類から物件入力・業者間サイト連携・LINE追客・経理まで、40以上の機能をひとつに。1〜複数店舗の賃貸仲介会社に特化した業務管理ツールです。')}</p>
      </div>
      <div class="foot-cols">
        <div>
          <h4>サービス</h4>
          <a href="../index.html#features">主要機能</a>
          <a href="../features.html">活用事例</a>
          <a href="../compare.html">比較</a>
          <a href="../blog.html">ブログ</a>
          <a href="../index.html#faq">よくある質問</a>
        </div>
        <div>
          <h4>会社</h4>
          <a href="../../company.html">運営会社（会社概要）</a>
          <a href="../../index.html">TENERAMENTE公式サイト</a>
          <a href="https://app.mieroom.cloud/privacy" target="_blank" rel="noopener">プライバシーポリシー</a>
          <a href="https://app.mieroom.cloud/terms" target="_blank" rel="noopener">利用規約</a>
          <a href="https://line-harness.teneramente0701.workers.dev/r/lp" target="_blank" rel="noopener">お問い合わせ</a>
        </div>
      </div>
    </div>
    <div class="foot-bottom">© 2026 ミエルーム. All rights reserved.</div>
  </div>
</footer>
<script src="../assets/site.js"></script>
<script src="../assets/guide.js" defer></script>
<script src="../../assets/milpage.js" async></script>
<script src="/assets/analytics.js" defer data-analytics></script>
</body>
</html>
`;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const slugs = new Set();
  for (const p of FEATURES) {
    if (slugs.has(p.slug)) throw new Error('slug が重複しています: ' + p.slug);
    slugs.add(p.slug);
    for (const r of p.related) if (!FEATURES.some(f => f.slug === r)) throw new Error(`${p.slug} の関連機能が見つかりません: ${r}`);
    fs.writeFileSync(path.join(OUT_DIR, p.slug + '.html'), pageHtml(p));
  }
  makeOgAll(FEATURES);
  // もう使っていないページ（データから消した機能）を片づける
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.html') && !slugs.has(f.replace(/\.html$/, ''))) {
      fs.unlinkSync(path.join(OUT_DIR, f));
      console.log('  消しました:', f);
    }
  }
  console.log(`✓ 機能の使い方ページを ${FEATURES.length} 枚出力しました（mieroom/guide/）`);
}

main();
