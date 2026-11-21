(() => {
'use strict';
const generator=window.AlleyGenerator,grammar=window.AlleyStairGeometry;
if(!generator?.enabled||!generator.stairs?.length||!grammar){
 window.AlleyVertical={enabled:false};return;
}
const HEIGHT=grammar.height,projected=grammar.select(generator),room=projected.room;
const key=(u,v)=>u+','+v;
const occupied=new Set(room.cells.map(p=>key(...p)));
const contains=(u,v)=>occupied.has(key(Math.floor(u),Math.floor(v)));
const plan=projected;
const stairs=generator.stairs[0];
stairs.roomId=room.id;
stairs.area=plan.region;
stairs.variant=plan.kind;
stairs.steps=plan.length;
stairs.levelFrom=0;stairs.levelTo=1;
generator.metadata.stairs=generator.stairs;
generator.metadata.stairVariant=plan.kind;
generator.metadata.stairTitle=plan.style;
room.plannedUse='Treppenraum';
const directions=[{id:'north',dx:0,dy:-1},{id:'west',dx:-1,dy:0},
 {id:'east',dx:1,dy:0},{id:'south',dx:0,dy:1}];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const candidates=[];
for(const [u,v] of room.cells){
 for(const dir of directions){
  if(occupied.has(key(u+dir.dx,v+dir.dy)))continue;
  const inward={x:u+.5-dir.dx,y:v+.5-dir.dy};
  if(!contains(inward.x,inward.y))continue;
  const bottom={x:u+.5,y:v+.5};
  if(distance(bottom,plan.bottom)<3||distance(bottom,plan.top)<2.2)continue;
  if(u>=stairs.area[0]-1&&u<=stairs.area[2]+1&&
   v>=stairs.area[1]-1&&v<=stairs.area[3]+1)continue;
  candidates.push({wall:dir.id,dx:dir.dx,dy:dir.dy,cell:[u,v],
   bottom,top:inward,face:Math.atan2(dir.dy,dir.dx),
   distance:distance(bottom,plan.bottom)});
 }
}
if(!candidates.length){
 for(const [u,v] of room.cells)for(const dir of directions){
  if(occupied.has(key(u+dir.dx,v+dir.dy)))continue;
  const top={x:u+.5-dir.dx,y:v+.5-dir.dy},bottom={x:u+.5,y:v+.5};
  if(!contains(top.x,top.y)||distance(bottom,plan.bottom)<2.2)continue;
  candidates.push({wall:dir.id,dx:dir.dx,dy:dir.dy,cell:[u,v],bottom,top,
   face:Math.atan2(dir.dy,dir.dx),distance:distance(bottom,plan.bottom)});
 }
}
const preferred=['north','west','east','south'];
const rotated=preferred.slice(generator.seed%4).concat(preferred.slice(0,generator.seed%4));
// Upper-floor access is an architectural prerequisite, not a decor afterthought.
const upper=plan.upper;
const connectedFromTop=()=>{
 const start=key(Math.floor(plan.top.x),Math.floor(plan.top.y)),visited=new Set([start]),queue=[start];
 for(let i=0;i<queue.length;i++){
  const [u,v]=queue[i].split(',').map(Number);
  for(const [du,dv] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const n=key(u+du,v+dv);
   if(upper.has(n)&&!visited.has(n)){visited.add(n);queue.push(n);}
  }
 }
 return visited;
};
const upperReachable=connectedFromTop();
candidates.sort((a,b)=>{
 const aConnected=Number(upperReachable.has(key(Math.floor(a.top.x),Math.floor(a.top.y))));
 const bConnected=Number(upperReachable.has(key(Math.floor(b.top.x),Math.floor(b.top.y))));
 if(bConnected!==aConnected)return bConnected-aConnected;
 const score=c=>4-rotated.indexOf(c.wall);
 return score(b)-score(a)||b.distance-a.distance||a.cell[1]-b.cell[1];
});
// A ladder opening may not sever the upstairs walkable region. Validate the
// removal of its actual hatch cell, not merely its initial room membership.
const staysConnected=c=>{
 const blocked=key(...c.cell),start=key(Math.floor(plan.top.x),Math.floor(plan.top.y)),
  goal=key(Math.floor(c.top.x),Math.floor(c.top.y));
 if(!upper.has(start)||!upper.has(goal)||start===blocked||goal===blocked)return false;
 const visited=new Set([start]),queue=[start];
 for(let i=0;i<queue.length;i++){
  const [u,v]=queue[i].split(',').map(Number);
  for(const [du,dv] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const n=key(u+du,v+dv);
   if(n!==blocked&&upper.has(n)&&!visited.has(n)){visited.add(n);queue.push(n);}
  }
 }
 return visited.has(goal);
};
const picked=candidates.find(staysConnected)??candidates.find(c=>
 upperReachable.has(key(Math.floor(c.top.x),Math.floor(c.top.y))))??candidates[0];
const ladder={...picked,id:'wall-ladder',kind:'ladder',height:HEIGHT};
if(!ladder?.bottom)throw Error('Could not place a wall-anchored ladder in the upper chamber');
if(staysConnected(ladder))upper.delete(key(...ladder.cell));
upper.add(key(Math.floor(ladder.top.x),Math.floor(ladder.top.y)));
const stairsConnector={
 id:'stone-stairs',kind:'stairs',floorFrom:0,floorTo:1,
 bottom:plan.bottom,top:plan.top,
 face:Math.atan2(plan.path[1].y-plan.path[0].y,plan.path[1].x-plan.path[0].x),
 duration:Math.max(2.1,plan.length*.19),variant:plan.kind
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
const playerInChamber=actor=>contains(actor.x/48,actor.y/48);
function nearby(actor,floor=0,maxDist=110){
 const point={x:actor.x/48,y:actor.y/48};
 return connectors.map(connector=>{
  const target=floor===0?connector.bottom:connector.top;
  const dist=distance(target,point)*48;
  return {...connector,distance:dist,approach:{x:target.x*48,y:target.y*48}};
 }).filter(item=>item.distance<=maxDist&&
  (floor===0||insideTop(item.top.x,item.top.y,.20)))
 .sort((a,b)=>a.distance-b.distance)[0]||null;
}
const clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>t*t*(3-2*t);
const stairPath=[
 {...plan.bottom,z:0},...plan.path,{...plan.top,z:HEIGHT}
];
const lengths=stairPath.slice(1).map((point,i)=>
 distance(point,stairPath[i]));
const totalLength=lengths.reduce((a,b)=>a+b,0);
function walkStairs(progress){
 let left=totalLength*clamp(progress);
 for(let i=0;i<lengths.length;i++){
  const d=lengths[i],a=stairPath[i],b=stairPath[i+1];
  if(left>d&&i<lengths.length-1){left-=d;continue;}
  const t=clamp(left/Math.max(d,.0001));
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,
   face:Math.atan2(b.y-a.y,b.x-a.x)};
 }
 return {...stairPath.at(-1),face:stairsConnector.face};
}
function pose(connector,up,t){
 const p=clamp(t),phase=smooth(clamp((p-.09)/.82));
 let current;
 if(connector.kind==='stairs'){
  current=walkStairs(up?phase:1-phase);
 }else{
  const from=up?connector.bottom:connector.top,to=up?connector.top:connector.bottom;
  current={x:from.x+(to.x-from.x)*phase,y:from.y+(to.y-from.y)*phase,
   z:HEIGHT*(up?phase:1-phase),face:connector.face};
 }
 return {x:current.x*48,y:current.y*48,z:current.z,progress:p,
  floor:up?(phase>=.97?1:0):(phase>=.97?0:1),
  angle:connector.kind==='ladder'?connector.face:
   current.face+(up?0:Math.PI),
  clip:connector.kind==='ladder'?(up?'climb-up':'climb-down'):'walk',
  landing:p>.82?clamp((p-.82)/.18):0};
}
function createLayers({project,polygon,line,cacheObject}){
 const slab=cacheObject(bounds,HEIGHT+34,ctx=>{
  const palette=['#687787','#728494','#677785','#788c99'];
  // The upper floor consists of genuine Z-elevated tiles. The cutout matches
  // the actual stair shaft instead of a fictitious hole in a rectangle.
  for(const str of upper){
   const [u,v]=str.split(',').map(Number);
   const id=Math.abs((u*23+v*41)%4);
   polygon(ctx,[project(u,v,HEIGHT),project(u+1,v,HEIGHT),
    project(u+1,v+1,HEIGHT),project(u,v+1,HEIGHT)],
    palette[id],'#96a8b4');
   if(!upper.has(key(u+1,v)))
    polygon(ctx,[project(u+1,v,HEIGHT),project(u+1,v+1,HEIGHT),
     project(u+1,v+1,HEIGHT-17),project(u+1,v,HEIGHT-17)],'#435464','#7b90a0');
   if(!upper.has(key(u,v+1)))
    polygon(ctx,[project(u,v+1,HEIGHT),project(u+1,v+1,HEIGHT),
     project(u+1,v+1,HEIGHT-17),project(u,v+1,HEIGHT-17)],'#394c5b','#748896');
  }
 });
 const stairsImage=cacheObject(stairs.area,HEIGHT+58,ctx=>{
  const sorted=plan.steps.slice().sort((a,b)=>{
   const p=a.center,q=b.center;
   return project(p.x,p.y,a.z)[1]-project(q.x,q.y,b.z)[1];
  });
  const palettes={
   top:['#939eaf','#98a3b0'],riser:'#555f70',left:'#485565',
   right:'#647384',line:'#d9ced0'
  };
  for(const step of sorted){
   const [a,b,c,d]=step.corners,z=step.z,prev=step.prev;
   const base=p=>project(p.x,p.y,0);
   const top=p=>project(p.x,p.y,z);
   const low=p=>project(p.x,p.y,prev);
   // Structural, load-bearing side cheeks are below the horizontal treads.
   polygon(ctx,[base(a),base(d),top(d),top(a)],palettes.left,'#343d4b');
   polygon(ctx,[base(b),base(c),top(c),top(b)],palettes.right,'#3e4654');
   // The single riser is precisely one step high, not an arbitrary tall wall.
   polygon(ctx,[low(a),low(b),top(b),top(a)],palettes.riser,'#424a57');
   polygon(ctx,[top(a),top(b),top(c),top(d)],
    palettes.top[Math.round(z*2)%2],'#d1c9ca');
   line(ctx,[top(a),top(b)],palettes.line,1.8);
  }
  for(const land of plan.landings){
   const ps=land.corners.map(p=>project(p.x,p.y,land.z));
   polygon(ctx,ps,'#939ca8','#ced2d6');
   for(let i=0;i<4;i++){
    const a=land.corners[i],b=land.corners[(i+1)%4];
    if(i%2===0)polygon(ctx,[project(a.x,a.y,0),project(b.x,b.y,0),
     project(b.x,b.y,land.z),project(a.x,a.y,land.z)],'#586475','#424e5d');
   }
  }
  for(const post of plan.posts){
   const p=post.p,r=post.radius;
   // Continuous spindle at the true geometric centre of the helical steps.
   const footprint=[{x:p.x-r,y:p.y-r},{x:p.x+r,y:p.y-r},
    {x:p.x+r,y:p.y+r},{x:p.x-r,y:p.y+r}];
   for(let i=0;i<4;i++){
    const a=footprint[i],b=footprint[(i+1)%4];
    if(i%2===0)polygon(ctx,[project(a.x,a.y,0),project(b.x,b.y,0),
     project(b.x,b.y,post.z1),project(a.x,a.y,post.z1)],
     '#5c6776','#a9aebb');
   }
   polygon(ctx,footprint.map(v=>project(v.x,v.y,post.z1)),'#929dac','#d4c0a6');
  }
  // Guardrails follow the real stringer, including a turn or curved helix.
  // No rail crosses the landing as an impossible diagonal chord.
  const profiles=[];
  if(plan.kind.startsWith('spiral')){
   const c=plan.posts[0].p,r=plan.cfg.outer*.99;
   const vertices=plan.steps.map(step=>step.corners[1]).concat(plan.steps.at(-1).corners[2]);
   profiles.push(vertices.map((p,i)=>({p,z:HEIGHT*i/(vertices.length-1)+28})));
  }else{
   for(const segment of (()=>{const all=[],start=plan.path[0];
    for(let i=0;i<plan.path.length-1;i++){
     const a=plan.path[i],b=plan.path[i+1];
     if(Math.abs(b.z-a.z)<.001)continue;
     all.push([a,b]);
    }return all;})()){
    for(const side of [-1,1]){
     const [a,b]=segment,v={x:b.x-a.x,y:b.y-a.y},d=Math.hypot(v.x,v.y)||1,
       n={x:-v.y/d*plan.width*.50,y:v.x/d*plan.width*.50};
     profiles.push([a,b].map(point=>({p:{x:point.x+n.x,y:point.y+n.y},z:point.z+28})));
    }
   }
  }
  for(const prof of profiles){
   if(prof.length<2)continue;
   for(const [i,x] of prof.entries()){
    if(i%3===0||i===prof.length-1){
     const bottom=x.z-28;
     line(ctx,[project(x.p.x,x.p.y,bottom),project(x.p.x,x.p.y,x.z)],
      '#757986',3.2);
    }
   }
   line(ctx,prof.map(x=>project(x.p.x,x.p.y,x.z)),'#9caab2',3);
  }
 });
 const cell=ladder.cell,ladderArea=ladder.wall==='north'||ladder.wall==='south'?
  [cell[0]+.15,cell[1]-.12,cell[0]+.85,cell[1]+1.12]:
  [cell[0]-.12,cell[1]+.15,cell[0]+1.12,cell[1]+.85];
 const ladderImage=cacheObject(ladderArea,HEIGHT+52,ctx=>{
  const [u,v]=cell;
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
  for(const rail of along)
   line(ctx,[project(...rail,HEIGHT+18),project(...rail,HEIGHT+40)],'#b08a58',4);
 });
 // Separate upper-only details. They MUST NOT leak into the ground-floor view.
 const upperLanding=cacheObject(stairs.area,HEIGHT+40,ctx=>{
  const top=plan.top,delta=.38,pts=[
   {x:top.x-delta,y:top.y-delta},{x:top.x+delta,y:top.y-delta},
   {x:top.x+delta,y:top.y+delta},{x:top.x-delta,y:top.y+delta}
  ];
  polygon(ctx,pts.map(p=>project(p.x,p.y,HEIGHT+2)),'#8eabba','#d6cfc0');
  line(ctx,[project(top.x-.3,top.y,HEIGHT+4),project(top.x+.3,top.y,HEIGHT+4)],'#e1d3b8',2);
 });
 return [
  {kind:'upper-deck',image:slab,depth:4000,level:1},
  {kind:'stairs-3d',image:stairsImage,depth:5000,level:0},
  {kind:'ladder-3d',image:ladderImage,depth:5100,level:0},
  {kind:'upper-landing',image:upperLanding,depth:5200,level:1}
 ];
}
const state={floor:0,z:0,transition:null,pending:null};
const api={enabled:true,height:HEIGHT,roomId:room.id,room,stairs,plan,ladder,upper,
 connectors,state,insideTop,playerInChamber,nearby,pose,createLayers};
window.AlleyVertical=api;
})();