import assert from 'node:assert/strict';
import {once} from 'node:events';
import test from 'node:test';
import {WebSocket} from 'ws';
import {run,geometry,defaultPack,makePlayer,items,foes,brewing,TILE,gap,maxHP,preparePlayer,pools} from './rules.mjs';
import {Simulation} from './simulation.mjs';
import {actions} from './actions.mjs';
import {createCoopServer} from './server.mjs';
import {createProjection} from './network.mjs';
import {checkpointConflict} from './checkpoints.mjs';
import {startParty,getFloor,advanceParty,partyState,partyMetadata,restoreParty} from './party.mjs';

function game(seed=193,layoutRevision,depth=1){
 const host=makePlayer(1,{name:'Host',classId:'guardian'},defaultPack);
 const guest=makePlayer(2,{name:'Gast',classId:'archer'},defaultPack);
 host.online=guest.online=true;
 const sim=new Simulation(seed,[host,guest],{random:()=>.04,layoutRevision},depth);
 sim.actions=actions(sim);
 return {host,guest,sim};
}
function arena(sim,p){
 const room=sim.floor.rooms[0];
 for(let y=room.y+1;y<room.y+room.h-1;y++)for(let x=room.x+1;x<room.x+room.w-2;x++){
  const pos={x:(x+.5)*TILE,y:(y+.5)*TILE};
  const target={x:pos.x+66,y:pos.y};
  if(sim.floor.valid(pos.x,pos.y,14,false,true)&&sim.floor.valid(target.x,target.y,14)&&!sim.floor.gateLineBlocked(pos.x,pos.y,target.x,target.y)){
   Object.assign(p,{...pos,region:room.i,entered:-1,dir:0,attack:0,inv:0});
   sim.explored.add(room.i);return target;
  }
 }
 throw new Error('Fixture could not find a clear combat line');
}
const choice=q=>q.type==='free-text'?q.answers[0]:q.correctIndices??q.correctIndex;

test('new starts give up to four exits and wide stairs connect floors by walking',()=>{
 const {host,guest,sim}=game(103);
 const {floor}=sim,{rest}=floor;
 assert.equal([[rest.x-1,rest.cy],[rest.x+rest.w,rest.cy],[rest.cx,rest.y-1],[rest.cx,rest.y+rest.h]]
  .filter(([x,y])=>floor.map[y][x]===0).length,4);
 assert.equal(floor.stairs.length,3);
 assert.ok(floor.links.every(link=>link.kind==='ladder'));
 sim.enemies=[];
 for(const stair of floor.stairs){
  const x=(stair.a.x+.5)*TILE,y=(stair.a.y+.5)*TILE,end=(stair.b.y+.5)*TILE;
  assert.equal(stair.w,4);
  assert.equal(floor.layerAt(x,y),stair.lower);
  assert.ok(floor.wall((stair.x-.5)*TILE,(stair.y+2.5)*TILE));
  Object.assign(host,{x,y});
  assert.ok(sim.move(host,0,end-y));
  assert.equal(floor.layerAt(host.x,host.y),stair.upper);
  assert.ok(Math.abs(host.y-end)<1e-6);
 }
 const stair=floor.stairs[0],x=(stair.a.x+.5)*TILE;
 const foe={x,y:(stair.a.y-.5)*TILE,id:'stair-pursuit',type:foes.SKELETON,aggro:7,alerted:true,
  hp:80,max:80,size:1,phase:0,angle:0,attack:2,hit:0,windup:0};
 Object.assign(host,{x,y:(stair.b.y+.5)*TILE,entryGrace:0});guest.online=false;sim.enemies=[foe];
 for(let step=0;step<180&&floor.layerAt(foe.x,foe.y)===0;step++)sim.step(1/30);
 assert.equal(floor.layerAt(foe.x,foe.y),1);
 assert.equal(sim.events.some(e=>e.kind==='travel'),false);
 assert.ok(floor.doors.every(d=>!floor.terrain[Math.floor(d.y/TILE)][Math.floor(d.x/TILE)]?.startsWith('bridge-')));
 const interior=floor.doors.find(d=>d.id==='upper-inner-door');
 const pos={x:interior.x-40,y:interior.y};
 assert.ok(floor.gateLineBlocked(pos.x,pos.y,interior.x+40,interior.y));
 floor.strikeDoor(interior.hp,interior);
 assert.equal(floor.gateLineBlocked(pos.x,pos.y,interior.x+40,interior.y),false);
});

test('crypts are limited per run and their altar makes a six-ingredient golden brew',()=>{
 const spawned=new Set();
 for(let seed=90;seed<126;seed++){
  const depths=run.cryptDepths(seed);
  assert.equal(new Set(depths).size,depths.length);
  assert.ok(depths.length<=2);
  spawned.add(depths.length);
 }
 assert.equal(spawned.size,3);
 const {host,sim}=game(103);
 const {floor}=sim;
 assert.ok(floor.crypt&&floor.canReachSpawn(floor.cryptAltar.x,floor.cryptAltar.y));
 const locals=sim.enemies.filter(e=>e.id.startsWith('crypt-'));
 for(const type of [foes.WHITE_ORC,foes.BLACK_ORC,foes.RAT,foes.BAT])assert.ok(locals.some(e=>e.type===type));
 Object.assign(host,floor.cryptAltar);
 const empty={kind:'cup',id:'cup',rarity:'rare'};
 host.inventory.push(empty,empty);
 assert.throws(()=>sim.actions.dispatch(host,'interact',{kind:'crypt-altar'}),/drei/);
 host.inventory.push(empty);
 const altar=sim.actions.dispatch(host,'interact',{kind:'crypt-altar'});
 assert.equal(altar.item.id,'golden-cup');
 assert.equal(host.inventory.filter(o=>o.id==='cup').length,0);
 Object.assign(host,floor.lab);host.bones=1;
 const vessel=altar.item.id;
 const offered=brewing.stock(sim.state.dungeonSeed,1,false,run.random,run.shuffle,vessel);
 assert.equal(offered.length,6);
 for(const entry of offered){
  const packet=sim.actions.dispatch(host,'quiz',{reason:'brew',index:entry.id,vessel});
  assert.ok(sim.actions.dispatch(host,'answer',{quiz:packet.quiz,choice:choice(host.quiz.q)}).ok);
  sim.actions.dispatch(host,'review',{quiz:packet.quiz,color:'green'});
 }
 const {item}=sim.actions.dispatch(host,'brew',{vessel,bones:1});
 assert.equal(item.brew.length,6);
 assert.equal(item.duration,(brewing.seconds+60)*2);
 assert.equal(host.inventory.some(o=>o.id==='golden-cup'),false);
 assert.equal(host.bones,0);
});

