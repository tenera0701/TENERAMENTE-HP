/* TENERAMENTE — トップの3D「会社のシステムができるまで」（hero-system.css と対）
   スクロールで場面が進む:
     0 散らばった業務（書類・Excel・付箋が宙に漂う）
     1 洗い出し      （4つの業務ごとに一覧に並ぶ）
     2 設計図        （床に、これから作る画面の設計図が描かれる）
     3 組み上げ      （設計図から部品が立ち上がり、アプリの画面になる）
     4 稼働          （グラフと数字が動き、データが流れ込む）
   カーソルの近くの部品は押しのけられ、青い光が当たる。組み上がったアプリはカーソルの方へ傾く。three.js r128（CDN）。
   WebGL が使えない・動きを減らす設定・three.js の読み込み失敗や遅延のときは .hx--static（静止画と文章）にする。
   確認用: ?hxP=0〜4 でその場面に固定、?hxStatic で静止版、?hxDebug で window.__hx に中身を出す。 */
(function () {
  'use strict';
  var sec = document.querySelector('.hx');
  if (!sec) return;
  // three.js が遅くて静止版に切り替えていた場合、まだ一番上にいるなら3Dに戻す（読み進めていたら静止版のまま）
  if (sec.classList.contains('hx--static')) {
    if (sec.dataset.hxLate === '1' && window.scrollY < 40) sec.classList.remove('hx--static');
    else return;
  }
  var stage = sec.querySelector('.hx-stage');
  var canvas = sec.querySelector('.hx-canvas');
  var QS = new URLSearchParams(location.search);
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FORCE_P = QS.has('hxP') ? Math.max(0, Math.min(4, parseFloat(QS.get('hxP')) || 0)) : null;

  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (REDUCED || typeof THREE === 'undefined' || !webglOK() || QS.has('hxStatic')) {
    sec.classList.add('hx--static');
    return;
  }
  sec.classList.add('hx--live');

  /* ---------- 小道具 ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // CSS の「スマホ・縦長」の条件と同じ（hero-system.css の @media と合わせる）
  var PORTRAIT_MQ = window.matchMedia('(max-aspect-ratio: 21/20), (max-width: 760px) and (max-aspect-ratio: 13/10)');
  function isPortraitLayout() { return PORTRAIT_MQ.matches; }

  /* 色（three.js の色は 0〜1） */
  var C = {
    paper: [0.86, 0.87, 0.9], cobalt: [0.137, 0.251, 0.961], cobaltHi: [0.42, 0.52, 1.0],
    bp0: [0.03, 0.06, 0.22], bp1: [0.07, 0.14, 0.5], bp2: [0.3, 0.42, 1.0],
    win: [0.06, 0.065, 0.08], panel: [0.13, 0.14, 0.17], item: [0.32, 0.34, 0.4], light: [0.8, 0.82, 0.88]
  };

  /* ---------- これから作るアプリの画面（部品の配置。単位は3D空間の長さ） ----------
     layer: 0 土台 / 1 枠 / 2 中身。中身は枠より手前に少し出す（重なり順が狂わないように） */
  var APP = (function () {
    var L = [], bars = [], kpiv = [], rows = [];
    function add(x, y, z, w, h, d, c, layer, kind) { L.push({ x: x, y: y, z: z, w: w, h: h, d: d, c: c, layer: layer, kind: kind || '' }); return L.length - 1; }
    var i;
    add(0, 0, -0.16, 8.4, 5.0, 0.1, C.win, 0, 'win');                 // 画面の土台
    add(0, 2.25, 0, 8.2, 0.36, 0.14, C.panel, 1, 'head');              // 上のバー
    for (i = 0; i < 3; i++) add(-3.85 + i * 0.24, 2.25, 0.1, 0.12, 0.12, 0.1, C.item, 2);
    add(-3.35, -0.2, 0, 1.3, 4.3, 0.14, C.panel, 1, 'nav');            // 左のメニュー
    for (i = 0; i < 7; i++) add(-3.35, 1.55 - i * 0.45, 0.14, 0.95, 0.2, 0.08, i === 0 ? C.cobalt : C.item, 2, 'navi');
    for (i = 0; i < 4; i++) {                                          // 数字のカード
      var kx = -1.825 + i * 1.67;
      add(kx, 1.45, 0, 1.45, 0.75, 0.2, C.panel, 1, 'kpi');
      kpiv.push({ i: add(kx - 0.22, 1.38, 0.18, 0.8, 0.13, 0.06, i === 0 ? C.cobalt : C.light, 2, 'kpiv'), n: i });
    }
    add(-0.6, 0, 0, 3.9, 1.7, 0.14, C.panel, 1, 'chart');               // グラフ
    var hs = [0.45, 0.6, 0.52, 0.78, 0.7, 0.92, 0.84, 1.05, 0.98, 1.18, 1.1, 1.3];
    for (i = 0; i < 12; i++) {
      bars.push({ i: add(-2.35 + i * 0.31, -0.7 + hs[i] / 2, 0.14, 0.17, hs[i], 0.2, i % 3 === 2 ? C.light : C.cobalt, 2, 'bar'), x: -2.35 + i * 0.31, h: hs[i], n: i });
    }
    add(2.775, 0, 0, 2.45, 1.7, 0.14, C.panel, 1, 'list');              // 右の一覧
    for (i = 0; i < 5; i++) rows.push({ i: add(2.775, 0.6 - i * 0.3, 0.14, 2.15, 0.16, 0.08, i === 0 ? C.cobaltHi : C.item, 2, 'row'), n: i });
    add(0.725, -1.725, 0, 6.55, 1.35, 0.14, C.panel, 1, 'table');       // 下の表
    for (i = 0; i < 4; i++) add(0.725, -1.25 - i * 0.3, 0.14, 6.2, 0.14, 0.07, C.item, 2, 'trow');
    var byI = {};
    bars.forEach(function (b) { byI[b.i] = { t: 'bar', o: b }; });
    kpiv.forEach(function (k) { byI[k.i] = { t: 'kpiv', o: k }; });
    rows.forEach(function (r) { byI[r.i] = { t: 'row', o: r }; });
    return { L: L, bars: bars, byI: byI };
  })();
  var NA = APP.L.length;          // アプリの部品数（45）
  var NMAX = 84;

  /* ---------- three.js の準備 ---------- */
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x07080b, 1);
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07080b, 0.04);
  var FOV = 38, TAN = Math.tan(FOV * Math.PI / 360);
  var cam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);

  scene.add(new THREE.AmbientLight(0x9aa3c0, 0.42));
  var key = new THREE.DirectionalLight(0xffffff, 0.95); key.position.set(-5, 7, 9); scene.add(key);
  var rim = new THREE.DirectionalLight(0x2340f5, 1.1); rim.position.set(7, -3, -6); scene.add(rim);
  var curLight = new THREE.PointLight(0x4f6bff, 2.6, 8, 2); scene.add(curLight);

  var geo = new THREE.BoxGeometry(1, 1, 1);
  var mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.18 });
  var mesh = new THREE.InstancedMesh(geo, mat, NMAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  /* 丸い光の粒（粒子・データの流れ・後光に使う） */
  function dotTexture(soft) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(soft ? 0.25 : 0.45, 'rgba(255,255,255,' + (soft ? 0.5 : 0.9) + ')');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var DOT = dotTexture(false), HALO = dotTexture(true);

  var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO, color: 0x2340f5, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  scene.add(glow);

  function makePoints(n, size, color, opacity) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    var m = new THREE.PointsMaterial({ size: size, map: DOT, color: color, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    var p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return p;
  }
  function dropPoints(p) { if (!p) return; scene.remove(p); p.geometry.dispose(); p.material.dispose(); }

  var grid = new THREE.GridHelper(60, 60, 0x2340f5, 0x16246e);
  grid.material.transparent = true; grid.material.opacity = 0.1; grid.material.depthWrite = false;
  scene.add(grid);

  var lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x6f86ff, transparent: true, opacity: 0, depthWrite: false }));
  lines.frustumCulled = false;
  scene.add(lines);

  /* ---------- 画面の大きさに合わせた配置 ---------- */
  var V = {};
  var S = 5;
  var POS = [], QUA = [], SCL = [], COL = [], DEL = [];
  var CAMP = [], CAML = [];
  var PH = new Float32Array(NMAX * 4), AX = [];
  var appM = new THREE.Matrix4(), appQ = new THREE.Quaternion(), appC = new THREE.Vector3(), flatQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  var dust, stream, packets, streamS = [], streamE = [], streamT = [], streamV = [], flowPath = [], streamTargets = [], streamR = rng(11);
  var tags = [];
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _c = new THREE.Color();
  var tiltQ = new THREE.Quaternion(), tiltFull = new THREE.Quaternion(), qI = new THREE.Quaternion();

  function toWorld(x, y, z, out) { return out.set(x, y, z).applyMatrix4(appM); }
  function toFloor(x, y, layer, out) { return out.set(V.ax + x, V.floor + 0.02 + layer * 0.035, -y * 0.95 + 0.2); }

  function layout() {
    var w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight, asp = w / h;
    var mobile = isPortraitLayout();
    var D, VW, VH, ax, ay;
    if (!mobile) {
      var share = asp >= 1.5 ? 0.48 : asp >= 1.25 ? 0.42 : 0.38;   // 画面の横幅のうちアプリが占める割合
      D = Math.max((8.4 / share) / (2 * TAN * asp), (5.0 / 0.62) / (2 * TAN));
      VW = 2 * D * TAN * asp; VH = VW / asp;
      ax = 0.44 * VW - 4.4; ay = -0.15;
    } else {
      VW = 8.4 / (asp > 0.52 ? 0.74 : 0.88); D = VW / (2 * TAN * asp); VH = VW / asp;
      ax = 0; ay = VH * (asp > 0.52 ? 0.22 : 0.19);
    }
    V = { w: w, h: h, asp: asp, mobile: mobile, D: D, VW: VW, VH: VH, ax: ax, ay: ay, floor: ay - 3.3, N: mobile ? 64 : NMAX };
    mesh.count = V.N;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    cam.aspect = asp; cam.updateProjectionMatrix();
    scene.fog.density = 0.55 / D;

    var yaw = mobile ? 0 : -0.2, pitch = mobile ? 0 : 0.04;
    appQ.setFromEuler(new THREE.Euler(pitch, yaw, 0));
    appM.compose(new THREE.Vector3(ax, ay, 0), appQ, new THREE.Vector3(1, 1, 1));
    appC.set(ax, ay, 0);

    buildStates();
    buildCameras();
    buildExtras();
  }

  function setState(s, i, px, py, pz, q, sx, sy, sz, c) {
    POS[s][i * 3] = px; POS[s][i * 3 + 1] = py; POS[s][i * 3 + 2] = pz;
    q.toArray(QUA[s], i * 4);
    SCL[s][i * 3] = sx; SCL[s][i * 3 + 1] = sy; SCL[s][i * 3 + 2] = sz;
    COL[s][i * 3] = c[0]; COL[s][i * 3 + 1] = c[1]; COL[s][i * 3 + 2] = c[2];
  }

  function buildStates() {
    var N = V.N, s, i, r = rng(7);
    for (s = 0; s < S; s++) {
      POS[s] = new Float32Array(NMAX * 3); QUA[s] = new Float32Array(NMAX * 4);
      SCL[s] = new Float32Array(NMAX * 3); COL[s] = new Float32Array(NMAX * 3); DEL[s] = new Float32Array(NMAX);
    }
    var q = new THREE.Quaternion();

    /* 0 散らばった業務 */
    for (i = 0; i < N; i++) {
      var x = (r() * 2 - 1) * V.VW * 0.56, y = (r() * 2 - 1) * V.VH * 0.5, z = -r() * V.D * 0.55 + V.D * 0.1;
      // 文章の後ろは奥へ逃がして読みやすくする
      if (!V.mobile && x < 0.06 * V.VW && z > -V.D * 0.3) z = -V.D * (0.42 + r() * 0.3);
      if (V.mobile && y < V.VH * 0.02 && z > -V.D * 0.2) z = -V.D * (0.3 + r() * 0.32);
      q.setFromEuler(_e.set(r() * 6.28, r() * 6.28, r() * 6.28));
      var kind = r(), sx = 0.62, sy = 0.82, col = C.paper;
      if (kind < 0.16) { sx = 0.5; sy = 0.5; col = C.cobalt; }                 // 付箋
      else if (kind < 0.42) { sx = 0.96; sy = 0.68; }                          // Excel の表
      var g = 0.82 + r() * 0.1;
      setState(0, i, x, y, z, q, sx, sy, 0.014, col === C.paper ? [g, g + 0.01, g + 0.04] : col);
      PH[i * 4] = r() * 6.28; PH[i * 4 + 1] = r() * 6.28; PH[i * 4 + 2] = r() * 6.28; PH[i * 4 + 3] = r() * 6.28;
      AX[i] = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    }

    /* 1 洗い出し（4列の一覧） */
    var rows = Math.ceil(N / 4), colW = 1.84, gap = 0.35, sp = Math.min(0.27, 4.0 / Math.max(1, rows - 1));
    for (i = 0; i < N; i++) {
      var c = i % 4, row = Math.floor(i / 4);
      var lx = -4.2 + colW / 2 + c * (colW + gap);
      var head = row === 0;
      var ly = head ? 2.3 : 1.85 - (row - 1) * sp;
      toWorld(lx, ly, head ? 0.08 : 0, _v);
      var gg = 0.8 + ((i * 37) % 10) / 100;
      setState(1, i, _v.x, _v.y, _v.z, appQ, head ? colW : colW * 0.92, head ? 0.34 : 0.17, head ? 0.06 : 0.03, head ? C.cobalt : [gg, gg + 0.01, gg + 0.04]);
      DEL[1][i] = clamp(c * 0.1 + row / rows * 0.55 + r() * 0.12, 0, 1);
    }

    /* 2 設計図（床） 3 組み上げ 4 稼働 */
    for (i = 0; i < N; i++) {
      if (i < NA) {
        var p = APP.L[i];
        toFloor(p.x, p.y, p.layer, _v);
        setState(2, i, _v.x, _v.y, _v.z, flatQ, p.w, p.h * 0.95, 0.02, p.layer === 0 ? C.bp0 : p.layer === 1 ? C.bp1 : C.bp2);
        DEL[2][i] = clamp(p.layer * 0.28 + r() * 0.2, 0, 1);
        toWorld(p.x, p.y, p.z, _v);
        setState(3, i, _v.x, _v.y, _v.z, appQ, p.w, p.h, p.d, p.c);
        DEL[3][i] = clamp(p.layer * 0.3 + (p.layer === 2 ? (i / NA) * 0.25 : 0) + r() * 0.05, 0, 1);
        var rc = p.kind === 'bar' && p.c === C.cobalt ? [0.26, 0.4, 1.0] : p.c === C.panel ? [0.15, 0.16, 0.2] : p.c;
        setState(4, i, _v.x, _v.y, _v.z, appQ, p.w, p.h, p.d, rc);
        DEL[4][i] = r() * 0.35;
      } else {
        // アプリの部品にならない残りは「AI」の小さな立方体になって、設計と組み上げを手伝う
        q.setFromEuler(_e.set(r() * 6.28, r() * 6.28, r() * 6.28));
        setState(2, i, V.ax + (r() * 2 - 1) * 4.6, V.floor + 0.7 + r() * 1.8, (r() * 2 - 1) * 2.6, q, 0.15, 0.15, 0.15, C.cobaltHi);
        DEL[2][i] = 0.55 + r() * 0.3;
        toWorld((r() * 2 - 1) * 4.8, (r() * 2 - 1) * 2.9, 0.9 + r() * 1.4, _v);
        setState(3, i, _v.x, _v.y, _v.z, q, 0.13, 0.13, 0.13, C.cobaltHi);
        setState(4, i, _v.x, _v.y, _v.z, q, 0.13, 0.13, 0.13, C.cobaltHi);
        DEL[3][i] = 0.1 + r() * 0.3; DEL[4][i] = r() * 0.3;
      }
    }

    /* 設計図の線: 部位の外枠と、データの流れ */
    var segs = [];
    function seg(a, b) { segs.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    var A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), Dd = new THREE.Vector3();
    APP.L.forEach(function (p) {
      if (p.layer > 1) return;
      var x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, y0 = p.y - p.h / 2, y1 = p.y + p.h / 2, yy = V.floor + 0.09;
      A.set(V.ax + x0, yy, -y0 * 0.95 + 0.2); B.set(V.ax + x1, yy, -y0 * 0.95 + 0.2);
      Cc.set(V.ax + x1, yy, -y1 * 0.95 + 0.2); Dd.set(V.ax + x0, yy, -y1 * 0.95 + 0.2);
      seg(A, B); seg(B, Cc); seg(Cc, Dd); seg(Dd, A);
    });
    var flow = [[-3.35, 1.1], [-1.825, 1.45], [-0.6, 0], [2.775, 0], [0.725, -1.725], [-3.35, -1.6]];
    flowPath = flow.map(function (f) { return new THREE.Vector3(V.ax + f[0], V.floor + 0.12, -f[1] * 0.95 + 0.2); });
    for (i = 0; i < flowPath.length - 1; i++) seg(flowPath[i], flowPath[i + 1]);
    lines.geometry.dispose();
    lines.geometry = new THREE.BufferGeometry();
    lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));

    grid.position.set(V.ax, V.floor - 0.01, 0);

    /* 札（HTML）の3D上の位置 */
    tags = [];
    sec.querySelectorAll('.hx-tag[data-col]').forEach(function (el) {
      var cc = +el.dataset.col, lx2 = -4.2 + colW / 2 + cc * (colW + gap) - colW / 2;
      tags.push({ el: el, kind: 'col', p: toWorld(lx2, 2.72, 0.1, new THREE.Vector3()) });
    });
    sec.querySelectorAll('.hx-tag[data-mod]').forEach(function (el) {
      var k = el.dataset.mod, p = APP.L.filter(function (q2) { return q2.kind === k; })[0];
      if (!p) return;
      tags.push({ el: el, kind: 'mod', p: new THREE.Vector3(V.ax + p.x - p.w / 2 + 0.1, V.floor + 0.12, -(p.y + p.h / 2) * 0.95 + 0.2 + 0.18) });
    });
  }

  function buildCameras() {
    var D = V.D;
    CAMP = [
      new THREE.Vector3(0, 0, D * 1.04), new THREE.Vector3(0, 0, D),
      V.mobile ? new THREE.Vector3(0, V.ay + D * 0.45, D * 0.8) : new THREE.Vector3(-V.ax * 0.05, V.ay + D * 0.42, D * 0.8),
      new THREE.Vector3(0, 0.15, D), new THREE.Vector3(-0.35, 0.3, D * 0.99)
    ];
    var cy = V.mobile ? V.ay * 0.55 : 0;
    CAMP[0].y = cy; CAMP[1].y = cy; CAMP[3].y += cy; CAMP[4].y += cy;
    CAML = [
      new THREE.Vector3(0, cy, -2), new THREE.Vector3(0, cy, 0),
      V.mobile ? new THREE.Vector3(0, V.floor - 3.5, -1) : new THREE.Vector3(V.ax * 0.18, V.floor - 0.3, -0.5),
      new THREE.Vector3(0, cy, 0), new THREE.Vector3(0, cy, 0)
    ];
  }

  function buildExtras() {
    var r = rng(11), i;
    /* 宙に漂う細かな光 */
    var nd = V.mobile ? 260 : 640;
    dropPoints(dust);
    dust = makePoints(nd, 0.05 * V.D / 15, 0x8ea0ff, 0.42);
    var a = dust.geometry.attributes.position.array;
    dust.userData.v = new Float32Array(nd);
    for (i = 0; i < nd; i++) {
      a[i * 3] = (r() * 2 - 1) * V.VW * 0.75; a[i * 3 + 1] = (r() * 2 - 1) * V.VH * 0.62 + V.ay; a[i * 3 + 2] = -r() * V.D * 0.8 + V.D * 0.3;
      dust.userData.v[i] = 0.08 + r() * 0.25;
    }
    /* 稼働したアプリへ流れ込むデータ */
    var ns = V.mobile ? 120 : 260;
    dropPoints(stream);
    stream = makePoints(ns, 0.075 * V.D / 15, 0x9fb1ff, 0);
    streamS = []; streamE = []; streamT = []; streamV = [];
    streamTargets = APP.L.filter(function (p) { return p.kind === 'kpi' || p.kind === 'bar' || p.kind === 'row' || p.kind === 'kpiv'; });
    for (i = 0; i < ns; i++) {
      streamS.push(new THREE.Vector3()); streamE.push(new THREE.Vector3());
      streamT.push(r()); streamV.push(0.22 + r() * 0.35);
      resetStream(i);
    }
    /* 設計図の流れの上を走る光 */
    dropPoints(packets);
    packets = makePoints(16, 0.12 * V.D / 15, 0xb7c4ff, 0);
  }

  function resetStream(i) {
    var r = streamR, t = streamTargets[Math.floor(r() * streamTargets.length)];
    toWorld(t.x + (r() - 0.5) * t.w * 0.8, t.y + (r() - 0.5) * t.h * 0.8, 0.2, streamE[i]);
    var ang = r() * Math.PI * 2, rad = 7 + r() * 5;
    streamS[i].set(V.ax + Math.cos(ang) * rad, V.ay + Math.sin(ang) * rad * 0.6, -3 - r() * 6);
  }

  /* ---------- カーソル ---------- */
  var clock = new THREE.Clock();
  var ndc = new THREE.Vector2(), ndcS = new THREE.Vector2(), lastMove = -10, pointer = false;
  var ray = new THREE.Raycaster(), planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), planeF = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  var cur = new THREE.Vector3(), curS = new THREE.Vector3(), OFF = new Float32Array(NMAX * 3);
  window.addEventListener('pointermove', function (e) {
    var r = stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    lastMove = clock.getElapsedTime(); pointer = true;
  }, { passive: true });

  /* ---------- スクロール量 → 場面 ---------- */
  var SPAN = 4.6;   // 4つの切り替え＋最後の見せ場（0.6）
  function scrollSpan() { return sec.offsetHeight - stage.offsetHeight; }
  function readProgress() {
    var r = sec.getBoundingClientRect(), span = scrollSpan();
    var x = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
    var q = x * SPAN, s = Math.floor(q), f = q - s;
    return s >= 4 ? 4 : s + smooth(0.16, 0.84, f);
  }

  /* ---------- 文章・計器の表示 ---------- */
  var panels = Array.prototype.slice.call(sec.querySelectorAll('[data-hx-step]'));
  var navDots = Array.prototype.slice.call(sec.querySelectorAll('[data-hx-dot]'));
  var hudPhase = sec.querySelector('[data-hud="phase"]'), hudPct = sec.querySelector('[data-hud="pct"]'),
      hudXY = sec.querySelector('[data-hud="xy"]'), hudBar = sec.querySelector('.hx-bar'), scrollHint = sec.querySelector('.hx-scroll');
  var NAMES = ['00 — INTRO', '01 — HEARING', '02 — DESIGN', '03 — BUILD', '04 — RUN'];
  var header = null, lastPhase = -1;

  /* 目次（01〜04）を押すと、その場面までスクロールする */
  navDots.forEach(function (d) {
    d.setAttribute('role', 'button'); d.tabIndex = -1;
    d.addEventListener('click', function () {
      var ph = +d.dataset.hxDot, y = sec.getBoundingClientRect().top + window.scrollY + scrollSpan() * (ph >= 4 ? 4.25 : ph) / SPAN;
      if (window.__lenis && window.__lenis.scrollTo) window.__lenis.scrollTo(y, { duration: 1.6 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  function updateDom(P) {
    panels.forEach(function (el) {
      var s = +el.dataset.hxStep, o = clamp(1 - Math.abs(P - s) * 2.3, 0, 1);
      if (s === 0 && P < 0.05) o = 1;
      el.style.opacity = o.toFixed(3);
      el.style.setProperty('--hy', ((s - P) * 46).toFixed(1) + 'px');
      var on = o > 0.6;
      if (el.classList.contains('is-on') !== on) { el.classList.toggle('is-on', on); setTabbable(el, on); }   // 見えていない場面のボタンには Tab で移らない
    });
    var ph = Math.round(P);
    if (ph !== lastPhase) {
      lastPhase = ph;
      if (hudPhase) hudPhase.textContent = 'PHASE ' + NAMES[ph];
      navDots.forEach(function (d) { d.classList.toggle('on', +d.dataset.hxDot === ph); });
    }
    if (hudPct) hudPct.textContent = ('00' + Math.round(P / 4 * 100)).slice(-3);
    if (hudBar) hudBar.style.setProperty('--p', (P / 4).toFixed(3));
    if (hudXY) hudXY.textContent = 'X ' + fmt(curS.x - V.ax) + '  Y ' + fmt(curS.y - V.ay) + '  Z ' + fmt(curS.z);
    if (scrollHint) scrollHint.style.opacity = clamp(1 - P * 5, 0, 1).toFixed(2);
    if (!header) header = document.getElementById('siteHeader');
    if (header) header.classList.toggle('hx-over', sec.getBoundingClientRect().bottom > 80);
  }
  function setTabbable(el, on) {
    el.querySelectorAll('a, button').forEach(function (a) { if (on) a.removeAttribute('tabindex'); else a.tabIndex = -1; });
  }
  function fmt(v) { if (Math.abs(v) < 0.005) v = 0; return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2); }

  function updateTags(P) {
    var wS = clamp(1 - Math.abs(P - 1) * 2.4, 0, 1), wB = clamp(1 - Math.abs(P - 2) * 2.4, 0, 1);
    tags.forEach(function (t) {
      var o = t.kind === 'col' ? wS : wB;
      if (o <= 0.01) { if (t.el.style.opacity !== '0') t.el.style.opacity = '0'; return; }
      _v.copy(t.p).project(cam);
      var x = (_v.x + 1) / 2 * V.w, y = (1 - _v.y) / 2 * V.h;
      t.el.style.opacity = o.toFixed(3);
      t.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (y - 14).toFixed(1) + 'px,0)';
    });
  }

  /* ---------- 毎フレーム ---------- */
  var P = FORCE_P != null ? FORCE_P : 0, introT = -10, last = 0;
  var running = false, raf = 0;

  function frame() {
    if (!running) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    var t = clock.getElapsedTime(), dt = Math.min(0.05, t - last); last = t;
    var target = FORCE_P != null ? FORCE_P : readProgress();
    P += (target - P) * Math.min(1, dt * 4.2);
    if (Math.abs(target - P) < 0.0005) P = target;

    var seg = Math.min(3, Math.floor(P)), tt = P - seg, A = seg, B = seg + 1;
    var wC = clamp(1 - P, 0, 1), wS = clamp(1 - Math.abs(P - 1), 0, 1), wB = clamp(1 - Math.abs(P - 2), 0, 1),
        w3 = clamp(1 - Math.abs(P - 3), 0, 1), w4 = clamp(P - 3, 0, 1), wU = clamp(P - 2.4, 0, 1);
    var intro = introT < 0 ? 1 : ease(clamp((t - introT) / 2.6, 0, 1));

    /* カーソル（しばらく動かさない・タッチ端末では光がゆっくり巡回する） */
    if (!pointer || t - lastMove > 3) ndc.set(Math.sin(t * 0.33) * 0.55, Math.cos(t * 0.27) * 0.4);
    ndcS.x += (ndc.x - ndcS.x) * Math.min(1, dt * 5); ndcS.y += (ndc.y - ndcS.y) * Math.min(1, dt * 5);

    /* カメラ（稼働の場面ではゆっくり回り込む） */
    var ce = ease(tt);
    _v.copy(CAMP[A]).lerp(CAMP[B], ce); _v2.copy(CAML[A]).lerp(CAML[B], ce);
    var par = V.D / 15;
    cam.position.set(_v.x + ndcS.x * 0.7 * par + Math.sin(t * 0.21) * 0.12 * par + Math.sin(t * 0.23) * 0.5 * par * w4,
      _v.y + ndcS.y * 0.42 * par + Math.cos(t * 0.19) * 0.35 * par * w4, _v.z);
    cam.lookAt(_v2);

    ray.setFromCamera(ndcS, cam);
    var floorMode = wB > 0.5;
    planeF.constant = -V.floor;
    if (ray.ray.intersectPlane(floorMode ? planeF : planeZ, cur)) curS.lerp(cur, Math.min(1, dt * 7));
    curLight.position.set(curS.x, curS.y + (floorMode ? 1.3 : 0), curS.z + (floorMode ? 0 : 1.8));
    curLight.distance = 8 * par;
    curLight.intensity = 2.2 + wC * 1.2 + wU * 0.9;

    /* 組み上がったアプリはカーソルの方へ傾く */
    tiltFull.setFromEuler(_e.set(-ndcS.y * 0.13, ndcS.x * 0.19, 0));
    tiltQ.copy(qI).slerp(tiltFull, wU);

    /* 部品 */
    var N = V.N, R = (2.1 + 0.9 * wC + 0.5 * wU) * par, W = 0.42;
    var rowHi = (t * 1.25) % 5;
    for (var i = 0; i < N; i++) {
      var d = DEL[B][i], lt = clamp((tt - d * W) / (1 - W), 0, 1), e = ease(lt);
      var ia = i * 3;
      var bx = POS[B][ia], by = POS[B][ia + 1], bz = POS[B][ia + 2], sbx = SCL[B][ia], sby = SCL[B][ia + 1], sbz = SCL[B][ia + 2];
      var cbr = COL[B][ia], cbg = COL[B][ia + 1], cbb = COL[B][ia + 2];
      // 稼働の場面: グラフが伸び縮みし、数字が増減し、一覧の行が順に光り、「AI」が周回する
      if (B === 4) {
        if (i >= NA) {
          var ang = PH[i * 4] + t * (0.22 + (i % 5) * 0.03), rx = 5.4 + (i % 4) * 0.35, ry = 3.3 + (i % 3) * 0.25;
          toWorld(Math.cos(ang) * rx, Math.sin(ang) * ry, 0.6 + Math.sin(ang * 2 + i) * 0.8, _v);
          bx = _v.x; by = _v.y; bz = _v.z;
        } else {
          var sp = APP.byI[i];
          if (sp && sp.t === 'bar') {
            var hh = sp.o.h * (0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t * 1.7 + sp.o.n * 0.8)));
            toWorld(sp.o.x, -0.7 + hh / 2, 0.14, _v); bx = _v.x; by = _v.y; bz = _v.z; sby = hh;
          } else if (sp && sp.t === 'kpiv') {
            var pk = APP.L[i], wf = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.9 + sp.o.n * 1.4));
            toWorld(pk.x - pk.w / 2 + pk.w * wf / 2, pk.y, pk.z, _v); bx = _v.x; by = _v.y; bz = _v.z; sbx = pk.w * wf;
          } else if (sp && sp.t === 'row') {
            var dd = Math.abs(rowHi - sp.o.n); dd = Math.min(dd, 5 - dd);
            var hl = clamp(1 - dd, 0, 1);
            cbr += (C.cobaltHi[0] - cbr) * hl; cbg += (C.cobaltHi[1] - cbg) * hl; cbb += (C.cobaltHi[2] - cbb) * hl;
          }
        }
      }
      var px = POS[A][ia] + (bx - POS[A][ia]) * e, py = POS[A][ia + 1] + (by - POS[A][ia + 1]) * e, pz = POS[A][ia + 2] + (bz - POS[A][ia + 2]) * e;
      var sx = SCL[A][ia] + (sbx - SCL[A][ia]) * e, sy = SCL[A][ia + 1] + (sby - SCL[A][ia + 1]) * e, sz = SCL[A][ia + 2] + (sbz - SCL[A][ia + 2]) * e;

      // 漂い（散らばっている場面だけ。組み上がった部品が前後して重なり順が狂わないように）
      var ph = i * 4, drift = wC;
      px += Math.sin(t * 0.33 + PH[ph]) * 0.36 * drift;
      py += Math.cos(t * 0.29 + PH[ph + 1]) * 0.3 * drift + Math.sin(t * 1.1 + i) * 0.02 * (wS + wB);
      pz += Math.sin(t * 0.25 + PH[ph + 2]) * 0.4 * drift;
      if (intro < 1) { pz -= (1 - intro) * V.D * 0.9; sx *= 0.4 + 0.6 * intro; sy *= 0.4 + 0.6 * intro; }

      // カーソルで押しのける（アプリの部品は、土台 → 枠 → 中身の順に強く浮かせる）
      var dx, dy, dist, f = 0;
      if (floorMode) { dx = px - curS.x; dy = pz - curS.z; } else { dx = px - curS.x; dy = py - curS.y; }
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < R) { f = 1 - dist / R; f *= f; }
      var lay = i < NA ? [0, 0.22, 1][APP.L[i].layer] : 1;
      f *= (wC + wS) + (1 - wC - wS) * lay;
      var inv = dist > 0.0001 ? 1 / dist : 0, ox = 0, oy = 0, oz = 0;
      if (f > 0) {
        if (floorMode) { oy = f * 1.0 * wB; }
        else {
          var push = 2.6 * wC + 0.45 * wS;
          ox = dx * inv * f * push; oy = dy * inv * f * push; oz = f * (1.0 * wC + 0.5 * wS + 1.3 * wU);
        }
      }
      var k = Math.min(1, dt * 7);
      OFF[ia] += (ox - OFF[ia]) * k; OFF[ia + 1] += (oy - OFF[ia + 1]) * k; OFF[ia + 2] += (oz - OFF[ia + 2]) * k;
      _v.set(px + OFF[ia], py + OFF[ia + 1], pz + OFF[ia + 2]);

      // 向き
      _q.fromArray(QUA[A], i * 4); _q2.fromArray(QUA[B], i * 4); _q.slerp(_q2, e);
      if (drift > 0.001) { _q2.setFromAxisAngle(AX[i], Math.sin(t * 0.4 + PH[ph + 3]) * 0.6 * drift); _q.multiply(_q2); }
      // 組み上がったアプリ全体の傾き（アプリの中心を軸に回す）
      if (wU > 0) { _v.sub(appC).applyQuaternion(tiltQ).add(appC); _q.premultiply(tiltQ); }
      _s.set(Math.max(0.001, sx), Math.max(0.001, sy), Math.max(0.001, sz));
      _m.compose(_v, _q, _s);
      mesh.setMatrixAt(i, _m);

      // 色（組み上がる瞬間に光る・カーソルの近くは青く光る）
      var cr = COL[A][ia] + (cbr - COL[A][ia]) * e, cg = COL[A][ia + 1] + (cbg - COL[A][ia + 1]) * e, cb = COL[A][ia + 2] + (cbb - COL[A][ia + 2]) * e;
      var flash = B === 3 && lt > 0.7 && lt < 1 ? Math.sin((lt - 0.7) / 0.3 * Math.PI) * 0.8 : 0;
      var hot = Math.max(flash, f * (0.25 * wC + 0.3 * wS + 0.75 * wU + 0.4 * wB));
      cr += (C.cobaltHi[0] - cr) * hot; cg += (C.cobaltHi[1] - cg) * hot; cb += (C.cobaltHi[2] - cb) * hot;
      mesh.setColorAt(i, _c.setRGB(cr, cg, cb));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    /* 後光・床・設計図の線 */
    toWorld(0, 0, -1.6, _v);
    glow.position.copy(_v);
    var gs = 15 * (V.mobile ? 0.8 : 1);
    glow.scale.set(gs, gs * 0.72, 1);
    glow.material.opacity = 0.1 + 0.16 * wC + 0.3 * w3 + 0.62 * w4;
    grid.material.opacity = 0.04 + 0.36 * wB + 0.1 * wU;
    lines.material.opacity = 0.9 * wB + 0.14 * wU;

    /* 漂う光 */
    var da = dust.geometry.attributes.position.array, dv = dust.userData.v, top = V.VH * 0.62;
    for (var j = 0; j < dv.length; j++) {
      da[j * 3 + 1] += dv[j] * dt * (0.35 + 0.65 * wC);
      da[j * 3] += Math.sin(t * 0.3 + j) * dt * 0.05;
      if (da[j * 3 + 1] > top + V.ay) da[j * 3 + 1] = -top + V.ay;
    }
    dust.geometry.attributes.position.needsUpdate = true;

    /* データの流れ（稼働の場面） */
    var sOn = 0.95 * w4 + 0.2 * w3;
    stream.material.opacity = sOn;
    if (sOn > 0.01) {
      var sa = stream.geometry.attributes.position.array;
      for (var m = 0; m < streamT.length; m++) {
        streamT[m] += dt * streamV[m];
        if (streamT[m] >= 1) { streamT[m] = 0; resetStream(m); }
        var u = streamT[m] * streamT[m];
        _v.copy(streamS[m]).lerp(streamE[m], u);
        _v.y += Math.sin(streamT[m] * Math.PI) * 1.2;
        if (wU > 0) _v.sub(appC).applyQuaternion(tiltQ).add(appC);
        sa[m * 3] = _v.x; sa[m * 3 + 1] = _v.y; sa[m * 3 + 2] = _v.z;
      }
      stream.geometry.attributes.position.needsUpdate = true;
    }

    /* 設計図の流れの上を走る光 */
    packets.material.opacity = wB;
    if (wB > 0.01) {
      var pa = packets.geometry.attributes.position.array, nSeg = flowPath.length - 1;
      for (var n = 0; n < 16; n++) {
        var u2 = ((t * 0.12 + n / 16) % 1) * nSeg, si = Math.floor(u2), sf = u2 - si;
        _v.copy(flowPath[si]).lerp(flowPath[si + 1], sf);
        pa[n * 3] = _v.x; pa[n * 3 + 1] = _v.y + 0.02; pa[n * 3 + 2] = _v.z;
      }
      packets.geometry.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, cam);
    updateDom(P);
    updateTags(P);
  }

  function start() { if (!running) { running = true; last = clock.getElapsedTime(); if (!raf) raf = requestAnimationFrame(frame); } }
  function stop() { running = false; }

  /* 画面外・別タブのときは止める */
  new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (en.isIntersecting && !document.hidden) start(); else { stop(); if (header) header.classList.remove('hx-over'); }
    });
  }, { rootMargin: '80px 0px' }).observe(sec);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else { var r = sec.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) start(); }
  });

  /* 画面の大きさが変わったら作り直す（3Dの舞台は 100svh なので、スマホのアドレスバーの出入りでは変わらない） */
  var rsT = 0, lastW = 0, lastH = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rsT);
    rsT = setTimeout(function () {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h; layout();
    }, 160);
  });

  if (QS.has('hxDebug')) window.__hx = { mesh: mesh, V: V, APP: APP, cam: cam, getP: function () { return P; }, getV: function () { return V; } };
  layout();
  lastW = stage.clientWidth; lastH = stage.clientHeight;
  for (var i0 = 0; i0 < NMAX; i0++) mesh.setColorAt(i0, _c.setRGB(0.8, 0.8, 0.8));
  panels.forEach(function (el) { var on = +el.dataset.hxStep === 0; el.classList.toggle('is-on', on); setTabbable(el, on); });
  introT = FORCE_P != null ? -10 : clock.getElapsedTime();
  curS.set(V.ax, V.ay, 0);
  start();
})();
