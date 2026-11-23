// Deterministic end-to-end contract for Rocky Coast Prison greybox and terrain.
// Run from repository root: node tools/check-rocky-coast.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const script=p=>fs.readFileSync('beta/'+p,'utf8');
const map=script('alley-study-map.js');
const prisonSource=script('rocky-coast-prison.js');
const generatorSource=script('alley-generator.js');
const terrainSource=script('rocky-coast-terrain.js');
const game=script('index.html');
const region=(level,storey=1,entry='from-lower')=>{
 const q='?szene=gasse&modus=generator&region=rocky-coast&level='+level+'&storey='+storey+'&entry='+entry;
 const window={location:{href:'https://example.org/mind-dungeon/beta/index.html'+q,
  search:q,assign(url){this.href=url;}}};
 for(const source of [map,prisonSource,generatorSource])
  vm.runInNewContext(source,{window,URL,URLSearchParams,console});
 return window;
};
const seeds=new Set();
for(let level=1;level<=4;level++){
 const count=region(level).RockyCoastPrison.count;
 assert(count>=2&&count<=4);
 for(let storey=1;storey<=count;storey++){
  const root=region(level,storey),g=root.AlleyGenerator,d=root.RockyCoastPrison;
  assert(g.enabled,'Dungeon interior greybox missing at level '+level);
  assert.equal(d.level,level);
  assert.equal(g.rooms.filter(r=>r.kind==='raum').length,15,'Fifteen chambers on level '+level);
  const entrances=level===1?1:0,exits=level===4?1:0;
  assert.equal(g.portals.length,entrances+exits,
   'Only L1 may have an exterior entrance, only L4 may have an exit');
  assert.equal(Boolean(g.outdoorEntrance),Boolean(entrances));
  assert.equal(Boolean(g.outdoorExit),Boolean(exits));
  assert.equal(d.hasEntrance,Boolean(entrances));
  assert.equal(d.hasExit,Boolean(exits));
  assert.equal(g.stairs.length,1,
   'Only L1-L3 have an upward physical stair');
  if(!entrances){
   assert.equal(g.doors.length,g.rooms.length-2,'Later levels have no starter alley doorway');
   assert(g.blocked(12,4.5,.20)&&g.blocked(12,5.5,.20),
    'Previous street entrance must be a SOLID collision wall');
  }else{
   assert.equal(g.doors.length,g.rooms.length-1);
   assert.equal(d.link({x:g.outdoorEntrance.x*48,y:g.outdoorEntrance.y*48},g),null,
    'L1 entrance must not act as an exit or skip floors');
  }
  if(exits&&storey===count){
   const exit=g.outdoorExit,near={x:exit.x*48,y:exit.y*48};
   assert.equal(d.link(near,g)?.target,5,'Only L4 has a door to exterior L5');
   assert.equal(d.link(near,g)?.kind,'exit');
  }else{
   const stair=g.stairs[0];
   const top={x:stair.area[0]+.8,y:stair.area[1]+.8};
   root.AlleyVertical={enabled:true,state:{floor:0,stairRide:null,
    transition:null,pending:null},
    connectors:[{kind:'stairs',top}]};
   const hero={x:top.x*48,y:top.y*48};
   assert.equal(d.link(hero,g),null,
    'Dungeon floor must never skip via the staircase until reached upstairs');
   root.AlleyVertical.state.floor=1;
   const next=d.link(hero,g);
   assert.equal(next?.target,storey===count?level+1:undefined,'Completed real staircase leads to next level');
   assert.equal(next?.kind,storey===count?'stairs':undefined);
   if(storey===count)assert.equal(next?.entry,'from-lower');
   else assert.equal(next,null);
   root.AlleyVertical.state.stairRide={};
   assert.equal(d.link(hero,g),null,'Cannot skip dungeon floor mid-climb');
   root.AlleyVertical.state.stairRide=null;
   root.AlleyVertical.state.pending={};
   assert.equal(d.link(hero,g),null,'Cannot skip dungeon floor while interaction pending');
   assert(d.href(level+1).includes('level='+(level+1)));
  }
  if(storey===1&&(level===2||level===3))
   assert.equal(d.link({x:14.5*48,y:5.5*48},g),null,
    'Middle dungeon floors must have neither entrance nor exit');
  if(storey===1)seeds.add(g.seed);
 }
}
assert.equal(seeds.size,4,'Each indoor level generates a stable separate layout');
const outside=region(5),definition=outside.RockyCoastPrison;
assert(definition.isExterior&&!outside.AlleyGenerator.enabled);
assert.equal(definition.link({x:350,y:325},outside.AlleyGenerator).target,4);
assert.equal(definition.levels.length,5);
assert.equal(definition.levels[4].type,'exterior');
const draw={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
 putImageData(){},translate(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},
 closePath(){},fill(){},stroke(){},drawImage(){},fillRect(){},clearRect(){},
 arc(){},getTransform:()=>({a:1,d:1,e:0,f:0}),
 canvas:{width:1200,height:800}};
