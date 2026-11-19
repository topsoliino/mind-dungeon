import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {run,geometry,TILE} from './rules.mjs';
import vm from 'node:vm';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../../beta/dungeon-vision.js',import.meta.url),'utf8'),context);
const vision=context.window.DungeonVision;
const center=(x,y)=>({x:(x+.5)*TILE,y:(y+.5)*TILE});
function looks(view,x,y){const p=center(x,y);return view.sees(p.x,p.y);}
function knows(view,x,y){const p=center(x,y);return view.remembers(p.x,p.y);}

function hallWithDoor(){
 const W=19,H=13,map=Array.from({length:H},()=>Array(W).fill(1)),regions=map.map(row=>row.map(()=>-1));
 function carve(left,top,right,bottom,id){
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
   map[y][x]=0;regions[y][x]=id;
  }
 }
 carve(2,3,6,7,1);
 carve(7,5,17,5,2);
 carve(11,6,11,10,2);
 const world={W,H,map,regions,stairs:[],rest:{id:1},rooms:[],isPassage:id=>id===2,abyssAt:()=>false,layerForRegion:()=>0};
 const door={...center(14,5),vertical:true,span:TILE,face:12,floorCells:[5*W+14],closed:true,visible(){return this.closed;}};
 const view=vision.create(world,TILE,[door],[],new Set([1]));
 return {world,door,view};
}

test('the start chamber reveals a long hall up to its door while bends and the far side stay hidden',()=>{
 const {world,door,view}=hallWithDoor();
 assert.ok(knows(view,13,5));
 assert.equal(knows(view,11,9),false);
 assert.equal(knows(view,16,5),false);
 view.update(center(4,5),1280,768);
 assert.ok(view.barrierVisible(door));
 assert.ok(looks(view,13,5));
 assert.equal(looks(view,15,5),false);
 view.update(center(11,6),1280,768);
 assert.ok(looks(view,11,9));
 assert.ok(knows(view,13,5));
 door.closed=false;
 view.update(center(11,5),1280,768);
 assert.ok(looks(view,16,5));
 assert.equal(view.barrierVisible(door),false);
 door.closed=true;view.update(center(11,5),1280,768);
 assert.ok(knows(view,16,5));
 assert.equal(looks(view,16,5),false);
 const remembered=vision.create(world,TILE,[door],view.seenTiles,new Set([1]));
 assert.ok(knows(remembered,11,9));
 assert.ok(knows(remembered,16,5));
});

test('a closed door blocks sight from both sides even when the observer shares its tile',()=>{
 for(const side of [-1,1]){
  const {door,view}=hallWithDoor();
  const observer={x:door.x+side*20,y:door.y};
  const near=14+side,far=14-side;
  view.update(observer,1280,768);
  assert.ok(view.barrierVisible(door));
  assert.ok(knows(view,14,5));
  assert.ok(looks(view,near,5));
  assert.equal(looks(view,far,5),false);
  assert.equal(view.sees(door.x-side*20,door.y),false);
  if(side<0)assert.equal(knows(view,far,5),false);
  door.closed=false;
  view.update(observer,1280,768);
  assert.ok(looks(view,far,5));
  assert.ok(knows(view,far,5));
 }
});

test('entering a room reveals every floor and interior wall, and the view survives leaving and loading',()=>{
 const W=35,H=18,map=Array.from({length:H},()=>Array(W).fill(1)),regions=map.map(row=>row.map(()=>-1));
 for(let y=3;y<=13;y++)for(let x=10;x<=32;x++){
  map[y][x]=0;regions[y][x]=2;
 }
 for(let y=3;y<=11;y++)map[y][14]=1;
 for(let x=2;x<=9;x++){
  map[8][x]=0;regions[8][x]=x<5?1:3;
 }
 const world={W,H,map,regions,stairs:[],rest:{id:1},rooms:[],isPassage:id=>id===3,abyssAt:()=>false,layerForRegion:()=>0};
 const visited=new Set([1]),view=vision.create(world,TILE,[],[],visited);
 const entrance=center(10,8);
 view.update(entrance,800,600);
 assert.equal(looks(view,18,8),false);
 assert.equal(knows(view,32,13),false);
 visited.add(2);
 view.update(entrance,800,600);
 for(let y=3;y<=13;y++)for(let x=10;x<=32;x++){
  assert.ok(knows(view,x,y),`room tile ${x},${y} is covered`);
  if(map[y][x]===0)assert.ok(looks(view,x,y),`room floor ${x},${y} is outside the view`);
 }
 assert.ok(knows(view,14,6));
 assert.ok(knows(view,32,14));
 view.update(center(3,8),800,600);
 assert.ok(looks(view,18,8));
 const reloaded=vision.create(world,TILE,[],[8*W+18],visited);
 reloaded.update(center(3,8),800,600);
 assert.ok(looks(reloaded,18,8));
 assert.ok(knows(reloaded,32,13));
});

