import assert from 'node:assert/strict';
import {once} from 'node:events';
import test from 'node:test';
import {WebSocket} from 'ws';
import {run,balance,geometry,vision,defaultPack,makePlayer,items,foes,brewing,TILE,fallSeconds,gap,maxHP,preparePlayer,pools} from './rules.mjs';
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
function settleHits(sim,p){
 for(const hit of items.takeDueDamage(p,1))if(sim.settleDamage(p,hit))break;
}

test('controller axes preserve movement strength and a tap dodges once even when followed by another input',()=>{
 const {host,sim}=game();
 arena(sim,host);sim.enemies=[];
 const start={x:host.x,y:host.y};
 let seq=0;
 const control=(x=0,y=0,dodge=false)=>sim.control(host,{seq:++seq,aim:0,x,y,dodge});
 control(.5);sim.step(1/30);
 const half=host.x-start.x;
 Object.assign(host,start);control(1);sim.step(1/30);
 assert.ok(half>0);
 assert.ok(Math.abs(host.x-start.x-2*half)<.001);
 control(0,0,true);
 control();
 sim.step(1/30);
 assert.ok(host.dash>0);
 assert.equal(host.dashX,-1);
 assert.equal(host.input.dodge,false);
 const dashEvents=()=>sim.events.filter(e=>e.kind==='dash'&&e.seat===host.seat).length;
 assert.equal(dashEvents(),1);
 for(let i=0;i<34;i++){control();sim.step(1/30);}
 assert.equal(dashEvents(),1);
 control(0,.3,true);sim.step(1/30);
 assert.equal(host.dashX,0);
 assert.equal(host.dashY,1);
 assert.equal(dashEvents(),2);
});

test('the private death recap keeps the five latest damaging actions, actual losses and the card state',()=>{
 const {host,guest,sim}=game();
 arena(sim,host);sim.enemies=[];
 Object.assign(host,{resistance:{},guard:1,inv:0,gold:40,bones:3,rubies:2,xp:19});
 const [done,later,paused]=host.pack.questions;
 host.solved[done.id]=1;host.questionCount=3;
 host.questionReview[later.id]={color:'red',due:8};host.questionReview[paused.id]={color:'green',due:100};
 for(let i=1;i<=5;i++){
  sim.hurtPlayer(host,i,{fire:1},true,1,undefined,undefined,{source:'Feuerfledermaus',action:'Feueratem '+i});
  settleHits(sim,host);
 }
 sim.hurtPlayer(host,500,{physical:1},true,1,undefined,undefined,{source:'Skelett',action:'Sensenhieb'});
 settleHits(sim,host);
 const recap=host.deathRecap;
 assert.equal(recap.history.length,5);
 assert.equal(recap.history[0].action,'Feueratem 2');
 assert.equal(recap.fatal.source,'Skelett');
 assert.equal(recap.fatal.action,'Sensenhieb');
 assert.deepEqual({...recap.losses},{gold:0,bones:0,rubies:0,xp:0});
 assert.equal(recap.learning.solved,1);
 assert.equal(recap.learning.later,1);
 assert.equal(recap.learning.retired,1);
 assert.equal(recap.learning.answered,3);
 assert.equal(sim.events.at(-1).to,host.seat);
 assert.equal(guest.deathRecap,undefined);
 const restored=Simulation.loadPlayer(JSON.parse(JSON.stringify(Simulation.savePlayer(host))),defaultPack);
 assert.equal(restored.deathRecap.fatal.source,'Skelett');
 sim.actions.dispatch(host,'dismiss-death',{});
 assert.equal(host.deathRecap,null);
});

test('stair landings stay in one combat area and an unalerted foe can attack across the layer boundary',()=>{
 const {host,sim}=game(103);
 const stair=sim.floor.stairs[0],centers=stair.edges.map(([a,b])=>({x:(a[0]+b[0])*TILE/2,y:(a[1]+b[1])*TILE/2}));
 const stride=centers.slice(1).flatMap((end,i)=>{
  const start=centers[i],dx=end.x-start.x,dy=end.y-start.y,n=Math.ceil(Math.hypot(dx,dy));
  return Array.from({length:n},(_,step)=>({x:start.x+dx*step/n,y:start.y+dy*step/n}));
 });
 const split=stride.findIndex(p=>sim.floor.layerAt(p.x,p.y)===stair.upper);
 Object.assign(host,stride[split-14],{inv:0,entryGrace:.4});
 const rat={...stride[split+19],type:foes.RAT,hp:70,max:70,size:1,phase:0,attack:1,windup:.01};
 rat.angle=Math.atan2(host.y-rat.y,host.x-rat.x);
 assert.notEqual(sim.floor.layerAt(rat.x,rat.y),sim.floor.layerAt(host.x,host.y));
 assert.ok(sim.floor.stairsNear(host)[0].regions.has(sim.floor.rest.id));
 assert.ok(sim.floor.stairConnected(host,rat));
 assert.ok(sim.canTarget(rat,host));
 sim.enemies=[rat];sim.currentTarget=host;
 sim.ai.act(rat,.03,host,0,1180,760);
 assert.ok(host.damageQueue.length);
 assert.equal(host.bleed,31);
});

test('spears appear in some merchant samples and hit along a thrust rather than across the sides',()=>{
 const draws=Array.from({length:64},(_,seed)=>items.shop(seed,1,pools).slice(0,3).some(it=>it.id==='spear'));
 assert.ok(draws.includes(true)&&draws.includes(false));
 const spear=items.weapon('spear');
 assert.ok(items.meleeHit(spear,112,10,0,spear.reach));
 assert.equal(items.meleeHit(spear,55,37,0,spear.reach),false);
 assert.equal(items.meleeHit(spear,-45,0,0,spear.reach),false);
 const {host,sim}=game();
 const target=arena(sim,host);
 host.equipment.weapon='spear';preparePlayer(host);
 const enemy={...target,id:'spear-target',type:foes.SKELETON,hp:80,max:80,size:1};
 const flank={...enemy,id:'spear-flank',y:enemy.y+30};
 sim.enemies=[enemy,flank];
 assert.ok(sim.charge(host,0)&&sim.attack(host,0));
 assert.ok(enemy.hp<80);
 assert.equal(flank.hp,80);
});

test('a spear grazes a wall at full extension and rebounds only after a solid hit',()=>{
 const {host,sim}=game(193);
 const {map,terrain,rooms}=sim.floor,room=rooms[0],aim=Math.PI/2;
 host.equipment.weapon='spear';preparePlayer(host);
 const spear=host.weapon;
 // Set up a straight, unobstructed strike at the south wall of the room.
 const wallY=(room.y+room.h)*TILE;
 const x=Array.from({length:room.w-2},(_,i)=>(room.x+i+1.5)*TILE).find(x=>{
  const tx=Math.floor(x/TILE),ty=wallY/TILE;
  return map[ty]?.[tx]===1&&!terrain[ty]?.[tx]&&
   sim.floor.valid(x,wallY-90,14,false,true)&&sim.floor.valid(x,wallY-105,14,false,true)&&
   !sim.floor.gateLineBlocked(x,wallY-130,x,wallY-20);
 });
 assert.ok(x);
 assert.equal(sim.floor.meleeWall(x,wallY-spear.reach+19,aim,spear,spear.reach),null);
 assert.equal(sim.floor.meleeWall(x,wallY-spear.reach+29,aim,spear,spear.reach),null);
 const y=wallY-90,contact=sim.floor.meleeWall(x,y,aim,spear,spear.reach);
 assert.ok(contact&&contact.y>=wallY&&contact.y<wallY+4);
 assert.equal(contact.normalX,0);
 assert.equal(contact.normalY,-1);
 const diagonal=sim.floor.meleeWall(x,y,aim+.18,spear,spear.reach);
 assert.ok(diagonal);
 assert.equal(diagonal.normalX,0);
 assert.equal(diagonal.normalY,-1);
 const enemy={x,y:y+48,id:'before-wall',type:foes.SKELETON,hp:80,max:80,size:1};
 const blocked={...enemy,y:wallY+16,id:'past-wall'};
 Object.assign(host,{x,y,combat:1,stamina:100});
 sim.enemies=[enemy,blocked];
 assert.ok(sim.charge(host,aim)&&sim.attack(host,aim));
 assert.ok(enemy.hp<80);
 assert.equal(blocked.hp,80);
 assert.equal(host.stamina,100-spear.stamina-9);
 assert.equal(host.attack,0);
 assert.ok(host.wallRecoil>0);
 assert.ok(Math.abs(host.y-(y-18))<1e-6);
 assert.equal(sim.charge(host,aim),false);
 assert.ok(sim.events.some(event=>event.kind==='wall-recoil'));
 for(const id of ['staff','bow']){
  const ranged=items.weapon(id);
  assert.equal(sim.floor.meleeWall(x,wallY-9,aim,ranged,ranged.reach),null);
  Object.assign(host,{x,y:wallY-9,attack:0,wallRecoil:0,stamina:100});
  host.equipment.weapon=id;preparePlayer(host);
  const before=sim.shots.length;
  assert.ok(sim.charge(host,aim)&&sim.attack(host,aim));
  assert.equal(sim.shots.length,before+1);
  assert.equal(host.wallRecoil,0);
 }
 const tx=Math.floor(x/TILE),ty=wallY/TILE;
 terrain[ty][tx]='partition';
 terrain[ty][tx+1]='partition';
 const inside=sim.floor.meleeWall(x,wallY-60,aim,spear,spear.reach);
 assert.ok(inside&&inside.y>=wallY+15&&inside.y<wallY+19);
});

