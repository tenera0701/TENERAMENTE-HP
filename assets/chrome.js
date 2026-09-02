/* ミルページ（自社CMS）連携を読み込む。設定は assets/milpage.js にまとめてある。 */
(function () {
  const here = document.currentScript && document.currentScript.src;
  const s = document.createElement('script');
  s.src = here ? here.replace(/chrome\.js(\?.*)?$/, 'milpage.js') : 'assets/milpage.js';
  s.async = true;
  document.head.appendChild(s);
})();

/* TENERAMENTE — shared site chrome (header / mobile menu / footer / floating CTA)
   Usage: put <div data-chrome="header"></div> and <div data-chrome="footer"></div>
   in the page, set <body data-active="services"> to mark the current nav item.
   黒いヒーローから始まるページは <body data-hero="dark"> を付ける（ヘッダーの文字色が白になる）。 */
(function () {
  const NAV = [
    { key: 'services', href: 'services.html', label: '事業内容' },
    { key: 'products', href: 'services.html#products', label: 'プロダクト' },
    { key: 'company',  href: 'company.html',  label: '会社概要' },
    { key: 'blog',     href: 'blog.html',     label: 'ブログ' },
    { key: 'shindan',  href: 'shindan.html',  label: 'AI無料診断' },
  ];
  const LINE_URL = 'https://line-harness.teneramente0701.workers.dev/r/hp';
  const LINE_ICO = '<svg viewBox="0 0 36 36" class="ico" aria-hidden="true"><path d="M18 3C9.16 3 2 8.85 2 16.1c0 6.5 5.7 11.95 13.4 12.97.52.11 1.23.34 1.41.78.16.4.1.99.05 1.4l-.22 1.36c-.07.4-.32 1.58 1.38.86 1.71-.72 9.18-5.4 12.52-9.25C32.81 21.6 34 19 34 16.1 34 8.85 26.84 3 18 3z"/></svg>';
  const active = document.body.getAttribute('data-active') || '';

  const navLinks = NAV.map(n =>
    `<a href="${n.href}"${n.key === active ? ' class="on"' : ''}>${n.label}</a>`
  ).join('');

  const header = `
  <header class="site-header" id="siteHeader">
    <div class="bar">
      <a href="index.html" class="brand" aria-label="株式会社TENERAMENTE トップページ">
        <img class="mark logo-dark"  src="assets/img/brand/mark-dark.png"  alt="" width="427" height="271" decoding="async" />
        <img class="mark logo-light" src="assets/img/brand/mark-light.png" alt="" width="427" height="271" decoding="async" />
        <img class="word logo-dark"  src="assets/img/brand/word-dark.png"  alt="TENERAMENTE" width="823" height="66" decoding="async" />
        <img class="word logo-light" src="assets/img/brand/word-light.png" alt="TENERAMENTE" width="823" height="66" decoding="async" />
      </a>
      <nav class="nav" aria-label="メインメニュー">${navLinks}</nav>
      <div class="hdr-cta">
        <a href="${LINE_URL}" target="_blank" rel="noopener" class="btn btn--line">${LINE_ICO}LINEで相談</a>
        <a href="contact.html" class="btn btn--primary">無料相談</a>
      </div>
      <button class="menu-toggle" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="menuOverlay"><span></span><span></span></button>
    </div>
  </header>
  <div class="menu-overlay" id="menuOverlay" aria-hidden="true">
    <nav aria-label="メニュー">
      ${NAV.map((n, i) => `<a href="${n.href}"><span class="n">0${i + 1}</span>${n.label}</a>`).join('')}
      <a href="contact.html"><span class="n">0${NAV.length + 1}</span>お問い合わせ</a>
    </nav>
    <div class="ctas">
      <a href="${LINE_URL}" target="_blank" rel="noopener" class="btn btn--line btn--lg">${LINE_ICO}LINEで相談する</a>
      <a href="contact.html" class="btn btn--primary btn--lg">無料相談する</a>
    </div>
    <div class="meta">TENERAMENTE Inc. — Nagoya, Japan / Est. 2022</div>
  </div>`;

  const footer = `
  <footer class="site-footer">
    <div class="wrap-wide">
      <div class="top">
        <div class="fbrand">
          <a href="index.html" class="flogo" aria-label="株式会社TENERAMENTE">
            <img class="mark" src="assets/img/brand/mark-light.png" alt="" width="427" height="271" loading="lazy" decoding="async" />
            <img class="word" src="assets/img/brand/word-light.png" alt="TENERAMENTE" width="823" height="66" loading="lazy" decoding="async" />
          </a>
          <p class="tag">AI時代を、優しく加速する。</p>
          <p class="desc">業務改善ツール開発・HP/LP制作・MEO/AIO運用・AI活用支援。名古屋発、AI時代の業務改善パートナー。</p>
          <p class="addr">株式会社TENERAMENTE<br />愛知県名古屋市西区牛島町6-1 名古屋ルーセントタワー40階</p>
        </div>
        <div class="fcol"><h4>Services</h4>
          <a href="lp-ai-app.html">AI×WEBアプリ開発</a>
          <a href="lp-hplp.html">HP/LP作成</a>
          <a href="lp-meo.html">MEO/AIO運用代行</a>
          <a href="services.html#ai">AI活用支援</a>
        </div>
        <div class="fcol"><h4>Products</h4>
          <a href="mieroom/">ミエルーム</a>
          <a href="lp-milpage.html">ミルページ</a>
          <a href="lp-ldash.html">LDash</a>
          <a href="lp-meo.html">MEOツール</a>
        </div>
        <div class="fcol"><h4>Company</h4>
          <a href="company.html">会社概要</a>
          <a href="blog.html">ブログ</a>
          <a href="shindan.html">AI無料診断</a>
          <a href="contact.html">お問い合わせ</a>
        </div>
      </div>
      <div class="bottom"><span>© 2026 TENERAMENTE Inc.</span><span>Tenderly · Surely · Swiftly — Nagoya, Japan</span></div>
    </div>
  </footer>`;

  const floatCta = `<div class="float-cta" aria-label="お問い合わせ">
    <a href="shindan.html" class="s">AI無料診断</a>
    <a href="${LINE_URL}" target="_blank" rel="noopener" class="l">${LINE_ICO.replace('class="ico"', '')}LINE</a>
    <a href="contact.html" class="f">無料相談</a>
  </div>`;

  document.querySelectorAll('[data-chrome="header"]').forEach(el => { el.outerHTML = header; });
  document.querySelectorAll('[data-chrome="footer"]').forEach(el => { el.outerHTML = footer + floatCta; });

  /* header: 黒ヒーロー上は白文字、スクロールで紙色に */
  const hdr = document.getElementById('siteHeader');
  const overlay = document.getElementById('menuOverlay');
  if (hdr) {
    if (document.body.getAttribute('data-hero') === 'dark') hdr.classList.add('on-dark');
    const onScroll = () => hdr.classList.toggle('scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const btn = hdr.querySelector('.menu-toggle');
    const setMenu = (open) => {
      hdr.classList.toggle('menu-open', open);
      document.body.classList.toggle('menu-open', open);
      if (overlay) { overlay.classList.toggle('open', open); overlay.setAttribute('aria-hidden', String(!open)); }
      if (btn) { btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く'); }
    };
    if (btn) btn.addEventListener('click', () => setMenu(!hdr.classList.contains('menu-open')));
    if (overlay) overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 1024) setMenu(false); }, { passive: true });
  }
})();
