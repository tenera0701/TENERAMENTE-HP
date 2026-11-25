/* ============================================================
   サイト演出・アクセス解析の読み込み — 2026-11-25 にミルページから ATLAS に移した
   ------------------------------------------------------------
   ATLAS の読み込み部品（/t/<キー>/site.js）を1本読むだけ。部品が次をまとめて行う:
     ① Cookie 同意バナー（拒否／同意する）。同意を得るまで計測しない
        （改正電気通信事業法の外部送信規律に対応）
     ② 「同意する」を押した人にだけ、GA4・Clarity・ATLAS のサイト分析（ヒートマップ・読了率）を読み込む
   設定（GA4 の測定ID・Clarity のID・バナーの文言）は ATLAS の
   「HP・LP → サイト分析 → （サイト）→ サイト演出 →『解析の同意』」で変える。
   同意の記録はミルページのときと同じ保存名（mp_consent_4e9ded06944b4fdbab4fc27f1bb36c41）を使うので、
   同意済みの人にバナーを出し直さない。社内の端末（?noanalytics=1 で開いた端末）は計測しない（assets/analytics.js）。

   キーは公開される値で秘密ではない。mieroom.cloud と、/mieroom/・/lp-mieroom はミエルーム、それ以外は
   TENERAMENTE に数える（ATLAS 側の「見るページの範囲」と同じ分け方。変えるときは両方そろえる）。
   読み込み方:
     ・通常ページ … assets/chrome.js が自動で読み込む（追記不要）
     ・chrome.js を使わないページ … <script src="assets/milpage.js" async></script> を1行
   （ファイル名は、ページ側の読み込みを変えずに済むようにミルページのときのまま）
   ============================================================ */
(function () {
  if (window.__atlasSiteHooked) return;
  window.__atlasSiteHooked = 1;
  // 社内の端末は ?noanalytics=1 で計測から外す（assets/analytics.js と同じ印。あちらの書き換えを待たない）
  var optOut = /[?&]noanalytics=1/.test(location.search);
  try { optOut = optOut || localStorage.getItem('tnr-no-analytics') === '1'; } catch (e) {}
  if (optOut) { window.AT_NO_ANALYTICS = true; return; }
  var ATLAS = 'https://web-production-2f388.up.railway.app';
  var KEY_TENERA = 'GS8jBZumexwhogsv';
  var KEY_MIEROOM = 'n_TIlxvMUCVXu_e4';
  var p = location.pathname;
  var key = (/(^|\.)mieroom\.cloud$/.test(location.hostname) || p.indexOf('/mieroom/') === 0 || p === '/mieroom' || p.indexOf('/lp-mieroom') === 0) ? KEY_MIEROOM : KEY_TENERA;
  var s = document.createElement('script');
  s.src = ATLAS + '/t/' + key + '/site.js';
  s.async = true;
  (document.head || document.documentElement).appendChild(s);
})();
