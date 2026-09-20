/**
 * 計測タグの一元管理
 * ------------------------------------------------------------------
 * ここに ID を入れると、TENERAMENTE と ミエルーム の全ページで計測が始まります。
 * 空のままなら、そのツールは一切読み込まれません（表示速度に影響しません）。
 *
 *   GA4_ID     … Google アナリティクス4 の「測定ID」。G- で始まる文字列
 *                取得先: analytics.google.com → 管理 → データストリーム → ウェブ
 *   CLARITY_ID … Microsoft Clarity の「プロジェクトID」。10文字前後の英数字
 *                取得先: clarity.microsoft.com → Settings → Setup → プロジェクトID
 *
 * Google Search Console は JavaScript では認証できないため、
 * 確認コード（HTMLタグ）を index.html の <head> に貼る必要があります。
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  var GA4_ID = '';
  var CLARITY_ID = '';

  // ローカル確認（localhost / 127.0.0.1 / file://）では計測しない
  var host = location.hostname;
  if (!host || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:') return;

  // 社内アクセスを外したいとき: 一度 ?noanalytics=1 付きで開くと、その端末は以後除外される
  try {
    if (location.search.indexOf('noanalytics=1') >= 0) localStorage.setItem('tnr-no-analytics', '1');
    if (localStorage.getItem('tnr-no-analytics') === '1') return;
  } catch (e) { /* localStorage が使えない環境はそのまま計測する */ }

  /* ---------- Google アナリティクス4 ---------- */
  if (GA4_ID) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
  }

  /* ---------- Microsoft Clarity（ヒートマップ・録画） ---------- */
  if (CLARITY_ID) {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }
})();