test('an orc spins, remains veiled for six seconds and strikes for critical physical damage and bleeding',()=>{
 const {host,sim}=game(103);
 const site=arena(sim,host);
 const e={...site,id:'crypt-test',type:foes.WHITE_ORC,hp:80,max:80,phase:0,angle:0,attack:0,size:1};
 sim.enemies=[e];sim.currentTarget=host;
 const act=dt=>sim.ai.act(e,dt,host,0,1180,760);
 act(.01);
 assert.equal(e.veilPhase,'turn');
 act(.54);
 assert.equal(e.veilPhase,'hidden');
 assert.equal(e.veilTime,6);
 for(let i=0;i<59;i++)act(.1);
 assert.equal(e.veilPhase,'hidden');
 assert.equal(sim.events.some(o=>o.critical==='crit'),false);
 act(.11);
 assert.equal(e.veilPhase,'strike');
 act(.22);
 assert.ok(sim.events.some(o=>o.kind==='hit'&&o.type==='physical'&&o.critical==='crit'));
 assert.ok(sim.events.some(o=>o.kind==='hit'&&o.type==='bleed'));
 assert.equal(items.cryptDrop(e,()=>.03,1).id,'farm-scythe');
 assert.equal(items.cryptDrop(e,()=>.16,1).rarity,'rare');
 const great=items.cryptDrop(e,()=>.22,1);
 assert.equal(great.id,'great-scythe');
 const scythe=items.weapon(great.id),sword=items.weapon('greatsword');
 assert.ok(scythe.reach>sword.reach&&scythe.impact>sword.impact&&scythe.sweep<sword.sweep);
});

test('nearby gates and wooden doors are visible from the approach while their passage blocks sight',()=>{
 const {sim}=game();
 const g=sim.floor.gates[0];
 const gate={x:(g.x+.5)*TILE,y:(g.y+.5)*TILE,vertical:g.vertical,span:4.2*TILE,face:.54*TILE};
 const door={...sim.floor.doors[0],face:12};
 for(const site of [gate,door]){
  const point=distance=>({x:site.x+(site.vertical?distance:0),y:site.y+(site.vertical?0:distance)});
  const from=point(-70),behind=point(70);
  assert.ok(sim.floor.barrierVisible(from,site));
  assert.ok(sim.floor.barrierVisible(behind,site));
  assert.equal(sim.floor.barrierVisible(point(-290),site),false);
  assert.ok(sim.floor.gateLineBlocked(from.x,from.y,behind.x,behind.y));
 }
});

test('water beside both bridges drops the hero while sewer water remains walkable',()=>{
 const {host,sim}=game(193,undefined,run.templeDepth(193));
 sim.enemies=[];
 for(const type of ['river','clear-river']){
  const {terrain}=sim.floor;
  const y=terrain.findIndex((row,i)=>row.some((cell,x)=>cell===type&&terrain[i+1]?.[x]==='bridge-x'));
  const x=terrain[y].findIndex((cell,i)=>cell===type&&terrain[y+1][i]==='bridge-x');
  const start={x:(x+.5)*TILE,y:(y+1.5)*TILE};
  assert.ok(sim.floor.abyssAt(start.x,start.y-TILE));
  Object.assign(host,start,{inv:0,hp:maxHP(host)});
  host.equipment.rings[0]='height';
  assert.ok(sim.move(host,0,-TILE));
  assert.equal(sim.floor.abyssAt(host.x,host.y),false);
  host.equipment.rings[0]=null;
  assert.equal(sim.move(host,0,-TILE),false);
  assert.ok(sim.events.some(e=>e.kind==='death'&&e.cause==='fall'));
 }
 const sewer=game(193,undefined,run.sewerDepth(193)).sim.floor;
 const y=sewer.terrain.findIndex(row=>row.includes('sewer-pool'));
 const x=sewer.terrain[y].indexOf('sewer-pool');
 assert.equal(sewer.abyssAt((x+.5)*TILE,(y+.5)*TILE),false);
});

test('new seeds vary the deck and room topics while due cards return after their review interval',()=>{
 const qs=defaultPack.questions;
 const progress={questionSeen:{},questionReview:{},questionCount:0};
 const order=seed=>run.orderQuestions(qs,progress,seed).map(q=>q.id);
 assert.deepEqual(order(193),order(193));
 assert.notDeepEqual(order(193),order(311));
 const topics=seed=>run.roomTopics(defaultPack,1,seed).flatMap(room=>room.map(g=>g.activeSubcategory.id));
 assert.notDeepEqual(topics(193),topics(311));
 const [red,yellow,green,local]=qs;
 progress.questionReview={[red.id]:{color:'red',due:6},[yellow.id]:{color:'yellow',due:11},[green.id]:{color:'green',due:0}};
 progress.questionCount=5;
 assert.equal(run.nextQuestion(qs,[local],[],progress,193).id,local.id);
 progress.questionCount=6;
 assert.equal(run.nextQuestion(qs,[local],[],progress,193).id,red.id);
 progress.questionCount=11;
 assert.equal(run.nextQuestion(qs,[local],[red.id],progress,193).id,yellow.id);
 assert.ok(!order(193).includes(green.id));
});

test('legacy combination cards become independently selectable and keep their grading on reconnect',()=>{
 const q={id:'combination',type:'single-choice',topic:'Test',prompt:'Welche Aussagen stimmen? (1) Aussage A. (2) Aussage B. (3) Aussage C. (4) Aussage D. Wähle die vollständige Kombination.',
  choices:['1 und 2','2 und 4','Nur 2','Alle vier'],correctIndex:1,explanation:'Richtig sind 2 und 4. Erklärung.'};
 const pack=run.validatePack({questions:[q]});
 const source=pack.questions[0];
 assert.equal(source.type,'multiple-choice');
 assert.equal(source.prompt,'Welche Aussagen stimmen?');
 assert.equal(source.explanation,'Erklärung.');
 assert.deepEqual([...source.correctIndices],[1,3]);
 const {host,sim}=game();
 host.pack=pack;Object.assign(host,sim.floor.shrines[0]);
 const quiz=sim.actions.dispatch(host,'quiz',{reason:'shrine',index:0});
 assert.ok(new Set(Array.from({length:8},(_,seed)=>run.shuffleOptions(source,seed).join())).size>1);
 const restored=Simulation.loadPlayer(JSON.parse(JSON.stringify(Simulation.savePlayer(host))),pack);
 const selected=Array.from(quiz.question.choices).flatMap((option,i)=>['Aussage B.','Aussage D.'].includes(option)?[i]:[]);
 assert.deepEqual([...restored.quiz.q.correctIndices],selected);
 assert.deepEqual([...restored.quiz.q.choices],[...quiz.question.choices]);
 assert.equal(sim.actions.dispatch(restored,'answer',{quiz:quiz.quiz,choice:selected}).ok,true);
});

