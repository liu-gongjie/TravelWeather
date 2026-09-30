// A short downward gesture at the page top; long presses remain city sorting.
export function createPullRefresh(target, {onRefresh, isRefreshing, isSorting}) {
  const indicator=document.getElementById('pullRefresh');
  let gesture=null;
  function reset(){gesture=null;indicator.style.height='0px';indicator.classList.remove('pulling');}
  target.addEventListener('touchstart',e=>{
    reset();
    if(e.touches.length!==1 || window.scrollY>0 || isRefreshing() || isSorting()
      || document.querySelector('dialog[open]') || e.target.closest('button,a,input,textarea,select'))return;
    const t=e.touches[0];gesture={x:t.clientX,y:t.clientY,id:t.identifier,time:Date.now(),distance:0,active:false};
  },{passive:true});
  target.addEventListener('touchmove',e=>{
    const g=gesture;if(!g)return;
    if(e.touches.length!==1 || isRefreshing() || isSorting()){reset();return;}
    const t=e.touches[0], dy=t.clientY-g.y, dx=Math.abs(t.clientX-g.x);
    if(t.identifier!==g.id || (!g.active && (Date.now()-g.time>400 || window.scrollY>0 || dy< -8 || dx>Math.max(12,dy)))){reset();return;}
    if(!g.active && dy<12)return;
    g.active=true;g.distance=Math.max(0,dy);
    if(e.cancelable)e.preventDefault();
    indicator.classList.add('pulling');indicator.style.height=Math.min(64,g.distance*.45)+'px';
    indicator.textContent=g.distance>=90?'松开刷新':'下拉刷新';
  },{passive:false});
  target.addEventListener('touchend',e=>{
    if(!gesture || ![...e.changedTouches].some(t=>t.identifier===gesture.id))return;
    const fire=gesture.active && gesture.distance>=90 && !isRefreshing() && !isSorting();
    reset();if(fire)onRefresh();
  });
  target.addEventListener('touchcancel',reset);
  window.addEventListener('blur',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
}
