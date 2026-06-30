/* TENERAMENTE — shared interactions */
(function () {
  // Apply stored theme/lang before paint
  try {
    const t = localStorage.getItem('ten-theme') || 'dark';
    const l = localStorage.getItem('ten-lang') || 'ja';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-lang', l);
  } catch (e) {}

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(() => {
    // Header scrolled state
    const header = document.querySelector('.header');
    const onScroll = () => {
      if (header) header.classList.toggle('scrolled', window.scrollY > 30);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Theme toggle
    const themeBtn = document.querySelector('[data-theme-toggle]');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('ten-theme', next); } catch (e) {}
        updateThemeIcon();
      });
      updateThemeIcon();
    }
    function updateThemeIcon() {
      const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      document.querySelectorAll('[data-theme-toggle] .theme-icon').forEach((el) => {
        el.textContent = t === 'dark' ? '☾' : '☀';
      });
    }

    // Language toggle
    document.querySelectorAll('[data-lang-set]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const l = btn.getAttribute('data-lang-set');
        document.documentElement.setAttribute('data-lang', l);
        try { localStorage.setItem('ten-lang', l); } catch (e) {}
        document.querySelectorAll('[data-lang-set]').forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-lang-set') === l);
        });
      });
      btn.classList.toggle('active', btn.getAttribute('data-lang-set') === (localStorage.getItem('ten-lang') || 'ja'));
    });

    // Mobile menu
    const menuBtn = document.querySelector('.menu-btn');
    const mobileMenu = document.querySelector('.mobile-menu');
    if (menuBtn && mobileMenu) {
      menuBtn.addEventListener('click', () => mobileMenu.classList.toggle('open'));
      mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.remove('open')));
    }

    // Scroll reveal
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    // Scramble text (data-scramble)
    const glyphs = '#$%&*+=<>!?@01アイウエオカキクケコ';
    document.querySelectorAll('[data-scramble]').forEach((el) => {
      const final = el.textContent;
      const chars = final.split('');
      let frame = 0;
      const total = 28;
      const run = () => {
        const progress = frame / total;
        el.textContent = chars.map((c, i) => {
          if (c === ' ') return ' ';
          const reveal = (i / chars.length) < progress;
          return reveal ? c : glyphs[Math.floor(Math.random() * glyphs.length)];
        }).join('');
        frame++;
        if (frame <= total) requestAnimationFrame(run);
        else el.textContent = final;
      };
      const heroIo = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            run();
            obs.unobserve(e.target);
          }
        });
      }, { threshold: 0.3 });
      heroIo.observe(el);
    });

    // Counter
    document.querySelectorAll('[data-count]').forEach((el) => {
      const target = parseFloat(el.getAttribute('data-count'));
      const dec = (el.getAttribute('data-count') || '').split('.')[1]?.length || 0;
      let start = null;
      const dur = 1400;
      const animate = (ts) => {
        if (!start) start = ts;
        const p = Math.min(1, (ts - start) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * e).toFixed(dec);
        if (p < 1) requestAnimationFrame(animate);
      };
      const cIo = new IntersectionObserver((entries, obs) => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            requestAnimationFrame(animate);
            obs.unobserve(en.target);
          }
        });
      }, { threshold: 0.4 });
      cIo.observe(el);
    });
  });
})();
