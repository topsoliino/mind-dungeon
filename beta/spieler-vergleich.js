(()=>{
 'use strict';

 const tile=48,columns=23,rows=13,cell=128;
 const modelSize=110,modelGround=.77597,unitsToPixels=modelSize/3.23;
 const lightHoldMs=240;
 const rollAttackWindowMs=175;
 const clips={
  idle:{duration:1.3},walk:{duration:.56},sprint:{duration:.49},roll:{duration:.76},
  'crouch-idle':{duration:1.4},sneak:{duration:.65},
  eat:{consumption:true},drink:{consumption:true},
  down:{duration:.74,guard:6,chain:13,next:'up'},
  up:{duration:.74,guard:4,chain:13,next:'down'}
 };
 const weaponTypes={
  sword:{sheet:'weapon',heavy:{duration:.94,chain:16,next:'up'},rollAttack:{duration:.66,chain:12,next:'down'}},
  hammer:{sheet:'hammer',heavy:{duration:1.04,chain:16,next:'down'},rollAttack:{duration:.73,chain:12,next:'up'}}
 };
 for(const [type,weapon] of Object.entries(weaponTypes)){
  clips['heavy-'+type]=weapon.heavy;
  clips['roll-attack-'+type]=weapon.rollAttack;
  for(const light of ['down','up'])clips['charge-'+type+'-'+light]={duration:.18,heavy:'heavy-'+type};
 }
 const gaitPoses=['walk','gait-one','gait-two','sprint'];
 const walkStride=.77/.60,sprintStride=.92/.34,groundY=.882,projectionY=.47;
 const sneakSpeed=.39/.64*unitsToPixels/clips.sneak.duration;
 const stanceDuration=.30;
 const rollRecoveryFrame=22;
 const directions={
  ArrowRight:[1,0],KeyD:[1,0],ArrowLeft:[-1,0],KeyA:[-1,0],
  ArrowDown:[0,1],KeyS:[0,1],ArrowUp:[0,-1],KeyW:[0,-1]
 };
 const consumptionKeys={KeyF:'eat',KeyT:'drink'};
 const hitKeys={Digit1:'hit-light',Digit2:'hit-strong',Digit3:'hit-down'};
 const hitLabels={'hit-light':'Leichter Treffer','hit-strong':'Starker Treffer','hit-down':'Niederschlag'};
 const art=window.DungeonArt;
 const alley=new URLSearchParams(location.search).get('szene')==='gasse'?window.AlleyStudy.create(document.querySelector('#alley-layers')):null;
 const map=Array.from({length:rows},(_,y)=>Array.from({length:columns},(_,x)=>
  Number(y===0||y===rows-1||x===0||x===columns-1)));
 const terrain=map.map(row=>row.map(()=>null));
 const lights=[{x:5.4*tile,y:3.2*tile,radius:155,color:'#dbc193',power:'52'},
  {x:17.4*tile,y:3.2*tile,radius:142,color:'#cba58d',power:'46'}];
 const ground=alley?[]:art.world(map,()=>3,lights,193,terrain,[],tile);
 const decor=lights.map(p=>({...p,sprite:art.furniture('sanctuary-brazier',3,0)}));
 const barrel={...(alley?.barrel??{x:(columns/2+2)*tile,y:(rows/2+2)*tile}),sprite:art.furniture('barrel',3,0)};
 const ruby=document.createElement('canvas');
 ruby.width=ruby.height=64;
 const {poly}=art.brush(ruby);
 poly([[23,34],[28,29],[36,29],[41,34],[32,44]],'#592536');
 poly([[25,34],[29,31],[35,31],[39,34],[32,41]],'#c63f59');
 poly([[25,34],[29,31],[35,31],[32,35]],'#ec8491');
 const practiceStations=[
  {kind:'chest',x:9.4*tile,y:5.05*tile,radius:.49,scale:.70,base:48,front:2,
   sprite:art.icon('chest'),used:art.icon('chest','open'),prompt:'Truhe öffnen',approaching:'Zur Truhe …',done:'Truhe geöffnet'},
  {kind:'pickup',x:13.8*tile,y:5.05*tile,radius:0,scale:.48,base:42,
   sprite:ruby,prompt:'Rubin nehmen',approaching:'Zum Rubin …',done:'Rubin aufgenommen'},
  {kind:'pickup-high',x:16.25*tile,y:7.2*tile,radius:.50,halfWidth:1.05,front:2,mustStand:true,
   table:art.furniture('table',0),prompt:'Rubin vom Tisch nehmen',approaching:'Zum Tisch …',done:'Rubin vom Tisch genommen'},
  {kind:'knowledge',x:9.1*tile,y:9.4*tile,radius:.32,scale:.91,base:57,mustStand:true,
   sprite:art.icon('shrine','','#91e6d2'),used:art.icon('shrine','','#576b6a'),
   prompt:'Wissen erlangen',done:'Wissen erlangt'},
 ];
 const stations=alley?practiceStations.filter(station=>Object.hasOwn(alley.stations,station.kind))
  .map(station=>({...station,...alley.stations[station.kind]})):practiceStations;
 const presses=new Set();
 const props=[...stations,barrel].sort((a,b)=>a.y-b.y);
 const direction=document.querySelector('#direction'),zoomButton=document.querySelector('#zoom');
 const weaponButton=document.querySelector('#weapon'),weaponSelect=document.querySelector('#weapon-type');
 const movementMode=document.querySelector('#movement-mode');
 const interactionPrompt=document.querySelector('#interaction-prompt');
 const resetStations=document.querySelector('#reset-stations');
 const status=document.querySelector('#status'),buttons=Array.from(document.querySelectorAll('[data-clip]'));
 const canvas=document.querySelector('#blender'),ctx=canvas.getContext('2d',{alpha:false});
 if(alley){
  document.title='Isometrische Gasse · Mind Dungeon';
  document.querySelector('h1').textContent='Isometrische Gasse';
  document.querySelector('#practice-subtitle').textContent='Mind Dungeon · Test-Build';
  document.querySelector('#switch-scene').href='spieler-vergleich.html';
  document.querySelector('#switch-scene').textContent='Zum Übungsraum';
  document.querySelector('.control-panel').before(canvas,document.querySelector('.practice-status'),document.querySelector('#alley-layers'));
  document.querySelector('#station-help').textContent='Truhe und Rubin auf dem Tisch';
  document.querySelector('#barrel-help').textContent='zum Fass am Rand des kleinen Platzes laufen.';
  canvas.classList.add('alley-canvas');
  canvas.setAttribute('aria-label','Begehbare isometrische Gasse mit dem Blender-Wächter');
 }
 let width=0,height=0,dpr=1;
 const weaponSheets=new Map();
 let atlas,spriteFiles,bodyLayers,colliders;
 let {x,y}=alley?.spawn??{x:columns*tile/2,y:rows*tile/2};
 let scale=1,facing=1,mode='idle',elapsed=0,last=0,repeat=true;
 let showWeapon=true,gaitPhase=0,gaitBlend=0,movementStyle='walk',crouched=false,stanceChange=null;
 let rollEntry=null,rollExit=null,rollStartSpeed=0;
 let rollStartedWalking=false;
 let vault=null;
 let interaction=null,interactionNotice='';
 let approach=null,knockback=null;
 let blockedApproachUntil=0;
 let standingAction=null,consumingWalking=false;
 let rollAttackQueued=false,rollAttackUntil=0,rollAttackEntry=null;
 let weaponType='sword',weaponLayers;
 let heldAttack=null,attackIntent=null,queuedAttack=null;
 let comboFollowup=null;
 const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
 const isAttack=clip=>clips[clip].next!==undefined||clips[clip].heavy!==undefined;
 const isGait=clip=>clip==='walk'||clip==='sprint';
 const mix=(a,b,t)=>a+(b-a)*t;
 const ease=t=>{t=bound(t,0,1);return t*t*(3-2*t);};
 const gaitDuration=blend=>mix(clips.walk.duration,clips.sprint.duration,blend);
 const gaitSpeed=blend=>mix(walkStride,sprintStride,blend)*unitsToPixels/gaitDuration(blend);
 const heading=(dx,dy)=>(Math.round(Math.atan2(dy/groundY,dx)/(Math.PI/4))+8)%8;
 const frameAt=(clip,progress)=>bound(Math.floor(progress*atlas.clips[clip][1]+1e-8),0,atlas.clips[clip][1]-1);
 const frameTime=(clip,frame)=>frame*clips[clip].duration/atlas.clips[clip][1];
 const gaitPose=()=>gaitPoses[Math.round(ease(gaitBlend)*3)];
 const previewClip=clip=>clip==='heavy'||clip==='roll-attack'?clip+'-'+weaponType:clip;
 function resize(){
  width=canvas.clientWidth;height=canvas.clientHeight;
  dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 }
 new ResizeObserver(resize).observe(canvas);
 resize();

 function select(clip,loop,startTime=0){
  mode=clip;elapsed=startTime;repeat=loop;
  showMovementStyle();
  for(const button of buttons){
   button.setAttribute('aria-pressed',String(previewClip(button.dataset.clip)===clip));
  }
 }
 function clearAttacks(){
  attackIntent=null;queuedAttack=null;heldAttack=null;comboFollowup=null;
  rollAttackQueued=false;rollAttackUntil=0;rollAttackEntry=null;
 }
 function startLight(light,intent,linked,overflow=0){
  const entry=linked?frameTime(light,clips[light].guard):0;
  intent.startedAt=performance.now()-overflow*1000;
  intent.committed=false;
  attackIntent=intent;
  queuedAttack=null;
  comboFollowup=null;
  select(light,false,entry+overflow);
 }
 function setMovementStyle(style){
  movementStyle=style;
  showMovementStyle();
 }
 function showMovementStyle(){
  const style=approach?(crouched?'sneak':'walk'):clips[mode].consumption?'walk':movementStyle;
  movementMode.textContent={walk:'Gehmodus',sprint:'Rennmodus',sneak:'Schleichmodus'}[style];
 }
 function movement(){
  let dx=0,dy=0;
  for(const key of presses){dx+=directions[key][0];dy+=directions[key][1];}
  return {dx,dy,length:Math.hypot(dx,dy),facing:heading(dx,dy),gait:movementStyle};
 }
 function face(value){
  if(facing===value)return;
  facing=value;direction.value=String(facing);
 }
 function standBefore(action){
  if(!crouched)return false;
  standingAction=action;
  setMovementStyle('walk');
  return true;
 }
 function startConsumption(clip){
  if(vault||interaction||approach||knockback||stanceChange||standingAction||!repeat&&(mode==='roll'||isAttack(mode)||clips[mode].consumption))return;
  if(standBefore(()=>startConsumption(clip)))return;
  const input=movement();
  consumingWalking=Boolean(input.length);
  if(input.length)face(input.facing);
  gaitBlend=0;
  clearAttacks();select(clip,false);
 }
 function startRoll(){
  if(vault||interaction||approach||knockback||stanceChange||standingAction||crouched||clips[mode].consumption||mode==='roll'&&!repeat)return;
  if(!repeat&&atlas.attackMotion[mode]&&elapsed<frameTime(mode,clips[mode].chain))return;
  const input=movement();
  if(input.length)face(input.facing);
  rollStartedWalking=movementStyle==='walk';
  rollEntry=null;
  rollExit=null;
  rollStartSpeed=0;
  if(isGait(mode)&&!repeat&&input.length){
   const pose=gaitPose(),phase=Math.round(gaitPhase*4)%4;
   rollEntry={clip:'roll-in-'+pose+'-'+phase,pose,frame:frameAt(pose,gaitPhase)};
   rollStartSpeed=gaitSpeed(ease(gaitBlend));
  }
  clearAttacks();select('roll',false);
 }
 function startRollAttack(fromLanding){
  clearAttacks();
  const attack='roll-attack-'+weaponType;
  if(fromLanding)rollAttackEntry={clip:attack+'-landing'};
  else if(isGait(mode)&&!repeat){
   const pose=gaitPose(),stride=gaitBlend<.5?'walk':'sprint';
   const phase=bound(Math.round(gaitPhase*4),0,1);
   rollAttackEntry={clip:attack+'-'+stride+'-'+phase,pose,frame:frameAt(pose,gaitPhase)};
  }
  select(attack,false);
 }
 for(const button of buttons)button.addEventListener('click',()=>{
  if(!atlas)return;
  const clip=previewClip(button.dataset.clip);
  if(clips[clip].knockback){
   startKnockback(clip);
   canvas.focus({preventScroll:true});
   return;
  }
  if(vault||interaction||approach||knockback||stanceChange||standingAction)return;
  if(clips[clip].consumption){
   canvas.focus({preventScroll:true});
   startConsumption(clip);
   return;
  }
  if(crouched||movementStyle==='sneak'){
   crouched=false;setMovementStyle('walk');
  }
  clearAttacks();
  select(clip,true);
 });
 canvas.addEventListener('pointerdown',()=>canvas.focus());
 direction.addEventListener('change',()=>{
  if(vault||interaction||approach||knockback||stanceChange||mode==='roll'&&!repeat)direction.value=String(facing);
  else facing=Number(direction.value);
 });
 zoomButton.addEventListener('click',()=>{
  scale=scale===1?2:1;zoomButton.setAttribute('aria-pressed',String(scale===2));
 });
 weaponButton.addEventListener('click',()=>{
  showWeapon=!showWeapon;weaponButton.setAttribute('aria-pressed',String(showWeapon));
 });
 resetStations.addEventListener('click',()=>{
  if(interaction||approach||standingAction)return;
  for(const station of stations)station.completed=false;
  interactionNotice='';
  canvas.focus({preventScroll:true});
 });
 weaponSelect.addEventListener('change',async()=>{
  const type=weaponSelect.value;
  try {
   const sheet=await loadWeapon(type);
   if(weaponSelect.value!==type)return;
   const preview=repeat&&['heavy','roll-attack'].find(clip=>previewClip(clip)===mode);
   clearAttacks();
   if(isAttack(mode))select('idle',false);
   weaponType=type;weaponLayers=sheet;
   status.hidden=true;
   if(preview)select(previewClip(preview),true);
   canvas.focus({preventScroll:true});
  }catch{
   if(weaponSelect.value===type){
    weaponSelect.value=weaponType;
    status.hidden=false;status.textContent='Die Waffe konnte nicht geladen werden.';
   }
  }
 });
 addEventListener('keydown',event=>{
  if(!atlas)return;
  if(event.key==='Shift'||event.key==='Control'){
   if(event.key==='Control')event.preventDefault();
   if(!event.repeat&&!vault&&!interaction&&!approach&&!knockback&&!standingAction&&!(mode==='roll'&&!repeat)){
    if(event.key==='Control')setMovementStyle(movementStyle==='sneak'?'walk':'sneak');
    else setMovementStyle(movementStyle==='sprint'?'walk':'sprint');
   }
   return;
  }
  if(event.target.closest?.('select'))return;
  if(Object.hasOwn(hitKeys,event.code)){
   event.preventDefault();
   if(!event.repeat){
    canvas.focus({preventScroll:true});
    startKnockback(hitKeys[event.code]);
   }
   return;
  }
  if(event.code==='Escape'&&(approach||standingAction)){
   event.preventDefault();
   if(approach)cancelApproach();
   standingAction=null;
   return;
  }
  if(Object.hasOwn(directions,event.code)){
   event.preventDefault();
   if(event.target!==canvas)canvas.focus({preventScroll:true});
   if(approach&&!event.repeat)cancelApproach();
   presses.add(event.code);
   return;
  }
  if(event.code==='KeyE'){
   event.preventDefault();
   if(!event.repeat){
    if(event.target!==canvas)canvas.focus({preventScroll:true});
    startInteraction();
   }
   return;
  }
  if(Object.hasOwn(consumptionKeys,event.code)){
   event.preventDefault();
   if(!event.repeat){
    if(event.target!==canvas)canvas.focus({preventScroll:true});
    startConsumption(consumptionKeys[event.code]);
   }
   return;
  }
  if(event.code==='KeyK'){
   event.preventDefault();
   if(event.repeat||vault||interaction||approach||knockback||stanceChange||standingAction||crouched||clips[mode].consumption)return;
   if(event.target!==canvas)canvas.focus({preventScroll:true});
   if(!repeat&&mode==='roll'){
    rollAttackQueued=true;
    return;
   }
   if(performance.now()<=rollAttackUntil){
    startRollAttack(false);
    return;
   }
   const intent={releasedAt:null,startedAt:null};
   if(!repeat&&isAttack(mode)){
    if(queuedAttack)return;
    queuedAttack=intent;
   }else{
    const followup=comboFollowup&&performance.now()<=comboFollowup.until?comboFollowup.light:'down';
    startLight(followup,intent,false);
   }
   heldAttack=intent;
  }
  if(event.code==='Space'&&!event.target.closest?.('button,a')){
   event.preventDefault();
   if(event.repeat)return;
   startRoll();
  }
 });
 addEventListener('keyup',event=>{
  if(event.code==='KeyK'&&heldAttack){
   heldAttack.releasedAt=performance.now();heldAttack=null;
  }
  presses.delete(event.code);
 });
 addEventListener('blur',()=>{
  presses.clear();
  if(approach)cancelApproach();
  if(!repeat&&(isAttack(mode)||clips[mode].consumption))select('idle',false);
  clearAttacks();
 });

 function collider(prop,halfWidth,halfDepth,padding){
  return {x:prop.x,y:prop.y,rx:(halfWidth+padding)*unitsToPixels,ry:(halfDepth+padding)*unitsToPixels*projectionY};
 }
 const minX=tile+19,maxX=(columns-1)*tile-19,minY=tile+19,maxY=(rows-1)*tile-19;
 function hitsScenery(nx,ny){
  return alley?.blocked(nx,ny)||colliders.some(({x,y,rx,ry})=>((nx-x)/rx)**2+((ny-y)/ry)**2<1);
 }
 function moveBy(dx,dy){
  const nx=bound(x+dx,minX,maxX),ny=bound(y+dy,minY,maxY);
  if(!hitsScenery(nx,ny)){x=nx;y=ny;return;}
  if(!hitsScenery(nx,y))x=nx;
  if(!hitsScenery(x,ny))y=ny;
 }
 function moveWithInput(input,dt,speed){
  const distance=dt*speed*Math.hypot(input.dx,input.dy*groundY)/input.length;
  moveBy(input.dx/input.length*distance,input.dy/input.length*distance);
 }
 function nearestStation(){
  let nearest=null,best=1.55*unitsToPixels;
  for(const station of stations){
   const distance=Math.hypot(station.x-x,(station.y-y)/projectionY);
   if(!station.completed&&distance<best){nearest=station;best=distance;}
  }
  return nearest;
 }
 function clearApproachSegment(from,to){
  // The nearest point on a segment in ellipse space gives a swept footprint test.
  return (!alley||alley.clearSegment(from,to))&&colliders.every(({x,y,rx,ry})=>{
   const sx=(from.x-x)/rx,sy=(from.y-y)/ry;
   const dx=(to.x-from.x)/rx,dy=(to.y-from.y)/ry;
   const t=bound(-(sx*dx+sy*dy)/(dx*dx+dy*dy||1),0,1);
   return (sx+t*dx)**2+(sy+t*dy)**2>=1-1e-8;
  });
 }
 function approachRoute(goal){
  const valid=p=>p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY&&!hitsScenery(p.x,p.y);
  if(!valid(goal))return null;
  const start={x,y};
  // Detour through the shortest chain of clear segments around the scenery.
  const around=colliders.flatMap(obstacle=>Array.from({length:12},(_,i)=>{
   const angle=i*Math.PI/6;
   return {x:obstacle.x+1.16*obstacle.rx*Math.cos(angle),y:obstacle.y+1.16*obstacle.ry*Math.sin(angle)};
  })).filter(valid);
  const waypoints=[...around,...(alley?.waypoints.filter(valid)??[])];
  return window.AlleyStudy.shortestRoute(start,goal,waypoints,clearApproachSegment);
 }
 function startInteraction(target=nearestStation()){
  if(vault||interaction||approach||knockback||stanceChange||standingAction||!repeat&&(mode==='roll'||isAttack(mode)||clips[mode].consumption))return;
  if(!target)return;
  if(target.mustStand&&standBefore(()=>startInteraction(target)))return;
  const {distance,side=0}=atlas.interactions[target.kind];
  const finalFacing=target.front===undefined
   ?(Math.round(Math.atan2((target.y-y)/projectionY,target.x-x)/(Math.PI/4))+8)%8
   :(target.front+4)%8;
  if(distance===undefined){beginInteraction(target,finalFacing);return;}
  const angle=finalFacing*Math.PI/4;
  const dx=Math.cos(angle)*distance+Math.sin(angle)*side;
  const dy=Math.sin(angle)*distance-Math.cos(angle)*side;
  const goal={x:target.x-dx*unitsToPixels,y:target.y-dy*projectionY*unitsToPixels};
  const route=approachRoute(goal);
  if(!route){
   interactionNotice='Der Weg ist versperrt.';
   blockedApproachUntil=performance.now()+1300;
   return;
  }
  blockedApproachUntil=0;
  if(Math.hypot(goal.x-x,goal.y-y)<1e-6){beginInteraction(target,finalFacing);return;}
  approach={target,finalFacing,route};
  interactionNotice=target.approaching;
  if(!isGait(mode)&&mode!=='sneak')gaitPhase=0;
  gaitBlend=0;clearAttacks();select(crouched?'sneak':'walk',false);
 }
 function cancelApproach(){
  approach=null;interactionNotice='';
  select(crouched?'crouch-idle':'idle',false);
 }
 function advanceApproach(dt){
  while(approach.route.length){
   const next=approach.route[0],dx=next.x-x,dy=next.y-y,distance=Math.hypot(dx,dy);
   if(distance>1e-6){
    if(dt===0)return 0;
    face(heading(dx,dy));
    const gait=crouched?'sneak':'walk';
    const speed=(crouched?sneakSpeed:gaitSpeed(0))*Math.hypot(dx,dy*groundY)/distance;
    const used=Math.min(dt,distance/speed),progress=Math.min(1,used*speed/distance);
    x+=dx*progress;y+=dy*progress;
    gaitPhase=(gaitPhase+used/clips[gait].duration)%1;
    dt-=used;
    if(progress<1)return 0;
   }
   x=next.x;y=next.y;
   approach.route.shift();
  }
  const {target,finalFacing}=approach;
  approach=null;
  beginInteraction(target,finalFacing);
  return dt;
 }
 function beginInteraction(target,finalFacing){
  face(finalFacing);
  interaction={target,event:atlas.interactions[target.kind].event};
  interactionNotice=target.kind==='knowledge'?'Buch studieren …':'';
  gaitBlend=0;
  clearAttacks();select(target.kind+(crouched?'-crouched':''),false);
 }
 function advanceInteraction(dt){
  const duration=clips[mode].duration,used=Math.min(dt,duration-elapsed);
  elapsed+=used;
  const [start,frames]=atlas.clips[mode];
  if(animationFrame()-start>=Math.ceil(interaction.event*(frames-1))&&!interaction.target.completed){
   interaction.target.completed=true;
   interactionNotice=interaction.target.done;
  }
  if(elapsed<duration)return 0;
  interaction=null;
  select(crouched?'crouch-idle':'idle',false);
  return dt-used;
 }
 function startKnockback(clip){
  if(vault||knockback)return;
  const angle=facing*Math.PI/4;
  knockback={dx:-Math.cos(angle)*unitsToPixels,dy:-Math.sin(angle)*unitsToPixels*projectionY,distance:0};
  approach=interaction=stanceChange=standingAction=null;
  crouched=false;gaitBlend=0;
  if(movementStyle==='sneak')setMovementStyle('walk');
  interactionNotice=hitLabels[clip];
  clearAttacks();select(clip,false);
 }
 function advanceKnockback(dt){
  const {duration,path}=atlas.knockback[mode],used=Math.min(dt,duration-elapsed);
  elapsed+=used;
  const progress=elapsed/duration;
  let end=1;
  while(end<path.length-1&&progress>path[end][0])end++;
  const [a,from]=path[end-1],[b,to]=path[end];
  const distance=mix(from,to,ease((progress-a)/(b-a))),delta=distance-knockback.distance;
  moveBy(knockback.dx*delta,knockback.dy*delta);
  knockback.distance=distance;
  if(elapsed<duration)return 0;
  knockback=null;
  select('idle',false);
  return dt-used;
 }
 function advanceConsumption(dt,input){
  const duration=clips[mode].duration,used=Math.min(dt,duration-elapsed);
  elapsed+=used;
  consumingWalking=Boolean(input.length);
  if(consumingWalking){
   face(input.facing);
   moveWithInput(input,used,gaitSpeed(0));
  }
  if(elapsed<duration)return 0;
  gaitPhase=(duration/clips.walk.duration)%1;
  select(consumingWalking?'walk':'idle',false);
  return dt-used;
 }
 function startStanceChange(input){
  const lowering=movementStyle==='sneak';
  if(crouched===lowering)return;
  const moving=!repeat&&input.length>0;
  const fromGait=moving&&isGait(mode),fromSneak=moving&&mode==='sneak';
  const phase=Math.round(gaitPhase*4)%4;
  const sprinting=fromGait&&gaitBlend>=.63;
  let clip='crouch-down',reverse=!lowering,source=null,speed=0;
  if(fromGait){
   const name=gaitPose();
   source={name,frame:frameAt(name,gaitPhase)};
   speed=gaitSpeed(ease(gaitBlend));
  }
  if(sprinting||fromSneak){
   clip=(sprinting?'crouch-from-sprint-':'crouch-up-')+phase;
   reverse=false;
  }
  if(fromSneak){
   source={name:'sneak',frame:frameAt('sneak',gaitPhase)};
   speed=sneakSpeed;
  }
  stanceChange={lowering,reverse,source,speed,dx:input.dx/(input.length||1),dy:input.dy/(input.length||1)};
  gaitBlend=0;clearAttacks();select(clip,false);
 }
 function advanceStance(dt){
  const used=Math.min(dt,stanceDuration-elapsed);
  elapsed+=used;
  const {lowering,speed,dx,dy}=stanceChange;
  const drift=speed*used*(1-ease((elapsed-used*.5)/stanceDuration));
  if(drift)moveBy(dx*drift,dy*drift);
  if(elapsed<stanceDuration)return 0;
  crouched=lowering;stanceChange=null;gaitPhase=0;
  select(crouched?'crouch-idle':'idle',false);
  return dt-used;
 }
 function tryVault(input){
  if(input.gait!=='sprint'||gaitBlend<.85)return false;
  const {start,end,radius}=atlas.vault;
  // Use the rig camera's ground projection for trajectory and palm placement.
  const ox=(barrel.x-x)/unitsToPixels,oy=(barrel.y-y)/(unitsToPixels*projectionY);
  const stepY=input.dy/projectionY,step=Math.hypot(input.dx,stepY);
  if(Math.hypot(ox,oy)>-start+.12||(ox*input.dx+oy*stepY)<=0||
     Math.abs(ox*stepY-oy*input.dx)/step>radius*.80)return false;
  // Keep the approach facing as the trajectory eases onto the barrel center.
  const angle=facing*Math.PI/4;
  const dx=Math.cos(angle)*unitsToPixels,dy=Math.sin(angle)*unitsToPixels*projectionY;
  if(alley&&!alley.clearSegment({x,y},{x:barrel.x+dx*end,y:barrel.y+dy*end}))return false;
  const phase=Math.round(gaitPhase*4)%4;
  vault={dx,dy,offsetX:x-barrel.x-dx*start,offsetY:y-barrel.y-dy*start,
   entry:'vault-in-'+phase,frame:frameAt('sprint',gaitPhase)};
  clearAttacks();select('vault',false);
  return true;
 }
 function advanceVault(dt){
  const {start,end,duration,exitPhase,path}=atlas.vault;
  const used=Math.min(dt,duration-elapsed);
  elapsed+=used;
  const progress=Math.min(1,elapsed/duration),offset=1-ease(progress/.29);
  let point=1;
  while(path[point][0]<progress)point++;
  const [from,begin]=path[point-1], [to,finish]=path[point];
  const distance=mix(start,end,mix(begin,finish,(progress-from)/(to-from)));
  x=barrel.x+vault.dx*distance+vault.offsetX*offset;
  y=barrel.y+vault.dy*distance+vault.offsetY*offset;
  if(progress<1)return 0;
  vault=null;
  select('sprint',false);gaitPhase=exitPhase;gaitBlend=1;
  return dt-used;
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
  const duration=clips.roll.duration,recoveryTime=frameTime('roll',rollRecoveryFrame);
  const attackFromLanding=rollAttackQueued&&elapsed<=recoveryTime;
  const end=attackFromLanding?recoveryTime:duration;
  const used=Math.min(dt,end-elapsed);
  const halfway=(elapsed+used*.5)/duration;
  if(!attackFromLanding&&elapsed<recoveryTime&&elapsed+used>=recoveryTime){
   rollExit=input.length&&input.facing===facing?(rollStartedWalking?'sprint':input.gait):null;
  }
  const angle=facing*Math.PI/4,distance=used*rollSpeed(halfway);
  moveBy(Math.cos(angle)*distance,Math.sin(angle)*groundY*distance);
  elapsed+=used;
  if(elapsed<end)return 0;
  if(rollStartedWalking)setMovementStyle('sprint');
  if(attackFromLanding)startRollAttack(true);
  else{
   if(rollExit&&input.length&&input.facing===facing){
    select(rollExit,false);gaitBlend=Number(rollExit==='sprint');gaitPhase=0;
   }else select('idle',false);
   if(rollAttackQueued)startRollAttack(false);
   else rollAttackUntil=performance.now()+rollAttackWindowMs-1000*(dt-used);
  }
  return dt-used;
 }
 function advanceAttack(dt){
  const clip=clips[mode];
  const previous=elapsed;
  const next=elapsed+dt;
  if(clip.guard!==undefined&&!attackIntent.committed){
   const guard=frameTime(mode,clip.guard);
   if(next>=guard){
    // A buffered hold starts charging at this swing's wind-up.
    const held=(attackIntent.releasedAt??performance.now())-attackIntent.startedAt;
    if(held>=lightHoldMs){
     select('charge-'+weaponType+'-'+mode,false);
     return 0;
    }
    if(attackIntent.releasedAt===null){
     elapsed=guard;
     return 0;
    }
    attackIntent.committed=true;
   }
  }
  if(clip.heavy){
   elapsed=Math.min(next,clip.duration);
   if(next>=clip.duration&&attackIntent.releasedAt!==null)select(clip.heavy,false);
   return 0;
  }
  const motion=atlas.attackMotion[mode];
  if(motion){
   const [start,end]=motion.advance;
   const poseTime=clip.duration*(atlas.clips[mode][1]-1)/atlas.clips[mode][1];
   const progress=t=>ease((t/poseTime-start)/(end-start));
   const distance=motion.distance*unitsToPixels*(progress(next)-progress(previous));
   const angle=facing*Math.PI/4;
   moveBy(Math.cos(angle)*distance,Math.sin(angle)*groundY*distance);
  }
  const handoff=frameTime(mode,clip.chain);
  if(queuedAttack&&previous<=handoff&&next>=handoff){
   startLight(clip.next,queuedAttack,true,next-handoff);
   return 0;
  }
  if(next<clip.duration){
   elapsed=next;
   return 0;
  }
  const overflow=next-clip.duration;
  if(queuedAttack){
   // The linked guard has passed, so begin the alternate cut from its wind-up.
   startLight(clip.next,queuedAttack,false,overflow);
   return 0;
  }
  if(clip.guard!==undefined){
   // Keep the same follow-up after returning to movement, up to twice the original window.
   comboFollowup={light:clip.next,until:performance.now()+1000*(2*handoff-next)};
  }
  attackIntent=null;select('idle',false);
  return overflow;
 }
 function update(dt){
  let input=movement();
  if(knockback){
   dt=advanceKnockback(dt);
   if(dt===0)return;
  }
  if(approach){
   dt=advanceApproach(dt);
   if(dt===0)return;
  }
  if(interaction){
   dt=advanceInteraction(dt);
   if(dt===0)return;
  }
  if(vault){
   dt=advanceVault(dt);
   if(dt===0)return;
  }
  if(mode==='roll'&&!repeat){
   dt=advanceRoll(dt,input);
   if(dt===0)return;
   input=movement();
  }
  if(!repeat&&isAttack(mode)){
   dt=advanceAttack(dt);
   if(dt===0)return;
  }
  if(clips[mode].consumption){
   dt=advanceConsumption(dt,input);
   if(dt===0)return;
  }
  if(!stanceChange)startStanceChange(input);
  if(stanceChange){
   dt=advanceStance(dt);
   if(dt===0)return;
   if(crouched!==(input.gait==='sneak'))return;
  }
  if(standingAction){
   const action=standingAction;
   standingAction=null;
   action();
   return;
  }
  elapsed+=dt;
  if(input.length){
   face(input.facing);
   if(crouched){
    if(mode!=='sneak'){gaitPhase=0;select('sneak',false);}
    gaitPhase=(gaitPhase+dt/clips.sneak.duration)%1;
    moveWithInput(input,dt,sneakSpeed);
    return;
   }
   if(!isGait(mode)||repeat){gaitBlend=0;gaitPhase=0;}
   if(mode!==input.gait||repeat)select(input.gait,false);
   // Changing speed changes cadence and the rendered pose, but keeps the step phase.
   const target=Number(input.gait==='sprint');
   gaitBlend+=bound(target-gaitBlend,-dt/.24,dt/.24);
   const blend=ease(gaitBlend);
   gaitPhase=(gaitPhase+dt/gaitDuration(blend))%1;
   if(tryVault(input))return;
   moveWithInput(input,dt,gaitSpeed(blend));
  }else if(!repeat&&(isGait(mode)||mode==='sneak'))select(crouched?'crouch-idle':'idle',false);
 }
 function animationFrame(){
  const clip=clips[mode];
  const loop=mode==='idle'||mode==='crouch-idle'||repeat;
  const progress=loop?(elapsed%clip.duration)/clip.duration:Math.min(1,elapsed/clip.duration);
  let name=clip.consumption&&consumingWalking?mode+'-walk':mode,frame=frameAt(name,progress);
  if(stanceChange){
   if(stanceChange.reverse)frame=atlas.clips[mode][1]-1-frame;
   else if(frame===0&&stanceChange.source){
    ({name,frame}=stanceChange.source);
   }
  }
  if(isGait(mode)&&!repeat){
   name=gaitPose();frame=frameAt(name,gaitPhase);
  }
  if(mode==='sneak'&&!repeat)frame=frameAt(mode,gaitPhase);
  if(vault&&frame<3){
   if(frame===0){name='sprint';frame=vault.frame;}
   else{name=vault.entry;frame-=1;}
  }
  if(rollAttackEntry&&!repeat&&mode==='roll-attack-'+weaponType){
   const entry=rollAttackEntry;
   if(entry.pose&&frame===0){name=entry.pose;frame=entry.frame;}
   else if(entry.pose&&frame<3){name=entry.clip;frame-=1;}
   else if(!entry.pose&&frame<atlas.clips[entry.clip][1])name=entry.clip;
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
 function drawPacked(ctx,sheets,frame,left,top){
  const [sx,sy,w,h,dx,dy,page]=frame,ratio=modelSize/cell;
  ctx.drawImage(sheets[page],sx,sy,w,h,left+dx*ratio,top+dy*ratio,w*ratio,h*ratio);
 }
 function drawBlender(ctx,frame){
  const index=frame*8+facing;
  const clip=clips[mode];
  if(clip.heavy){
   const load=elapsed/clip.duration;
   ctx.save();
   ctx.strokeStyle=load===1?'#f2ce87ae':'#dbb4737d';
   ctx.lineWidth=load===1?2:1;
   ctx.beginPath();ctx.ellipse(x,y+13,23,6,0,Math.PI*.5,Math.PI*(.5+2*load));ctx.stroke();
   ctx.restore();
  }
  const motion=atlas.attackMotion[mode];
  if(motion?.floorContact){
   const since=(elapsed%clip.duration)-frameTime(mode,motion.impactFrame);
   if(since>=0&&since<.18){
    const angle=facing*Math.PI/4;
    const [side,forward]=motion.floorContact;
    const hitX=x+(Math.cos(angle)*forward+Math.sin(angle)*side)*unitsToPixels;
    const hitY=y+16+(Math.sin(angle)*forward-Math.cos(angle)*side)*unitsToPixels*.47;
    ctx.save();
    ctx.globalAlpha=.65*(1-since/.18);
    ctx.strokeStyle='#d0ab7c';
    ctx.beginPath();ctx.ellipse(hitX,hitY,4+since*112,2+since*42,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
   }
  }
  const left=Math.round(x-modelSize/2),top=Math.round(y+16-modelSize*modelGround);
  drawPacked(ctx,bodyLayers,atlas.body[index],left,top);
  const weaponFrame=atlas[weaponTypes[weaponType].sheet][index];
  if(showWeapon&&weaponFrame)drawPacked(ctx,weaponLayers,weaponFrame,left,top);
 }
 function drawBarrel(){
  const {height,radius}=atlas.vault;
  // Match the existing dungeon barrel's lid (source y=43) to the modeled palm.
  const sx=2*radius*unitsToPixels/44,sy=height*unitsToPixels*groundY/29;
  ctx.drawImage(barrel.sprite,41,35,46,43,barrel.x-23*sx,barrel.y+16-37*sy,46*sx,43*sy);
 }
 function drawStation(station){
  if(station.table){
   const size=.82,baseY=station.y+16;
   ctx.drawImage(station.table,station.x-64*size,baseY-80*size,128*size,112*size);
   if(!station.completed){
    const itemX=station.x+.19*unitsToPixels;
    const itemY=baseY+(.38*projectionY-.985*groundY)*unitsToPixels;
    ctx.drawImage(ruby,itemX-32*.48,itemY-36*.48,64*.48,64*.48);
   }
   return;
  }
  const img=station.completed?station.used:station.sprite;
  if(!img)return;
  const size=64*station.scale;
  ctx.drawImage(img,station.x-size/2,station.y+16-station.base*station.scale,size,size);
 }
 function drawInteractionEffect(){
  if(!interaction?.target.completed||interaction.target.kind!=='chest')return;
  const {target,event}=interaction,progress=elapsed/clips[mode].duration;
  const t=bound((progress-event)/(1-event),0,1);
  ctx.fillStyle='#f6d78e';
  ctx.globalAlpha=1-t;
  for(let i=0;i<8;i++){
   const angle=i*2.4,drift=4+10*t;
   const px=target.x+Math.cos(angle)*drift;
   const py=target.y+1-19*t+Math.sin(angle)*drift*.68;
   ctx.fillRect(Math.round(px),Math.round(py),i%3===0?2:1,2);
  }
  ctx.globalAlpha=1;
 }
 function camera(pos,visible,extent){
  return visible>=extent?(extent-visible)/2:bound(pos-visible/2,0,extent-visible);
 }
 function draw(frame,time){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#101212';ctx.fillRect(0,0,width,height);
  const left=camera(x,width/scale,columns*tile),top=camera(y,height/scale,rows*tile);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,Math.round(-left*dpr*scale),Math.round(-top*dpr*scale));
  ctx.imageSmoothingEnabled=false;
  if(alley)alley.drawGround(ctx,time);
  else{
   for(const part of ground)ctx.drawImage(part.bitmap,part.x,part.y);
   for(const prop of decor)ctx.drawImage(prop.sprite,prop.x-44,prop.y-53,88,77);
  }
  ctx.fillStyle='#110d1780';
  const fall=mode==='hit-down'?elapsed/clips[mode].duration:0;
  const down=ease((fall-.28)/.15)*ease((.81-fall)/.16);
  const angle=facing*Math.PI/4,shadowAngle=Math.atan2(Math.sin(angle)*projectionY,Math.cos(angle));
  ctx.beginPath();
  ctx.ellipse(x-12*down*Math.cos(angle),y+13-12*down*Math.sin(angle)*projectionY,21+7*down,5+3*down,
   shadowAngle*down,0,Math.PI*2);
  ctx.fill();
  const aboveBarrel=vault&&elapsed/clips.vault.duration>=.28&&elapsed/clips.vault.duration<.95;
  const inFront=prop=>prop!==interaction?.target&&(prop!==barrel||!aboveBarrel)&&prop.y>y;
  const drawProp=prop=>{
   if(alley)alley.drawProp(ctx,prop,atlas.vault,unitsToPixels);
   else if(prop===barrel)drawBarrel();
   else drawStation(prop);
  };
  const items=props.map(prop=>({
   depth:inFront(prop)?prop.y:Math.min(prop.y,y-.01),draw:()=>drawProp(prop)
  }));
  if(alley)items.push(...alley.architecture(ctx,x,y));
  items.push({depth:y,draw:()=>{
   ctx.imageSmoothingEnabled=scale===1;
   drawBlender(ctx,frame);
   ctx.imageSmoothingEnabled=false;
  }});
  for(const item of items.sort((a,b)=>a.depth-b.depth))item.draw();
  drawInteractionEffect();
  if(alley){
   alley.drawOverlays(ctx,time);
   alley.drawLogic(ctx);
  }
 }
 function loop(now){
  const dt=bound((now-last)/1000,0,.05);
  last=now;update(dt);
  draw(animationFrame(),now/1000);
  const target=nearestStation();
  const prompt=!interaction&&!approach&&!knockback&&target&&now>=blockedApproachUntil
   ?'E · '+target.prompt:interactionNotice;
  if(interactionPrompt.textContent!==prompt)interactionPrompt.textContent=prompt;
  requestAnimationFrame(loop);
 }
 function loadSheet(image,path){
  return new Promise((resolve,reject)=>{
   image.addEventListener('load',resolve,{once:true});
   image.addEventListener('error',reject,{once:true});
   image.src=path;
  });
 }
 function loadWeapon(type){
  if(!weaponSheets.has(type)){
   const loaded=loadLayer(weaponTypes[type].sheet).catch(error=>{weaponSheets.delete(type);throw error;});
   weaponSheets.set(type,loaded);
  }
  return weaponSheets.get(type);
 }
 function loadLayer(layer){
  return Promise.all(spriteFiles[layer].map(file=>{
   const image=new Image();
   return loadSheet(image,'art/player-study/'+file+'?v=17').then(()=>image);
  }));
 }
 fetch('art/player-study/guardian-frames.json?v=17').then(response=>{
  if(!response.ok)throw new Error('Animationsdaten fehlen.');
  return response.json();
 }).then(async frames=>{
  spriteFiles=frames.sheets;
  [bodyLayers,weaponLayers]=await Promise.all([loadLayer('body'),loadWeapon(weaponType)]);
  atlas=frames;
  colliders=[collider(barrel,atlas.vault.radius,atlas.vault.radius,.21),
   ...stations.filter(station=>station.radius).map(station=>
    collider(station,station.halfWidth??station.radius,station.radius,.22))];
  clips.walk.duration=atlas.consumption.walkCycle;
  for(const [kind,duration] of Object.entries(atlas.consumption.durations))clips[kind].duration=duration;
  clips.vault={duration:atlas.vault.duration};
  for(const [kind,{duration}] of Object.entries(atlas.interactions)){
   clips[kind]={duration};
   if(Object.hasOwn(atlas.clips,kind+'-crouched'))clips[kind+'-crouched']=clips[kind];
  }
  for(const [kind,{duration}] of Object.entries(atlas.knockback))clips[kind]={duration,knockback:true};
  for(const kind of Object.keys(atlas.clips)){
   if(kind==='crouch-down'||kind.startsWith('crouch-from-')||kind.startsWith('crouch-up-')){
    clips[kind]={duration:stanceDuration};
   }
  }
  weaponSelect.disabled=false;
  status.hidden=true;
  last=performance.now();requestAnimationFrame(loop);
 }).catch(()=>{status.textContent='Die Blender-Sprites konnten nicht geladen werden.';});
})();
