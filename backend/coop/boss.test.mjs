import assert from 'node:assert/strict';
import test from 'node:test';
import {run,bossRules,defaultPack,makePlayer,items,geometry} from './rules.mjs';
import {Simulation} from './simulation.mjs';
import {actions} from './actions.mjs';
import {createProjection} from './network.mjs';

const stepUntil=(sim,condition,seconds=14)=>{
 for(let i=0;i<seconds*30&&!condition();i++)sim.step(1/30);
 assert.ok(condition());
};
const answerFor=q=>q.type==='multiple-choice'?q.correctIndices:q.type==='free-text'?q.answers[0]:q.correctIndex;
const party=(count=2,depth=1)=>{
 const players=Array.from({length:count},(_,i)=>makePlayer(i+1,{},defaultPack));
 players.forEach(p=>{p.online=true;p.attributes.vigor=1000;});
 const sim=new Simulation(193,players,{random:()=>.21},depth);
 sim.actions=actions(sim);
 return {sim,players};
};
const kill=(sim,e)=>sim.hurtEnemy(e,items.hit(10000,{physical:1},{}),sim.players[0]);

test('boss pools follow each learner’s study order and stay seeded',()=>{
 const order=['my-first-deck'];
 assert.equal(bossRules.assign(order,'another-deck'),2);
 assert.equal(bossRules.assign(order,'my-first-deck'),1);
 assert.deepEqual([...bossRules.candidates(4)],[1,2,3,4]);
 assert.deepEqual([...bossRules.candidates(7)],[7,8,9,10]);
 assert.deepEqual([...bossRules.candidates(8)],[11]);
 assert.deepEqual([...bossRules.candidates(9)],[12]);
 assert.equal(bossRules.candidates(10).length,10);
 assert.equal(bossRules.candidates(80).length,12);
 assert.equal(bossRules.choose(7,run.random(191)),bossRules.choose(7,run.random(191)));
});

test('the boss arena is reachable through its laboratory corridor and older floors keep their layouts',()=>{
 for(const seed of [8,103,193]){
  const state=run.freshRun(seed),floor=geometry.build(run,state),arena=floor.bossArena;
  assert.ok(arena.altars.every(p=>floor.canReachSpawn(p.x,p.y)));
  assert.ok(arena.vents.every(p=>floor.regionAt(p.x,p.y)===arena.id));
  assert.ok(floor.gateBlocked(arena.gate.x,arena.gate.y));
  state.bossBattle={phase:'ready'};
  assert.equal(floor.gateBlocked(arena.gate.x,arena.gate.y),false);
 }
 const legacy=run.freshRun(193);legacy.layoutRevision=10;
 assert.equal(geometry.build(run,legacy).bossArena,null);
});

