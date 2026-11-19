import {randomUUID} from 'node:crypto';
import {run,balance,items,foes,geometry,vision,enemySim,bossRules,TILE,HERO_RADIUS,fallSeconds,round,clamp,gap,remaining,normalAngle,maxHP,preparePlayer,selectLoot,cup,pools} from './rules.mjs';

const vaultable=new Set(['barrel','large-barrel','table','round-table','banquet','banquet-long','bench','chair','basket','straw-bed']);
const effectKinds=['bolts','enemyHazards','webShots','webPatches','stormStrikes','waterArcs'];
const radius=e=>e.seat?HERO_RADIUS:e.type===foes.SNAKE||[foes.BAT,foes.STORM_BAT,foes.RAT,foes.EAGLE].includes(e.type)?8:e.boss?19:14;
const nearActor=(a,b,extra=0)=>Math.abs(a.x-b.x)<radius(a)+radius(b)+extra&&Math.abs(a.y-b.y)<radius(a)+radius(b)+extra;
const clampInput=value=>Number.isFinite(value)?clamp(value,-1,1):0;
const idleInput=()=>({seq:-1,x:0,y:0,aim:0,blocked:false,at:-Infinity});
const savePoison=poison=>poison?{...poison,owner:poison.owner?.seat??null}:null;
const loadPoison=(poison,members)=>poison?{...poison,owner:members.get(poison.owner)?.player}:null;

