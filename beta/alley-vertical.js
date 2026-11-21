(() => {
'use strict';
const generator=window.AlleyGenerator;
if(!generator?.enabled||!generator.stairs?.length){
 window.AlleyVertical={enabled:false};return;
}
const HEIGHT=132,STEPS=9;
const room=generator.rooms[generator.stairs[0].roomId],stairs=generator.stairs[0];
const [su,sv,sr,sb]=stairs.area;
const key=(u,v)=>u+','+v;
const occupied=new Set(room.cells.map(p=>key(...p)));
const contains=(u,v)=>occupied.has(key(Math.floor(u),Math.floor(v)));
const stairCenter=[(su+sr)/2,(sv+sb)/2];
const base={x:stairCenter[0],y:sb-.47};
const summit={x:stairCenter[0],y:sv+.40};
const directions=[{id:'north',dx:0,dy:-1},{id:'west',dx:-1,dy:0},
 {id:'east',dx:1,dy:0},{id:'south',dx:0,dy:1}];
const candidates=[];
for(const [u,v] of room.cells){
 for(const dir of directions){
  if(occupied.has(key(u+dir.dx,v+dir.dy)))continue;
  const inward={x:u+.5-dir.dx,y:v+.5-dir.dy};
  if(!contains(inward.x,inward.y))continue;
  if(Math.hypot(u+.5-stairCenter[0],v+.5-stairCenter[1])<2.8)continue;
  candidates.push({wall:dir.id,dx:dir.dx,dy:dir.dy,cell:[u,v],
   bottom:{x:u+.5,y:v+.5},top:inward,
   // For non-wall-start orientations, place the ladder on the correct interior
   // side of the load-bearing outside wall, never free-standing.
   face:Math.atan2(dir.dy,dir.dx),
   distance:Math.hypot(u+.5-stairCenter[0],v+.5-stairCenter[1])});
 }
}
const preferred=['north','west','east','south'];
const rotated=preferred.slice(generator.seed%4).concat(preferred.slice(0,generator.seed%4));
candidates.sort((a,b)=>{
 const score=d=>4-rotated.indexOf(d.wall);
 return score(b)-score(a)||b.distance-a.distance||a.cell[1]-b.cell[1];
});
const ladder={...candidates[0],id:'wall-ladder',kind:'ladder',height:HEIGHT};
if(!ladder?.bottom)throw Error('No structurally connected wall for ladder');
// The loft covers this chamber, but two explicit voids expose the lower
// stairwell and ladder shaft. Clear tiles of the upper level remain walkable.
const upper=new Set(room.cells.map(p=>key(...p)));
for(let v=sv+1;v<sb;v++)for(let u=su;u<sr;u++)upper.delete(key(u,v));
upper.delete(key(...ladder.cell));
const upperConnected=()=>{
 const start=key(Math.floor(summit.x),Math.floor(summit.y));
 if(!upper.has(start))return false;
 const queue=[start],seen=new Set(queue);
 for(let i=0;i<queue.length;i++){
  const [u,v]=queue[i].split(',').map(Number);
  for(const [du,dv] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const n=key(u+du,v+dv);
   if(upper.has(n)&&!seen.has(n)){queue.push(n);seen.add(n);}
  }
 }
 return upper.has(key(Math.floor(ladder.top.x),Math.floor(ladder.top.y)))&&seen.size>=upper.size*.72;
};
if(!upperConnected()){
 // A mezzanine cannot contain unreachable architectural islands. Bridge the
 // two shafts rather than inventing disconnected upper walkways.
 for(const [u,v] of room.cells)upper.add(key(u,v));
 upper.delete(key(...ladder.cell));
}
const stairsConnector={
 id:'stone-stairs',kind:'stairs',floorFrom:0,floorTo:1,
 bottom:base,top:summit,
 face:Math.atan2(summit.y-base.y,summit.x-base.x),
 duration:2.45
};
const ladderConnector={
 id:'wall-ladder',kind:'ladder',floorFrom:0,floorTo:1,
 bottom:ladder.bottom,top:ladder.top,face:ladder.face,duration:2.8
};
const connectors=[stairsConnector,ladderConnector];
const bounds=room.cells.reduce(([u,v,r,b],[x,y])=>
 [Math.min(u,x),Math.min(v,y),Math.max(r,x+1),Math.max(b,y+1)],
 [Infinity,Infinity,-Infinity,-Infinity]);
const insideTop=(u,v,r=0)=>[[u-r,v],[u+r,v],[u,v-r],[u,v+r]]
 .every(([x,y])=>upper.has(key(Math.floor(x),Math.floor(y))));
const playerInChamber=(p)=>contains(p.x/48,p.y/48);
function nearby(actor,floor=0,maxDist=110){
 const point={x:actor.x/48,y:actor.y/48};
 return connectors.map(connector=>{
  const target=floor===0?connector.bottom:connector.top;
  const distance=Math.hypot(target.x-point.x,target.y-point.y)*48;
  return {...connector,distance,approach:{x:target.x*48,y:target.y*48}};
 }).filter(item=>item.distance<=maxDist&&
  (floor===0||insideTop(item.top.x,item.top.y,.20)))
 .sort((a,b)=>a.distance-b.distance)[0]||null;
}
const clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>t*t*(3-2*t);
function pose(connector,up,t){
 const p=clamp(t),from=up?connector.bottom:connector.top,to=up?connector.top:connector.bottom;
 // Short anticipation and settling, long central climb.
 const phase=smooth(clamp((p-.11)/.78));
 const z=HEIGHT*(up?phase:1-phase);
 const x=(from.x+(to.x-from.x)*phase)*48;
 const y=(from.y+(to.y-from.y)*phase)*48;
 return {x,y,z,progress:p,floor:up?(phase>=.97?1:0):(phase>=.97?0:1),
  angle:connector.kind==='ladder'?connector.face:(up?connector.face:connector.face+Math.PI),
  clip:connector.kind==='ladder'?(up?'climb-up':'climb-down'):
   (up?'walk':'walk'),
  // 0...1: lips / landing used by separate 3D guardian climb rig.
  landing:p>.84?clamp((p-.84)/.16):0};
}
function createLayers({project,polygon,line,block,cacheObject}){
 const groundSet=upper;
 const slab=cacheObject(bounds,HEIGHT+25,ctx=>{
  const cellColor=['#69798a','#728191','#606e7d','#718694'];
  for(const id of groundSet){
   const [u,v]=id.split(',').map(Number),idx=Math.abs((u*23+v*41)%4);
   polygon(ctx,[project(u,v,HEIGHT),project(u+1,v,HEIGHT),
    project(u+1,v+1,HEIGHT),project(u,v+1,HEIGHT)],cellColor[idx],'#9faeb7');
   // Edges are real slab thickness, not flat stickers, so a lower floor
   // disappears behind the upper plate when standing elsewhere.
   if(!groundSet.has(key(u+1,v)))
    polygon(ctx,[project(u+1,v,HEIGHT),project(u+1,v+1,HEIGHT),
     project(u+1,v+1,HEIGHT-18),project(u+1,v,HEIGHT-18)],'#465562','#879cab');
   if(!groundSet.has(key(u,v+1)))
    polygon(ctx,[project(u,v+1,HEIGHT),project(u+1,v+1,HEIGHT),
     project(u+1,v+1,HEIGHT-18),project(u,v+1,HEIGHT-18)],'#3c4b5a','#718393');
  }
  // Dedicated walkway edge visually anchors the upper-level interior.
  const [u,v,r,b]=bounds;
  line(ctx,[project(u,v,HEIGHT+3),project(r,v,HEIGHT+3)],'#bfd0ce',3);
 });
 const stairsImage=cacheObject(stairs.area,HEIGHT+12,ctx=>{
  const [u,v,r,b]=stairs.area;
  // Actual isometric solid treads; each rises to a different Z value.
  for(let i=0;i<STEPS;i++){
   const a=sb-(i+1)*(sb-sv)/STEPS,bb=sb-i*(sb-sv)/STEPS;
   const elevation=(i+1)*HEIGHT/STEPS;
   block(ctx,[u,a,r,bb],elevation,
    i%2?['#5d6475','#7b8392','#9e9fac','#3c4455']:
      ['#606a79','#858f9e','#9ca6b0','#434b5a']);
   line(ctx,[project(u,a,elevation),project(r,a,elevation)],'#c3bec0',2);
  }
  for(const side of [u+.06,r-.06]){
   for(let i=0;i<=3;i++){
    const v=sb-(sb-sv)*i/3,z=HEIGHT*i/3+13;
    line(ctx,[project(side,v,z),project(side,v,z+28)],'#a7a9aa',3);
   }
   line(ctx,[project(side,sb,15+28),project(side,sv,HEIGHT+13+28)],'#c2babb',3);
  }
 });
 const ladderArea=ladder.wall==='north'||ladder.wall==='south'?
  [ladder.cell[0]+.15,ladder.cell[1]-.12,ladder.cell[0]+.85,ladder.cell[1]+1.12]:
  [ladder.cell[0]-.12,ladder.cell[1]+.15,ladder.cell[0]+1.12,ladder.cell[1]+.85];
 const ladderImage=cacheObject(ladderArea,HEIGHT+18,ctx=>{
  const [u,v]=ladder.cell;
  const along=ladder.dx?[[u+(ladder.dx>0?1-.12:.12),v+.24],
   [u+(ladder.dx>0?1-.12:.12),v+.76]]:
   [[u+.24,v+(ladder.dy>0?1-.12:.12)],
    [u+.76,v+(ladder.dy>0?1-.12:.12)]];
  for(const rail of along){
   line(ctx,[project(...rail,-4),project(...rail,HEIGHT+20)],'#2c2d3a',8);
   line(ctx,[project(...rail,-4),project(...rail,HEIGHT+20)],'#ad895d',4);
   line(ctx,[project(...rail,-4),project(...rail,HEIGHT+20)],'#d3b587',1.2);
  }
  for(let i=0;i<10;i++){
   const z=7+i*(HEIGHT+6)/10;
   line(ctx,along.map(p=>project(...p,z)),'#352f35',7);
   line(ctx,along.map(p=>project(...p,z)),'#bda47b',4);
  }
  // Continuous top grip posts rise above the upper platform.
  for(const rail of along){
   line(ctx,[project(...rail,HEIGHT+18),project(...rail,HEIGHT+40)],'#b08a58',4);
  }
 });
 return [
  {kind:'upper-deck',image:slab,depth:4000,level:1},
  {kind:'stairs-3d',image:stairsImage,depth:5000,level:0},
  {kind:'ladder-3d',image:ladderImage,depth:5100,level:0}
 ];
}
const state={floor:0,z:0,transition:null,pending:null};
const api={enabled:true,height:HEIGHT,roomId:room.id,room,stairs,ladder,upper,connectors,state,
 insideTop,playerInChamber,nearby,pose,createLayers};
window.AlleyVertical=api;
})();