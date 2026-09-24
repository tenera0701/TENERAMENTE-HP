/* ミエルーム「機能の使い方」ページ（mieroom/guide/*.html）用
   日本語のぶら下がり防止の予備。文節での折り返し（word-break:auto-phrase）に未対応のブラウザ（Safari・Firefox）だけ、
   ビルド時に固まり（.og）を付けられなかった文の末尾4文字（＋句読点）を折り返さない固まりにして、「す。」だけが次の行に落ちるのを防ぐ。
   Chrome・Edge は文節で折り返すので何もしない（単語の途中に固まりの切れ目を作ると、そこで割れてしまうため）。
   mrOg(true) で対応ブラウザでも強制的に動かせる（確認用） */
window.mrOg = function (force) {
  if (!force && window.CSS && CSS.supports && CSS.supports('word-break', 'auto-phrase')) return;
  var SEL = '.g-page p, .g-page li, .g-page summary, .faq-a, .g-rel-name, .g-rel-catch, .foot-brand p';
  document.querySelectorAll(SEL).forEach(function (el) {
    if (el.querySelector('.og') || el.closest('.og')) return;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, last = null;
    while ((n = w.nextNode())) { if (n.nodeValue.trim()) last = n; }
    if (!last) return;
    var t = last.nodeValue.replace(/\s+$/, '');
    if (Array.from(t).length < 6) return;
    var m = t.match(/(.{4}[。、」』）!?！？]*)$/u);
    if (!m) return;
    var s = document.createElement('span');
    s.className = 'og';
    s.textContent = m[1];
    last.nodeValue = t.slice(0, t.length - m[1].length);
    last.parentNode.insertBefore(s, last.nextSibling);
  });
};
window.mrOg();