test('server enforces combat inputs and line of sight, grants paired drops and prevents double pickup',()=>{
 const {host,guest,sim}=game();
 const target=arena(sim,host);
 const full=foes.health(0,false,1);
 const enemy={...target,id:'proof',type:0,hp:full,max:full,size:1,angle:0,phase:0,attack:0};
 sim.enemies=[enemy];const beforeGuest=guest.hp;
 assert.equal(sim.attack(host,0),false);
 assert.equal(sim.charge(host,0),true);
 assert.equal(sim.attack(host,0),true);
 assert.ok(enemy.hp<full);
 assert.equal(guest.hp,beforeGuest);
 assert.equal(sim.charge(host,0),false);
 assert.ok(sim.control(host,{seq:1,x:5000,y:0,aim:0,damage:100000}));
 assert.equal(host.input.x,1);
 assert.equal(sim.control(host,{seq:1,x:0,y:0,aim:0}),false);
 host.dash=.1;assert.equal(sim.hurtPlayer(host,1000),false);host.dash=0;
 enemy.hp=0;sim.step(1/30);
 const reward=[...sim.orbs.values()].filter(o=>gap(o,enemy)<20);
 assert.deepEqual(reward.map(o=>o.seat),[1,2]);
 const chest=reward.find(o=>o.seat===1);
 assert.throws(()=>sim.actions.dispatch(guest,'interact',{kind:'soul',index:chest.id}),/verfügbar/);
 Object.assign(host,chest);host.seat=1;
 const n=host.inventory.length;
 sim.actions.dispatch(host,'interact',{kind:'soul',index:chest.id});assert.equal(host.inventory.length,n+1);
 assert.throws(()=>sim.actions.dispatch(host,'interact',{kind:'soul',index:chest.id}),/verfügbar/);
 assert.ok(sim.portal);
});

test('Bastion blocks one direct hit and keeps its 60-second cooldown through a restart',()=>{
 const {host,sim}=game();
 arena(sim,host);
 host.equipment.armor={chest:'bastion-chest',helmet:'bastion-helmet'};
 preparePlayer(host);
 const full=host.hp;
 assert.equal(sim.hurtPlayer(host,6,{poison:1},true),true);
 assert.equal(host.armorCooldowns.block,undefined);
 const afterPoison=host.hp;
 assert.ok(afterPoison<full);
 assert.equal(sim.hurtPlayer(host,1000),false);
 assert.equal(host.hp,afterPoison);
 assert.equal(host.armorCooldowns.block,60);
 assert.equal(sim.events.at(-1).proc,'block');

 const restored=Simulation.loadPlayer(JSON.parse(JSON.stringify(Simulation.savePlayer(host))),defaultPack);
 Object.assign(restored,{online:true,inv:0,playtime:59});
 assert.equal(sim.hurtPlayer(restored,6),true);
 restored.equipment.armor={chest:'bastion-chest'};
 preparePlayer(restored);
 Object.assign(restored,{inv:0,playtime:60});
 assert.equal(sim.hurtPlayer(restored,6),false);
 assert.equal(restored.armorCooldowns.block,150);
});

test('Emberheart restores 40 percent HP at the 20 percent threshold and respects its cooldown',()=>{
 const {guest,sim}=game();
 arena(sim,guest);
 guest.equipment.armor={chest:'emberheart-chest',legs:'emberheart-legs'};
 preparePlayer(guest);
 const max=maxHP(guest);
 guest.hp=max*.2+2;
 assert.equal(sim.hurtPlayer(guest,1,{physical:1},true,1),true);
 assert.equal(guest.hp,max*.2+1);
 assert.equal(sim.hurtPlayer(guest,1,{physical:1},true,1),true);
 assert.equal(guest.hp,max*.4);
 assert.equal(guest.armorCooldowns.heal,180);
 assert.equal(sim.events.at(-1).proc,'heal');
 assert.equal(guest.combatRecord.taken,2);

 Object.assign(guest,{playtime:179,hp:2});
 sim.hurtPlayer(guest,1,{physical:1},true,1);
 assert.equal(guest.hp,1);
 Object.assign(guest,{playtime:180,hp:2});
 sim.hurtPlayer(guest,1,{physical:1},true,1);
 assert.equal(guest.hp,max*.4);
 assert.equal(guest.armorCooldowns.heal,360);
 Object.assign(guest,{playtime:360,hp:1});
 sim.hurtPlayer(guest,100,{physical:1},true,1);
 assert.equal(guest.combatRecord.deaths,1);
 assert.equal(guest.armorCooldowns.heal,360);
 Object.assign(guest,{playtime:359.5,hp:max*.1});
 sim.stepPlayer(guest,.25);
 assert.equal(guest.hp,max*.1);
 sim.stepPlayer(guest,.25);
 assert.equal(guest.hp,max*.4);
 assert.equal(guest.armorCooldowns.heal,540);
});

test('Pfadschütze starts in the new set and armor modifies bow range and dash cooldown',()=>{
 const {host,guest,sim}=game();
 for(const [slot,id] of Object.entries(guest.equipment.armor)){
  assert.equal(id,'pathfinder-'+slot);
  assert.ok(guest.inventory.some(it=>it.kind==='armor'&&it.id===id));
 }
 for(const set of ['pathfinder','bastion','emberheart','windstep']){
  for(const slot of ['helmet','chest','legs','boots']){
   const id=set+'-'+slot;
   assert.ok(pools.armor.some(it=>it.id===id));
   const common=items.armorProfile(id);
   const upgraded=items.armorProfile(id,'legendary');
   assert.equal(common.kg,upgraded.kg);
   assert.equal(Object.values(common.cost).reduce((total,n)=>total+n,0),common.budget);
   for(const [type,value] of Object.entries(common.stats))assert.ok(upgraded.stats[type]>=value);
  }
 }
 arena(sim,guest);
 assert.ok(sim.charge(guest,0));
 assert.ok(sim.attack(guest,0));
 assert.equal(sim.shots.at(-1).left,guest.weapon.reach*1.12);
 assert.equal(items.arrowRange(host.weapon,guest.equipment.armor),1);

 host.equipment.armor={legs:'windstep-legs',boots:'windstep-boots'};
 preparePlayer(host);
 assert.ok(sim.control(host,{seq:1,x:1,y:0,aim:0,dash:true}));
 sim.stepPlayer(host,1/30);
 assert.equal(host.dashCooldown,.85*.75);
});

