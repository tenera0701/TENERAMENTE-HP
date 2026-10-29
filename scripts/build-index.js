#!/usr/bin/env node
/**
 * posts/*.md を読んで data/posts.json と sitemap.xml を再生成する。
 * frontmatter は <!--META { ... } META--> 形式の JSON。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_JSON = path.join(DATA_DIR, 'posts.json');
const OUT_SITEMAP = path.join(ROOT, 'sitemap.xml');
const SITE_URL = (process.env.SITE_URL || 'https://teneramente.jp').replace(/\/$/, '');

// カテゴリ定義（slug → 表示名 + フィルタグループ）
// フィルタグループ: MEO/AIO は同じタブにまとめる。
const CATEGORIES = {
  meo: { label: 'MEO',     group: 'meo', glyph: 'M' },
  aio: { label: 'AIO',     group: 'meo', glyph: 'A' },
  app: { label: 'Web App', group: 'app', glyph: 'W' },
  hp:  { label: 'HP / LP', group: 'hp',  glyph: 'H' },
  ai:  { label: 'AI',      group: 'ai',  glyph: 'A' },
};

const VISUALS = ['default', 'v-violet', 'v-cyan'];
const META_RE = /<!--META\s+([\s\S]*?)\s+META-->/;

// 記事の最後に出す「この記事に関係するサービス」の案内（2026-10-28〜）。
// 訴求は記事の最後だけ（本文の途中には出さない）。文言は各サービスページに書いてある事実だけで書く。
// どれを出すかは、キーワードの待ち行列の pillar（無ければカテゴリ）で決める。
const SERVICE_CARDS = {
  meo: {
    svc: 'meo', page: 'lp-meo.html', label: 'MEO / AIO 運用代行', more: 'MEO/AIO運用代行を見る',
    title: 'Googleマップ・AI検索の運用を、まるごと任せる',
    text: 'Googleマップ・AI検索の順位を独自ツールで見える化し、運用まで代行します。順位のジオグリッド計測・口コミのAI返信・レポートの自動配信で、毎月「何を直すか」を迷わない状態にします。',
  },
  ai: {
    svc: 'ai', page: 'lp-ai.html', label: 'AI活用支援', more: 'AI活用支援を見る',
    title: '社内のAI導入を、「どこから始める？」から',
    text: 'ChatGPT・Claudeの社内導入の設計、社員研修、社内データ検索（RAG）の構築、業務の自動化まで伴走します。自社の開発と運用で毎日AIを使っている会社として、現場で続く形に落とし込みます。初回相談は無料です。',
  },
  app: {
    svc: 'app', page: 'lp-ai-app.html', label: 'AI×WEBアプリ開発', more: 'AI×WEBアプリ開発を見る',
    title: 'Excelと属人化を、御社専用のアプリに',
    text: 'Excel・属人化・既製SaaSのすき間を埋める、御社専用の業務アプリを短い工期で開発します。初期費用は30万円から。まずは今の業務の流れをお聞きするところから始めます。',
  },
  hp: {
    svc: 'hp', page: 'lp-hplp.html', label: 'HP / LP 作成', more: 'HP/LP作成を見る',
    title: '作って終わりにしない、育てられるサイトを',
    text: '自社CMS「ミルページ」で、AIブログの自動投稿・SEO・Google連携まで備えた、公開後も自分で育てられるHP/LPを制作します。',
  },
};
const PILLAR_TO_CARD = {
  'lp-meo.html': 'meo', 'lp-ai.html': 'ai', 'lp-ai-app.html': 'app', 'lp-ldash.html': 'app',
  'lp-hplp.html': 'hp', 'lp-milpage.html': 'hp',
};
const CATEGORY_TO_CARD = { meo: 'meo', aio: 'meo', ai: 'ai', app: 'app', hp: 'hp' };

function extractMeta(raw, file) {
  const m = raw.match(META_RE);
  if (!m) throw new Error(`${file}: missing <!--META ... META--> block`);
  try { return JSON.parse(m[1]); }
  catch (e) { throw new Error(`${file}: invalid JSON in META — ${e.message}`); }
}

function stripMeta(raw) {
  return raw.replace(META_RE, '').trim();
}

function jpCharCount(body) {
  return body.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
}

function readMinutes(body) {
  // 日本語 ~600字/分 を目安
  return Math.max(3, Math.round(jpCharCount(body) / 600));
}

function buildTOC(body) {
  const toc = [];
  const lines = body.split('\n');
  let inCode = false;
  let i = 0;
  for (const line of lines) {
    if (/^```/.test(line)) inCode = !inCode;
    if (inCode) continue;
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      i++;
      toc.push({ id: 'h' + i, n: String(i).padStart(2, '0'), label: m[1].trim().replace(/^\d{2}[\s.．:：]+/, '') });
    }
  }
  return toc;
}

function formatDate(d) {
  const dt = new Date(d + 'T00:00:00Z');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function main() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error('posts/ ディレクトリが見つかりません');
    process.exit(1);
  }

  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md')).sort();
  if (!files.length) {
    console.error('posts/*.md が0件です');
    process.exit(1);
  }

  const bodies = new Map();   // slug → 本文の Markdown（記事ページに静的に書き込む）
  const posts = files.map(file => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const meta = extractMeta(raw, file);
    const body = stripMeta(raw);
    const slug = file.replace(/\.md$/, '');
    bodies.set(slug, body);

    // 必須フィールド検証
    ['title', 'date', 'category', 'excerpt'].forEach(k => {
      if (!meta[k]) throw new Error(`${file}: required field "${k}" is missing`);
    });
    const cat = CATEGORIES[meta.category];
    if (!cat) throw new Error(`${file}: unknown category "${meta.category}"`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: date must be YYYY-MM-DD`);

    return {
      slug,
      title: meta.title,
      date: meta.date,
      dateLabel: formatDate(meta.date),
      category: meta.category,
      categoryLabel: cat.label,
      categoryGroup: cat.group,
      excerpt: meta.excerpt,
      tags: meta.tags || [],
      readMin: meta.readMin || readMinutes(body),
      glyph: meta.glyph || cat.glyph,
      featured: !!meta.featured,
      toc: buildTOC(body),
    };
  });

  // 新しい順
  posts.sort((a, b) => b.date.localeCompare(a.date));

  // featured は最新の1本のみに正規化（複数指定があれば最新だけ残す）
  let featuredFound = false;
  posts.forEach(p => {
    if (p.featured && !featuredFound) featuredFound = true;
    else p.featured = false;
  });
  if (!featuredFound && posts.length) posts[0].featured = true;

  // トップページの「おすすめ記事」3件。ここに並べた順で index.html に出る。
  // アクセス解析を入れるまでは編集部の選定。入れ替えるときはこの配列だけ直す。
  const HOME_PICKUP = [
    '2026-07-02-meo-taisaku-complete-guide',
    '2026-07-12-ai-gyomu-kaizen-app-kaihatsu',
    '2026-09-04-gyomu-kaizen-ai-tsukaikata',
  ];
  HOME_PICKUP.forEach((slug, i) => {
    const hit = posts.find(x => x.slug === slug);
    if (hit) hit.pickup = i + 1;
  });

  // 一覧カードのビジュアル&番号を自動採番
  posts.forEach((p, i) => {
    p.visual = VISUALS[i % VISUALS.length];
    p.number = String(i + 1).padStart(2, '0');
  });

  // カバー画像を自動生成し、存在する記事に image を付与(無くてもビルドは続行)
  try {
    const covered = require('./gen-covers').generate(posts, ROOT);
    posts.forEach(p => { if (covered.has(p.slug)) p.image = `assets/img/covers/${p.slug}.png`; });
  } catch (e) {
    console.warn('△ カバー画像の生成に失敗:', e.message);
  }

  // 表示用の軽い WebP（一覧カード用・Featured用）。作れない環境では PNG のまま表示する
  try {
    const webp = require('./gen-webp').generate(path.join(ROOT, 'assets/img/covers'));
    posts.forEach(p => {
      if (!p.image || !webp.has(p.slug)) return;
      p.imageHero = `assets/img/covers/${p.slug}.webp`;
      p.imageCard = `assets/img/covers/${p.slug}-card.webp`;
    });
  } catch (e) {
    console.warn('△ WebP の生成に失敗:', e.message);
  }

  // 書き出し
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(posts, null, 2) + '\n', 'utf8');

  // 記事ごとの静的ページ <slug>.html を生成。
  // blog-post.html をテンプレートに、<head> のメタに加えて題名・本文・目次・関連記事・サービス案内まで
  // HTML に書き込む（2026-10-28〜）。以前は本文を JS で後から描いていたため、検索エンジンが最初に受け取る
  // HTML には題名も本文も無く、Search Console で「検出 - インデックス未登録」が積み上がっていた。
  // ブラウザ側（assets/blog-post.js）は data-prerendered を見て描き直さず、目次の追従とシェアだけ付ける。
  // 旧生成物(記事slug形式の .html)は削除してから作り直す。
  const POST_PAGE_RE = /^\d{4}-\d{2}-\d{2}-[A-Za-z0-9-]+\.html$/;
  fs.readdirSync(ROOT).filter(f => POST_PAGE_RE.test(f))
    .forEach(f => fs.unlinkSync(path.join(ROOT, f)));

  const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const template = fs.readFileSync(path.join(ROOT, 'blog-post.html'), 'utf8');
  const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stripTags = s => String(s).replace(/<[^>]+>/g, '');
  const decode = s => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  // 記事 slug → pillar（キーワードの待ち行列から）
  const pillarBySlug = {};
  try {
    JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'seo-keywords.json'), 'utf8')).items
      .forEach(i => { if (i.slug && i.pillar) pillarBySlug[i.slug] = i.pillar; });
  } catch (e) {
    console.warn('△ seo-keywords.json を読めませんでした（サービス案内はカテゴリで決めます）:', e.message);
  }

  // Markdown → 記事本文の HTML。ブラウザ側で描いていたときと同じ見た目になるように整える
  const { marked } = require('./vendor/marked.min.js');
  marked.setOptions({ gfm: true, breaks: false });
  function renderBody(md) {
    let html = marked.parse(md);
    // 表は横スクロールのラッパで包む
    if (!/table-wrap/.test(html)) {
      html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
    }
    // 先頭の段落をリード文の見た目に
    html = html.replace(/<p>/, '<p class="lead" style="font-size:19px;line-height:1.8;color:var(--fg-muted);margin-bottom:32px;">');
    // H2 に番号とアンカー（本文側に「01 」と書かれていても二重にならないよう剥がす）
    const toc = [];
    html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, inner) => {
      const i = toc.length + 1;
      const n = String(i).padStart(2, '0');
      inner = inner.replace(/^\s*\d{2}[\s.．:：]+/, '');
      toc.push({ id: 'h' + i, n, label: stripTags(inner).trim() });
      return `<h2 id="h${i}"><span class="h-num">${n}</span>${inner}</h2>`;
    });
    // FAQ（構造化データ用）
    const faqs = [];
    html.replace(/<details class="faq">\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-a">([\s\S]*?)<\/div>\s*<\/details>/g,
      (m, q, a) => { faqs.push({ q: decode(stripTags(q)).trim(), a: decode(stripTags(a)).trim() }); return m; });
    return { html, toc, faqs };
  }

  // 関連記事: 同じ系統の中で公開日が近い3本（足りなければ他の系統から近い順）。
  // 「最新の3本」にすると新しい記事が出るたびに全記事のページが書き換わるため、近い順に固定する
  function relatedOf(p) {
    const t = Date.parse(p.date);
    const near = list => list.filter(x => x.slug !== p.slug)
      .sort((a, b) => Math.abs(Date.parse(a.date) - t) - Math.abs(Date.parse(b.date) - t) || a.slug.localeCompare(b.slug));
    const same = near(posts.filter(x => x.categoryGroup === p.categoryGroup));
    const others = near(posts.filter(x => x.categoryGroup !== p.categoryGroup));
    return [...same, ...others].slice(0, 3);
  }

  function serviceCardHTML(p) {
    const key = PILLAR_TO_CARD[pillarBySlug[p.slug]] || CATEGORY_TO_CARD[p.category];
    const c = SERVICE_CARDS[key];
    if (!c) return '';
    return `<section class="svc-card" aria-label="この記事に関係するサービス">
  <div class="svc-card-inner">
    <span class="svc-card-label">Service — ${escHtml(c.label)}</span>
    <p class="svc-card-title">${escHtml(c.title)}</p>
    <p class="svc-card-text">${escHtml(c.text)}</p>
    <div class="svc-card-ctas">
      <a href="contact.html?svc=${c.svc}" class="btn btn--primary btn--lg">この内容で無料相談する<svg class="arr" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5"/></svg></a>
      <a href="${c.page}" class="btn btn--ghost btn--lg">${escHtml(c.more)}</a>
    </div>
    <p class="svc-card-note">お問い合わせは2ステップ・約60秒で送信できます。1営業日以内に代表からご返信します。</p>
  </div>
</section>`;
  }

  // テンプレートの差し込み口。テンプレートを書き換えて見つからなくなったら、黙って空のページを作らずに止める
  function put(html, re, value, name, file = 'blog-post.html') {
    if (!re.test(html)) throw new Error(`${file} に差し込み口「${name}」が見つかりません`);
    return html.replace(re, () => value);
  }

  posts.forEach(p => {
    const url = `${SITE_URL}/${p.slug}.html`;
    const metas = {
      'description': p.excerpt,
      'og:title': p.title,
      'og:description': p.excerpt,
      'og:url': url,
      'twitter:title': p.title,
      'twitter:description': p.excerpt,
    };
    if (p.image) {
      metas['og:image'] = `${SITE_URL}/${p.image}`;
      metas['twitter:image'] = `${SITE_URL}/${p.image}`;
    }
    let html = template.replace(/<title data-meta="title">[\s\S]*?<\/title>/,
      () => `<title data-meta="title">${escAttr(p.title)} — TENERAMENTE Blog</title>`);
    for (const [k, v] of Object.entries(metas)) {
      html = html.replace(new RegExp(`(data-meta="${k}" content=")[^"]*(")`),
        (m, a, b) => a + escAttr(v) + b);
    }
    html = html.replace(/(data-canonical href=")[^"]*(")/, (m, a, b) => a + url + b);

    // 題名・本文・目次・関連記事・サービス案内を HTML に書き込む
    const r = renderBody(bodies.get(p.slug));
    const cover = p.image
      ? `<img src="${escHtml(p.imageHero || p.image)}" alt="${escHtml(p.title)}" width="1200" height="630" fetchpriority="high" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`
      : `<div class="big-glyph" data-post="glyph">${escHtml(p.glyph || 'A')}</div>`;
    const foot = (p.tags || []).length ? `<div class="post-foot">
    <div class="post-tags" data-post="tags">${p.tags.map(t => `<span>#${escHtml(t)}</span>`).join('')}</div>
    <div class="post-share">
      <button data-share="x" aria-label="Xでシェア">X</button>
      <button data-share="copy" aria-label="リンクをコピー">⌘</button>
    </div>
  </div>` : '';
    html = put(html, /<span data-post="crumb">[^<]*<\/span>/, `<span data-post="crumb">${escHtml(p.categoryLabel.toUpperCase())}</span>`, 'crumb');
    html = put(html, /(<span class="post-cat" data-post="category">)[^<]*(<\/span>)/, `<span class="post-cat" data-post="category">${escHtml(p.categoryLabel)}</span>`, 'category');
    html = put(html, /<h1 class="post-title" data-post="title">[^<]*<\/h1>/, `<h1 class="post-title" data-post="title">${escHtml(p.title)}</h1>`, 'title');
    html = put(html, /<span data-post="date">[^<]*<\/span>/, `<span data-post="date">${escHtml(p.dateLabel)}</span>`, 'date');
    html = put(html, /<span data-post="read">[^<]*<\/span>/, `<span data-post="read">${p.readMin} min read</span>`, 'read');
    html = put(html, /<div class="post-cover-inner">[\s\S]*?<\/div><\/div>/, `<div class="post-cover-inner">${cover}</div>`, 'cover');
    html = put(html, /<nav class="toc" data-toc><\/nav>/,
      `<nav class="toc" data-toc>${r.toc.map((t, i) => `<a href="#${t.id}"${i === 0 ? ' class="active"' : ''}><span class="n">${t.n}</span>${t.label}</a>`).join('')}</nav>`, 'toc');
    html = put(html, /<article class="post-body" data-post="body">[\s\S]*?<\/article>/,
      `<article class="post-body" data-post="body" data-prerendered="1">\n${r.html}\n${foot}\n</article>`, 'body');
    html = put(html, /<!--SVC-CARD-->/, serviceCardHTML(p), 'SVC-CARD');
    html = put(html, /<div class="related-grid" data-related><\/div>/,
      `<div class="related-grid" data-related>${relatedOf(p).map(x => `
      <a class="related-card" href="${encodeURIComponent(x.slug)}.html">
        <span class="cat">${escHtml(x.categoryLabel)}</span>
        <h4>${escHtml(x.title)}</h4>
      </a>`).join('')}
    </div>`, 'related');

    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BlogPosting',
          headline: p.title, description: p.excerpt,
          datePublished: p.date, dateModified: p.date, inLanguage: 'ja',
          mainEntityOfPage: url,
          image: p.image ? `${SITE_URL}/${p.image}` : `${SITE_URL}/assets/img/ogp.png`,
          articleSection: p.categoryLabel,
          author: { '@type': 'Person', name: '加藤 聖矢' },
          publisher: { '@type': 'Organization', name: '株式会社TENERAMENTE',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/img/favicon-512.png` } },
          keywords: (p.tags || []).join(', '),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'ブログ', item: `${SITE_URL}/blog.html` },
            { '@type': 'ListItem', position: 3, name: p.title, item: url },
          ],
        },
        ...(r.faqs.length ? [{
          '@type': 'FAQPage',
          mainEntity: r.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        }] : []),
      ],
    };
    // <script> の中に JSON を書くときは "<" を < に逃がす。
    // これをしないと、記事タイトルや要約に "</script>" が入っていた場合に
    // script タグが途中で閉じてしまい、任意のスクリプトが動く（XSS）。
    const jsonInScript = o => JSON.stringify(o).replace(/</g, '\\u003c');
    // 置き換え先は関数で渡す（文字列で渡すと、題名や FAQ に $' や $& が入ったときに特殊な意味に解釈されてページが壊れる）
    html = html.replace('</head>', () =>
      `<script>window.__POST_SLUG__=${jsonInScript(p.slug)};</script>\n` +
      `<script type="application/ld+json">${jsonInScript(ld)}</script>\n</head>`);
    fs.writeFileSync(path.join(ROOT, `${p.slug}.html`), html, 'utf8');
  });

  // ブログ一覧（blog.html）にも記事へのリンクを HTML で書き込む。
  // 一覧も JS で後から描いていたため、検索エンジンは一覧から記事をたどれなかった。
  // 2ページ目以降のカードは page-off で隠しておく（blog-index.js がページ送りで出し入れする）
  {
    const BlogCards = require('../assets/blog-cards.js');
    const BLOG = path.join(ROOT, 'blog.html');
    const featured = posts.find(x => x.featured) || posts[0];
    const others = posts.filter(x => x.slug !== featured.slug);
    let blog = fs.readFileSync(BLOG, 'utf8');
    blog = put(blog, /<!--STATIC-FEATURED-->[\s\S]*?<!--\/STATIC-FEATURED-->/,
      `<!--STATIC-FEATURED-->${BlogCards.featuredHTML(featured)}<!--/STATIC-FEATURED-->`, 'STATIC-FEATURED', 'blog.html');
    blog = put(blog, /<!--STATIC-CARDS-->[\s\S]*?<!--\/STATIC-CARDS-->/,
      `<!--STATIC-CARDS-->${others.map((x, i) => BlogCards.cardHTML(x, i >= 12 ? 'page-off' : '')).join('')}<!--/STATIC-CARDS-->`, 'STATIC-CARDS', 'blog.html');
    fs.writeFileSync(BLOG, blog, 'utf8');
  }

  // sitemap.xml
  // lastmod には「そのページが実際に更新された日」だけを入れる。
  // 全ページに “今日” を入れていると、中身が変わっていなくても毎日サイトマップだけが
  // 書き換わり、自動同期が無意味なコミットを積み続ける。検索エンジンにも
  // 「毎日全ページを更新している」と誤って伝わるので、日付が分かる記事にだけ付ける。
  const staticUrls = [
    '', 'services.html', 'company.html', 'contact.html', 'blog.html', 'shindan.html',
    'lp-ai-app.html', 'lp-ai.html', 'lp-hplp.html', 'lp-meo.html',
    'lp-milpage.html', 'lp-ldash.html', 'mieroom/',
    'mieroom/features.html', 'mieroom/compare.html', 'mieroom/blog.html',
  ];
  // ミエルームのブログ記事（mieroom/articles/*.html）も列挙する
  const mieroomArticles = fs.readdirSync(path.join(ROOT, 'mieroom', 'articles'))
    .filter(f => f.endsWith('.html'))
    .sort()
    .map(f => `mieroom/articles/${f}`);
  // ミエルームの「機能の使い方」ページ（mieroom/guide/*.html。scripts/build-mieroom-guide.js が作る）
  const GUIDE_DIR = path.join(ROOT, 'mieroom', 'guide');
  const mieroomGuides = fs.existsSync(GUIDE_DIR)
    ? fs.readdirSync(GUIDE_DIR).filter(f => f.endsWith('.html')).sort().map(f => `mieroom/guide/${f}`)
    : [];
  const postUrls = posts.map(p => `${p.slug}.html`);
  const all = [...staticUrls, ...mieroomGuides, ...mieroomArticles, ...postUrls];

  // URL → 更新日。記事は記事の公開日を使う（ミエルームは元の .md から拾う）
  const lastmod = {};
  posts.forEach(p => { lastmod[`${p.slug}.html`] = p.date; });
  const MR_POSTS = path.join(ROOT, 'mieroom', 'posts');
  if (fs.existsSync(MR_POSTS)) {
    mieroomArticles.forEach(u => {
      const md = path.join(MR_POSTS, path.basename(u).replace(/\.html$/, '.md'));
      if (!fs.existsSync(md)) return;   // 手書きの既存記事は日付が分からないので付けない
      const m = fs.readFileSync(md, 'utf8').match(/"date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
      if (m) lastmod[u] = m[1];
    });
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => {
  const loc = `${SITE_URL}/${encodeURI(u).replace(/&/g, '&amp;')}`;
  const d = lastmod[u];
  return `  <url><loc>${loc}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`;
}).join('\n')}
</urlset>
`;
  fs.writeFileSync(OUT_SITEMAP, sitemap, 'utf8');

  console.log(`✓ posts.json (${posts.length}本) と sitemap.xml を出力しました`);
}

main();
