import {randomUUID} from 'node:crypto';
import {run,balance,items,foes,geometry,enemySim,TILE,HERO_RADIUS,round,clamp,gap,remaining,normalAngle,maxHP,preparePlayer,selectLoot,cup,pools} from './rules.mjs';

const vaultable=new Set(['barrel','table','round-table','banquet','banquet-long','bench','chair','basket','straw-bed']);
const effectKinds=['bolts','enemyHazards','webShots','webPatches','stormStrikes'];
const radius=e=>e.seat?HERO_RADIUS:e.type===foes.SNAKE||e.type>=foes.BAT?8:e.boss?19:14;
const nearActor=(a,b,extra=0)=>Math.abs(a.x-b.x)<radius(a)+radius(b)+extra&&Math.abs(a.y-b.y)<radius(a)+radius(b)+extra;
const clampInput=value=>Number.isFinite(value)?clamp(value,-1,1):0;
const idleInput=()=>({seq:-1,x:0,y:0,aim:0,blocked:false,at:-Infinity});
const savePoison=poison=>poison?{...poison,owner:poison.owner?.seat??null}:null;
const loadPoison=(poison,members)=>poison?{...poison,owner:members.get(poison.owner)?.player}:null;

export class Simulation{
 constructor(seed,players,{random=Math.random,id=randomUUID}={},depth=1,layoutSeed=seed){
  this.random=random;this.id=id;this.players=players;this.clock=0;this.tickId=0;this.events=[];this.currentTarget=null;this.eventId=0;
  this.seed=seed;this.startFloor(layoutSeed,depth);
 }
 startFloor(seed,floor){
  this.state={...run.floorState(seed,floor),templeDepth:run.templeDepth(this.seed)};
  this.floor=geometry.build(run,this.state);
  this.difficulty=this.activePlayers().length===2?1:.5;
  this.enemies=geometry.spawnEnemies(run,foes,this.state,this.floor,this.difficulty===1);
  this.effects=Object.fromEntries(effectKinds.map(key=>[key,[]]));this.shots=[];this.orbs=new Map();this.portal=null;
  this.completed=false;this.explored=new Set([this.floor.rest?.id]);
  this.resistances=items.foes.map(profile=>foes.resistances(profile,floor));
  for(const p of this.players)this.resetAtRest(p,true);
  this.ai=enemySim.create({
   enemyRules:foes,items,balance,save:this.state,state:this.effects,floor:this.floor,getEnemies:()=>this.enemies,
   moveActor:(e,dx,dy)=>this.move(e,dx,dy),actorRadius:radius,nearActor,
   takeDamage:(p,...args)=>this.hurtPlayer(p,...args),maxHP,
   applyPoison:(p,opts)=>this.poison(p,opts),addBleed:(p,n)=>this.bleed(p,n),
   soundWorld:(cue,pos,mix)=>this.sound(cue,pos,mix),
   burst:()=>{},hurtEnemy:(e,hit)=>this.hurtEnemy(e,hit),coopActors:()=>this.activePlayers(),
   enemyEncounterReady:()=>this.currentTarget!==null,
   rand:(a,b)=>a+this.random()*(b-a)
  });
 }
 static savePlayer(p){
  const {pack,input,online,mods,load,weapon,resistance,chargeStart,poison,quiz,...state}=p;
  return {...state,poison:savePoison(poison),quiz:quiz?{...quiz,q:quiz.q.id}:null};
 }
 static loadPlayer(state,pack){
  const quiz=state.quiz&&{...state.quiz,q:pack.questions.find(q=>q.id===state.quiz.q)};
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
  this.orbs=new Map(saved.orbs.map(o=>[o.id,o]));
  this.floor.pressurePlates.forEach((plate,i)=>Object.assign(plate,saved.plates[i]));
  this.ai.stormTimer(saved.stormDelay);
 }
 enemyHealth(type,boss){return Math.max(1,Math.round(foes.health(type,boss,this.state.floor)*this.difficulty));}
 adaptDifficulty(){
  const count=this.activePlayers().length,next=count===2?1:.5;
  if(!count||next===this.difficulty)return;
  this.difficulty=next;
  for(const e of this.enemies){
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
  Object.assign(p,{x,y:spawn.y,dir:0,weaponSide:1,hp:maxHP(p),stamina:p.staminaMax,dash:0,dashCooldown:0,attack:0,attackDuration:.4,walk:0,
   moving:false,back:false,inv:1.4,poison:null,bleed:0,bleedGrace:0,webSlow:0,grabSlow:0,vault:null,chargeStart:null,
   combat:0,staminaRest:0,entryGrace:0,region:this.floor.rest?.id,entered:this.clock,quiz:null,trial:null,consume:null});
  p.input={seq:p.input.seq,x:0,y:0,aim:0,blocked:false,at:-Infinity};
  if(newFloor){
   Object.assign(p,{opened:[],searched:[],altarUses:{},altarQuestions:{},gateQuestions:{},boneClaims:{},rubyClaims:{},templeAttempts:{},trials:{},
    cupClaimed:false,shopSold:[],brewEffects:[],merchantMapFound:false,wellUsed:false,mythicSold:p.mythicSold??[]});
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
 move(actor,dx,dy){
  const hero=Boolean(actor.seat),others=hero?this.enemies:this.players;
  const clear=(x,y,other)=>{
   if(other===actor||other.hp<=0||!hero&&!other.online)return true;
   const r=radius(actor)+radius(other),ox=Math.abs(actor.x-other.x),oy=Math.abs(actor.y-other.y);
   const sx=Math.abs(x-other.x),sy=Math.abs(y-other.y);
   return sx>=r||sy>=r||ox<r&&oy<r&&sx>=ox&&sy>=oy&&(sx>ox||sy>oy);
  };
  const pass=(x,y)=>this.floor.valid(x,y,radius(actor),false,hero)&&(hero||!this.floor.inRest(x,y))&&others.every(other=>clear(x,y,other));
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/5));
  for(let i=0;i<steps;i++){
   const x=actor.x+dx/steps,y=actor.y+dy/steps;
   if(dx&&pass(x,actor.y))actor.x=x;
   if(dy&&pass(actor.x,y))actor.y=y;
  }
 }
 control(p,input){
  if(!Number.isSafeInteger(input.seq)||input.seq<=p.input.seq||!Number.isFinite(input.aim))return false;
  const blocked=Boolean(input.blocked||p.quiz||p.consume);
  p.input={seq:input.seq,x:blocked?0:clampInput(input.x),y:blocked?0:clampInput(input.y),aim:normalAngle(input.aim),
   dash:Boolean(input.dash)&&!blocked,blocked,at:this.clock};
  if(blocked)p.chargeStart=null;
  return true;
 }
 canTarget(e,p){
  return p.online&&foes.encounterReady(e,p,this.floor,p.entryGrace??0);
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
  const outdoor=active.find(p=>this.floor.outsideAt(p.x,p.y)?.storm)??active[0];
  if(outdoor)this.ai.moveFrom(dt,outdoor,this.clock,1180,760);
  this.updateShots(dt);
  for(const e of this.enemies){
   if(e.hp<=0)continue;
   this.tickPoison(e,dt);
   if(e.hp<=0)continue;
   this.currentTarget=active.filter(p=>this.canTarget(e,p)).sort((a,b)=>gap(a,e)-gap(b,e))[0]??null;
   if(active[0])this.ai.act(e,dt,this.currentTarget??active[0],this.clock,1180,760);
  }
  this.currentTarget=null;
  let last=null;
  this.enemies=this.enemies.filter(e=>{if(e.hp>0)return true;last=e;this.defeat(e);return false;});
  if(this.newEnemies?.length)this.enemies.push(...this.newEnemies.splice(0));
  if(last&&this.enemies.length===0&&!this.portal){
   const region=this.floor.regionAt(last.x,last.y);
   const points=[[60,0],[-60,0],[0,60],[0,-60],[0,0]].map(([dx,dy])=>({x:last.x+dx,y:last.y+dy}));
   this.portal=points.find(point=>this.floor.regionAt(point.x,point.y)===region&&this.floor.valid(point.x,point.y)&&
    !this.floor.gateLineBlocked(last.x,last.y,point.x,point.y))??this.floor.shrines[last.roomId];
   if(this.state.floor===run.LAST_DEPTH)this.completed=true;
   this.emit('portal',this.portal);
  }
 }
 stepPlayer(p,dt){
  for(const key of ['inv','attack','dash','dashCooldown','webSlow','grabSlow','bleedGrace','entryGrace'])p[key]=remaining(p[key],dt);
  if(!p.bleedGrace)p.bleed=remaining(p.bleed,dt*14);
  if(p.activeBrew){
   p.activeBrew.remaining=remaining(p.activeBrew.remaining,dt);
   if(p.mods.heal)p.hp=Math.min(maxHP(p),p.hp+p.mods.heal*dt);
   if(!p.activeBrew.remaining){p.activeBrew=null;preparePlayer(p);p.revision++;}
  }
  this.tickPoison(p,dt);
  if(p.trial&&!p.trial.passed&&this.clock>=p.trial.deadline)this.actions.finishTrial(p,false);
  if(p.consume&&this.clock>=p.consume.end){
   const it=p.consume.item;p.consume=null;
   if(it.kind==='food')p.hp=Math.min(maxHP(p),p.hp+items.food[it.id].heal*p.mods.food);
   else {
    p.activeBrew={effects:it.brew,remaining:it.duration,duration:it.duration};preparePlayer(p);
    this.sound('brew_drink',p,{gain:.64,priority:2});
    this.sound('element_buff_on',p,{priority:2,delay:.2});
   }
   p.revision++;
  }
  p.playtime+=dt;
  const recovered=items.recoverWithArmor(p,p.equipment.armor,p.hp,maxHP(p));
  if(recovered>p.hp){
   p.hp=recovered;p.revision++;
   this.emit('armor',{seat:p.seat,x:round(p.x),y:round(p.y),proc:'heal'});
  }
  const threat=this.enemies.some(e=>e.hp>0&&gap(e,p)<420&&this.canTarget(e,p)&&!this.floor.gateLineBlocked(p.x,p.y,e.x,e.y));
  p.combat=threat?1.35:remaining(p.combat,dt);
  if(p.attack||p.dash||p.chargeStart!==null)p.staminaRest=0;
  else if((p.staminaRest+=dt)>.45)p.stamina=Math.min(p.staminaMax,p.stamina+dt*(10+p.attributes.endurance*.6)*Math.min(2.8,1+(p.staminaRest-.45)*2.2)*p.mods.regen);
  let {x,y,aim,dash,at,blocked}=p.input;
  if(p.quiz||p.consume||blocked||this.clock-at>.35){x=0;y=0;dash=false;}
  else p.dir=aim;
  if(p.chargeStart!==null&&this.clock-at>.5)p.chargeStart=null;
  const length=Math.hypot(x,y)||1;x/=length;y/=length;
  if(!p.vault&&!p.dashCooldown&&dash&&(x||y)&&this.cost(p,Math.round((p.equipment.rings.includes('dodge')?17:25)*p.mods.cost))){
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
   this.move(p,x*speed*dt,y*speed*dt);
  }
  const face=Math.cos(p.dir);if(Math.abs(face)>.23)p.weaponSide=Math.sign(face);
  p.moving=gap(p,before)>.08;
  if(p.moving)p.walk+=dt*(p.dash?23:12);
  const region=this.floor.regionAt(p.x,p.y);
  if(p.region!==region){
   p.region=region;p.entered=this.clock;
   p.entryGrace=region>=0&&!this.explored.has(region)&&!this.floor.isPassage(region)?foes.entryGrace:0;
  }
  if(region>=0&&!this.floor.passageSealed(region)&&(this.floor.isPassage(region)||this.clock-p.entered>=.85)){
   this.explored.add(region);
  }
 }
 vaultPath(p,aim){
  const floor=this.floor,region=p.region,dx=Math.cos(aim),dy=Math.sin(aim);
  let obstacle=null;
  for(let d=6;d<=122;d+=4){
   const x=p.x+dx*d,y=p.y+dy*d;
   if(floor.regionAt(x,y)!==region||[-10,0,10].some(ox=>[-5,0,5].some(oy=>floor.footWall(x+ox,y+oy)||floor.gateBlocked(x+ox,y+oy))))return null;
   const props=floor.furniture.filter(f=>f.solid&&Math.abs(x-f.x)<f.w/2+9&&Math.abs(y-f.y)<f.h/2+6);
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
  if(p.quiz||p.consume||p.attack||p.dash||p.vault||p.chargeStart!==null)return false;
  p.dir=Number.isFinite(aim)?normalAngle(aim):p.dir;
  if(vaultFirst){
   const heading=p.input.x||p.input.y?Math.atan2(p.input.y,p.input.x):p.dir,to=this.vaultPath(p,heading);
   if(to){p.vault={to,from:{x:p.x,y:p.y},start:this.clock};p.back=Math.sin(heading)<-.16;return true;}
  }
  if(!p.weapon)return false;
  p.chargeStart=this.clock;return true;
 }
 attack(p,aim){
  if(p.chargeStart===null)return false;
  const charged=this.clock-p.chargeStart>=balance.chargeSeconds;
  p.chargeStart=null;
  if(p.quiz||p.consume||p.dash||p.attack||p.vault||!p.weapon)return false;
  p.dir=Number.isFinite(aim)?normalAngle(aim):p.dir;
  const w=p.weapon;
  if(!this.cost(p,Math.round(w.stamina*(charged?1.28:1)*p.mods.cost)))return false;
  p.attack=p.attackDuration=w.speed*(charged?1.25:1);
  const scale=p.mods.reach*items.arrowRange(w,p.equipment.armor),reach=w.reach*scale,type=p.mods.element??Object.keys(w.split)[0];
  const swing={seat:p.seat,id:this.id(),x:round(p.x),y:round(p.y),dir:p.dir,weapon:w.id,type,reach,scale,duration:p.attack,charged};
  this.emit('swing',swing);
  if(this.floor.inRest(p.x,p.y))return true;
  const hit={p,w,charged,amount:p.damage,crit:p.crit,impact:p.impact,split:p.mods.element?{[p.mods.element]:Object.values(w.split).reduce((a,b)=>a+b,0)}:w.split};
  if(w.projectile){
   this.shots.push({x:p.x,y:p.y,angle:p.dir,left:reach,speed:(w.projectile==='arrow'?490:345)*(charged?1.23:1),hit});
   return true;
  }
  let targetHit=false;
  for(const e of this.enemies){
   const angle=Math.atan2(e.y-p.y,e.x-p.x);
   if(e.hp>0&&gap(e,p)<reach+(e.size-1)*10&&Math.cos(angle-p.dir)>.25&&
     !this.floor.gateLineBlocked(p.x,p.y,e.x,e.y)){targetHit=true;this.weaponHit(e,hit,angle);}
  }
  if(!targetHit){
   const contact=this.floor.weaponImpact(p.x,p.y,p.dir,reach);
   if(contact)this.sound(contact.cue,contact,{gain:.67,priority:2});
  }
  return true;
 }
 updateShots(dt){
  this.shots=this.shots.filter(shot=>{
   const distance=Math.min(shot.left,shot.speed*dt),steps=Math.max(1,Math.ceil(distance/6)),stride=distance/steps;
   for(let i=0;i<steps;i++){
    shot.x+=Math.cos(shot.angle)*stride;shot.y+=Math.sin(shot.angle)*stride;
    if(this.floor.wall(shot.x,shot.y)||this.floor.gateBlocked(shot.x,shot.y))return false;
    const enemy=this.enemies.find(e=>e.hp>0&&gap(e,shot)<radius(e)+5&&
     !this.floor.gateLineBlocked(shot.x,shot.y,e.x,e.y));
    if(enemy){this.weaponHit(enemy,shot.hit,shot.angle);return false;}
   }
   return (shot.left-=distance)>0;
  });
 }
 weaponHit(e,attack,angle){
  const {p,w,charged,amount,split}=attack,counter=e.counterUntil>this.clock,rolled=!counter&&this.random()<attack.crit;
  const crit=counter?charged?'fatal':'counter':rolled?'critical':'';
  const wet=this.floor.inRain(p.x,p.y)||this.floor.inRain(e.x,e.y);
  const hit=items.hit(amount*balance.hitMultiplier(charged,counter,rolled,w.critFactor),wet&&split.fire?{...split,fire:split.fire*.55}:split,this.resistances[e.type]);
  this.hurtEnemy(e,hit,p,crit,w.id);
  if(!hit.total)return;
  if(counter)e.counterUntil=0;
  const knock=foes.knockbackDistance(attack.impact,foes.balance(e.type,e.boss))*(w.projectile?.67:1);
  if(knock)this.move(e,Math.cos(angle)*knock,Math.sin(angle)*knock);
  if(e.hp>0&&w.status==='bleed'&&!(e.bleedUntil>this.clock)){
   e.bleedUntil=this.clock+3;this.hurtEnemy(e,items.hit(e.max*(.08+(w.statusLevel-1)*.02),{bleed:1},this.resistances[e.type]),p);
  }
  if(e.hp>0&&w.status==='poison'&&this.resistances[e.type].poison!==1&&!e.poison)this.poison(e,{untilTick:.72,ticks:3,power:1+(w.statusLevel-1)*.25,owner:p});
  if(p.equipment.rings.includes('faith'))p.hp=Math.min(maxHP(p),p.hp+3);
 }
 hurtEnemy(e,hit,p,critical='',weapon){
  if(e.hp<=0)return;
  const n=Math.min(e.hp,hit.total);
  if(n>0){
   e.hp-=n;e.dominant=hit.type;e.hit=.22;foes.alert(e);
   if(p){p.combatRecord.dealt+=n;if(critical)p.combatRecord[critical==='critical'?'crits':'counters']++;p.revision++;}
  }
  this.emit('hit',{x:round(e.x),y:round(e.y),value:n,type:hit.type,critical,enemyType:e.type,weapon});
 }
 hurtPlayer(p,n,split={physical:1},status=false,depth=foes.depthFactor(this.state.floor),cue){
  if(!p.online||p.inv>0&&!status||p.dash>0||this.floor.inRest(p.x,p.y))return false;
  const wet=this.floor.inRain(p.x,p.y)&&split.fire;
  const hit=items.hit(n*depth*p.guard,wet?{...split,fire:split.fire*.55}:split,p.resistance);
  if(hit.total<=0)return false;
  const {hp,taken,proc}=items.resolveArmorHit(p,p.equipment.armor,p.hp,maxHP(p),hit.total,status);
  const location={seat:p.seat,x:round(p.x),y:round(p.y)};
  p.hp=hp;p.combatRecord.taken+=taken;p.revision++;
  if(!status)p.inv=.75;
  if(proc==='block'){this.emit('armor',{...location,proc});return false;}
  p.dominant=hit.type;this.emit('hit',{...location,value:taken,type:hit.type,cue,pain:!status&&p.hp>0});
  if(proc)this.emit('armor',{...location,proc});
  if(p.hp<=0){this.sound('hero_fall',p,{priority:4,gain:.85});p.combatRecord.deaths++;if(p.trial)this.actions.finishTrial(p,false);this.resetAtRest(p);this.emit('death',{seat:p.seat});}
  return true;
 }
 poison(actor,opts){actor.poison={...opts};}
 tickPoison(actor,dt){
  const poison=actor.poison;if(!poison)return;
  if((poison.untilTick-=dt)>0)return;
  if(--poison.ticks<=0)actor.poison=null;
  else poison.untilTick=.72;
  const amount=7*(poison.power??1);
  if(actor.seat)this.hurtPlayer(actor,amount,{poison:1},true,1.1,'element_poison_tick');
  else this.hurtEnemy(actor,items.hit(amount,{poison:1},this.resistances[actor.type]),poison.owner);
 }
 bleed(p,amount){
  p.bleed=Math.min(100,p.bleed+amount);p.bleedGrace=2;
  if(p.bleed>=100){p.bleed=0;this.hurtPlayer(p,maxHP(p)*.16,{bleed:1},true,1,'element_bleed_hero');}
 }
 drop(pos,item,owner=0){
  if(this.orbs.size>=180)return false;
  const id=this.id();this.orbs.set(id,{id,seat:owner,x:round(pos.x),y:round(pos.y),item});
  return true;
 }
 defeat(e){
  const active=this.activePlayers();
  for(const p of active){p.kills++;p.revision++;}
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
    const x=origin.x+(p.seat===1?-13:13),pos=this.floor.valid(x,origin.y,4)?{x,y:origin.y}:origin;
    this.drop(pos,make(),p.seat);
   }
  };
  if(e.type!==foes.SNAKE&&items.enemyRarity(this.random(),this.state.floor))spawnPair(()=>selectLoot(items.enemyRarity(this.random()*.18,this.state.floor),this.state.floor,this.random));
  if(this.random()<.015)spawnPair(()=>cup('Gegnerbeute · Koop'));
  const bones=foes.boneDrop(e,this.random);
  if(bones)spawnPair(()=>bones,this.floor.boneDropPosition(e));
  this.emit('defeated',{x:e.x,y:e.y,type:e.type});
 }
}
