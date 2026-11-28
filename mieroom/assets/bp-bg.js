/* ミエルームの全ページ共通の背景（2026-11-28 社長の指示「全ページ・全画面を深緑の方眼＋間取りに。スクロールやマウスで動くように」）
 * 深緑の方眼の上に、間取りの線画がちらほら浮かぶ。スクロールすると奥行きごとに違う速さで流れ、マウスの動きで少しずれる。
 * 画面に固定した1枚の層（.bpbg）を body の先頭に差し込むだけ。見た目は assets/site.css と index.html の「全ページ深緑」の段。
 * 動かすのは transform と background-position だけ（重くしない）。動きを減らす設定の人には動かさない。 */
(function () {
  'use strict';
  if (document.querySelector('.bpbg')) return;
  var me = document.currentScript && document.currentScript.src;
  var base = me ? me.replace(/[^/]*$/, '') : 'assets/';
  // 並べる線画: 横の位置（画面幅の割合）・縦の位置（流れの中の位置）・幅・奥行き（大きいほど速く動く）・回転・濃さ
  var PLANS = [
    { f: 'bp-plan.svg', x: 0.70, y: 0.05, w: 560, d: 0.55, r: 0, o: 0.30 },
    { f: 'bp-plan3.svg', x: -0.04, y: 0.30, w: 300, d: 0.30, r: -90, o: 0.22 },
    { f: 'bp-plan2.svg', x: 0.62, y: 0.55, w: 440, d: 0.40, r: 0, o: 0.24 },
    { f: 'bp-plan.svg', x: 0.02, y: 0.78, w: 380, d: 0.65, r: 90, o: 0.20 },
    { f: 'bp-plan3.svg', x: 0.82, y: 0.92, w: 240, d: 0.25, r: 0, o: 0.18 },
    { f: 'bp-plan2.svg', x: 0.30, y: 1.18, w: 330, d: 0.50, r: 180, o: 0.16 }
  ];
  var layer = document.createElement('div');
  layer.className = 'bpbg';
  layer.setAttribute('aria-hidden', 'true');
  var grid = document.createElement('div');
  grid.className = 'bpbg-grid';
  layer.appendChild(grid);
  var els = PLANS.map(function (p) {
    var im = document.createElement('img');
    im.className = 'bpbg-plan';
    im.src = base + p.f;
    im.alt = '';
    im.decoding = 'async';
    im.style.width = p.w + 'px';
    im.style.opacity = p.o;
    layer.appendChild(im);
    return im;
  });
  function mount() { document.body.insertBefore(layer, document.body.firstChild); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sy = window.scrollY || 0, mx = 0, my = 0, tx = 0, ty = 0, vw = innerWidth, vh = innerHeight, raf = 0;
  function place() {
    raf = 0;
    // マウスの位置は少しずつ追いかける（カクつかないように）
    mx += (tx - mx) * 0.08;
    my += (ty - my) * 0.08;
    var small = vw < 700;
    var span = vh * 1.45 + 600; // 線画がひと回りする縦の長さ
    for (var i = 0; i < els.length; i++) {
      var p = PLANS[i], w = small ? p.w * 0.62 : p.w;
      var y = (p.y * span - sy * p.d) % span;
      if (y < 0) y += span;
      y -= 500;
      var x = p.x * vw + mx * 26 * p.d * 2;
      els[i].style.width = w + 'px';
      els[i].style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (y + my * 18 * p.d * 2).toFixed(1) + 'px,0) rotate(' + p.r + 'deg)';
    }
    // 方眼は層ごとずらす（background-position を変えると毎回全体の描き直しになるため）。120px でひと回り
    grid.style.transform = 'translate3d(' + (mx * 6).toFixed(1) + 'px,' + (-((sy * 0.12) % 120) + my * 6).toFixed(1) + 'px,0)';
    if (Math.abs(tx - mx) > 0.002 || Math.abs(ty - my) > 0.002) raf = requestAnimationFrame(place);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(place); }
  place();
  if (still) return;
  addEventListener('scroll', function () { sy = window.scrollY || 0; kick(); }, { passive: true });
  addEventListener('resize', function () { vw = innerWidth; vh = innerHeight; kick(); }, { passive: true });
  addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    tx = e.clientX / vw * 2 - 1;
    ty = e.clientY / vh * 2 - 1;
    kick();
  }, { passive: true });
})();
