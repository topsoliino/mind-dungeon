(()=>{
 'use strict';

 const tile=48,columns=23,rows=13,cell=128,atlasColumns=28;
 const modelSize=110,modelGround=.77597;
 const clips={
  idle:{start:0,frames:4,duration:1.3},
  walk:{start:4,frames:16,duration:.88},
  run:{start:20,frames:16,duration:.61},
  sprint:{start:36,frames:16,duration:.49},
  dash:{start:52,frames:8,duration:.34},
  attack:{start:60,frames:20,duration:.84},
  backhand:{start:80,frames:20,duration:.84}
 };
 // Keep the room speed in step with the planted phase of each Blender gait.
 const strideSpeed={
  walk:(.59/.60)*(modelSize/3.23)/clips.walk.duration,
  run:(.78/.375)*(modelSize/3.23)/clips.run.duration,
  sprint:(.82/.34)*(modelSize/3.23)/clips.sprint.duration
 },groundY=.882;
 const directions={
  ArrowRight:[1,0],KeyD:[1,0],ArrowLeft:[-1,0],KeyA:[-1,0],
  ArrowDown:[0,1],KeyS:[0,1],ArrowUp:[0,-1],KeyW:[0,-1]
 };
 const art=window.DungeonArt;
 const map=Array.from({length:rows},(_,y)=>Array.from({length:columns},(_,x)=>
  Number(y===0||y===rows-1||x===0||x===columns-1)));
 const terrain=map.map(row=>row.map(()=>null));
 const lights=[{x:5.4*tile,y:3.2*tile,radius:155,color:'#dbc193',power:'52'},
  {x:17.4*tile,y:3.2*tile,radius:142,color:'#cba58d',power:'46'}];
 const ground=art.world(map,()=>3,lights,193,terrain,[],tile);
 const decor=lights.map(p=>({...p,sprite:art.furniture('sanctuary-brazier',3,0)}));
 const presses=new Set();
 const direction=document.querySelector('#direction'),zoomButton=document.querySelector('#zoom'),weaponButton=document.querySelector('#weapon');
 const status=document.querySelector('#status'),buttons=Array.from(document.querySelectorAll('[data-clip]'));
 const gaitButtons=Array.from(document.querySelectorAll('[data-gait]'));
 const canvas=document.querySelector('#blender'),ctx=canvas.getContext('2d',{alpha:false});
 let width=0,height=0,dpr=1;
 const bodySheet=new Image(),weaponSheet=new Image();
 let weaponFrames=[];
 let x=columns*tile/2,y=rows*tile/2,scale=1,facing=1,mode='idle',selectedGait='run',elapsed=0,last=0,repeat=true;
 let dashX=0,dashY=0,wantsSprint=false,showWeapon=true;
 const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
 const isAttack=clip=>clip==='attack'||clip==='backhand';
 const isGait=clip=>Object.hasOwn(strideSpeed,clip);
 function resize(){
  width=canvas.clientWidth;height=canvas.clientHeight;
  dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 }
 new ResizeObserver(resize).observe(canvas);
 resize();

 function select(clip,loop){
  const phase=isGait(mode)&&isGait(clip)?(elapsed%clips[mode].duration)/clips[mode].duration:0;
  mode=clip;elapsed=phase*clips[clip].duration;repeat=loop;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.clip===clip));
 }
 function changeGait(gait,preview=false){
  selectedGait=gait;
  for(const button of gaitButtons)button.setAttribute('aria-pressed',String(button.dataset.gait===gait));
  if(preview)select(gait,true);
  else if(isGait(mode)&&mode!=='sprint')select(gait,repeat);
 }
 for(const button of gaitButtons)button.addEventListener('click',()=>changeGait(button.dataset.gait,true));
 for(const button of buttons)button.addEventListener('click',()=>select(button.dataset.clip,true));
 direction.addEventListener('change',()=>{facing=Number(direction.value);});
 zoomButton.addEventListener('click',()=>{
  scale=scale===1?2:1;zoomButton.setAttribute('aria-pressed',String(scale===2));
 });
 weaponButton.addEventListener('click',()=>{
  showWeapon=!showWeapon;weaponButton.setAttribute('aria-pressed',String(showWeapon));
 });
 addEventListener('keydown',event=>{
  if(event.code==='ShiftLeft'||event.code==='ShiftRight'){
   if(!event.repeat)changeGait(selectedGait==='walk'?'run':'walk');
   return;
  }
  if(event.code==='KeyQ'){event.preventDefault();wantsSprint=true;return;}
  if(event.target.closest?.('select,button,a')&&!Object.hasOwn(directions,event.code))return;
  if(Object.hasOwn(directions,event.code)){
   if(event.target.closest?.('select'))return;
   event.preventDefault();presses.add(event.code);return;
  }
  if(event.code==='Space'||event.code==='KeyF'){
   event.preventDefault();
   if(!event.repeat)select(event.code==='Space'?'attack':'backhand',false);
  }
  if(event.code==='KeyX'){
   if(event.repeat)return;
   const angle=facing*Math.PI/4;
   dashX=Math.cos(angle);dashY=Math.sin(angle);
   select('dash',false);
  }
 });
 addEventListener('keyup',event=>{
  if(event.code==='KeyQ')wantsSprint=false;
  presses.delete(event.code);
 });
 addEventListener('blur',()=>{presses.clear();wantsSprint=false;});

 function update(dt){
  elapsed+=dt;
  let dx=0,dy=0;
  for(const key of presses){dx+=directions[key][0];dy+=directions[key][1];}
  const length=Math.hypot(dx,dy);
  const gait=wantsSprint?'sprint':selectedGait;
  const active=mode==='dash'||isAttack(mode);
  if(active&&!repeat&&elapsed>=clips[mode].duration)select(length?gait:'idle',false);
  const locked=!repeat&&(mode==='dash'||isAttack(mode));
  if(length&&!locked){
   facing=(Math.round(Math.atan2(dy/groundY,dx)/(Math.PI/4))+8)%8;
   direction.value=String(facing);
   if(mode!==gait||repeat)select(gait,false);
  }
  if(!length&&!repeat&&isGait(mode))select('idle',false);
  const movingDash=mode==='dash'&&!repeat;
  const speed=length&&!locked?strideSpeed[gait]*Math.hypot(dx,dy*groundY)/length:0;
  x=bound(x+dt*(movingDash?dashX*290:length?dx/length*speed:0),tile+19,(columns-1)*tile-19);
  y=bound(y+dt*(movingDash?dashY*290:length?dy/length*speed:0),tile+19,(rows-1)*tile-19);
 }
 function drawBlender(ctx,clip,progress){
  const frame=clip.start+Math.min(clip.frames-1,Math.floor(progress*clip.frames));
  const index=frame*8+facing;
  ctx.fillStyle='#110d1780';
  ctx.beginPath();ctx.ellipse(x,y+13,21,5,0,0,Math.PI*2);ctx.fill();
  const left=Math.round(x-modelSize/2),top=Math.round(y+16-modelSize*modelGround);
  ctx.drawImage(bodySheet,index%atlasColumns*cell,Math.floor(index/atlasColumns)*cell,cell,cell,left,top,modelSize,modelSize);
  const weapon=showWeapon&&weaponFrames[index];
  if(weapon){
   const [sx,sy,w,h,dx,dy]=weapon,ratio=modelSize/cell;
   ctx.drawImage(weaponSheet,sx,sy,w,h,left+dx*ratio,top+dy*ratio,w*ratio,h*ratio);
  }
 }
 function camera(pos,visible,extent){
  return visible>=extent?(extent-visible)/2:bound(pos-visible/2,0,extent-visible);
 }
 function draw(clip,progress){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#101212';ctx.fillRect(0,0,width,height);
  const left=camera(x,width/scale,columns*tile),top=camera(y,height/scale,rows*tile);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,Math.round(-left*dpr*scale),Math.round(-top*dpr*scale));
  ctx.imageSmoothingEnabled=false;
  for(const part of ground)ctx.drawImage(part.bitmap,part.x,part.y);
  for(const prop of decor)ctx.drawImage(prop.sprite,prop.x-44,prop.y-53,88,77);
  ctx.imageSmoothingEnabled=scale===1;
  drawBlender(ctx,clip,progress);
 }
 function loop(now){
  const dt=Math.min(.05,(now-last)/1000);
  last=now;update(dt);
  const clip=clips[mode];
  const progress=repeat||mode==='idle'||isGait(mode)?(elapsed%clip.duration)/clip.duration:Math.min(1,elapsed/clip.duration);
  draw(clip,progress);
  requestAnimationFrame(loop);
 }
 function loadSheet(image,path){
  return new Promise((resolve,reject)=>{
   image.addEventListener('load',resolve,{once:true});
   image.addEventListener('error',reject,{once:true});
   image.src=path;
  });
 }
 Promise.all([
  loadSheet(bodySheet,'art/player-study/guardian-body.webp?v=4'),
  loadSheet(weaponSheet,'art/player-study/guardian-weapon.webp?v=4'),
  fetch('art/player-study/guardian-weapon.json?v=4').then(response=>{
   if(!response.ok)throw new Error('Waffen-Frames fehlen.');
   return response.json();
  })
 ]).then(([, ,frames])=>{
  weaponFrames=frames;
  status.hidden=true;
  last=performance.now();requestAnimationFrame(loop);
 }).catch(()=>{status.textContent='Die Blender-Sprites konnten nicht geladen werden.';});
})();
