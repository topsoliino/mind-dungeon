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

test('the experiment alternates between shocking inside and outside the electrode triangle',()=>{
 const arena={x:0,y:0,id:65,radius:432,vents:[{x:-350,y:0}]};
 const center={x:0,y:0},edge={x:404,y:0},hits=[],spawned=[];
 const save={};
 const encounter=bossRules.create(arena,save,{
  players:()=>[center,edge],enemies:()=>spawned,region:()=>65,types:{SKELETON:3,RAT:13},
  spawn:rows=>spawned.push(...rows),changed:()=>{},teleport:()=>{},spread:()=>{},
  move:(e,x,y)=>{e.x+=x;e.y+=y;},
  hit:(p,damage,origin)=>hits.push({p,damage,origin})
 });
 encounter.setAltar(0);encounter.setAltar(1);
 for(let i=0;i<470;i++)encounter.step(1/30);
 assert.equal(save.bossBattle.phase,'waves');
 assert.ok(hits.length>=2);
 assert.equal(hits[0].p,center);
 assert.equal(hits[1].p,edge);
 assert.ok(hits.every(hit=>hit.origin.action==='Elektrodendreieck'));
});

test('the enlarged scientist uses a moving spin, two aimed beams and three lightning strikes',()=>{
 const arena={x:0,y:0,id:65,radius:432};
 const hero={x:310,y:0},boss={x:257,y:0,id:'last',scientist:2,bossRole:'scientist',enlarged:true,hp:60,
  moveCount:1,nextAttack:0,angle:0,phase:0};
 const save={bossBattle:{phase:'fight',time:0,cues:[],waves:3,rain:true}};
 const encounter=bossRules.create(arena,save,{
  players:()=>[hero],enemies:()=>[boss],region:()=>65,hit:()=>{},spread:()=>{},teleport:()=>{},
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
   if(cue.kind==='storm')bolt.add(cue.bolt);
  }
 }
 assert.ok(rotated&&moved);
 assert.ok(beam.size>=2);
 assert.deepEqual([...bolt].sort(),[0,1,2]);
});
