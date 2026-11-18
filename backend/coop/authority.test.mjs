import assert from 'node:assert/strict';
import {once} from 'node:events';
import test from 'node:test';
import {WebSocket} from 'ws';
import {run,geometry,defaultPack,makePlayer,items,foes,TILE,gap} from './rules.mjs';
import {Simulation} from './simulation.mjs';
import {actions} from './actions.mjs';
import {createCoopServer} from './server.mjs';
import {createProjection} from './network.mjs';

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
 assert.equal(projection(sim,host).floor,2);
});

function client(url){
 const ws=new WebSocket(url,{origin:'http://127.0.0.1:8000'});
 let id=0,latest=null;const waiters=new Map();
 ws.on('message',bytes=>{
  const data=JSON.parse(bytes);
  if(data.type==='frame')latest=data;
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
