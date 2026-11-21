// Rat bite combo and collision-aware evasive locomotion in real combat simulator.
const assert=require('node:assert/strict');
global.window={};
require('../beta/dungeon-enemies.js');
require('../beta/dungeon-enemy-sim.js');
const rules=window.DungeonEnemies;
const no=()=>false,noop=()=>{};
function fight(distance=35,comboIndex=2){
 const hero={x:distance,y:0,inv:0,dash:0,hp:100};
 const rat={x:0,y:0,type:rules.RAT,size:.86,hp:49,max:49,
  phase:0,attack:0,windup:0,recover:0,runAttack:0,emerge:0,
  angle:0,hit:0,aggro:7,ratComboIndex:comboIndex};
 const floor={W:40,H:40,regionAt:()=>0,inRest:no,outsideAt:no,
  layerAt:()=>0,valid:()=>true,furnitureAt:no,furnitureBetween:no,
  gateLineBlocked:no,furnitureBlocked:no,wall:no,gateBlocked:no,
  pressurePlates:[]};
 const hits=[],bleeds=[],moves=[];
 let time=0;
 const sim=window.DungeonEnemySim.create({
  floor,enemyRules:rules,state:{bolts:[],waterArcs:[],enemyHazards:[],
   stormStrikes:[],webShots:[],webPatches:[]},
  save:{floor:1},items:{foes:[],foeAttack:[]},
  balance:{counterSeconds:.3},actorRadius:()=>12,nearActor:no,
  enemyEncounterReady:()=>true,coopActors:()=>[hero],getEnemies:()=>[rat],
  takeDamage:(actor,amount)=>{
   if(actor.inv>0)return false;
   hits.push({t:time,amount});actor.inv=.75;return true;
  },
  addBleed:(actor,amount)=>bleeds.push(amount),maxHP:()=>100,
  rand:()=>1,soundWorld:noop,landArrow:noop,arrowGroundClear:()=>true,
  arrowTargetHeight:()=>0,moveActor:(e,dx,dy)=>{
   moves.push([dx,dy]);e.x+=dx;e.y+=dy;
  }
 });
 function step(){
  const dt=1/120;
  hero.inv=Math.max(0,hero.inv-dt);
  sim.moveFrom(dt,hero,time,1280,720);
  sim.act(rat,dt,hero,time,1280,720);
  time+=dt;
 }
 return {hero,rat,hits,bleeds,moves,step};
}
{
 const a=fight(35,2);
 for(let i=0;i<160;i++)a.step();
 assert.equal(a.rat.ratAttackClip,'combo','every third rat attack is double');
 assert.deepEqual(a.hits.map(h=>h.amount),[4,5],
  'both separately avoidable bites hit when target remains');
 assert(a.hits[1].t-a.hits[0].t>.30,'reaction interval between hits');
 assert.equal(a.bleeds.length,1,'combo applies one bleed, not two');
}
{
 const a=fight(35,2);
 let escaped=false;
 for(let i=0;i<200;i++){
  a.step();
  if(a.hits.length===1){a.hero.x=160;escaped=true;break;}
 }
 assert(escaped,'first rat bite must happen before testing second-hit dodge');
 for(let i=0;i<160;i++)a.step();
 assert.equal(a.hits.length,1,'moving out of reach dodges second bite');
}
{
 const a=fight(35,0);
 a.rat.hit=.5;a.rat.attack=1;
 a.step();
 assert(a.rat.ratMotion?.name.startsWith('dodge'),'recent hit prompts lateral dodge');
 const start={x:a.rat.x,y:a.rat.y};
 for(let i=0;i<25;i++)a.step();
 assert(Math.hypot(a.rat.x-start.x,a.rat.y-start.y)>5,
  'dodge uses physical actor movement');
 assert(a.moves.length>0);
}
{
 const a=fight(120,0);
 a.rat.attack=1;
 a.step();
 assert.equal(a.rat.ratMotion?.name,'jump');
 for(let i=0;i<20;i++)a.step();
 assert(a.rat.x>0,'lunge advances through actor movement');
 assert(a.moves.length>0);
}
console.log('Rat two-bite contacts, reaction window, dodge, leap, collision movement OK');
