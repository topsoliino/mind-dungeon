(root=>{
'use strict';
const name='Verhaltene Leute',introDuration=12;
const lines=[
 {at:.8,name:'John B. Watson',text:'Euch hat wohl noch keiner die Angstkonditionierung beigebracht.'},
 {at:5.2,name:'Edward Lee Thorndike',text:'law of GET REKT'},
 {at:8.2,name:'B. F. Skinner',text:'Bestrafung... Typ I'}
];
const scientists=['B. F. Skinner','John B. Watson','Edward Lee Thorndike'];
const pools=[[1,2],[3,4],[5,6],[1,2,3,4],[7,8],[9,10],[7,8,9,10],[11],[12],
 [1,2,3,4,5,6,7,8,9,10],[1,2,3,4,5,6,7,8,9,10,11,12]];
const pellet={kind:'food',id:'pellet',rarity:'common',source:name};
const rewards=['','white-rabbit','lucky-cat'];
const rewardNames={'white-rabbit':'Weißer Kaninchentalisman','lucky-cat':'Orange Glückskatze'};
const note={kind:'bossNote',id:'behaviorists',stock:'boss-note',rarity:'common',source:'Fledermaushändler',price:50};
const assign=(order,packId)=>order.includes(packId)?order.indexOf(packId)+1:order.push(packId);
const candidates=ordinal=>pools[Math.min(pools.length,Math.max(1,Math.floor(ordinal)||1))-1].slice();
const choose=(ordinal,random)=>{const pool=candidates(ordinal);return pool[Math.floor(random()*pool.length)];};
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=(a,angle,r)=>({x:a.x+Math.cos(angle)*r,y:a.y+Math.sin(angle)*r});
const aim=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const TAU=2*Math.PI;
const formations=[
 [[-.67,-.15],[.55,-.40],[.10,.69]],
 [[-.73,.35],[.70,.27],[.31,-.33]],
 [[-.52,-.61],[.22,-.41],[.54,.50]],
 [[-.61,-.29],[.70,-.13],[-.48,.51]],
 [[-.32,-.74],[.35,.42],[-.32,.70]]
];
function triangleContains(points,p){
 const cross=([a,b])=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
 const signs=points.map((a,i)=>cross([a,points[(i+1)%3]]));
 return signs.every(n=>n>=0)||signs.every(n=>n<=0);
}
function inLine(p,from,to,width){
 const dx=to.x-from.x,dy=to.y-from.y,d2=dx*dx+dy*dy;
 const t=d2?Math.max(0,Math.min(1,((p.x-from.x)*dx+(p.y-from.y)*dy)/d2)):0;
 return Math.hypot(p.x-from.x-t*dx,p.y-from.y-t*dy)<=width;
}
function gateClosed(battle){return !['ready','won'].includes(battle?.phase);}
function resistance(e,base){
 if(e.bossRole==='giant-rat')return {...base,lightning:.4};
 if(e.bossRole==='scientist')return {...base,physical:e.enlarged?.2:0,lightning:e.enlarged?.35:.2};
 return base;
}
function create(arena,save,hooks){
 if(!arena)return null;
 const testAccess=hooks.testAccess===true;
 const battle=()=>save.bossBattle??={phase:testAccess?'ready':'sealed',time:0,altars:[testAccess,testAccess],waves:0,cues:[],last:-1};
 battle();
 const inside=p=>arena.id===hooks.region(p);
 const actors=()=>hooks.enemies().filter(e=>e.bossRole&&e.hp>0);
 const people=()=>actors().filter(e=>e.bossRole==='scientist');
 const party=()=>hooks.players().filter(inside);
 const setAltar=i=>{const s=battle();if(s.phase==='sealed'&&Number.isInteger(i)&&i>=0&&i<2)s.altars[i]=true;};
 const cue=(kind,shape,delay,life=.35)=>battle().cues.push({kind,...shape,start:battle().time,hit:battle().time+delay,end:battle().time+delay+life});
 const inCombat=()=>['intro','waves','fight'].includes(battle().phase);
 function teleport(p,index){
  const landing={x:arena.x+arena.radius*.38,y:arena.y+(index?31:-31)};
  hooks.teleport(p,landing);
 }
 function makeActor(id,bossRole,type,p,max,size,extra={}){
  return {id,bossRole,type,...p,hp:max,max,size,roomId:arena.id,phase:0,attack:.55,hit:0,angle:0,windup:0,alerted:true,...extra};
 }
 function introduce(){
  const s=battle();
  s.phase='intro';s.time=0;s.cues=[];
  hooks.players().forEach(teleport);
  const health=hooks.players().length>1?410:250;
  s.scientistMax=scientists.length*health;
  hooks.spawn(scientists.map((_,i)=>makeActor('behaviorist-'+i,'scientist',hooks.types.SKELETON,
   {x:arena.x-(i===1?108:158),y:arena.y+(i-1)*92},health,1.17,
   {scientist:i,warded:true,nextAttack:1+i*.8,boss:true})));
  hooks.changed('intro');
 }
 function startWave(){
  const s=battle(),wave=++s.waves,coop=hooks.players().length>1;
  const count=(coop?5:3)+wave,health=coop?32:21;
  s.waveMax=count*health;
  hooks.spawn(Array.from({length:count},(_,i)=>{
   const vent=(Math.floor(i*arena.vents.length/count)+wave-1)%arena.vents.length;
   const p=arena.vents[vent],spawn=point(p,aim(p,arena),23+Math.floor(i/arena.vents.length)*25);
   return makeActor('behaviorist-wave-'+wave+'-'+i,'rat',hooks.types.RAT,spawn,health,.62,{emerge:.42});
  }));
  s.nextWave=null;
 }
 function moveToward(e,p,dt,speed,neighbors=[]){
  const d=gap(e,p);
  let x=p.x-e.x,y=p.y-e.y;
  for(const other of neighbors){
   const spacing=gap(e,other);
   if(e===other||spacing>=86)continue;
   const angle=spacing>1?aim(other,e):e.scientist*TAU/3;
   x+=Math.cos(angle)*(86-spacing)*2.6;y+=Math.sin(angle)*(86-spacing)*2.6;
  }
  const angle=Math.atan2(y,x);
  e.angle=angle;e.moving=d>2;
  if(e.moving)hooks.move(e,Math.cos(angle)*Math.min(d,speed*dt),Math.sin(angle)*Math.min(d,speed*dt));
 }
 function experiment(dt){
  const s=battle();
  if(!actors().some(e=>e.bossRole==='rat')){
   if(s.waves===3){
    s.phase='fight';s.cues=[];s.time=0;
    people().forEach(e=>{e.warded=false;e.bossPose=null;});
    hooks.changed('fight');return;
   }
   s.nextWave??=s.time+.72;
   if(s.time>=s.nextWave)startWave();
  }
  const duration=5.35,cycle=Math.floor(s.time/duration),t=s.time%duration;
  if(s.formation?.cycle!==cycle){
   const previous=s.formation?.kind??-1;
   const options=formations.map((_,i)=>i).filter(i=>i!==previous);
   const kind=options[Math.floor(hooks.random()*options.length)],rotation=hooks.random()*TAU;
   s.formation={cycle,kind,outside:hooks.random()<.5,vertices:formations[kind].map(([x,y])=>
    point(arena,Math.atan2(y,x)+rotation,Math.hypot(x,y)*arena.radius))};
  }
  const {vertices,outside}=s.formation;
  for(const e of people()){
   e.phase+=dt;
   e.bossPose=t<2.85?null:'plant';
   if(t<2.85)moveToward(e,vertices[e.scientist],dt,256);
   else e.moving=false;
  }
  if(t>=2.85&&s.pulseCycle!==cycle){
   s.pulseCycle=cycle;
   cue('triangle',{points:people().map(({x,y})=>({x,y})),outside},1.07,.46);
  }
 }
 function distanceTo(edge,limit,p){return point(edge,aim(edge,p),Math.min(limit,gap(edge,p)));}
 function beamEnd(from,angle){
  const x=from.x-arena.x,y=from.y-arena.y,r=arena.radius-5;
  const along=x*Math.cos(angle)+y*Math.sin(angle);
  return point(from,angle,Math.max(0,-along+Math.sqrt(Math.max(0,along*along+r*r-x*x-y*y))));
 }
 function startMove(e,target,kind){
  const s=battle(),large=e.enlarged,wet=s.rain;
  const start={x:e.x,y:e.y},angle=aim(e,target);
  e.angle=angle;e.moving=false;
  e.bossPose=kind==='storm'?'raise':kind==='spin'?null:'thrust';
  const origin={source:scientists[e.scientist],action:{spear:'Elektrodenstich',storm:'Dreifachblitz',spin:'Elektrodenkreisel',beam:'Blitzstrahl'}[kind]};
  if(kind==='storm'){
   [0,.56,1.12].forEach((delay,i)=>cue('storm',{...start,r:wet?(large?165:146):104,damage:14,origin,bolt:i,
    scientist:e.scientist},.82+delay,.46));
   e.nextAttack=s.time+2.64;return;
  }
  if(kind==='spin'){
   e.spin={start:s.time+1.05,end:s.time+3.25,angle,next:s.time+1.05,origin};
   cue('spin',{...start,r:65,origin},1.05,.12);
   e.nextAttack=s.time+3.68;return;
  }
  if(kind==='beam'){
   const count=large?4:wet?3:2,interval=wet?.34:.5,lead=wet?.56:.73;
   for(let i=0;i<count;i++){
    const direction=angle+(i%2?1:-1)*(.08+i*.035);
    cue('beam',{from:start,to:beamEnd(start,direction),angle:direction,width:wet?27:21,damage:wet?15:13,origin,
     scientist:e.scientist,volley:i,startDelay:i*interval,tracking:wet?1.2:.34},lead+i*interval,.23);
   }
   e.nextAttack=s.time+lead+(count-1)*interval+.53;
   return;
  }
  cue('spear',{from:start,to:distanceTo(arena,arena.radius-12,point(start,angle,large?116:96)),
   width:19,damage:13,origin,scientist:e.scientist},.44,.28);
  e.nextAttack=s.time+(wet?.96:1.12);
 }
 function frontLine(s,team){
  if(s.front?.size!==team.length||s.time>=s.front.until){
   const turn=(s.front?.turn??-1)+1;
   const first=(turn+(s.firstAttacker??=Math.floor(hooks.random()*3)))%team.length;
   const ids=[team[first].id];
   if(team.length===3&&hooks.random()<.34)ids.push(team[(first+1)%team.length].id);
   s.front={ids,turn,size:team.length,until:s.time+6.8};
  }
  return s.front.ids;
 }
 function firingPosition(e,team,targets){
  const stations=Array.from({length:12},(_,index)=>({
   ...point(arena,index*TAU/12+Math.PI/12,arena.radius*(index%2?.70:.60)),index
  }));
  const priority=p=>Math.min(...targets.map(t=>gap(p,t)))-gap(e,p)*.15+
   Math.min(190,...team.filter(a=>a!==e).map(a=>Math.min(gap(p,a),a.station?gap(p,a.station)+10:Infinity)))*1.4;
  const choices=stations.filter(p=>p.index!==e.lastStation).sort((a,b)=>priority(b)-priority(a));
  return choices[Math.floor(hooks.random()*3)];
 }
 function aimBeams(dt,s,targets){
  for(const c of s.cues){
   if(c.kind!=='beam'||!c.tracking||s.time<c.start+c.startDelay||s.time>=c.hit-.13)continue;
   const target=targets.reduce((best,p)=>!best||gap(c.from,p)<gap(c.from,best)?p:best,null);
   if(!target)continue;
   const difference=aim(c.from,target)-c.angle,turn=Math.atan2(Math.sin(difference),Math.cos(difference)),limit=c.tracking*dt;
   c.angle+=Math.max(-limit,Math.min(limit,turn));c.to=beamEnd(c.from,c.angle);
  }
 }
 function fight(dt){
  const s=battle(),targets=party(),team=people();
  for(const e of actors()){
   const entry=e.bossEntrance;
   if(!entry)continue;
   const t=Math.min(1,(s.time-entry.start)/(entry.end-entry.start));
   e.x=entry.from+(entry.to-entry.from)*t;e.y=arena.gate.y;
   e.phase+=dt;e.moving=true;
   if(t===1){e.bossEntrance=null;e.warded=false;}
  }
  if(!team.length)return;
  const front=frontLine(s,team);
  aimBeams(dt,s,targets);
  for(const e of team){
   const target=targets.reduce((nearest,p)=>!nearest||gap(e,p)<gap(e,nearest)?p:nearest,null);
   if(!target)continue;
   e.phase+=dt;
   const spin=e.spin;
   if(spin&&s.time<spin.start)e.angle+=dt*(1+4*Math.max(0,s.time-spin.start+1.05));
   if(spin&&s.time>=spin.start&&s.time<spin.end){
    const progress=Math.min(1,(s.time-spin.start)/.65),speed=115+progress*185;
    spin.angle+=dt*.75;
    const next=point(e,spin.angle,dt*speed);
    if(gap(next,arena)>arena.radius-39)spin.angle=aim(e,arena)+(e.scientist-1)*.7;
    hooks.move(e,Math.cos(spin.angle)*speed*dt,Math.sin(spin.angle)*speed*dt);
    e.angle+=dt*(9+progress*17);e.moving=true;
    if(s.time>=spin.next){spin.next=s.time+.32;shock(targets.filter(p=>gap(e,p)<=65),16,spin.origin,e);}
    continue;
   }
   if(spin&&s.time>=spin.end)e.spin=null;
   if(s.time<e.nextAttack-.38){e.moving=false;continue;}
   const speed=s.rain?(e.enlarged?170:152):115;
   if(!front.includes(e.id)){
    e.station??=firingPosition(e,team,targets);
    e.bossPose=null;
    if(gap(e,e.station)>19){moveToward(e,e.station,dt,speed,team);continue;}
    if(s.time>=e.nextAttack){
     e.lastStation=e.station.index;e.station=null;
     startMove(e,target,'beam');
    }
    continue;
   }
   e.station=null;
   const moves=e.enlarged?['spear','spin','beam','storm']:['spear','storm','spear'];
   const turn=e.moveCount??e.scientist,kind=moves[turn%moves.length];
   const reach=kind==='beam'?arena.radius*2:kind==='storm'?(s.rain?128:93):kind==='spear'?85:126;
   if(gap(e,target)>reach){
    e.bossPose=null;
    const ally=team.find(a=>a!==e&&front.includes(a.id));
    const flank=ally?point(target,aim(target,ally)+Math.PI*.73,Math.min(68,reach*.65)):target;
    moveToward(e,distanceTo(arena,arena.radius-33,flank),dt,speed,team);continue;
   }
   if(gap(e,target)<38){moveToward(e,point(target,aim(target,e),62),dt,speed*.7,team);continue;}
   if(s.time>=e.nextAttack){e.moveCount=turn+1;startMove(e,target,kind);}
  }
 }
 function shock(targets,damage,origin,wetPoint){
  for(const p of targets)hooks.hit(p,damage,origin);
  if(wetPoint)hooks.spread(wetPoint,damage);
  else for(const p of targets)hooks.spread(p,damage);
 }
 function resolveCues(){
  const s=battle(),targets=party();
  for(const c of s.cues){
   if(s.time<c.hit)continue;
   if(c.kind==='storm'&&Object.hasOwn(c,'scientist')){
    const radius=c.r*Math.min(1,(s.time-c.hit+.035)/.31);
    c.hitPlayers??=[];
    targets.forEach((p,i)=>{
     const playerId=p.seat??i;
     if(c.hitPlayers.includes(playerId)||gap(c,p)>radius)return;
     c.hitPlayers.push(playerId);hooks.hit(p,c.damage,c.origin);
    });
    if(!c.done){c.done=true;hooks.spread(c,c.damage);}
    continue;
   }
   if(c.done)continue;
   c.done=true;
   if(c.kind==='spin')continue;
   if(c.kind==='triangle'){
    shock(targets.filter(p=>triangleContains(c.points,p)!==c.outside),17,{source:name,action:'Elektrodendreieck'});
   }else if(c.kind==='storm'){
    shock(targets.filter(p=>gap(c,p)<=c.r),c.damage,c.origin,c);
   }else{
    shock(targets.filter(p=>inLine(p,c.from,c.to,c.width)),c.damage,c.origin,c.to);
   }
  }
  s.cues=s.cues.filter(c=>s.time<c.end);
 }
 function markDeath(e){
  if(e.bossRole==='scientist'&&!e.deathOrder)e.deathOrder=battle().deathOrder=(battle().deathOrder??0)+1;
 }
 function defeat(e){
  const s=battle();
  if(e.bossRole==='rat'){if(hooks.random()<1/3)hooks.drop(e,pellet,1);return;}
  if(e.bossRole==='giant-rat'){hooks.drop(e,pellet,3);return;}
  if(e.bossRole!=='scientist')return;
  markDeath(e);
  if(e.deathOrder>(s.lastOrder??0)){s.lastOrder=e.deathOrder;s.last=e.scientist;}
  s.killed=(s.killed??0)+1;
  s.cues=s.cues.filter(c=>c.done||c.scientist!==e.scientist);
  if(s.killed===1){
   s.rain=true;
   const from=arena.gate.x+48,to=arena.gate.x-114,end=s.time+.82;
   s.ratGateUntil=end;
   hooks.spawn([makeActor('behaviorist-giant-rat','giant-rat',hooks.types.ELECTRO_RAT,
    {x:from,y:arena.gate.y},hooks.players().length>1?250:155,1.89,
    {warded:true,angle:Math.PI,bossEntrance:{start:s.time,end,from,to}})]);
   hooks.changed('rain');
  }else if(s.killed===2){
   const last=people()[0];
   if(last){last.enlarged=true;last.size=1.82;last.nextAttack=s.time+.7;last.moveCount=1;}
  }
 }
 function step(dt){
  const s=battle();
  if(s.phase==='sealed'&&s.altars.every(Boolean)&&!hooks.enemies().some(e=>e.hp>0&&!e.bossRole)){
   s.phase='ready';hooks.changed('ready');
  }
  if(s.phase==='ready'&&hooks.players().some(inside))introduce();
  if(!inCombat())return;
  const players=hooks.players();
  if(!players.some(inside)&&s.phase!=='intro'){
   for(const e of hooks.enemies())if(e.bossRole)e.bossDiscard=true;
   Object.assign(s,{phase:'ready',rain:false,time:0,waves:0,killed:0,last:-1,lastOrder:0,deathOrder:0,cues:[],
    nextWave:null,pulseCycle:null,formation:null,front:null,firstAttacker:null,ratGateUntil:null});
   hooks.changed('retry');return;
  }
  players.forEach((p,i)=>{if(!inside(p)&&!p.deathRecap)teleport(p,i);});
  s.time+=dt;
  if(s.phase==='intro'){
   if(s.time>=introDuration){s.phase='waves';s.time=0;startWave();hooks.changed('waves');}
   return;
  }
  if(s.phase==='waves')experiment(dt);else fight(dt);
  resolveCues();
  if(s.phase==='fight'&&!actors().length){
   s.phase='won';s.cues=[];
   hooks.win(arena,rewards[s.last]);hooks.changed('won');
  }
 }
 return {step,defeat,markDeath,setAltar,inCombat};
}
root.DungeonBoss={name,scientists,lines,introDuration,pools,candidates,choose,assign,pellet,note,rewardNames,
 create,gateClosed,resistance,triangleContains};
})(typeof window==='undefined'?globalThis:window);
