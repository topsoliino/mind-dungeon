(root=>{
'use strict';
function create(api){
 const {enemyRules,items,balance,save,state,floor,getEnemies,moveActor,nearActor,regionKnown,takeDamage,applyPoison,addBleed,
  soundWorld,burst,hurtEnemy,coopActors,enemyEncounterReady,rand}=api;
 const {W,H,rooms,regionAt,inRest,outsideAt,pointIn,valid,furnitureBlocked,gateLineBlocked,gateBlocked,wall,pressurePlates}=floor;
 const {SNAKE,LION,LIONESS,BAT,STORM_BAT}=enemyRules;
 const isBat=e=>e.type===BAT||e.type===STORM_BAT,isLion=e=>e.type===LION||e.type===LIONESS;
 const TILE=48,TAU=2*Math.PI,enemyDepth=enemyRules.depthFactor(save.floor);
 const foeResistances=items.foes.map(profile=>enemyRules.resistances(profile,save.floor));
 let player,combatClock=0,cw=1280,ch=720;
 function asHero(actor,action){const prior=player;player=actor;try{return action();}finally{player=prior;}}
 const damageActive=(...args)=>takeDamage(player,...args);
 const bleedActive=amount=>addBleed(player,amount);
 const poison=(actor,options)=>applyPoison(actor,options);
 const recover=(enemy,seconds)=>{
  enemy.recover=seconds;enemy.counterUntil=combatClock+balance.counterSeconds;
 };
 function moveFrom(dt,actor,clock,width,height){
  player=actor;combatClock=clock;cw=width;ch=height;
  updateWebs(dt);updatePlates(dt);updateStorm(dt);updateBolts(dt);updateEnemyHazards(dt);
 }
 function act(e,dt,actor,clock,width,height){
  player=actor;combatClock=clock;cw=width;ch=height;updateEnemy(e,dt);
 }
function moveEnemy(e,dx,dy){
 const {x,y}=e;
 moveActor(e,dx,dy);
 if(Math.hypot(e.x-x,e.y-y)>.05){
  e.facing=Math.atan2(e.y-y,e.x-x);e.moving=true;
 }
}
function aimEnemy(e,angle){e.angle=angle;e.facing=angle;}
function updateEnemy(e,dt){
 if(!enemyEncounterReady(e)){
  e.phase+=dt;e.hit=Math.max(0,e.hit-dt);e.emerge=Math.max(0,(e.emerge||0)-dt);
  e.windup=0;e.runAttack=0;e.track=0;e.aggro=0;e.moving=false;
  e.batMove=null;e.lionMove=null;e.called=0;
  return;
 }
 if(isBat(e)){updateBat(e,dt);return;}
 if(isLion(e)){updateLion(e,dt);return;}
 const spec=enemyRules.attacks[e.type];
 if(e.emerge>0){e.emerge=Math.max(0,e.emerge-dt);return;}
 e.phase+=dt;e.hit=Math.max(0,e.hit-dt);e.attack-=dt;e.moving=false;
 const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const range=enemyRules.eyeRange(e.type,e.boss,Math.min(cw,W*TILE),Math.min(ch,H*TILE),angle);
 const line=d<range*1.22&&!gateLineBlocked(e.x,e.y,player.x,player.y);
 const spotted=line&&d<=range;
 if(spotted)e.alerted=true;
 if(spotted&&e.boss&&!e.audioEntered&&d<330){
  e.audioEntered=soundWorld('boss_enter',e,{priority:2,cooldown:1.05,gain:.82})||false;
 }
 e.aggro=spotted?1.4:Math.max(0,(e.aggro||0)-dt);
 const clear=line&&e.aggro>0;
 if(e.type!==SNAKE&&clear&&nearActor(e,player,5)&&!(e.runAttack>0))damageActive(9+(e.boss?5:0),items.foeAttack[e.type]);
 if(e.runAttack>0){
  if(spec.id==='charge'||spec.id==='rift'||spec.id==='grab'||spec.id==='bite'){advanceRush(e,spec,dt,angle);return;}
  if(['web','frost','bow','crossbow'].includes(spec.id)){
   e.runAttack=Math.max(0,e.runAttack-dt);
   if(!e.runAttack)recover(e,spec.recovery);
   return;
  }
  e.runAttack=Math.max(0,e.runAttack-dt);
  if(!e.struck&&e.runAttack<e.runDuration*.52){
   e.struck=true;
   const facing=Math.cos(angle-e.angle)>.55;
   if(clear&&d<117&&facing&&damageActive(19,{physical:.65,dark:.35})&&player.inv<1){
    if((player.bleedCooldown||0)<=0){player.bleedCooldown=3;damageActive(api.maxHP(player)*.07,{bleed:1},true);}
   }
  }
  if(!e.runAttack)recover(e,spec.recovery);
  return;
 }
 if(e.recover>0){e.recover=Math.max(0,e.recover-dt);return;}
 if(e.windup>0){
  e.windup=Math.max(0,e.windup-dt);
  if(e.windup>0)return;
  executeEnemyAttack(e,spec);
  return;
 }
 if(!clear){
  if(e.type===SNAKE&&e.aggro>0&&d<range*1.22)chaseSerpent(e,dt,spec.speed,true);
  return;
 }
 if(e.attack<=0&&d<spec.range&&(e.type!==SNAKE||!furnitureBlocked((e.x+player.x)/2,(e.y+player.y)/2,8))){
  e.windup=spec.windup;aimEnemy(e,angle);e.target={x:player.x,y:player.y};
  if(spec.id==='bite')soundWorld('snake_hiss',e,{priority:2,cooldown:.14});
  if(spec.id==='frost'){
   e.frostTargets=frostSites(e);
   soundWorld('element_frost_cast',e,{priority:2,cooldown:.25});
  }
  return;
 }
 if(nearActor(e,player,1)||(spec.id==='bow'||spec.id==='crossbow')&&d<spec.range*.72)return;
 const speed=(spec.speed+(e.boss?7:0))*(1+.075*(save.floor-1));
 if(e.type===SNAKE){
  const angleToHero=Math.atan2(player.y-e.y,player.x-e.x);
  const blocked=!valid(e.x+Math.cos(angleToHero)*20,e.y+Math.sin(angleToHero)*20,8);
  chaseSerpent(e,dt,speed,blocked);return;
 }
 moveEnemy(e,Math.cos(angle)*speed*dt,Math.sin(angle)*speed*dt);
}
function executeEnemyAttack(e,spec){
 e.attack=(e.boss?2.25:2.85)-(save.floor-1)*.12;
 const durations={charge:1.1,rift:.74,reap:.36,grab:.38,bite:.25};
 if(durations[spec.id]){
  const cue=spec.id==='rift'?'element_dark_rift':spec.id==='charge'?'weapon_hammer':spec.id==='reap'?'weapon_greatsword':null;
  if(spec.id==='bite')soundWorld('snake_bite',e,{priority:2,cooldown:.14});
  if(cue)soundWorld(cue,e,{gain:.78,priority:2,cooldown:.11});
  e.runDuration=durations[spec.id];
  e.runAttack=e.runDuration;e.track=spec.id==='charge'?.58:0;e.trailTimer=0;e.struck=false;return;
 }
 e.runDuration=.32;e.runAttack=e.runDuration;
 if(spec.id==='web')fireWeb(e);
 else if(spec.id==='bow'||spec.id==='crossbow')fireBolt(e,spec.id);
 else {
  for(const point of e.frostTargets||frostSites(e))state.enemyHazards.push({...point,radius:23,life:1.75,wait:.33,type:'frost',power:20});
 }
}
function advanceRush(e,spec,dt,targetAngle){
 if(e.track>0){e.angle=enemyRules.turn(e.angle,targetAngle,dt*2.3);e.track-=dt;}
 const oldX=e.x,oldY=e.y,speed=({charge:252,rift:222,grab:211,bite:170})[spec.id];
 moveEnemy(e,Math.cos(e.angle)*speed*dt,Math.sin(e.angle)*speed*dt);
 e.runAttack=Math.max(0,e.runAttack-dt);
 if(Math.hypot(e.x-oldX,e.y-oldY)<speed*dt*.2)e.runAttack=0;
 if(spec.id==='rift'){
  e.trailTimer-=dt;
  if(e.trailTimer<=0){e.trailTimer=.12;state.enemyHazards.push({x:oldX,y:oldY,radius:25,life:3.9,wait:0,angle:e.angle,type:'dark',power:8});}
 }
 if(!e.struck&&nearActor(e,player,9)&&!gateLineBlocked(e.x,e.y,player.x,player.y)){
  const dark=spec.id==='rift';
  const damage=spec.id==='bite'?5:spec.id==='grab'?13:21;
  e.struck=damageActive(e.fireSnake?8:damage,e.fireSnake?{fire:1}:dark?{dark:1}:{physical:1});
  if(e.struck&&player.inv<1){
   if(spec.id==='grab'){player.grabSlow=1.4;player.stamina=Math.max(0,player.stamina-18);}
   if(spec.id==='bite'&&!e.fireSnake&&!player.poison)poison(player,{untilTick:.72,ticks:3});
  }
 }
 if(e.runAttack<=0)recover(e,spec.recovery);
}
function frostSites(e){
 return [-34,0,34].map(offset=>({
  x:e.target.x-Math.sin(e.angle)*offset,y:e.target.y+Math.cos(e.angle)*offset
 })).filter(p=>valid(p.x,p.y,4)&&!gateLineBlocked(e.x,e.y,p.x,p.y));
}
// Serpents recalculate a route through open tiles when the direct line is blocked.
function chaseSerpent(e,dt,speed,blocked){
 let target=player;
 if(blocked){
  e.routeDelay=(e.routeDelay||0)-dt;
  if(e.routeDelay<=0||e.route&&Math.hypot(e.route.x-e.x,e.route.y-e.y)<7){
   e.route=serpentStep(e,player);e.routeDelay=.25;
  }
  if(!e.route)return;
  target=e.route;
 }
 const angle=Math.atan2(target.y-e.y,target.x-e.x);
 aimEnemy(e,angle);
 const stride=Math.min(speed*dt,Math.hypot(target.x-e.x,target.y-e.y));
 moveEnemy(e,Math.cos(angle)*stride,Math.sin(angle)*stride);
}
function serpentStep(e,target,limit=420){
 const start=Math.floor(e.y/TILE)*W+Math.floor(e.x/TILE);
 const goal=Math.floor(target.y/TILE)*W+Math.floor(target.x/TILE);
 const frontier=[start],steps=new Map([[start,start]]);
 for(let i=0;i<frontier.length&&i<limit;i++){
  const id=frontier[i];
  if(id===goal){
   if(id===start)return target;
   const first=steps.get(id);
   return {x:(first%W+.5)*TILE,y:(Math.floor(first/W)+.5)*TILE};
  }
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=id%W+dx,y=Math.floor(id/W)+dy,n=y*W+x;
   if(x<0||x>=W||y<0||y>=H||steps.has(n)||!valid((x+.5)*TILE,(y+.5)*TILE,8))continue;
   steps.set(n,id===start?n:steps.get(id));frontier.push(n);
  }
 }
 return null;
}
function updateEnemyHazards(dt){
 for(const hazard of state.enemyHazards){
  hazard.life-=dt;hazard.wait-=dt;
  if(hazard.wait<=0&&hazard.type==='frost'&&!hazard.audioStarted){
   hazard.audioStarted=true;
   soundWorld('element_frost_impact',hazard,{group:'frost-zone',gain:.78,cooldown:.17,priority:2});
  }
  if(hazard.wait>0||hazard.life<=0)continue;
  for(const [index,hero] of coopActors().entries()){
   if(index===0?hazard.triggered:hazard.peerTriggered)continue;
   if(Math.hypot(hazard.x-hero.x,hazard.y-hero.y)>hazard.radius||gateLineBlocked(hazard.x,hazard.y,hero.x,hero.y))continue;
   asHero(hero,()=>{
    if(damageActive(hazard.power,{[hazard.type]:1},false,enemyDepth,hazard.type==='frost'?'':undefined)&&hazard.type==='frost'){
     hero.webSlow=Math.max(hero.webSlow||0,1.15);
     if(index===0)hazard.triggered=true;else hazard.peerTriggered=true;
    }
   });
  }
 }
 state.enemyHazards=state.enemyHazards.filter(h=>h.life>0);
}
function updatePlates(dt){
 for(const p of pressurePlates){
  const pressed=coopActors().some(hero=>Math.abs(p.x-hero.x)<17&&Math.abs(p.y-hero.y)<17);
  p.cooldown=Math.max(0,p.cooldown-dt);
  if(pressed&&!p.pressed&&!p.cooldown){
   p.timer=.27;p.cooldown=1.7;
   burst(p.x,p.y,'#d9b788',7);
   soundWorld('temple_plate_press',p,{priority:2,cooldown:.13});
  }
  p.pressed=pressed;
  if(p.timer<=0)continue;
  p.timer-=dt;
  if(p.timer>0)continue;
  const left=p.angle===0;
  const from=p.origin.x+(left?-260:260);
  soundWorld('temple_trap_release',p.origin,{priority:3,cooldown:.12});
  const speed=940;
  state.bolts.push({x:from,y:p.y,angle:p.angle,speed,life:Math.abs(from-p.origin.x)/speed+1.15,type:'trap',entryX:p.origin.x});
 }
}
const lionRake={duration:.63,pace:.19,reach:102,spread:.86,bleed:27};
function updateLion(e,dt){
 const spec=enemyRules.attacks[e.type];
 e.phase+=dt;e.hit=Math.max(0,e.hit-dt);e.attack-=dt;e.moving=false;
 const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const clear=d<=enemyRules.eyeRange(e.type,false,cw,ch,angle)&&!gateLineBlocked(e.x,e.y,player.x,player.y);
 if(clear)e.alerted=true;
 e.called=Math.max(0,(e.called||0)-dt);
 e.aggro=clear?1.4:Math.max(e.called,(e.aggro||0)-dt);
 const move=e.lionMove;
 if(move){
  move.age+=dt;
  if(move.age<move.windup)return;
  const t=move.age-move.windup;
  if(move.kind==='leap'&&t<.35){
   if(!move.audioStarted){move.audioStarted=true;soundWorld('lion_leap',e,{priority:2,cooldown:.17});}
   moveEnemy(e,Math.cos(move.angle)*270*dt,Math.sin(move.angle)*270*dt);
   if(!move.landed&&nearActor(e,player,11)&&damageActive(e.type===LION?16:13,{physical:1}))move.landed=true;
  }else if(move.kind==='rake'&&t<lionRake.duration){
   if(t>=move.next){
    const swipeAngle=move.angle+(move.swipes%2===0?.22:-.22);
    move.swipes++;move.next+=lionRake.pace;
    soundWorld('lion_claw_source',e,{group:'lion-rake',gain:.71,cooldown:.115});
    move.last={time:t,angle:swipeAngle};
    const reach=lionRake.reach+(e.type===LION?7:0);
    if(d<reach&&Math.cos(angle-swipeAngle)>Math.cos(lionRake.spread)&&!gateLineBlocked(e.x,e.y,player.x,player.y)&&
     damageActive(5,{physical:1},true,1+(save.floor-1)*.28))bleedActive(lionRake.bleed);
   }
  }else if(move.kind==='roar'&&!move.called){
   move.called=true;e.roarCooldown=8;
   soundWorld('lion_roar',e,{priority:3,cooldown:.50});
   const ally=nearestLion(e);
   if(ally){ally.called=9;ally.aggro=9;ally.alerted=true;}
   burst(e.x,e.y,'#e2b472',23);
  }
  if(t>=move.duration){e.lionMove=null;e.attack=spec.recovery+.55;e.counterUntil=combatClock+balance.counterSeconds;}
  return;
 }
 e.roarCooldown=Math.max(0,(e.roarCooldown||0)-dt);
 if(e.attack<=0&&clear&&d<spec.range){
  const kind=d<lionRake.reach&&Math.random()<.66?'rake':!e.roarCooldown&&nearestLion(e)&&Math.random()<.4?'roar':'leap';
  aimEnemy(e,angle);
  soundWorld('lion_growl',e,{priority:2,gain:.77,cooldown:.26});
  e.lionMove={kind,age:0,angle,windup:kind==='roar'?.65:spec.windup,duration:kind==='roar'?.42:kind==='rake'?lionRake.duration:.35,next:.055,swipes:0};
  return;
 }
 if(nearActor(e,player,3))return;
 if(clear){aimEnemy(e,angle);moveEnemy(e,Math.cos(angle)*spec.speed*dt,Math.sin(angle)*spec.speed*dt);}
 else if(e.aggro>0){
  e.routeDelay=(e.routeDelay||0)-dt;
  if(e.routeDelay<=0||e.route&&Math.hypot(e.x-e.route.x,e.y-e.route.y)<8){
   e.route=serpentStep(e,player,2000);e.routeDelay=.31;
  }
  if(e.route){const a=Math.atan2(e.route.y-e.y,e.route.x-e.x);aimEnemy(e,a);
   const stride=Math.min(spec.speed*dt,Math.hypot(e.route.x-e.x,e.route.y-e.y));moveEnemy(e,Math.cos(a)*stride,Math.sin(a)*stride);}
 }
}
function updateBat(e,dt){
 const spec=enemyRules.attacks[e.type],lightning=e.type===STORM_BAT;
 e.phase+=dt;e.hit=Math.max(0,e.hit-dt);e.attack-=dt;e.moving=false;
 const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const clear=d<=enemyRules.eyeRange(e.type,false,cw,ch,angle)&&!gateLineBlocked(e.x,e.y,player.x,player.y);
 if(clear)e.alerted=true;
 e.aggro=clear?1.4:Math.max(0,(e.aggro||0)-dt);
 const move=e.batMove;
 if(move){
  move.age+=dt;
  if(move.age<spec.windup){
   if(clear&&move.age<spec.windup*.4)aimEnemy(e,enemyRules.turn(e.angle,angle,dt*4));
   return;
  }
  const age=move.age-spec.windup;
  if(lightning&&!move.audioStarted){
   move.audioStarted=true;
   soundWorld('element_lightning_beam',e,{priority:2,cooldown:.26});
  }
  if(age<move.duration&&age>=move.next){
   move.next+=lightning?.23:.28;
   const forward=dx*Math.cos(e.angle)+dy*Math.sin(e.angle);
   const side=Math.abs(dy*Math.cos(e.angle)-dx*Math.sin(e.angle));
   if(forward>0&&forward<e.castLength&&side<(lightning?15:18+forward*.52)&&!gateLineBlocked(e.x,e.y,player.x,player.y)){
    damageActive(lightning?4:6,{[lightning?'lightning':'fire']:1},true);
   }
  }
  if(age>=move.duration&&!move.finished){move.finished=true;e.counterUntil=combatClock+balance.counterSeconds;}
  if(age>=move.duration+.24){e.batMove=null;e.attack=spec.recovery+1.2;}
  return;
 }
 e.fleeTime=Math.max(0,(e.fleeTime||0)-dt);
 e.fleeCooldown=Math.max(0,(e.fleeCooldown||0)-dt);
 const home=outsideAt(e.x,e.y);
 if(clear&&d<109&&home?.passage&&!e.fleeCooldown){
  e.fleeCooldown=7;
  if(Math.random()<.43){
   e.fleeTime=3.8;
   const passage=home.passage;
   const parent=rooms[passage.from]||rooms[0];
   e.fleeGoal=pointIn(parent,0,0);
   e.route=null;e.routeDelay=0;
  }
 }
 if(e.fleeTime>0){
  e.routeDelay-=dt;
  if(e.routeDelay<=0||e.route&&Math.hypot(e.route.x-e.x,e.route.y-e.y)<8){
   e.route=serpentStep(e,e.fleeGoal,1800);e.routeDelay=.25;
  }
  if(e.route){
   const a=Math.atan2(e.route.y-e.y,e.route.x-e.x);
   const step=Math.min(spec.speed*dt,Math.hypot(e.route.x-e.x,e.route.y-e.y));
   aimEnemy(e,a);moveEnemy(e,Math.cos(a)*step,Math.sin(a)*step);
  }
  if(Math.hypot(e.fleeGoal.x-e.x,e.fleeGoal.y-e.y)<14)e.fleeTime=0;
  return;
 }
 if(!clear)return;
 if(e.attack<=0&&d<spec.range){
  aimEnemy(e,angle);
  e.castLength=spec.range;
  e.batMove={age:0,next:0,duration:lightning?.93:.71};
  soundWorld(lightning?'element_lightning_charge':'element_fire_cast',e,{priority:2,cooldown:.26});
  return;
 }
 if(d<43){damageActive(4,{physical:1});return;}
 const a=d>spec.range*.83?angle:angle+(e.phase%TAU<Math.PI?1.2:-1.2);
 aimEnemy(e,a);
 moveEnemy(e,Math.cos(a)*spec.speed*dt,Math.sin(a)*spec.speed*dt);
}
let stormDelay=3.8;
function updateStorm(dt){
 if(outsideAt(player.x,player.y)?.storm){
  stormDelay-=dt;
  if(stormDelay<=0){
   stormDelay=rand(5,9);
   const choices=getEnemies().filter(e=>e.hp>0&&outsideAt(e.x,e.y)?.storm&&Math.hypot(e.x-player.x,e.y-player.y)<230);
   const target=choices.length&&Math.random()<.48?choices[Math.floor(Math.random()*choices.length)]:player;
   const sites=Array.from({length:7},()=>({x:target.x+rand(-83,83),y:target.y+rand(-66,66)}));
   const point=sites.find(p=>outsideAt(p.x,p.y)?.storm&&valid(p.x,p.y,4,true))??{x:target.x,y:target.y};
   state.stormStrikes.push({...point,age:0,hit:false});
   soundWorld('element_lightning_charge',point,{gain:.86,priority:2});
  }
 }
 for(const strike of state.stormStrikes){
  strike.age+=dt;
  if(strike.age<1||strike.hit)continue;
  strike.hit=true;
  soundWorld('element_lightning_impact',strike,{group:'hero-element-lightning',cooldown:.23,gain:1.12,priority:3});
  const nearBolt=actor=>outsideAt(actor.x,actor.y)&&Math.hypot(actor.x-strike.x,actor.y-strike.y)<55;
  for(const e of getEnemies())if(e.hp>0&&nearBolt(e))hurtEnemy(e,items.hit(21+save.floor*7,{lightning:1},foeResistances[e.type]));
  for(const actor of coopActors())if(nearBolt(actor))asHero(actor,()=>damageActive(12,{lightning:1}));
  burst(strike.x,strike.y,'#c2dcff',24);
 }
 state.stormStrikes=state.stormStrikes.filter(strike=>strike.age<1.45);
}
function nearestLion(e){
 let best=null,distance=Infinity;
 for(const other of getEnemies()){
  if(other===e||other.hp<=0||!isLion(other)||!regionKnown(regionAt(other.x,other.y)))continue;
  const gap=Math.hypot(other.x-e.x,other.y-e.y);
  if(gap<distance){best=other;distance=gap;}
 }
 return best;
}
function fireBolt(e,type){
 const speed=type==='bow'?330:445;
 state.bolts.push({x:e.x,y:e.y,angle:e.angle,speed,life:1.23,type});
}
function updateBolts(dt){
 state.bolts=state.bolts.filter(p=>{
  p.life-=dt;
  if(p.life<=0)return false;
  const dx=Math.cos(p.angle)*p.speed*dt,dy=Math.sin(p.angle)*p.speed*dt;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/5));
  for(let i=0;i<steps;i++){
   const x=p.x+dx/steps,y=p.y+dy/steps;
   const approaching=p.type==='trap'&&(p.angle===0?x<p.entryX:x>p.entryX);
   if(!approaching&&(inRest(x,y)||wall(x,y)||gateBlocked(x,y)||furnitureBlocked(x,y,2)))return false;
   p.x=x;p.y=y;
   if(approaching)continue;
   if(!p.audioPassed&&Math.hypot(p.x-player.x,p.y-player.y)<146){
    p.audioPassed=true;
    soundWorld('bolt_fly',p,{group:'projectile-pass',cooldown:.09,priority:2,rate:p.type==='trap'?1.19:1});
   }
   const target=coopActors().find(hero=>hero.dash<=0&&Math.hypot(p.x-hero.x,p.y-hero.y)<13);
   if(target){
    const damage=p.type==='trap'?10:p.type==='bow'?11:16;
    const split=p.type==='trap'?{physical:.70,poison:.30}:p.type==='crossbow'?{physical:.75,dark:.25}:{physical:1};
    asHero(target,()=>{if(damageActive(damage,split)&&p.type==='trap'&&!player.poison)poison(player,{untilTick:.67,ticks:2,power:.55});});
    return false;
   }
  }
  return p.life>0;
 });
}
function fireWeb(e){
 const speed=184+save.floor*12;
 state.webShots.push({x:e.x,y:e.y,vx:Math.cos(e.angle)*speed,vy:Math.sin(e.angle)*speed,life:1.45});
}
function updateWebs(dt){
 state.webPatches.forEach(p=>p.life-=dt);
 state.webPatches=state.webPatches.filter(p=>p.life>0);
 state.webShots=state.webShots.filter(p=>{
  p.life-=dt;
  const x=p.x+p.vx*dt,y=p.y+p.vy*dt;
  if(inRest(x,y))return false;
  const blocked=gateLineBlocked(p.x,p.y,x,y)||furnitureBlocked(x,y,2);
  const hit=coopActors().find(hero=>hero.dash<=0&&hero.inv<=0&&Math.hypot(x-hero.x,y-hero.y)<16);
  if(blocked||hit||p.life<=0){
   if(!blocked||valid(p.x,p.y,3))state.webPatches.push({x:blocked?p.x:x,y:blocked?p.y:y,radius:29,life:7});
   if(hit)asHero(hit,()=>{player.webSlow=2.4;if(damageActive(4,{dark:1})&&player.inv<1&&!player.poison)poison(player,{untilTick:.72,ticks:3});});
   return false;
  }
  p.x=x;p.y=y;return true;
 });
}
return {act,moveFrom,stormTimer(value){if(Number.isFinite(value))stormDelay=value;return stormDelay;}};
}
root.DungeonEnemySim={create};
})(typeof window==='undefined'?globalThis:window);
