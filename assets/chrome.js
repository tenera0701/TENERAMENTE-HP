/* TENERAMENTE — shared site chrome (header / mobile menu / footer / floating CTA)
   Usage: put <div data-chrome="header"></div> and <div data-chrome="footer"></div>
   in the page, set <body data-active="services"> to mark the current nav item. */
(function () {
  const NAV = [
    { key: 'services', href: 'services.html', label: '事業内容' },
    { key: 'products', href: 'services.html#products', label: 'プロダクト' },
    { key: 'company',  href: 'company.html',  label: '会社概要' },
    { key: 'blog',     href: 'blog.html',     label: 'ブログ' },
    { key: 'shindan',  href: 'shindan.html',  label: 'AI無料診断' },
  ];
  const active = document.body.getAttribute('data-active') || '';

  const navLinks = NAV.map(n =>
    `<a href="${n.href}"${n.key === active ? ' class="on"' : ''}>${n.label}</a>`
  ).join('');

  const header = `
  <header class="k-header">
    <div class="wrap-wide bar">
      <a href="index.html" class="brand"><span class="mk">TENERAMENTE</span><span class="sub">Inc.</span></a>
      <nav class="k-nav">${navLinks}</nav>
      <div class="cta-wrap">
        <a href="https://lin.ee/yfRAgr9" target="_blank" rel="noopener" class="btn btn-line" style="padding:11px 18px;font-size:14px;"><svg viewBox="0 0 36 36" fill="currentColor" class="ico"><path d="M18 3C9.16 3 2 8.85 2 16.1c0 6.5 5.7 11.95 13.4 12.97.52.11 1.23.34 1.41.78.16.4.1.99.05 1.4l-.22 1.36c-.07.4-.32 1.58 1.38.86 1.71-.72 9.18-5.4 12.52-9.25C32.81 21.6 34 19 34 16.1 34 8.85 26.84 3 18 3z"/></svg>LINEで相談</a>
        <a href="contact.html" class="btn btn-primary" style="padding:11px 22px;font-size:14px;">無料相談</a>
      </div>
      <button class="menu-btn" aria-label="メニュー"><span></span><span></span><span></span></button>
    </div>
  </header>
  <div class="k-mobile">
    ${NAV.map(n => `<a href="${n.href}">${n.label}</a>`).join('')}
    <a href="shindan.html" class="btn btn-shindan">⚡ AI無料診断（30秒）</a>
    <a href="contact.html" class="btn btn-primary">無料相談する</a>
  </div>`;

  const footer = `
  <footer class="k-footer">
    <div class="wrap-wide">
      <div class="cols">
        <div class="fbrand">
          <div class="mk">TENERAMENTE</div>
          <p style="font-size:13px;color:#9fb2bf;margin-top:14px;max-width:34ch;">AI時代を、優しく加速する。<br />業務改善ツール開発・HP/LP制作・MEO/AIO運用・AI活用支援。</p>
        </div>
        <div class="fcol"><h4>事業内容</h4>
          <a href="lp-ai-app.html">AI×WEBアプリ開発</a>
          <a href="lp-hplp.html">HP/LP作成</a>
          <a href="lp-meo.html">MEO/AIO運用代行</a>
          <a href="services.html">AI活用支援</a>
        </div>
        <div class="fcol"><h4>プロダクト</h4>
          <a href="ミエルームLP/ミエルーム.html">ミエルーム</a>
          <a href="lp-milpage.html">ミルページ</a>
          <a href="lp-ldash.html">LDash</a>
          <a href="lp-meo.html">MEOツール</a>
        </div>
        <div class="fcol"><h4>会社</h4>
          <a href="company.html">会社概要</a>
          <a href="blog.html">ブログ</a>
          <a href="contact.html">お問い合わせ</a>
        </div>
      </div>
      <div class="copy"><span>© 2026 株式会社TENERAMENTE</span><span>Crafted in Nagoya · Tenderly</span></div>
    </div>
  </footer>`;

  const floatCta = `<div class="float-cta"><a href="shindan.html" class="btn btn-shindan">⚡ AI無料診断</a><a href="contact.html" class="btn btn-primary">無料相談</a></div>`;

  document.querySelectorAll('[data-chrome="header"]').forEach(el => { el.outerHTML = header; });
  document.querySelectorAll('[data-chrome="footer"]').forEach(el => { el.outerHTML = footer + floatCta; });

  /* header: transparent at top, solid on scroll (no seam under hero) */
  const hdr = document.querySelector('.k-header');
  if (hdr) {
    const onScroll = () => hdr.classList.toggle('scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();

/* ===== Tech background — variant "t" 全ページ共通のニューラル粒子 =====
   トップのヒーローと同じ質感をサイト全体に。控えめ密度・reduced-motionで無効。 */
(function () {
  if (document.documentElement.getAttribute('data-variant') !== 't') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var c = document.createElement('canvas');
  c.id = 'tech-net';
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.55';
  var ctx = c.getContext('2d');
  if (!ctx) return;
  document.body.appendChild(c);

  var pts = [], raf = null, W = 0, H = 0;
  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.min(60, Math.round(W / 26));
    pts = [];
    for (var i = 0; i < n; i++) pts.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22,
      r: Math.random() * 1.3 + .7
    });
  }
  function step() {
    if (document.hidden) { raf = null; return; }
    ctx.clearRect(0, 0, W, H);
    var R = Math.min(170, W * .15), R2 = R * R, i, j, a, b, dx, dy, d2, o;
    for (i = 0; i < pts.length; i++) {
      a = pts[i]; a.x += a.vx; a.y += a.vy;
      if (a.x < 0 || a.x > W) a.vx *= -1;
      if (a.y < 0 || a.y > H) a.vy *= -1;
    }
    ctx.lineWidth = 1;
    for (i = 0; i < pts.length; i++) {
      a = pts[i];
      for (j = i + 1; j < pts.length; j++) {
        b = pts[j]; dx = a.x - b.x; dy = a.y - b.y; d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          o = (1 - d2 / R2) * .14;
          ctx.strokeStyle = 'rgba(25,130,230,' + o.toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    for (i = 0; i < pts.length; i++) {
      a = pts[i];
      ctx.fillStyle = 'rgba(25,130,230,.35)';
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
    }
    raf = requestAnimationFrame(step);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !raf) raf = requestAnimationFrame(step);
  });
  window.addEventListener('resize', size, { passive: true });
  size();
  raf = requestAnimationFrame(step);
})();