test('arrows hit through the open courtyard threshold before that room is explored',()=>{
 const {guest,sim}=game(-1640531527);
 const court=sim.floor.court,x=(court.cx+.5)*TILE;
 Object.assign(guest,{x,y:(court.y-.5)*TILE});
 const enemy={id:'cross-room',x,y:(court.y+1.5)*TILE,type:foes.SKELETON,hp:150,max:150,size:1};
 sim.enemies=[enemy];
 assert.notEqual(sim.floor.regionAt(guest.x,guest.y),sim.floor.regionAt(enemy.x,enemy.y));
 assert.equal(sim.explored.has(court.id),false);
 assert.equal(sim.canTarget(enemy,guest),false);
 assert.ok(sim.charge(guest,Math.PI/2));
 assert.ok(sim.attack(guest,Math.PI/2));
 sim.updateShots(.4);
 assert.ok(enemy.hp<150);
 assert.ok(enemy.aggro>0);
 assert.ok(sim.canTarget(enemy,guest));

 const gate=sim.floor.gates[0],axis=gate.vertical?'x':'y';
 const p={x:(gate.x+.5)*TILE,y:(gate.y+.5)*TILE};
 const target={...p,[axis]:p[axis]+56};
 Object.assign(enemy,target,{hp:150});
 const from={...p,[axis]:p[axis]-56};
 assert.ok(sim.floor.gateLineBlocked(from.x,from.y,enemy.x,enemy.y));
 sim.shots.push({...from,angle:gate.vertical?0:Math.PI/2,left:150,speed:490,hit:null});
 sim.updateShots(.4);
 assert.equal(enemy.hp,150);
 assert.equal(sim.shots.length,0);
});

test('an alerted skeleton follows around the open courtyard corner into the passage',()=>{
 const {host,guest,sim}=game(-1640531527);
 const court=sim.floor.court,x=(court.cx+.5)*TILE;
 host.online=false;
 Object.assign(guest,{x,y:(court.y-1.5)*TILE,entryGrace:.4});
 const enemy={id:'pursuit',type:foes.SKELETON,hp:150,max:150,size:1,x:x+3*TILE,y:(court.y+.5)*TILE,
  roomId:0,phase:.2,attack:10,hit:0,angle:0,windup:0};
 sim.enemies=[enemy];sim.explored.add(court.passage.id);
 assert.equal(foes.encounterReady(enemy,enemy,sim.floor,foes.entryGrace),false);
 assert.equal(foes.encounterReady(enemy,enemy,sim.floor,0),true);
 assert.ok(sim.floor.gateLineBlocked(enemy.x,enemy.y,guest.x,guest.y));
 sim.step(1/30);
 assert.equal(enemy.x,x+3*TILE);
 foes.alert(enemy);
 for(let i=0;i<180;i++)sim.step(1/30);
 assert.equal(sim.floor.regionAt(enemy.x,enemy.y),court.passage.id);
 assert.ok(gap(enemy,guest)<48);
});

test('large skeletons can drop three common bones and each player can collect their own bundle',()=>{
 const {host,guest,sim}=game();
 sim.random=()=>.2;
 const point=arena(sim,host),skeleton={...point,id:'skeleton',type:foes.SKELETON,boss:true,size:1.3};
 assert.equal(foes.boneDrop({...skeleton,boss:false,size:1},sim.random).bundle,1);
 assert.equal(foes.boneDrop(skeleton,()=>.9),null);
 sim.defeat(skeleton);
 const bundles=[...sim.orbs.values()].filter(o=>o.item.kind==='bones');
 assert.deepEqual(bundles.map(o=>[o.seat,o.item.bundle,o.item.rarity]),[[1,3,'common'],[2,3,'common']]);
 for(const [p,orb] of [[host,bundles[0]],[guest,bundles[1]]]){
  Object.assign(p,{x:orb.x,y:orb.y});
  p.inventory=Array(30).fill(p.inventory[0]);
  sim.actions.dispatch(p,'interact',{kind:'soul',index:orb.id});
  assert.equal(p.bones,3);assert.equal(p.inventory.length,30);
  assert.throws(()=>sim.actions.dispatch(p,'interact',{kind:'soul',index:orb.id}),/verfügbar/);
 }
});

test('a merchant stall fits against a wall and leaves a reachable customer approach',()=>{
 for(const seed of [14,193,-1640531527,99130132]){
  const floor=geometry.build(run,run.floorState(seed,3)),{x,y}=floor.market;
  assert.ok(floor.wall(x,y-61)||floor.wall(x-91,y)||floor.wall(x+91,y));
  assert.ok(floor.valid(floor.merchant.x,floor.merchant.y,14));
  assert.ok(floor.canReachSpawn(floor.merchant.x,floor.merchant.y));
  assert.ok(floor.furniture.some(p=>p.type==='market'));
 }
});

test('players use ladders and stairs, but alerted enemies only navigate stairs',()=>{
 const {host,guest,sim}=game(193,8);
 const floor=sim.floor,stairs=floor.links.find(s=>s.id==='upper-stairs-0');
 const ladder=floor.links.find(s=>s.id==='sewer-ladder-west-0');
 Object.assign(host,{x:stairs.x,y:stairs.y});
 sim.actions.dispatch(host,'interact',{kind:'strata',index:stairs.id});
 assert.equal(floor.layerAt(host.x,host.y),1);
 assert.throws(()=>sim.actions.dispatch(host,'interact',{kind:'strata',index:'upper-stairs-1'}),/nicht erreichbar/);
 Object.assign(guest,{x:ladder.x,y:ladder.y});
 sim.actions.dispatch(guest,'interact',{kind:'strata',index:ladder.id});
 assert.equal(floor.layerAt(guest.x,guest.y),-1);
 const chaser={id:'stair-chaser',x:stairs.x,y:stairs.y,type:foes.SKELETON,roomId:0,hp:100,max:100,size:1,phase:0,hit:0,attack:8,angle:0};
 const leftBehind={...chaser,id:'ladder-chaser',x:ladder.x,y:ladder.y};
 foes.alert(chaser);foes.alert(leftBehind);
 assert.equal(sim.canTarget(leftBehind,guest),false);
 sim.enemies=[chaser];sim.step(1/30);
 assert.equal(floor.layerAt(chaser.x,chaser.y),1);
 assert.equal(floor.layerAt(leftBehind.x,leftBehind.y),0);
});

