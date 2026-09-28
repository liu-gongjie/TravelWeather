// Long press arms sorting; moving before the delay keeps native page scrolling.
export function createCardSorter(container, { onCommit, onFinish }) {
  let gesture = null, frame = 0, suppressClickUntil = 0;
  function finish(commit = false) {
    if (!gesture) return;
    const g = gesture; gesture = null;
    clearTimeout(g.timer); cancelAnimationFrame(frame);
    if (g.active) {
      suppressClickUntil = Date.now() + 400;
      g.ghost.remove(); g.card.classList.remove('sort-placeholder');
      document.body.classList.remove('sorting-cities');
      if (commit) onCommit([...container.querySelectorAll('[data-sortable]')].map(c => c.dataset.city));
    }
    onFinish();
  }
  function update() {
    if (!gesture?.active) return;
    const g = gesture;
    g.ghost.style.top = `${g.y - g.offsetY}px`;
    const others = [...container.querySelectorAll('[data-sortable]')].filter(c => c !== g.card);
    const next = others.find(c => { const r = c.getBoundingClientRect(); return g.y < r.top + r.height / 2; });
    container.insertBefore(g.card, next || null);
  }
  function tick() {
    if (!gesture?.active) return;
    const y = gesture.y, edge = 80;
    const speed = y < edge ? -Math.min(14, (edge-y)/5) : y > innerHeight-edge ? Math.min(14,(y-innerHeight+edge)/5) : 0;
    if (speed) window.scrollBy(0,speed);
    update(); frame = requestAnimationFrame(tick);
  }
  function start(target,x,y,kind,id) {
    if (gesture) return;
    const card = target.closest('[data-sortable]');
    if (!card || target.closest('button,a,input') || container.querySelectorAll('[data-sortable]').length < 2) return;
    const g = gesture = {card,x,y,startX:x,startY:y,kind,id,active:false};
    g.timer = setTimeout(() => {
      if (gesture !== g || !card.isConnected) return;
      const rect=card.getBoundingClientRect();
      g.active=true;g.offsetY=g.y-rect.top;
      g.ghost=card.cloneNode(true);g.ghost.removeAttribute('data-sortable');g.ghost.removeAttribute('data-city');
      g.ghost.setAttribute('aria-hidden','true');g.ghost.classList.add('sort-ghost');
      Object.assign(g.ghost.style,{width:`${rect.width}px`,left:`${rect.left}px`,top:`${rect.top}px`});
      document.body.append(g.ghost);card.classList.add('sort-placeholder');document.body.classList.add('sorting-cities');
      tick();
    },450);
  }
  function move(x,y,event) {
    if (!gesture) return;
    if (!gesture.active && Math.hypot(x-gesture.startX,y-gesture.startY)>10) { finish(); return; }
    gesture.x=x;gesture.y=y;
    if (gesture.active) { if(event.cancelable)event.preventDefault();update(); }
  }
  container.addEventListener('touchstart',e=>{
    if(e.touches.length!==1){finish();return;}
    const t=e.touches[0];start(e.target,t.clientX,t.clientY,'touch',t.identifier);
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(gesture?.kind!=='touch')return;
    if(e.touches.length!==1){finish();return;}
    const t=[...e.touches].find(t=>t.identifier===gesture.id);if(t)move(t.clientX,t.clientY,e);
  },{passive:false});
  document.addEventListener('touchend',e=>{if(gesture?.kind==='touch' && [...e.changedTouches].some(t=>t.identifier===gesture.id))finish(true);});
  document.addEventListener('touchcancel',()=>finish());
  container.addEventListener('mousedown',e=>{if(e.button===0)start(e.target,e.clientX,e.clientY,'mouse');});
  window.addEventListener('mousemove',e=>{if(gesture?.kind==='mouse')move(e.clientX,e.clientY,e);});
  window.addEventListener('mouseup',()=>{if(gesture?.kind==='mouse')finish(true);});
  container.addEventListener('contextmenu',e=>{if(e.target.closest('[data-sortable]'))e.preventDefault();});
  container.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('blur',()=>finish());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape')finish();});
  return { isBusy:()=>!!gesture };
}
