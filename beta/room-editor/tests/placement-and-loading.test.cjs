/** Room Atelier regression for wall-flush snapping and demand-loaded assets.
 * Run: node beta/room-editor/tests/placement-and-loading.test.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const placement=require('../placement.js');
const win={};
vm.runInNewContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),
 {window:win},{filename:'catalog.js'});
const cat=win.MindRoomKit.catalog;
const eps=placement.epsilon;
const room={width:7,height:5,walls:[
 {x:0,y:0,edge:'north',style:'stone'},
 {x:0,y:0,edge:'west',style:'stone'},
 {x:3,y:2,edge:'west',style:'stone'}
],furniture:[]};
const item=(type,x,y,rot=0)=>({type,x,y,rot,blocksMovement:cat.furniture[type].blocksMovement});
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,String(a)+' != '+String(b));
const legal=o=>!placement.crossesWall(o,room,cat)&&
 placement.bounds(o,cat).left>=eps-1e-6&&
 placement.bounds(o,cat).top>=eps-1e-6&&
 placement.bounds(o,cat).right<=room.width-eps+1e-6&&
 placement.bounds(o,cat).bottom<=room.height-eps+1e-6;

// Quarter-metre grid coordinate must not dictate wall clearance.
const west=placement.snap(item('dungeon-bookshelf',.50,1.5),room,cat);
approx(placement.bounds(west,cat).left,eps);
assert.ok(legal(west));
const north=placement.snap(item('floor-puddles',1.5,.5),room,cat);
approx(placement.bounds(north,cat).top,eps);
assert.ok(legal(north));
const east=placement.snap(item('prison-chair',6.50,3.2),room,cat);
approx(placement.bounds(east,cat).right,7-eps);
const south=placement.snap(item('floor-wood',2,4.75),room,cat);
approx(placement.bounds(south,cat).bottom,5-eps);
assert.ok(legal(south));

// Internal wall: can sit on either face without penetrating its plane.
const left=placement.snap(item('dungeon-torture-bench',2.5,2.5),room,cat);
approx(placement.bounds(left,cat).right,3-eps);
const right=placement.snap(item('dungeon-torture-bench',3.5,2.5),room,cat);
approx(placement.bounds(right,cat).left,3+eps);
assert.ok(legal(left)&&legal(right));

// A 90/270 rotation swaps oriented dimensions at wall contact.
for(const rot of [90,270]){
 const o=placement.snap(item('dungeon-bookshelf',.50,.9,rot),room,cat);
 approx(placement.bounds(o,cat).left,eps);
 assert.ok(legal(o));
}
// A nonblocking puddle remains walkable but cannot overlap a solid wall.
assert.equal(cat.furniture['floor-puddles'].blocksMovement,false);
assert.equal(placement.crossesWall(item('floor-puddles',3,2.5),room,cat),true);
// Dragging a valid prop across a wall in one movement event must not teleport
// it through the internal wall, even if the pointer goes far beyond its face.
const prior=item('floor-rug',2.5,2.5);
const moved=placement.snap({...prior,x:3.8},room,cat,prior);
assert.ok(placement.bounds(moved,cat).right<=3-eps+1e-6);
assert.ok(legal(moved));

// Preserve asset availability but request only when truly needed.
const editor=fs.readFileSync(path.join(root,'editor.js'),'utf8');
const art=fs.readFileSync(path.join(root,'editor-art.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/placement\.js\?v=/);
assert.match(editor,/function requestSprite\(type,rot\)/);
assert.match(editor,/const sprite=requestSprite\(obj\.type,obj\.rot\)/);
assert.doesNotMatch(editor,/for\(const type of Object\.keys\(cat\.furniture\)\)for\(const rot/);
assert.match(editor,/new IntersectionObserver\(/);
assert.match(editor,/wireSwatchPreview\(b,entry\)/);
assert.match(editor,/placement\.snap\(/);
assert.match(art,/function ensureMaterial\(style\)/);
assert.match(art,/function guardianPage\(sheet,index\)/);
assert.match(art,/for\(const style of materialDemand\)ensureMaterial\(style\)/);
assert.doesNotMatch(art,/guardianAtlas\.sheets\.body\.map\(load\)/);
// At module initialisation, the material and Guardian code should only
// request JSON metadata. Image downloads start when drawing a room.
const imageStarts=[];
class StubImage{set src(x){imageStarts.push(x)}}
const fakeFetch=async()=>{throw Error('test offline')};
const mockWindow={MindRoomKit:win.MindRoomKit};
vm.runInNewContext(art,{
 window:mockWindow,Image:StubImage,fetch:fakeFetch,console
},{filename:'editor-art.js'});
assert.equal(imageStarts.length,0,'Zero image downloads at module initialization');
mockWindow.MindRoomArt.status();
assert.equal(imageStarts.length,0,'Status must not initiate 17 image loads');
console.log('Room Atelier wall flush and lazy asset loading checks passed.');
