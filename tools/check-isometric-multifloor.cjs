// 4148 multi-floor regression: walk the full visible OG, path around stairs,
// never hit through floors, pursue last-seen portal, search, and return to post.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),noop=()=>{},read=p=>fs.readFileSync(path.join(__dirname,'../beta',p),'utf8');
const files=['alley-study-map.js','alley-generator.js','alley-stair-geometry.js',
 'alley-stair-navigation.js','alley-stair-controller.js','alley-vertical.js',
 'alley-enemy-pursuit.js','alley-route.js','alley-architecture.js',
 'alley-study.js','dungeon-isometric.js'];
const context=()=>new Proxy({createLinearGradient:()=>({addColorStop:noop}),
 createRadialGradient:()=>({addColorStop:noop}),measureText:()=>({width:8})},
 {get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
const document={currentScript:{src:'https://example.org/beta/alley-architecture.js'},
 createElement:()=>({width:0,height:0,getContext:context})};
class Image{set src(value){this._src=value;}}
function scene(seed){
 const w={location:{search:'?szene=gasse&modus=generator&seed='+seed},
  DungeonWorld:{TILE:48,HERO_RADIUS:14}};
 const scope=vm.createContext({window:w,document,Image,URL,URLSearchParams});
 for(const file of files)vm.runInContext(read(file),scope,{filename:file});
 return {w,v:w.AlleyVertical,alley:w.DungeonIsometric.create()};
}
const t=scene(4148),{v,alley,w}=t,cellKey=(u,v)=>u+','+v;
assert.equal(v.plan.kind,'switchback','seed 4148 is the open U stair');
assert(v.upper.size>150,'entire painted upper slab must exist');
v.state.floor=1;v.state.z=v.height;
const start={x:v.plan.top.x*48,y:v.plan.top.y*48};
let onSlab=0,pathable=0,outer=0;
for(const key of v.upper){
 const [u,p]=key.split(',').map(Number),x=(u+.5)*48,y=(p+.5)*48;
 if(!v.insideTop(u+.5,p+.5,14/48))continue;
 onSlab++;
 assert(alley.walkableOnFloor(x,y,1,14),
  'drawn upper slab must NOT be blocked by an invisible lower stair at '+key);
 const route=alley.routeToFloor(start,{x,y},1);
 assert(route,'rendered OG floor tile must be connected from U landing: '+key);
 assert(route.steps.length,'OG route needs reachable waypoints');
 pathable++;
 if(u>=v.plan.region[2]||p<v.plan.region[1])outer++;
}
assert(onSlab>=130&&pathable===onSlab);
assert(outer>=8,'test U stair room beyond its original stair bounding rectangle');
assert(!alley.walkableOnFloor(v.plan.bottom.x*48,v.plan.bottom.y*48,1,14),
 'invisible floor below a shaft must not be walkable upstairs');
assert(alley.routeToFloor({x:w.AlleyGenerator.rooms[1].cells[0][0]*48,
 y:w.AlleyGenerator.rooms[1].cells[0][1]*48},start,0)===null ||
 !alley.walkableOnFloor(start.x,start.y,0,14),
 'ground routes must not silently become upper-floor routes');
console.log('4148 U staircase: '+pathable+' OG floor centres route across the real slab, including '+outer+' beyond stair footprint');

const pursuer=w.AlleyEnemyPursuit.create(v,alley),dt=1/60;
const bottom={x:v.plan.bottom.x*48,y:v.plan.bottom.y*48},
 top={x:v.plan.top.x*48,y:v.plan.top.y*48};
const guard={...bottom,hp:100,skeleton:'sabre',type:3,
 moving:false,attack:0,phase:0,angle:0,hit:0};
const hero={...bottom,hp:100,dash:0,inv:0};
const move=(e,dx,dy)=>{
 const n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/4));
 for(let i=0;i<n;i++)for(const [xx,yy] of [[dx/n,0],[0,dy/n]]){
  if(alley.walkableOnFloor(e.x+xx,e.y+yy,e.alleyFloor??0,14)){
   e.x+=xx;e.y+=yy;
  }
 }
};
v.state.floor=0;
assert.equal(pursuer.update(guard,hero,dt,0,move),false,
 'guard on the same floor must see hero and use real combat AI');
assert.equal(guard.alleyMode,'chase');
hero.x=top.x;hero.y=top.y;v.state.floor=1;v.state.z=v.height;
assert.equal(pursuer.update(guard,hero,dt,dt,move),true,
 'a guard on EG must not attack a hero on the OG slab');
assert.equal(guard.alleyLastSeen.floor,1,
 'guard remembers the upper exit after watching the stair entrance');
