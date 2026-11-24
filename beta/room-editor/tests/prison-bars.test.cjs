/** Regression coverage for full-/half-height metal cell walls.
 * Run: node beta/room-editor/tests/prison-bars.test.cjs
 * Only imports editor-local source: no game generator or Blender dependency.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),
 {window},{filename:'catalog.js'});
const cat=window.MindRoomKit.catalog;
const editor=fs.readFileSync(path.join(root,'editor.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'editor.css'),'utf8');
const placement=require('../placement.js');

// Existing saved bar styles remain usable; new height is relative to
// the regular 2-metre stone-wall catalogue height, not a hard-coded pixel.
assert.equal(cat.walls['bars-full'].height,cat.walls.stone.height);
assert.equal(cat.walls['bars-half'].height,cat.walls.stone.height/2);
for(const name of ['bars','bars-full','bars-half','gate'])
 assert.equal(cat.walls[name].solid,true,name+' must block movement');
assert.equal(cat.walls.gate.render,'metal-bars');
for(const name of ['bars','bars-full','bars-half']){
 assert.equal(cat.walls[name].render,'blender-bars');
 assert.match(cat.walls[name].asset,/assets\/walls\/prison-grille-(full|half)-front\.png/);
 assert.ok(cat.walls[name].cameraOrthoScale>1);
}
assert.match(editor,/\['photo-wall-map','metal-bars','blender-bars'\]/);
assert.match(editor,/button.classList.add\('prison-bar-swatch'\)/);
assert.match(css,/\.prison-bar-swatch\.half-height/);
assert.match(html,/Gefängnisgitter/);

function extract(name,next){
 const a=editor.indexOf('function '+name+'('),b=editor.indexOf('function '+next+'(',a);
 assert.ok(a>=0&&b>a,'Cannot find editor function '+name);
 return editor.slice(a,b);
}
const wallEnds=w=>w.edge==='north'?[[w.x,w.y],[w.x+1,w.y]]:
 [[w.x,w.y],[w.x,w.y+1]];
const pt=(x,y,z=0)=>({x,y,z});
function renderWall(style,edge='north'){
 const strokes=[],fills=[];
 const ctx={beginPath(){},arc(){},fill(){},fillStyle:''};
 const draw=new Function('cat','isNearWall','wallEnds','pt','line',
   'polygon','ctx','hover','keyWall','TAU','window','zoom','drawBlenderBars',
   extract('drawWall','oriented')+'return drawWall')(
   cat,()=>false,wallEnds,pt,(points,color,width)=>strokes.push({points,color,width}),
   (points,fill)=>fills.push({points,fill}),ctx,null,()=>'',Math.PI*2,{},1,()=>false);
 draw({x:1,y:2,edge,style});
 return {strokes,fills};
}
for(const edge of ['north','west']){
 const tall=renderWall('bars-full',edge),half=renderWall('bars-half',edge);
 // The top rail uses exactly the requested world height.
 const top=out=>out.strokes.find(s=>s.width===6.2)?.points[0].z;
 assert.equal(top(tall),2);
 assert.equal(top(half),1);
 // Full-height rail has two wrought crossbars, half-height only one.
 const cross=out=>out.strokes.filter(s=>s.width===5).length;
 assert.equal(cross(tall),2);
 assert.equal(cross(half),1);
 assert.ok(tall.strokes.length>20&&half.strokes.length>20);
}
assert.ok(renderWall('gate').fills.length>0,'Old gate lock must remain visible');

// Both heights are solid barriers in the Guardian playtest and for
// furniture placement; old .json segments are still preserved.
const room={width:5,height:5,walls:[
 {x:2,y:1,edge:'west',style:'bars-full'},
 {x:2,y:2,edge:'west',style:'bars-half'}
],furniture:[]};
const canOccupy=new Function('room','cat','isNearWall','wallEnds','bounds',
 'playing','playHP',extract('canOccupy','playStep')+'return canOccupy')(
 room,cat,()=>false,wallEnds,obj=>placement.bounds(obj,cat),false,new Map());
assert.equal(canOccupy(2,1.5),false);
assert.equal(canOccupy(2,2.5),false);
assert.equal(canOccupy(3,2.5),true);
assert.equal(placement.crossesWall({
 type:'prison-chair',x:2,y:2.5,rot:0},room,cat),true);
assert.equal(placement.crossesWall({
 type:'floor-rug',x:2,y:2.5,rot:0},room,cat),true);

const isWall=w=>Number.isInteger(w.x)&&Number.isInteger(w.y)&&
 ['north','south','east','west'].includes(w.edge)&&Boolean(cat.walls[w.style]);
const keyWall=w=>(w.edge==='north'||w.edge==='south'?'h:':'v:')+w.x+':'+w.y;
const sanitize=new Function('cat','isWall','keyWall','quant','precise',
 extract('sanitize','saveLocal')+'return sanitize')(
 cat,isWall,keyWall,v=>Math.round(v*4)/4,v=>Math.round(v*1000)/1000);
const original={width:5,height:5,wallStyle:'bars-half',floorStyle:'dungeon-ashlar',
 walls:room.walls};
const serialized=sanitize(original);
assert.equal(serialized.wallStyle,'bars-half');
assert.deepEqual(serialized.walls.map(w=>w.style),['bars-full','bars-half']);
assert.deepEqual(sanitize({...original,wallStyle:'bars',walls:[
 {x:1,y:1,edge:'north',style:'bars'}]}).walls.map(w=>w.style),['bars']);
const modeled=fs.readFileSync(path.join(root,'blender/dungeon-prison-bars.py'),'utf8');
const builder=fs.readFileSync(path.join(root,'blender/build-room-kit.py'),'utf8');
const packer=fs.readFileSync(path.join(root,'blender/pack-room-kit.py'),'utf8');
assert.match(modeled,/PB_WALL_MODELS/);
assert.match(modeled,/material\('Prison grille \| charcoal-black forged iron'/);
assert.match(modeled,/_pb_rivet_head/);
assert.match(builder,/dungeon-prison-bars\.py/);
assert.match(builder,/RENDERED PHYSICAL IRON GRILLE/);
assert.match(packer,/wall_views=/);
assert.match(packer,/wall_dir=ASSETS\/'walls'/);
assert.match(editor,/function drawBlenderBars\(/);
assert.match(editor,/ctx\.transform\(top1\.x-top0\.x/);
assert.match(editor,/if\(type\.render==='blender-bars'&&drawBlenderBars/);
const manifestPath=path.join(root,'assets/manifest.json');
if(fs.existsSync(manifestPath)){
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(manifest.wallViews){
  assert.equal(manifest.wallViews['bars-full'].height,2);
  assert.equal(manifest.wallViews['bars-half'].height,1);
 }
}
console.log('Full/half-height prison bars: rendering, palette, collision and JSON compatibility OK');
