/* ===== ミエルーム 共通スクリプト (site.js) ===== */
(function(){
  // scroll reveal
  // 14%見えたら出す。ただしスマホでは事例カードやブログの一覧が画面の何倍も長く、14%まで見えることがないので
  // いつまでも白いままだった → 画面の2割以上を占めたら出す（2026-09-25）
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){
      var vh = (e.rootBounds && e.rootBounds.height) || window.innerHeight;
      if(e.isIntersecting && (e.intersectionRatio >= .14 || e.intersectionRect.height >= vh * .2)){
        e.target.classList.add('in');
        if(e.target.classList.contains('bars')) e.target.classList.add('grown');
        if(e.target.classList.contains('roi-list')) e.target.querySelectorAll('.roi-bar').forEach(function(b){b.classList.add('grown')});
        io.unobserve(e.target);
      }
    });
  },{threshold:[0,.02,.05,.1,.14]});
  document.querySelectorAll('.reveal,.r-left,.r-right,.r-pop,.stagger,.bars,.roi-list').forEach(function(el){io.observe(el)});
})();
