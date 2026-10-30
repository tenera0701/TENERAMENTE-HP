/* ミエルーム — トップの3D「反響から入金まで」（hero-flow.css と対。TENERAMENTE の assets/hero-system.js と同じ作り）
   スクロールで場面が進む:
     0 反響が届く     （ポータル・LINE・メール・電話の反響カードが右から次々に流れ込む）
     1 反響を一覧に   （カードが反響一覧の行にきれいに並ぶ）
     2 追客・接客     （反響 → 接客 → 申込 の3列に振り分けられる）
     3 申込から入金   （申込 → 審査 → 契約 → 入金 のレーンをカードが流れる）
     4 売上が見える   （売上分析の実画面が立ち上がり、棒グラフが伸びる）
   カーソルの近くのカードは持ち上がり、実画面はカーソルの方へ傾く。マスコットはカーソルの方を向く。three.js r128（CDN）。
   WebGL が使えない・動きを減らす設定・three.js の読み込み失敗や遅延のときは .mf--static（今までのトップの見た目）にする。
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

  /* 色（ミエルームの配色: 緑 #14a085・テラコッタ #e07a5f・LINEの緑・アンバー） */
  var C = {
    card: [0.965, 0.988, 0.978], line: [0.82, 0.87, 0.85], head: [0.078, 0.627, 0.522],
    LINE: [0.024, 0.78, 0.333], portal: [0.878, 0.478, 0.373], mail: [0.078, 0.627, 0.522], tel: [0.91, 0.608, 0.11],
    teal: [0.078, 0.627, 0.522], tealHi: [0.17, 0.75, 0.64], terra: [0.878, 0.478, 0.373], bar: [0.078, 0.627, 0.522]
  };
  var MEDIA = [C.portal, C.LINE, C.mail, C.portal, C.tel, C.LINE, C.portal, C.mail];

  /* ---------- three.js の準備 ---------- */
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;   // 指定した色がそのまま（蛍光色に寄らずに）出るように
  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(lin(0xeef7f3), 0.02);
  var FOV = 36, TAN = Math.tan(FOV * Math.PI / 360);
  var cam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
  scene.add(new THREE.HemisphereLight(lin(0xffffff), lin(0xa9d9cb), 0.62));
  var key = new THREE.DirectionalLight(0xffffff, 0.78); key.position.set(-4, 7, 9); scene.add(key);
  var curLight = new THREE.PointLight(lin(0x7fe3cf), 0.55, 7, 2); scene.add(curLight);

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

  var NMAX = 48;
  var matCard = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.02 });
  var cards = new THREE.InstancedMesh(slab(1, 1, 0.22, 0.6), matCard, NMAX);
  var dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 18, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }), NMAX);
  var bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), NMAX);
  [cards, dots, bars].forEach(function (m) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); });

  /* 売上分析の実画面（最後の場面で立ち上がる） */
  var screen = new THREE.Group();
  var frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, transparent: true, opacity: 0 });
  var bezel = new THREE.Mesh(slab(8.2, 4.2, 0.28, 0.16), frameMat);
  var shotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false });
  var shot = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 7.8 * 764 / 1600), shotMat);
  shot.position.z = 0.2;   // 枠（厚み0.16＋面取り）の表面より手前に出す
  screen.add(bezel); screen.add(shot); scene.add(screen);
  new THREE.TextureLoader().load(sec.dataset.mfShot || 'assets/app-uriage-hd.webp', function (tex) {
    tex.encoding = THREE.sRGBEncoding; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); shotMat.map = tex; shotMat.needsUpdate = true;
  });

  /* 申込 → 審査 → 契約 → 入金 の駅とレーン */
  var nodes = [], nodeBase = [];
  var nodeMat = [C.teal, C.teal, C.teal, C.terra].map(function (c) { return new THREE.MeshStandardMaterial({ color: new THREE.Color(c[0], c[1], c[2]).convertSRGBToLinear(), roughness: 0.5, transparent: true, opacity: 0 }); });
  for (var k = 0; k < 4; k++) { var nm = new THREE.Mesh(slab(1.5, 0.82, 0.38, 0.4), nodeMat[k]); scene.add(nm); nodes.push(nm); }
  var laneMat = new THREE.MeshStandardMaterial({ color: lin(0x9fdccd), roughness: 0.6, transparent: true, opacity: 0 });
  var lane = new THREE.Mesh(new THREE.BufferGeometry(), laneMat); scene.add(lane);
  var curve = null;

  /* ---------- 画面の大きさに合わせた配置 ---------- */
  var V = {}, S = 5;
  var POS = [], QUA = [], SCL = [], COL = [], DEL = [], MED = [];
  var CAMP = [], CAML = [];
  var PH = new Float32Array(NMAX * 4), LOC0 = new Float32Array(NMAX * 2);
  var appM = new THREE.Matrix4(), appQ = new THREE.Quaternion(), appC = new THREE.Vector3();
  var tags = [];
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(),
      _e = new THREE.Euler(), _m = new THREE.Matrix4(), _c = new THREE.Color(), tiltQ = new THREE.Quaternion(), tiltFull = new THREE.Quaternion(), qI = new THREE.Quaternion();
  function toWorld(x, y, z, out) { return out.set(x, y, z).applyMatrix4(appM); }

  function layout() {
    var w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight, asp = w / h;
    var mobile = PORTRAIT_MQ.matches, D, VW, VH, ax, ay;
    if (!mobile) {
      var share = asp >= 1.5 ? 0.48 : asp >= 1.25 ? 0.42 : 0.38;
      D = Math.max((8.4 / share) / (2 * TAN * asp), (5.0 / 0.62) / (2 * TAN));
      VW = 2 * D * TAN * asp; VH = VW / asp;
      ax = 0.44 * VW - 4.4; ay = h <= 600 ? 0.15 : -0.1;
    } else {
      VW = 8.4 / (asp > 0.52 ? 0.68 : 0.88); D = VW / (2 * TAN * asp); VH = VW / asp;
      ax = 0; ay = VH * (asp > 0.52 ? 0.25 : 0.19);
    }
    V = { w: w, h: h, asp: asp, mobile: mobile, D: D, VW: VW, VH: VH, ax: ax, ay: ay, N: mobile ? 36 : NMAX };
    [cards, dots, bars].forEach(function (m) { m.count = V.N; });
    renderer.setPixelRatio(lowRes ? lowResRatio() : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    cam.aspect = asp; cam.updateProjectionMatrix();
    scene.fog.density = 0.32 / D;
    appQ.setFromEuler(new THREE.Euler(mobile ? 0 : 0.03, mobile ? 0 : -0.16, 0));
    appM.compose(new THREE.Vector3(ax, ay, 0), appQ, new THREE.Vector3(1, 1, 1));
    appC.set(ax, ay, 0);
    build();
  }

  function setState(s, i, px, py, pz, q, sx, sy, sz, c) {
    POS[s][i * 3] = px; POS[s][i * 3 + 1] = py; POS[s][i * 3 + 2] = pz; q.toArray(QUA[s], i * 4);
    SCL[s][i * 3] = sx; SCL[s][i * 3 + 1] = sy; SCL[s][i * 3 + 2] = sz;
    COL[s][i * 3] = c[0]; COL[s][i * 3 + 1] = c[1]; COL[s][i * 3 + 2] = c[2];
  }

  /* 場面3の「流れる」カード・場面4の棒グラフ・場面2の列の割り振り */
  var FLOWN = 14, NBARS = 8;
  var KAN = [];   // 場面2: [列, 段]

  function build() {
    var N = V.N, s, i, r = rng(5), q = new THREE.Quaternion();
    for (s = 0; s < S; s++) { POS[s] = new Float32Array(NMAX * 3); QUA[s] = new Float32Array(NMAX * 4); SCL[s] = new Float32Array(NMAX * 3); COL[s] = new Float32Array(NMAX * 3); DEL[s] = new Float32Array(NMAX); }
    MED = [];
    for (i = 0; i < N; i++) {
      MED.push(MEDIA[i % MEDIA.length]);
      PH[i * 4] = r(); PH[i * 4 + 1] = r() * 6.28; PH[i * 4 + 2] = r() * 6.28; PH[i * 4 + 3] = r() * 6.28;
      /* 0 反響が届く（右から流れ込む。位置の基準だけ。毎フレーム流す） */
      var x0 = (r() * 2 - 1) * 4.6, y0 = V.mobile ? (r() * 2 - 1) * 1.7 + 0.8 : (r() * 2 - 1) * 2.7, z0 = -r() * V.D * 0.3 + 0.8;
      LOC0[i * 2] = y0; LOC0[i * 2 + 1] = z0;
      q.setFromEuler(_e.set((r() - 0.5) * 0.9, (r() - 0.5) * 1.2, (r() - 0.5) * 0.7)).premultiply(appQ);
      toWorld(x0, y0, z0, _v);
      var big = V.mobile ? 1.35 : 1;
      setState(0, i, _v.x, _v.y, _v.z, q, 1.7 * big, 0.62 * big, 0.12, C.card);
      /* 1 反響一覧（2列 × 12段。それより多いカードは一覧の後ろに重ねる） */
      var col = i % 2, row = Math.floor(i / 2), vis = row < 12;
      toWorld(-2.1 + col * 4.2, 2.05 - Math.min(row, 11) * 0.37, vis ? 0 : -0.25 - (row - 11) * 0.12, _v);
      setState(1, i, _v.x, _v.y, _v.z, appQ, 3.9, 0.3, vis ? 0.1 : 0.06, C.card);
      DEL[1][i] = clamp(row / 14 * 0.7 + col * 0.06, 0, 1);
    }
    /* 2 反響 → 接客 → 申込（漏斗のように数が減っていく） */
    var per = [Math.ceil(N * 0.5), Math.ceil(N * 0.3)]; per.push(N - per[0] - per[1]);
    KAN = []; var idx = 0;
    for (var c = 0; c < 3; c++) for (var j = 0; j < per[c]; j++) KAN[idx++] = [c, j];
    for (i = 0; i < N; i++) {
      var cc = KAN[i][0], jj = KAN[i][1], shown = jj < 9;
      toWorld(-2.8 + cc * 2.8, 1.75 - Math.min(jj, 8) * 0.48, shown ? 0 : -0.3 - (jj - 8) * 0.1, _v);
      setState(2, i, _v.x, _v.y, _v.z, appQ, 2.5, 0.4, shown ? 0.12 : 0.06, C.card);
      DEL[2][i] = clamp(cc * 0.18 + jj / 12 * 0.5 + r() * 0.1, 0, 1);
    }
    /* 3 申込 → 入金（レーンを流れるカードは毎フレーム計算。それ以外は駅の後ろに積む） */
    var pts = [];
    for (k = 0; k < 4; k++) {
      var nx = -2.55 + k * 1.95, ny = 0.3 + Math.sin(k * 1.1) * 0.5;
      toWorld(nx, ny, 0, _v); nodes[k].position.copy(_v); nodes[k].quaternion.copy(appQ); nodeBase[k] = _v.clone();
      pts.push(toWorld(nx, ny, 0.25, new THREE.Vector3()));
    }
    var ext = [toWorld(-3.5, -0.5, 0.25, new THREE.Vector3())].concat(pts, [toWorld(3.9, 1.2, 0.25, new THREE.Vector3())]);
    curve = new THREE.CatmullRomCurve3(ext, false, 'centripetal');
    lane.geometry.dispose(); lane.geometry = new THREE.TubeGeometry(curve, 90, 0.05, 8, false);
    for (i = 0; i < N; i++) {
      var kk = i % 4, st = Math.floor(i / 4);
      toWorld(-2.55 + kk * 1.95, 0.3 + Math.sin(kk * 1.1) * 0.5 - 0.9 - st * 0.05, -0.5 - st * 0.08, _v);
      setState(3, i, _v.x, _v.y, _v.z, appQ, 1.2, 0.34, 0.08, C.card);
      DEL[3][i] = r() * 0.5;
    }
    /* 4 売上が見える（棒グラフになるカード以外は、画面の中へ吸い込まれる） */
    for (i = 0; i < N; i++) {
      if (i < NBARS) {
        toWorld(-2.75 + i * 0.84, -2.35, 0.75, _v);
        setState(4, i, _v.x, _v.y, _v.z, appQ, 0.42, 0.4, 0.42, C.bar);
      } else {
        toWorld((r() - 0.5) * 3, (r() - 0.5) * 1.6, -0.2, _v);
        setState(4, i, _v.x, _v.y, _v.z, appQ, 0.01, 0.01, 0.01, C.card);
      }
      DEL[4][i] = r() * 0.4;
    }
    toWorld(0, 0.05, -0.25, _v); screen.position.copy(_v); screen.quaternion.copy(appQ);

    /* カメラ */
    var D = V.D, cy = V.mobile ? V.ay * 0.55 : 0;
    CAMP = [new THREE.Vector3(0, cy, D * 1.03), new THREE.Vector3(0, cy, D), new THREE.Vector3(0, cy + 0.2, D * 0.98), new THREE.Vector3(0, cy + 0.6, D), new THREE.Vector3(-0.2, cy + 0.15, D * 0.98)];
    CAML = [new THREE.Vector3(0, cy, -1), new THREE.Vector3(0, cy, 0), new THREE.Vector3(0, cy, 0), new THREE.Vector3(0, cy, 0), new THREE.Vector3(0, cy, 0)];

    /* 札（HTML）の位置 */
    tags = [];
    sec.querySelectorAll('.mf-tag').forEach(function (el) {
      var t = el.dataset.at.split(':'), sc = +t[0], n = +t[1], p = new THREE.Vector3();
      if (sc === 1) toWorld(-4.0 + n * 4.2, 2.62, 0.1, p);
      else if (sc === 2) toWorld(-4.05 + n * 2.8, 2.35, 0.1, p);
      else if (sc === 3) toWorld(-2.55 + n * 1.95 - 0.45, 0.3 + Math.sin(n * 1.1) * 0.5 + 0.75, 0.3, p);
      tags.push({ el: el, sc: sc, p: p });
    });
  }

  /* ---------- カーソル ---------- */
  var clock = new THREE.Clock();
  var ndc = new THREE.Vector2(), ndcS = new THREE.Vector2(), lastMove = -10, pointer = false;
  var ray = new THREE.Raycaster(), planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  var cur = new THREE.Vector3(), curS = new THREE.Vector3(), OFF = new Float32Array(NMAX * 3);
  window.addEventListener('pointermove', function (e) {
    var r = stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    lastMove = clock.getElapsedTime(); pointer = true;
  }, { passive: true });

  /* ---------- スクロール量 → 場面 ---------- */
  var SPAN = 4.6;
  function scrollSpan() { return sec.offsetHeight - stage.offsetHeight; }
  function readProgress() {
    var r = sec.getBoundingClientRect(), span = scrollSpan();
    var x = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
    var q = x * SPAN, s = Math.floor(q), f = q - s;
    return s >= 4 ? 4 : s + smooth(0.16, 0.84, f);
  }

  /* ---------- 文章・目次・マスコット ---------- */
  var panels = Array.prototype.slice.call(sec.querySelectorAll('[data-mf-step]'));
  var navDots = Array.prototype.slice.call(sec.querySelectorAll('[data-mf-dot]'));
  var mascot = sec.querySelector('.mf-mascot'), say = sec.querySelector('.mf-say'), navEl = sec.querySelector('.mf-nav');
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

  function updateDom(P, t) {
    panels.forEach(function (el) {
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
    if (mascot) {
      mascot.style.setProperty('--ry', (ndcS.x * 40).toFixed(1) + 'deg');
      mascot.style.setProperty('--rx', (ndcS.y * 22).toFixed(1) + 'deg');
      mascot.style.setProperty('--mx', (ndcS.x * 8).toFixed(1) + 'px');
      mascot.style.setProperty('--bob', (Math.sin(t * 2.2) * 5).toFixed(1) + 'px');
    }
  }
  function updateTags(P) {
    tags.forEach(function (tg) {
      var o = clamp(1 - Math.abs(P - tg.sc) * 2.4, 0, 1);
      if (o <= 0.01) { if (tg.el.style.opacity !== '0') tg.el.style.opacity = '0'; return; }
      _v.copy(tg.p).sub(appC).applyQuaternion(tiltQ).add(appC).project(cam);
      tg.el.style.opacity = o.toFixed(3);
      tg.el.style.transform = 'translate3d(' + ((_v.x + 1) / 2 * V.w).toFixed(1) + 'px,' + ((1 - _v.y) / 2 * V.h - 12).toFixed(1) + 'px,0)';
    });
  }

  /* ---------- 毎フレーム ---------- */
  var P = FORCE_P != null ? FORCE_P : 0, introT = -10, last = 0, running = false, raf = 0;

  var perfN = 0, perfT = 0, lowRes = false;
  function lowResRatio() { return (window.devicePixelRatio || 1) > 1 ? 1 : 0.8; }
  function frame() {
    if (!running) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    var t = clock.getElapsedTime(), dt = Math.min(0.05, t - last); last = t;
    if (!lowRes && perfN < 120) { perfN++; if (perfN > 30) perfT += dt; if (perfN === 120 && perfT / 90 > 1 / 35) { lowRes = true; renderer.setPixelRatio(lowResRatio()); renderer.setSize(V.w, V.h, false); } }
    var target = FORCE_P != null ? FORCE_P : readProgress();
    P += (target - P) * Math.min(1, dt * 4.2);
    if (Math.abs(target - P) < 0.0005) P = target;
    var seg = Math.min(3, Math.floor(P)), tt = P - seg, A = seg, B = seg + 1;
    var w0 = clamp(1 - P, 0, 1), w1 = clamp(1 - Math.abs(P - 1), 0, 1), w2 = clamp(1 - Math.abs(P - 2), 0, 1),
        w3 = clamp(1 - Math.abs(P - 3), 0, 1), w4 = clamp(P - 3, 0, 1);
    var intro = introT < 0 ? 1 : ease(clamp((t - introT) / 2.2, 0, 1));

    if (!pointer || t - lastMove > 3) ndc.set(Math.sin(t * 0.33) * 0.5, Math.cos(t * 0.27) * 0.35);
    ndcS.x += (ndc.x - ndcS.x) * Math.min(1, dt * 5); ndcS.y += (ndc.y - ndcS.y) * Math.min(1, dt * 5);

    var ce = ease(tt), par = V.D / 15;
    _v.copy(CAMP[A]).lerp(CAMP[B], ce); _v2.copy(CAML[A]).lerp(CAML[B], ce);
    cam.position.set(_v.x + ndcS.x * 0.55 * par, _v.y + ndcS.y * 0.32 * par, _v.z);
    cam.lookAt(_v2);
    ray.setFromCamera(ndcS, cam);
    if (ray.ray.intersectPlane(planeZ, cur)) curS.lerp(cur, Math.min(1, dt * 7));
    curLight.position.set(curS.x, curS.y, curS.z + 2.2); curLight.distance = 7 * par;

    // カードが並んだあと（場面1〜4）は、盤面全体がカーソルの方へ傾く
    var tiltAmt = clamp(P - 0.4, 0, 1);
    tiltFull.setFromEuler(_e.set(-ndcS.y * 0.16, ndcS.x * 0.24, 0));
    tiltQ.copy(qI).slerp(tiltFull, tiltAmt);

    var N = V.N, R = 2.3 * par, W = 0.42;
    for (var i = 0; i < N; i++) {
      var d = DEL[B][i], lt = clamp((tt - d * W) / (1 - W), 0, 1), e = ease(lt), ia = i * 3;
      var ax0 = POS[A][ia], ay0 = POS[A][ia + 1], az0 = POS[A][ia + 2], bx = POS[B][ia], by = POS[B][ia + 1], bz = POS[B][ia + 2];
      var sbx = SCL[B][ia], sby = SCL[B][ia + 1], sbz = SCL[B][ia + 2];
      // 場面0: 右から左へ流れ込み続ける（端では小さくして、繋ぎ目を見せない）
      var flowS = 1;
      if (A === 0) {
        var u = frac(t * 0.07 + PH[i * 4]);
        toWorld(4.6 - u * 7.8, LOC0[i * 2] + Math.sin(t * 0.6 + PH[i * 4 + 1]) * 0.18, LOC0[i * 2 + 1], _v);
        ax0 = _v.x; ay0 = _v.y; az0 = _v.z;
        flowS = clamp(Math.sin(u * Math.PI) * 1.6, 0, 1);
      }
      // 場面3: 一部のカードはレーンを流れ続ける
      if (B === 3 && i < FLOWN && curve) {
        var uu = frac(t * 0.07 + i / FLOWN);
        curve.getPointAt(uu, _v); bx = _v.x; by = _v.y + 0.32; bz = _v.z + 0.1; sbx = 1.15; sby = 0.4; sbz = 0.12;
      }
      // 場面4: 棒グラフが伸び縮みする（カーソルに近い棒は高く）
      if (B === 4 && i < NBARS) {
        var hh = 0.35 + 0.95 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 0.9)) * (0.55 + i * 0.07);
        toWorld(-2.75 + i * 0.84, -2.75 + hh / 2, 0.75, _v); bx = _v.x; by = _v.y; bz = _v.z; sby = hh;
      }
      var px = ax0 + (bx - ax0) * e, py = ay0 + (by - ay0) * e, pz = az0 + (bz - az0) * e;
      var sx = SCL[A][ia] + (sbx - SCL[A][ia]) * e, sy = SCL[A][ia + 1] + (sby - SCL[A][ia + 1]) * e, sz = SCL[A][ia + 2] + (sbz - SCL[A][ia + 2]) * e;
      var fl = 1 + (flowS - 1) * (1 - e);
      sx *= fl; sy *= fl;
      if (intro < 1) { pz -= (1 - intro) * V.D * 0.6; }

      // カーソル: 近くのカードは持ち上がり、押しのけられる
      var dx = px - curS.x, dy = py - curS.y, dist = Math.sqrt(dx * dx + dy * dy), f = 0;
      if (dist < R) { f = 1 - dist / R; f *= f; }
      var inv = dist > 0.0001 ? 1 / dist : 0, kk2 = Math.min(1, dt * 7);
      var ox = dx * inv * f * 2.2 * w0, oy = dy * inv * f * 2.2 * w0, oz = f * (1.0 * w0 + 1.1 * (w1 + w2 + w3) + 0.8 * w4);
      OFF[ia] += (ox - OFF[ia]) * kk2; OFF[ia + 1] += (oy - OFF[ia + 1]) * kk2; OFF[ia + 2] += (oz - OFF[ia + 2]) * kk2;
      _v.set(px + OFF[ia], py + OFF[ia + 1], pz + OFF[ia + 2]);

      _q.fromArray(QUA[A], i * 4); _q2.fromArray(QUA[B], i * 4); _q.slerp(_q2, e);
      if (w0 > 0.001) { _q2.setFromEuler(_e.set(Math.sin(t * 0.5 + PH[i * 4 + 2]) * 0.18 * w0, Math.sin(t * 0.4 + PH[i * 4 + 3]) * 0.25 * w0, 0)); _q.multiply(_q2); }
      if (f > 0) { _q2.setFromEuler(_e.set(-f * 0.5 * (1 - w0), f * 0.4 * (1 - w0), 0)); _q.multiply(_q2); }
      if (tiltAmt > 0) { _v.sub(appC).applyQuaternion(tiltQ).add(appC); _q.premultiply(tiltQ); }
      var isBar = B === 4 && i < NBARS;
      _s.set(Math.max(0.001, sx), Math.max(0.001, sy), Math.max(0.001, sz));
      _m.compose(_v, _q, _s);
      // カードの本体（棒グラフの場面では棒に、それ以外の場面ではカード）
      var barW = isBar ? e : 0;
      if (barW > 0.5) { bars.setMatrixAt(i, _m); _m.makeScale(0, 0, 0); cards.setMatrixAt(i, _m); dots.setMatrixAt(i, _m); }
      else {
        cards.setMatrixAt(i, _m);
        _m.makeScale(0, 0, 0); bars.setMatrixAt(i, _m);
        // 媒体の色の丸（カードの左端）
        var ds = Math.min(0.2, sy * 0.55) * (sx > 0.05 ? 1 : 0);
        _v2.set(-sx / 2 + Math.min(0.28, sx * 0.18), 0, sz / 2 + 0.06).applyQuaternion(_q).add(_v);
        _m.compose(_v2, _q, _s.set(ds, ds, ds * 0.5));
        dots.setMatrixAt(i, _m);
      }
      var cr = COL[A][ia] + (COL[B][ia] - COL[A][ia]) * e, cg = COL[A][ia + 1] + (COL[B][ia + 1] - COL[A][ia + 1]) * e, cb = COL[A][ia + 2] + (COL[B][ia + 2] - COL[A][ia + 2]) * e;
      var hot = f * 0.35;
      cards.setColorAt(i, _c.setRGB(cr + (C.tealHi[0] - cr) * hot, cg + (C.tealHi[1] - cg) * hot, cb + (C.tealHi[2] - cb) * hot).convertSRGBToLinear());
      var bc = i % 3 === 2 ? C.terra : C.teal;
      bars.setColorAt(i, _c.setRGB(bc[0] + (C.tealHi[0] - bc[0]) * f * 0.5, bc[1] + (C.tealHi[1] - bc[1]) * f * 0.5, bc[2] + (C.tealHi[2] - bc[2]) * f * 0.5).convertSRGBToLinear());
      var md = MED[i];
      dots.setColorAt(i, _c.setRGB(md[0], md[1], md[2]).convertSRGBToLinear());
    }
    [cards, dots, bars].forEach(function (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });

    // 実画面: 場面3の後半から立ち上がる
    var sOn = smooth(3.25, 3.9, P);
    frameMat.opacity = sOn; shotMat.opacity = sOn; bezel.visible = shot.visible = sOn > 0.01;
    var sc = (0.75 + 0.25 * sOn) * 0.88;
    toWorld(0.35, 0.2 - (1 - sOn) * 0.8, -0.25, _v);
    screen.position.copy(_v).sub(appC).applyQuaternion(tiltQ).add(appC);
    screen.quaternion.copy(appQ).premultiply(tiltQ);
    screen.scale.set(sc, sc, sc);
    // 駅とレーン: 場面3だけ
    nodeMat.forEach(function (m) { m.opacity = w3; });
    nodes.forEach(function (n, k2) {
      n.visible = w3 > 0.01; var b = 1 + Math.sin(t * 2 + k2) * 0.03 * w3; n.scale.set(b, b, b);
      n.position.copy(nodeBase[k2]).sub(appC).applyQuaternion(tiltQ).add(appC); n.quaternion.copy(appQ).premultiply(tiltQ);
    });
    laneMat.opacity = w3 * 0.9; lane.visible = w3 > 0.01;
    lane.quaternion.copy(tiltQ); lane.position.copy(appC).sub(_v.copy(appC).applyQuaternion(tiltQ));   // レーンも盤面と一緒に傾ける（appC を軸に回す）

    renderer.render(scene, cam);
    updateDom(P, t);
    updateTags(P);
  }

  function start() { if (!running) { running = true; last = clock.getElapsedTime(); if (!raf) raf = requestAnimationFrame(frame); } }
  function stop() { running = false; }
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

  if (QS.has('mfDebug')) window.__mf = { cards: cards, bars: bars, nodes: nodes, screen: screen, bezel: bezel, cam: cam, getP: function () { return P; }, getV: function () { return V; } };
  layout();
  lastW = stage.clientWidth; lastH = stage.clientHeight;
  for (var i0 = 0; i0 < NMAX; i0++) { cards.setColorAt(i0, _c.setRGB(1, 1, 1)); dots.setColorAt(i0, _c.setRGB(1, 1, 1)); bars.setColorAt(i0, _c.setRGB(1, 1, 1)); }
  panels.forEach(function (el) { var on = +el.dataset.mfStep === 0; el.classList.toggle('is-on', on); setTabbable(el, on); });
  introT = FORCE_P != null ? -10 : clock.getElapsedTime();
  curS.set(V.ax, V.ay, 0);
  start();
})();
