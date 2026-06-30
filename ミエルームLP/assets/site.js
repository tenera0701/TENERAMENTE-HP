/* ===== ミエルーム 共通スクリプト (site.js) ===== */
(function(){
  // scroll reveal
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){
        e.target.classList.add('in');
        if(e.target.classList.contains('bars')) e.target.classList.add('grown');
        if(e.target.classList.contains('roi-list')) e.target.querySelectorAll('.roi-bar').forEach(function(b){b.classList.add('grown')});
        io.unobserve(e.target);
      }
    });
  },{threshold:.14});
  document.querySelectorAll('.reveal,.r-left,.r-right,.r-pop,.stagger,.bars,.roi-list').forEach(function(el){io.observe(el)});
})();