const document={createElement(){return{width:0,height:0,
 getContext:()=>draw,style:{},append(){}}},body:{append(){}}};
const holder={};
vm.runInNewContext(terrainSource,{window:holder,document,Uint8ClampedArray,console});
const m=holder.RockyCoastTerrain;
const project=(x,y,z=0)=>({x:(x-y)*.87,y:(x+y)*.47-z});
const unproject=(x,y,z=0)=>({x:(x/.87+(y+z)/.47)/2,y:((y+z)/.47-x/.87)/2});
const world=m.create({toView:project,toWorld:unproject,tile:48,radius:14});
assert.equal(world.level,5);
assert(world.normalMap.width>=40&&world.normalMap.height>=35);
assert(world.diagnostic.chunkCount>=40,'Chunked terrain must avoid one huge canvas');
assert(world.walkable(world.spawn.x,world.spawn.y),'Outdoor prison gate must be safe');
assert.equal(world.dangerAt(75,400),'ocean');
assert.equal(world.dangerAt(610,m.river(610)),'river');
assert.equal(world.borderAt(400,15),'prison-fence');
assert.equal(world.borderAt(550,1300),'dense-forest');
assert.equal(world.borderAt(1460,650),'cliff-wall');
assert.equal(world.borderAt(340,225),'prison-wall');
assert(!world.walkable(340,225),'Greybox prison must be solid');
const hill=world.surfaceAt(200,220),cliff=world.surfaceAt(210,220);
assert.equal(hill.zone,'slide','Must have walk-to-slide slopes');
assert.equal(cliff.zone,'cliff-slide','Must have cliffs with forced descent');
assert.equal(world.surfaceAt(world.spawn.x,world.spawn.y).zone,'walk');
const steepNormal=world.surfaceAt(720,300).normal;
assert(world.uphillBlocked({x:720,y:300},720+steepNormal.dx,300+steepNormal.dy),
 'The hero must not run straight uphill on slide-class terrain');
assert(!world.uphillBlocked({x:720,y:300},720-steepNormal.dx,300-steepNormal.dy),
 'Gravity-directed downhill movement must stay possible');
const across=world.routeTo({x:1070,y:680},{x:1070,y:1080});
assert(across&&across.steps.length,'A safe route must cross the river on the bridge');
assert(!world.routeTo(world.spawn,{x:610,y:m.river(610)}),'Pathfinding must reject deep water');
const player={x:720,y:300,dash:0,moving:false},startX=player.x;
let fall=null;
world.slide(player,.04,(dx,dy)=>{player.x+=dx;player.y+=dy},cause=>{fall=cause});
assert(player.rockySlide||fall,'Sliding requires a live physics state');
if(!fall)assert(player.x!==startX,'Downhill root motion must actually advance');
const water={x:500,y:m.river(500),dash:0};
world.slide(water,.04,()=>{},cause=>{fall=cause});
assert.equal(fall,'river','Entering river must trigger death zone callback');
const textures={addCanvas(){return{refresh(){}}}},layers=[];
const fakeScene={textures,add:{image(x,y,key){const image={x,y,visible:true,
 setOrigin(){return this},setDepth(v){this.depth=v;return this},
 setVisible(v){this.visible=v;return this}};layers.push(image);return image}}};
const arts=world.addLayers(fakeScene);
assert.equal(arts.length,world.diagnostic.chunkCount+4,
 'Prison, fence, forest and cliff must render as depth-sorted greybox layers');
world.refreshLayers(arts,world.spawn,false,{x:1e6,y:1e6,width:700,height:450,zoom:1});
assert(arts.every(sprite=>!sprite.visible),'Out-of-view terrain must be culled');
for(const name of ['rocky-coast-prison.js?v=','rocky-coast-terrain.js?v=4',
 'rockyPrison?.link(player,window.AlleyGenerator)','rockyTerrain.slide(player',
 'triggerRockyDeath','rockyTerrain.mountDebug']){
 assert(game.includes(name),'Rocky Coast game integration missing: '+name);
}
console.log('Rocky Coast: sealed L2/L3 interiors, L1 entrance, L4 exterior-only exit, validated stair-to-next-level transitions, heightfield, normalmap and physics: OK');