test('closed wood blocks arrows and movement until projectile and melee damage destroy it',()=>{
 const {host,guest,sim}=game(193,8);
 const floor=sim.floor,door=floor.doors.find(d=>d.id==='upper-door');
 const from={x:door.x-65,y:door.y},behind={x:door.x+48,y:door.y};
 const enemy={...behind,id:'behind-door',type:foes.SKELETON,roomId:0,hp:100,max:100,size:1};
 sim.enemies=[enemy];Object.assign(guest,from,{damage:12});
 assert.ok(floor.gateLineBlocked(from.x,from.y,behind.x,behind.y));
 assert.equal(floor.valid(door.x,door.y,14),false);
 assert.ok(sim.charge(guest,0));assert.ok(sim.attack(guest,0));
 sim.updateShots(.5);
 assert.equal(enemy.hp,100);assert.equal(floor.doorHP(door),door.hp-12);
 Object.assign(host,{...from,x:door.x-42,damage:door.hp,inv:0});
 assert.ok(sim.charge(host,0));assert.ok(sim.attack(host,0));
 assert.equal(enemy.hp,100);
 assert.equal(floor.doorHP(door),0);
 assert.equal(floor.valid(door.x,door.y,14),true);
 assert.equal(floor.gateLineBlocked(from.x,from.y,behind.x,behind.y),false);
 const frame=createProjection()(sim,host);
 assert.equal(frame.doors[door.id],0);
});

test('sewer water amplifies electricity and a live weapon sends a second pulse across the channel',()=>{
 const {host,guest,sim}=game(193,8);
 const {floor}=sim;
 const pool=floor.terrain.flatMap((row,y)=>row.flatMap((t,x)=>t==='sewer-pool'?[{x:(x+.5)*TILE,y:(y+.5)*TILE}]:[]))[0];
 assert.ok(pool);
 assert.ok(floor.terrain.some(row=>row.some(t=>t?.startsWith('sewer-flow'))));
 assert.ok(sim.enemies.some(e=>e.type===foes.RAT));
 assert.ok(sim.enemies.some(e=>e.type===foes.ELECTRO_RAT));
 const max=maxHP(host),damage=20;
 Object.assign(host,{resistance:{},guard:1,hp:max,inv:0});
 arena(sim,host);
 sim.hurtPlayer(host,damage,{lightning:1},true,1);
 assert.equal(max-host.hp,20);
 Object.assign(host,pool,{hp:max,inv:0});
 sim.hurtPlayer(host,damage,{lightning:1},true,1);
 assert.equal(max-host.hp,27);
 Object.assign(guest,pool,{resistance:{},guard:1,inv:0});
 const before=guest.hp;
 host.mods.element='lightning';host.damage=30;
 assert.ok(sim.charge(host,0));assert.ok(sim.attack(host,0));
 assert.ok(guest.hp<before);
 assert.equal(sim.effects.waterArcs.length,1);
 assert.equal(items.enemyRarity(.21,1,true),'rare');
 assert.equal(items.enemyRarity(.21,1,false),null);
});

test('small rats build bleed and an electrode rat discharges electricity in water',()=>{
 const {host,guest,sim}=game(193,8);
 const floor=sim.floor;
 const spots=floor.terrain.flatMap((row,y)=>row.flatMap((t,x)=>t==='sewer-pool'?
  [{x:(x+.5)*TILE,y:(y+.5)*TILE}]:[]));
 const water=spots.find(p=>floor.waterAt(p.x+25,p.y)&&!floor.gateLineBlocked(p.x,p.y,p.x+25,p.y));
 assert.ok(water);
 guest.online=false;
 Object.assign(host,water,{guard:1,resistance:{},inv:0,entryGrace:0});
 const rat={x:water.x+25,y:water.y,id:'sewer-proof',type:foes.RAT,hp:100,max:100,size:1,
  roomId:0,phase:0,hit:0,attack:1,windup:.005,angle:Math.PI};
 sim.enemies=[rat];sim.currentTarget=host;
 sim.ai.act(rat,.03,host,0,1180,760);
 assert.equal(host.bleed,31);
 assert.equal(sim.effects.waterArcs.length,0);
 Object.assign(rat,{type:foes.ELECTRO_RAT,windup:.005,runAttack:0});
 host.inv=0;
 const before=host.hp;
 sim.ai.act(rat,.03,host,0,1180,760);
 assert.ok(host.hp<before);
 assert.equal(sim.effects.waterArcs.length,1);
 assert.equal(host.bleed,31);
});

test('revision-seven checkpoints reconstruct their original flat floor',()=>{
 const member={id:'host',seat:1,pack:defaultPack,player:makePlayer(1,null,defaultPack),floor:1,ws:{}};
 const sim=new Simulation(193,[member.player],{layoutRevision:7});
 const room={seed:193,mode:'same',members:new Map([[member.id,member]]),floors:new Map([[1,sim]])};
 const saved=JSON.parse(JSON.stringify({meta:partyMetadata(room),state:partyState(room),revision:1}));
 const restored=restoreParty('ABCDEF01',saved),floor=restored.floors.get(1);
 assert.equal(floor.state.layoutRevision,7);
 assert.equal(floor.floor.links.length,0);
 assert.equal(floor.floor.W,sim.floor.W);
});

test('a run has exactly one sewer and can generate all four tower heights',()=>{
 const heights=new Set();
 for(let i=1;i<=100;i++){
  const runSeed=Math.imul(i,0x9e3779b9);
  let sewerCount=0;
  for(let depth=1;depth<=run.LAST_DEPTH;depth++){
   const seed=depth===1?runSeed:run.nextSeed(runSeed^depth);
   const layout=run.generate(seed,true,9,depth,run.templeDepth(runSeed),runSeed);
   const highest=Math.max(0,...Object.values(layout.layers));
   heights.add(highest+1);
   if(layout.sewerRooms.length){sewerCount++;assert.equal(depth,run.sewerDepth(runSeed));}
   if(highest===3)assert.ok(layout.roof.currentOutdoor);
  }
  assert.equal(sewerCount,1);
 }
 assert.deepEqual([...heights].sort(),[1,2,3,4]);
});

