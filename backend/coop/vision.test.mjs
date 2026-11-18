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
