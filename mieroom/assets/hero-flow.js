/* ミエルーム — トップの3D「独自機能」（hero-flow.css と対。TENERAMENTE の assets/hero-system.js と同じ作り）
   ミエルームの実画面を、傾いた3Dの額に入れて見せる。スクロールすると、ドラムが回るように下から次の画面が回ってくる:
     0 反響分析           （媒体ごとの反響カードが画面から浮き出し、順に跳ねる）
     1 申込〜入金         （未入金一覧の一部入金の行が浮き、申込 → 審査 → 契約 → 入金 の駅を玉が流れる）
     2 書類の自動作成     （契約フォーマット設定の画面から、契約書・重説・取引台帳の書類が飛び出す）
     3 LINEマイページ     （お客様マイページの管理画面と、お客様のスマホのマイページ）
     4 拡張機能           （物確の一括確認の行が浮き、初期費用のお見積りが手前に出る）
     5 MEO・AIO対策       （口コミ管理の画面と、Googleマップの順位を3Dの地図グラフで）
   カーソルの近くの部品は持ち上がり、画面全体はカーソルの方へ傾く。マスコットはカーソルの方を向く。three.js r128（CDN）。
   画像は data-mf-assets（assets/ の場所）から読む。1枚目は index.html の head の小さなスクリプトで先に取りに行っておく。画像が届くまで額は出さない。
   実画面の切り抜き位置は元画像のピクセルで決め打ち（画像を差し替えたら測り直す）。スマホ縦では、文字が読めるように画面の要所だけを切り抜いて大きく見せる。
   書類（契約書・重説・取引台帳）は実物の写しではなく、題名と罫線だけを描いた絵（実在の書類を載せないため）。
   WebGL が使えない・動きを減らす設定・three.js の読み込み失敗・一番上にいるうちに1枚目の画像が来ないときは .mf--static（今までのトップの見た目）にする。
   確認用: ?mfP=0〜5 でその場面に固定、?mfStatic で静止版、?mfDebug で window.__mf に中身を出す。 */