test('the Ring der Höhe brakes at a cliff, but an eagle can knock its wearer to instant death',()=>{
 const {host,guest,sim}=game(-731389592,9);
 const roof=sim.floor.roof;
 assert.ok(roof.hail);
 const lip={x:roof.x*TILE+16,y:(roof.cy+.5)*TILE};
 const full=maxHP(host);
 Object.assign(host,lip,{hp:full,inv:0});
 sim.enemies=[];
 assert.equal(sim.move(host,-55,0),false);
 assert.equal(host.combatRecord.deaths,1);
 assert.equal(sim.events.at(-1).cause,'fall');
 Object.assign(host,lip,{hp:full,inv:0});
 host.equipment.rings[0]='height';
 assert.equal(sim.move(host,-55,0),true);
 assert.ok(host.x>=roof.x*TILE);
 assert.equal(host.combatRecord.deaths,1);
 Object.assign(host,lip,{hp:full,inv:0});guest.online=false;
 const eagle={id:'swoop',x:lip.x+29,y:lip.y,type:foes.EAGLE,hp:100,max:100,size:1,roomId:0,
  phase:0,hit:0,attack:10,windup:0,angle:Math.PI,runAttack:.65,runDuration:.65};
 sim.enemies=[eagle];sim.currentTarget=host;
 sim.ai.act(eagle,.025,host,0,1180,760);
 assert.equal(host.combatRecord.deaths,2);
 assert.equal(sim.events.at(-1).cause,'fall');
});

test('hail amplifies frost and armbrust-ice zombies fire frost bolts',()=>{
 const {host,guest,sim}=game(-731389592,9);
 const roof=sim.floor.roof,x=(roof.cx+.5)*TILE,y=(roof.cy+.5)*TILE,max=maxHP(host);
 host.guard=1;host.resistance={};host.hp=max;host.inv=0;
 Object.assign(host,{x,y});guest.online=false;
 const foe={id:'ice-bolt',x:x+90,y,type:foes.FROST_CROSSBOW,hp:100,max:100,size:1,roomId:0,
  phase:0,hit:0,attack:10,windup:.005,angle:Math.PI};
 sim.enemies=[foe];sim.currentTarget=host;sim.ai.act(foe,.03,host,0,1180,760);
 assert.equal(sim.effects.bolts[0].type,'frost-crossbow');
 sim.ai.moveFrom(.3,host,.3,1180,760);
 assert.equal(host.dominant,'frost');
 assert.equal(max-host.hp,22);
});

test('a failed ladder seal preserves the main stairs, and a correct answer enables a reinforced door',()=>{
 const {host,sim}=game(1013904242,9),floor=sim.floor;
 const ladder=floor.links.find(o=>o.seal==='quiz-ladder'&&o.layer===0);
 const sealed=floor.doors.find(o=>o.seal==='quiz-vault');
 const stairs=floor.links.find(o=>o.id==='upper-stairs-0');
 assert.ok(ladder&&sealed&&stairs);
 Object.assign(host,{x:ladder.x,y:ladder.y});
 const q=sim.actions.dispatch(host,'quiz',{reason:'access',index:ladder.seal});
 sim.actions.dispatch(host,'answer',{quiz:q.quiz,choice:null});
 sim.actions.dispatch(host,'review',{quiz:q.quiz,skip:true});
 assert.equal(floor.accessState(ladder),'blocked');
 assert.throws(()=>sim.actions.dispatch(host,'interact',{kind:'strata',index:ladder.id}),/nicht erreichbar/);
 assert.throws(()=>sim.actions.dispatch(host,'quiz',{reason:'access',index:ladder.seal}),/nicht verfügbar/);
 Object.assign(host,{x:stairs.x,y:stairs.y});
 sim.actions.dispatch(host,'interact',{kind:'strata',index:stairs.id});
 assert.equal(floor.layerAt(host.x,host.y),1);
 Object.assign(host,{x:sealed.x-31,y:sealed.y});
 sim.hitDoor(sealed,{amount:500});
 assert.equal(floor.doorHP(sealed),105);
 const doorQ=sim.actions.dispatch(host,'quiz',{reason:'access',index:sealed.seal});
 sim.actions.dispatch(host,'answer',{quiz:doorQ.quiz,choice:choice(host.quiz.q)});
 sim.actions.dispatch(host,'review',{quiz:doorQ.quiz,skip:true});
 sim.hitDoor(sealed,{amount:500});
 assert.equal(floor.doorHP(sealed),0);
});

test('the sewer relic converts unopened chests and a completed challenge drops rare loot or better',()=>{
 const {host,sim}=game(193,9,3);
 const relic=[...sim.orbs.values()].find(o=>o.seat===host.seat&&o.item.kind==='trialCharm');
 assert.ok(relic);
 Object.assign(host,{x:relic.x,y:relic.y});
 sim.actions.dispatch(host,'interact',{kind:'soul',index:relic.id});
 host.opened=[0];
 const index=host.inventory.findIndex(o=>o.kind==='trialCharm'),item=host.inventory[index];
 sim.actions.dispatch(host,'consume',{index,key:items.key(item)});
 assert.equal(host.trialCharmActive,true);
 assert.deepEqual(host.opened,[0]);
 const target=[1,2,3,4].find(n=>n!==sim.floor.trialIndex);
 assert.equal(items.isTrial(host,target,sim.floor.trialIndex),true);
 Object.assign(host,sim.floor.chests[target]);
 let q=sim.actions.dispatch(host,'quiz',{reason:'trial',index:target});
 for(let i=0;i<3;i++){
  sim.actions.dispatch(host,'answer',{quiz:q.quiz,choice:choice(host.quiz.q)});
  q=sim.actions.dispatch(host,'review',{quiz:q.quiz,color:'green'});
 }
 assert.ok(host.opened.includes(target));
 assert.ok([...sim.orbs.values()].some(o=>o.seat===host.seat&&gap(o,host)<8&&['rare','epic','legendary','mythic'].includes(o.item.rarity)));
 const next=new Simulation(193,[host],{},4);
 assert.equal(host.trialCharmActive,true);
 assert.equal(items.isTrial(host,0,next.floor.trialIndex),true);
});

test('nearby blood loss powers the Ring des Wahns for twenty seconds',()=>{
 const {guest,sim}=game(193,9);
 const point=arena(sim,guest);
 guest.equipment.rings[1]='madness';
 guest.playtime=40;
 guest.resistance={};guest.guard=1;
 assert.ok(sim.hurtPlayer(guest,4,{bleed:1},true,1));
 assert.equal(guest.madnessUntil,60);
 const enemy={...point,id:'ring-test',type:foes.SKELETON,hp:100,max:100,size:1};
 sim.enemies=[enemy];
 const base=guest.damage;
 assert.ok(sim.charge(guest,0));assert.ok(sim.attack(guest,0));
 assert.equal(sim.shots.at(-1).hit.amount,base*1.20);
 guest.playtime=60;
 assert.equal(items.madnessBonus(guest,guest.equipment.rings),1);
});

