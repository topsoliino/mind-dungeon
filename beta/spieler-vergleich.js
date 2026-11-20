(()=>{
 'use strict';

 const tile=48,columns=23,rows=13,cell=128;
 const modelSize=110,modelGround=.77597;
 const clips={
  idle:{duration:1.3},walk:{duration:.576},sprint:{duration:.49},roll:{duration:.76},
  down:{duration:.84,comboFrame:13,entryFrame:6},up:{duration:.84,comboFrame:13,entryFrame:4}
 };
 const gaitPoses=['walk','gait-one','gait-two','sprint'];
 const walkStride=.66/.60,sprintStride=.92/.34,groundY=.882;
 const rollRecoveryFrame=22;
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
 const presses=new Set(),shiftKeys=new Set();
 const direction=document.querySelector('#direction'),zoomButton=document.querySelector('#zoom'),weaponButton=document.querySelector('#weapon');
 const status=document.querySelector('#status'),buttons=Array.from(document.querySelectorAll('[data-clip]'));
 const canvas=document.querySelector('#blender'),ctx=canvas.getContext('2d',{alpha:false});
 let width=0,height=0,dpr=1;
 const bodySheet=new Image(),weaponSheet=new Image();
 let atlas;
 let x=columns*tile/2,y=rows*tile/2,scale=1,facing=1,mode='idle',elapsed=0,last=0,repeat=true;
 let showWeapon=true,gaitPhase=0,gaitBlend=0;
 let rollEntry=null,rollExit=null,rollStartSpeed=0;
 let nextAttack='down',attackQueued=false;
 const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
 const isAttack=clip=>clips[clip].comboFrame!==undefined;
 const isGait=clip=>clip==='walk'||clip==='sprint';
 const mix=(a,b,t)=>a+(b-a)*t;
 const ease=t=>{t=bound(t,0,1);return t*t*(3-2*t);};
 const gaitDuration=blend=>mix(clips.walk.duration,clips.sprint.duration,blend);
 const gaitSpeed=blend=>mix(walkStride,sprintStride,blend)*(modelSize/3.23)/gaitDuration(blend);
 const heading=(dx,dy)=>(Math.round(Math.atan2(dy/groundY,dx)/(Math.PI/4))+8)%8;
 const frameAt=(clip,progress)=>bound(Math.floor(progress*atlas.clips[clip][1]),0,atlas.clips[clip][1]-1);
 const gaitPose=()=>gaitPoses[Math.round(ease(gaitBlend)*3)];
 function resize(){
  width=canvas.clientWidth;height=canvas.clientHeight;
  dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 }
 new ResizeObserver(resize).observe(canvas);
 resize();

 function select(clip,loop,startTime=0){
  mode=clip;elapsed=startTime;repeat=loop;attackQueued=false;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.clip===clip));
 }
 function startAttack(chained=false,overflow=0){
  const clip=clips[nextAttack];
  const entry=chained?clip.entryFrame*clip.duration/atlas.clips[nextAttack][1]:0;
  const attack=nextAttack;
  nextAttack=attack==='down'?'up':'down';
  select(attack,false,entry+overflow);
 }
 function movement(){
  let dx=0,dy=0;
  for(const key of presses){dx+=directions[key][0];dy+=directions[key][1];}
  return {dx,dy,length:Math.hypot(dx,dy),facing:heading(dx,dy),gait:shiftKeys.size?'sprint':'walk'};
 }
 function face(value){
  if(facing===value)return;
  facing=value;direction.value=String(facing);
 }
 function startRoll(){
  if(mode==='roll'&&!repeat)return;
  const input=movement();
  if(input.length)face(input.facing);
  rollEntry=null;
  rollExit=null;
  rollStartSpeed=0;
  if(isGait(mode)&&!repeat&&input.length){
   const pose=gaitPose(),phase=Math.round(gaitPhase*4)%4;
   rollEntry={clip:'roll-in-'+pose+'-'+phase,pose,frame:frameAt(pose,gaitPhase)};
   rollStartSpeed=gaitSpeed(ease(gaitBlend));
  }
  select('roll',false);
 }
 for(const button of buttons)button.addEventListener('click',()=>select(button.dataset.clip,true));
 canvas.addEventListener('pointerdown',()=>canvas.focus());
 direction.addEventListener('change',()=>{
  if(mode==='roll'&&!repeat)direction.value=String(facing);
  else facing=Number(direction.value);
 });
 zoomButton.addEventListener('click',()=>{
  scale=scale===1?2:1;zoomButton.setAttribute('aria-pressed',String(scale===2));
 });
 weaponButton.addEventListener('click',()=>{
  showWeapon=!showWeapon;weaponButton.setAttribute('aria-pressed',String(showWeapon));
 });
 addEventListener('keydown',event=>{
  if(!atlas)return;
  if(event.code==='ShiftLeft'||event.code==='ShiftRight'){
   shiftKeys.add(event.code);
   return;
  }
  if(event.target.closest?.('select'))return;
  if(Object.hasOwn(directions,event.code)){
   event.preventDefault();
   if(event.target!==canvas)canvas.focus({preventScroll:true});
   presses.add(event.code);
   return;
  }
  if(event.code==='KeyK'){
   event.preventDefault();
   if(event.repeat||(!repeat&&mode==='roll'))return;
   if(event.target!==canvas)canvas.focus({preventScroll:true});
   if(!repeat&&isAttack(mode))attackQueued=true;
   else startAttack();
  }
  if(event.code==='Space'&&!event.target.closest?.('button,a')){
   event.preventDefault();
   if(event.repeat)return;
   startRoll();
  }
 });
 addEventListener('keyup',event=>{
  shiftKeys.delete(event.code);
  presses.delete(event.code);
 });
 addEventListener('blur',()=>{presses.clear();shiftKeys.clear();attackQueued=false;});

 function moveBy(dx,dy){
  x=bound(x+dx,tile+19,(columns-1)*tile-19);
  y=bound(y+dy,tile+19,(rows-1)*tile-19);
 }
 function rollSpeed(progress){
  if(progress<.18)return mix(rollStartSpeed,220,ease(progress/.18));
  if(progress<.53)return 220;
  const recovery=rollRecoveryFrame/atlas.clips.roll[1];
  if(progress<recovery)return mix(220,64,ease((progress-.53)/(recovery-.53)));
  const exitSpeed=rollExit?gaitSpeed(rollExit==='sprint'?1:0):0;
  return mix(64,exitSpeed,ease((progress-recovery)/(1-recovery)));
 }
 function advanceRoll(dt,input){
  const duration=clips.roll.duration,used=Math.min(dt,duration-elapsed);
  const halfway=(elapsed+used*.5)/duration;
  const recovery=rollRecoveryFrame/atlas.clips.roll[1];
  if(elapsed/duration<recovery&&(elapsed+used)/duration>=recovery){
   rollExit=input.length&&input.facing===facing?input.gait:null;
  }
  const angle=facing*Math.PI/4,distance=used*rollSpeed(halfway);
  moveBy(Math.cos(angle)*distance,Math.sin(angle)*groundY*distance);
  elapsed+=used;
  if(elapsed<duration)return 0;
  if(rollExit&&input.length&&input.facing===facing){
   select(rollExit,false);gaitBlend=Number(rollExit==='sprint');gaitPhase=0;
  }else select('idle',false);
  return dt-used;
 }
 function update(dt){
  const input=movement();
  if(mode==='roll'&&!repeat){
   dt=advanceRoll(dt,input);
   if(dt===0)return;
  }
  const previous=elapsed;
  elapsed+=dt;
  if(!repeat&&isAttack(mode)){
   const clip=clips[mode];
   if(attackQueued){
    // Link at the shared pose. A later press uses the next clip's regular wind-up.
    const handoff=clip.comboFrame*clip.duration/atlas.clips[mode][1];
    if(previous<=handoff&&elapsed>=handoff)startAttack(true,elapsed-handoff);
    else if(elapsed>=clip.duration)startAttack(false,elapsed-clip.duration);
   }else if(elapsed>=clip.duration)select('idle',false);
   if(isAttack(mode))return;
  }
  if(input.length){
   face(input.facing);
   if(!isGait(mode)||repeat){gaitBlend=0;gaitPhase=0;}
   if(mode!==input.gait||repeat)select(input.gait,false);
   // Changing speed changes cadence and the rendered pose, but keeps the step phase.
   const target=Number(input.gait==='sprint');
   gaitBlend+=bound(target-gaitBlend,-dt/.24,dt/.24);
   const blend=ease(gaitBlend);
   gaitPhase=(gaitPhase+dt/gaitDuration(blend))%1;
   const speed=gaitSpeed(blend)*Math.hypot(input.dx,input.dy*groundY)/input.length;
   moveBy(dt*input.dx/input.length*speed,dt*input.dy/input.length*speed);
  }else if(!repeat&&isGait(mode))select('idle',false);
 }
 function animationFrame(){
  const clip=clips[mode];
  const progress=mode==='idle'||repeat?(elapsed%clip.duration)/clip.duration:Math.min(1,elapsed/clip.duration);
  let name=mode,frame=frameAt(mode,progress);
  if(isGait(mode)&&!repeat){
   name=gaitPose();frame=frameAt(name,gaitPhase);
  }
  if(mode==='roll'&&!repeat){
   if(rollEntry&&frame===0){
    name=rollEntry.pose;frame=rollEntry.frame;
   }else if(rollEntry&&frame<3){
    name=rollEntry.clip;frame-=1;
   }else if(rollExit&&frame>rollRecoveryFrame){
    if(frame===atlas.clips.roll[1]-1){name=rollExit;frame=0;}
    else{name='roll-out-'+rollExit;frame-=rollRecoveryFrame+1;}
   }
  }
  return atlas.clips[name][0]+frame;
 }
 function drawPacked(ctx,sheet,frame,left,top){
  const [sx,sy,w,h,dx,dy]=frame,ratio=modelSize/cell;
  ctx.drawImage(sheet,sx,sy,w,h,left+dx*ratio,top+dy*ratio,w*ratio,h*ratio);
 }
 function drawBlender(ctx,frame){
  const index=frame*8+facing;
  ctx.fillStyle='#110d1780';
  ctx.beginPath();ctx.ellipse(x,y+13,21,5,0,0,Math.PI*2);ctx.fill();
  const left=Math.round(x-modelSize/2),top=Math.round(y+16-modelSize*modelGround);
  drawPacked(ctx,bodySheet,atlas.body[index],left,top);
  if(showWeapon&&atlas.weapon[index])drawPacked(ctx,weaponSheet,atlas.weapon[index],left,top);
 }
 function camera(pos,visible,extent){
  return visible>=extent?(extent-visible)/2:bound(pos-visible/2,0,extent-visible);
 }
 function draw(frame){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#101212';ctx.fillRect(0,0,width,height);
  const left=camera(x,width/scale,columns*tile),top=camera(y,height/scale,rows*tile);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,Math.round(-left*dpr*scale),Math.round(-top*dpr*scale));
  ctx.imageSmoothingEnabled=false;
  for(const part of ground)ctx.drawImage(part.bitmap,part.x,part.y);
  for(const prop of decor)ctx.drawImage(prop.sprite,prop.x-44,prop.y-53,88,77);
  ctx.imageSmoothingEnabled=scale===1;
  drawBlender(ctx,frame);
 }
 function loop(now){
  const dt=bound((now-last)/1000,0,.05);
  last=now;update(dt);
  draw(animationFrame());
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
  loadSheet(bodySheet,'art/player-study/guardian-body.webp?v=7'),
  loadSheet(weaponSheet,'art/player-study/guardian-weapon.webp?v=7'),
  fetch('art/player-study/guardian-frames.json?v=7').then(response=>{
   if(!response.ok)throw new Error('Animationsdaten fehlen.');
   return response.json();
  })
 ]).then(([, ,frames])=>{
  atlas=frames;
  status.hidden=true;
  last=performance.now();requestAnimationFrame(loop);
 }).catch(()=>{status.textContent='Die Blender-Sprites konnten nicht geladen werden.';});
})();
