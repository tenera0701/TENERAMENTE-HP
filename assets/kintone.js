/* TENERAMENTE kintone site — shared interactions */
(function () {
  document.documentElement.classList.add('js');
  // Reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  const mark = () => document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));
  document.addEventListener('DOMContentLoaded', mark);
  mark();

  // Mobile menu toggle
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.menu-btn');
    if (btn) {
      const m = document.querySelector('.k-mobile');
      if (m) m.classList.toggle('open');
    }
    if (ev.target.closest('.k-mobile a')) {
      document.querySelector('.k-mobile')?.classList.remove('open');
    }
  });
})();

/* Design-variant switcher (Phase-1 comparison only) */
(function () {
  const KEY = 'tnr_variant';
  // Only honor the saved variant on pages that actually expose the A/B/C switcher.
  // Production pages declare their own data-variant and should not be overridden.
  const hasSwitch = !!document.querySelector('[data-vbtn]');
  if (hasSwitch) {
    const saved = localStorage.getItem(KEY) || 'b';
    document.documentElement.setAttribute('data-variant', saved);
  }
  window.__setVariant = function (v) {
    document.documentElement.setAttribute('data-variant', v);
    localStorage.setItem(KEY, v);
    document.querySelectorAll('[data-vbtn]').forEach((b) => {
      b.classList.toggle('on', b.getAttribute('data-vbtn') === v);
    });
  };
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-vbtn]').forEach((b) => {
      b.classList.toggle('on', b.getAttribute('data-vbtn') === (localStorage.getItem(KEY) || 'a'));
      b.addEventListener('click', () => window.__setVariant(b.getAttribute('data-vbtn')));
    });
  });
})();
