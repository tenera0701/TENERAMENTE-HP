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
