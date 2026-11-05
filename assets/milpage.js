/* ============================================================
   ミルページ（自社CMS）連携 — このサイトで店舗IDを書く唯一の場所
   ------------------------------------------------------------
   storeId … ミルページの「連携 → サイト連携」に表示される店舗IDを貼る。
             空のままなら連携部分は一切動かない（サイトは今までどおり）。

   これで動くもの:
     ① サイト演出（Cookie同意バナー・離脱防止ポップアップ）
     ② アクセス解析 GA4 / ヒートマップ Clarity の読み込み
        ※ IDはミルページ側の画面で設定する。Cookie同意を得るまで発火しない
          （改正電気通信事業法の外部送信規律に対応）
     ③ お問い合わせをミルページの問い合わせ管理にも記録（contact.html が使用）
     ④ ATLAS のサイト分析（ヒートマップ・読了率）の計測タグ（このファイルの下の方）

   ブログ記事の連携はここではなくビルド時に行う（scripts/sync-milpage.js）。
   読み込み方:
     ・通常ページ … assets/chrome.js が自動で読み込む（追記不要）
     ・chrome.js を使わないページ … <script src="assets/milpage.js" async></script> を1行
   ============================================================ */
window.MILPAGE = {
  origin: 'https://web-production-744c1.up.railway.app',
  storeId: '4e9ded06944b4fdbab4fc27f1bb36c41',
};

(function () {
  var cfg = window.MILPAGE || {};
  if (!cfg.storeId || !cfg.origin) return;
  if (window.__milpageLoaded) return;
  window.__milpageLoaded = 1;
  window.MP_STORE = cfg.storeId;                 // embed/site.js 側の保険
  var s = document.createElement('script');
  s.src = cfg.origin + '/embed/site.js';
  s.setAttribute('data-store', cfg.storeId);
  s.async = true;
  document.head.appendChild(s);
})();

/* ------------------------------------------------------------
   ATLAS のサイト分析（ヒートマップ・読了率）の計測タグ
   ・GA4 と同じく、Cookie に「同意する」を押した人だけ計測する
     （同意前・拒否・?noanalytics=1 で外した端末では読み込まない）
   ・キーは ATLAS の「HP・LP → サイト分析 → 設定・計測タグ」の値。公開される値で秘密ではない
   ・/mieroom/ と /lp-mieroom はミエルーム、それ以外は TENERAMENTE に数える
     （ATLAS 側の「見るページの範囲」と同じ分け方。変えるときは両方そろえる）
   ------------------------------------------------------------ */
(function () {
  var cfg = window.MILPAGE || {};
  if (!cfg.storeId || window.__atlasTagHooked) return;
  window.__atlasTagHooked = 1;
  // 社内の端末は ?noanalytics=1 で計測から外す（assets/analytics.js と同じ印を見る。あちらの書き換えを待たない）
  var optOut = /[?&]noanalytics=1/.test(location.search);
  try { optOut = optOut || localStorage.getItem('tnr-no-analytics') === '1'; } catch (e) {}
  if (optOut) return;
  var ATLAS = 'https://web-production-2f388.up.railway.app';
  var KEY_TENERA = 'GS8jBZumexwhogsv';
  var KEY_MIEROOM = 'n_TIlxvMUCVXu_e4';
  var p = location.pathname;
  var key = (p.indexOf('/mieroom/') === 0 || p === '/mieroom' || p.indexOf('/lp-mieroom') === 0) ? KEY_MIEROOM : KEY_TENERA;
  function granted() {
    try { return localStorage.getItem('mp_consent_' + cfg.storeId) === 'granted'; } catch (e) { return false; }
  }
  function load() {
    if (window.__atlasTagLoaded || !granted()) return;
    window.__atlasTagLoaded = 1;
    document.removeEventListener('click', onClick, true);
    var s = document.createElement('script');
    s.src = ATLAS + '/t/' + key + '.js';
    s.async = true;
    (document.head || document.documentElement).appendChild(s);
  }
  function onClick() { setTimeout(load, 300); }  // 同意ボタンを押した直後も拾う
  document.addEventListener('click', onClick, true);
  load();
})();
