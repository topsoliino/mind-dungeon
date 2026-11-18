import assert from 'node:assert/strict';
import {once} from 'node:events';
import test from 'node:test';
import {WebSocket} from 'ws';
import {run,geometry,defaultPack,makePlayer,items,foes,TILE,gap,maxHP,preparePlayer,pools} from './rules.mjs';
import {Simulation} from './simulation.mjs';
import {actions} from './actions.mjs';
import {createCoopServer} from './server.mjs';
import {createProjection} from './network.mjs';
import {checkpointConflict} from './checkpoints.mjs';
import {startParty,getFloor,advanceParty,partyState,partyMetadata,restoreParty} from './party.mjs';

function game(seed=193){
 const host=makePlayer(1,{name:'Host',classId:'guardian'},defaultPack);
 const guest=makePlayer(2,{name:'Gast',classId:'archer'},defaultPack);
 host.online=guest.online=true;
 const sim=new Simulation(seed,[host,guest],{random:()=>.04});
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
 const {host,guest,sim}=game(193);
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
 const {host,guest,sim}=game(193);
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
 const {host,guest,sim}=game(193);
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
 const {host,guest,sim}=game(193);
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
