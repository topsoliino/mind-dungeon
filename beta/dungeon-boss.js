(root=>{
'use strict';
const name='Verhaltene Leute',introDuration=6.9;
const lines=[
 {at:0,name:'John B. Watson',text:'Euch hat wohl noch keiner die Angstkonditionierung beigebracht.'},
 {at:2.9,name:'Edward Lee Thorndike',text:'law of GET REKT'},
 {at:4.5,name:'B. F. Skinner',text:'Bestrafung... Typ I'}
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
 const battle=()=>save.bossBattle??={phase:'sealed',time:0,altars:[false,false],waves:0,cues:[],last:-1};
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
  const count=hooks.players().length;
  hooks.spawn(scientists.map((_,i)=>makeActor('behaviorist-'+i,'scientist',hooks.types.SKELETON,
   {x:arena.x-(i===1?108:158),y:arena.y+(i-1)*92},count>1?410:250,1.17,
   {scientist:i,warded:true,nextAttack:1+i*.8,boss:true})));
  hooks.changed('intro');
 }
 function startWave(){
  const s=battle(),wave=++s.waves,count=(hooks.players().length>1?5:3)+wave;
  hooks.spawn(Array.from({length:count},(_,i)=>{
   const p=arena.vents[i%arena.vents.length],spawn=point(p,aim(p,arena),26+Math.floor(i/arena.vents.length)*25);
   return makeActor('behaviorist-wave-'+wave+'-'+i,'rat',hooks.types.RAT,spawn,hooks.players().length>1?32:21,.62,{emerge:.42});
  }));
  s.nextWave=null;
 }
 function moveToward(e,p,dt,speed){
  const d=gap(e,p),angle=aim(e,p);
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
  const cycle=Math.floor(s.time/4.2),t=s.time%4.2;
  const vertices=Array.from({length:3},(_,i)=>point(arena,cycle*.78+i*TAU/3,arena.radius*.57));
  for(const e of people()){
   e.phase+=dt;
   e.bossPose=t<2.15?null:'plant';
   if(t<2.15)moveToward(e,vertices[e.scientist],dt,250);
   else e.moving=false;
  }
  if(t>=2.15&&s.pulseCycle!==cycle){
   s.pulseCycle=cycle;
   cue('triangle',{points:people().map(({x,y})=>({x,y})),outside:cycle%2===1},1.05,.46);
  }
 }
 function distanceTo(edge,limit,p){return point(edge,aim(edge,p),Math.min(limit,gap(edge,p)));}
 function startMove(e,target){
  const s=battle(),large=e.enlarged,moves=large?['spear','spin','beam','storm']:['spear','storm','spear'];
  const kind=moves[(e.moveCount??e.scientist)%moves.length];e.moveCount=(e.moveCount??e.scientist)+1;
  const start={x:e.x,y:e.y},angle=aim(e,target);
  e.angle=angle;e.moving=false;
  e.bossPose=kind==='storm'?'raise':kind==='spin'?null:'thrust';
  const origin={source:scientists[e.scientist],action:{spear:'Elektrodenstich',storm:'Dreifachblitz',spin:'Elektrodenkreisel',beam:'Blitzstrahl'}[kind]};
  if(kind==='storm'){
   [0,.53,1.06].forEach((delay,i)=>cue('storm',{...start,r:104,damage:14,origin,bolt:i},.83+delay,.38));
   e.nextAttack=s.time+2.72;return;
  }
  if(kind==='spin'){
   e.spin={start:s.time+1.05,end:s.time+3.25,angle,next:s.time+1.05,origin};
   cue('spin',{...start,r:65,origin},1.05,.12);
   e.nextAttack=s.time+3.68;return;
  }
  const length=kind==='beam'?255:large?116:96;
  const fire=(dir,delay)=>cue(kind,{from:start,to:distanceTo(arena,arena.radius-12,point(start,dir,length)),
   width:kind==='beam'?18:19,damage:kind==='beam'?17:13,origin},delay,.28);
  if(kind==='beam'){fire(angle-.13,.77);fire(angle+.15,1.18);}
  else fire(angle,.44);
  e.nextAttack=s.time+(kind==='beam'?1.78:1.12);
 }
 function fight(dt){
  const s=battle(),targets=party();
  for(const e of people()){
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
   if(gap(e,target)>115){e.bossPose=null;moveToward(e,target,dt,e.enlarged?136:99);continue;}
   if(s.time>=e.nextAttack)startMove(e,target);
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
   if(c.done||s.time<c.hit)continue;
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
  if(s.killed===1){
   s.rain=true;
   const p=point(arena,Math.PI*.83,arena.radius*.77);
   hooks.spawn([makeActor('behaviorist-giant-rat','giant-rat',hooks.types.ELECTRO_RAT,p,hooks.players().length>1?250:155,1.89)]);
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
   Object.assign(s,{phase:'ready',rain:false,time:0,waves:0,killed:0,last:-1,lastOrder:0,deathOrder:0,cues:[],nextWave:null,pulseCycle:null});
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
