/* TENERAMENTE — shared interactions (reveal / hero lines / marquee / parallax / counters) */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* スクロール出現 */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  function mark() {
    document.querySelectorAll('.reveal:not(.in), .lines:not(.in)').forEach(function (el) { io.observe(el); });
  }
  document.addEventListener('DOMContentLoaded', mark);
  mark();
  window.__revealMark = mark;

  /* ファーストビューの見出しは読み込み直後に立ち上げる */
  window.addEventListener('load', function () {
    document.querySelectorAll('.lines, .reveal').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9 && r.bottom > 0) el.classList.add('in');
    });
  });


  /* 日本語のぶら下がり防止: 段落の末尾4文字（＋句読点）をひと固まりにして、
     「す。」だけが次の行に落ちるのを防ぐ。幅に依存せず全ページで効く。 */
  var OG_SEL = '.lead, .cell p, .row .d, .prod .desc, .checks li, .faq-list p, .faq-list .faq-a, .post-row p, .article-card p, .cta-band p, .dcard li, .biz-block .desc, .site-footer .desc, .mani-body p, .meaning, .sq-note, .sq-lead-head p, .sq-done-body, .step-sub, .cinfo .note, .post-body p, .post-body li, .seo-note p, .callout p, .conclusion p, .price-note, .cap, .flow p, .fcard p, .spec .v, .hero-foot .v, .o-d, .promo p';
  function orphanGuard(el) {
    if (el.dataset.og) return;
    el.dataset.og = '1';
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, last = null;
    while ((n = w.nextNode())) { if (n.nodeValue.trim()) last = n; }
    if (!last) return;
    var t = last.nodeValue.replace(/\s+$/, '');
    var chars = Array.from(t);
    if (chars.length < 7) return;
    var m = t.match(/(.{4}[。、」』）!?！？]*)$/u);
    if (!m) return;
    var tail = m[1];
    if (Array.from(tail).length > 8) return;
    var span = document.createElement('span');
    span.className = 'og';
    span.textContent = tail;
    last.nodeValue = t.slice(0, t.length - tail.length);
    last.parentNode.insertBefore(span, last.nextSibling);
  }
  var ogTimer = null;
  function runOrphanGuard() {
    document.querySelectorAll(OG_SEL).forEach(orphanGuard);
  }
  document.addEventListener('DOMContentLoaded', runOrphanGuard);
  runOrphanGuard();
  if (window.MutationObserver) {
    new MutationObserver(function () {
      clearTimeout(ogTimer);
      ogTimer = setTimeout(runOrphanGuard, 150);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* マーキー: 中身を複製してループさせる */
  document.querySelectorAll('.marquee .track').forEach(function (t) {
    if (t.dataset.dup) return;
    t.dataset.dup = '1';
    t.innerHTML += t.innerHTML;
  });

  /* ゆるいパララックス（data-parallax="px"） */
  var px = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  if (px.length && !reduce) {
    var ticking = false;
    var run = function () {
      var vh = window.innerHeight;
      px.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var c = (r.top + r.height / 2 - vh / 2) / vh;      // -1 .. 1
        var amt = parseFloat(el.dataset.parallax) || 24;
        el.style.setProperty('--py', (c * -amt).toFixed(1) + 'px');
      });
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(run); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', run, { passive: true });
    run();
  }

  /* 数字カウントアップ（data-count） */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    var cio = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, target = parseFloat(el.getAttribute('data-count'));
        var dec = (el.getAttribute('data-count').split('.')[1] || '').length;
        var start = null, dur = reduce ? 0 : 1400;
        var step = function (ts) {
          if (!start) start = ts;
          var p = dur ? Math.min(1, (ts - start) / dur) : 1;
          var e = 1 - Math.pow(1 - p, 3);
          el.textContent = (target * e).toFixed(dec);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        obs.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  }
})();
