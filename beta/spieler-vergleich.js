(()=>{
 'use strict';

 const tile=48,columns=23,rows=13,cell=128;
 const modelSize=110,modelGround=.77597,unitsToPixels=modelSize/3.23;
 const lightHoldMs=240;
 const rollAttackWindowMs=175;
 const clips={
  idle:{duration:1.3},walk:{duration:.56},sprint:{duration:.49},roll:{duration:.76},
  'crouch-idle':{duration:1.4},sneak:{duration:.65},
  eat:{duration:1.43,consumption:true},drink:{duration:1.57,consumption:true},
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
 const art=window.DungeonArt;
 const map=Array.from({length:rows},(_,y)=>Array.from({length:columns},(_,x)=>
  Number(y===0||y===rows-1||x===0||x===columns-1)));
 const terrain=map.map(row=>row.map(()=>null));
 const lights=[{x:5.4*tile,y:3.2*tile,radius:155,color:'#dbc193',power:'52'},
  {x:17.4*tile,y:3.2*tile,radius:142,color:'#cba58d',power:'46'}];
 const ground=art.world(map,()=>3,lights,193,terrain,[],tile);
 const decor=lights.map(p=>({...p,sprite:art.furniture('sanctuary-brazier',3,0)}));
 const barrel={x:(columns/2+2)*tile,y:(rows/2+2)*tile,sprite:art.furniture('barrel',3,0)};
 const ruby=document.createElement('canvas');
 ruby.width=ruby.height=64;
 const {poly}=art.brush(ruby);
 poly([[23,34],[28,29],[36,29],[41,34],[32,44]],'#592536');
 poly([[25,34],[29,31],[35,31],[39,34],[32,41]],'#c63f59');
 poly([[25,34],[29,31],[35,31],[32,35]],'#ec8491');
 const stations=[
  {kind:'chest',x:9.4*tile,y:5.05*tile,radius:.49,scale:.70,base:48,
   sprite:art.icon('chest'),used:art.icon('chest','open'),prompt:'Truhe öffnen',done:'Truhe geöffnet'},
  {kind:'pickup',x:13.8*tile,y:5.05*tile,radius:0,scale:.48,base:42,
   sprite:ruby,prompt:'Rubin nehmen',done:'Rubin aufgenommen'},
  {kind:'knowledge',x:9.1*tile,y:9.4*tile,radius:.32,scale:.91,base:57,
   sprite:art.icon('shrine','','#91e6d2'),used:art.icon('shrine','','#576b6a'),
   prompt:'Wissen erlangen',done:'Wissen erlangt'},
 ];
 const presses=new Set();
 const props=[...stations,barrel].sort((a,b)=>a.y-b.y);
 const direction=document.querySelector('#direction'),zoomButton=document.querySelector('#zoom');
 const weaponButton=document.querySelector('#weapon'),weaponSelect=document.querySelector('#weapon-type');
 const movementMode=document.querySelector('#movement-mode');
 const interactionPrompt=document.querySelector('#interaction-prompt');
 const resetStations=document.querySelector('#reset-stations');
 const status=document.querySelector('#status'),buttons=Array.from(document.querySelectorAll('[data-clip]'));
 const canvas=document.querySelector('#blender'),ctx=canvas.getContext('2d',{alpha:false});
 let width=0,height=0,dpr=1;
 const bodySheet=new Image();
 const weaponSheets=new Map();
 let atlas;
 let x=columns*tile/2,y=rows*tile/2,scale=1,facing=1,mode='idle',elapsed=0,last=0,repeat=true;
 let showWeapon=true,gaitPhase=0,gaitBlend=0,movementStyle='walk',crouched=false,stanceChange=null;
 let rollEntry=null,rollExit=null,rollStartSpeed=0;
 let rollStartedWalking=false;
 let vault=null;
 let interaction=null,interactionNotice='';
 let rollAttackQueued=false,rollAttackUntil=0,rollAttackEntry=null;
 let weaponType='sword',weaponSheet;
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
 function startConsumption(clip){
  if(vault||interaction||stanceChange||crouched||!repeat&&(mode==='roll'||isAttack(mode)||clips[mode].consumption))return;
  const input=movement();
  if(input.length)face(input.facing);
  clearAttacks();select(clip,false);
 }
 function startRoll(){
  if(vault||interaction||stanceChange||crouched||mode==='roll'&&!repeat)return;
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
  if(!atlas||vault||interaction||stanceChange)return;
  const clip=previewClip(button.dataset.clip);
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
  if(vault||interaction||stanceChange||mode==='roll'&&!repeat)direction.value=String(facing);
  else facing=Number(direction.value);
 });
 zoomButton.addEventListener('click',()=>{
  scale=scale===1?2:1;zoomButton.setAttribute('aria-pressed',String(scale===2));
 });
 weaponButton.addEventListener('click',()=>{
  showWeapon=!showWeapon;weaponButton.setAttribute('aria-pressed',String(showWeapon));
 });
 resetStations.addEventListener('click',()=>{
  if(interaction)return;
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
   weaponType=type;weaponSheet=sheet;
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
   if(!event.repeat&&!vault&&!interaction&&!(mode==='roll'&&!repeat)){
    if(event.key==='Control')setMovementStyle(movementStyle==='sneak'?'walk':'sneak');
    else setMovementStyle(movementStyle==='sprint'?'walk':'sprint');
   }
   return;
  }
  if(event.target.closest?.('select'))return;
  if(Object.hasOwn(directions,event.code)){
   event.preventDefault();
   if(event.target!==canvas)canvas.focus({preventScroll:true});
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
   if(event.repeat||vault||interaction||stanceChange||crouched||clips[mode].consumption)return;
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
  if(!repeat&&(isAttack(mode)||clips[mode].consumption))select('idle',false);
  clearAttacks();
 });

 function hitsScenery(nx,ny){
  return Math.hypot(nx-barrel.x,(ny-barrel.y)/projectionY)<(atlas.vault.radius+.21)*unitsToPixels||
   stations.some(station=>station.radius&&Math.hypot(nx-station.x,(ny-station.y)/projectionY)<
    (station.radius+.22)*unitsToPixels);
 }
 function moveBy(dx,dy){
  const nx=bound(x+dx,tile+19,(columns-1)*tile-19);
  const ny=bound(y+dy,tile+19,(rows-1)*tile-19);
  if(!hitsScenery(nx,ny)){x=nx;y=ny;return;}
  if(!hitsScenery(nx,y))x=nx;
  if(!hitsScenery(x,ny))y=ny;
 }
 function nearestStation(){
  let nearest=null,best=1.55*unitsToPixels;
  for(const station of stations){
   const distance=Math.hypot(station.x-x,(station.y-y)/projectionY);
   if(!station.completed&&distance<best){nearest=station;best=distance;}
  }
  return nearest;
 }
 function startInteraction(){
  if(vault||interaction||stanceChange||!repeat&&(mode==='roll'||isAttack(mode)||clips[mode].consumption))return;
  const target=nearestStation();
  if(!target)return;
  const {distance,side=0,event}=atlas.interactions[target.kind];
  face((Math.round(Math.atan2((target.y-y)/projectionY,target.x-x)/(Math.PI/4))+8)%8);
  const angle=facing*Math.PI/4;
  const dx=Math.cos(angle)*distance+Math.sin(angle)*side;
  const dy=Math.sin(angle)*distance-Math.cos(angle)*side;
  interaction={
   target,event,fromX:x,fromY:y,
   x:target.x-dx*unitsToPixels,y:target.y-dy*projectionY*unitsToPixels
  };
  interactionNotice='';
  gaitBlend=0;
  clearAttacks();select(target.kind+(crouched?'-crouched':''),false);
 }
 function advanceInteraction(dt){
  const duration=clips[mode].duration,used=Math.min(dt,duration-elapsed);
  elapsed+=used;
  const progress=elapsed/duration,approach=ease(progress/.27);
  x=mix(interaction.fromX,interaction.x,approach);
  y=mix(interaction.fromY,interaction.y,approach);
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
  const {start,radius}=atlas.vault;
  // Use the rig camera's ground projection for trajectory and palm placement.
  const ox=(barrel.x-x)/unitsToPixels,oy=(barrel.y-y)/(unitsToPixels*projectionY);
  const stepY=input.dy/projectionY,step=Math.hypot(input.dx,stepY);
  if(Math.hypot(ox,oy)>-start+.12||(ox*input.dx+oy*stepY)<=0||
     Math.abs(ox*stepY-oy*input.dx)/step>radius*.80)return false;
  // Keep the approach facing as the trajectory eases onto the barrel center.
  const angle=facing*Math.PI/4;
  const dx=Math.cos(angle)*unitsToPixels,dy=Math.sin(angle)*unitsToPixels*projectionY;
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
   const remaining=clips[mode].duration-elapsed;
   if(dt<remaining){elapsed+=dt;return;}
   dt-=remaining;
   select('idle',false);
  }
  if(!stanceChange)startStanceChange(input);
  if(stanceChange){
   dt=advanceStance(dt);
   if(dt===0)return;
   if(crouched!==(input.gait==='sneak'))return;
  }
  elapsed+=dt;
  if(input.length){
   face(input.facing);
   if(crouched){
    if(mode!=='sneak'){gaitPhase=0;select('sneak',false);}
    gaitPhase=(gaitPhase+dt/clips.sneak.duration)%1;
    const speed=sneakSpeed*Math.hypot(input.dx,input.dy*groundY)/input.length;
    moveBy(dt*input.dx/input.length*speed,dt*input.dy/input.length*speed);
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
   const speed=gaitSpeed(blend)*Math.hypot(input.dx,input.dy*groundY)/input.length;
   moveBy(dt*input.dx/input.length*speed,dt*input.dy/input.length*speed);
  }else if(!repeat&&(isGait(mode)||mode==='sneak'))select(crouched?'crouch-idle':'idle',false);
 }
 function animationFrame(){
  const clip=clips[mode];
  const loop=mode==='idle'||mode==='crouch-idle'||repeat;
  const progress=loop?(elapsed%clip.duration)/clip.duration:Math.min(1,elapsed/clip.duration);
  let name=mode,frame=frameAt(mode,progress);
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
 function drawPacked(ctx,sheet,frame,left,top){
  const [sx,sy,w,h,dx,dy]=frame,ratio=modelSize/cell;
  ctx.drawImage(sheet,sx,sy,w,h,left+dx*ratio,top+dy*ratio,w*ratio,h*ratio);
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
  drawPacked(ctx,bodySheet,atlas.body[index],left,top);
  const weaponFrame=atlas[weaponTypes[weaponType].sheet][index];
  if(showWeapon&&weaponFrame)drawPacked(ctx,weaponSheet,weaponFrame,left,top);
 }
 function drawBarrel(){
  const {height,radius}=atlas.vault;
  // Match the existing dungeon barrel's lid (source y=43) to the modeled palm.
  const sx=2*radius*unitsToPixels/44,sy=height*unitsToPixels*groundY/29;
  ctx.drawImage(barrel.sprite,41,35,46,43,barrel.x-23*sx,barrel.y+16-37*sy,46*sx,43*sy);
 }
 function drawStation(station){
  const img=station.completed?station.used:station.sprite;
  if(!img)return;
  const size=64*station.scale;
  ctx.drawImage(img,station.x-size/2,station.y+16-station.base*station.scale,size,size);
 }
 function drawInteractionEffect(){
  if(!interaction?.target.completed||interaction.target.kind==='pickup')return;
  const {target,event}=interaction,progress=elapsed/clips[mode].duration;
  const t=bound((progress-event)/(1-event),0,1);
  const knowledge=target.kind==='knowledge';
  const fromY=target.y+16-(knowledge?28:15);
  if(knowledge){
   ctx.strokeStyle='rgba(142,244,221,'+(.60*(1-t))+')';
   ctx.lineWidth=1.4;
   ctx.beginPath();
   ctx.moveTo(target.x,fromY);
   ctx.quadraticCurveTo(mix(target.x,x,.55),fromY-22,x,y-29);
   ctx.stroke();
  }
  ctx.fillStyle=knowledge?'#b7f6d9':'#f6d78e';
  ctx.globalAlpha=1-t;
  for(let i=0;i<8;i++){
   const angle=i*2.4,drift=4+10*t;
   const px=(knowledge?mix(target.x,x,t):target.x)+Math.cos(angle)*drift;
   const py=(knowledge?mix(fromY,y-28,t):fromY-19*t)+Math.sin(angle)*drift*.68;
   ctx.fillRect(Math.round(px),Math.round(py),i%3===0?2:1,2);
  }
  ctx.globalAlpha=1;
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
  ctx.fillStyle='#110d1780';
  ctx.beginPath();ctx.ellipse(x,y+13,21,5,0,0,Math.PI*2);ctx.fill();
  const aboveBarrel=vault&&elapsed/clips.vault.duration>=.28&&elapsed/clips.vault.duration<.95;
  const inFront=prop=>prop!==interaction?.target&&(prop!==barrel||!aboveBarrel)&&prop.y>y;
  const drawProp=prop=>prop===barrel?drawBarrel():drawStation(prop);
  for(const prop of props)if(!inFront(prop))drawProp(prop);
  ctx.imageSmoothingEnabled=scale===1;
  drawBlender(ctx,frame);
  ctx.imageSmoothingEnabled=false;
  for(const prop of props)if(inFront(prop))drawProp(prop);
  drawInteractionEffect();
 }
 function loop(now){
  const dt=bound((now-last)/1000,0,.05);
  last=now;update(dt);
  draw(animationFrame());
  const target=nearestStation();
  const prompt=!interaction&&target?'E · '+target.prompt:interactionNotice;
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
   const image=new Image();
   const loaded=loadSheet(image,'art/player-study/guardian-'+weaponTypes[type].sheet+'.webp?v=15')
    .then(()=>image).catch(error=>{weaponSheets.delete(type);throw error;});
   weaponSheets.set(type,loaded);
  }
  return weaponSheets.get(type);
 }
 Promise.all([
  loadSheet(bodySheet,'art/player-study/guardian-body.webp?v=15'),
  loadWeapon(weaponType),
  fetch('art/player-study/guardian-frames.json?v=15').then(response=>{
   if(!response.ok)throw new Error('Animationsdaten fehlen.');
   return response.json();
  })
 ]).then(([,sheet,frames])=>{
  atlas=frames;
  clips.vault={duration:atlas.vault.duration};
  for(const [kind,{duration}] of Object.entries(atlas.interactions)){
   clips[kind]=clips[kind+'-crouched']={duration};
  }
  for(const kind of Object.keys(atlas.clips)){
   if(kind==='crouch-down'||kind.startsWith('crouch-from-')||kind.startsWith('crouch-up-')){
    clips[kind]={duration:stanceDuration};
   }
  }
  weaponSheet=sheet;weaponSelect.disabled=false;
  status.hidden=true;
  last=performance.now();requestAnimationFrame(loop);
 }).catch(()=>{status.textContent='Die Blender-Sprites konnten nicht geladen werden.';});
})();
