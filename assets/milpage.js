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

/* ------------------------------------------------------------
   「Cookieの設定」— 同意・拒否を選び直す入口（2026-11-25）
   ・ページの一番下（フッター）の「プライバシーポリシー」の次の行に、自動で「Cookieの設定」を足す
     （HP・ブログ・ミエルームのページは足元がばらばらに作られているので、1か所でまとめて足す）
   ・data-cookie-settings を付けたリンク・ボタンを押すと、選んだ記録を消して開き直し、同意バナーをもう一度出す
     （ATLAS の部品の AT_CONSENT.reset。部品が読めないときは、ここで記録を消して開き直す）
   ------------------------------------------------------------ */
(function () {
  if (window.__cookieSettingsHooked) return;
  window.__cookieSettingsHooked = 1;
  var CONSENT_KEY = 'mp_consent_4e9ded06944b4fdbab4fc27f1bb36c41';   // ATLAS の「同意の保存名」と同じ
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
    if (!t) return;
    e.preventDefault();
    if (window.AT_CONSENT && typeof window.AT_CONSENT.reset === 'function') { window.AT_CONSENT.reset(); return; }
    try { localStorage.removeItem(CONSENT_KEY); } catch (x) {}
    location.reload();
  });
  function addLinks() {
    var links = document.querySelectorAll('footer a[href$="privacy.html"], [class*="foot"] a[href$="privacy.html"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var next = a.nextElementSibling;
      if (a.getAttribute('data-cookie-added') || (next && next.hasAttribute('data-cookie-settings'))) continue;
      a.setAttribute('data-cookie-added', '1');
      var c = document.createElement('a');
      c.href = '#cookie-settings';
      c.className = a.className;
      c.setAttribute('data-cookie-settings', '');
      c.textContent = 'Cookieの設定';
      a.parentNode.insertBefore(c, a.nextSibling);
      if (a.nextSibling !== c) a.parentNode.insertBefore(document.createTextNode('\n'), c);
    }
  }
  // 足元は chrome.js があとから差し込むページもあるので、読み込みの節目ごとに何度か見る（同じ所に二重には足さない）
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addLinks); else addLinks();
  window.addEventListener('load', addLinks);
  setTimeout(addLinks, 1500);
})();
