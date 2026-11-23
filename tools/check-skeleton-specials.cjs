// Skeleton combat regression: real combat simulator and shared projectile physics.
const assert=require('node:assert/strict');
global.window={};
require('../beta/dungeon-enemies.js');
require('../beta/soul-vessels.js');
require('../beta/skeleton-combat.js');
require('../beta/dungeon-enemy-sim.js');
const rules=window.DungeonEnemies,noop=()=>{},no=()=>false;
function encounter(kit,distance,options={}){
 const actor={x:distance,y:0,hp:100,dash:0,inv:0,alleyFloor:0};
 const enemy={type:kit==='bow'?rules.ARCHER:rules.SKELETON,
  skeleton:kit,x:0,y:0,hp:100,max:100,angle:0,phase:0,
  windup:0,attack:0,hit:0,size:1,aggro:5};
 const state={bolts:[],waterArcs:[],enemyHazards:[],stormStrikes:[],
  webShots:[],webPatches:[],soulVessels:[]};
 const hits=[],poisons=[],sounds=[],actions=new Set();
 const wallX=options.wallX??Infinity;
 const floor={W:100,H:100,pressurePlates:[],regionAt:()=>0,inRest:no,
  outsideAt:no,valid:()=>true,furnitureAt:no,furnitureBetween:no,
  gateLineBlocked:no,furnitureBlocked:no,wall:no,gateBlocked:no,doorAt:no,
  layerAt:()=>0};
 const sim=window.DungeonEnemySim.create({
  floor,enemyRules:rules,state,save:{floor:1},
  items:{foes:[],foeAttack:[]},balance:{counterSeconds:.3},
  alleyEnemyPursuit:options.storey==null?null:{update:()=>false,heroFloor:()=>options.storey},
  actorRadius:()=>12,nearActor:no,enemyEncounterReady:()=>true,
  coopActors:()=>[actor],getEnemies:()=>[enemy],
  takeDamage:(hero,amount)=>{hits.push(amount);return false;},
  applyPoison:(hero,opts)=>{poisons.push(opts);hero.poison={};},
  maxHP:()=>100,rand:()=>options.random??.95,
  soundWorld:name=>{sounds.push(name);return true;},landArrow:noop,
  arrowGroundClear:(x,y,storey)=>x<wallX&&(options.storey==null||storey===options.storey),arrowTargetHeight:()=>options.height??0,
  moveActor:(e,dx,dy)=>{e.x+=dx;e.y+=dy;}
 });
 let time=0;
 const advance=(dt=1/120)=>{
  sim.moveFrom(dt,actor,time,1280,720);
  sim.act(enemy,dt,actor,time,1280,720);
  if(enemy.skeletonAction)actions.add(enemy.skeletonAction.name);
  time+=dt;
 };
 return {actor,enemy,state,hits,poisons,sounds,actions,advance};
}
{
 const bow=encounter('bow',190);
 for(let i=0;i<850;i++)bow.advance();
 assert(bow.sounds.filter(s=>s==='bow_release').length>=4,
  'archer must fire repeatedly, including double arrows');
 assert(bow.actions.has('shoot')&&bow.actions.has('double-shoot'),
  'single and double arrow clips must be triggered');
 assert(bow.enemy.x<0,'archer should retreat while shooting');
 assert(bow.hits.length>=1,'arrows must still be able to hit the hero');
}
{
 window.RockyCoastPrison={enabled:true};
 const upstairs=encounter('bow',190,{storey:2});
 upstairs.enemy.alleyFloor=upstairs.actor.alleyFloor=2;
 for(let i=0;i<850;i++)upstairs.advance();
 assert(upstairs.hits.length>0,'an archer on storey three must be able to hit a hero on that storey');
 delete window.RockyCoastPrison;
}
{
 const sword=encounter('sabre',48);
 let six=false;
 for(let i=0;i<320;i++){
  sword.advance();
  if(sword.enemy.skeletonAction?.name==='combo'&&
     sword.enemy.skeletonAction.hits===6)six=true;
 }
 assert(sword.actions.has('combo')&&six,'sabre combo has six timed impacts');
 assert(sword.actions.has('slash'),'follow-up sabre slash must be available');
}
{
 const melee=encounter('sabre',65);
 for(let i=0;i<1000;i++)melee.advance();
 assert.deepEqual([...melee.actions].sort(),['combo','overhead','slash']);

}
{
 const floor={wall:x=>x>110,gateBlocked:no,doorAt:no,inRest:no,
  furnitureBlocked:no};
 const state={soulVessels:[]},victim={x:67,y:0,hp:100,dash:0,alleyFloor:0};
 const poison=[];
 const gas=window.SoulVessels.create({state,floor,heroes:()=>[victim],
  poison:(actor,opts)=>{poison.push(opts);actor.poison=true;},
  origin:()=>({source:'skeletal ghost vessel'}),random:()=>.2,
  heroFloor:a=>a.alleyFloor});
 gas.throwVessel({x:0,y:0,alleyFloor:0},0);
 assert.equal(state.soulVessels.length,1);
 for(let i=0;i<260;i++)gas.update(1/60);
 const vessel=state.soulVessels[0];
 assert(vessel?.landed,'stone must land with gravity and wall collisions');
 assert(vessel.emission>0&&vessel.emission<10,'fog emits for a finite ten-second interval');
 assert(vessel.cells.some(v=>v>.11),'cloud diffuses into a real density field');
 for(let y=0;y<15;y++)for(let x=0;x<15;x++){
  if(vessel.x+(x-7)*18>110)
   assert((vessel.cells[y*15+x]??0)<.02,'gas must not cross solid walls');
 }
 victim.x=vessel.x;victim.y=vessel.y;victim.poison=null;
 gas.update(1/60);
 assert(poison.length>0,'standing in gas applies poison');
 for(let i=0;i<700;i++)gas.update(1/60);
 assert(state.soulVessels.every(v=>v.emission===0),
  'stone stops emitting after ten seconds');
}
console.log('Skeleton special combat, 6-hit combo, double arrows, stone physics, wall-aware poison mist OK');