test('physical arrows land once at the end of their range, and collisions retain their normal outcome',()=>{
 const {host,guest,sim}=game();
 arena(sim,host);sim.enemies=[];
 const {x,y}=host,project=createProjection(),projectGuest=createProjection();
 Object.assign(guest,{x:x-100,y});
 project(sim,host);
 projectGuest(sim,guest);
 host.equipment.weapon='bow';preparePlayer(host);
 assert.ok(sim.charge(host,0)&&sim.attack(host,0));
 sim.shots[0].left=46;
 sim.updateShots(.2);
 assert.equal(sim.shots.length,0);
 const lands=()=>sim.events.filter(event=>event.kind==='arrow-land');
 assert.equal(lands().length,1);
 assert.ok(Math.abs(lands()[0].x-x-46)<1e-6);
 assert.ok(project(sim,host).events.some(event=>event.kind==='arrow-land'));
 assert.ok(projectGuest(sim,guest).events.some(event=>event.kind==='arrow-land'));
 assert.equal(project(sim,host).events,undefined);
 sim.effects.bolts.push({x:x+22,y,angle:0,type:'frost-crossbow',life:.1,speed:300});
 sim.ai.moveFrom(.2,host,sim.clock,1280,720);
 assert.equal(sim.effects.bolts.length,0);
 assert.equal(lands().length,2);
 assert.equal(lands()[1].type,'frost-crossbow');
 assert.ok(Math.abs(lands()[1].x-x-52)<1e-6);
 const target={x:x+61,y,id:'arrow-target',type:foes.SKELETON,hp:80,max:80,size:1};
 sim.enemies=[target];host.attack=0;
 assert.ok(sim.charge(host,0)&&sim.attack(host,0));
 sim.updateShots(.2);
 assert.ok(target.hp<80);
 assert.equal(lands().length,2);
 sim.enemies=[];host.attack=0;host.stamina=100;
 host.equipment.weapon='staff';preparePlayer(host);
 assert.ok(sim.charge(host,0)&&sim.attack(host,0));sim.shots[0].left=46;
 sim.updateShots(.2);
 assert.equal(sim.shots.length,0);
 assert.equal(lands().length,2);
});