test('shared layouts, private questions and server-graded answers',()=>{
 const {host,guest,sim}=game();
 const legacy=geometry.build(run,{...run.floorState(193,1),templeDepth:run.templeDepth(193)});
 assert.deepEqual(sim.floor.furniture,legacy.furniture);
 for(const player of [host,guest]){
  Object.assign(player,sim.floor.shrines[0]);
  const start=sim.actions.dispatch(player,'quiz',{reason:'shrine',index:0});
  assert.ok(start.question.prompt);assert.equal(start.question.correctIndex,undefined);assert.equal(start.question.answers,undefined);
  assert.throws(()=>sim.actions.dispatch(player,'answer',{quiz:'someone-elses',choice:1}),/nicht mehr offen/);
  const response=sim.actions.dispatch(player,'answer',{quiz:start.quiz,choice:choice(player.quiz.q)});
  assert.equal(response.ok,true);assert.ok(player.xp>0);
  assert.throws(()=>sim.actions.dispatch(player,'answer',{quiz:start.quiz,choice:choice(player.quiz.q)}),/nicht mehr offen/);
  sim.actions.dispatch(player,'review',{quiz:start.quiz,color:'yellow'});
  assert.equal(player.altarUses[0],1);
 }
 const p=makePlayer(1,null,defaultPack),q=makePlayer(2,null,defaultPack);
 const solo=geometry.spawnEnemies(run,foes,{...run.floorState(193,1)},legacy,false);
 assert.equal(solo[0].max,Math.round(foes.health(solo[0].type,solo[0].boss,1)*.5));
 assert.equal(p.level,q.level);
});

test('render packets preserve visibility, carry deltas and allow another floor',()=>{
 const {host,guest,sim}=game();
 const projection=createProjection();
 const first=projection(sim,host);
 assert.equal(first.reset,true);
 assert.equal(first.personal.inventory.length,host.inventory.length);assert.equal(first.peerMeta.appearance.name,guest.appearance.name);
 assert.equal(projection(sim,host).enemies,undefined);
 sim.enemies=[];sim.portal={x:host.x,y:host.y};
 const result=sim.actions.dispatch(host,'interact',{kind:'portal'});
 assert.equal(result.advance,true);
 const hostMember={seat:1,player:host,floor:1},guestMember={seat:2,player:guest,floor:1};
 const room={seed:sim.seed,members:new Map([['host',hostMember],['guest',guestMember]]),floors:new Map([[1,sim]])};
 advanceParty(room,hostMember);
 assert.equal(projection(getFloor(room,hostMember),host).floor,2);
 assert.equal(guestMember.floor,2);
});

function client(url){
 const ws=new WebSocket(url,{origin:'http://127.0.0.1:8000'});
 let id=0,latest=null;const waiters=new Map(),visible=new Map();
 ws.on('message',bytes=>{
  const data=JSON.parse(bytes);
  if(data.type==='frame'){
   if(data.reset){latest=null;visible.clear();}
   for(const id of data.removed??[])visible.delete(id);
   for(const row of data.enemies??[])visible.set(row[0],row);
   latest={...latest,...data,enemies:[...visible.values()]};
  }
  if(data.type==='reply'&&waiters.has(data.id)){
   const {resolve,reject,timer}=waiters.get(data.id);waiters.delete(data.id);clearTimeout(timer);
   if(data.ok)resolve(data.data);else reject(new Error(data.message));
  }
 });
 return {
  ws,opened:once(ws,'open'),get latest(){return latest;},
  send(data){ws.send(JSON.stringify(data));},
  call(type,data={}){
   const key=++id;
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Timeout: '+type)),3000);
    waiters.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,type,...data}));
   });
  }
 };
}

test('two WebSocket clients start, move, and reconnect under server authority',async t=>{
 const service=createCoopServer({origins:['http://127.0.0.1:8000'],auth:{
  async verify(id){if(!['host','guest','outsider'].includes(id))throw Error('Invalid token');return {id,expires:Date.now()+60000};},
  async pack(){return defaultPack;}
 }});
 t.after(()=>service.shutdown());
 service.http.listen(0,'127.0.0.1');await once(service.http,'listening');
 const base='127.0.0.1:'+service.http.address().port,url='ws://'+base+'/coop';
 const healthy=await fetch('http://'+base+'/healthz');assert.equal((await healthy.json()).ready,true);
 const host=client(url),guest=client(url),outsider=client(url);
 t.after(()=>{host.ws.terminate();guest.ws.terminate();outsider.ws.terminate();});
 await Promise.all([host.opened,guest.opened,outsider.opened]);
 await assert.rejects(outsider.call('create'),/melde/);
 await Promise.all([host.call('auth',{token:'host'}),guest.call('auth',{token:'guest'}),outsider.call('auth',{token:'outsider'})]);
 const {code}=await host.call('create',{pack:defaultPack.packId,mode:'same'});
 await guest.call('join',{code,character:{classId:'archer'}});
 await assert.rejects(outsider.call('resume',{code}),/anderen Konto|voll/);
 await assert.rejects(guest.call('start'),/Beide Spieler/);
 await host.call('start');
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 await delay(170);
 assert.ok(host.latest?.peer&&guest.latest?.peer);
 const initial=host.latest.you[0];
 for(let n=0;n<8;n++){
  host.send({type:'input',floor:1,seq:n,x:1,y:0,aim:0,hp:999});
  await delay(40);
 }
 assert.ok(host.latest.you[0]>initial);
 assert.ok(host.latest.you[13]<100);
 assert.ok(guest.latest.peer[0]>initial);
 const prior=guest.latest.you.slice(0,2);
 guest.ws.close();await once(guest.ws,'close');
 const reconnect=client(url);t.after(()=>reconnect.ws.terminate());
 await reconnect.opened;await reconnect.call('auth',{token:'guest'});
 assert.equal((await reconnect.call('resume',{code})).seat,2);
 await delay(130);assert.deepEqual(reconnect.latest.you.slice(0,2),prior);
 assert.ok(service.usage().frames>8);
});

