// Verify cautious rat choices against the REAL combat simulator.
// This is deliberately deterministic to catch AI regressions in CI.
const assert=require('node:assert/strict');
global.window={};
require('../beta/dungeon-enemies.js');
require('../beta/dungeon-enemy-sim.js');
const rules=window.DungeonEnemies,noop=()=>{},no=()=>false;
function simulate(distance,roll,seconds,attack=1){
 const hero={x:distance,y:0,inv:0,dash:0,hp:100};
 const rat={x:0,y:0,type:rules.RAT,size:.86,hp:49,max:49,
  phase:0,attack,windup:0,recover:0,runAttack:0,
  emerge:0,angle:0,hit:0,aggro:7,ratComboIndex:0};
 const floor={W:40,H:40,regionAt:()=>0,inRest:no,outsideAt:no,
  layerAt:()=>0,valid:()=>true,furnitureAt:no,furnitureBetween:no,
  gateLineBlocked:no,furnitureBlocked:no,wall:no,gateBlocked:no,
  pressurePlates:[]};
 const states=new Set(),motions=new Set(),hits=[],distances=[];
 let time=0,blocked=0;
 const sim=window.DungeonEnemySim.create({
  floor,enemyRules:rules,state:{bolts:[],waterArcs:[],enemyHazards:[],
   stormStrikes:[],webShots:[],webPatches:[]},
  save:{floor:1},items:{foes:[],foeAttack:[]},
  balance:{counterSeconds:.3},actorRadius:()=>12,nearActor:no,
  enemyEncounterReady:()=>true,coopActors:()=>[hero],getEnemies:()=>[rat],
  takeDamage:(actor,amount)=>{
   if(actor.inv>0)return false;
   actor.inv=.75;hits.push({time,amount});return true;
  },
  addBleed:noop,maxHP:()=>100,rand:()=>roll,soundWorld:noop,
  landArrow:noop,arrowGroundClear:()=>true,arrowTargetHeight:()=>0,
  moveActor:(e,dx,dy)=>{
   // Simulated rigid obstacle left of spawn. World physics, not the rat,
   // resolves collision so an escape hop cannot teleport across the wall.
   if(e.x+dx< -30){blocked++;e.x=-30;}
   else e.x+=dx;
   e.y+=dy;
  }
 });
 for(let i=0;i<seconds*120;i++){
  const dt=1/120;
  hero.inv=Math.max(0,hero.inv-dt);
  sim.moveFrom(dt,hero,time,1280,720);
  sim.act(rat,dt,hero,time,1280,720);
  states.add(rat.ratState);
  if(rat.ratMotion)motions.add(rat.ratMotion.name);
  distances.push(Math.hypot(hero.x-rat.x,hero.y-rat.y));
  time+=dt;
 }
 return {rat,hits,states,motions,distances,blocked};
}
{
 const s=simulate(180,.65,3,1);
 assert(s.states.has('watch')&&s.states.has('circle'),
  'at medium distance the rat sniffs and circles instead of always charging');
 assert.equal(s.hits.length,0,'cautious rat does not immediately bite');
 assert(Math.min(...s.distances)>70,
  'rat preserves a standoff band until it decides to commit');
 assert(Math.max(...s.distances)<185);
}
{
 const s=simulate(180,.65,8,1);
 assert(s.states.has('commit'),'caution must eventually lead to an attack');
 assert(s.hits.length>0,'a rat cannot circle forever without engaging');
 assert(s.distances.some(d=>d<55),'commit closes the distance for a bite');
}
{
 const s=simulate(35,.2,3,0);
 assert(s.motions.has('jump'),'some rats jump away after biting');
 assert(s.hits.length>0);
 assert(s.distances.some(d=>d>70),'backwards hop opens safe space');
 assert(s.rat.x>=-30,'a backwards jump respects collision barriers');
 assert(s.blocked>0,'test fixture actually challenges the wall collision');
}
{
 const s=simulate(35,.55,3,0);
 assert(s.states.has('withdraw'),
  'some rats walk backward instead of repeatedly snapping in place');
 assert(Math.max(...s.distances)>60);
}
{
 const s=simulate(35,.82,3,0);
 assert(s.motions.has('dodge'),
  'post-bite circling includes a lateral dodge');
}
console.log('Rat behavior: cautious standoff, orbiting, hesitation, eventual bite, side dodge, retreat jump/backpedal and collision OK');