test('held weapons are covered by side and south walls and closed doors',()=>{
 const {sim}=game(103);
 const {floor}=sim,{cx,cy}=floor.rooms[0],x=(cx+.5)*TILE,y=(cy+.5)*TILE;
 const includes=(poly,px,py)=>{
  if(!poly)return true;
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   if((a.y>py)!==(b.y>py)&&px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
 };
 for(let row=cy-2;row<=cy+2;row++)for(let col=cx-2;col<=cx+2;col++){
  floor.terrain[row][col]=null;floor.map[row][col]=row===cy-1||row===cy+1||col===cx-1||col===cx+1?1:0;
 }
 const cover=floor.weaponCover(x,y,65);
 assert.ok(includes(cover,x,y-44));
 assert.ok(includes(cover,x,y+20));
 assert.ok(!includes(cover,x,y+44));
 assert.ok(!includes(cover,x-44,y-4));
 assert.ok(!includes(cover,x+44,y+4));

 const door=floor.doors.find(d=>d.id==='upper-door'),anchor=door.x-28;
 assert.ok(!includes(floor.weaponCover(anchor,door.y,66),door.x+27,door.y));
 floor.strikeDoor(door.hp,door);
 assert.ok(includes(floor.weaponCover(anchor,door.y,66),door.x+27,door.y));
});

test('quick food absorbs pending damage, chooses the smallest sufficient portion, and queues while moving at 30 percent speed',()=>{
 const {host,sim}=game();
 arena(sim,host);sim.enemies=[];
 host.inventory.push(...['glucose','banana','bread','chicken','banana'].map(id=>({kind:'food',id,rarity:'common'})));
 Object.assign(host,{guard:1,resistance:{},inv:0});
 const hp=maxHP(host),start=host.x;
 assert.ok(sim.hurtPlayer(host,21,{frost:1},true,1));
 assert.equal(host.hp,hp);
 sim.step(.92);
 assert.equal(host.hp,hp);
 const warning=createProjection()(sim,host).you.at(-3);
 assert.equal(warning[0].type,'frost');
 assert.equal(sim.actions.dispatch(host,'quick-food',{}).item.id,'bread');
 assert.equal(host.consume.end-host.consume.start,1.5);
 assert.equal(host.damageQueue[0].amount,0);
 assert.equal(sim.actions.dispatch(host,'quick-food',{}).item.id,'glucose');
 assert.equal(host.consumeQueue.length,1);
 sim.control(host,{seq:1,x:1,y:0,aim:0,dash:true});
 sim.step(.08);
 assert.equal(host.hp,hp);
 assert.ok(Math.abs(host.x-start-host.speed*.08*items.foodMove)<.001);
 assert.equal(host.dash,0);
 sim.step(1.45);
 assert.equal(host.consume.item.id,'glucose');
 assert.equal(host.consumeQueue.length,0);
 assert.ok(sim.hurtPlayer(host,12,{physical:1},true,1));
 sim.step(.99);
 assert.equal(host.hp,hp);
 sim.step(.01);
 assert.equal(host.hp,hp-12);
 assert.equal(sim.actions.dispatch(host,'quick-food',{}).item.id,'banana');
});

test('drinking keeps movement responsive at a slower pace without allowing a dash or attack',()=>{
 const {host,sim}=game();
 arena(sim,host);sim.enemies=[];
 const item={kind:'potion',brew:[],duration:10};
 host.inventory.push(item);
 const {x,walk,speed}=host,project=createProjection();
 sim.queueConsumable(host,item);
 assert.equal(host.consume.item,item);
 sim.control(host,{seq:1,x:1,y:0,aim:0,dash:true,dodge:true});
 sim.step(.08);
 assert.ok(Math.abs(host.x-x-speed*.08*items.potionMove)<.001);
 assert.ok(Math.abs(host.walk-walk-.08*items.potionWalkRate)<.001);
 assert.equal(host.moving,true);
 assert.equal(host.dash,0);
 assert.equal(sim.attack(host,0),false);
 const {you}=project(sim,host);
 assert.equal(you[5],1);
 assert.equal(you[12],7);
 const stopped=host.x;
 sim.control(host,{seq:2,x:0,y:0,aim:0});sim.step(.08);
 assert.equal(host.x,stopped);
 assert.equal(host.moving,false);
});

test('new starts give up to four exits and wide stairs connect floors by walking',()=>{
 const {host,guest,sim}=game(103,19);
 const {floor}=sim,{rest}=floor;
 assert.equal([[rest.x-1,rest.cy],[rest.x+rest.w,rest.cy],[rest.cx,rest.y-1],[rest.cx,rest.y+rest.h]]
  .filter(([x,y])=>floor.map[y][x]===0).length,4);
 assert.equal(floor.stairs.filter(stair=>stair.id.startsWith('stairs-')).length,3);
 assert.ok(floor.links.filter(link=>!link.label).every(link=>link.kind==='ladder'));
 sim.enemies=[];
 for(const stair of floor.stairs.filter(s=>s.id!=='sanctuary-spiral')){
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

test('the sanctuary has twelve accessible alcoves, four stairs and a protected way into the dungeon',()=>{
 const {host,sim}=game(193,16,2),{floor}=sim,s=floor.sanctuary;
 const world=({x,y})=>({x:(x+.5)*TILE,y:(y+.5)*TILE});
 const stations=[floor.spawn,floor.smith,floor.wellUse,floor.wellArrival,floor.glossaryStand,floor.returnPortal,floor.ward,...s.seats.map(world)];
 assert.equal(s.seats.length,12);
 for(const p of stations){
  assert.ok(floor.inSanctuary(p.x,p.y)&&floor.valid(p.x,p.y,14,false,true)&&floor.canReachSpawn(p.x,p.y));
  assert.equal(sim.hurtPlayer({...host,x:p.x,y:p.y,inv:0},20),false);
 }
 for(const direction of ['n','e','s','w'])assert.ok(floor.terrain.flat().includes('sanctuary-stairs-'+direction));
 assert.ok(floor.terrain.flat().includes('sanctuary-ward'));
 assert.equal(floor.furniture.filter(p=>p.type==='sanctuary-smith').length,1);
 assert.equal(floor.furniture.filter(p=>p.type==='sanctuary-hearth').length,1);
 const exit=floor.links.find(p=>p.id==='sanctuary-passage-0');
 Object.assign(host,exit);
 assert.equal(sim.actions.dispatch(host,'interact',{kind:'strata',index:exit.id}).link,'stairs');
 assert.equal(floor.regionAt(host.x,host.y),floor.rest.id);
 assert.ok(floor.inRest(host.x,host.y)&&!floor.inSanctuary(host.x,host.y));
 const x=(floor.rest.cx+.5)*TILE,boundary=(floor.rest.y+floor.rest.h)*TILE;
 const enemy={type:foes.SKELETON,x,y:boundary+20,hp:100};
 sim.move(enemy,0,-92);
 assert.ok(enemy.y>=boundary&&!floor.inRest(enemy.x,enemy.y));
 const state=run.floorState(193,2);state.layoutRevision=15;
 assert.equal(geometry.build(run,state).sanctuary,null);
});

test('the garden staircase reaches a protected apothecary landing two storeys above the courtyard',()=>{
 const {host,sim}=game(103),f=sim.floor,stair=f.stairs.find(s=>s.id==='sanctuary-spiral');
 const table=f.furniture.find(p=>p.type==='sanctuary-ban-table');
 assert.ok(table?.solid&&table.light);
 const start={x:(stair.a.x+.5)*TILE,y:(stair.a.y+.5)*TILE};
 const end={x:(stair.b.x+.5)*TILE,y:(stair.b.y+.5)*TILE};
 const room={x:table.x,y:table.y+2*TILE};
 assert.ok(f.inRest(room.x,room.y)&&f.canReachSpawn(room.x,room.y)&&f.valid(room.x,room.y));
 assert.equal(f.layerAt(f.spawn.x,f.spawn.y),0);
 assert.equal(f.layerAt(f.wellUse.x,f.wellUse.y),1);
 assert.equal(f.layerAt(start.x,start.y),1);
 assert.equal(f.layerAt(room.x,room.y),2);
 Object.assign(host,start);
 const curve=stair.edges.map(([a,b])=>({x:(a[0]+b[0])*TILE/2,y:(a[1]+b[1])*TILE/2}));
 for(const point of [...curve,end]){
  assert.ok(sim.move(host,point.x-host.x,point.y-host.y));
  assert.ok(Math.hypot(host.x-point.x,host.y-point.y)<.01);
 }
 assert.equal(f.layerAt(host.x,host.y),2);
 for(const point of [...curve].reverse().concat(start)){
  assert.ok(sim.move(host,point.x-host.x,point.y-host.y));
  assert.ok(Math.hypot(host.x-point.x,host.y-point.y)<.01);
 }
 assert.equal(f.layerAt(host.x,host.y),1);
 assert.ok(f.wall(stair.core.x*TILE,stair.core.y*TILE));
 assert.deepEqual(host.ingredients,[]);
});

test('stair movement follows the drawn grade while preserving lateral clearance',()=>{
 const {sim}=game(103,19),f=sim.floor;
 const center=flight=>({x:(flight.x+flight.w/2)*TILE,y:(flight.y+flight.h/2)*TILE});
 const north=f.stairFlights.find(flight=>flight.direction==='n');
 assert.deepEqual({...f.stairMotion(center(north),10,0)},{x:10,y:0});
 assert.ok(Math.abs(f.stairMotion(center(north),0,-10).y+6.8)<.001);
 assert.ok(Math.abs(f.stairMotion(center(north),0,10).y-8.3)<.001);
 const east=f.stairFlights.find(flight=>flight.direction==='e');
 const climbing=f.stairMotion(center(east),10,0),descending=f.stairMotion(center(east),-10,0);
 assert.ok(climbing.x>0&&climbing.y<0&&descending.x<0&&descending.y>0);
 assert.deepEqual({...f.stairMotion(f.spawn,4,8)},{x:4,y:8});
});

test('raised sanctuary terraces have no open bypass and keep their stations reachable',()=>{
 const {host,sim}=game(103,20,2),f=sim.floor,s=f.sanctuary;
 const steps=new Set(f.stairs.filter(stair=>stair.id.startsWith('sanctuary-')).flatMap(stair=>[...stair.stepIds]));
 const left=s.spawn.x-20;
 for(let y=0;y<34;y++)for(let x=left;x<f.W-1;x++){
  if(f.map[y][x]!==0)continue;
  const a=f.regions[y][x];
  for(const [dx,dy] of [[1,0],[0,1]]){
   const b=f.regions[y+dy][x+dx];
   if(f.map[y+dy][x+dx]===0&&f.layerForRegion(a)!==f.layerForRegion(b)){
    assert.ok(steps.has(a)||steps.has(b),`Bypass at ${x-left},${y}`);
   }
  }
 }
 assert.ok(s.terraces.some(p=>p.face==='s'&&p.level===1));
 assert.ok(s.terraces.some(p=>p.face==='s'&&p.level===2));
 const center=p=>({x:(p.x+.5)*TILE,y:(p.y+.5)*TILE});
 for(const p of [f.smith,f.wellUse,f.wellArrival,f.glossaryStand,f.returnPortal,...s.seats.map(center)]){
  assert.ok(f.inSanctuary(p.x,p.y)&&f.canReachSpawn(p.x,p.y)&&f.valid(p.x,p.y,14,false,true));
 }
 const garden=f.stairs.find(stair=>stair.id==='sanctuary-garden-stair');
 Object.assign(host,center(garden.a));sim.enemies=[];
 for(const [a,b] of garden.edges){
  const x=(a[0]+b[0])*TILE/2,y=(a[1]+b[1])*TILE/2;
  assert.ok(sim.move(host,x-host.x,y-host.y)&&Math.hypot(host.x-x,host.y-y)<.01);
 }
 assert.equal(f.layerAt(host.x,host.y),1);
});

test('new generated stairs land at usable room edges with different widths, bends and intermediate landings',()=>{
 const widths=new Set(),shapes=new Set();
 for(let i=1;i<=24;i++){
  const seed=Math.imul(i,0x9e3779b9);
  for(const depth of new Set([1,run.templeDepth(seed)])){
   const plan=run.generate(seed,true,20,depth,run.templeDepth(seed),seed);
   for(const stair of plan.stairs.filter(stair=>stair.gateways)){
    widths.add(stair.width);
    const midpoint=edge=>(edge[0][0]+edge[1][0])/2;
    shapes.add(Math.abs(midpoint(stair.edges[0])-midpoint(stair.edges.at(-1)))>.1?'bend':'straight');
    if(stair.landing)shapes.add('landing');
    if(stair.style==='jungle')shapes.add('temple');
    for(const [p,layer] of [[stair.a,stair.lower],[stair.b,stair.upper]]){
     assert.equal(plan.map[p.y][p.x],0);
     assert.equal(plan.layers[plan.regions[p.y][p.x]]??0,layer);
    }
    for(const [a,b] of stair.edges)assert.ok(Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])-stair.width)<.001);
   }
  }
 }
 assert.equal(widths.size,4);
 assert.deepEqual([...shapes].sort(),['bend','landing','straight','temple']);
 const {host,sim}=game(103,20),f=sim.floor;
 sim.enemies=[];
 for(const stair of f.stairs.filter(stair=>stair.gateways)){
  const center=p=>({x:(p.x+.5)*TILE,y:(p.y+.5)*TILE});
  const start=center(stair.a),end=center(stair.b);
  Object.assign(host,start);
  const curve=stair.edges.map(([a,b])=>({x:(a[0]+b[0])*TILE/2,y:(a[1]+b[1])*TILE/2}));
  for(const point of [...curve,end,...curve.reverse(),start]){
   assert.ok(sim.move(host,point.x-host.x,point.y-host.y)&&Math.hypot(host.x-point.x,host.y-point.y)<.01);
  }
 }
});

test('the smith checks location, materials and item identity and updates the equipped weapon in place',()=>{
 const {host,sim}=game(193,16,2),smith=sim.floor.smith;
 Object.assign(host,{gold:240,rubies:2});
 const index=host.inventory.findIndex(it=>it.kind==='weapon'),old=host.inventory[index],key=items.key(old);
 const forge=(operation,expected,element)=>sim.actions.dispatch(host,'forge',{index,key:expected,operation,element});
 assert.throws(()=>forge('improve',key),/zu weit/);
 Object.assign(host,smith);
 assert.ok(sim.actions.dispatch(host,'interact',{kind:'smith'}));
 const rare=forge('improve',key).item;
 assert.equal(rare.rarity,'rare');assert.equal(host.equipment.weaponRarity,'rare');
 assert.equal(host.gold,190);
 assert.throws(()=>forge('improve',key),/nicht möglich/);
 assert.throws(()=>forge('enchant',items.key(rare),'poison'),/nicht möglich/);
 const frost=forge('enchant',items.key(rare),'frost').item;
 assert.equal(frost.enchantment,'frost');assert.equal(host.equipment.weaponEnchantment,'frost');
 assert.equal(host.gold,110);assert.equal(host.rubies,1);
 assert.deepEqual({...items.attackSplit({physical:1},host.equipment.weaponEnchantment)},{physical:.75,frost:.25});
 assert.throws(()=>forge('enchant',items.key(frost),'frost'),/nicht möglich/);
 assert.equal(host.gold,110);
 const restored=Simulation.loadPlayer(JSON.parse(JSON.stringify(Simulation.savePlayer(host))),defaultPack);
 assert.equal(restored.equipment.weaponEnchantment,'frost');
 const project=createProjection(),enemy={...sim.enemies[0],x:smith.x+30,y:smith.y+30};
 sim.enemies=[enemy];
 assert.equal(project(sim,host).enemies.length,0);
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
  assert.ok(sim.floor.barrierFloor(site).length);
  assert.ok(sim.floor.barrierFloor(site).every(id=>sim.floor.map[Math.floor(id/sim.floor.W)][id%sim.floor.W]===0));
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
  assert.equal(createProjection()(sim,host).you.at(-1),-Math.PI/2);
  sim.stepPlayer(host,fallSeconds);
  assert.ok(sim.events.some(e=>e.kind==='death'&&e.cause==='fall'));
 }
 const sewer=game(193,undefined,run.sewerDepth(193)).sim.floor;
 const y=sewer.terrain.findIndex(row=>row.includes('sewer-pool'));
 const x=sewer.terrain[y].indexOf('sewer-pool');
 assert.equal(sewer.abyssAt((x+.5)*TILE,(y+.5)*TILE),false);
});

