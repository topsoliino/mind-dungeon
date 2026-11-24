/* Tests: wall-only attachments and height-aware dungeon architecture.
 * node beta/room-editor/tests/dungeon-architecture.test.cjs
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..'),win={};
vm.runInNewContext(fs.readFileSync(path.join(dir,'catalog.js'),'utf8'),{window:win});
const arch=require('../architecture.js'),placement=require('../placement.js');
const cat=win.MindRoomKit.catalog;
const room={width:8,height:7,walls:[
 {x:0,y:1,edge:'west',style:'stone'},
 {x:1,y:0,edge:'north',style:'stone'},
 {x:2,y:0,edge:'north',style:'bars-full'},
 {x:3,y:2,edge:'west',style:'stone'},
 {x:4,y:3,edge:'west',style:'open'}
],furniture:[]};
const wallTypes=[
 'wall-stone-pilaster','wall-freestanding-column','wall-wood-pillar',
 'wall-wood-ledge','wall-stone-cornice','wall-statue-knight',
 'wall-statue-gargoyle','wall-broken-masonry'
];
const floors=[
 'arch-stone-dais','arch-sunken-floor','arch-raised-walkway',
 'arch-wood-stage','arch-broken-stone-slab','arch-collapsed-floor'
];
assert.equal(wallTypes.length,8);
assert.equal(floors.length,6);
assert.equal(Object.keys(cat.furniture).length,43);
for(const type of wallTypes){
 const spec=cat.furniture[type];
 assert.equal(spec.category,'wall-architecture');
 assert.equal(spec.wallMounted,true);
 assert.equal(arch.attach(type,room,cat,5,5),null,'Cannot mount in empty room');
 assert.equal(arch.attach(type,room,cat,4,3.5),null,'No mount to non-solid wall');
 const wallObj=arch.attach(type,room,cat,1.5,.10);
 assert.ok(wallObj, 'Must attach to existing north wall');
 assert.equal(wallObj.wallRef,'h:1:0');
 assert.equal(wallObj.rot,0);
 assert.ok(arch.validMount(wallObj,room,cat));
 const rotatedObj=arch.attach(type,room,cat,.10,1.5);
 assert.ok(rotatedObj);
 assert.equal(rotatedObj.wallRef,'v:0:1');
 assert.equal(rotatedObj.rot,90);
 assert.ok(arch.validMount(rotatedObj,room,cat));
 const tampered={...wallObj,x:3.5,y:3.5};
 assert.equal(arch.validMount(tampered,room,cat),false);
 const afterDeletion={...room,walls:room.walls.filter(w=>w.x!==1||w.y!==0)};
 assert.equal(arch.refreshMount(wallObj,afterDeletion,cat),null,'Orphaned wall object must be removed on save');
}
for(const type of floors){
 const spec=cat.furniture[type];
 assert.equal(spec.category,'architectural-floor');
 assert.ok(spec.surface);
 assert.equal(spec.blocksMovement,false,'Platform floor can be walked upon');
 assert.ok(spec.footprint.w>.5&&spec.footprint.h>.5);
}
const makeFloor=(type,x=4,y=4)=>({id:type,type,x,y,rot:0,blocksMovement:false});
for(const type of ['arch-stone-dais','arch-raised-walkway','arch-wood-stage','arch-sunken-floor']){
 room.furniture=[makeFloor(type)];
 const h=cat.furniture[type].surface.elevation;
 const center=arch.surfaceAt(room,cat,4,4,placement);
 assert.equal(center.height,h);
 const start={x:4,y:4+cat.furniture[type].footprint.h/2+.2,z:0};
 const into={x:4,y:4+cat.furniture[type].footprint.h/2-.03};
 assert.equal(arch.transition(room,cat,placement,start,into).allowed,true,'Visible front steps allow access');
 const fromSide={x:4+cat.furniture[type].footprint.w/2+.06,y:4,z:0};
 const toSide={x:4+cat.furniture[type].footprint.w/2-.03,y:4};
 assert.equal(arch.transition(room,cat,placement,fromSide,toSide).allowed,false,'Sheer side must block walk');
}
room.furniture=[makeFloor('arch-broken-stone-slab')];
assert.equal(arch.transition(room,cat,placement,
 {x:4,y:5.0,z:0},{x:4,y:4.5}).allowed,true,'Broken slab is a ramp');
room.furniture=[makeFloor('arch-collapsed-floor')];
assert.equal(arch.surfaceAt(room,cat,4,4,placement).blocked,true,'No invisible floor over collapsed hole');
assert.equal(arch.surfaceAt(room,cat,4.6,4.5,placement).blocked,false);
const editor=fs.readFileSync(path.join(dir,'editor.js'),'utf8');
const kit=fs.readFileSync(path.join(dir,'blender/dungeon-architecture.py'),'utf8');
const pack=fs.readFileSync(path.join(dir,'blender/pack-room-kit.py'),'utf8');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
assert.match(html,/architecture\.js\?v=/);
assert.match(editor,/architecture\.attach/);
assert.match(editor,/architecture\.validMount/);
assert.match(editor,/architecture\.surfaceAt/);
assert.match(editor,/architecture\.transition/);
assert.match(editor,/wall-architecture-heading/);
assert.match(editor,/architectural-floor-heading/);
assert.match(kit,/ARCH_WALL_MODELS/);
assert.match(kit,/ARCH_FLOOR_MODELS/);
assert.match(pack,/architectureGeneratorSha256/);
for(const type of [...wallTypes,...floors]){
 assert.ok(kit.includes("'"+type+"'"),'Model absent '+type);
 assert.ok(pack.includes("'"+type+"'"),'Pack absent '+type);
}
console.log('Architecture OK: 8 strict wall ornaments, 6 walkable or dangerous floor constructions, 14 meshes.');