test('the coop boss gate needs two correct answers and a cleared floor, then the shared fight yields Watson’s trophy',()=>{
 const {sim,players:[host,guest]}=party();
 const {state,floor}=sim,{bossArena:arena}=floor,battle=state.bossBattle;
 assert.equal(battle.phase,'sealed');
 sim.enemies.splice(1);
 for(const [i,p] of [host,guest].entries()){
  Object.assign(p,arena.altars[i]);
  let q=sim.actions.dispatch(p,'quiz',{reason:'boss-altar',index:i});
  if(i===0){
   const wrong=p.quiz.q.type==='free-text'?'?':p.quiz.q.type==='multiple-choice'?[]:(p.quiz.q.correctIndex+1)%p.quiz.q.choices.length;
   assert.equal(sim.actions.dispatch(p,'answer',{quiz:q.quiz,choice:wrong}).ok,false);
   assert.equal(battle.altars[i],false);
   sim.actions.dispatch(p,'review',{quiz:q.quiz,color:'red'});
   q=sim.actions.dispatch(p,'quiz',{reason:'boss-altar',index:i});
  }
  assert.equal(sim.actions.dispatch(p,'answer',{quiz:q.quiz,choice:answerFor(p.quiz.q)}).ok,true);
  sim.actions.dispatch(p,'review',{quiz:q.quiz,color:'yellow'});
 }
 sim.step(1/30);
 assert.equal(battle.phase,'sealed');
 assert.equal(sim.portal,null);
 sim.enemies=[];
 sim.step(1/30);
 assert.equal(battle.phase,'ready');
 Object.assign(host,{x:arena.gate.x-105,y:arena.gate.y});
 sim.step(1/30);
 assert.equal(battle.phase,'intro');
 assert.equal(battle.scientistMax,3*410);
 assert.equal(floor.regionAt(guest.x,guest.y),arena.id);
 assert.ok(floor.gateBlocked(arena.gate.x,arena.gate.y));
 assert.equal(sim.charge(host,0),false);
 assert.equal(createProjection()(sim,guest,true).bossBattle.phase,'intro');
 stepUntil(sim,()=>battle.waves===1);
 let rats=sim.enemies.filter(e=>e.bossRole==='rat');
 const early=sim.enemies.find(e=>e.bossRole==='scientist');
 kill(sim,early);
 assert.equal(early.hp,early.max);
 for(let wave=1;wave<=3;wave++){
  assert.equal(rats.length,5+wave);
  assert.equal(battle.waveMax,(5+wave)*32);
  rats.forEach(e=>kill(sim,e));
  stepUntil(sim,()=>battle.waves> wave||battle.phase==='fight');
  rats=sim.enemies.filter(e=>e.bossRole==='rat');
 }
 assert.equal(battle.waves,3);
 assert.equal(battle.phase,'fight');
 const scientists=sim.enemies.filter(e=>e.bossRole==='scientist');
 kill(sim,scientists[0]);sim.step(1/30);
 assert.equal(battle.rain,true);
 const wet=arena.puddles[0];
 assert.equal(floor.waterAt(wet.x,wet.y),'boss-water');
 assert.equal(floor.waterLightning({lightning:1},wet.x,wet.y).lightning,1.35);
 const rat=sim.enemies.find(e=>e.bossRole==='giant-rat');
 assert.ok(rat.x>arena.gate.x);
 assert.ok(rat.warded);
 stepUntil(sim,()=>rat.bossEntrance===null,2);
 assert.ok(rat.x<arena.gate.x);
 assert.equal(floor.regionAt(rat.x,rat.y),arena.id);
 assert.ok(floor.gateBlocked(arena.gate.x,arena.gate.y));
 const lootBefore=sim.orbs.size;
 kill(sim,rat);sim.step(1/30);
 assert.equal(sim.orbs.size-lootBefore,6);
 assert.ok([...sim.orbs.values()].slice(-6).every(o=>o.item.id==='pellet'));
 kill(sim,scientists[2]);sim.step(1/30);
 const watson=scientists[1];
 assert.equal(watson.enlarged,true);
 assert.equal(sim.resistanceFor(watson).lightning,.35);
 kill(sim,watson);sim.step(1/30);
 assert.equal(battle.phase,'won');
 assert.ok(sim.portal);
 assert.deepEqual(host.bossRewards,['white-rabbit']);
 assert.deepEqual(guest.bossRewards,['white-rabbit']);
});

test('small rats roll one chance in three and the merchant note costs 50 gold on floor two',()=>{
 const drops=[],rolls=[0,1/3,.85,.25];
 const encounter=bossRules.create({}, {},{random:()=>rolls.shift(),drop:(_,it,count)=>drops.push([it.id,count])});
 const rodent={bossRole:'rat'};
 for(let i=0;i<4;i++)encounter.defeat(rodent);
 assert.deepEqual(drops,[['pellet',1],['pellet',1]]);
 assert.equal(items.food.pellet.heal,30);
 const {sim,players:[p]}=party(1,2);
 Object.assign(p,sim.floor.merchant,{gold:50});
 const stock=sim.actions.dispatch(p,'interact',{kind:'merchant'}).stock.gold;
 assert.equal(stock.find(o=>o.stock==='boss-note').price,50);
 sim.actions.dispatch(p,'buy',{stock:'boss-note'});
 assert.equal(p.gold,0);
 assert.equal(p.inventory.at(-1).kind,'bossNote');
});

test('waves use different sides and independently roll the triangle arrangement and color',()=>{
 const vents=Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4)*380,y:Math.sin(i*Math.PI/4)*380}));
 const arena={x:0,y:0,id:65,radius:432,vents};
 const edge={x:404,y:0},hits=[],spawned=[],seen=new Map();
 const rolls=[.05,.15,.21,.63,.25,.38,.86,.81,.92];
 const save={};
 const encounter=bossRules.create(arena,save,{
  players:()=>[edge],enemies:()=>spawned,region:()=>65,types:{SKELETON:3,RAT:13},
  random:()=>rolls.shift()??.71,
  spawn:rows=>spawned.push(...rows),changed:()=>{},teleport:()=>{},spread:()=>{},
  move:(e,x,y)=>{e.x+=x;e.y+=y;},
  hit:(p,damage,origin)=>hits.push({p,damage,origin})
 });
 encounter.setAltar(0);encounter.setAltar(1);
 for(let i=0;i<850;i++){
  encounter.step(1/30);
  const cue=save.bossBattle.cues.find(c=>c.kind==='triangle');
  if(cue)seen.set(cue.start,cue);
 }
 assert.equal(save.bossBattle.phase,'waves');
 assert.deepEqual([...seen.values()].map(c=>c.outside),[true,true,false]);
 assert.equal(hits.length,2);
 assert.ok(hits.every(hit=>hit.p===edge&&hit.origin.action==='Elektrodendreieck'));
 const triangleSignatures=[...seen.values()].map(({points:[a,b,c]})=>
  [[a,b],[a,c],[b,c]].map(([p,q])=>Math.round(Math.hypot(p.x-q.x,p.y-q.y))).sort().join(':'));
 assert.equal(new Set(triangleSignatures).size,3);
 const rats=spawned.filter(e=>e.bossRole==='rat');
 assert.ok(rats.some(p=>p.x>150)&&rats.some(p=>p.x< -150)&&rats.some(p=>p.y>150)&&rats.some(p=>p.y< -150));
});