test('enemy knockback can cause a lethal fall and leaves the loot on reachable ground',()=>{
 const {host,sim}=game(193,12,run.templeDepth(193));
 const {terrain}=sim.floor;
 const y=terrain.findIndex((row,i)=>row.some((tile,x)=>tile==='clear-river'&&terrain[i+1]?.[x]==='bridge-x'));
 const x=terrain[y].findIndex((tile,i)=>tile==='clear-river'&&terrain[y+1][i]==='bridge-x');
 const start={x:(x+.5)*TILE,y:(y+1)*TILE+15};
 const foe={...start,id:'test-ledge',type:foes.SKELETON,roomId:0,hp:100,max:100,size:1,phase:0,angle:0,hit:0};
 Object.assign(host,{x:start.x,y:start.y+42});
 sim.enemies=[foe];
 assert.ok(sim.floor.valid(foe.x,foe.y,14));
 sim.move(foe,0,-22);
 assert.ok(!foe.fall&&!sim.floor.abyssAt(foe.x,foe.y));
 Object.assign(foe,start);
 sim.weaponHit(foe,{p:host,w:items.weapon('great-scythe'),charged:false,amount:10,split:{physical:1},impact:100,crit:0},-Math.PI/2);
 assert.ok(foe.fall&&foe.hp>0);
 assert.equal(createProjection()(sim,host,true).enemies.find(row=>row[0]===foe.id).at(-1)[0],0);
 sim.step(.4);
 assert.equal(sim.enemies.length,1);
 sim.step(.46);
 assert.ok(!sim.enemies.includes(foe));
 assert.ok(sim.events.some(e=>e.kind==='defeated'&&e.y>=start.y-1));
 const loot=[...sim.orbs.values()];
 assert.ok(loot.length);
 assert.ok(loot.every(o=>sim.floor.valid(o.x,o.y)&&sim.floor.canReachSpawn(o.x,o.y)));
});

test('the alleys have two keyed houses, night-only bats and one shared epic ring',()=>{
 for(const [seed,phase,scale] of [[0,'evening',1],[2,'night',.59],[4,'day',1.25]]){
  const {host,sim}=game(seed);
  const {floor}=sim,street=floor.alleys;
  assert.equal(street.light,phase);
  assert.equal(street.lights.length===0,phase==='day');
  assert.equal(street.houses.length,2);
  const outside=street.paved[Math.floor(street.paved.length/2)];
  assert.equal(floor.sightScale((outside.x+.5)*TILE,(outside.y+.5)*TILE),scale);
  const bats=sim.enemies.filter(e=>e.id.startsWith('street-')&&[foes.BAT,foes.STORM_BAT].includes(e.type));
  assert.equal(bats.length,phase==='night'?2:0);
  assert.equal(sim.enemies.filter(e=>e.type===foes.STREET_DOG).length,3);
  const carrier=sim.enemies.find(e=>e.alleyRing);
  assert.ok(carrier&&floor.canReachSpawn(carrier.x,carrier.y));
  sim.enemies=[];
  for(const [i,house] of street.houses.entries()){
   const door=floor.doors.find(d=>d.id===house.key),sign=i===0?-1:1;
   assert.equal(floor.layerAt(door.x,door.y),0);
   assert.equal(floor.terrain[house.cy][house.cx],'house-boards');
   assert.equal(floor.terrain[Math.floor(door.y/TILE)-sign][Math.floor(door.x/TILE)],'street-step-'+(door.north?'north':'south')+'-'+phase);
   Object.assign(host,{x:door.x,y:door.y-sign*TILE*1.8});
   sim.move(host,0,sign*TILE*3.5);
   assert.notEqual(floor.regionAt(host.x,host.y),house.id);
   assert.equal(floor.strikeDoor(999,door),door.hp);
   assert.ok(floor.doorAt(door.x,door.y));
   Object.assign(host,{x:door.x,y:door.y-sign*TILE});
   assert.throws(()=>sim.actions.dispatch(host,'interact',{kind:'key-door',index:door.id}),/Verschlossen/);
   sim.keyring[door.keyId]='held';
   sim.actions.dispatch(host,'interact',{kind:'key-door',index:door.id});
   assert.equal(sim.keyring[door.keyId],'used');
   assert.equal(floor.doorAt(door.x,door.y),undefined);
   sim.move(host,0,sign*TILE*4);
   assert.equal(floor.regionAt(host.x,host.y),house.id);
  }
  sim.defeat(carrier);
  sim.defeat(carrier);
  const rings=[...sim.orbs.values()].filter(o=>o.item.id==='avoidance');
  assert.equal(rings.length,1);
  assert.equal(rings[0].seat,0);
  assert.equal(rings[0].item.rarity,'epic');
 }
 assert.equal(items.retreatDepth(4,['avoidance',null]),4);
 assert.equal(items.retreatDepth(4,['height',null]),3);
});

