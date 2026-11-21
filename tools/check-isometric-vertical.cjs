// Run: node tools/check-isometric-vertical.cjs
// Validates 3D stairs, wall-anchored ladders, upper-floor reachability
// and the continuous ascend / descend transitions for deterministic levels.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {join}=require('node:path');
const read=p=>fs.readFileSync(join(__dirname,'../beta',p),'utf8');
const generatorSrc=read('alley-generator.js'),mapSrc=read('alley-study-map.js'),verticalSrc=read('alley-vertical.js');
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const key=([u,v])=>u+','+v;
const within=(room,x,y)=>room.cells.some(c=>c[0]===Math.floor(x)&&c[1]===Math.floor(y));
function create(seed){
 const window={location:{search:'?szene=gasse&modus=generator&seed='+seed}};
 vm.runInNewContext(mapSrc,{window});
 vm.runInNewContext(generatorSrc,{window,URLSearchParams});
 vm.runInNewContext(verticalSrc,{window});
 return window;
}
function upperReachable(v,start,end){
 const first=[Math.floor(start.x),Math.floor(start.y)],target=key([Math.floor(end.x),Math.floor(end.y)]);
 if(!v.upper.has(key(first))||!v.upper.has(target))return false;
 const q=[first],visited=new Set([key(first)]);
 for(let i=0;i<q.length;i++)for(const [dx,dy] of dirs){
  const p=[q[i][0]+dx,q[i][1]+dy],k=key(p);
  if(v.upper.has(k)&&!visited.has(k)){visited.add(k);q.push(p);}
 }
 return visited.has(target);
}
let sideCounts={},slabs=0;
for(let seed=0;seed<120;seed++){
 const w=create(seed),g=w.AlleyGenerator,v=w.AlleyVertical;
 assert(v.enabled,'3D vertical prototype enabled');
 assert.equal(v.height,132,'same level lift height on every seed');
 assert.equal(v.connectors.length,2,'stair and ladder must share one level transition');
 assert(v.room.kind==='raum','upper story belongs to chamber, not arbitrary corridor');
 assert(v.stairs.roomId===v.room.id,'stairs are in upper chamber');
 const [u,y]=v.ladder.cell;
 assert(within(v.room,u+.5,y+.5),'ladder foot inside its room');
 assert(!within(v.room,u+.5+v.ladder.dx,y+.5+v.ladder.dy),
  'ladder is backed by an actual exterior wall, not floating inside');
 sideCounts[v.ladder.wall]=(sideCounts[v.ladder.wall]||0)+1;
 assert(upperReachable(v,v.connectors[0].top,v.connectors[1].top),
  'stair landing and ladder landing connected on upper platform');
 for(const c of v.connectors){
  assert(within(v.room,c.top.x,c.top.y),'upper landing belongs to the same chamber');
  assert(within(v.room,c.bottom.x,c.bottom.y),'lower landing belongs to the same chamber');
  for(const up of [true,false]){
   const start=v.pose(c,up,0),middle=v.pose(c,up,.5),end=v.pose(c,up,1);
   assert.equal(start.z,up?0:132);
   assert.equal(end.z,up?132:0);
   assert(Math.abs(middle.z-66)<1e-6,'progress must interpolate height continuously');
   assert.equal(start.clip,c.kind==='ladder'?(up?'climb-up':'climb-down'):'walk');
   assert.equal(end.floor,up?1:0);
  }
 }
 slabs+=v.upper.size;
}
assert(slabs>4000,'upper floor must be a real collection of level cells');
const html=read('index.html');
assert(html.includes('src="beta/alley-vertical.js?v=2"'));
assert(html.indexOf('alley-vertical.js?v=2')<html.indexOf('alley-study.js?v=9'),
 'vertical geometry must be available before art construction');
assert(html.includes("approachAlleyVertical()"),'E must trigger ladder/stairs approach');
assert(html.includes("state.transition={...task"),'interaction must initiate a timed climb');
assert(html.includes("state.floor=task.up?1:0"),'transition completion changes floor');
assert(html.includes("state.z=pose.z"),'camera and avatar share actual interpolated elevation');
assert(html.includes("alleyVertical?.state.z??0"),'upper-floor picking must respect elevation');
console.log('120 seeds: wall ladders, solid stairs, loft connections, both climb clips and level switches OK',sideCounts);
