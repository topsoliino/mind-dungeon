// Real in-browser-module construction test for the four Rocky Coast stages.
// Unlike the portal-only regression, this builds each stair/ladder navmesh
// and verifies that its real physical upper landing triggers level progression.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync('beta/'+name,'utf8');
const noop=()=>{};
const context=()=>new Proxy({createLinearGradient:()=>({addColorStop:noop}),
 createRadialGradient:()=>({addColorStop:noop}),measureText:()=>({width:8})},
 {get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
const document={currentScript:{src:'https://example.org/beta/alley-architecture.js'},
 createElement:()=>({width:0,height:0,getContext:context})};
class Image{set src(value){this._src=value;}}
const files=['alley-study-map.js','rocky-coast-prison.js','alley-generator.js',
 'alley-stair-geometry.js','alley-stair-navigation.js','alley-stair-controller.js',
 'alley-vertical.js','alley-route.js','alley-architecture.js','alley-study.js',
 'dungeon-isometric.js'];
function setup(level,storey=1,entry='from-lower'){
 const query='?szene=gasse&modus=generator&region=rocky-coast&level='+level+
  '&storey='+storey+'&entry='+entry;
 const w={location:{search:query,href:'https://example.org/beta/index.html'+query,
  assign(url){this.href=url;}},DungeonWorld:{TILE:48,HERO_RADIUS:14}};
 const scope=vm.createContext({window:w,document,Image,URL,URLSearchParams,console});
 for(const file of files)vm.runInContext(read(file),scope,{filename:file});
 return {w,level,scene:w.DungeonIsometric.create(),vertical:w.AlleyVertical};
}
for(let level=1;level<=4;level++){
 const count=setup(level).w.RockyCoastPrison.count;
 for(let storey=1;storey<=count;storey++){
  const {w,scene,vertical}=setup(level,storey);
  assert(scene.walkable(scene.spawn.x,scene.spawn.y,14),
   'Hero spawn in L'+level+' must be reachable without walls');
  if(level===4&&storey===count){
   assert.equal(vertical.connectors.length,0,'L4 cannot lead up by stairs');
   const exit=w.AlleyGenerator.outdoorExit;
   assert(exit,'Last indoor stage needs exactly one exit');
   const p={x:exit.x*48,y:exit.y*48};
   assert.equal(w.RockyCoastPrison.link(p,w.AlleyGenerator).target,5);
   console.log('Rocky Coast 4: only exterior exit; physical spawn accessible');
   continue;
  }
  assert(vertical.enabled,'Real 3D stair rig missing on L'+level);
  assert(vertical.plan.steps.length>=4,'Stair steps must exist');
  assert(vertical.plan.ladder,'Secondary ladder must still be valid');
  const bottom=vertical.connectors.find(x=>x.kind==='stairs').bottom;
  const top=vertical.connectors.find(x=>x.kind==='stairs').top;
  assert(scene.walkableOnFloor(bottom.x*48,bottom.y*48,0,0,false)||
   Boolean(vertical.navigation.contains(bottom)),
   'Stair foot must be part of valid physical navigation');
  const climber={x:bottom.x*48,y:bottom.y*48};
  assert(vertical.boardStairs(climber,true,top));
  for(let tick=0;tick<1800&&vertical.state.stairRide;tick++)
   vertical.advanceStairs(climber,1/60,178,0,0,{running:true});
  assert.equal(vertical.state.floor,1,'Hero completed climb');
  assert(!vertical.state.stairRide);

  assert(scene.walkableOnFloor(top.x*48,top.y*48,1,0,false),
   'Stair head must land on real upper floor');
  const act={x:top.x*48,y:top.y*48};
  const progress=w.RockyCoastPrison.link(act,w.AlleyGenerator);
  assert.equal(progress?.target,storey===count?level+1:undefined,'Physical 3D stair head must progress dungeon');
  assert.equal(progress?.kind,storey===count?'stairs':undefined);
  if(storey<count){
   assert(vertical.connectors.length>=1&&vertical.connectors.length<=4);
   const flight=vertical.connectors,location=w.location.href;
   assert(w.RockyCoastPrison.changeStorey(1));
   vertical.state.floor=0;vertical.state.z=0;
   assert(scene.groundWalkable(climber.x,climber.y,14,false),'Walk off the upper landing');
   assert.equal(w.location.href,location);
   assert(w.RockyCoastPrison.changeStorey(-1));
   assert.equal(vertical.connectors,flight);
   vertical.state.floor=1;vertical.state.z=vertical.height;
   assert(vertical.boardStairs(climber,false,bottom));
   for(let i=0;i<1800&&vertical.state.stairRide;i++)
    vertical.advanceStairs(climber,1/60,178,0,0,{running:true});
   assert.equal(vertical.state.floor,0);
  }
  console.log('Rocky Coast '+level+': climbable '+vertical.plan.kind+
   ' staircase / deck / ladder, storey '+storey+' / '+count);
 }
}
console.log('Four-stage real stair geometry and solid indoor spawns: OK');