test('keys stay available through cross-floor travel, merchant stock and a restored checkpoint',()=>{
 const host={seat:1,id:'host',pack:defaultPack,ws:{}},guest={seat:2,id:'guest',pack:defaultPack,ws:{}};
 const party={code:'KEYS0123',seed:193,mode:'same',members:new Map([['host',host],['guest',guest]])};
 startParty(party);
 const first=getFloor(party,host),buy=first.floor.keySources.find(site=>site.id==='2:earlier');
 assert.equal(first.floor.keyName(buy.id),'Schatzkammer · Tiefe 2');
 assert.equal(first.floor.keyName(undefined),'Unbekanntes Schloss');
 assert.equal(first.floor.keyName('quiz-ladder'),'Unbekanntes Schloss');
 const act=(floor,member,kind,index)=>floor.actions.dispatch(member.player,'interact',{kind,index});
 const pantry=[...first.orbs.values()].find(o=>o.item.id==='1:street-house-0');
 assert.equal(pantry.item.source,'Vorratskammer');
 assert.ok(first.floor.canReachSpawn(pantry.x,pantry.y));
 Object.assign(guest.player,{x:pantry.x,y:pantry.y});
 act(first,guest,'soul',pantry.id);
 assert.equal(party.keyring[pantry.item.id],'held');
 Object.assign(host.player,first.floor.merchant,{gold:4});
 const offer=act(first,host,'merchant').stock.gold.find(o=>o.id===buy.id);
 assert.equal(offer.price,4);
 first.actions.dispatch(host.player,'buy',{stock:offer.stock});
 assert.equal(host.player.gold,0);
 assert.equal(party.keyring[buy.id],'held');
 assert.throws(()=>first.actions.dispatch(host.player,'buy',{stock:offer.stock}),/nicht verfügbar/);
 host.player.searched=[2];
 first.state.gates[first.floor.gates[0].id]=true;
 first.enemies=[];first.portal={...first.floor.spawn};
 advanceParty(party,host);
 const second=getFloor(party,host),earlier=second.floor.doors.find(d=>d.keyId===buy.id);
 assert.ok(earlier);
 Object.assign(guest.player,{x:earlier.x,y:earlier.y+(earlier.north?1:-1)*TILE});
 act(second,guest,'key-door',earlier.id);
 assert.equal(second.floor.doorHP(earlier),0);
 const carrier=second.enemies.find(e=>e.id===second.state.keyCarrier);
 assert.ok(carrier&&second.floor.canReachSpawn(carrier.x,carrier.y));
 second.enemies=second.enemies.filter(e=>e!==carrier);
 second.defeat(carrier);
 const key=[...second.orbs.values()].find(o=>o.item.id==='1:later');
 assert.equal(key.item.source,'Gegnerbeute');
 assert.ok(second.floor.canReachSpawn(key.x,key.y));
 Object.assign(host.player,{x:key.x,y:key.y});
 act(second,host,'soul',key.id);
 const previousEnemy=second.enemies[0];
 previousEnemy.hp=7;
 Object.assign(host.player,second.floor.returnPortal);
 assert.equal(act(second,host,'return-portal').retreat,true);
 advanceParty(party,host,-1);
 assert.equal(getFloor(party,host),first);
 assert.deepEqual(host.player.searched,[2]);
 assert.equal(first.state.gates[first.floor.gates[0].id],true);
 const later=first.floor.doors.find(d=>d.keyId===key.item.id);
 Object.assign(host.player,{x:later.x,y:later.y+(later.north?1:-1)*TILE});
 act(first,host,'key-door',later.id);
 const stored=JSON.parse(JSON.stringify({meta:partyMetadata(party),state:partyState(party),revision:1}));
 const resumed=restoreParty(party.code,stored),restoredHost=resumed.members.get('host');
 assert.equal(resumed.keyring[key.item.id],'used');
 assert.equal(getFloor(resumed,restoredHost).state.doors[later.id],0);
 restoredHost.player.online=true;
 resumed.members.get('guest').player.online=true;
 advanceParty(resumed,restoredHost);
 const restoredSecond=getFloor(resumed,restoredHost);
 assert.equal(restoredSecond.state.doors[earlier.id],0);
 assert.equal(restoredSecond.enemies.find(e=>e.id===previousEnemy.id).hp,7);
});

test('solo transitions restore the floor snapshot and keep the run-wide keyring',()=>{
 const first=run.freshRun(193);
 first.doors['key-room-later']=0;
 first.searched=[2];
 first.souls=[{x:300,y:400,item:{kind:'food',id:'bread'}}];
 first.floorEnemies=[{id:'survivor',hp:8}];
 first.portal={x:100,y:80};
 const second=run.floorTransition(first,2,100);
 second.keyring['1:later']='held';
 second.boneClaims.bone=true;
 const returned=run.floorTransition(second,1,193);
 assert.equal(returned.doors['key-room-later'],0);
 assert.equal(returned.searched[0],2);
 assert.equal(returned.floorEnemies[0].hp,8);
 assert.equal(returned.souls[0].item.id,'bread');
 assert.equal(returned.keyring['1:later'],'held');
 assert.equal(returned.portal.x,100);
 assert.equal(returned.x,null);
 const deeper=run.floorTransition(returned,2,101);
 assert.equal(deeper.boneClaims.bone,true);
 assert.equal(deeper.dungeonSeed,100);
});

test('the hero stops clear of closed doors and can retreat out of the new collision margin',()=>{
 const {host,sim}=game(4);
 const {floor}=sim;sim.enemies=[];
 for(const door of floor.doors.filter(d=>d.streetHouse)){
  const side=door.north?1:-1;
  Object.assign(host,{x:door.x,y:door.y+side*TILE});
  sim.move(host,0,-side*34);
  assert.ok(Math.abs(host.y-door.y)>=29);
  Object.assign(host,{x:door.x,y:door.y+side*20});
  sim.move(host,0,side*18);
  assert.ok(Math.abs(host.y-door.y)>35);
  sim.keyring[door.keyId]='held';
  sim.actions.dispatch(host,'interact',{kind:'key-door',index:door.id});
  assert.ok(floor.heroClearsDoor(host,door.x,door.y));
 }
});

test('street dogs pounce twice, can double-bite, and hop sideways or away from a hit',()=>{
 const {host,sim}=game();
 const target=arena(sim,host);
 const createDog=()=>({id:'test-dog',...target,roomId:0,type:foes.STREET_DOG,hp:100,max:100,phase:0,attack:0,windup:0,aggro:7});
 const checkCombo=(roll,kind,jumps)=>{
  sim.random=()=>roll;
  const dog=createDog();sim.enemies=[dog];sim.events.length=0;
  let launches=0,phase;
  for(let i=0;i<75;i++){
   sim.step(1/30);
   const next=dog.dogMove?.stage;
   if(i===0)assert.equal(dog.dogMove?.kind,kind);
   if(next==='jump'&&phase!==next)launches++;
   phase=next;
   if(i>0&&!dog.dogMove)break;
  }
  assert.equal(launches,jumps);
  assert.equal(sim.events.filter(e=>e.kind==='sound'&&e.cue==='hit_body').length,2);
 };
 checkCombo(.5,'combo',2);
 checkCombo(.9,'double',1);
 sim.random=()=>.04;
 const {floor}=sim,room=floor.rooms[0],sites=[];
 for(let y=room.y+1;y<room.y+room.h-1;y++)for(let x=room.x+1;x<room.x+room.w-1;x++)sites.push({x:(x+.5)*TILE,y:(y+.5)*TILE});
 const clear=sites.find(({x,y})=>[[0,0],[-66,0],[16,0],[31,0],[39,0],[0,24],[0,42],[0,54]]
  .every(([dx,dy])=>floor.valid(x+dx,y+dy,19))&&!floor.gateLineBlocked(x,y,x-66,y));
 assert.ok(clear);
 Object.assign(host,{x:clear.x-66,y:clear.y});
 const dodger={...createDog(),...clear};sim.enemies=[dodger];
 sim.step(1/30);
 assert.equal(dodger.dogMove?.kind,'side');
 assert.ok(sim.ai.dodgeDog(dodger,0));
 assert.equal(dodger.dogMove.kind,'retreat');
 assert.ok(dodger.x>clear.x);
 assert.equal(sim.ai.dodgeDog(dodger,0),false);
});

test('new streets mix narrow lanes and wider areas without changing legacy street widths',()=>{
 const spans=a=>{
  const counts=new Map();
  for(const {x} of a.paved)counts.set(x,(counts.get(x)??0)+1);
  return new Set(counts.values());
 };
 for(const seed of [0,2,4,9,103,193]){
  const newStreet=run.generate(seed,true,13,1).alleys;
  const oldStreet=run.generate(seed,true,12,1).alleys;
  assert.ok(spans(newStreet).has(3)&&spans(newStreet).has(7));
  assert.ok(spans(oldStreet).has(4)&&!spans(oldStreet).has(3));
 }
});

