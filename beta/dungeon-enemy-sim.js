(root=>{
'use strict';
const lionRake={duration:.63,pace:.19,reach:102,spread:.86,bleed:27};
function create(api){
 const {enemyRules,items,balance,save,state,floor,getEnemies,moveActor,actorRadius,nearActor,takeDamage,applyPoison,addBleed,
  soundWorld,hitFurniture,landArrow,burst,hurtEnemy,shockWater,knockHero,coopActors,enemyEncounterReady,rand}=api;
 const {W,H,rooms,regionAt,inRest,outsideAt,pointIn,valid,furnitureBlocked,furnitureAt,furnitureBetween,gateLineBlocked,gateBlocked,wall,pressurePlates}=floor;
 const {SNAKE,LION,LIONESS,BAT,STORM_BAT,RAT,ELECTRO_RAT,EAGLE,FROST_ZOMBIE,FROST_CROSSBOW,STREET_DOG}=enemyRules;
 const isBat=e=>e.type===BAT||e.type===STORM_BAT,isLion=e=>e.type===LION||e.type===LIONESS;
 const lionStep=['lion_paw',56,.31,.38],batFlap=['bat_wings',76,.24,.43],bones=['enemy_skeleton_rattle',37,.31,.46];
 const movementCues={lion:lionStep,lioness:lionStep,'bat-fire':batFlap,'bat-lightning':batFlap,
  bite:['snake_slither',103,.30,.82],reap:bones,bow:bones};
 const windupCue={rift:'enemy_priest_voice',bow:'bow_draw',bite:'snake_hiss'};
 const TILE=48,TAU=2*Math.PI,enemyDepth=enemyRules.depthFactor(save.floor);
 const foeResistances=items.foes.map(profile=>enemyRules.resistances(profile,save.floor));
 let player,combatClock=0,cw=1280,ch=720;
 function asHero(actor,action){const prior=player;player=actor;try{return action();}finally{player=prior;}}
 const origin=enemyRules.damageOrigin;
 const eyeRange=(e,angle)=>enemyRules.eyeRange(e.type,e.boss,Math.min(cw,W*TILE),Math.min(ch,H*TILE),angle)*(floor.sightScale?.(e.x,e.y)??1);
 const damageActive=(source,amount,split,status,depth,cue,critical,impactAngle)=>takeDamage(player,amount,split,status,depth,cue,critical,source,impactAngle);
 const bleedActive=(e,amount)=>addBleed(player,amount,origin(e,'Blutverlust'));
 const poison=(actor,options)=>applyPoison(actor,options);
 const recover=(enemy,seconds)=>{
  enemy.recover=seconds;enemy.counterUntil=combatClock+balance.counterSeconds;
 };
 function strikeCover(e,damage,tx=player.x,ty=player.y,radius=2){
  const prop=furnitureBetween(e.x,e.y,tx,ty,radius);
  if(!prop)return false;
  hitFurniture?.(prop,damage,Math.atan2(ty-e.y,tx-e.x));
  return true;
 }
 function moveFrom(dt,actor,clock,width,height){
  player=actor;combatClock=clock;cw=width;ch=height;
  state.waterArcs=(state.waterArcs??[]).filter(arc=>(arc.life-=dt)>0);
  updateWebs(dt);updateStorm(dt);updateBolts(dt);updatePlates(dt);updateEnemyHazards(dt);
 }
 function act(e,dt,actor,clock,width,height){
  player=actor;combatClock=clock;cw=width;ch=height;updateEnemy(e,dt);
 }
function moveEnemy(e,dx,dy){
 const {x,y}=e;
 moveActor(e,dx,dy);
 const moved=Math.hypot(e.x-x,e.y-y);
 if(moved<=.05)return;
 e.facing=Math.atan2(e.y-y,e.x-x);e.moving=true;
 const movement=movementCues[enemyRules.attacks[e.type].id];
 if(!movement)return;
 const [cue,stride,gain,cooldown]=movement;
 e.audioStride=(e.audioStride??0)+moved;
 if(e.audioStride>=stride){
  e.audioStride%=stride;
  soundWorld(cue,e,{gain,cooldown});
 }
}
function aimEnemy(e,angle){e.angle=angle;e.facing=angle;}
function updateEnemy(e,dt){
 const labRat=e.bossRole==='rat'&&regionAt(player.x,player.y)===floor.bossArena?.id;
 if(!e.veilPhase&&!labRat&&!enemyEncounterReady(e)){
  e.phase+=dt;e.hit=Math.max(0,e.hit-dt);e.emerge=Math.max(0,(e.emerge||0)-dt);
  e.windup=0;e.runAttack=0;e.track=0;e.aggro=Math.max(0,(e.aggro||0)-dt);e.moving=false;
  e.batMove=null;e.lionMove=null;e.dogMove=null;e.ratMotion=null;e.called=0;
  return;
 }
 if(floor.layerAt(e.x,e.y)!==floor.layerAt(player.x,player.y)&&
    !(floor.stairConnected(e,player)&&!gateLineBlocked(e.x,e.y,player.x,player.y))){
  if(e.veilPhase)updateOrc(e,dt,false);
  else{e.phase+=dt;e.aggro=Math.max(0,(e.aggro||0)-dt);}
  const stairs=floor.stairsFor(e,player);
  e.windup=0;e.runAttack=0;e.moving=false;
  if(!stairs)return;
  if(!stairs.continuous&&Math.hypot(e.x-stairs.x,e.y-stairs.y)<23){
   Object.assign(e,stairs.exit);e.route=null;e.routeGoal=null;
  }else pursue(e,dt,Math.max(76,enemyRules.attacks[e.type].speed),!gateLineBlocked(e.x,e.y,stairs.x,stairs.y),stairs);
  return;
 }
 if(isBat(e)){updateBat(e,dt);return;}
 if(isLion(e)){updateLion(e,dt);return;}
 if(enemyRules.isOrc(e)){updateOrc(e,dt);return;}
 if(e.type===STREET_DOG){updateDog(e,dt);return;}
 const spec=enemyRules.attacks[e.type];
 if(e.emerge>0){e.emerge=Math.max(0,e.emerge-dt);return;}
 e.phase+=dt;e.hit=Math.max(0,e.hit-dt);e.attack-=dt;e.moving=false;
 const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const range=eyeRange(e,angle);
 const line=d<range*1.22&&!gateLineBlocked(e.x,e.y,player.x,player.y,e.type===EAGLE);
 const spotted=line&&d<=range;
 if(spotted||labRat)enemyRules.alert(e);
 else e.aggro=Math.max(0,(e.aggro||0)-dt);
 if(spotted&&e.boss&&!e.audioEntered&&d<330){
  e.audioEntered=soundWorld('boss_enter',e,{priority:2,cooldown:1.05,gain:.82})||false;
 }
 const clear=line&&e.aggro>0;
 if(e.type===RAT){
  e.ratJumpCooldown=Math.max(0,(e.ratJumpCooldown||0)-dt);
  e.ratDodgeCooldown=Math.max(0,(e.ratDodgeCooldown||0)-dt);
  e.ratStalking=false;
  // Travel only through moveActor: no jumps through room collision.
  if(e.ratMotion?.time>0){
   const motion=e.ratMotion,side=motion.name==='dodge-left'?-1:1;
   const direction=motion.name==='jump'?motion.angle:
    motion.angle+side*Math.PI*.5;
   const step=(motion.speed??158)*Math.min(dt,motion.time);
   moveEnemy(e,Math.cos(direction)*step,Math.sin(direction)*step);
   e.facing=motion.name==='jump'?motion.angle:angle;
   motion.time=Math.max(0,motion.time-dt);
   if(!motion.time)e.ratMotion=null;
   return;
  }
 }
 if(!e.skeleton&&e.type!==SNAKE&&e.type!==RAT&&e.type!==ELECTRO_RAT&&e.type!==EAGLE&&clear&&nearActor(e,player,5)&&!(e.runAttack>0)&&!furnitureBetween(e.x,e.y,player.x,player.y))damageActive(origin(e,'Nahkampftreffer'),9+(e.boss?5:0),items.foeAttack[e.type]);
 if(e.runAttack>0){
  if(e.type===RAT){
   const combo=e.ratAttackClip==='combo',duration=e.runDuration||.42;
   const elapsed=duration-e.runAttack,after=elapsed+dt;
   const contacts=combo?[.10,.47]:[.17];
   for(let i=e.ratHits||0;i<contacts.length;i++){
    if(after<contacts[i])break;
    e.ratHits=i+1;
    if(!clear||d>spec.range+15||Math.cos(angle-e.angle)<.48||
       gateLineBlocked(e.x,e.y,player.x,player.y))continue;
    const amount=combo?(i===0?4:5):7;
    if(!strikeCover(e,amount)&&damageActive(origin(e,combo?'Doppelbiss':'Biss'),amount,{physical:1})){
     // The normal .75 s hero i-frame would silently nullify bite #2.
     // A combo's first contact grants a shorter .31 s reaction window.
     if(combo&&i===0)player.inv=Math.min(player.inv||0,.31);
     if(!combo||i===contacts.length-1)bleedActive(e,31);
    }
   }
   e.runAttack=Math.max(0,e.runAttack-dt);
   if(!e.runAttack){
    recover(e,spec.recovery);
    ratPostAttack(e,angle);
   }
   return;
  }
  if(spec.id==='charge'||spec.id==='rift'||spec.id==='grab'||spec.id==='bite'||spec.id==='eagle'){advanceRush(e,spec,dt,angle);return;}
  if(['web','frost','bow','crossbow','electrode','rat-bite'].includes(spec.id)){
   e.runAttack=Math.max(0,e.runAttack-dt);
   if(!e.runAttack)recover(e,spec.recovery);
   return;
  }
  e.runAttack=Math.max(0,e.runAttack-dt);
  if(!e.struck&&e.runAttack<e.runDuration*.52){
   e.struck=true;
   const facing=Math.cos(angle-e.angle)>.55;
   if(clear&&d<(e.skeleton?63:117)&&facing&&!strikeCover(e,19)&&damageActive(origin(e,e.skeleton?'Säbelhieb':'Sensenhieb'),19,{physical:.65,dark:.35})&&player.inv<1){
    if((player.bleedCooldown||0)<=0){player.bleedCooldown=3;damageActive(origin(e,'Blutverlust'),api.maxHP(player)*.07,{bleed:1},true);}
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
 if(!e.aggro)return;
 if(e.type===RAT){
  updateRat(e,dt,spec,d,angle,clear);
  return;
 }
 if(clear&&e.attack<=0&&d<(e.skeleton==='sabre'?60:spec.range)&&(e.type!==SNAKE||!furnitureBlocked((e.x+player.x)/2,(e.y+player.y)/2,8))){
  e.windup=spec.windup;aimEnemy(e,angle);e.target={x:player.x,y:player.y};
  if(windupCue[spec.id])soundWorld(windupCue[spec.id],e,{priority:2,cooldown:.18,gain:.77});
  if(spec.id==='frost'){
   e.frostTargets=frostSites(e);
   soundWorld('element_frost_cast',e,{priority:2,cooldown:.25});
  }
  return;
 }
 // Archers should not stand immobile while a swordsman closes the gap.
 // Reposition only after the shot, not during the telegraphed draw/release.
 if(e.skeleton==='bow'&&clear&&d<115&&e.attack>0){
  const backward=Math.atan2(e.y-player.y,e.x-player.x);
  const pace=Math.min((spec.speed+(e.boss?7:0))*dt*.85,Math.max(0,150-d));
  moveEnemy(e,Math.cos(backward)*pace,Math.sin(backward)*pace);
  return;
 }
 if(nearActor(e,player,1)||clear&&(spec.id==='bow'||spec.id==='crossbow')&&d<spec.range*.72)return;
 const speed=(spec.speed+(e.boss?7:0))*(1+.075*(save.floor-1));
 pursue(e,dt,speed,clear);
}

// Cautious animal AI: preferred distance, orbiting, hesitation, short
// commitment to a bite, and a variable retreat after each completed attack.
const ratRoll=()=>Math.max(0,Math.min(.999999,rand(0,1)));
function ratState(e,name,min,max=min){
 e.ratState=name;e.ratStateTime=min+(max-min)*ratRoll();
}
function ratWalk(e,heading,speed,dt,look=heading){
 const x=e.x,y=e.y;
 moveEnemy(e,Math.cos(heading)*speed*dt,Math.sin(heading)*speed*dt);
 aimEnemy(e,look);
 return Math.hypot(e.x-x,e.y-y)>1;
}
function ratHop(e,name,angle,speed,duration,next='watch'){
 e.ratMotion={name,time:duration,duration,angle,speed};
 ratState(e,next,.34,.82);
}
function ratPostAttack(e,angle){
 // A bite never triggers an immediate second attack outside the actual
 // two-contact combo window; the cooldown continues during the retreat.
 const choice=ratRoll();
 if(choice<.44){
  ratHop(e,'jump',angle+Math.PI,175,.28,'watch');
 }else if(choice<.71){
  ratState(e,'withdraw',.34,.62);
 }else if(choice<.89){
  const name=ratRoll()<.5?'dodge-left':'dodge';
  ratHop(e,name,angle,165,.28,'circle');
  e.ratCircleSign=name==='dodge-left'?-1:1;
 }else ratState(e,'watch',.42,.84);
 e.ratJumpCooldown=Math.max(e.ratJumpCooldown||0,1.1);
}
function updateRat(e,dt,spec,d,angle,clear){
 if(!Number.isFinite(e.ratPreferred))
  e.ratPreferred=96+36*ratRoll();
 if(!e.ratState)ratState(e,d<=spec.range+7?'commit':'watch',.18,.55);
 e.ratStateTime=Math.max(0,(e.ratStateTime||0)-dt);
 if(!clear){
  e.ratStalking=e.aggro>0;
  if(e.aggro>0&&d>e.ratPreferred+24)
   pursue(e,dt,spec.speed*.65,false);
  return;
 }
 aimEnemy(e,angle);
 if(e.hit>0&&d<170&&e.ratDodgeCooldown<=0){
  ratHop(e,ratRoll()<.5?'dodge-left':'dodge',angle,160,.29,'watch');
  e.ratDodgeCooldown=2.5;
  return;
 }
 // An opening hop stops near the standoff ring, rather than at the player.
 if(d>105&&d<155&&e.ratJumpCooldown<=0&&!e.ratDidOpeningHop){
  const duration=.32;
  const speed=Math.max(60,Math.min(155,(d-e.ratPreferred*.92)/duration));
  ratHop(e,'jump',angle,speed,duration,'watch');
  e.ratDidOpeningHop=true;e.ratJumpCooldown=3.1;return;
 }
 if(e.ratState==='commit'){
  if(e.attack>0){ratState(e,'watch',.26,.60);return;}
  if(d<=spec.range+7){
   // Last sniff/anticipation is readable before the charge is committed.
   if(e.ratStateTime>0)return;
   e.windup=spec.windup;aimEnemy(e,angle);e.target={x:player.x,y:player.y};
   ratState(e,'watch',.4,.9);
   return;
  }
  e.ratStalking=d>spec.range+24;
  ratWalk(e,angle,spec.speed*(d>90?.88:.69),dt);
  return;
 }
 if(e.ratState==='withdraw'){
  if(d<e.ratPreferred+12)
   ratWalk(e,angle+Math.PI,spec.speed*.81,dt,angle);
  if(e.ratStateTime<=0||d>e.ratPreferred+24)
   ratState(e,'watch',.22,.7);
  return;
 }
 if(e.ratState==='circle'){
  const side=e.ratCircleSign||1;
  const correction=d<e.ratPreferred-18?-.44:d>e.ratPreferred+18?.27:0;
  ratWalk(e,angle+side*(Math.PI*.5+correction),
   spec.speed*.51,dt,angle);
  if(e.ratStateTime<=0)ratState(e,'watch',.24,.72);
  return;
 }
 if(e.ratState==='stalk'){
  e.ratStalking=true;
  if(d>e.ratPreferred+5)ratWalk(e,angle,spec.speed*.54,dt);
  if(d<=e.ratPreferred+5||e.ratStateTime<=0)
   ratState(e,'watch',.3,.83);
  return;
 }
 // Hold distance instead of running permanently to d=0.
 if(d<e.ratPreferred-25&&e.attack>0)
  ratWalk(e,angle+Math.PI,spec.speed*.46,dt,angle);
 else if(d>e.ratPreferred+62){
  e.ratStalking=true;
  pursue(e,dt,spec.speed*.76,clear);
 }else if(d>e.ratPreferred+18){
  e.ratStalking=true;
  ratWalk(e,angle,spec.speed*.43,dt);
 }
 if(e.ratStateTime>0)return;
 if(e.attack<=0&&d<spec.range+8){
  ratState(e,'commit',.10,.24);return;
 }
 const choice=ratRoll();
 if(e.attack<=0&&d<e.ratPreferred+26&&choice<.35){
  ratState(e,'commit',.08,.3);
 }else if(choice<.69){
  e.ratCircleSign=ratRoll()<.5?-1:1;
  ratState(e,'circle',.30,.85);
 }else if(choice<.86&&d>e.ratPreferred){
  ratState(e,'stalk',.35,.9);
 }else ratState(e,'watch',.24,.9);
}

function updateOrc(e,dt,sameLayer=true){
 const spec=enemyRules.attacks[e.type];
 e.phase+=dt;e.hit=Math.max(0,e.hit-dt);e.attack-=dt;e.moving=false;
 const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const clear=sameLayer&&d<Math.min(470*(floor.sightScale?.(e.x,e.y)??1),eyeRange(e,angle))&&!gateLineBlocked(e.x,e.y,player.x,player.y);
 if(clear)enemyRules.alert(e);
 else e.aggro=Math.max(0,(e.aggro||0)-dt);
 if(e.veilPhase){
  e.veilTime=Math.max(0,e.veilTime-dt);
  if(e.veilPhase==='turn'&&!e.veilTime){e.veilPhase='hidden';e.veilTime=6;}
  else if(e.veilPhase==='hidden'){
   if(!e.veilTime){e.veilPhase='strike';e.veilTime=.36;e.struck=false;aimEnemy(e,angle);}
   else if(sameLayer&&d>49)pursue(e,dt,spec.speed,clear);
  }else if(e.veilPhase==='strike'){
   if(!e.struck&&e.veilTime<=.16){
    e.struck=true;
    if(d<spec.range&&clear&&Math.cos(angle-e.angle)>.45&&!strikeCover(e,34)&&damageActive(origin(e,'Hinterhalt mit Krummesser'),34,{physical:1},false,undefined,'hit_cut','crit'))bleedActive(e,100);
   }
   if(!e.veilTime){e.veilPhase=null;e.attack=6;recover(e,spec.recovery);}
  }
  return;
 }
 if(e.recover>0){e.recover=Math.max(0,e.recover-dt);return;}
 if(clear&&e.attack<=0){aimEnemy(e,angle);e.veilPhase='turn';e.veilTime=spec.windup;return;}
 if(e.aggro>0&&!nearActor(e,player,3))pursue(e,dt,spec.speed*.76,clear);
}
function dogStep(e,angle,distance){
 const clearance=actorRadius(e);
 return [.4,.75,1].every(t=>valid(e.x+Math.cos(angle)*distance*t,e.y+Math.sin(angle)*distance*t,clearance));
}
function dodgeDog(e,angle){
 if(e.type!==STREET_DOG||e.hp<=0||e.fall||e.dodgeCooldown>0||rand(0,1)>=.22||!dogStep(e,angle,39))return false;
 const from={x:e.x,y:e.y};
 moveActor(e,Math.cos(angle)*23,Math.sin(angle)*23);
 if(Math.hypot(e.x-from.x,e.y-from.y)<12)return false;
 enemyRules.alert(e);
 e.dodgeCooldown=2.4;e.windup=0;e.runAttack=0;
 e.dogMove={kind:'retreat',stage:'jump',age:0,angle,lift:0};
 return true;
}
function dogBite(e,second){
 const spec=enemyRules.attacks[e.type];
 e.runAttack=e.runDuration=.17;
 soundWorld('hit_body',e,{gain:.48,priority:2,cooldown:.1});
 const angle=Math.atan2(player.y-e.y,player.x-e.x),d=Math.hypot(player.x-e.x,player.y-e.y);
 if(d>spec.range||Math.cos(angle-e.angle)<.48||gateLineBlocked(e.x,e.y,player.x,player.y)||strikeCover(e,11))return;
 if(damageActive(origin(e,second?'Zweiter Biss':'Sprungbiss'),e.dogMove.kind==='double'?8:11,{physical:1}))bleedActive(e,12);
}
function updateDog(e,dt){
 const spec=enemyRules.attacks[e.type];
 e.phase+=dt;e.hit=Math.max(0,e.hit-dt);e.attack-=dt;e.moving=false;
 e.dodgeCooldown=Math.max(0,(e.dodgeCooldown??0)-dt);
 e.runAttack=Math.max(0,(e.runAttack??0)-dt);
 const distance=Math.hypot(player.x-e.x,player.y-e.y),angle=Math.atan2(player.y-e.y,player.x-e.x);
 const clear=distance<=eyeRange(e,angle)&&!gateLineBlocked(e.x,e.y,player.x,player.y);
 if(clear)enemyRules.alert(e);
 else e.aggro=Math.max(0,(e.aggro||0)-dt);
 const move=e.dogMove;
 if(move){
  move.age+=dt;
  if(move.stage==='windup'){
   e.windup=Math.max(0,.21-move.age);
   aimEnemy(e,angle);
   if(e.windup)return;
   Object.assign(move,{stage:'jump',age:0,angle});
   return;
  }
  if(move.stage==='jump'){
   const attack=move.kind==='combo'||move.kind==='double',duration=attack?.22:.24;
   const progress=Math.min(1,move.age/duration),speed=attack?330:move.kind==='side'?247:112;
   move.lift=Math.sin(Math.PI*progress)*(attack?22:14);
   moveEnemy(e,Math.cos(move.angle)*speed*dt,Math.sin(move.angle)*speed*dt);
   aimEnemy(e,attack?move.angle:angle);
   if(progress<1)return;
   if(!attack){e.dogMove=null;e.attack=move.kind==='side'?.16:.34;return;}
   dogBite(e,move.hits>0);
   move.hits++;move.stage='bite';move.age=0;
   return;
  }
  if(move.age<.23)return;
  if(move.hits===1&&move.kind==='combo'){
   Object.assign(move,{stage:'windup',age:.07});return;
  }
  if(move.hits===1&&move.kind==='double'){
   moveEnemy(e,Math.cos(angle)*12,Math.sin(angle)*12);
   aimEnemy(e,angle);dogBite(e,true);move.hits++;move.age=0;return;
  }
  e.dogMove=null;e.attack=.82;recover(e,spec.recovery);return;
 }
 if(e.recover>0){e.recover=Math.max(0,e.recover-dt);return;}
 if(clear&&e.attack<=0&&distance<=126){
  const roll=rand(0,1);
  if(distance>65&&roll<.23){
   const side=rand(0,1)<.5?1:-1;
   for(const sign of [side,-side]){
    const flank=angle+sign*Math.PI*.47;
    if(!dogStep(e,flank,54))continue;
    e.dogMove={kind:'side',stage:'jump',age:0,angle:flank,lift:0};return;
   }
  }
  e.dogMove={kind:roll>.68?'double':'combo',stage:'windup',age:0,angle,hits:0,lift:0};
  aimEnemy(e,angle);return;
 }
 if(e.aggro>0&&!nearActor(e,player,2))pursue(e,dt,spec.speed,clear);
}
function executeEnemyAttack(e,spec){
 e.attack=(e.boss?2.25:2.85)-(save.floor-1)*.12;
 if(e.type===RAT){
  // Distinct bite and double-bite actions, each with timed, avoidable contacts.
  e.ratComboIndex=(e.ratComboIndex||0)+1;
  const combo=e.ratComboIndex%3===0;
  e.ratAttackClip=combo?'combo':'bite';
  e.ratHits=0;
  e.runDuration=e.runAttack=combo?.68:.42;
  return;
 }
 if(e.type===ELECTRO_RAT){
  const electric=true,amount=16;
  const split=electric?{physical:.3,lightning:.7}:{physical:1};
  const dx=player.x-e.x,dy=player.y-e.y;
  const hit=Math.hypot(dx,dy)<spec.range+11&&Math.cos(Math.atan2(dy,dx)-e.angle)>.5&&
   !gateLineBlocked(e.x,e.y,player.x,player.y);
  const hitHero=hit&&!strikeCover(e,amount);
  if(hitHero&&damageActive(origin(e,electric?'Elektrodenstoß':'Biss'),amount,split)&&!electric)bleedActive(e,31);
  if(electric){
   soundWorld('element_lightning_charge',e,{gain:.66,priority:2,cooldown:.17});
   shockWater(e,hitHero?player:null,split,amount,e);
  }
  e.runDuration=e.runAttack=.28;
  return;
 }
 const durations={charge:1.1,rift:.74,reap:.36,grab:.38,bite:.25,eagle:.65};
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
  for(const point of e.frostTargets||frostSites(e))state.enemyHazards.push({...point,radius:23,life:1.75,wait:.33,type:'frost',power:20,origin:origin(e,'Frostfeld')});
 }
}
function advanceRush(e,spec,dt,targetAngle){
 if(e.track>0){e.angle=enemyRules.turn(e.angle,targetAngle,dt*2.3);e.track-=dt;}
 const oldX=e.x,oldY=e.y,speed=({charge:252,rift:222,grab:211,bite:170,eagle:406})[spec.id];
 const dx=Math.cos(e.angle)*speed*dt,dy=Math.sin(e.angle)*speed*dt;
 if(strikeCover(e,{charge:30,rift:23,grab:14,bite:8,eagle:23}[spec.id],e.x+dx,e.y+dy,actorRadius(e))){
  e.runAttack=0;recover(e,spec.recovery);return;
 }
 moveEnemy(e,dx,dy);
 e.runAttack=Math.max(0,e.runAttack-dt);
 if(Math.hypot(e.x-oldX,e.y-oldY)<speed*dt*.2)e.runAttack=0;
 if(spec.id==='rift'){
  e.trailTimer-=dt;
  if(e.trailTimer<=0){e.trailTimer=.12;state.enemyHazards.push({x:oldX,y:oldY,radius:25,life:3.9,wait:0,angle:e.angle,type:'dark',power:8,origin:origin(e,'Dunkle Spur')});}
 }
 if(!e.struck&&nearActor(e,player,9)&&!gateLineBlocked(e.x,e.y,player.x,player.y,e.type===EAGLE)){
  const dark=spec.id==='rift';
  const damage=spec.id==='bite'?5:spec.id==='grab'?13:spec.id==='eagle'?23:21;
  const rushName={charge:'Ansturm',rift:'Dunkler Ansturm',grab:'Griff',bite:e.fireSnake?'Feuerbiss':'Biss',eagle:'Sturzflug'}[spec.id];
  const impactSource=origin(e,rushName);
  e.struck=damageActive(impactSource,e.fireSnake?8:damage,e.fireSnake?{fire:1}:dark?{dark:1}:e.type===FROST_ZOMBIE?{frost:1}:{physical:1});
  if(e.struck&&player.inv<1){
   if(spec.id==='eagle')knockHero(player,Math.cos(e.angle)*92,Math.sin(e.angle)*92,impactSource);
   if(spec.id==='grab'){player.grabSlow=1.4;player.stamina=Math.max(0,player.stamina-18);}
   if(spec.id==='bite'&&!e.fireSnake&&!player.poison)poison(player,{untilTick:.72,ticks:3,origin:origin(e,'Giftwirkung')});
  }
 }
 if(e.runAttack<=0)recover(e,spec.recovery);
}
function frostSites(e){
 return [-34,0,34].map(offset=>({
  x:e.target.x-Math.sin(e.angle)*offset,y:e.target.y+Math.cos(e.angle)*offset
 })).filter(p=>valid(p.x,p.y,4)&&!gateLineBlocked(e.x,e.y,p.x,p.y));
}
// Route around walls and solid props when the direct approach is blocked.
function pursue(e,dt,speed,clear,goal=player){
 const radius=actorRadius(e),distance=Math.hypot(goal.x-e.x,goal.y-e.y);
 const a=Math.atan2(goal.y-e.y,goal.x-e.x),check=Math.min(distance,22);
 let target=goal;
 if(!clear||!valid(e.x+Math.cos(a)*check,e.y+Math.sin(a)*check,radius,false,false,e.type===EAGLE)){
  const tile=Math.floor(goal.y/TILE)*W+Math.floor(goal.x/TILE);
  e.routeDelay=(e.routeDelay||0)-dt;
  if(e.routeGoal!==tile||e.routeDelay<=0||e.route&&Math.hypot(e.x-e.route.x,e.y-e.route.y)<5){
   e.route=e.skeleton&&api.skeletonRoute?api.skeletonRoute(e,goal):findStep(e,goal,radius);e.routeGoal=tile;e.routeDelay=e.route ? .34 : .55;
  }
  if(!e.route)return;
  target=e.route;
 }
 const angle=Math.atan2(target.y-e.y,target.x-e.x);
 const stride=Math.min(speed*dt,Math.hypot(target.x-e.x,target.y-e.y));
 aimEnemy(e,angle);moveEnemy(e,Math.cos(angle)*stride,Math.sin(angle)*stride);
}
const neighbors=[[1,0],[-1,0],[0,1],[0,-1]];
function findStep(e,target,radius,limit=850){
 const start=Math.floor(e.y/TILE)*W+Math.floor(e.x/TILE);
 const goal=Math.floor(target.y/TILE)*W+Math.floor(target.x/TILE);
 const frontier=[start],steps=new Map([[start,start]]);
 const center=id=>({x:(id%W+.5)*TILE,y:(Math.floor(id/W)+.5)*TILE});
 for(let i=0;i<frontier.length&&i<limit;i++){
  const id=frontier[i],point=center(id);
  if(id===goal||Math.hypot(point.x-target.x,point.y-target.y)<TILE&&
   !gateLineBlocked(point.x,point.y,target.x,target.y)){
   if(id===start)return target;
   return center(steps.get(id));
  }
  for(const [dx,dy] of neighbors){
   const x=id%W+dx,y=Math.floor(id/W)+dy,n=y*W+x;
   if(x<0||x>=W||y<0||y>=H||steps.has(n))continue;
   const p=center(n);
   if(inRest(p.x,p.y)||!valid(p.x,p.y,radius)||
    !valid((p.x+point.x)/2,(p.y+point.y)/2,radius))continue;
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
    if(damageActive(hazard.origin,hazard.power,{[hazard.type]:1},false,enemyDepth,hazard.type==='frost'?'':undefined)&&hazard.type==='frost'){
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
  const left=p.angle===0,sign=left?-1:1;
  const roomActors=coopActors().filter(hero=>regionAt(hero.x,hero.y)===p.region);
  const limits=(roomActors.length?roomActors:[player]).map(hero=>{
   const width=hero.input?.viewWidth??cw;
   const scroll=Math.max(0,Math.min(W*TILE-width,hero.x-width/2));
   return left?scroll:scroll+width;
  });
  const from=(left?Math.min(p.origin.x,...limits):Math.max(p.origin.x,...limits))+sign*72;
  soundWorld('temple_trap_release',p.origin,{priority:3,cooldown:.12});
  const speed=940;
  state.bolts.push({x:from,y:p.y,angle:p.angle,speed,life:p.range/speed,type:'trap',entryX:p.origin.x,laneRegion:p.region,
   approach:.34,origin:{source:'Tempelfalle',action:'Giftpfeil'}});
 }
}
function updateLion(e,dt){
 const spec=enemyRules.attacks[e.type];
 e.phase+=dt;e.hit=Math.max(0,e.hit-dt);e.attack-=dt;e.moving=false;
 const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const clear=d<=eyeRange(e,angle)&&!gateLineBlocked(e.x,e.y,player.x,player.y);
 if(clear)enemyRules.alert(e);
 e.called=Math.max(0,(e.called||0)-dt);
 if(!clear)e.aggro=Math.max(e.called,(e.aggro||0)-dt);
 const move=e.lionMove;
 if(move){
  move.age+=dt;
  if(move.age<move.windup)return;
  const t=move.age-move.windup;
  if(move.kind==='leap'&&t<.35){
   if(!move.audioStarted){move.audioStarted=true;soundWorld('lion_leap',e,{priority:2,cooldown:.17});}
   const dx=Math.cos(move.angle)*270*dt,dy=Math.sin(move.angle)*270*dt;
   if(strikeCover(e,22,e.x+dx,e.y+dy,actorRadius(e))){
    move.landed=true;move.age=move.windup+.35;
   }else moveEnemy(e,dx,dy);
   if(!move.landed&&nearActor(e,player,11)&&!strikeCover(e,16)&&damageActive(origin(e,'Sprungangriff'),e.type===LION?16:13,{physical:1}))move.landed=true;
  }else if(move.kind==='leap'&&!move.landingPlayed){
   move.landingPlayed=true;soundWorld('lion_paw',e,{gain:.77,priority:2,rate:.88});
  }else if(move.kind==='rake'&&t<lionRake.duration){
   if(t>=move.next){
    const swipeAngle=move.angle+(move.swipes%2===0?.22:-.22);
    move.swipes++;move.next+=lionRake.pace;
    soundWorld('lion_claw_source',e,{group:'lion-rake',gain:.71,cooldown:.115});
    move.last={time:t,angle:swipeAngle};
    const reach=lionRake.reach+(e.type===LION?7:0);
    if(d<reach&&Math.cos(angle-swipeAngle)>Math.cos(lionRake.spread)&&!gateLineBlocked(e.x,e.y,player.x,player.y)&&
     !strikeCover(e,13)&&damageActive(origin(e,'Prankenhieb'),5,{physical:1},true,1+(save.floor-1)*.28))bleedActive(e,lionRake.bleed);
   }
  }else if(move.kind==='roar'&&!move.called){
   move.called=true;e.roarCooldown=8;
   soundWorld('lion_roar',e,{priority:3,cooldown:.50});
   const ally=nearestLion(e);
   if(ally){enemyRules.alert(ally);ally.called=9;}
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
 if(e.aggro>0)pursue(e,dt,spec.speed,clear);
}
function updateBat(e,dt){
 const spec=enemyRules.attacks[e.type],lightning=e.type===STORM_BAT;
 e.phase+=dt;e.hit=Math.max(0,e.hit-dt);e.attack-=dt;e.moving=false;
 const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const clear=d<=eyeRange(e,angle)&&!gateLineBlocked(e.x,e.y,player.x,player.y);
 if(clear)enemyRules.alert(e);
 if(!clear)e.aggro=Math.max(0,(e.aggro||0)-dt);
 const move=e.batMove;
 if(move){
  move.age+=dt;
  if(move.age<spec.windup){
   if(clear&&move.age<spec.windup*.4)aimEnemy(e,enemyRules.turn(e.angle,angle,dt*4));
   return;
  }
  const age=move.age-spec.windup;
  if(!move.audioStarted){
   move.audioStarted=true;
   if(lightning)soundWorld('element_lightning_beam',e,{priority:2,cooldown:.26});
   else soundWorld('element_fire_cone',e,{gain:.78,priority:2,cooldown:.30,variation:0});
  }
  if(age<move.duration&&age>=move.next){
   move.next+=lightning?.23:.28;
   const forward=dx*Math.cos(e.angle)+dy*Math.sin(e.angle);
   const side=Math.abs(dy*Math.cos(e.angle)-dx*Math.sin(e.angle));
   if(forward>0&&forward<e.castLength&&side<(lightning?15:18+forward*.52)&&!gateLineBlocked(e.x,e.y,player.x,player.y)){
    damageActive(origin(e,lightning?'Blitzstrahl':'Feueratem'),lightning?4:6,{[lightning?'lightning':'fire']:1},true);
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
  pursue(e,dt,spec.speed,false,e.fleeGoal);
  if(Math.hypot(e.fleeGoal.x-e.x,e.fleeGoal.y-e.y)<14)e.fleeTime=0;
  return;
 }
 if(!clear){
  if(e.aggro>0)pursue(e,dt,spec.speed,false);
  return;
 }
 if(e.attack<=0&&d<spec.range){
  aimEnemy(e,angle);
  e.castLength=spec.range;
  e.batMove={age:0,next:0,duration:lightning?.93:.71};
  soundWorld('bat_voice',e,{gain:.55,cooldown:.28});
  soundWorld(lightning?'element_lightning_charge':'element_fire_cast',e,{priority:2,cooldown:.26});
  return;
 }
 if(d<43){damageActive(origin(e,'Biss'),4,{physical:1});return;}
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
  for(const actor of coopActors())if(nearBolt(actor))asHero(actor,()=>damageActive({source:'Gewitter',action:'Blitzeinschlag'},12,{lightning:1}));
  burst(strike.x,strike.y,'#c2dcff',24);
 }
 state.stormStrikes=state.stormStrikes.filter(strike=>strike.age<1.45);
}
function nearestLion(e){
 let best=null,distance=Infinity;
 for(const other of getEnemies()){
  if(other===e||other.hp<=0||!isLion(other))continue;
  const gap=Math.hypot(other.x-e.x,other.y-e.y);
  if(gap<distance){best=other;distance=gap;}
 }
 return best;
}
function fireBolt(e,type){
 soundWorld(type==='bow'?'bow_release':'crossbow_release',e,{gain:.86,priority:2,cooldown:.08});
 const speed=type==='bow'?330:445;
 if(e.skeleton==='bow'){
  const dx=Math.cos(e.angle),dy=Math.sin(e.angle);
  const lead=api.arrowGroundClear(e.x+dx*12,e.y+dy*12)?12:0;
  const x=e.x+dx*lead,y=e.y+dy*lead;
  const gravity=240,z=40,targetTime=Math.max(.14,Math.hypot(e.target.x-x,e.target.y-y)/speed);
  const vz=(24-z)/targetTime+.5*gravity*targetTime;
  state.bolts.push({x,y,z,vz,gravity,angle:e.angle,speed,type,
   life:(vz+Math.sqrt(vz*vz+2*gravity*z))/gravity,origin:origin(e,'Pfeil')});
  return;
 }
 state.bolts.push({x:e.x,y:e.y,angle:e.angle,speed,life:1.23,type:e.type===FROST_CROSSBOW?'frost-crossbow':type,
  origin:origin(e,e.type===FROST_CROSSBOW?'Frostbolzen':type==='bow'?'Pfeil':'Armbrustbolzen')});
}
function updateBolts(dt){
 state.bolts=state.bolts.filter(p=>{
  if(p.life<=0)return false;
  let flightTime=dt;
  if(p.approach>0){
   const elapsed=Math.min(flightTime,p.approach);
   p.x+=(p.entryX-p.x)*elapsed/p.approach;
   p.approach-=elapsed;flightTime-=elapsed;
   if(flightTime<=0)return true;
  }
  const elapsed=Math.min(flightTime,p.life),travel=p.speed*elapsed;
  p.life-=flightTime;
  const dx=Math.cos(p.angle)*travel,dy=Math.sin(p.angle)*travel;
  const steps=Math.max(1,Math.ceil(travel/5));
  for(let i=0;i<steps;i++){
   const x=p.x+dx/steps,y=p.y+dy/steps;
   const approaching=p.type==='trap'&&(p.angle===0?x<p.entryX:x>p.entryX);
   if(p.gravity){
    if(!api.arrowGroundClear(x,y))return false;
    const step=elapsed/steps;
    p.z+=p.vz*step-.5*p.gravity*step*step;p.vz-=p.gravity*step;
   }else if(!approaching&&(inRest(x,y)||wall(x,y)||gateBlocked(x,y)||floor.doorAt(x,y)))return false;
   const prop=!approaching&&furnitureAt(x,y,2);
   if(prop){
    hitFurniture?.(prop,p.type==='bow'?11:p.type==='trap'?10:16,p.angle);
    return false;
   }
   p.x=x;p.y=y;
   if(approaching)continue;
   if(!p.audioPassed&&Math.hypot(p.x-player.x,p.y-player.y)<146){
    p.audioPassed=true;
    soundWorld('bolt_fly',p,{group:'projectile-pass',cooldown:.09,priority:2,rate:p.type==='trap'?1.19:1});
   }
   const target=coopActors().find(hero=>hero.dash<=0&&Math.hypot(p.x-hero.x,p.y-hero.y)<13&&
    (!p.gravity||(p.z>=api.arrowTargetHeight(hero)&&p.z<=api.arrowTargetHeight(hero)+52)));
   if(target){
    const damage=p.type==='trap'?10:p.type==='bow'?11:16;
    const split=p.type==='trap'?{physical:.70,poison:.30}:p.type==='crossbow'?{physical:.75,dark:.25}:p.type==='frost-crossbow'?{frost:1}:{physical:1};
    asHero(target,()=>{
     if(!damageActive(p.origin,damage,split,false,undefined,undefined,undefined,p.angle))return;
     if(p.type==='trap'&&!player.poison)poison(player,{untilTick:.67,ticks:2,power:.55,origin:{source:'Tempelfalle',action:'Giftwirkung'}});
    });
    return false;
   }
  }
  if(p.life>0)return true;
  landArrow?.(p);
  return false;
 });
}
function fireWeb(e){
 soundWorld('enemy_spider_web',e,{gain:.85,priority:2,cooldown:.12});
 const speed=184+save.floor*12;
 state.webShots.push({x:e.x,y:e.y,vx:Math.cos(e.angle)*speed,vy:Math.sin(e.angle)*speed,life:1.45,origin:origin(e,'Netzgeschoss')});
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
   const landing=blocked?{x:p.x,y:p.y}:{x,y};
   if(!blocked||valid(landing.x,landing.y,3)){
    state.webPatches.push({...landing,radius:29,life:7});
    soundWorld('enemy_spider_web_land',landing,{gain:.72,priority:2,cooldown:.12});
   }
   if(hit)asHero(hit,()=>{player.webSlow=2.4;if(damageActive(p.origin,4,{dark:1})&&player.inv<1&&!player.poison)poison(player,{untilTick:.72,ticks:3,origin:{source:p.origin?.source??'Spinne',action:'Giftwirkung'}});});
   return false;
  }
  p.x=x;p.y=y;return true;
 });
}
return {act,moveFrom,dodgeDog,stormTimer(value){if(Number.isFinite(value))stormDelay=value;return stormDelay;}};
}
root.DungeonEnemySim={create,lionRake};
})(typeof window==='undefined'?globalThis:window);
