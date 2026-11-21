// Exercise the combat clock and swept projectile tests used in the actual game.
const assert=require('node:assert/strict');
global.window={};
require('../beta/dungeon-enemies.js');
require('../beta/dungeon-enemy-sim.js');
const rules=window.DungeonEnemies;
function encounter(kit,distance,wallX=Infinity,height=0){
 const actor={x:distance,y:0,hp:100,dash:0,inv:0};
 const enemy={type:kit==='bow'?rules.ARCHER:rules.SKELETON,skeleton:kit,x:0,y:0,
  angle:0,phase:0,windup:0,attack:0,hit:0,size:1};
 const state={bolts:[],waterArcs:[],enemyHazards:[],stormStrikes:[],webShots:[],webPatches:[]};
 const noop=()=>{},no=()=>false,hits=[],landed=[];
 const floor={W:100,H:100,pressurePlates:[],regionAt:()=>0,inRest:no,outsideAt:no,
  valid:()=>true,furnitureAt:no,furnitureBetween:no,gateLineBlocked:no,
  furnitureBlocked:no,wall:no,gateBlocked:no,doorAt:no,layerAt:()=>0};
 const sim=window.DungeonEnemySim.create({floor,enemyRules:rules,state,save:{floor:1},
  items:{foes:[],foeAttack:[]},balance:{counterSeconds:.3},actorRadius:()=>12,
  nearActor:no,enemyEncounterReady:()=>true,coopActors:()=>[actor],getEnemies:()=>[enemy],
  takeDamage:(hero,amount)=>{hits.push(amount);return false;},maxHP:()=>100,rand:()=>1,
  soundWorld:noop,landArrow:p=>landed.push({...p}),arrowGroundClear:x=>x<wallX,
  arrowTargetHeight:()=>height,moveActor:(e,x,y)=>{e.x+=x;e.y+=y;}});
 const step=1/120;
 let time=0;
 function advance(){sim.moveFrom(step,actor,time,1280,720);sim.act(enemy,step,actor,time,1280,720);time+=step;}
 return {state,actor,enemy,advance,hits,landed};
}
for(const [wall,height,expected] of [[Infinity,0,1],[80,0,0],[Infinity,132,0]]){
 const fight=encounter('bow',190,wall,height);
 for(let i=0;i<75;i++)fight.advance();
 assert(fight.enemy.windup>0&&!fight.state.bolts.length,'draw before release');
 while(!fight.state.bolts.length)fight.advance();
 const arrow=fight.state.bolts[0],initialZ=arrow.z;
 fight.advance();
 assert(arrow.z>initialZ,'shaft rises after release');
 for(let i=0;i<190;i++)fight.advance();
 assert.equal(fight.hits.length,expected);
 if(height){assert.equal(fight.landed.length,1);assert(Math.abs(fight.landed[0].z)<1e-6);}
}
const melee=encounter('sabre',48);
for(let i=0;i<85;i++)melee.advance();
assert.equal(melee.hits.length,0,'windup and early slash give time to dodge');
for(let i=0;i<65;i++)melee.advance();
assert.deepEqual(melee.hits,[19],'one contact per swing');
console.log('Skeleton draw, arrow arc, floor and wall collisions, height-aware hits and sabre contact OK');