test('seeds vary the number of routes and rooms on ground and upper layers',()=>{
 const ground=new Set(),upper=new Set(),paths=new Set(),tower=new Set();
 for(let seed=0;seed<80;seed++){
  const first=run.generate(seed,true,12,1),later=run.generate(seed,true,12,3);
  for(const layout of [first,later]){
   ground.add(layout.extraRooms.length);
   paths.add(layout.paths.filter(p=>layout.layers[p.id]===1).length);
   upper.add(layout.lofts.filter(room=>layout.layers[room.id]===1).length);
   tower.add(layout.lofts.filter(room=>layout.layers[room.id]===2).length);
   assert.ok(layout.map.every(row=>row.length===layout.map[0].length));
  }
 }
 assert.equal(ground.size,4);
 assert.ok(upper.size>=4&&paths.size>=4&&tower.size>=3);
 assert.equal(run.generate(103,true,11,1).alleys,null);
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
 const {host,guest,sim}=game(193,10);
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
 settleHits(sim,host);
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
 settleHits(sim,guest);
 assert.equal(guest.hp,max*.2+1);
 assert.equal(sim.hurtPlayer(guest,1,{physical:1},true,1),true);
 settleHits(sim,guest);
 assert.equal(guest.hp,max*.4);
 assert.equal(guest.armorCooldowns.heal,180);
 assert.equal(sim.events.at(-1).proc,'heal');
 assert.equal(guest.combatRecord.taken,2);

 Object.assign(guest,{playtime:179,hp:2});
 sim.hurtPlayer(guest,1,{physical:1},true,1);
 settleHits(sim,guest);
 assert.equal(guest.hp,1);
 Object.assign(guest,{playtime:180,hp:2});
 sim.hurtPlayer(guest,1,{physical:1},true,1);
 settleHits(sim,guest);
 assert.equal(guest.hp,max*.4);
 assert.equal(guest.armorCooldowns.heal,360);
 Object.assign(guest,{playtime:360,hp:1});
 sim.hurtPlayer(guest,100,{physical:1},true,1);
 settleHits(sim,guest);
 assert.equal(guest.combatRecord.deaths,1);
 assert.equal(guest.armorCooldowns.heal,360);
 Object.assign(guest,{playtime:359.5,hp:max*.1});
 sim.stepPlayer(guest,.25);
 assert.equal(guest.hp,max*.1);
 sim.stepPlayer(guest,.25);
 assert.equal(guest.hp,max*.4);
 assert.equal(guest.armorCooldowns.heal,540);
});

