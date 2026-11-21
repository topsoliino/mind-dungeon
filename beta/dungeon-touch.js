// Pointer-captured two-thumb-safe joystick for the browser/mobile game.
// No Phaser dependency: both Canvas and Phaser use the same movementInput().
window.DungeonTouch=(()=>{
 'use strict';
 const deadzone=.10;
 function create({surface,thumb,enabled=()=>true}){
  let pointer=null,value={x:0,y:0};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function read(){return value;}
  function reset(){
   pointer=null;value={x:0,y:0};
   surface.classList.remove('active');
   thumb.style.transform='translate(-50%,-50%)';
  }
  function sample(event){
   const bounds=surface.getBoundingClientRect();
   const cx=bounds.left+bounds.width*.5,cy=bounds.top+bounds.height*.5;
   const limit=Math.max(1,Math.min(bounds.width,bounds.height)*.32);
   const dx=(event.clientX-cx)/limit,dy=(event.clientY-cy)/limit;
   const radius=Math.hypot(dx,dy);
   const power=clamp((radius-deadzone)/(1-deadzone),0,1);
   const nx=radius>0?dx/radius:0,ny=radius>0?dy/radius:0;
   value={x:nx*power,y:ny*power};
   thumb.style.transform='translate(-50%,-50%) translate('+Math.round(nx*power*limit)+'px,'+
    Math.round(ny*power*limit)+'px)';
  }
  function begin(event){
   if(pointer!==null||!enabled())return;
   event.preventDefault();event.stopPropagation();
   pointer=event.pointerId;
   surface.classList.add('active');
   surface.setPointerCapture?.(pointer);
   sample(event);
  }
  function move(event){
   if(event.pointerId!==pointer)return;
   event.preventDefault();event.stopPropagation();
   if(!enabled()){reset();return;}
   sample(event);
  }
  function end(event){
   if(event.pointerId!==pointer)return;
   event.preventDefault();event.stopPropagation();
   if(surface.hasPointerCapture?.(pointer))surface.releasePointerCapture(pointer);
   reset();
  }
  surface.addEventListener('pointerdown',begin);
  surface.addEventListener('pointermove',move);
  surface.addEventListener('pointerup',end);
  surface.addEventListener('pointercancel',end);
  surface.addEventListener('lostpointercapture',event=>{
   if(event.pointerId===pointer)reset();
  });
  return {read,reset};
 }
 return {create};
})();