test('a saved party resumes after server replacement and reunites without rerolling a floor',async t=>{
 const hostMember={seat:1,id:'host',pack:defaultPack,character:{classId:'archer'},ws:{}};
 const guestMember={seat:2,id:'guest',pack:defaultPack,ws:{}};
 const code='ABCD0912';
 const party={code,seed:193,mode:'same',members:new Map([['host',hostMember],['guest',guestMember]])};
 startParty(party);
 const original=getFloor(party,hostMember);
 arena(original,guestMember.player);
 const guestPosition=[guestMember.player.x,guestMember.player.y];
 Object.assign(hostMember.player,{gold:17,xp:13});
 original.state.gates[original.floor.gates[0].id]=true;
 original.enemies=[];original.portal={x:guestPosition[0],y:guestPosition[1]};
 original.drop(original.portal,{kind:'food',id:'banana',rarity:'common'},2);
 original.setOnline(guestMember.player,false);
 advanceParty(party,hostMember);
 const secondFloor=getFloor(party,hostMember);
 secondFloor.state.gateProgress.test=1;
 const enemy=secondFloor.enemies.find(e=>gap(e,hostMember.player)<900);
 assert.ok(enemy);
 enemy.hp=enemy.max*.5;
 const state=JSON.parse(JSON.stringify(partyState(party)));
 const rows=new Map([[code,{meta:JSON.parse(JSON.stringify(partyMetadata(party))),state,revision:1}]]);
 const store={
  async load(id,player){const row=rows.get(id);return row?.meta.members.some(m=>m.id===player)?structuredClone(row):null;},
  async list(player){return [...rows].flatMap(([id,row])=>{
   const i=row.meta.members.findIndex(m=>m.id===player);
   return i>=0?[{code:id,floor:row.state.members[i].floor}]:[];
  });},
  async save(id,write){
   const row=rows.get(id);
   if((row?.revision??0)!==write.expected)return checkpointConflict;
   const revision=write.expected+1;
   rows.set(id,structuredClone({meta:write.meta??row.meta,state:write.state,revision}));
   return revision;
  }
 };
 const opts={store,origins:['http://127.0.0.1:8000'],auth:{
  async verify(id){return {id,expires:Date.now()+60000};},
  async pack(){throw new Error('Saved packs must survive independently of the account catalog.');}
 }};
 const launch=async()=>{
  const service=createCoopServer(opts);t.after(()=>service.shutdown());
  service.http.listen(0,'127.0.0.1');await once(service.http,'listening');
  const url='ws://127.0.0.1:'+service.http.address().port+'/coop';
  return {service,async connect(token){
   const actor=client(url);t.after(()=>actor.ws.terminate());
   await actor.opened;await actor.call('auth',{token});return actor;
  }};
 };
 const wait=async predicate=>{
  for(let i=0;i<45;i++){
   if(predicate())return;
   await new Promise(resolve=>setTimeout(resolve,25));
  }
  assert.fail('Expected new state from the server');
 };
 const first=await launch();
 const hunter=await first.connect('host');
 const listing=await hunter.call('list');
 assert.deepEqual(listing.parties,[{code,floor:2}]);
 assert.equal((await hunter.call('resume',{code})).floor,2);
 await wait(()=>hunter.latest?.floor===2);
 assert.equal(hunter.latest.personal.gold,17);
 assert.equal(hunter.latest.personal.xp,13);
 assert.equal(hunter.latest.peer,null);
 assert.equal(hunter.latest.gateProgress.test,1);
 assert.equal(hunter.latest.enemies.find(row=>row[0]===enemy.id)[5],enemy.max);
 await first.service.shutdown();

 const next=await launch();
 const host=await next.connect('host'),guest=await next.connect('guest'),stranger=await next.connect('stranger');
 assert.deepEqual((await stranger.call('list')).parties,[]);
 await assert.rejects(stranger.call('resume',{code}),/nicht mehr verfügbar/);
 await host.call('resume',{code});
 const guestLobby=await guest.call('resume',{code});
 assert.equal(guestLobby.floor,1);assert.equal(guestLobby.peerFloor,2);
 await wait(()=>guest.latest?.portal&&host.latest?.floor===2);
 assert.deepEqual(guest.latest.you.slice(0,2),guestPosition);
 assert.ok(guest.latest.loot.some(o=>o.item.id==='banana'));
 assert.equal(guest.latest.peer,null);
 assert.equal(guest.latest.gates[original.floor.gates[0].id],true);
 await guest.call('action',{floor:1,action:'interact',data:{kind:'portal'}});
 await wait(()=>guest.latest?.floor===2&&guest.latest.peer);
 assert.equal(guest.latest.seed,secondFloor.state.dungeonSeed);
 assert.equal(guest.latest.gateProgress.test,1);
 const scaled=guest.latest.enemies.find(row=>row[0]===enemy.id);
 assert.equal(scaled[5],foes.health(enemy.type,enemy.boss,2));
 assert.equal(scaled[4]/scaled[5],.5);
 await host.call('leave');
 await wait(()=>guest.latest.peer===null);
 const alone=guest.latest.you.slice(0,2);
 await next.service.shutdown();
 const final=await launch(),returning=await final.connect('guest');
 await returning.call('resume',{code});
 await wait(()=>returning.latest?.floor===2);
 assert.deepEqual(returning.latest.you.slice(0,2),alone);
});

test('temple trap audio follows the plate and projectile launch separately',()=>{
 const player=makePlayer(1,null,defaultPack);
 player.online=true;
 const seed=193;
 const sim=new Simulation(seed,[player],{},run.templeDepth(seed));
 const plate=sim.floor.pressurePlates[0];
 assert.ok(plate);
 Object.assign(player,{x:plate.x,y:plate.y});
 sim.ai.moveFrom(.03,player,0,960,640);
 assert.deepEqual(sim.events.filter(e=>e.kind==='sound').map(e=>e.cue),['temple_plate_press']);
 sim.ai.moveFrom(.27,player,.27,960,640);
 const launch=sim.events.find(e=>e.cue==='temple_trap_release');
 assert.ok(launch);
 assert.equal(launch.x,Math.round(plate.origin.x*10)/10);
 assert.equal(launch.y,Math.round(plate.origin.y*10)/10);
});

test('opening a co-op chest emits latch, lid and gold once in playback order',()=>{
 const {host,sim}=game();
 const index=sim.floor.chests.findIndex((_,i)=>i!==sim.floor.trialIndex);
 const chest=sim.floor.chests[index];
 Object.assign(host,{x:chest.x,y:chest.y});
 sim.actions.dispatch(host,'interact',{kind:'chest',index});
 assert.throws(()=>sim.actions.dispatch(host,'interact',{kind:'chest',index}),/bereits besucht/);
 const sounds=sim.events.filter(e=>e.kind==='sound');
 assert.deepEqual(sounds.map(e=>[e.cue,e.mix.delay??0]),[
  ['chest_latch',0],['chest_lid',.16],['loot_gold',.34]
 ]);
});
