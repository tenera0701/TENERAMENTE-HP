/**
 * 計測（アクセス解析）について
 * ------------------------------------------------------------------
 * GA4 と Clarity（ヒートマップ）は、ミルページが読み込む
 * （assets/milpage.js → ミルページの embed/site.js）。ID はミルページの管理画面で設定する。
 *   GA4 の測定ID          … G-7GB2364PBY（プロパティ: teneramente.jp）
 *   Clarity のプロジェクトID … xyhqpguofs
 * 訪問者が Cookie バナーで「同意する」を押したときだけ計測が始まる
 * （ミルページの設定「同意を得るまで計測しない」がオン）。
 *
 * ⚠ このファイルで GA4 や Clarity を読み込まないこと。
 *   同意の前や「拒否」の後にも計測してしまい、同意した人は二重に数えられる
 *   （2026-09-20〜23 に実際にそうなっていた）。
 *
 * このファイルに残している機能は「社内の端末を計測から外す」だけ:
 *   一度 ?noanalytics=1 を付けて開くと、その端末は以後計測されない
 *   （ミルページの同意状態を「拒否」にしておく）。
 *
 * Google Search Console はドメインプロパティ sc-domain:teneramente.jp で設定済み。
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';
  var STORE = (window.MILPAGE && window.MILPAGE.storeId) || '4e9ded06944b4fdbab4fc27f1bb36c41';
  try {
    var optOut = location.search.indexOf('noanalytics=1') >= 0 || localStorage.getItem('tnr-no-analytics') === '1';
    if (!optOut) return;
    localStorage.setItem('tnr-no-analytics', '1');
    localStorage.setItem('mp_consent_' + STORE, 'denied');
  } catch (e) { /* localStorage が使えない環境では何もしない */ }
})();
