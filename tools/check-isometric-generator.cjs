// Greybox invariants: node tools/check-isometric-generator.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../beta/alley-generator.js'),'utf8');
const generate=seed=>{
 const window={location:{search:'?szene=gasse&modus=generator&seed='+seed},
  AlleyStudyMap:{art:{ground:[]},logic:{
   walkable:[[1,2.75,12,6.85],[4.5,6.8,8.1,9.4],[9.5,.8,12,2.75]],
   waypoints:[]
  }}};
 vm.runInNewContext(source,{window,URLSearchParams});
 return window.AlleyGenerator;
};
const dirs=[[1,0],[-1,0],[0,1],[0,-1]],tile=key=>key.join(',');
const inside=(cell,room)=>room.cells.some(p=>p[0]===cell[0]&&p[1]===cell[1]);
function linked(g){
 const cells=new Map(g.rooms.flatMap(r=>r.cells.map(p=>[tile(p),p])));
 const reached=new Set(['11,4']),queue=[[11,4]];
 const free=(p,q)=>{
  for(let k=1;k<=10;k++){
   const x=p[0]+.5+(q[0]-p[0])*k/10,y=p[1]+.5+(q[1]-p[1])*k/10;
   if(g.blocked(x,y,.29))return false;
  }
  return true;
 };
 for(let i=0;i<queue.length;i++)for(const [dx,dy] of dirs){
  const a=queue[i],b=[a[0]+dx,a[1]+dy],k=tile(b);
  if(!cells.has(k)||reached.has(k)||!free(a,b))continue;
  reached.add(k);queue.push(b);
 }
 return g.rooms.every(room=>room.cells.some(p=>reached.has(tile(p))));
}
const fingerprints=new Set();
for(let seed=0;seed<150;seed++){
 const g=generate(seed);
 assert.equal(g.enabled,true);
 assert.equal(g.rooms.length,10,'exactly ten nodes including alley');
 assert.equal(g.doors.length,9,'one new confirmed connection per new room');
 assert(g.metadata.corridors>=3&&g.metadata.corridors<=5,'balanced corridor share');
 assert.equal(g.stairs.length,1,'one reserved vertical transition');
 const seen=new Set();
 for(const room of g.rooms){
  const footprint=new Set(room.cells.map(tile));
  assert.equal(footprint.size,room.cells.length,'no duplicate footprint cells');
  for(const p of room.cells){
   assert(!seen.has(tile(p)),'room footprints must not intersect');
   seen.add(tile(p));
  }
  assert(room.exits.length>=1,'all nodes must be connected to the room graph');
  const local=[room.cells[0]],visited=new Set([tile(room.cells[0])]);
  for(let i=0;i<local.length;i++)for(const [dx,dy] of dirs){
   const p=[local[i][0]+dx,local[i][1]+dy],id=tile(p);
   if(footprint.has(id)&&!visited.has(id)){visited.add(id);local.push(p);}
  }
  assert.equal(visited.size,room.cells.length,'each chamber must be an edge-connected polyomino');
 }
 for(const door of g.doors){
  assert(g.rooms[door.from]&&g.rooms[door.to],'door has both rooms');
  assert(door.edges.length>=1&&door.edges.length<=2,'portal width is one or two cells');
  for(const [a,b] of door.edges){
   assert.equal(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),1);
   assert(inside(a,g.rooms[door.from])&&inside(b,g.rooms[door.to]));
   assert(!g.blocked((a[0]+b[0]+1)/2,(a[1]+b[1]+1)/2,.28),
    'a doorway may never be blocked by a wall');
  }
 }
 const stair=g.stairs[0];
 const target=g.rooms[stair.roomId];
 assert(target.kind==='raum','vertical transition belongs to a chamber');
 for(let u=stair.area[0];u<stair.area[2];u++)for(let v=stair.area[1];v<stair.area[3];v++)
  assert(inside([u,v],target),'stairs must fit entirely within a single chamber');
 assert(linked(g),'all ten rooms must be continuously reachable with hero clearance');
 for(const wall of g.walls){
  assert(wall.area.every(Number.isFinite)&&wall.height>0,'no invalid wall geometry');
  assert(wall.room>=1&&wall.room<10,'every wall must have a supporting room');
  if(wall.interior)assert(wall.side==='west','interior walls are deliberate partitions');
 }
 fingerprints.add(g.rooms.map(r=>r.cells.map(tile).sort().join(';')).join('|'));
}
assert(fingerprints.size>=120,'seeds must produce substantially different topologies');
const sample=generate(4147);
assert.equal(JSON.stringify(sample.rooms.map(r=>r.cells)),
 JSON.stringify(generate(4147).rooms.map(r=>r.cells)),'seed reproducibility');
console.log('150 deterministic, connected 10-room greyboxes passed (portals, walls, clearance, stairs, diversity).');