test('entering the pantry leaves the nook behind its interior door hidden until reached',()=>{
 const save=run.freshRun(194),floor=geometry.build(run,save);
 const pantry=floor.annexes.find(room=>room.key==='pantry');
 const door=floor.doors.find(d=>d.id==='pantry-door');
 const barrier={...door,face:12,visible:()=>floor.doorHP(door)>0};
 barrier.floorCells=floor.barrierFloor(barrier);
 const visited=new Set([floor.rest.id,pantry.id]),view=vision.create(floor,TILE,[barrier],[],visited);
 const nook=center(pantry.x,pantry.y+pantry.h-1);
 view.update(center(pantry.cx,pantry.cy),1280,768);
 assert.ok(view.barrierVisible(barrier));
 assert.equal(view.remembers(nook.x,nook.y),false);
 assert.equal(view.sees(nook.x,nook.y),false);
 floor.strikeDoor(door.hp,door);
 visited.add(floor.regionAt(nook.x,nook.y));
 view.update(nook,1280,768);
 assert.ok(view.sees(nook.x,nook.y));
 assert.ok(view.remembers(pantry.cx*TILE,nook.y));
});

test('entering a sewer section still leaves the maze around its bends concealed',()=>{
 const save=run.freshRun(194);
 save.floor=run.sewerDepth(save.templeRunSeed);
 const floor=geometry.build(run,save),entry=floor.links.find(link=>link.id==='sewer-ladder-west-1');
 const region=floor.regionAt(entry.x,entry.y),visited=new Set([floor.rest.id,region]);
 assert.ok(floor.sewerRooms.some(room=>room.id===region));
 const view=vision.create(floor,TILE,[],[],visited);
 view.update(entry,1280,768);
 const tiles=floor.regions.flatMap((row,y)=>row.flatMap((id,x)=>id===region&&floor.map[y][x]===0?[center(x,y)]:[]));
 assert.ok(view.sees(entry.x,entry.y));
 assert.ok(tiles.some(p=>!view.sees(p.x,p.y)&&!view.remembers(p.x,p.y)));
});

test('the starter stairs stay visible from a side passage and only the ascent hides the unseen upper landing',()=>{
 const save=run.freshRun(103),floor=geometry.build(run,save);
 const [stair]=floor.stairs;
 assert.ok(stair);
 const barriers=floor.doors.map(d=>({...d,face:12,visible:()=>floor.doorHP(d)>0}));
 for(const barrier of barriers)barrier.floorCells=floor.barrierFloor(barrier);
 const visited=new Set([floor.rest.id]),view=vision.create(floor,TILE,barriers,[],visited);
 const across=stair.a.x;
 assert.ok(knows(view,across,stair.y));
 view.update(center(floor.rest.x+floor.rest.w+2,floor.rest.cy),1280,768);
 assert.ok(knows(view,across,stair.y));
 view.update(center(across,stair.y+2),1280,768);
 assert.ok(looks(view,across,stair.y));
 assert.equal(looks(view,across,stair.b.y),false);
 assert.ok(floor.hiddenByStairCrest(center(across,stair.y+2),center(across,stair.b.y),visited));
 assert.equal(floor.hiddenByStairCrest(center(across,stair.y+2),center(across,stair.y),visited),false);
 view.update(center(across,stair.b.y),1280,768);
 assert.ok(looks(view,across,stair.y+stair.h-1));
 visited.add(stair.roomIds[1]);
 view.update(center(across,stair.y+2),1280,768);
 assert.ok(looks(view,across,stair.b.y));
});

test('an encountered enemy stays visible around a bend while a closed door still blocks a new encounter',()=>{
 const {world,door,view}=hallWithDoor();
 const enemy={id:'scout',...center(11,9)};
 view.update(center(11,6),1280,768);
 assert.ok(view.observeEnemy(enemy));
 view.update(center(8,5),1280,768);
 assert.equal(looks(view,11,9),false);
 assert.ok(view.seesEnemy(enemy));
 Object.assign(enemy,center(11,10));
 assert.ok(view.observeEnemy(enemy));
 assert.equal(view.observeEnemy({id:'beyond-door',...center(15,5)}),false);
 door.closed=false;
 view.update(center(11,5),1280,768);
 assert.ok(view.observeEnemy({id:'beyond-door',...center(15,5)}));
 assert.ok(world.isPassage(2));
});

test('an open view clears the last three dark tiles in a room without requiring entry',()=>{
 const W=17,H=13,map=Array.from({length:H},()=>Array(W).fill(1)),regions=map.map(row=>row.map(()=>-1));
 const carve=(x,y,id)=>{map[y][x]=0;regions[y][x]=id;};
 for(let x=2;x<=6;x++)carve(x,5,x<4?1:3);
 const pockets=[4,5,6].map(y=>y*W+12),seen=[];
 for(let y=3;y<=8;y++)for(let x=7;x<=13;x++){
  if(x===8&&y>=4&&y<=6)continue;
  carve(x,y,2);
  if(!pockets.includes(y*W+x))seen.push(y*W+x);
 }
 const world={W,H,map,regions,stairs:[],rest:{id:1},rooms:[],isPassage:id=>id===3,abyssAt:()=>false,layerForRegion:()=>0};
 const door={...center(6,5),vertical:true,span:TILE,floorCells:[5*W+6],closed:true,visible(){return this.closed;}};
 const explored=new Set([1]),view=vision.create(world,TILE,[door],seen,explored),observer=center(5,5);
 view.update(observer,1280,768);
 assert.equal(knows(view,12,5),false);
 assert.equal(view.observeEnemy({id:'across',...center(12,5)}),false);
 door.closed=false;view.update(observer,1280,768);
 assert.ok(pockets.every(id=>view.known[id]));
 assert.ok(looks(view,12,5));
 assert.equal(explored.has(2),false);
});
