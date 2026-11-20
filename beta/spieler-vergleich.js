(()=>{
 'use strict';

 const tile=48,columns=13,rows=10,cell=128,atlasColumns=24;
 const modelSize=110,modelGround=.77597;
 const clips={
  idle:{start:0,frames:4,duration:1.3},
  walk:{start:4,frames:16,duration:.68},
  dash:{start:20,frames:8,duration:.34},
  attack:{start:28,frames:20,duration:.84},
  backhand:{start:48,frames:20,duration:.84}
 };
 // Keep the room speed in step with the planted phase of the Blender run cycle.
 const strideSpeed=(.68/.48)*(modelSize/3.23)/clips.walk.duration,groundY=.882;
 const directions={
  ArrowRight:[1,0],KeyD:[1,0],ArrowLeft:[-1,0],KeyA:[-1,0],
  ArrowDown:[0,1],KeyS:[0,1],ArrowUp:[0,-1],KeyW:[0,-1]
 };
 const heroArt=window.DungeonHeroArt,art=window.DungeonArt,bank=heroArt.bank('study');
 const armor=window.DungeonItems.startingArmor('guardian'),look={gender:'male',color:'#973d4d'};
 const weapon=art.icon('weapon','rust');
 const map=Array.from({length:rows},(_,y)=>Array.from({length:columns},(_,x)=>
  Number(y===0||y===rows-1||x===0||x===columns-1)));
 const terrain=map.map(row=>row.map(()=>null));
 const lights=[{x:2.4*tile,y:2.2*tile,radius:155,color:'#dbc193',power:'52'},
  {x:10.4*tile,y:2.2*tile,radius:142,color:'#cba58d',power:'46'}];
 const ground=art.world(map,()=>3,lights,193,terrain,[],tile);
 const decor=lights.map(p=>({...p,sprite:art.furniture('sanctuary-brazier',3,0)}));
 const presses=new Set();
 const direction=document.querySelector('#direction'),zoomButton=document.querySelector('#zoom');
 const status=document.querySelector('#status'),buttons=Array.from(document.querySelectorAll('[data-clip]'));
 const panes=['pixel','blender'].map(id=>{
  const element=document.getElementById(id);
  return {id,element,ctx:element.getContext('2d',{alpha:false}),width:0,height:0,dpr:1};
 });
 const sheet=new Image();
 let x=columns*tile/2,y=rows*tile/2,scale=1,facing=1,mode='walk',elapsed=0,last=0,repeat=true;
 let dashX=0,dashY=0;
 const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
 const isAttack=clip=>clip==='attack'||clip==='backhand';
 function resize(){
  for(const p of panes){
   p.width=p.element.clientWidth;p.height=p.element.clientHeight;
   p.dpr=Math.min(devicePixelRatio||1,2);
   p.element.width=Math.round(p.width*p.dpr);p.element.height=Math.round(p.height*p.dpr);
  }
 }
 const observer=new ResizeObserver(resize);
 for(const pane of panes)observer.observe(pane.element);
 resize();

 function select(clip,loop){
  mode=clip;elapsed=0;repeat=loop;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.clip===clip));
 }
 for(const button of buttons)button.addEventListener('click',()=>select(button.dataset.clip,true));
 direction.addEventListener('change',()=>{facing=Number(direction.value);});
 zoomButton.addEventListener('click',()=>{
  scale=scale===1?2:1;zoomButton.setAttribute('aria-pressed',String(scale===2));
 });
 addEventListener('keydown',event=>{
  if(event.target.closest?.('select,button,a')&&!Object.hasOwn(directions,event.code))return;
  if(Object.hasOwn(directions,event.code)){
   if(event.target.closest?.('select'))return;
   event.preventDefault();presses.add(event.code);return;
  }
  if(event.code==='Space'||event.code==='KeyF'){
   event.preventDefault();
   if(!event.repeat)select(event.code==='Space'?'attack':'backhand',false);
  }
  if(event.code==='ShiftLeft'||event.code==='ShiftRight'){
   if(event.repeat)return;
   const angle=facing*Math.PI/4;
   dashX=Math.cos(angle);dashY=Math.sin(angle);
   select('dash',false);
  }
 });
 addEventListener('keyup',event=>presses.delete(event.code));
 addEventListener('blur',()=>presses.clear());

 function update(dt){
  elapsed+=dt;
  let dx=0,dy=0;
  for(const key of presses){dx+=directions[key][0];dy+=directions[key][1];}
  const length=Math.hypot(dx,dy);
  const active=mode==='dash'||isAttack(mode);
  if(active&&!repeat&&elapsed>=clips[mode].duration)select(length?'walk':'idle',false);
  const locked=!repeat&&(mode==='dash'||isAttack(mode));
  if(length&&!locked){
   facing=(Math.round(Math.atan2(dy/groundY,dx)/(Math.PI/4))+8)%8;
   direction.value=String(facing);
   if(mode!=='walk'||repeat)select('walk',false);
  }
  if(!length&&!repeat&&mode==='walk')select('idle',false);
  const movingDash=mode==='dash'&&!repeat;
  const speed=length&&!locked?strideSpeed*Math.hypot(dx,dy*groundY)/length:0;
  x=bound(x+dt*(movingDash?dashX*290:length?dx/length*speed:0),tile+19,(columns-1)*tile-19);
  y=bound(y+dt*(movingDash?dashY*290:length?dy/length*speed:0),tile+19,(rows-1)*tile-19);
 }
 function drawPixel(ctx,angle,progress){
  const time=mode==='walk'?progress*8:mode==='idle'?progress*2:progress;
  const sprite=bank.get(look,armor,angle,isAttack(mode)?'attack':mode,time);
  const body=()=>heroArt.draw(ctx,sprite,Math.round(x-37),Math.round(y-48),74,74);
  const side=Math.cos(angle)<-.23?-1:1,behind=Math.sin(angle)<-.38;
  const attack=isAttack(mode)?(progress*2-1)*(mode==='backhand'?-1.14:1.14):0;
  if(!behind)body();
  ctx.save();
  ctx.translate(x+side*14,y-2);ctx.rotate(angle+attack+Math.PI/2);
  ctx.drawImage(weapon,-29,-45,58,58);ctx.restore();
  if(behind)body();
 }
 function drawBlender(ctx,clip,progress){
  const frame=clip.start+Math.min(clip.frames-1,Math.floor(progress*clip.frames));
  const index=frame*8+facing;
  ctx.fillStyle='#110d1780';
  ctx.beginPath();ctx.ellipse(x,y+13,21,5,0,0,Math.PI*2);ctx.fill();
  ctx.drawImage(sheet,index%atlasColumns*cell,Math.floor(index/atlasColumns)*cell,cell,cell,
   Math.round(x-modelSize/2),Math.round(y+16-modelSize*modelGround),modelSize,modelSize);
 }
 function draw(pane,clip,progress){
  const {ctx,width,height,dpr}=pane;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#101212';ctx.fillRect(0,0,width,height);
  const left=bound(x-width/(2*scale),0,Math.max(0,columns*tile-width/scale));
  const top=bound(y-height/(2*scale),0,Math.max(0,rows*tile-height/scale));
  ctx.setTransform(dpr*scale,0,0,dpr*scale,Math.round(-left*dpr*scale),Math.round(-top*dpr*scale));
  ctx.imageSmoothingEnabled=false;
  for(const part of ground)ctx.drawImage(part.bitmap,part.x,part.y);
  for(const prop of decor)ctx.drawImage(prop.sprite,prop.x-44,prop.y-53,88,77);
  if(pane.id==='pixel')drawPixel(ctx,facing*Math.PI/4,progress);
  else{
   ctx.imageSmoothingEnabled=scale===1;
   drawBlender(ctx,clip,progress);
  }
 }
 function loop(now){
  const dt=Math.min(.05,(now-last)/1000);
  last=now;update(dt);
  const clip=clips[mode];
  const progress=repeat||mode==='idle'||mode==='walk'?(elapsed%clip.duration)/clip.duration:Math.min(1,elapsed/clip.duration);
  for(const pane of panes)draw(pane,clip,progress);
  requestAnimationFrame(loop);
 }
 sheet.addEventListener('load',()=>{
  status.hidden=true;
  last=performance.now();requestAnimationFrame(loop);
 });
 sheet.addEventListener('error',()=>{status.textContent='Das Blender-Sprite-Sheet konnte nicht geladen werden.';});
 sheet.src='art/player-study/guardian-atlas.webp?v=2';
})();
