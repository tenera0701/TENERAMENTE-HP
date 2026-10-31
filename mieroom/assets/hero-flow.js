/* ミエルーム — トップの3D「反響から入金まで」（hero-flow.css と対。TENERAMENTE の assets/hero-system.js と同じ作り）
   ミエルームの実画面を、傾いた3Dの額に入れて見せる。スクロールすると、ドラムが回るように下から次の画面が回ってくる:
     0 反響分析     （媒体ごとの反響カードが画面から浮き出し、順に跳ねる）
     1 反響の一覧   （右から反響メールが飛び込み、届いた媒体の行が浮く）
     2 追客・接客   （接客管理表の数字が浮き、申込率の棒が3Dで立ち上がる。手前のスマホには自動返信・自動追客のメール）
     3 申込から入金 （未入金一覧の一部入金の行が浮き、申込 → 審査 → 契約 → 入金 の駅を玉が流れる）
     4 売上         （売上分析の実画面の前で、棒グラフが伸び縮みする）
   カーソルの近くの部品は持ち上がり、画面全体はカーソルの方へ傾く。マスコットはカーソルの方を向く。three.js r128（CDN）。
   画像は data-mf-assets（assets/ の場所）から読む。1枚目は index.html の head の小さなスクリプトで先に取りに行っておく。画像が届くまで額は出さない。
   実画面の切り抜き位置は元画像のピクセルで決め打ち（画像を差し替えたら測り直す）。スマホ縦では、文字が読めるように画面の要所だけを切り抜いて大きく見せる。
   WebGL が使えない・動きを減らす設定・three.js の読み込み失敗・一番上にいるうちに1枚目の画像が来ないときは .mf--static（今までのトップの見た目）にする。
   確認用: ?mfP=0〜4 でその場面に固定、?mfStatic で静止版、?mfDebug で window.__mf に中身を出す。 */
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
  var FORCE_P = QS.has('mfP') ? Math.max(0, Math.min(4, parseFloat(QS.get('mfP')) || 0)) : null;

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
     crop はスマホ縦のときに見せる範囲、wP はスマホ縦のときの幅 */
  var MEDIA_X = [353.5, 543.5, 733.5, 924.5, 1112.5, 1301, 1489.5];
  var HROW = [121, 175, 229, 282, 337, 390, 444, 497, 551];
  var ROW_C = [0xd83a15, 0x99a0ac, 0x895ee7, 0xcd2943, 0xf2a530, 0x99a0ac, 0xd50c2b, 0xc13584];   // SUUMO・HOME'S・紹介・SNS・カナリー・自社HP・アットホーム・Instagram
  var DEF = [
    { img: 'app-bunseki.webp', size: [1600, 1029], w: 6.7, at: [0.3, 0.05, 0], crop: [240, 0, 1600, 760],
      pops: MEDIA_X.map(function (x) { return { rect: [x - 91, 225, x + 91, 422], r: 0.07 }; }) },
    { img: 'hero/s1-hankyo-table.webp', size: [1400, 609], w: 7.2, at: [0.1, 0.45, 0], crop: [28, 0, 1000, 609],
      pops: HROW.slice(0, 8).map(function (y, i) { return { rect: [28, y, 1400, HROW[i + 1]], r: 0.03, row: true }; }), stream: true },
    { img: 'hero/s2-sekkyaku.webp', size: [1400, 875], w: 6.8, at: [-0.35, 0.35, 0], crop: [0, 0, 1180, 740],
      pops: [[28, 152], [456, 580], [595, 719], [734, 858]].map(function (x) { return { rect: [x[0], 213, x[1], 298], r: 0.06 }; }),
      rods: [[389, 1201], [443, 699], [496, 699], [550, 447], [603, 447], [657, 447], [710, 447]].map(function (b) { return { y: b[0], x0: 197, x1: b[1] }; }),
      phone: { img: 'hero/s2-phone-mail.webp', size: [780, 1688], h: 3.3, at: [3.0, -0.95, 1.1], ry: -0.3 } },
    { img: 'hero/s3-unpaid.webp', size: [1400, 875], w: 6.8, at: [-0.25, 0.45, 0], crop: [40, 0, 1010, 722], wP: 5.9,
      pops: [132, 366.4, 600.8, 659.4].map(function (y) { return { rect: [48, y, 1352, y + 58.6], r: 0.03, row: true }; }), stations: true },
    { img: 'app-uriage-hd.webp', size: [1600, 764], w: 7.0, at: [0.3, 0.35, 0], crop: [250, 0, 1600, 764], bars: 8 }
  ];
  var BUMP0 = [0, 4, 2, 6, 1, 5, 3];   // 場面0で跳ねる媒体カードの順
  var TGT1 = [0, 3, 6, 1, 4, 7, 2, 5, 0];   // 場面1で反響メールが飛び込む行

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

      // 場面1: 右から飛び込む反響メール（白いカード＋媒体の色の丸）
      if (def.stream && p.pops.length) {
        var NS = TGT1.length, r1 = rng(7);
        p.stream = { n: NS, cards: new THREE.InstancedMesh(slab(1, 1, 0.22, 0.6), std(p, 0xffffff, 0.6), NS),
                     dots: new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 16, 10), std(p, 0xffffff, 0.45), NS), sx: [], sy: [], sz: [], ph: [] };
        [p.stream.cards, p.stream.dots].forEach(function (m) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.renderOrder = 8; p.g.add(m); });
        for (var i = 0; i < NS; i++) {
          var tg = p.pops[TGT1[i] % p.pops.length];
          p.stream.ph.push(i / NS + r1() * 0.03); p.stream.sx.push(p.w / 2 + 1.6 + r1() * 1.4); p.stream.sy.push(tg.cy + 0.3 + r1() * 0.5); p.stream.sz.push(1.3 + r1() * 0.6);
          p.stream.cards.setColorAt(i, new THREE.Color(1, 1, 1));
          p.stream.dots.setColorAt(i, lin(ROW_C[TGT1[i] % ROW_C.length]));
        }
      }

      // 接客管理表の申込率の棒（3Dで立ち上がる）
      if (def.rods) {
        p.rods = [];
        def.rods.forEach(function (b, i) {
          var x1 = Math.min(b.x1, C[2] - 12), len = (x1 - b.x0) / (C[2] - C[0]) * p.w;
          if (b.y > C[3] || len <= 0.1) return;
          var r = { g: mesh(slab(len, 0.13, 0.065, 0.12), std(p, i === 0 ? 0x14a085 : 0x2bb79b, 0.42), 4, p.g), cx: px(p, b.x0) + len / 2, cy: py(p, b.y), len: len };
          r.g.position.set(r.cx, r.cy, 0.15);
          p.rods.push(r);
        });
      }

      // 手前のスマホ（自動返信・自動追客のメール）
      if (def.phone) {
        var ph = def.phone, hh = ph.h, ww = hh * ph.size[0] / ph.size[1], g = new THREE.Group();
        mesh(slab(ww + 0.18, hh + 0.18, 0.28, 0.14), addMat(p, new THREE.MeshStandardMaterial({ color: lin(0x1d2826), roughness: 0.35, metalness: 0.25, transparent: true, fog: false }), 1), 6, g);
        var fm = basic(p, 1); useTex(fm, ph.img);
        mesh(face(ww, hh, 0.2, ph.size, [0, 0, ph.size[0], ph.size[1]]), fm, 7, g).position.z = 0.135;
        p.g.add(g);
        var psh = mesh(UNIT, shadowMat(p, 0.3), 3, p.g); psh.scale.set(ww * 1.7, hh * 1.45, 1);
        p.phone = { g: g, sh: psh, at: new THREE.Vector3(ph.at[0], ph.at[1], ph.at[2]), ry: ph.ry, w: ww, h: hh };
        p.srcs.push(ph.img);
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

      // 売上分析の前の棒グラフ
      if (def.bars) {
        var mT = std(p, 0x14a085, 0.75), mR = std(p, 0xe07a5f, 0.75), bgeo = new THREE.BoxGeometry(1, 1, 1);
        p.bars = [];
        for (j = 0; j < def.bars; j++) p.bars.push(mesh(bgeo, j % 3 === 2 ? mR : mT, 6, p.g));
      }
      // 縦長の配置に使う、この画面の上端・下端・左右の広がり（アプリの枠の単位。札は付け位置まで）
      var tagged = tags.some(function (tg) { return tg.sc === k && !(tg.n === 1 && def.phone) && !def.stations; });
      p.top = p.at.y + p.h / 2 + 0.18 + (tagged ? 0.42 : 0);
      p.bot = p.at.y - p.h / 2 - 0.18;
      p.hw = Math.max(Math.abs(p.at.x - p.w / 2 - 0.18), Math.abs(p.at.x + p.w / 2 + 0.18));
      if (p.phone) { p.bot = Math.min(p.bot, p.at.y + p.phone.at.y - p.phone.h / 2 - 0.12); p.hw = Math.max(p.hw, Math.abs(p.at.x + p.phone.at.x + p.phone.w / 2 + 0.12)); }
      if (p.stations) { p.bot = Math.min(p.bot, p.at.y - p.h / 2 - 0.36 - 0.2); p.hw = Math.max(p.hw, Math.abs(p.at.x - 3.3), Math.abs(p.at.x + 3.2)); }
      if (p.bars) { p.bot = Math.min(p.bot, p.at.y - p.h / 2 - 1.15); p.hw = Math.max(p.hw, Math.abs(p.at.x - 3.4), Math.abs(p.at.x + 3.2)); }
      root.add(p.g); panels.push(p);
    });
    anchorTags();
  }

  // 1枚目が届いたら、残りを場面の順に1枚ずつ取りに行く（届かなくても少し待ったら始める）。見に行った場面の画像は割り込みで先に取る
  var ORDER = [];
  DEF.forEach(function (d) { ORDER.push(d.img); if (d.phone) ORDER.push(d.phone.img); });
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
        Bk[+el.dataset.mfStep] = Math.min(B, top(c) - (parseFloat(el.style.getPropertyValue('--hy')) || 0) - 14);
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
    V = { w: w, h: h, asp: asp, mobile: mobile, D: D, VW: VW, VH: VH, ax: ax, ay: ay, T: T, B: B, fit: fit, textTop: mobile ? Bk.map(function (b) { return b + 14; }) : null };
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
  var SPAN = 4.6;
  function scrollSpan() { return sec.offsetHeight - stage.offsetHeight; }
  function readProgress() {
    var r = sec.getBoundingClientRect(), span = scrollSpan();
    var x = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
    var q = x * SPAN, s = Math.floor(q), f = q - s;
    return s >= 4 ? 4 : s + smooth(0.16, 0.84, f);
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
      var ph = +d.dataset.mfDot, y = sec.getBoundingClientRect().top + window.scrollY + scrollSpan() * (ph >= 4 ? 4.25 : ph) / SPAN;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  // 札: data-at="場面:番号"。付ける相手（画面の左上・右上・スマホの上・駅の上）は作り直すたびに付け直す
  var tags = Array.prototype.slice.call(sec.querySelectorAll('.mf-tag')).map(function (el) {
    var t = el.dataset.at.split(':'); return { el: el, sc: +t[0], n: +t[1], off: new THREE.Vector3() };
  });
  function anchorTags() {
    tags.forEach(function (tg) {
      var p = panels[tg.sc]; tg.obj = p.g; tg.wd = 0;
      if (tg.sc === 3 && p.stations) { tg.obj = p.stations[tg.n].m; tg.off.set(0, 0.5, 0.1); }
      else if (tg.n === 1 && p.phone) { tg.obj = p.phone.g; tg.off.set(0, p.phone.h / 2 + 0.38, 0.1); }
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
      var a0 = Math.floor(P), a1 = Math.min(4, a0 + 1), tt = V.textTop[a0] + (V.textTop[a1] - V.textTop[a0]) * (P - a0);
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
      if (tg.sc === 3) {
        if (!tg.wd) tg.wd = tg.el.offsetWidth;
        if (prev && tg.x - prev.x < (tg.wd + prev.wd) / 2 + 8) crowd = true;
        prev = tg;
      }
    });
    tags.forEach(function (tg) {
      var o = tg.sc === 3 && crowd ? 0 : tg.o;
      if (o <= 0.01) { if (tg.el.style.opacity !== '0') tg.el.style.opacity = '0'; return; }
      tg.el.style.opacity = o.toFixed(3);
      tg.el.style.transform = 'translate3d(' + tg.x.toFixed(1) + 'px,' + tg.y.toFixed(1) + 'px,0) translateX(-50%)';
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
    // 場面1: 反響メールが右から飛んできて、媒体の行に吸い込まれる（届いた行が浮く）
    if (p.stream) {
      var S = p.stream;
      for (var i = 0; i < S.n; i++) {
        var ti = TGT1[i] % p.pops.length, tl = p.pops[ti], u = frac(t * 0.1 + S.ph[i]), e = u * u * (3 - 2 * u);
        var gx = tl.cx + tl.tw * 0.22, x = S.sx[i] + (gx - S.sx[i]) * e, y = S.sy[i] + (tl.cy - S.sy[i]) * e * e, z = S.sz[i] + (0.62 - S.sz[i]) * e * e + Math.sin(u * Math.PI) * 0.25;
        var s = (1 - smooth(0.72, 0.93, u)) * smooth(0, 0.1, u) * act;
        _q.setFromEuler(_e.set((1 - e) * 0.25 * Math.sin(i * 2.1), (1 - e) * -0.45, (1 - e) * 0.15 * Math.cos(i * 1.7)));
        _v.set(x, y, z);
        _m.compose(_v, _q, _s.set(Math.max(0.001, 0.66 * s), Math.max(0.001, 0.25 * s), Math.max(0.001, 0.07 * s)));
        S.cards.setMatrixAt(i, _m);
        _v2.set(-0.66 * s / 2 + 0.13 * s, 0, 0.045 * s).applyQuaternion(_q).add(_v);
        _m.compose(_v2, _q, _s.set(Math.max(0.001, 0.11 * s), Math.max(0.001, 0.11 * s), Math.max(0.001, 0.06 * s)));
        S.dots.setMatrixAt(i, _m);
        var hit = Math.sin(Math.PI * clamp((u - 0.86) / 0.14, 0, 1));
        if (hit > p.bump[ti]) p.bump[ti] = hit;
      }
      S.cards.instanceMatrix.needsUpdate = true; S.dots.instanceMatrix.needsUpdate = true;
    }
    p.pops.forEach(function (tl2, j2) {
      a = ease(clamp((act - j2 * (tl2.row ? 0.04 : 0.05)) / 0.7, 0, 1));
      nr = near(p, tl2.cx, tl2.cy, tl2.row ? 1.1 : 1.5);
      var base;
      if (k === 0) base = 0.42 + 0.07 * Math.sin(t * 1.5 + j2 * 0.8) + 0.3 * p.bumpS[j2];
      else if (k === 1) base = 0.08 + 0.42 * p.bumpS[j2];
      else base = 0.3 + 0.06 * Math.sin(t * 1.5 + j2 * 0.9);
      setPop(p, tl2, a * base + nr * (tl2.row ? 0.42 : 0.5) * act, a, nr);
    });
    if (p.rods) {
      p.rods.forEach(function (r, j4) {
        a = ease(clamp((act - 0.15 - j4 * 0.06) / 0.6, 0, 1));
        nr = near(p, r.cx, r.cy, 1.3);
        r.g.visible = a > 0.01;
        r.g.position.z = 0.15 + a * (0.2 + 0.05 * Math.sin(t * 1.7 + j4)) + nr * 0.35 * act;
        r.g.scale.set(Math.max(0.001, 0.2 + 0.8 * a), 1, 1);
        r.g.position.x = r.cx - r.len / 2 * (1 - (0.2 + 0.8 * a));
      });
    }
    if (p.phone) {
      var ph = p.phone, aP = ease(clamp((act - 0.2) / 0.8, 0, 1));
      ph.g.visible = ph.sh.visible = aP > 0.01;
      ph.g.position.set(ph.at.x + (1 - aP) * 2.6, ph.at.y + Math.sin(t * 1.1) * 0.07 - (1 - aP) * 0.4, ph.at.z + (1 - aP) * 0.6);
      ph.g.rotation.set(-ndcS.y * 0.08, ph.ry + ndcS.x * 0.14 - (1 - aP) * 0.5, 0.03);
      ph.sh.position.set(ph.g.position.x + 0.35, ph.g.position.y - 0.35, 0.16);
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
    if (p.bars) {
      var base0 = -p.h / 2 - 1.15;
      p.bars.forEach(function (bm, i5) {
        a = ease(clamp((act - 0.1 - i5 * 0.05) / 0.6, 0, 1));
        var bx = -3.1 + i5 * 0.86;
        nr = near(p, bx, base0 + 1.2, 1.3);
        var hh = (0.35 + 0.95 * (0.5 + 0.5 * Math.sin(t * 1.3 + i5 * 0.9)) * (0.55 + i5 * 0.07) + nr * 0.6) * a;
        bm.visible = a > 0.01;
        bm.scale.set(0.44, Math.max(0.001, hh), 0.44);
        bm.position.set(bx, base0 + hh / 2, 0.95);
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
      p.g.renderOrder = ro; p.pops.forEach(function (t) { t.g.renderOrder = ro; }); if (p.phone) p.phone.g.renderOrder = ro;   // 入れ子の Group ごとに描く順の組が決まる
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