let climbed=false,clock=dt;
for(let i=0;i<900;i++){
 clock+=dt;pursuer.update(guard,hero,dt,clock,move);
 if(guard.alleyFloor===1){climbed=true;break;}
}
assert(climbed,'guard must reach OG using a real staircase/ladder');
assert.equal(guard.alleyZ,v.height);
assert.equal(pursuer.update(guard,hero,dt,clock+dt,move),false,
 'after climbing the guard can reacquire an exposed OG target');
hero.x=100000;hero.y=100000;
let searched=false,returned=false;
for(let i=0;i<1800;i++){
 clock+=dt;pursuer.update(guard,hero,dt,clock,move);
 if(guard.alleyMode==='search')searched=true;
 if(guard.alleyMode==='guard'&&guard.alleyFloor===0){returned=true;break;}
}
assert(searched,'investigate last SEEN position rather than omniscient tracking');
assert(returned,'after failing to find the hero, return downstairs to the original post');
assert(Math.hypot(guard.x-bottom.x,guard.y-bottom.y)<26);
console.log('Guard: same-floor LOS, cross-floor damage blocking, real portal climb, reacquisition, last-seen search and return home OK');

// Verify the ACTUAL enemy simulator no longer lets a sabre slash or projectile
// hit through the slab, even when the two actors have identical planar XY.
vm.runInNewContext(read('dungeon-enemies.js'),{window:w});
vm.runInNewContext(read('dungeon-enemy-sim.js'),{window:w});
const rules=w.DungeonEnemies,damages=[],crossHero={...bottom,hp:100,inv:0,dash:0};
const enemy={...bottom,type:rules.SKELETON,skeleton:'sabre',hp:100,max:100,
 angle:0,phase:0,attack:0,hit:0,aggro:7,windup:0,recover:0,runAttack:0,
 emerge:0,alleyFloor:0};
const floor={W:80,H:80,regionAt:()=>0,inRest:()=>false,
 outsideAt:()=>false,layerAt:()=>0,valid:()=>true,
 furnitureAt:()=>null,furnitureBetween:()=>null,gateLineBlocked:()=>false,
 furnitureBlocked:()=>false,wall:()=>false,gateBlocked:()=>false,
 pressurePlates:[],doorAt:()=>null};
const sim=w.DungeonEnemySim.create({
 floor,enemyRules:rules,alleyEnemyPursuit:pursuer,
 state:{bolts:[{...bottom,z:40,angle:0,speed:0,life:2,type:'bow',
   alleyFloor:0}],waterArcs:[],enemyHazards:[],stormStrikes:[],
   webShots:[],webPatches:[]},
 save:{floor:1},items:{foes:[],foeAttack:[]},balance:{counterSeconds:.3},
 actorRadius:()=>12,nearActor:()=>true,enemyEncounterReady:()=>true,
 coopActors:()=>[crossHero],getEnemies:()=>[enemy],
 takeDamage:(_hero,amount)=>{damages.push(amount);return true;},
 addBleed:noop,maxHP:()=>100,rand:()=>1,soundWorld:noop,
 landArrow:noop,arrowGroundClear:()=>true,
 arrowTargetHeight:()=>v.state.z,moveActor:move
});
v.state.floor=1;v.state.z=v.height;
let combatTime=0;
for(let i=0;i<120;i++){
 sim.moveFrom(dt,crossHero,combatTime,1280,720);
 sim.act(enemy,dt,crossHero,combatTime,1280,720);
 combatTime+=dt;
}
assert.deepEqual(damages,[],'EG attacks and arrows cannot hit an OG hero at the exact same XY');
v.state.floor=0;v.state.z=0;
for(let i=0;i<200;i++){
 sim.moveFrom(dt,crossHero,combatTime,1280,720);
 sim.act(enemy,dt,crossHero,combatTime,1280,720);
 combatTime+=dt;
}
assert(damages.includes(19),'ordinary same-floor sabre attacks must still work');
console.log('Actual enemy sim: EG sword and bow shots blocked by OG, normal same-floor combat intact');

const html=read('index.html');
assert(html.includes('const alleyEnemyPursuit=generationMode&&alleyVertical?'));
assert(html.includes('!next&&!player.attack&&!player.dash'),
 'click-to-move must not spontaneously board a flight');
assert(html.includes('const floor=hero?(alleyVertical?.state.floor??0):(actor.alleyFloor??0)'));
assert(html.includes('if(!enemySameFloor(e))continue'));
assert(html.includes('(e.alleyFloor??0)===(shot.alleyFloor??0)'));
console.log('Integrated gameplay: per-actor collision, right-click bypass and equal-floor damage guards OK');