(function () {
  'use strict';
  var sec = document.querySelector('.mf');
  if (!sec) return;
  if (sec.classList.contains('mf--static')) {
    if (sec.dataset.mfLate === '1' && window.scrollY < 40) sec.classList.remove('mf--static');
    else return;
  }
  var stage = sec.querySelector('.mf-stage');
  var canvas = sec.querySelector('.mf-canvas');
  var QS = new URLSearchParams(location.search);
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LAST = 5;   // 最後の場面の番号（0 が最初の画面、1〜5 が独自機能）
  var FORCE_P = QS.has('mfP') ? Math.max(0, Math.min(LAST, parseFloat(QS.get('mfP')) || 0)) : null;

  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (REDUCED || typeof THREE === 'undefined' || !webglOK() || QS.has('mfStatic')) { sec.classList.add('mf--static'); return; }
  sec.classList.add('mf--live');

  /* ---------- 小道具 ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function frac(x) { return x - Math.floor(x); }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // CSS の「スマホ・縦長」の条件と同じ式（hero-flow.css の @media と一致させる）
  var PORTRAIT_MQ = window.matchMedia('(max-aspect-ratio: 21/20), (max-width: 760px) and (max-aspect-ratio: 13/10)');

  /* ---------- three.js の準備 ---------- */
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;   // 指定した色がそのまま（蛍光色に寄らずに）出るように
  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(lin(0xeef7f3), 0.02);
  var FOV = 36, TAN = Math.tan(FOV * Math.PI / 360);
  var cam = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
  scene.add(new THREE.HemisphereLight(lin(0xffffff), lin(0xa9d9cb), 0.66));
  var key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(-4, 7, 9); scene.add(key);
  var curLight = new THREE.PointLight(lin(0x7fe3cf), 0.5, 7, 2); scene.add(curLight);
  var MAXANI = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  function roundedShape(w, h, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function slab(w, h, r, d) {
    var g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: d * 0.35, bevelSize: Math.min(r * 0.5, 0.04), bevelSegments: 3, curveSegments: 6 });
    g.center(); return g;
  }
  // 実画面の面（角丸）。rect は元画像のピクセル [左, 上, 右, 下]、size は元画像の [幅, 高さ]
  function face(w, h, r, size, rect) {
    var g = new THREE.ShapeGeometry(roundedShape(w, h, r), 6), pos = g.attributes.position, uv = g.attributes.uv;
    var u0 = rect[0] / size[0], u1 = rect[2] / size[0], v0 = 1 - rect[3] / size[1], v1 = 1 - rect[1] / size[1];
    for (var i = 0; i < pos.count; i++) uv.setXY(i, u0 + (pos.getX(i) / w + 0.5) * (u1 - u0), v0 + (pos.getY(i) / h + 0.5) * (v1 - v0));
    uv.needsUpdate = true;
    return g;
  }
  // ぼかした角丸の影（白で描いて、色はマテリアルで付ける）
  var SHADOW = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    g.shadowColor = '#fff'; g.shadowBlur = 20; g.shadowOffsetX = 1000; g.fillStyle = '#fff';
    g.fillRect(28 - 1000, 28, 72, 72);
    return new THREE.CanvasTexture(c);
  })();
  var UNIT = new THREE.PlaneGeometry(1, 1);

  /* ---------- 画像（1枚目を先に、残りはあと。1枚でも読めなかったら静止版にする） ---------- */
  var IMG = sec.dataset.mfAssets || 'assets/';
  var loader = new THREE.TextureLoader();
  loader.setCrossOrigin(undefined);   // 同じサイトの画像なので CORS なしで取る（head で先に取りに行った分をそのまま使う）
  var TEX = {};
  function texEntry(src) { return TEX[src] || (TEX[src] = { tex: null, mats: [], req: false, failed: false }); }
  function useTex(mat, src) { var e = texEntry(src); if (e.tex) { mat.map = e.tex; mat.needsUpdate = true; } else e.mats.push(mat); }
  function texReady(src) { var e = TEX[src]; return !!(e && e.tex); }
  function request(src, done) {
    var e = texEntry(src);
    if (e.req) return; e.req = true;
    loader.load(IMG + src, function (t) {
      t.encoding = THREE.sRGBEncoding; t.anisotropy = MAXANI; e.tex = t;
      e.mats.forEach(function (m) { m.map = t; m.needsUpdate = true; }); e.mats = [];
      if (done) done();
    }, undefined, function () { fail(src); if (done) done(); });
  }
  // 1枚目が読めず、まだ一番上にいるときだけ静止版に戻す（途中で戻すと区間の高さが縮んでページが飛ぶ）。それ以外は、その画面を出さないだけ
  function nearTop() { return window.scrollY < sec.getBoundingClientRect().top + window.scrollY + innerHeight * 0.25; }
  function fail(src) { texEntry(src).failed = true; if (src === DEF[0].img && nearTop()) giveUp(); }

  /* ---------- 場面ごとの実画面と部品（位置は「アプリの枠」の中の単位。枠はおよそ幅8.4・高さ5） ----------
     crop はスマホ縦のときに見せる範囲、wP はスマホ縦のときの幅。
     float は手前に浮かぶ別の画面（style: phone＝黒いスマホ、card＝白い紙）、docs は飛び出す書類の絵、grid は Googleマップの順位の3Dグラフ */
  var MEDIA_X = [353.5, 543.5, 733.5, 924.5, 1112.5, 1301, 1489.5];
  var DEF = [
    { img: 'app-bunseki.webp', size: [1600, 1029], w: 6.7, at: [0.3, 0.05, 0], crop: [240, 0, 1600, 760],
      pops: MEDIA_X.map(function (x) { return { rect: [x - 91, 225, x + 91, 422], r: 0.07 }; }) },
    { img: 'hero/s3-unpaid.webp', size: [1400, 875], w: 6.8, at: [-0.25, 0.45, 0], crop: [40, 0, 1010, 722], wP: 5.9,
      pops: [132, 366.4, 600.8, 659.4].map(function (y) { return { rect: [48, y, 1352, y + 58.6], r: 0.03, row: true }; }), stations: true },
    { img: 'hero/f2-keiyaku-format.webp', size: [1400, 875], w: 6.6, at: [-0.3, 0.4, 0], crop: [40, 60, 1060, 760], wP: 6.2,
      pops: [{ rect: [108, 161, 1292, 326], r: 0.06 }],
      docs: ['取引台帳', '重要事項説明書', '賃貸借契約書'] },
    { img: 'hero/f3-mypage-admin.webp', size: [1600, 1035], w: 6.6, at: [-0.3, 0.35, 0], crop: [215, 40, 1600, 800],
      pops: [{ rect: [395, 314, 892, 348], r: 0.04 }, { rect: [238, 925, 1572, 984], r: 0.03, row: true }],
      float: { img: 'hero/f3-mypage-phone.webp', size: [750, 1500], h: 3.3, at: [2.95, -0.85, 1.1], ry: -0.3, style: 'phone' } },
    { img: 'hero/f4-bukkaku.webp', size: [1367, 855], w: 6.6, at: [-0.3, 0.4, 0], crop: [20, 60, 1020, 760], wP: 6.2,
      pops: [[520, 628], [628, 730], [730, 832]].map(function (y) { return { rect: [28, y[0], 1340, y[1]], r: 0.03, row: true }; }),
      float: { img: 'hero/f4-shoki.webp', size: [660, 793], h: 2.7, at: [2.7, -0.85, 1.1], ry: -0.3, style: 'card' } },
    { img: 'hero/f5-reviews.webp', size: [1600, 1000], w: 6.5, at: [0.25, 0.45, 0], crop: [460, 60, 1600, 820], wP: 6.2,
      pops: [[462, 638], [651, 827], [841, 1017], [1030, 1206], [1220, 1396], [1410, 1587]].map(function (x) { return { rect: [x[0], 380, x[1], 464], r: 0.06 }; }),
      grid: true }
  ];
  var BUMP0 = [0, 4, 2, 6, 1, 5, 3];   // 場面0で跳ねる媒体カードの順

  // 書類の絵（題名と罫線だけ。実在の書類の写しは使わない）
  function docCanvas(title) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 724;
    function draw() {
      var g = c.getContext('2d'), F = '"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic",sans-serif';
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 724);
      g.fillStyle = '#1f2a28'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 ' + (title.length > 6 ? 40 : 46) + 'px ' + F; g.fillText(title, 256, 92);
      g.fillStyle = '#14a085'; g.fillRect(156, 130, 200, 5);
      g.fillStyle = '#e3ebe8';
      for (var i = 0; i < 3; i++) g.fillRect(56, 170 + i * 22, i === 2 ? 260 : 400, 9);
      // 表（項目の欄は薄い緑）
      g.strokeStyle = '#c9d6d2'; g.lineWidth = 2;
      for (var r = 0; r < 7; r++) {
        var y = 250 + r * 44; g.fillStyle = r % 2 ? '#ffffff' : '#f4faf8'; g.fillRect(56, y, 400, 44);
        g.fillStyle = '#e6f4f0'; g.fillRect(56, y, 120, 44);
        g.fillStyle = '#cfdcd8'; g.fillRect(70, y + 18, 80, 8); g.fillRect(192, y + 18, 120 + (r * 37) % 120, 8);
        g.strokeRect(56, y, 400, 44);
      }
      g.fillStyle = '#e3ebe8';
      for (i = 0; i < 4; i++) g.fillRect(56, 580 + i * 22, i === 3 ? 220 : 400, 9);
      g.strokeStyle = '#e07a5f'; g.lineWidth = 3; g.beginPath(); g.arc(420, 668, 22, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#e07a5f'; g.font = '700 22px ' + F; g.fillText('印', 420, 669);
    }
    draw();
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAXANI;
    if (document.fonts && document.fonts.load) document.fonts.load('900 40px "Zen Kaku Gothic New"').then(function () { draw(); t.needsUpdate = true; }).catch(function () {});
    return t;
  }
  var DOC_TEX = {};
  function docTex(title) { return DOC_TEX[title] || (DOC_TEX[title] = docCanvas(title)); }

  // Googleマップの順位（7×7 の地点。中心ほど上位）。色は順位：3位まで緑・10位まで黄・それより下は橙（実画面のヒートマップと同じ分け方）
  var GRID_R = (function () {
    var r = [], rnd = rng(11);
    for (var gy = 0; gy < 7; gy++) for (var gx = 0; gx < 7; gx++) {
      var d = Math.sqrt((gx - 3.4) * (gx - 3.4) + (gy - 3) * (gy - 3));
      r.push(Math.max(1, Math.min(20, Math.round(1 + d * 1.9 + d * d * 0.25 + rnd() * 0.6))));
    }
    return r;
  })();

  var root = new THREE.Group(); scene.add(root);
  var panels = [], builtFor = null;

  function addMat(p, m, base) { p.mats.push({ m: m, base: base, dw: m.depthWrite }); return m; }
  function std(p, col, rough, base) { return addMat(p, new THREE.MeshStandardMaterial({ color: typeof col === 'number' ? lin(col) : col, roughness: rough, metalness: 0.02, transparent: true, fog: false }), base == null ? 1 : base); }
  function basic(p, base) { return addMat(p, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, fog: false, toneMapped: false }), base); }
  function shadowMat(p, base) { return addMat(p, new THREE.MeshBasicMaterial({ map: SHADOW, color: lin(0x0b4a3e), transparent: true, depthWrite: false, fog: false, toneMapped: false }), base); }
  function mesh(geo, mat, ro, parent) { var m = new THREE.Mesh(geo, mat); m.renderOrder = ro; if (parent) parent.add(m); return m; }
  function px(p, x) { return ((x - p.crop[0]) / (p.crop[2] - p.crop[0]) - 0.5) * p.w; }
  function py(p, y) { return (0.5 - (y - p.crop[1]) / (p.crop[3] - p.crop[1])) * p.h; }

  function disposeAll() {
    panels.forEach(function (p) {
      root.remove(p.g);
      p.g.traverse(function (o) { if (o.geometry && o.geometry !== UNIT) o.geometry.dispose(); });
      p.mats.forEach(function (m) { m.m.dispose(); });
    });
    panels = [];
  }

  function build(mobile) {
    disposeAll(); builtFor = mobile;
    DEF.forEach(function (def, k) {
      var C = mobile && def.crop ? def.crop : [0, 0, def.size[0], def.size[1]];
      var w = mobile && def.wP ? def.wP : def.w;
      var p = { def: def, k: k, g: new THREE.Group(), mats: [], pops: [], crop: C, w: w, h: w * (C[3] - C[1]) / (C[2] - C[0]),
                o: -1, rv: 0, cur: new THREE.Vector2(0, 0), curOn: 0, srcs: [def.img], bump: [], bumpS: [], nextB: 0, bi: 0, rank: -1 };
      p.at = new THREE.Vector3(def.at[0], def.at[1], def.at[2]);
      // 背景に落ちる影・白い額・実画面
      var sh = mesh(UNIT, shadowMat(p, 0.24), 0, p.g); sh.scale.set((p.w + 0.4) * 1.55, (p.h + 0.4) * 1.6, 1); sh.position.set(0.2, -0.42, -0.5);
      mesh(slab(p.w + 0.36, p.h + 0.36, 0.3, 0.16), std(p, 0xffffff, 0.5), 1, p.g);
      p.faceMat = basic(p, 1); useTex(p.faceMat, def.img);
      mesh(face(p.w, p.h, 0.16, def.size, C), p.faceMat, 2, p.g).position.z = 0.15;
      var tileMat = std(p, 0xffffff, 0.55);

      // 画面から浮き出す部品（実画面の一部を切り抜いたもの。見せる範囲の外は切る）
      (def.pops || []).forEach(function (d) {
        var R = [Math.max(d.rect[0], C[0]), Math.max(d.rect[1], C[1]), Math.min(d.rect[2], C[2]), Math.min(d.rect[3], C[3])];
        if (R[2] - R[0] < 20 || R[3] - R[1] < 10) return;
        var tw = (R[2] - R[0]) / (C[2] - C[0]) * p.w, th = (R[3] - R[1]) / (C[3] - C[1]) * p.h, r = Math.min(d.r, th * 0.3);
        var t = { cx: px(p, (R[0] + R[2]) / 2), cy: py(p, (R[1] + R[3]) / 2), tw: tw, th: th, g: new THREE.Group(), row: !!d.row };
        mesh(slab(tw + 0.03, th + 0.03, r, 0.035), tileMat, 4, t.g).position.z = -0.03;
        mesh(face(tw, th, r, def.size, R), p.faceMat, 5, t.g).position.z = 0.012;
        t.g.position.set(t.cx, t.cy, 0.15);
        t.shM = addMat(p, new THREE.MeshBasicMaterial({ map: SHADOW, color: lin(0x0b4a3e), transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity: 0 }), 0);
        t.sh = mesh(UNIT, t.shM, 3, p.g);
        p.g.add(t.g); p.pops.push(t); p.bump.push(0); p.bumpS.push(0);
      });

      // 手前に浮かぶ別の画面（お客様のスマホのマイページ・初期費用のお見積り）
      if (def.float) {
        var fl = def.float, hh = fl.h, ww = hh * fl.size[0] / fl.size[1], g = new THREE.Group(), isPhone = fl.style === 'phone';
        mesh(slab(ww + (isPhone ? 0.18 : 0.08), hh + (isPhone ? 0.18 : 0.08), isPhone ? 0.28 : 0.08, isPhone ? 0.14 : 0.05),
             isPhone ? addMat(p, new THREE.MeshStandardMaterial({ color: lin(0x1d2826), roughness: 0.35, metalness: 0.25, transparent: true, fog: false }), 1) : std(p, 0xffffff, 0.5), 6, g);
        var fm = basic(p, 1); useTex(fm, fl.img);
        mesh(face(ww, hh, isPhone ? 0.2 : 0.05, fl.size, [0, 0, fl.size[0], fl.size[1]]), fm, 7, g).position.z = isPhone ? 0.135 : 0.06;
        p.g.add(g);
        var psh = mesh(UNIT, shadowMat(p, 0.3), 3, p.g); psh.scale.set(ww * 1.7, hh * 1.45, 1);
        p.float = { g: g, sh: psh, at: new THREE.Vector3(fl.at[0], fl.at[1], fl.at[2]), ry: fl.ry, w: ww, h: hh };
        p.srcs.push(fl.img);
      }

      // 飛び出す書類の絵（奥から 取引台帳・重要事項説明書・賃貸借契約書。右下へ階段状にずらして、どの題名も見えるように）
      if (def.docs) {
        p.docs = [];
        var dW = 1.62, dH = dW * 724 / 512, dgeo = slab(dW + 0.04, dH + 0.04, 0.05, 0.03), dshM = shadowMat(p, 0.22);
        def.docs.forEach(function (title, i) {
          var dg = new THREE.Group(), dm = basic(p, 1); dm.map = docTex(title);
          mesh(dgeo, std(p, 0xffffff, 0.6), 6 + i * 2, dg);
          mesh(face(dW, dH, 0.04, [512, 724], [0, 0, 512, 724]), dm, 7 + i * 2, dg).position.z = 0.03;
          var dsh = mesh(UNIT, dshM, 3, dg); dsh.scale.set(dW * 1.5, dH * 1.35, 1); dsh.position.set(0.18, -0.22, -0.12);
          p.g.add(dg);
          p.docs.push({ g: dg, at: new THREE.Vector3(1.75 + i * 0.75, 0.2 - i * 0.6, 1.0 + i * 0.3), ry: -0.22 + i * 0.03, rz: 0.04 - i * 0.04, w: dW, h: dH });
        });
        p.docH = dH;
      }

      // Googleマップの順位の3Dグラフ（7×7。高いほど上位）
      if (def.grid) {
        var gg = new THREE.Group(), cell = 0.245, pitch = 0.29, bg = new THREE.BoxGeometry(1, 1, 1);
        var mG = std(p, 0x34a853, 0.55), mY = std(p, 0xf4c542, 0.55), mO = std(p, 0xee8a3a, 0.55);
        mesh(slab(7 * pitch + 0.24, 7 * pitch + 0.24, 0.12, 0.05), std(p, 0xffffff, 0.6), 5, gg).rotation.x = -Math.PI / 2;
        p.cols = [];
        for (var gi = 0; gi < 49; gi++) {
          var rk = GRID_R[gi], cx = (gi % 7 - 3) * pitch, cz = (Math.floor(gi / 7) - 3) * pitch;
          var cm = mesh(bg, rk <= 3 ? mG : rk <= 10 ? mY : mO, 6, gg);
          cm.position.set(cx, 0, cz);
          p.cols.push({ m: cm, x: cx, z: cz, h: 0.06 + (21 - rk) / 20 * 0.62, d: Math.sqrt(cx * cx + cz * cz), cell: cell });
        }
        gg.position.set(2.3, -1.45, 1.0); gg.rotation.set(0.95, -0.25, 0);
        p.g.add(gg); p.grid = gg;
      }

      // 申込 → 審査 → 契約 → 入金 の駅（丸）とレーン（画面の下の手前）。駅の名前は HTML の札
      if (def.stations) {
        p.stations = [];
        var pts = [], DOT = new THREE.SphereGeometry(0.17, 24, 16);
        for (var j = 0; j < 4; j++) {
          var bx = -2.3 + j * 1.53, by = -p.h / 2 - 0.36 + Math.sin(j * 1.3) * 0.1;
          var st = mesh(DOT, std(p, j === 3 ? 0xe07a5f : 0x14a085, 0.45), 6, p.g);
          st.position.set(bx, by, 0.75); p.stations.push({ m: st, x: bx, y: by });
          pts.push(new THREE.Vector3(bx, by, 0.75));
        }
        p.curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.3, -p.h / 2 - 0.1, 0.75)].concat(pts, [new THREE.Vector3(3.2, -p.h / 2 - 0.2, 0.75)]), false, 'centripetal');
        mesh(new THREE.TubeGeometry(p.curve, 80, 0.05, 8, false), std(p, 0x9fdccd, 0.6, 0.9), 5, p.g);
        var beadM = std(p, 0x2bbfa3, 0.4), bead = new THREE.SphereGeometry(0.075, 16, 10);
        p.flow = [];
        for (j = 0; j < 7; j++) p.flow.push(mesh(bead, beadM, 7, p.g));
      }

      // 縦長の配置に使う、この画面の上端・下端・左右の広がり（アプリの枠の単位。札は付け位置まで）
      var tagged = tags.some(function (tg) { return tg.sc === k && tg.n === 0 && !def.stations; });
      p.top = p.at.y + p.h / 2 + 0.18 + (tagged ? 0.42 : 0);
      p.bot = p.at.y - p.h / 2 - 0.18;
      p.hw = Math.max(Math.abs(p.at.x - p.w / 2 - 0.18), Math.abs(p.at.x + p.w / 2 + 0.18));
      if (p.float) { p.bot = Math.min(p.bot, p.at.y + p.float.at.y - p.float.h / 2 - 0.12); p.hw = Math.max(p.hw, Math.abs(p.at.x + p.float.at.x + p.float.w / 2 + 0.12)); }
      if (p.stations) { p.bot = Math.min(p.bot, p.at.y - p.h / 2 - 0.36 - 0.2); p.hw = Math.max(p.hw, Math.abs(p.at.x - 3.3), Math.abs(p.at.x + 3.2)); }
      if (p.docs) { var d2 = p.docs[2]; p.bot = Math.min(p.bot, p.at.y + d2.at.y - p.docH / 2 - 0.1); p.hw = Math.max(p.hw, Math.abs(p.at.x + d2.at.x + d2.w / 2 + 0.35)); }
      if (p.grid) { p.bot = Math.min(p.bot, p.at.y - 1.45 - 1.05); p.top = Math.max(p.top, p.at.y - 1.45 + 1.5); p.hw = Math.max(p.hw, Math.abs(p.at.x + 2.3 + 1.35)); }
      root.add(p.g); panels.push(p);
    });
    anchorTags();
  }

  // 1枚目が届いたら、残りを場面の順に1枚ずつ取りに行く（届かなくても少し待ったら始める）。見に行った場面の画像は割り込みで先に取る
  var ORDER = [];
  DEF.forEach(function (d) { ORDER.push(d.img); if (d.float) ORDER.push(d.float.img); });
  function requestRest() { for (var i = 0; i < ORDER.length; i++) if (!texEntry(ORDER[i]).req) { request(ORDER[i], requestRest); return; } }
  request(DEF[0].img, requestRest);
  if (FORCE_P != null) ORDER.forEach(function (s) { request(s); }); else setTimeout(requestRest, 2500);
  // 1枚目が9秒たっても届かず、まだ一番上にいるときは静止版にする（応答が返ってこないまま止まったとき）
  if (FORCE_P == null) setTimeout(function () { if (!texReady(DEF[0].img) && nearTop()) giveUp(); }, 9000);

  /* ---------- 画面の大きさに合わせた配置 ---------- */
  var V = {};
  var appQ = new THREE.Quaternion(), appC = new THREE.Vector3();
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(),
      _e = new THREE.Euler(), _m = new THREE.Matrix4(), tiltQ = new THREE.Quaternion(), tiltFull = new THREE.Quaternion(), qI = new THREE.Quaternion(),
      _pl = new THREE.Plane(), _n = new THREE.Vector3();
  var buddy = sec.querySelector('.mf-buddy'), say = sec.querySelector('.mf-say'), veil = sec.querySelector('.mf-veil');
  var TOPU = 3.2, BOTU = -2.75;   // 横長での3D（札を含む）の上端・下端（アプリの枠の単位）。縦長は画面ごとの上端・下端（p.top・p.bot）で決める

  function shown(el) { return !!el && el.getClientRects().length > 0; }
  function layout() {
    var w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight, asp = w / h;
    var mobile = PORTRAIT_MQ.matches, D, VW, VH, ax, ay, ppu, fit = null, Bk = [];
    var cs = getComputedStyle(sec), head = parseFloat(cs.getPropertyValue('--mf-head')) || 0, bot = parseFloat(cs.getPropertyValue('--mf-bot')) || 0;
    var sr = stage.getBoundingClientRect();
    function top(el) { return el.getBoundingClientRect().top - sr.top; }
    if (builtFor !== mobile) build(mobile);
    var T = head + 12, B = h - bot - 10;
    if (!mobile) {
      // 横長: 右側に置く。下はマスコットと吹き出しの上まで、上はヘッダーの下まで
      var share = asp >= 1.5 ? 0.48 : asp >= 1.25 ? 0.42 : 0.38;
      D = Math.max((8.4 / share) / (2 * TAN * asp), (5.0 / 0.62) / (2 * TAN));
      ppu = h / (2 * D * TAN);
      if (shown(buddy)) { B = Math.min(B, top(buddy) - 14); if (shown(say)) B = Math.min(B, top(say) - 10); }
      var need = (B - T) / (TOPU - BOTU);
      if (need > 0 && ppu > need) ppu = need;
      VH = h / ppu; VW = VH * asp; D = VH / (2 * TAN);
      ax = 0.44 * VW - 4.4;
      var lo = -BOTU + (h / 2 - B) / ppu, hi = (h / 2 - T) / ppu - TOPU;
      ay = lo > hi ? (lo + hi) / 2 : clamp(h <= 600 ? 0.15 : -0.1, lo, hi);
    } else {
      // 縦長: 上に置く。マスコットの下から文章の上までを使い、横は画面幅いっぱい近くまで大きくする
      if (shown(buddy)) T = Math.max(T, buddy.getBoundingClientRect().bottom - sr.top + 6);
      if (shown(say)) T = Math.max(T, say.getBoundingClientRect().bottom - sr.top + 4);
      T += 14;   // 札は付け位置より 12px ほど上にはみ出す
      panelsEl.forEach(function (el) {
        var c = el.querySelector('.mf-copy'); if (!c) return;
        B = Math.min(B, top(c) - (parseFloat(el.style.getPropertyValue('--hy')) || 0) - 14);
      });
      // 場面ごとに「マスコットの下〜その場面の文章の上」と画面幅の90%に収まる大きさを出し、いちばん大きい場面に合わせてカメラを決める。
      // ほかの場面はその比率で縮めて、自分の範囲の真ん中に置く
      var pk = [], m = 0;
      panelsEl.forEach(function (el) {
        var c = el.querySelector('.mf-copy'); if (!c) return;
        Bk[+el.dataset.mfStep] = Math.min(B, top(c) - (parseFloat(el.style.getPropertyValue('--hy')) || 0) - 20);
      });
      ppu = 0;
      for (var k = 0; k < DEF.length; k++) {
        if (Bk[k] == null) Bk[k] = B;
        var pp = panels[k];
        pk[k] = Math.max(4, Math.min((Bk[k] - T) / (pp.top - pp.bot), 0.9 * w / (2 * pp.hw)));   // 傾きと手前のスマホの遠近で少し大きく見えるので 90% まで
        if (pk[k] > ppu) { ppu = pk[k]; m = k; }
      }
      VH = h / ppu; VW = VH * asp; D = VH / (2 * TAN);
      ax = 0;
      ay = ((h / 2 - (T + Bk[m]) / 2) / ppu - (panels[m].top + panels[m].bot) / 2) / 0.45;   // カメラは ay の 0.55 倍の高さから見る
      fit = pk.map(function (q, k2) { var sc = q / ppu, pp = panels[k2]; return { s: sc, off: (h / 2 - (T + Bk[k2]) / 2) / ppu - 0.45 * ay - (pp.top + pp.bot) / 2 * sc }; });
    }
    V = { w: w, h: h, asp: asp, mobile: mobile, D: D, VW: VW, VH: VH, ax: ax, ay: ay, T: T, B: B, fit: fit, textTop: mobile ? Bk.map(function (b) { return b + 20; }) : null };
    if (!mobile && veil) veil.style.removeProperty('--veil-h');
    renderer.setPixelRatio(lowRes ? lowResRatio() : Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(w, h, false);
    cam.aspect = asp; cam.updateProjectionMatrix();
    scene.fog.density = 0.32 / D;
    appQ.setFromEuler(new THREE.Euler(mobile ? 0 : 0.03, mobile ? 0 : -0.16, 0));
    appC.set(ax, ay, 0);
    root.position.copy(appC);
  }

  /* ---------- カーソル ---------- */
  var clock = new THREE.Clock();
  var ndc = new THREE.Vector2(), ndcS = new THREE.Vector2(), lastMove = -10, pointer = false;
  var ray = new THREE.Raycaster(), planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  var cur = new THREE.Vector3(), curS = new THREE.Vector3();
  window.addEventListener('pointermove', function (e) {
    var r = stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    lastMove = clock.getElapsedTime(); pointer = true;
  }, { passive: true });
  // その画面の上でのカーソルの位置（画面の単位）。近い部品ほど 1 に近い
  function near(p, x, y, R) {
    var dx = x - p.cur.x, dy = y - p.cur.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d >= R) return 0; var f = 1 - d / R; return f * f * p.curOn;
  }

  /* ---------- スクロール量 → 場面 ---------- */
  var SPAN = LAST + 0.6;
  function scrollSpan() { return sec.offsetHeight - stage.offsetHeight; }
  function readProgress() {
    var r = sec.getBoundingClientRect(), span = scrollSpan();
    var x = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
    var q = x * SPAN, s = Math.floor(q), f = q - s;
    return s >= LAST ? LAST : s + smooth(0.16, 0.84, f);
  }

  /* ---------- 文章・目次・マスコット・札 ---------- */
  var panelsEl = Array.prototype.slice.call(sec.querySelectorAll('[data-mf-step]'));
  var navDots = Array.prototype.slice.call(sec.querySelectorAll('[data-mf-dot]'));
  var mascot = sec.querySelector('.mf-mascot'), navEl = sec.querySelector('.mf-nav');
  var SAYS = (say && say.dataset.says ? say.dataset.says : '').split('|');
  var lastPhase = -1;
  function setTabbable(el, on) { el.querySelectorAll('a, button').forEach(function (a) { if (on) a.removeAttribute('tabindex'); else a.tabIndex = -1; }); }
  navDots.forEach(function (d) {
    d.setAttribute('role', 'button');
    d.addEventListener('click', function () {
      var ph = +d.dataset.mfDot, y = sec.getBoundingClientRect().top + window.scrollY + scrollSpan() * (ph >= LAST ? LAST + 0.25 : ph) / SPAN;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  // 札: data-at="場面:番号"。付ける相手（0＝画面の左上、1＝手前のスマホ・紙・書類・3Dグラフの上、駅の場面は駅の上）は作り直すたびに付け直す
  var tags = Array.prototype.slice.call(sec.querySelectorAll('.mf-tag')).map(function (el) {
    var t = el.dataset.at.split(':'); return { el: el, sc: +t[0], n: +t[1], off: new THREE.Vector3() };
  });
  function anchorTags() {
    tags.forEach(function (tg) {
      var p = panels[tg.sc]; tg.obj = p.g; tg.wd = 0;
      if (p.stations) { tg.obj = p.stations[tg.n].m; tg.off.set(0, 0.5, 0.1); }
      else if (tg.n === 1 && p.float) { tg.obj = p.float.g; tg.off.set(0, p.float.h / 2 + 0.38, 0.1); }
      else if (tg.n === 1 && p.docs) { tg.obj = p.docs[2].g; tg.off.set(0.5, p.docH / 2 + 0.36, 0.1); }
      else if (tg.n === 1 && p.grid) { tg.obj = p.grid; tg.off.set(0, 0.35, -1.25); }
      else if (tg.n === 1) tg.off.set(p.w / 2 - 0.95, p.h / 2 + 0.42, 0.2);
      else tg.off.set(-p.w / 2 + 0.75, p.h / 2 + 0.42, 0.2);
    });
  }

  function updateDom(P, t) {
    panelsEl.forEach(function (el) {
      var s = +el.dataset.mfStep, o = clamp(1 - Math.abs(P - s) * 2.3, 0, 1);
      if (s === 0 && P < 0.05) o = 1;
      el.style.opacity = o.toFixed(3);
      el.style.setProperty('--hy', ((s - P) * 40).toFixed(1) + 'px');
      var on = o > 0.6;
      if (el.classList.contains('is-on') !== on) { el.classList.toggle('is-on', on); setTabbable(el, on); }
    });
    var ph = Math.round(P);
    if (ph !== lastPhase) {
      lastPhase = ph;
      navDots.forEach(function (d) { d.classList.toggle('on', +d.dataset.mfDot === ph); });
      if (say && SAYS[ph]) { say.textContent = SAYS[ph]; say.classList.remove('pop'); void say.offsetWidth; say.classList.add('pop'); }
    }
    if (navEl) { var no = clamp((sec.getBoundingClientRect().bottom - innerHeight) / 140, 0, 1); navEl.style.opacity = no.toFixed(2); navEl.style.pointerEvents = no < 0.5 ? 'none' : ''; }
    // 縦長: 白い膜は今の場面の文章の上端から下だけ（3Dの下の方を白く消さない）
    if (veil && V.textTop) {
      var a0 = Math.floor(P), a1 = Math.min(LAST, a0 + 1), tt = V.textTop[a0] + (V.textTop[a1] - V.textTop[a0]) * (P - a0);
      var vh = Math.round(V.h - tt + 10);
      if (vh !== V.vh) { V.vh = vh; veil.style.setProperty('--veil-h', vh + 'px'); }
    }
    if (mascot) {
      mascot.style.setProperty('--ry', (ndcS.x * 40).toFixed(1) + 'deg');
      mascot.style.setProperty('--rx', (ndcS.y * 22).toFixed(1) + 'deg');
      mascot.style.setProperty('--mx', (ndcS.x * 8).toFixed(1) + 'px');
      mascot.style.setProperty('--bob', (Math.sin(t * 2.2) * 5).toFixed(1) + 'px');
    }
  }
  function updateTags(P) {
    var crowd = false, prev = null;
    tags.forEach(function (tg) {
      var p = panels[tg.sc];
      tg.o = p.g.visible ? clamp(1 - Math.abs(P - tg.sc) * 2.6, 0, 1) * p.rv : 0;
      if (tg.o <= 0.01) return;
      _v.copy(tg.off); tg.obj.localToWorld(_v); _v.project(cam);
      tg.x = (_v.x + 1) / 2 * V.w; tg.y = (1 - _v.y) / 2 * V.h - 12;
      // 駅の札が横にくっつくほど3Dが小さいときは、駅の札を出さない
      if (p.stations) {
        if (!tg.wd) tg.wd = tg.el.offsetWidth;
        if (prev && tg.x - prev.x < (tg.wd + prev.wd) / 2 + 8) crowd = true;
        prev = tg;
      }
    });
    tags.forEach(function (tg) {
      var o = panels[tg.sc].stations && crowd ? 0 : tg.o;
      if (o <= 0.01) { if (tg.el.style.opacity !== '0') tg.el.style.opacity = '0'; return; }
      tg.el.style.opacity = o.toFixed(3);
      if (!tg.wd) tg.wd = tg.el.offsetWidth;
      var x = clamp(tg.x, tg.wd / 2 + 8, V.w - tg.wd / 2 - 8);   // 画面の端からはみ出さないように
      tg.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + tg.y.toFixed(1) + 'px,0) translateX(-50%)';
    });
  }

  /* ---------- 部品の動き ---------- */
  function setPop(p, t, lift, a, nr) {
    var on = lift > 0.012;
    t.g.visible = on; t.sh.visible = on;
    if (!on) return;
    t.g.position.z = 0.15 + lift;
    var sc = 1 + 0.045 * nr;
    t.g.scale.set(t.row ? 1 : sc, sc, 1);   // 行は横に広げない（額の外にはみ出さないように）
    t.g.rotation.set((p.cur.y - t.cy) * -0.05 * nr, t.row ? 0 : (p.cur.x - t.cx) * 0.03 * nr, 0);
    var l = clamp(lift / 0.5, 0, 1.4);
    if (t.row) { t.sh.position.set(t.cx, t.cy - 0.18 * l, 0.152); t.sh.scale.set(t.tw, t.th * (1.4 + 0.4 * l) + 0.1 * l, 1); }
    else { t.sh.position.set(t.cx + 0.1 * l, t.cy - 0.22 * l, 0.152); t.sh.scale.set(t.tw * (1.3 + 0.35 * l), t.th * (1.3 + 0.35 * l) + 0.12 * l, 1); }
    t.shM.opacity = p.o * (t.row ? 0.26 : 0.34) * clamp(l * 1.6, 0, 1) * a;
  }

  function animate(p, act, t, dt) {
    var k = p.k, j, a, nr;
    for (j = 0; j < p.bump.length; j++) { p.bump[j] *= Math.max(0, 1 - dt * 2.2); p.bumpS[j] += (p.bump[j] - p.bumpS[j]) * Math.min(1, dt * 9); }
    if (k === 0 && t > p.nextB) { p.bump[BUMP0[p.bi % BUMP0.length] % p.bump.length] = 1; p.bi++; p.nextB = t + 0.8; }
    p.pops.forEach(function (tl2, j2) {
      a = ease(clamp((act - j2 * (tl2.row ? 0.04 : 0.05)) / 0.7, 0, 1));
      nr = near(p, tl2.cx, tl2.cy, tl2.row ? 1.1 : 1.5);
      var base;
      if (k === 0) base = 0.42 + 0.07 * Math.sin(t * 1.5 + j2 * 0.8) + 0.3 * p.bumpS[j2];
      else base = 0.3 + 0.06 * Math.sin(t * 1.5 + j2 * 0.9);
      setPop(p, tl2, a * base + nr * (tl2.row ? 0.42 : 0.5) * act, a, nr);
    });
    if (p.float) {
      var fl = p.float, aP = ease(clamp((act - 0.2) / 0.8, 0, 1));
      fl.g.visible = fl.sh.visible = aP > 0.01;
      fl.g.position.set(fl.at.x + (1 - aP) * 2.6, fl.at.y + Math.sin(t * 1.1) * 0.07 - (1 - aP) * 0.4, fl.at.z + (1 - aP) * 0.6);
      fl.g.rotation.set(-ndcS.y * 0.08, fl.ry + ndcS.x * 0.14 - (1 - aP) * 0.5, 0.03);
      fl.sh.position.set(fl.g.position.x + 0.35, fl.g.position.y - 0.35, 0.16);
    }
    if (p.docs) {
      // 画面の中から1枚ずつ飛び出して、手前で扇に広がる
      p.docs.forEach(function (dc, i) {
        a = ease(clamp((act - 0.15 - i * 0.12) / 0.6, 0, 1));
        dc.g.visible = a > 0.01;
        var bob = Math.sin(t * 1.2 + i * 1.3) * 0.06;
        dc.g.position.set(0.5 + (dc.at.x - 0.5) * a, 0.3 + (dc.at.y - 0.3) * a + bob, 0.15 + (dc.at.z - 0.15) * a);
        var sc = 0.45 + 0.55 * a; dc.g.scale.set(sc, sc, sc);
        dc.g.rotation.set(-ndcS.y * 0.08, dc.ry * a + ndcS.x * 0.12, dc.rz * a);
      });
    }
    if (p.grid) {
      // 中心から外へ順に立ち上がる
      var ga = smooth(0.1, 0.9, act);
      p.grid.visible = ga > 0.01;
      p.cols.forEach(function (cl) {
        var aa = ease(clamp(ga * 1.6 - cl.d * 0.45, 0, 1));
        var hh = Math.max(0.001, cl.h * aa * (1 + Math.sin(t * 1.6 - cl.d * 2.2) * 0.06));
        cl.m.scale.set(cl.cell, hh, cl.cell); cl.m.position.y = 0.03 + hh / 2;
      });
      p.grid.rotation.y = -0.25 + ndcS.x * 0.18;
    }
    if (p.stations) {
      p.stations.forEach(function (st, j5) {
        a = ease(clamp((act - 0.2 - j5 * 0.08) / 0.55, 0, 1));
        var b = (0.001 + a) * (1 + Math.sin(t * 2 + j5) * 0.04);
        st.m.scale.set(b, b, b); st.m.visible = a > 0.01;
        st.m.position.y = st.y + Math.sin(t * 1.3 + j5 * 1.1) * 0.05;
      });
      var fa = smooth(0.4, 1, act);
      p.flow.forEach(function (f, j6) {
        var uu = frac(t * 0.07 + j6 / p.flow.length);
        p.curve.getPointAt(uu, _v); f.position.set(_v.x, _v.y, _v.z + 0.02);
        var sc = fa * Math.min(1, Math.sin(uu * Math.PI) * 3);
        f.scale.set(Math.max(0.001, sc), Math.max(0.001, sc), Math.max(0.001, sc)); f.visible = sc > 0.01;
      });
    }
  }

  /* ---------- 毎フレーム ---------- */
  var P = FORCE_P != null ? FORCE_P : 0, introT = -1, last = 0, running = false, raf = 0, dead = false;
  var perfN = 0, perfT0 = 0, perfDone = false, lowRes = false;
  function lowResRatio() { return (window.devicePixelRatio || 1) > 1 ? 1 : 0.8; }
  function frame() {
    if (!running) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    var t = clock.getElapsedTime(), dt = Math.min(0.05, t - last); last = t;
    var target = FORCE_P != null ? FORCE_P : readProgress();
    P += (target - P) * Math.min(1, dt * 4.2);
    if (Math.abs(target - P) < 0.0005) P = target;
    panels.forEach(function (p) { if (Math.abs(P - p.k) < 1.2) p.srcs.forEach(function (s) { request(s); }); });
    // 1枚目の画像が届いたところから、下から回ってくる登場の動きを始める
    if (introT < 0 && panels[0] && texReady(DEF[0].img)) introT = t;
    var intro = FORCE_P != null ? 1 : introT < 0 ? 0 : ease(clamp((t - introT) / 2.0, 0, 1));
    if (introT < 0 && FORCE_P == null && (texEntry(DEF[0].img).failed || t > 9) && nearTop()) { giveUp(); return; }
    // 描画が重い端末（毎秒35コマ未満）は、登場から約1秒で解像度を下げる
    if (!perfDone && introT >= 0) {
      perfN++;
      if (perfN === 8) perfT0 = t;
      else if (perfN > 8 && t - perfT0 > 1.0) {
        perfDone = true;
        if ((perfN - 8) / (t - perfT0) < 35) { lowRes = true; renderer.setPixelRatio(lowResRatio()); renderer.setSize(V.w, V.h, false); }
      }
    }

    if (!pointer || t - lastMove > 3) ndc.set(Math.sin(t * 0.33) * 0.5, Math.cos(t * 0.27) * 0.35);
    ndcS.x += (ndc.x - ndcS.x) * Math.min(1, dt * 5); ndcS.y += (ndc.y - ndcS.y) * Math.min(1, dt * 5);

    var par = V.D / 15, cy = V.mobile ? V.ay * 0.55 : 0;
    cam.position.set(ndcS.x * 0.55 * par, cy + ndcS.y * 0.32 * par, V.D);
    cam.lookAt(0, cy, 0);
    cam.updateMatrixWorld();
    ray.setFromCamera(ndcS, cam);
    if (ray.ray.intersectPlane(planeZ, cur)) curS.lerp(cur, Math.min(1, dt * 7));
    curLight.position.set(curS.x, curS.y, curS.z + 2.4); curLight.distance = 7 * par;

    // 画面全体がカーソルの方へ傾く
    tiltFull.setFromEuler(_e.set(-ndcS.y * 0.14, ndcS.x * 0.22, 0));
    tiltQ.copy(qI).slerp(tiltFull, 0.9);
    root.quaternion.copy(appQ).premultiply(tiltQ);
    root.updateMatrixWorld();

    var Rd = 3.8;
    panels.forEach(function (p) {
      var ok = p.srcs.every(texReady);
      p.rv = ok ? Math.min(1, p.rv + dt * 2.5) : 0;   // 画像が届くまでは出さない。届いたらふわっと出す
      var d = P - p.k;
      if (p.k === 0) d -= (1 - intro) * 0.9;   // 最初は下から回ってくる
      var ad = Math.abs(d);
      if (ad >= 0.97 || p.rv <= 0) { p.g.visible = false; return; }
      p.g.visible = true;
      var o = (1 - (d > 0 ? smooth(0.18, 0.6, ad) : smooth(0.25, 0.75, ad))) * p.rv;   // 上へ出ていく画面は早めに消す
      if (o < 0.02) { p.g.visible = false; return; }
      if (Math.abs(o - p.o) > 0.002) { p.o = o; p.mats.forEach(function (m) { m.m.opacity = m.base * o; }); }
      var th = d * 0.75;
      var F = V.fit ? V.fit[p.k] : null, sc = F ? F.s : 1;
      p.g.position.set(sc * p.at.x, sc * (p.at.y + Rd * Math.sin(th)) + (F ? F.off : 0), sc * (p.at.z + Rd * (Math.cos(th) - 1)));
      p.g.rotation.set(-th, 0, 0);
      p.g.scale.setScalar(sc);
      p.g.updateMatrixWorld();
      // カーソルの位置（その画面の上）
      if (ad < 0.5) {
        _n.set(0, 0, 1).transformDirection(p.g.matrixWorld);
        _pl.setFromNormalAndCoplanarPoint(_n, _v.setFromMatrixPosition(p.g.matrixWorld));
        if (ray.ray.intersectPlane(_pl, _v2)) {
          p.g.worldToLocal(_v2);
          p.cur.x += (_v2.x - p.cur.x) * Math.min(1, dt * 8); p.cur.y += (_v2.y - p.cur.y) * Math.min(1, dt * 8);
        }
        p.curOn += (1 - p.curOn) * Math.min(1, dt * 3);
      } else p.curOn = 0;
      animate(p, 1 - smooth(0.05, 0.5, ad), t, dt);
      p.g.updateMatrixWorld(true);
    });

    order();
    renderer.render(scene, cam);
    updateDom(P, t);
    updateTags(P);
  }

  // 切り替わりで2枚の画面が重なるとき: 濃い方を先に描き、薄い方はあとから奥行きを書かずに重ねる
  // （薄くなった画面が奥行きだけ書いて、もう一方の画面に穴をあけないように）
  function order() {
    var vis = panels.filter(function (p) { return p.g.visible; }).sort(function (a, b) { return b.o - a.o; });
    vis.forEach(function (p, i) {
      if (p.rank === i) return;
      p.rank = i;
      var ro = i * 20;
      p.g.traverse(function (o) { if (o.isGroup) o.renderOrder = ro; });   // 入れ子の Group ごとに描く順の組が決まるので、全部に同じ値を入れる
      p.mats.forEach(function (m) { m.m.depthWrite = m.dw && i === 0; });
    });
    panels.forEach(function (p) { if (!p.g.visible) p.rank = -1; });
  }
  function start() { if (!running && !dead) { running = true; last = clock.getElapsedTime(); if (!raf) raf = requestAnimationFrame(frame); } }
  function stop() { running = false; }
  // 画像が読めなかったときは、今までのトップ（静止版）に戻す
  function giveUp() {
    if (dead) return;
    dead = true; stop();
    sec.classList.remove('mf--live'); sec.classList.add('mf--static');
    panelsEl.forEach(function (el) { el.style.opacity = ''; el.style.removeProperty('--hy'); el.classList.remove('is-on'); setTabbable(el, true); });
    tags.forEach(function (tg) { tg.el.style.opacity = '0'; });
  }
  new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting && !document.hidden) start(); else stop(); });
  }, { rootMargin: '80px 0px' }).observe(sec);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else { var r = sec.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) start(); }
  });
  var rsT = 0, lastW = 0, lastH = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rsT);
    rsT = setTimeout(function () { var w = stage.clientWidth, h = stage.clientHeight; if (w === lastW && h === lastH) return; lastW = w; lastH = h; layout(); }, 160);
  });

  if (QS.has('mfDebug')) {
    // 確認用: 見えている3Dの部品（影は除く）が画面のどこまで来ているか（CSS ピクセル）
    var bounds = function () {
      var r = canvas.getBoundingClientRect(), L = 1e9, R = -1e9, T = 1e9, B = -1e9, box = new THREE.Box3(), c = new THREE.Vector3(), mi = new THREE.Matrix4();
      function take(geo, mw) {
        if (!geo.boundingBox) geo.computeBoundingBox();
        box.copy(geo.boundingBox);
        for (var n = 0; n < 8; n++) {
          c.set(n & 1 ? box.max.x : box.min.x, n & 2 ? box.max.y : box.min.y, n & 4 ? box.max.z : box.min.z).applyMatrix4(mw).project(cam);
          var x = r.left + (c.x + 1) / 2 * r.width, y = r.top + (1 - c.y) / 2 * r.height;
          L = Math.min(L, x); R = Math.max(R, x); T = Math.min(T, y); B = Math.max(B, y);
        }
      }
      panels.forEach(function (p) {
        if (!p.g.visible || p.o < 0.5) return;
        p.g.traverseVisible(function (o) {
          if (!o.isMesh || o.geometry === UNIT) return;
          if (o.isInstancedMesh) { for (var i = 0; i < o.count; i++) { o.getMatrixAt(i, mi); _s.setFromMatrixScale(mi); if (_s.x > 0.02) take(o.geometry, mi.premultiply(o.matrixWorld)); } }
          else take(o.geometry, o.matrixWorld);
        });
      });
      return { L: Math.round(L), R: Math.round(R), T: Math.round(T), B: Math.round(B) };
    };
    window.__mf = { panels: function () { return panels; }, root: root, cam: cam, bounds: bounds, getP: function () { return P; }, getV: function () { return V; },
      ready: function () { return panels.length > 0 && panels.every(function (p) { return p.srcs.every(texReady); }); } };
  }
  layout();
  lastW = stage.clientWidth; lastH = stage.clientHeight;
  panelsEl.forEach(function (el) { var on = +el.dataset.mfStep === 0; el.classList.toggle('is-on', on); setTabbable(el, on); });
  curS.set(V.ax, V.ay, 0);
  start();
})();