test('Pilger and Pfadschütze swap only the four starting armor pieces',()=>{
 const {host,guest,sim}=game(),pilgrim=makePlayer(3,{classId:'pilgrim'},defaultPack);
 assert.equal(guest.equipment.weapon,'bow');assert.deepEqual(guest.equipment.rings,['dodge',null]);
 assert.equal(guest.attributes.dexterity,15);assert.equal(guest.attributes.faith,10);
 assert.equal(pilgrim.equipment.weapon,'blade');assert.deepEqual(pilgrim.equipment.rings,['faith',null]);
 assert.equal(pilgrim.attributes.faith,15);assert.equal(pilgrim.attributes.dexterity,10);
 for(const slot of ['helmet','chest','legs','boots']){
  for(const [player,set] of [[guest,'hunter'],[pilgrim,'pathfinder']]){
   const id=set+'-'+slot;
   assert.equal(player.equipment.armor[slot],id);
   assert.ok(player.inventory.some(it=>it.kind==='armor'&&it.id===id));
  }
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
 assert.equal(sim.shots.at(-1).left,guest.weapon.reach);
 assert.equal(items.arrowRange(guest.weapon,pilgrim.equipment.armor),1.12);
 assert.equal(items.arrowRange(host.weapon,pilgrim.equipment.armor),1);

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

test('breakable furniture stops attacks and bolts until its hit points run out',()=>{
 const {host,guest,sim}=game(),floor=sim.floor;
 let cover,start,far,aim;
 for(const prop of floor.furniture.filter(p=>p.type==='barrel'&&!floor.inRest(p.x,p.y))){
  for(const [dx,dy] of [[1,0],[0,1]]){
   const distance=(dx?prop.w:prop.h)/2+24;
   const from={x:prop.x-dx*distance,y:prop.y-dy*distance},to={x:prop.x+dx*distance,y:prop.y+dy*distance};
   if(!floor.valid(from.x,from.y,14)||!floor.valid(to.x,to.y,14)||
    floor.gateLineBlocked(from.x,from.y,to.x,to.y)||floor.furnitureBetween(from.x,from.y,to.x,to.y)!==prop)continue;
   cover=prop;start=from;far=to;aim=Math.atan2(dy,dx);break;
  }
  if(cover)break;
 }
 assert.ok(cover);
 const enemy={...far,id:'cover-target',type:foes.SKELETON,roomId:0,hp:90,max:90,size:1,phase:0};
 guest.online=false;
 sim.enemies=[enemy];
 Object.assign(host,start,{region:floor.regionAt(start.x,start.y),damage:8,crit:0});
 const attack=()=>{
  host.attack=0;
  assert.ok(sim.charge(host,aim)&&sim.attack(host,aim));
 };
 assert.equal(floor.furnitureHP(cover),24);
 assert.ok(floor.furnitureBlocked(cover.x,cover.y,0));
 attack();
 assert.equal(enemy.hp,90);
 assert.equal(floor.furnitureHP(cover),16);

 sim.effects.bolts.push({...far,type:'bow',angle:aim+Math.PI,speed:330,life:1.2});
 sim.ai.moveFrom(.27,host,.27,1180,760);
 assert.equal(sim.effects.bolts.length,0);
 assert.equal(host.damageQueue.length,0);
 assert.equal(floor.furnitureHP(cover),5);
 Object.assign(enemy,{angle:aim+Math.PI,runAttack:.2,runDuration:.36,hit:0,attack:4});
 sim.currentTarget=host;sim.ai.act(enemy,.035,host,.305,1180,760);sim.currentTarget=null;
 assert.equal(host.damageQueue.length,0);
 assert.equal(floor.furnitureHP(cover),0);
 assert.ok(!floor.furnitureBlocked(cover.x,cover.y,0));
 assert.ok(!sim.vaultPath(host,aim));
 assert.ok(sim.events.some(e=>e.kind==='furniture'&&e.hp===0&&e.id===cover.breakId));
 assert.equal(createProjection()(sim,host,true).furnitureDamage[cover.breakId],0);
 const restored=geometry.build(run,JSON.parse(JSON.stringify(sim.state)));
 assert.ok(!restored.furnitureBlocked(cover.x,cover.y,0));
 attack();
 assert.ok(enemy.hp<90);
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
 settleHits(sim,host);
 assert.equal(max-host.hp,20);
 Object.assign(host,pool,{hp:max,inv:0});
 sim.hurtPlayer(host,damage,{lightning:1},true,1);
 settleHits(sim,host);
 assert.equal(max-host.hp,27);
 Object.assign(guest,pool,{resistance:{},guard:1,inv:0});
 const before=guest.hp;
 host.mods.element='lightning';host.damage=30;
 assert.ok(sim.charge(host,0));assert.ok(sim.attack(host,0));
 settleHits(sim,guest);
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
 settleHits(sim,host);
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

test('procedural stairs connect different chambers without cutting through the crypt or an existing floor',()=>{
 const entries=new Set();
 for(let i=1;i<=100;i++)for(let depth=1;depth<=run.LAST_DEPTH;depth++){
  const seed=Math.imul(i,0x9e3779b9);
  const d=run.generate(seed,true,15,depth,run.templeDepth(seed),seed);
  if(d.stairs.length)entries.add(d.stairs[0].roomIds[0]);
  for(const s of d.stairs){
   assert.equal(d.map[s.a.y][s.a.x],0);
   assert.equal(d.map[s.b.y][s.b.x],0);
   assert.equal(d.layers[d.regions[s.b.y][s.b.x]],s.upper);
   for(let y=s.y;y<s.y+s.h;y++)assert.ok(s.stepIds.includes(d.regions[y][s.a.x]));
  }
 }
 assert.ok(entries.has(15)&&[...entries].filter(id=>id<5).length>=3);
 const {host,sim}=game(-731389592),{floor}=sim,s=floor.stairs[0];
 assert.notEqual(s.roomIds[0],floor.rest.id);
 Object.assign(host,{x:(s.a.x+.5)*TILE,y:(s.a.y+.5)*TILE});
 assert.ok(floor.canReachSpawn(host.x,host.y));
 sim.enemies=[];
 assert.ok(sim.move(host,0,(s.b.y-s.a.y)*TILE));
 assert.equal(floor.layerAt(host.x,host.y),1);
});

test('an eagle flies across the tower edge and can still be hit from the battlements',()=>{
 const {host,guest,sim}=game(-731389592),{floor}=sim,{roof}=floor;
 const left=roof.x*TILE,y=(roof.cy+.5)*TILE;
 guest.online=false;Object.assign(host,{x:left+38,y:y+70});
 const eagle={id:'swoop',type:foes.EAGLE,x:left+22,y,hp:80,max:80,size:1,roomId:0,
  phase:0,hit:0,attack:10,windup:0,angle:Math.PI,runAttack:.65,runDuration:.65};
 sim.enemies=[eagle];sim.currentTarget=host;
 sim.ai.act(eagle,.12,host,0,1180,760);
 assert.ok(floor.towerAir(eagle.x,eagle.y));
 assert.equal(floor.layerAt(eagle.x,eagle.y),3);
 assert.ok(!eagle.fall&&eagle.runAttack>0);
 assert.ok(foes.spriteFrame(eagle)>=12&&foes.spriteFrame(eagle)<18);
 sim.move(eagle,-18,0,true);
 assert.ok(floor.towerAir(eagle.x,eagle.y)&&!eagle.fall);
 Object.assign(host,{y,equipment:{...host.equipment,weapon:'bow'}});preparePlayer(host);
 assert.ok(floor.gateLineBlocked(host.x,host.y,eagle.x,eagle.y));
 assert.ok(sim.charge(host,Math.PI)&&sim.attack(host,Math.PI));
 sim.updateShots(.26);
 assert.ok(eagle.hp<80);
 const portal=floor.portalPosition(eagle);
 assert.ok(floor.valid(portal.x,portal.y)&&floor.canReachSpawn(portal.x,portal.y));
 assert.equal(floor.regionAt(portal.x,portal.y),roof.id);
});

test('the hero can return from the lip, and an eagle can defeat the Ring der Höhe with knockback',()=>{
 const {host,guest,sim}=game(-731389592,9);
 const roof=sim.floor.roof;
 assert.ok(roof.hail);
 const lip={x:roof.x*TILE+16,y:(roof.cy+.5)*TILE};
 const full=maxHP(host);
 Object.assign(host,lip,{hp:full,inv:0});
 sim.enemies=[];
 assert.equal(sim.move(host,-24,0),true);
 assert.ok(sim.floor.abyssAt(host.x,host.y));
 assert.equal(sim.floor.pastLedge(host.x,host.y),false);
 assert.equal(sim.move(host,24,0),true);
 assert.equal(sim.move(host,-55,0),false);
 assert.equal(host.combatRecord.deaths,0);
 assert.equal(host.fall.remaining,fallSeconds);
 assert.equal(createProjection()(sim,host).you.at(-2),0);
 sim.stepPlayer(host,fallSeconds*.5);
 assert.equal(createProjection()(sim,host).you.at(-2),.5);
 sim.stepPlayer(host,fallSeconds*.5);
 assert.equal(host.combatRecord.deaths,1);
 assert.equal(sim.events.at(-1).cause,'fall');
 sim.actions.dispatch(host,'dismiss-death',{});
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
 assert.equal(host.fall.origin.source,'Adler');
 assert.equal(host.combatRecord.deaths,1);
 sim.stepPlayer(host,fallSeconds);
 assert.equal(host.combatRecord.deaths,2);
 assert.equal(sim.events.at(-1).cause,'fall');
 assert.equal(sim.events.at(-1).recap.fatal.source,'Adler');
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
 settleHits(sim,host);
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
 assert.equal(q.trial.seconds,50);
 const asked=new Set();
 for(let i=0;i<3;i++){
  assert.equal(q.trial.correct,i);
  assert.ok(!asked.has(q.question.id));
  asked.add(q.question.id);
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
 settleHits(sim,guest);
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
  assert.equal(response.ok,true);
  const awarded=player.xp+(player.level>1?balance.xpRequired(1):0);
  assert.equal(awarded,(15+(start.question.difficulty||1)*5)*2.5);
  assert.throws(()=>sim.actions.dispatch(player,'answer',{quiz:start.quiz,choice:choice(player.quiz.q)}),/nicht mehr offen/);
  sim.actions.dispatch(player,'review',{quiz:start.quiz,color:'yellow'});
  assert.equal(player.altarUses[0],1);
 }
 const p=makePlayer(1,null,defaultPack),q=makePlayer(2,null,defaultPack);
 const solo=geometry.spawnEnemies(run,foes,{...run.floorState(193,1)},legacy,false);
 assert.equal(solo[0].max,Math.round(foes.health(solo[0].type,solo[0].boss,1)*.5));
 assert.equal(p.level,q.level);
});

test('seeded knowledge altars can appear in the alleys, sewer and upper floors, with increasing XP thresholds',()=>{
 const locations=new Set(),counts=new Set();
 for(const [seed,depth] of [[193,1],[1,3],[1013904242,2],[-731389592,1]]){
  const {sim}=game(seed,15,depth),{floor}=sim;
  counts.add(floor.shrines.length);
  assert.ok(floor.shrines.length>=3&&floor.shrines.length<=6);
  const rebuilt=geometry.build(run,sim.state);
  assert.deepEqual(floor.shrines,rebuilt.shrines);
  for(const [i,shrine] of floor.shrines.entries()){
   const region=floor.regionAt(shrine.x,shrine.y);
   assert.equal(shrine.i,i);
   assert.ok(shrine.topic>=0&&shrine.topic<floor.rooms.length);
   assert.ok(floor.valid(shrine.x,shrine.y,14)&&floor.canReachSpawn(shrine.x,shrine.y));
   locations.add(region===floor.alleys?.id?'street':floor.layerForRegion(region));
  }
  assert.ok(floor.rooms.some(room=>!floor.shrines.some(p=>floor.regionAt(p.x,p.y)===room.i)));
 }
 assert.ok(['street',-1,1,3].every(location=>locations.has(location)));
 assert.ok(counts.size>1);
 assert.equal(balance.questionXP(2,false,'shrine'),62.5);
 assert.equal(balance.questionXP(2,true,'boss-altar'),12.5);
 assert.equal(balance.questionXP(2,false,'gate'),25);
 assert.deepEqual([1,2,3,5,10].map(balance.xpRequired),[71,93,121,195,485]);
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
 arena(secondFloor,hostMember.player);
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
 assert.deepEqual(guest.latest.enemies,[]);
 await wait(()=>host.latest?.peer&&host.latest.enemies.some(row=>row[0]===enemy.id));
 const scaled=host.latest.enemies.find(row=>row[0]===enemy.id);
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
 const arrow=sim.effects.bolts[0];
 const left=Math.max(0,Math.min(sim.floor.W*TILE-960,plate.x-480));
 assert.ok(arrow.angle===0?arrow.x<left:arrow.x>left+960);
 assert.equal(arrow.approach,.34);
 Object.assign(player,{y:plate.y-45});
 for(let i=0;i<35;i++)sim.ai.moveFrom(.03,player,.3+i*.03,960,640);
 assert.equal(sim.effects.bolts.length,0);
 assert.ok(sim.events.some(e=>e.kind==='arrow-land'&&e.type==='trap'));
});

test('seeded temple rooms form connected complexes with immediate waterfall reveals and optional jungle stairs',()=>{
 const counts=new Set(),placement=new Set(),types=new Set();let multiple=false,upper=false;
 for(const seed of [193,103,1,13,-731389592,1013904242]){
  const depth=run.templeDepth(seed),{sim}=game(seed,17,depth),{floor}=sim;
  counts.add(floor.templeRooms.length);multiple||=floor.waterfallBanks.size>1;
  const trail=floor.links.find(p=>p.id==='jungle-trail-0');
  assert.ok(floor.valid(trail.x,trail.y,14,false,true)&&floor.canReachSpawn(trail.x,trail.y));
  placement.add(floor.regionAt(trail.x,trail.y));
  const sx=Math.floor(trail.exit.x/TILE),sy=Math.floor(trail.exit.y/TILE),start=sy*floor.W+sx;
  const visited=new Set([start]),frontier=[start];
  for(let i=0;i<frontier.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=frontier[i]%floor.W+dx,y=Math.floor(frontier[i]/floor.W)+dy,id=y*floor.W+x;
   if(floor.map[y]?.[x]!==0||!floor.templeRegions.has(floor.regions[y][x])||visited.has(id))continue;
   visited.add(id);frontier.push(id);
  }
  for(const room of floor.templeRooms)assert.ok(visited.has(room.cy*floor.W+room.cx));
  for(const e of sim.enemies)if(e.id.startsWith('temple-'))types.add(e.type);
  for(const [river,banks] of floor.waterfallBanks){
   const bank=floor.templeRooms.find(room=>room.id===banks[0]);
   const sight=vision.create(floor,TILE,floor.sightBarriers(),[],new Set());
   sight.update({x:(bank.cx+.5)*TILE,y:(bank.cy+.5)*TILE},700,480);
   const row=floor.terrain.findIndex((row,y)=>row.some((t,x)=>t==='waterfall'&&floor.regions[y][x]===river));
   const col=floor.terrain[row].findIndex((t,x)=>t==='waterfall'&&floor.regions[row][x]===river);
   assert.ok(sight.remembers((col+.5)*TILE,(row+.5)*TILE));
  }
  upper||=floor.stairs.some(s=>s.id.startsWith('jungle-stairs-')&&s.upper===1);
 }
 assert.ok(counts.size>=3&&placement.size>=2&&multiple&&upper&&types.size>3);
});

test('large inventories can buy items, pick up loot and collect a cup',()=>{
 const {host,sim}=game(193,15);
 host.inventory=Array.from({length:84},()=>({...host.inventory[0]}));
 host.gold=2000;
 Object.assign(host,sim.floor.merchant);
 const stock=sim.actions.dispatch(host,'interact',{kind:'merchant'}).stock.gold;
 const offer=stock.find(o=>o.kind!=='key');
 sim.actions.dispatch(host,'buy',{stock:offer.stock});
 const purchased=host.inventory.length;
 assert.ok(purchased>84);
 arena(sim,host);
 const prior=new Set(sim.orbs.keys());
 assert.ok(sim.drop(host,{kind:'food',id:'bread',rarity:'common'},host.seat));
 const loot=[...sim.orbs.values()].find(o=>!prior.has(o.id));
 Object.assign(host,{x:loot.x,y:loot.y});
 sim.actions.dispatch(host,'interact',{kind:'soul',index:loot.id});
 Object.assign(host,sim.floor.cupPoint);
 sim.actions.dispatch(host,'interact',{kind:'cup'});
 assert.equal(host.inventory.length,purchased+2);
});

test('shrine arches sort at the stone feet and plants stay clear of benches',()=>{
 const {sim}=game();
 const {furniture,furnitureAt,regionAt,cupPoint}=sim.floor;
 const arches=furniture.filter(p=>p.type==='sanctuary-arch'||p.type==='sanctuary-vault');
 assert.ok(arches.some(p=>p.type==='sanctuary-vault'));
 assert.ok(arches.some(p=>p.type==='sanctuary-arch'));
 assert.equal(cupPoint,null);
 for(const arch of arches){
  assert.notEqual(regionAt(arch.x,arch.y),122);
  const simple=arch.type==='sanctuary-arch';
  const feet=simple?[-39,39]:[-102,9,101],y=arch.y-(simple?1:19);
  for(const x of feet)assert.equal(furnitureAt(arch.x+x,y,0)?.type,arch.type);
  assert.equal(furnitureAt(arch.x+(feet[0]+feet[1])/2,y,9,6),undefined);
  assert.ok(arch.sortY<y&&y-arch.sortY<1);
 }
 const benches=furniture.filter(p=>p.type==='bench'&&sim.floor.inSanctuary(p.x,p.y));
 const flowers=furniture.filter(p=>p.type==='sanctuary-flowers');
 assert.ok(benches.length&&flowers.length);
 for(const p of flowers)assert.ok(benches.every(b=>Math.abs(p.x-b.x)>=54||Math.abs(p.y-b.y)>=31));
});

test('the spiral stair meets a full-width stone landing in the garden',()=>{
 const {host,sim}=game();
 const {terrain,stairFlights}=sim.floor;
 const stair=stairFlights.find(f=>f.id==='sanctuary-spiral'),[a,b]=stair.edges[0];
 assert.equal(a[0],b[0]);
 assert.ok(Math.abs(a[1]-b[1])>2.6);
 const x=a[0]*TILE,y=(a[1]+b[1])*TILE/2;
 for(let row=Math.floor(b[1]);row<=Math.floor(a[1]);row++){
  assert.equal(terrain[row][a[0]-1],'sanctuary-stone');
 }
 for(const offset of [-.8,0,.8]){
  Object.assign(host,{x:x-2.75*TILE,y:y+offset*TILE});
  assert.ok(sim.move(host,3*TILE,0));
  assert.ok(Math.abs(host.x-x-TILE/4)<.001);
  assert.ok(sim.move(host,-3*TILE,0));
  assert.ok(Math.abs(host.x-x+2.75*TILE)<.001);
 }
});

test('players can walk in both directions below a stair and a bridge without switching decks',()=>{
 const {host,sim}=game(-1640531527,21);
 sim.enemies=[];
 const {underpasses,underpassAt,floorStep}=sim.floor;
 assert.deepEqual(Array.from(underpasses,p=>p.style),['stone','bridge']);
 for(const p of underpasses)for(const dir of [-1,1]){
  const x=(p.x+p.w/2)*TILE,y=(p.y+p.h/2)*TILE,horizontal=p.axis==='x';
  const travel=((horizontal?p.w:p.h)*TILE/2+16)*dir;
  const dx=horizontal?travel:0,dy=horizontal?0:travel;
  Object.assign(host,{x:x-dx,y:y-dy,underpass:null});
  assert.ok(sim.move(host,dx,dy));
  assert.equal(underpassAt(host)?.id,p.id);
  assert.equal(floorStep({x,y},x+dx,y+dy,14,true,false),null);
  assert.ok(sim.move(host,dx,dy));
  assert.equal(underpassAt(host),null);
  assert.ok(Math.hypot(host.x-x-dx,host.y-y-dy)<.001);
 }
});

test('combat audio fires with projectile release, web landing and the start of fire breath',()=>{
 const {host,sim}=game(),pos=arena(sim,host);
 sim.currentTarget=host;
 const enemy=(type)=>({...pos,type,size:1,hp:100,phase:0,hit:0,angle:Math.PI,windup:.01,attack:0});
 const heard=cue=>sim.events.filter(event=>event.kind==='sound'&&event.cue===cue);
 const act=(foe)=>sim.ai.act(foe,.02,host,0,960,640);

 act(enemy(2));
 assert.equal(heard('enemy_spider_web').length,1);
 assert.equal(heard('enemy_spider_web_land').length,0);
 for(let i=1;i<=60;i++)sim.ai.moveFrom(.025,host,i*.025,960,640);
 const [landing]=heard('enemy_spider_web_land');
 assert.equal(heard('enemy_spider_web_land').length,1);
 const [patch]=sim.effects.webPatches;
 assert.equal(landing.x,Math.round(patch.x*10)/10);
 assert.equal(landing.y,Math.round(patch.y*10)/10);

 act(enemy(foes.ARCHER));
 act(enemy(foes.CROSSBOW));
 act(enemy(foes.FROST_CROSSBOW));
 assert.equal(heard('bow_release').length,1);
 assert.equal(heard('crossbow_release').length,2);

 const bat=enemy(foes.BAT);
 bat.batMove={age:foes.attacks[foes.BAT].windup-.03,next:0,duration:.71};
 act(bat);
 assert.equal(heard('element_fire_cone').length,0);
 act(bat);act(bat);
 assert.equal(heard('element_fire_cone').length,1);
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

test('seeing a skeleton from an open passage starts its grace and lets it pursue without entering the room',()=>{
 const {host,guest,sim}=game(-1640531527);
 const court=sim.floor.court,x=(court.cx+.5)*TILE,y=(court.y-1.5)*TILE;
 host.online=false;
 Object.assign(guest,{x,y});
 const enemy={id:'doorway-skeleton',type:foes.SKELETON,hp:150,max:150,size:1,x,y:(court.y+2.5)*TILE,
  roomId:0,phase:0,attack:5,hit:0,angle:0,windup:0};
 sim.enemies=[enemy];
 assert.notEqual(sim.floor.regionAt(guest.x,guest.y),court.id);
 const originalY=enemy.y;
 sim.step(1/30);
 assert.ok(Number.isFinite(enemy.revealedAt));assert.equal(enemy.aggro??0,0);
 for(let i=0;i<7;i++)sim.step(1/30);
 assert.equal(enemy.y,originalY);
 for(let i=0;i<28;i++)sim.step(1/30);
 assert.ok(enemy.aggro>0&&enemy.y<originalY-20);
 assert.equal(sim.floor.regionAt(guest.x,guest.y),court.passage.id);
 assert.equal(sim.explored.has(court.id),false);
});

test('ladders and chests reserve separate floor, and wall-offset loot can be recovered',()=>{
 for(const [seed,revision] of [[1,10],[8,11],[97,11],[103,11],[193,11],[-1640531527,11]]){
  const state=run.freshRun(seed);state.layoutRevision=revision;
  const floor=geometry.build(run,state);
  for(const chest of floor.chests){
   assert.ok(floor.valid(chest.x,chest.y,17),'invalid chest for seed '+seed);
   assert.ok(floor.links.filter(l=>l.kind==='ladder').every(l=>gap(chest,l)>=62),'ladder overlaps chest for seed '+seed);
  }
 }
 const {host,sim}=game();
 const room=sim.floor.rooms[0],position={x:room.x*TILE-3,y:Math.round((room.y+1.5)*TILE)};
 assert.ok(sim.floor.wall(position.x,position.y));
 assert.ok(sim.drop(position,{kind:'food',id:'banana',rarity:'common'},host.seat));
 const orb=[...sim.orbs.values()].at(-1);
 assert.ok(sim.floor.valid(orb.x,orb.y,17));
 assert.ok(gap(position,orb)<96);
 assert.ok(sim.floor.canReachSpawn(orb.x,orb.y));
 Object.assign(host,{x:orb.x,y:orb.y});
 sim.actions.dispatch(host,'interact',{kind:'soul',index:orb.id});
 assert.equal(host.inventory.at(-1).id,'banana');
});