export class Simulation{
 constructor(seed,players,{random=Math.random,id=randomUUID,layoutRevision}={},depth=1,layoutSeed=seed){
  this.random=random;this.id=id;this.players=players;this.clock=0;this.tickId=0;this.events=[];this.currentTarget=null;this.eventId=0;
  this.seed=seed;this.startFloor(layoutSeed,depth,layoutRevision);
 }
 startFloor(seed,floor,layoutRevision){
  this.state={...run.floorState(seed,floor),templeDepth:run.templeDepth(this.seed),templeRunSeed:this.seed};
  if(layoutRevision)this.state.layoutRevision=layoutRevision;
  this.floor=geometry.build(run,this.state);
  this.difficulty=this.activePlayers().length===2?1:.5;
  this.enemies=geometry.spawnEnemies(run,foes,this.state,this.floor,this.difficulty===1);
  this.effects=Object.fromEntries(effectKinds.map(key=>[key,[]]));this.shots=[];this.orbs=new Map();this.portal=null;
  this.completed=false;this.explored=new Set([this.floor.rest?.id]);
  this.sights=new Map();this.sightBarriers=this.floor.sightBarriers();
  this.resistances=items.foes.map(profile=>foes.resistances(profile,floor));
  this.boss=bossRules.create(this.floor.bossArena,this.state,{
   players:()=>this.activePlayers(),enemies:()=>this.enemies,types:foes,random:this.random,
   region:p=>this.floor.regionAt(p.x,p.y),move:(e,dx,dy)=>this.move(e,dx,dy),
   open:p=>this.floor.valid(p.x,p.y,18),
   teleport:(p,pos)=>{
    Object.assign(p,pos,{input:idleInput(),dash:0,vault:null,quiz:null,chargeStart:null,moving:false});
    p.revision++;
   },
   spawn:enemies=>(this.newEnemies??=[]).push(...enemies),
   hit:(p,n,origin)=>this.hurtPlayer(p,n,{lightning:1},false,1,undefined,undefined,origin),
   beam:cue=>{for(const prop of this.floor.bossBeamFurniture(cue))this.hitFurniture(prop,cue.damage*1.75,cue.angle);},
   roofLanding:rock=>{
    for(const actor of [...this.activePlayers(),...this.enemies.filter(e=>e.hp>0)])this.floor.clearRoofLanding(actor,rock,radius(actor));
   },
   spread:(p,n)=>this.bossWaterPulse(p,n),
   drop:(e,it,count)=>{
    for(const p of this.activePlayers())for(let i=0;i<count;i++)this.drop({x:e.x+(i-1)*18,y:e.y+(p.seat===1?-12:12)},it,p.seat,e);
   },
   win:(arena,reward)=>{
    this.portal={x:arena.x+80,y:arena.y};this.emit('portal',this.portal);
    if(reward)for(const p of this.players){
     if(!(p.bossRewards??=[]).includes(reward))p.bossRewards.push(reward);
     p.revision++;
    }
   },
   changed:phase=>{
    if(phase==='ready'||phase==='intro')this.sound('gate_stone_motion',this.floor.bossArena.gate,{priority:3});
    if(phase==='roof')this.sound('hit_stone',this.floor.bossArena,{priority:4,gain:.96,rate:.65});
    if(phase==='retry')this.floor.resetBossFurniture();
    if(phase==='won')this.sound('boss_defeat',this.floor.bossArena,{priority:3});
   }
  });
  for(const p of this.players)this.resetAtRest(p,true);
  this.ai=enemySim.create({
   enemyRules:foes,items,balance,save:this.state,state:this.effects,floor:this.floor,getEnemies:()=>this.enemies,
   moveActor:(e,dx,dy)=>this.move(e,dx,dy),actorRadius:radius,nearActor,
   takeDamage:(p,...args)=>this.hurtPlayer(p,...args),maxHP,
   applyPoison:(p,opts)=>this.poison(p,opts),addBleed:(p,n,origin)=>this.bleed(p,n,origin),
   soundWorld:(cue,pos,mix)=>this.sound(cue,pos,mix),
   hitFurniture:(p,damage,angle)=>this.hitFurniture(p,damage,angle),
   burst:()=>{},hurtEnemy:(e,hit)=>this.hurtEnemy(e,hit),shockWater:(...args)=>this.shockWater(...args),knockHero:(p,x,y,origin)=>this.move(p,x,y,true,origin),coopActors:()=>this.activePlayers(),
   enemyEncounterReady:()=>this.currentTarget!==null,
   rand:(a,b)=>a+this.random()*(b-a)
  });
 }
 static savePlayer(p){
  const {pack,input,online,mods,load,weapon,resistance,chargeStart,poison,quiz,...state}=p;
  return {...state,poison:savePoison(poison),quiz:quiz?{...quiz,q:quiz.q.id}:null};
 }
 static loadPlayer(state,pack,previousPack=pack){
  const stored=state.quiz;
  let quiz=null;
  if(stored){
   const q=pack.questions.find(q=>q.id===stored.q);
   const previous=previousPack.questions.find(q=>q.id===stored.q);
   const legacyQuestion=stored.legacyQuestion??(!stored.order&&q?.type!==previous?.type?previous:undefined);
   quiz={...stored,legacyQuestion,q:legacyQuestion??run.presentQuestion(q,stored.order)};
  }
  const p={...state,pack,quiz:quiz?.q?quiz:null,input:idleInput(),online:false,chargeStart:null};
  preparePlayer(p);
  return p;
 }
 checkpoint(){
  return {
   state:this.state,clock:this.clock,tickId:this.tickId,difficulty:this.difficulty,
   enemies:this.enemies.map(e=>({...e,poison:savePoison(e.poison)})),effects:this.effects,
   shots:this.shots.map(({hit,...shot})=>({...shot,hit:{...hit,p:hit.p.seat}})),
   orbs:[...this.orbs.values()],portal:this.portal,completed:this.completed,explored:[...this.explored],
   plates:this.floor.pressurePlates.map(({pressed,timer,cooldown})=>({pressed,timer,cooldown})),
   stormDelay:this.ai.stormTimer()
  };
 }
 restore(saved,players,members){
  Object.assign(this.state,saved.state);
  Object.assign(this.effects,saved.effects);
  Object.assign(this,{players,clock:saved.clock,tickId:saved.tickId,difficulty:saved.difficulty,
   portal:saved.portal,completed:saved.completed,explored:new Set(saved.explored)});
  for(const p of players)p.poison=loadPoison(p.poison,members);
  this.enemies=saved.enemies.map(e=>({...e,poison:loadPoison(e.poison,members)}));
  this.shots=saved.shots.map(({hit,...shot})=>({...shot,hit:{...hit,p:members.get(hit.p).player}}));
  this.orbs=new Map(saved.orbs.map(o=>[o.id,{...o,...this.lootAt(o)}]));
  this.sights.clear();
  this.floor.pressurePlates.forEach((plate,i)=>Object.assign(plate,saved.plates[i]));
  this.ai.stormTimer(saved.stormDelay);
 }
 enemyHealth(type,boss){return Math.max(1,Math.round(foes.health(type,boss,this.state.floor)*this.difficulty));}
 adaptDifficulty(){
  const count=this.activePlayers().length,next=count===2?1:.5;
  if(!count||next===this.difficulty)return;
  this.difficulty=next;
  for(const e of this.enemies){
   if(e.bossRole)continue;
   const max=this.enemyHealth(e.type,e.boss);
   e.hp=e.hp/e.max*max;e.max=max;
  }
 }
 setOnline(p,online,awayAt){
  p.online=online;p.input=idleInput();p.chargeStart=null;p.moving=false;
  if(!online||!Number.isFinite(awayAt))return;
  const elapsed=this.clock-awayAt;
  p.entered+=elapsed;
  if(p.vault)p.vault.start+=elapsed;
  if(p.trial)p.trial.deadline+=elapsed;
  if(p.consume){p.consume.start+=elapsed;p.consume.end+=elapsed;}
 }
 resetAtRest(p,newFloor=false){
  const spawn=this.floor.spawn,offset=p.seat===2?37:0;
  const x=this.floor.valid(spawn.x+offset,spawn.y,HERO_RADIUS,false,true)?spawn.x+offset:spawn.x;
  Object.assign(p,{x,y:spawn.y,dir:0,weaponSide:1,hp:maxHP(p),stamina:p.staminaMax,dash:0,dashCooldown:0,attack:0,wallRecoil:0,recoilAngle:0,attackDuration:.4,walk:0,
   moving:false,back:false,inv:1.4,poison:null,bleed:0,bleedGrace:0,webSlow:0,grabSlow:0,vault:null,chargeStart:null,
   combat:0,staminaRest:0,entryGrace:0,travelLock:0,region:this.floor.rest?.id,entered:this.clock,quiz:null,trial:null,consume:null,
   consumeQueue:newFloor?p.consumeQueue??[]:[],damageQueue:newFloor?p.damageQueue??[]:[],damageHistory:newFloor?p.damageHistory??[]:[],fall:null});
  p.input={seq:p.input.seq,x:0,y:0,aim:0,blocked:false,at:-Infinity};
  if(newFloor){
   Object.assign(p,{opened:[],searched:[],altarUses:{},altarQuestions:{},gateQuestions:{},boneClaims:{},rubyClaims:{},templeAttempts:{},trials:{},
    cupClaimed:false,shopSold:[],brewEffects:[],merchantMapFound:false,wellUsed:false,mythicSold:p.mythicSold??[]});
   if(this.floor.sewerRelic)this.drop(this.floor.sewerRelic,items.trialCharm,p.seat);
   if(p.wellOffer){this.drop(p,p.wellOffer,p.seat);p.wellOffer=null;}
   const pantry=this.floor.annexes.find(room=>room.key==='pantry');
   if(pantry){
    this.drop(this.floor.accessiblePoint((pantry.cx+.5)*TILE,(pantry.cy+.5)*TILE),{...pools.weapon[Math.floor(this.random()*pools.weapon.length)],rarity:'rare',source:'Vorratsraum'},p.seat);
    for(const [i,food] of ['bread','banana','chicken'].entries())this.drop(this.floor.accessiblePoint((pantry.x+2.5+i)*TILE,(pantry.y+2.5)*TILE),{kind:'food',id:food,rarity:'common',source:'Vorratsraum'},p.seat);
   }
  }
  p.revision++;
 }
 activePlayers(){return this.players.filter(p=>p.online);}
 emit(kind,data,to=0){
  this.events.push({seq:++this.eventId,kind,to,...data});
  if(this.events.length>96)this.events.shift();
 }
 sound(cue,{x,y},mix){this.emit('sound',{cue,x:round(x),y:round(y),mix});return true;}
 move(actor,dx,dy,knockback=false,origin){
  if(actor.fall)return false;
  const hero=Boolean(actor.seat),others=hero?this.enemies:this.players;
  const clear=(x,y,other)=>{
   if(other===actor||other.hp<=0||other.fall||!hero&&!other.online)return true;
   const r=radius(actor)+radius(other),ox=Math.abs(actor.x-other.x),oy=Math.abs(actor.y-other.y);
   const sx=Math.abs(x-other.x),sy=Math.abs(y-other.y);
   return sx>=r||sy>=r||ox<r&&oy<r&&sx>=ox&&sy>=oy&&(sx>ox||sy>oy);
  };
  const canFall=knockback||hero&&!actor.equipment.rings.includes('height');
  const safe={x:actor.x,y:actor.y},bodyRadius=radius(actor);
  const pass=(x,y)=>this.floor.valid(x,y,bodyRadius,false,hero,canFall)&&(hero||!this.floor.inRest(x,y))&&others.every(other=>clear(x,y,other));
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/5));
  for(let i=0;i<steps;i++){
   const x=actor.x+dx/steps,y=actor.y+dy/steps;
   if(dx&&pass(x,actor.y))actor.x=x;
   if(dy&&pass(actor.x,y))actor.y=y;
   if(canFall&&this.floor.pastLedge(actor.x,actor.y,hero?undefined:bodyRadius)){
    actor.fall={remaining:fallSeconds,origin,heading:Math.atan2(dy,dx),...(hero?{}:{safe})};
    actor.attack=0;actor.dash=0;actor.chargeStart=null;actor.moving=false;
    this.sound('hero_fall',actor,{priority:4,gain:.85});
    return false;
   }
  }
  return true;
 }
 travel(p,link){
  Object.assign(p,link.exit,{dash:0,moving:false,inv:.45,vault:null,chargeStart:null,travelLock:.48});
  p.input={...idleInput(),seq:p.input.seq};
  this.emit('travel',{seat:p.seat,x:p.x,y:p.y,link:link.kind});
 }
 hitDoor(door,attack,angle){
  if(door.streetHouse||this.floor.doorHP(door)<=0||this.floor.accessState(door)!=='open')return;
  const hp=this.floor.strikeDoor(attack.amount*(attack.charged?1.5:1),door);
  if(hp===0&&door.reward)this.drop({x:(door.reward.x+.5)*TILE,y:(door.reward.y+.5)*TILE},selectLoot('epic',this.state.floor,this.random));
  this.emit('door',{x:door.x,y:door.y,id:door.id,hp,angle});
 }
 hitFurniture(prop,damage,angle){
  const hp=this.floor.strikeFurniture(prop,damage);
  if(hp!==null)this.emit('furniture',{x:prop.x,y:prop.y,id:prop.breakId,type:prop.type,hp,angle,w:prop.w,h:prop.h});
  else{
   const cue=this.floor.furnitureCue(prop);
   if(cue)this.sound(cue,prop,{gain:.58,priority:2});
  }
 }
 shockWater(origin,impact,split,amount,owner){
  const pulse=this.floor.waterPulse(origin,impact,split,amount);
  if(!pulse)return;
  this.effects.waterArcs.push(pulse);
  this.sound('element_lightning_beam',pulse,{priority:2,gain:.56});
  for(const p of this.activePlayers())if(p!==owner&&this.floor.pulseReaches(pulse,p)){
   const origin=owner?.seat?{source:owner.appearance?.name??'Mitspieler',action:'Blitz im Wasser'}:foes.damageOrigin(owner,'Blitz im Wasser');
   this.hurtPlayer(p,pulse.power,{lightning:1},true,1,undefined,undefined,origin);
  }
  for(const e of this.enemies)if(e!==owner&&e.hp>0&&this.floor.pulseReaches(pulse,e)){
   this.hurtEnemy(e,items.hit(pulse.power,{lightning:1},this.resistanceFor(e)),owner?.seat?owner:null);
  }
 }
 bossWaterPulse(pos,amount){
  const pulse=this.floor.waterPulse(pos,pos,{lightning:1},amount);
  if(!pulse)return;
  this.effects.waterArcs.push(pulse);
  for(const p of this.activePlayers())if(p!==pos&&this.floor.pulseReaches(pulse,p)){
   this.hurtPlayer(p,pulse.power,{lightning:1},true,1,undefined,undefined,{source:bossRules.name,action:'Blitz im Wasser'});
  }
 }
 resistanceFor(e){return bossRules.resistance(e,this.resistances[e.type]);}
 control(p,input){
  if(!Number.isSafeInteger(input.seq)||input.seq<=p.input.seq||!Number.isFinite(input.aim))return false;
  const blocked=Boolean(this.state.bossBattle?.phase==='intro'||input.blocked||p.quiz||p.consume||p.fall||p.deathRecap);
  p.input={seq:input.seq,x:blocked?0:clampInput(input.x),y:blocked?0:clampInput(input.y),aim:normalAngle(input.aim),
   dash:Boolean(input.dash)&&!blocked,blocked,at:this.clock};
  if(blocked)p.chargeStart=null;
  return true;
 }
 canTarget(e,p){
  return p.online&&!e.fall&&!this.floor.hiddenByStairCrest(p,e,this.explored)&&foes.encounterReady(e,p,this.floor,p.entryGrace??0,
   !e.bossRole&&this.sights.get(p.seat)?.seesEnemy(e),this.clock);
 }
 updateSight(p){
  if(!this.sights.has(p.seat))this.sights.set(p.seat,vision.create(this.floor,TILE,this.sightBarriers,[],this.explored));
  const sight=this.sights.get(p.seat);
  sight.update(p,1180,760);
  for(const e of this.enemies){
   if(!e.bossRole&&e.hp>0&&e.veilPhase!=='hidden'&&!this.floor.hiddenByStairCrest(p,e,this.explored)&&sight.observeEnemy(e))foes.reveal(e,this.clock);
  }
 }
 isWeb(p){
  return !this.floor.inRest(p.x,p.y)&&(this.floor.furniture.some(o=>o.type==='web'&&Math.abs(o.x-p.x)<o.w/2+9&&Math.abs(o.y-p.y)<o.h/2+9)||
   this.effects.webPatches.some(o=>gap(o,p)<o.radius));
 }
 cost(p,n){
  if(p.combat<=0)return true;
  if(p.stamina<n)return false;
  p.stamina-=n;p.staminaRest=0;return true;
 }
 step(dt){
  if(!this.activePlayers().length)return;
  this.tickId++;this.clock+=dt;
  for(const p of this.activePlayers())this.stepPlayer(p,dt);
  const active=this.activePlayers();
  for(const p of active)this.updateSight(p);
  const outdoor=active.find(p=>this.floor.outsideAt(p.x,p.y)?.storm)??active[0];
  if(outdoor)this.ai.moveFrom(dt,outdoor,this.clock,1180,760);
  this.updateShots(dt);
  for(const e of this.enemies){
   if(e.hp<=0)continue;
   if(geometry.fallEnemy(e,dt)){if(e.hp<=0)this.boss?.markDeath(e);continue;}
   this.tickPoison(e,dt);
   if(e.hp<=0)continue;
   if(e.bossRole==='scientist'||e.bossEntrance)continue;
   this.currentTarget=active.filter(p=>this.canTarget(e,p)).sort((a,b)=>gap(a,e)-gap(b,e))[0]??null;
   if(active[0])this.ai.act(e,dt,this.currentTarget??active[0],this.clock,1180,760);
  }
  this.currentTarget=null;
  let last=null;
  this.enemies=this.enemies.filter(e=>{if(e.hp>0)return true;last=e;this.defeat(e);return false;});
  if(this.newEnemies?.length)this.enemies.push(...this.newEnemies.splice(0));
  this.boss?.step(dt);
  if(this.newEnemies?.length)this.enemies.push(...this.newEnemies.splice(0));
  if(this.boss)this.enemies=this.enemies.filter(e=>!e.bossDiscard);
  if(last&&this.enemies.length===0&&!this.portal&&!this.boss){
   const region=this.floor.regionAt(last.x,last.y);
   const points=[[60,0],[-60,0],[0,60],[0,-60],[0,0]].map(([dx,dy])=>({x:last.x+dx,y:last.y+dy}));
   this.portal=points.find(point=>this.floor.regionAt(point.x,point.y)===region&&this.floor.valid(point.x,point.y)&&
    !this.floor.gateLineBlocked(last.x,last.y,point.x,point.y))??this.floor.shrines[last.roomId];
   if(this.state.floor===run.LAST_DEPTH)this.completed=true;
   this.emit('portal',this.portal);
  }
 }
 queueConsumable(p,it){
  p.inventory.splice(p.inventory.indexOf(it),1);
  (p.consumeQueue??=[]).push(it);
  this.startConsumption(p);
 }
 startConsumption(p){
  if(p.consume||p.vault||p.quiz||!p.consumeQueue?.length)return;
  const it=p.consumeQueue.shift(),food=it.kind==='food';
  p.consume={item:it,start:this.clock,end:this.clock+(food?items.foodSeconds:.82),applied:food};
  p.chargeStart=null;
  if(food){
   p.attack=0;p.dash=0;p.moving=false;
   this.eatMeal(p,it);
  }
 }
 eatMeal(p,it){
  const {healed,buffered}=items.eatMeal(p,maxHP(p),it,p.mods.food);
  if(healed||buffered)this.sound('element_heal',p,{priority:2});
  const notice=items.food[it.id].name+' · +'+Math.round(healed)+' LP'+(buffered?' · '+Math.round(buffered)+' Schaden abgefangen':'');
  this.emit('notice',{message:notice},p.seat);
 }
 stepPlayer(p,dt){
  if(this.state.bossBattle?.phase==='intro'){
   p.input=idleInput();p.moving=false;return;
  }
  if(p.fall){
   p.fall.remaining-=dt;
   if(p.fall.remaining<=1e-7)this.die(p,'fall',p.fall.origin);
   return;
  }
  for(const key of ['inv','attack','wallRecoil','dash','dashCooldown','webSlow','grabSlow','bleedGrace','entryGrace','travelLock'])p[key]=remaining(p[key],dt);
  if(!p.bleedGrace)p.bleed=remaining(p.bleed,dt*14);
  if(p.activeBrew){
   p.activeBrew.remaining=remaining(p.activeBrew.remaining,dt);
   if(p.mods.heal)p.hp=Math.min(maxHP(p),p.hp+p.mods.heal*dt);
   if(!p.activeBrew.remaining){p.activeBrew=null;preparePlayer(p);p.revision++;}
  }
  this.tickPoison(p,dt);
  if(p.trial&&!p.trial.passed&&this.clock>=p.trial.deadline)this.actions.finishTrial(p,false);
  if(p.consume&&this.clock>=p.consume.end){
   const {item:it,applied}=p.consume;p.consume=null;
   if(it.kind==='food'){if(!applied)this.eatMeal(p,it);}
   else {
    p.activeBrew={effects:it.brew,remaining:it.duration,duration:it.duration};preparePlayer(p);
    this.sound('brew_drink',p,{gain:.64,priority:2});
    this.sound('element_buff_on',p,{priority:2,delay:.2});
   }
   p.revision++;
  }
  this.startConsumption(p);
  for(const hit of items.takeDueDamage(p,dt)){
   if(this.settleDamage(p,hit))return;
  }
  p.playtime+=dt;
  const recovered=items.recoverWithArmor(p,p.equipment.armor,p.hp,maxHP(p));
  if(recovered>p.hp){
   p.hp=recovered;p.revision++;
   this.emit('armor',{seat:p.seat,x:round(p.x),y:round(p.y),proc:'heal'});
  }
  const threat=this.enemies.some(e=>e.hp>0&&gap(e,p)<420&&this.canTarget(e,p)&&!this.floor.gateLineBlocked(p.x,p.y,e.x,e.y));
  p.combat=threat?1.35:remaining(p.combat,dt);
  if(p.attack||p.dash||p.wallRecoil||p.chargeStart!==null)p.staminaRest=0;
  else if((p.staminaRest+=dt)>.45)p.stamina=Math.min(p.staminaMax,p.stamina+dt*(10+p.attributes.endurance*.6)*Math.min(2.8,1+(p.staminaRest-.45)*2.2)*p.mods.regen);
  let {x,y,aim,dash,at,blocked}=p.input;
  if(p.quiz||p.consume||blocked||this.clock-at>.35){x=0;y=0;dash=false;}
  else p.dir=aim;
  if(p.chargeStart!==null&&this.clock-at>.5)p.chargeStart=null;
  if(p.wallRecoil>geometry.wallRecoilSeconds-.13){x=0;y=0;}
  const length=Math.hypot(x,y)||1;x/=length;y/=length;
  if(!p.vault&&!p.wallRecoil&&!p.dashCooldown&&dash&&(x||y)&&this.cost(p,Math.round((p.equipment.rings.includes('dodge')?17:25)*p.mods.cost))){
   p.chargeStart=null;p.dash=p.load.dashTime;p.dashCooldown=.85*p.mods.dashCooldown*items.dashCooldown(p.equipment.armor)*(p.weapon?.malus?balance.weaponMythicDash:1);p.dashX=x;p.dashY=y;
   this.emit('dash',{seat:p.seat,x:p.x,y:p.y});
  }
  if(p.dash&&!p.quiz){x=p.dashX;y=p.dashY;}
  const before={x:p.x,y:p.y};
  if(p.vault){
   const v=p.vault,t=Math.min(1,(this.clock-v.start)/.46),ease=t*t*(3-2*t);
   if(t>=1){
    Object.assign(p,this.enemies.some(e=>e.hp>0&&nearActor(e,{...v.to,seat:p.seat},5))?v.from:v.to);
    p.vault=null;
   }else{p.x=v.from.x+(v.to.x-v.from.x)*ease;p.y=v.from.y+(v.to.y-v.from.y)*ease;}
  }else if(x||y){
   p.back=y<0;
   const slow=p.webSlow||p.grabSlow||this.isWeb(p);
   const speed=p.speed*(p.dash?p.load.dashSpeed*p.mods.dashDistance:1)*(slow?.53:1)*(p.chargeStart!==null?.64:1);
   if(!this.move(p,x*speed*dt,y*speed*dt))return;
  }
  const face=Math.cos(p.dir);if(Math.abs(face)>.23&&!p.wallRecoil)p.weaponSide=Math.sign(face);
  p.moving=gap(p,before)>.08;
  if(p.moving)p.walk+=dt*(p.dash?23:12);
  const region=this.floor.regionAt(p.x,p.y);
  if(p.region!==region){
   p.region=region;p.entered=this.clock;
   p.entryGrace=region>=0&&!this.explored.has(region)&&!this.floor.isPassage(region)?foes.entryGrace:0;
  }
  if(region>=0&&!this.floor.passageSealed(region)){
   this.explored.add(region);
  }
 }
 vaultPath(p,aim){
  const floor=this.floor,region=p.region,dx=Math.cos(aim),dy=Math.sin(aim);
  let obstacle=null;
  for(let d=6;d<=122;d+=4){
   const x=p.x+dx*d,y=p.y+dy*d;
   if(floor.regionAt(x,y)!==region||[-10,0,10].some(ox=>[-5,0,5].some(oy=>floor.footWall(x+ox,y+oy)||floor.gateBlocked(x+ox,y+oy))))return null;
   const props=floor.furniture.filter(f=>f.solid&&floor.furnitureIntact(f)&&Math.abs(x-f.x)<f.w/2+9&&Math.abs(y-f.y)<f.h/2+6);
   if(props.length){
    if(!obstacle&&d>35||props.length!==1||!vaultable.has(props[0].type)||obstacle&&props[0]!==obstacle)return null;
    obstacle=props[0];
   }else if(obstacle){
    const end={x:x+dx*9,y:y+dy*9};
    return floor.regionAt(end.x,end.y)===region&&floor.valid(end.x,end.y,HERO_RADIUS,false,true)&&
     !this.enemies.some(e=>e.hp>0&&nearActor(e,{...end,seat:p.seat},5))?end:null;
   }
  }
  return null;
 }
 charge(p,aim,vaultFirst=false){
  if(this.state.bossBattle?.phase==='intro'||p.fall||p.deathRecap||p.quiz||p.consume||p.attack||p.wallRecoil||p.dash||p.vault||p.chargeStart!==null)return false;
  p.dir=Number.isFinite(aim)?normalAngle(aim):p.dir;
  if(vaultFirst){
   const heading=p.input.x||p.input.y?Math.atan2(p.input.y,p.input.x):p.dir,to=this.vaultPath(p,heading);
   if(to){p.vault={to,from:{x:p.x,y:p.y},start:this.clock};p.back=Math.sin(heading)<-.16;return true;}
  }
  if(!p.weapon)return false;
  p.chargeStart=this.clock;return true;
 }
 attack(p,aim){
  if(this.state.bossBattle?.phase==='intro'||p.chargeStart===null)return false;
  const charged=this.clock-p.chargeStart>=balance.chargeSeconds;
  p.chargeStart=null;
  if(p.fall||p.deathRecap||p.quiz||p.consume||p.dash||p.attack||p.wallRecoil||p.vault||!p.weapon)return false;
  p.dir=Number.isFinite(aim)?normalAngle(aim):p.dir;
  const w=p.weapon;
  if(!this.cost(p,Math.round(w.stamina*(charged?1.28:1)*p.mods.cost)))return false;
  p.attack=p.attackDuration=w.speed*(charged?1.25:1);
  const scale=p.mods.reach*items.arrowRange(w,p.equipment.armor),reach=w.reach*scale,type=p.mods.element??Object.keys(w.split)[0];
  const swing={seat:p.seat,id:this.id(),x:round(p.x),y:round(p.y),dir:p.dir,weapon:w.id,type,reach,scale,duration:p.attack,charged};
  const contact=this.floor.meleeWall(p.x,p.y,p.dir,w,reach);
  if(contact){swing.wallAngle=contact.offset;swing.duration=geometry.wallRecoilSeconds;}
  this.emit('swing',swing);
  const rest=this.floor.inRest(p.x,p.y);
  const hit={p,w,charged,amount:p.damage*items.madnessBonus(p,p.equipment.rings),crit:p.crit,impact:p.impact,
   split:p.mods.element?{[p.mods.element]:Object.values(w.split).reduce((a,b)=>a+b,0)}:w.split};
  if(w.projectile){
   this.shots.push({x:p.x,y:p.y,origin:{x:p.x,y:p.y},angle:p.dir,left:reach,restOnly:rest,
    speed:(w.projectile==='arrow'?490:345)*(charged?1.23:1),hit});
   return true;
  }
  let impact=null;
  const obstruction=this.floor.weaponImpact(p.x,p.y,p.dir,reach);
  const props=this.floor.meleeFurniture(p.x,p.y,p.dir,reach,w,contact,obstruction);
  const door=rest?null:this.floor.doorAhead(p.x,p.y,p.dir,reach);
  const beforeWall=target=>this.floor.beforeMeleeWall(p.x,p.y,target.x,target.y,w,contact);
  const doorHit=door&&beforeWall(door)&&!this.floor.furnitureBetween(p.x,p.y,door.x,door.y);
  if(!rest)for(const e of this.enemies){
   const angle=Math.atan2(e.y-p.y,e.x-p.x);
   if(e.hp<=0||e.fall||!items.meleeHit(w,e.x-p.x,e.y-p.y,p.dir,reach,e.size)||!beforeWall(e)||
      this.floor.gateLineBlocked(p.x,p.y,e.x,e.y))continue;
   const cover=this.floor.furnitureBetween(p.x,p.y,e.x,e.y);
   if(cover){props.add(cover);continue;}
   impact??=e;
   this.weaponHit(e,hit,angle);
  }
  for(const prop of props)if(!rest||this.floor.inRest(prop.x,prop.y)){
   this.hitFurniture(prop,hit.amount*(charged?1.5:1),Math.atan2(prop.y-p.y,prop.x-p.x));
  }
  if(doorHit)this.hitDoor(door,hit,p.dir);
  if(!rest)this.shockWater(p,impact??(doorHit?door:null),hit.split,hit.amount,p);
  if(contact)this.reboundFromWall(p,contact,charged);
  else if(!impact&&!doorHit&&!props.size&&obstruction?.cue)this.sound(obstruction.cue,obstruction,{gain:.67,priority:2});
  return true;
 }
 reboundFromWall(p,contact,charged){
  p.attack=0;p.wallRecoil=geometry.wallRecoilSeconds;p.recoilAngle=contact.angle;
  p.stamina=Math.max(0,p.stamina-(charged?14:9));p.staminaRest=0;
  const force=geometry.wallRecoilForce(charged);
  this.move(p,contact.normalX*force,contact.normalY*force,true,
   {source:'Wand',action:'Waffenabpraller'});
  this.emit('wall-recoil',{seat:p.seat,x:round(contact.x),y:round(contact.y),angle:contact.angle});
 }
 updateShots(dt){
  this.shots=this.shots.filter(shot=>{
   const distance=Math.min(shot.left,shot.speed*dt),steps=Math.max(1,Math.ceil(distance/6)),stride=distance/steps;
   const shock=(impact=shot)=>{if(shot.hit&&!shot.restOnly)this.shockWater(shot.origin??shot.hit.p,impact,shot.hit.split,shot.hit.amount,shot.hit.p);};
   for(let i=0;i<steps;i++){
    shot.x+=Math.cos(shot.angle)*stride;shot.y+=Math.sin(shot.angle)*stride;
    if(this.floor.wall(shot.x,shot.y)||this.floor.gateBlocked(shot.x,shot.y)){shock();return false;}
    if(shot.restOnly&&!this.floor.inRest(shot.x,shot.y))return false;
    const door=this.floor.doorAt(shot.x,shot.y);
    if(door){if(shot.hit&&!shot.restOnly)this.hitDoor(door,shot.hit,shot.angle);shock();return false;}
    const prop=this.floor.furnitureAt(shot.x,shot.y,2);
    if(prop){if(shot.hit)this.hitFurniture(prop,shot.hit.amount*(shot.hit.charged?1.5:1),shot.angle);shock();return false;}
    if(shot.restOnly)continue;
    const enemy=this.enemies.find(e=>e.hp>0&&!e.fall&&gap(e,shot)<radius(e)+5&&
     !this.floor.gateLineBlocked(shot.x,shot.y,e.x,e.y));
    if(enemy){const impact={x:enemy.x,y:enemy.y};this.weaponHit(enemy,shot.hit,shot.angle);shock(impact);return false;}
   }
   if((shot.left-=distance)>0)return true;
   shock();return false;
  });
 }
 weaponHit(e,attack,angle){
  if(e.warded||e.fall)return;
  const {p,w,charged,amount,split}=attack,counter=e.counterUntil>this.clock,rolled=!counter&&this.random()<attack.crit;
  const crit=counter?charged?'fatal':'counter':rolled?'critical':'';
  const wet=this.floor.inRain(p.x,p.y)||this.floor.inRain(e.x,e.y);
  const resist=this.resistanceFor(e);
  const hit=items.hit(amount*balance.hitMultiplier(charged,counter,rolled,w.critFactor),wet&&split.fire?{...split,fire:split.fire*.55}:split,resist);
  this.hurtEnemy(e,hit,p,crit,w.id);
  if(!hit.total)return;
  if(counter)e.counterUntil=0;
  const knock=foes.knockbackDistance(attack.impact,foes.balance(e.type,e.boss))*(w.projectile?.67:1);
  if(knock&&e.hp>0)this.move(e,Math.cos(angle)*knock,Math.sin(angle)*knock,true);
  if(e.hp>0&&w.status==='bleed'&&!(e.bleedUntil>this.clock)){
   e.bleedUntil=this.clock+3;this.hurtEnemy(e,items.hit(e.max*(.08+(w.statusLevel-1)*.02),{bleed:1},resist),p);
  }
  if(e.hp>0&&w.status==='poison'&&resist.poison!==1&&!e.poison)this.poison(e,{untilTick:.72,ticks:3,power:1+(w.statusLevel-1)*.25,owner:p});
  if(p.equipment.rings.includes('faith'))p.hp=Math.min(maxHP(p),p.hp+3);
 }
 hurtEnemy(e,hit,p,critical='',weapon){
  if(e.hp<=0||e.warded||e.fall)return;
  const n=Math.min(e.hp,hit.total);
  if(n>0){
   if(hit.type==='bleed')this.bloodLoss(e);
   e.hp-=n;if(e.hp<=0)this.boss?.markDeath(e);
   e.dominant=hit.type;e.hit=.22;foes.alert(e);
   if(p){p.combatRecord.dealt+=n;if(critical)p.combatRecord[critical==='critical'?'crits':'counters']++;p.revision++;}
  }
  this.emit('hit',{x:round(e.x),y:round(e.y),value:n,type:hit.type,critical,enemyType:e.type,weapon});
 }
 hurtPlayer(p,n,split={physical:1},status=false,depth=foes.depthFactor(this.state.floor),cue,critical,origin){
  if(!p.online||p.fall||p.inv>0&&!status||p.dash>0||this.floor.inRest(p.x,p.y))return false;
  const wet=this.floor.inRain(p.x,p.y)&&split.fire;
  const wetSplit=this.floor.waterLightning(wet?{...split,fire:split.fire*.55}:split,p.x,p.y);
  const hit=items.hit(n*depth*p.guard,wetSplit,p.resistance);
  if(hit.total<=0)return false;
  const location={seat:p.seat,x:round(p.x),y:round(p.y)};
  p.revision++;
  if(!status)p.inv=.75;
  if(items.blockArmorHit(p,p.equipment.armor,status)){this.emit('armor',{...location,proc:'block'});return false;}
  items.queueDamage(p,hit,origin);p.dominant=hit.type;
  this.emit('hit',{...location,value:hit.total,type:hit.type,cue,critical,pain:!status});
  return true;
 }
 settleDamage(p,hit){
  if(!hit.amount)return false;
  const {hp,taken,proc}=items.resolveArmorDamage(p,p.equipment.armor,p.hp,maxHP(p),hit.amount);
  p.hp=hp;p.combatRecord.taken+=taken;p.revision++;
  const dealt=items.rememberHit(p,hit,taken);
  const location={seat:p.seat,x:round(p.x),y:round(p.y)};
  if(proc)this.emit('armor',{...location,proc});
  if(taken>0&&hit.type==='bleed')this.bloodLoss(p);
  if(p.hp<=0){this.die(p,'combat',dealt);return true;}
  return false;
 }
 die(p,cause,finalHit){
  if(cause!=='fall')this.sound('hero_fall',p,{priority:4,gain:.85});
  const layer=this.floor.layerAt(p.x,p.y),before={...p};
  p.combatRecord.deaths++;
  if(p.trial)this.actions.finishTrial(p,false);
  this.resetAtRest(p);
  const recap=items.deathReport(this.state.floor,layer,p.pack.questions,before,p,cause,finalHit);
  p.deathRecap=recap;
  this.emit('death',{seat:p.seat,cause,recap},p.seat);
 }
 bloodLoss(point){
  for(const p of this.activePlayers())if(p.equipment.rings.includes('madness')&&gap(p,point)<=220&&
   !this.floor.gateLineBlocked(p.x,p.y,point.x,point.y)){
   p.madnessUntil=p.playtime+20;p.revision++;
  }
 }
 poison(actor,opts){actor.poison={...opts};}
 tickPoison(actor,dt){
  const poison=actor.poison;if(!poison)return;
  if((poison.untilTick-=dt)>0)return;
  if(--poison.ticks<=0)actor.poison=null;
  else poison.untilTick=.72;
  const amount=7*(poison.power??1);
  if(actor.seat)this.hurtPlayer(actor,amount,{poison:1},true,1.1,'element_poison_tick',undefined,poison.origin);
  else this.hurtEnemy(actor,items.hit(amount,{poison:1},this.resistanceFor(actor)),poison.owner);
 }
 bleed(p,amount,origin){
  p.bleed=Math.min(100,p.bleed+amount);p.bleedGrace=2;
  if(p.bleed>=100){p.bleed=0;this.hurtPlayer(p,maxHP(p)*.16,{bleed:1},true,1,'element_bleed_hero',undefined,origin);}
 }
 lootAt(pos,anchor=pos){
  return this.floor.lootPosition(pos,anchor)??this.floor.lootPosition(anchor)??this.floor.spawn;
 }
 drop(pos,item,owner=0,anchor=pos){
  if(this.orbs.size>=180&&item!==items.alleyRing)return false;
  const id=this.id();this.orbs.set(id,{id,seat:owner,...this.lootAt(pos,anchor),item});
  return true;
 }
 defeat(e){
  const active=this.activePlayers();
  for(const p of active){p.kills++;p.revision++;}
  if(e.bossRole){this.boss?.defeat(e);this.emit('defeated',{x:e.x,y:e.y,type:e.type});return;}
  if(e.alleyRing&&!this.state.alleyRingAwarded){
   this.state.alleyRingAwarded=this.drop(e,items.alleyRing);
  }
  if(e.type===foes.PRIEST){
   this.newEnemies??=[];
   for(const side of [-1,1]){
    const x=e.x+side*27,y=e.y;
    if(!this.floor.valid(x,y,8))continue;
    const max=this.enemyHealth(foes.SNAKE,false);
    this.newEnemies.push({x,y,id:e.id+'-snake-'+side,type:foes.SNAKE,roomId:e.roomId,hp:max,max,size:.57,phase:0,hit:0,attack:.5,windup:0,angle:0,emerge:.28,alerted:true});
   }
  }
  const spawnPair=(make,origin=e)=>{
   if(this.orbs.size+active.length>180)return;
   for(const p of active){
    const x=origin.x+(p.seat===1?-13:13);
    this.drop({x,y:origin.y},make(),p.seat,origin);
   }
  };
  const sewer=this.floor.layerAt(e.x,e.y)===-1;
  const scythe=items.cryptDrop(e,this.random,this.state.floor);
  if(scythe)spawnPair(()=>scythe);
  const rank=e.type===foes.SNAKE?null:items.enemyRarity(this.random(),this.state.floor,sewer);
  if(rank)spawnPair(()=>{
   const drop=selectLoot(rank,this.state.floor,this.random);
   return sewer?{...drop,source:'Kanalisation'}:drop;
  });
  if(this.random()<.015)spawnPair(()=>cup('Gegnerbeute · Koop'));
  if(this.state.layoutRevision>=9){
   if(this.random()<.035)spawnPair(()=>({kind:'ring',id:'height',rarity:'rare',source:'Gegnerbeute'}));
   if([foes.RAT,foes.ELECTRO_RAT].includes(e.type)&&this.random()<(e.type===foes.ELECTRO_RAT?.13:.08)){
    spawnPair(()=>({kind:'ring',id:'madness',rarity:'rare',source:'Kanalisation'}));
   }
  }
  const bones=foes.boneDrop(e,this.random);
  if(bones)spawnPair(()=>bones,this.floor.boneDropPosition(e));
  this.emit('defeated',{x:e.x,y:e.y,type:e.type});
 }
}
