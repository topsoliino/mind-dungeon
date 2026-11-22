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
const region=(level,entry='from-lower')=>{
 const q='?szene=gasse&modus=generator&region=rocky-coast&level='+level+'&entry='+entry;
 const window={location:{href:'https://example.org/mind-dungeon/beta/index.html'+q,
  search:q,assign(url){this.href=url;}}};
 for(const source of [map,prisonSource,generatorSource])
  vm.runInNewContext(source,{window,URL,URLSearchParams,console});
 return window;
};
const seeds=new Set();
for(let level=1;level<=4;level++){
 const root=region(level),g=root.AlleyGenerator,d=root.RockyCoastPrison;
 assert(g.enabled,'Dungeon interior greybox missing at level '+level);
 assert.equal(d.level,level);
 assert.equal(g.rooms.length,10,'Ten connected rooms on level '+level);
 assert.equal(g.portals.length,2,'A real inward and outward building doorway');
 assert(g.stairs.length>0,'Generator stairs retained');
 const upper=g.portals[1],up=d.link({x:upper.x*48,y:upper.y*48},g);
 assert.equal(up.target,level+1,'Door to next dungeon level missing');
 assert.equal(up.entry,'from-lower');
 const lower=g.portals[0],down=d.link({x:lower.x*48,y:lower.y*48},g);
 assert.equal(down?.target,level>1?level-1:undefined);
 const next=d.href(level+1);
 assert(next.includes('level='+(level+1))&&next.includes('rocky-coast'));
 seeds.add(g.seed);
}
assert.equal(seeds.size,4,'Each indoor level must generate a separate stable layout');
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
for(const name of ['rocky-coast-prison.js?v=1','rocky-coast-terrain.js?v=4',
 'rockyPrison?.link(player,window.AlleyGenerator)','rockyTerrain.slide(player',
 'triggerRockyDeath','rockyTerrain.mountDebug']){
 assert(game.includes(name),'Rocky Coast game integration missing: '+name);
}
console.log('Rocky Coast: 4x10 connected interior rooms, 5-way dungeon traversal, exterior heightfield, normalmap, river/sea death, slope/cliff slip, border collision, camera culling and game integration: OK');