test('the enlarged scientist uses a moving spin, four aimed beams and three wider lightning strikes',()=>{
 const arena={x:0,y:0,id:65,radius:432};
 const hero={x:310,y:0},boss={x:257,y:0,id:'last',scientist:2,bossRole:'scientist',enlarged:true,hp:60,
  moveCount:1,nextAttack:0,angle:0,phase:0};
 const save={bossBattle:{phase:'fight',time:0,cues:[],waves:3,rain:true}};
 const encounter=bossRules.create(arena,save,{
  players:()=>[hero],enemies:()=>[boss],region:()=>65,hit:()=>{},spread:()=>{},teleport:()=>{},random:()=>.6,
  move:(e,x,y)=>{e.x+=x;e.y+=y;}
 });
 const beam=new Set(),bolt=new Set();let rotated=false,moved=false;
 for(let i=0;i<500;i++){
  if(!boss.spin){hero.x=boss.x+60;hero.y=boss.y;}
  encounter.step(1/30);
  rotated||=Boolean(boss.spin&&Math.abs(boss.angle)>Math.PI);
  moved||=Boolean(boss.spin&&Math.hypot(boss.x-257,boss.y)>100);
  for(const cue of save.bossBattle.cues){
   if(cue.kind==='beam')beam.add(cue.hit);
   if(cue.kind==='storm'){bolt.add(cue.bolt);assert.equal(cue.r,165);}
  }
 }
 assert.ok(rotated&&moved);
 assert.ok(beam.size>=4);
 assert.deepEqual([...bolt].sort(),[0,1,2]);
});

test('scientists split into chasers and roaming shooters, with faster tracking and longer volleys in rain',()=>{
 function drill(wet,random){
  const arena={x:0,y:0,id:65,radius:432};
  const hero={x:35,y:0},team=[{x:-90,y:42},{x:-120,y:0},{x:-90,y:-42}].map((pos,scientist)=>
   ({...pos,scientist,id:'scientist-'+scientist,bossRole:'scientist',hp:100,nextAttack:.4+scientist*.3,phase:0}));
  const save={bossBattle:{phase:'fight',time:0,cues:[],waves:3,rain:wet}};
  const encounter=bossRules.create(arena,save,{
   players:()=>[hero],enemies:()=>team,region:()=>65,hit:()=>{},spread:()=>{},teleport:()=>{},random:()=>random,
   move:(e,x,y)=>{e.x+=x;e.y+=y;}
  });
  const groups=new Map(),stations=new Set(),frontCounts=new Set(),tracking=new Map();
  for(let i=0;i<480;i++){
   const t=i/30;
   hero.y=Math.sin(t*3.6)*60;
   encounter.step(1/30);
   frontCounts.add(save.bossBattle.front.ids.length);
   for(const c of save.bossBattle.cues){
    if(c.kind!=='beam')continue;
    const key=c.scientist+':'+c.start;
    const group=groups.get(key)??new Set();group.add(c.hit);groups.set(key,group);
    stations.add(Math.round(c.from.x/14)+':'+Math.round(c.from.y/14));
    const length=Math.hypot(c.to.x-c.from.x,c.to.y-c.from.y);
    assert.ok(Math.abs(Math.hypot(c.to.x,c.to.y)-(arena.radius-5))<1e-6);
    assert.ok(length>260);
    const angleKey=key+':'+c.volley, angles=tracking.get(angleKey)??[];
    if(angles.length&&save.bossBattle.time>=c.hit-.13)assert.equal(c.angle,angles.at(-1));
    angles.push(c.angle);tracking.set(angleKey,angles);
   }
  }
  const maxTurn=Math.max(...[...tracking.values()].flatMap(angles=>angles.slice(1).map((a,i)=>Math.abs(a-angles[i]))));
  return {count:Math.max(...[...groups.values()].map(group=>group.size)),stations:stations.size,frontCounts,maxTurn};
 }
 const dry=drill(false,.6),wet=drill(true,.21);
 assert.deepEqual([...dry.frontCounts],[1]);
 assert.deepEqual([...wet.frontCounts],[2]);
 assert.equal(dry.count,2);
 assert.equal(wet.count,3);
 assert.ok(dry.stations>=3&&wet.stations>=2);
 assert.ok(wet.maxTurn>dry.maxTurn);
});
