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
const norm=(x,y)=>{const length=Math.hypot(x,y)||1;return {x:x/length,y:y/length};};
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
// Reuse the calibrated 2D staircase movement constraints: climb speeds
// .68/.73, descent speeds .83/.86, lateral walking .58, landings .95.
const STAIR_SPEED=Object.freeze({straightUp:.68,straightDown:.83,
 curvedUp:.73,curvedDown:.86,across:.58,landing:.95});
const curving=plan.kind.startsWith('spiral')||
 ['quarter','switchback','curved'].includes(plan.kind);
function segmentAt(distanceAlong){
 let left=Math.max(0,Math.min(totalLength,distanceAlong));
 for(let i=0;i<lengths.length;i++){
  if(left>lengths[i]&&i<lengths.length-1){left-=lengths[i];continue;}
  return {index:i,t:Math.max(0,Math.min(1,left/Math.max(.00001,lengths[i]))),
   a:stairPath[i],b:stairPath[i+1]};
 }
 const i=lengths.length-1;
 return {index:i,t:1,a:stairPath[i],b:stairPath[i+1]};
}
function speedOnStair(distanceAlong,sign){
 const {a,b}=segmentAt(distanceAlong);
 if(Math.abs(a.z-b.z)<.001)return STAIR_SPEED.landing;
 return sign>0?
  (curving?STAIR_SPEED.curvedUp:STAIR_SPEED.straightUp):
  (curving?STAIR_SPEED.curvedDown:STAIR_SPEED.straightDown);
}
const between=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy;
 const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(n,.00001)));
 return {t,distance:Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)};
};
const distanceEdge=(p,a,b)=>between(p,a,b).distance;
function insideConvex(p,points){
 let positive=false,negative=false;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  const cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
  positive||=cross>1e-7;negative||=cross< -1e-7;
  if(positive&&negative)return false;
 }
 return true;
}
const stairSurfaces=plan.steps.concat(plan.landings);
const navigation=window.AlleyStairNavigation.make(plan);
const intersectsStair=(part,p,r)=>insideConvex(p,part.corners)||r>0&&
 part.corners.some((a,i)=>distanceEdge(p,a,part.corners[(i+1)%part.corners.length])<=r);
function overStair(u,v,r=0){
 const p={x:u,y:v};
 return stairSurfaces.some(part=>intersectsStair(part,p,r));
}
// Closed stairs obstruct the ground. Open construction allows passage only
// where the underside has standing clearance; no falls are enabled yet.
const HEAD_CLEARANCE=92,SLAB_THICKNESS=13;
const CROUCH_CLEARANCE=39;
function blocksGround(u,v,r=0,crouching=state.crouching){
 const p={x:u,y:v};
 if(distance(plan.bottom,p)<=.58+r*.65)return false;
 const clearance=crouching?CROUCH_CLEARANCE:HEAD_CLEARANCE;
 // Closed switchbacks have full-height infill, and support posts are never
 // traversable even when the upper open platform clears the player's head.
 if(stairSurfaces.some(part=>intersectsStair(part,p,r)&&
  (!plan.cfg.open||(part.prev??part.z)-SLAB_THICKNESS<clearance)))return true;
 if(plan.posts.some(post=>distance(post.p,p)<post.radius+r))return true;
 if(plan.cfg.open)for(const landing of plan.landings.filter(l=>!l.top))
  for(const corner of landing.corners)
   if(distance(corner,p)<.085+r)return true;
 return false;
}
// Upstairs XY footprints can overlap lower stair treads. Only the head gate
// permits entry: the remaining sides are solid while fall physics is disabled.
function blocksTop(u,v,r=0){
 if(!overStair(u,v,r))return false;
 return distance(plan.top,{x:u,y:v})>.58+r*.65;
}
// Pick actual visible isometric tread surfaces, not their misleading
// flat-ground cursor projections. This lets right-click target a flight.
function pickStair(screen,iso){return stairController.pick(screen,iso);}
function walkStairs(progress){
 let left=totalLength*clamp(progress);
 for(let i=0;i<lengths.length;i++){
  const d=lengths[i],a=stairPath[i],b=stairPath[i+1];
  if(left>d&&i<lengths.length-1){left-=d;continue;}
  const t=clamp(left/Math.max(d,.0001));
  const heading=(p,q)=>Math.atan2(q.y-p.y,q.x-p.x);
  const blend=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*smooth(t);
  let face=heading(a,b);
  // Turn the torso over the landing instead of snapping its orientation at
  // the exact corner. The geometry remains fixed; only the facing blends.
  if(t<.2&&i>0)face=blend(heading(stairPath[i-1],a),face,.5+.5*t/.2);
  else if(t>.8&&i<lengths.length-1)
   face=blend(face,heading(b,stairPath[i+2]),.5*(t-.8)/.2);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,face};
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
 // Static raster art is baked per tread at scene construction, with separate
 // scene depths. It is never re-rasterized when the guardian moves.
 const stairObjects=[];
 const boundsFor=points=>[Math.min(...points.map(p=>p.x)),
  Math.min(...points.map(p=>p.y)),Math.max(...points.map(p=>p.x)),
  Math.max(...points.map(p=>p.y))];
 function drawPrism(ctx,corners,z,base,posts=false){
  const low=corners.map(p=>project(p.x,p.y,base));
  const high=corners.map(p=>project(p.x,p.y,z));
  polygon(ctx,low,'#454e5d','#394250');
  for(let i=0;i<corners.length;i++){
   const j=(i+1)%corners.length;
   polygon(ctx,[low[i],low[j],high[j],high[i]],
    i%2?'#697788':'#536174','#354352');
  }
  if(posts&&base>5)for(const corner of corners){
   const q=.085,x=corner.x,y=corner.y;
   const pts=[{x:x-q,y:y-q},{x:x+q,y:y-q},
    {x:x+q,y:y+q},{x:x-q,y:y+q}],
    foot=pts.map(p=>project(p.x,p.y,0)),
    cap=pts.map(p=>project(p.x,p.y,base));
   for(let i=0;i<4;i++){
    const j=(i+1)%4;
    polygon(ctx,[foot[i],foot[j],cap[j],cap[i]],
     i%2?'#586778':'#788798','#424e5c');
   }
   polygon(ctx,cap,'#adb8bf','#354452');
  }
  polygon(ctx,high,'#939ca8','#d4d6db');
 }
 for(const [index,step] of plan.steps.entries()){
  const image=cacheObject(boundsFor(step.corners),HEIGHT+58,ctx=>{
   const [a,b,c,d]=step.corners,z=step.z,prev=step.prev;
   const top=p=>project(p.x,p.y,z),
    low=p=>project(p.x,p.y,prev),
    base=p=>project(p.x,p.y,plan.cfg.open?Math.max(0,z-13):0);
   // Closed flights have stone infill to the floor; open flights have a
   // 13px load-bearing soffit and allow passage under high sections.
   polygon(ctx,[base(a),base(d),top(d),top(a)],'#485565','#343d4b');
   polygon(ctx,[base(b),base(c),top(c),top(b)],'#647384','#3e4654');
   polygon(ctx,[low(a),low(b),top(b),top(a)],'#555f70','#424a57');
   polygon(ctx,[top(a),top(b),top(c),top(d)],
    index%2?'#98a3b0':'#939eaf','#d1c9ca');
   line(ctx,[top(a),top(b)],'#d9ced0',1.8);
   // Keep rail geometry local to each flight; do not draw a diagonal
   // rail across a real U-shaped intermediate landing.
   const rails=plan.kind.startsWith('spiral')||plan.kind==='curved'?
    [[b,c]]:[[a,d],[b,c]];
   for(const [start,end] of rails){
    line(ctx,[project(start.x,start.y,prev+27),
     project(end.x,end.y,z+27)],'#9caab2',3);
    if(index%2===0)line(ctx,[project(start.x,start.y,prev),
     project(start.x,start.y,prev+27)],'#8d99a9',2.8);
   }
  });
  stairObjects.push({kind:'stair-tread',image,level:0,
   depth:project(step.center.x,step.center.y,0)[1]+.25});
 }
 for(const landing of plan.landings.filter(l=>!l.top)){
  const center=landing.corners.reduce((p,q)=>({x:p.x+q.x/landing.corners.length,
   y:p.y+q.y/landing.corners.length}),{x:0,y:0});
  const image=cacheObject(boundsFor(landing.corners),HEIGHT+58,ctx=>
   drawPrism(ctx,landing.corners,landing.z,
    plan.cfg.open?Math.max(0,landing.z-13):0,plan.cfg.open));
  stairObjects.push({kind:'stair-landing',image,level:0,
   depth:project(center.x,center.y,0)[1]+.25});
 }
 for(const post of plan.posts){
  const p=post.p,r=post.radius,
   corners=[{x:p.x-r,y:p.y-r},{x:p.x+r,y:p.y-r},
    {x:p.x+r,y:p.y+r},{x:p.x-r,y:p.y+r}];
  const image=cacheObject(boundsFor(corners),post.z1+20,ctx=>
   drawPrism(ctx,corners,post.z1,0,false));
  stairObjects.push({kind:'stair-spindle',image,level:0,
   depth:project(p.x,p.y,0)[1]+.3});
 }
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
  const top=plan.top,delta=.38;
  const caps=plan.landings.filter(l=>l.top);
  const plates=caps.length?caps.map(l=>l.corners):[[
   {x:top.x-delta,y:top.y-delta},{x:top.x+delta,y:top.y-delta},
   {x:top.x+delta,y:top.y+delta},{x:top.x-delta,y:top.y+delta}
  ]];
  for(const corners of plates)drawPrism(ctx,corners,HEIGHT,HEIGHT-13,false);
 });
 return [
  {kind:'upper-deck',image:slab,depth:4000,level:1},
  ...stairObjects,
  {kind:'ladder-3d',image:ladderImage,
   depth:project(ladder.bottom.x,ladder.bottom.y)[1]+.25,level:0},
  {kind:'upper-landing',image:upperLanding,depth:5200,level:1}
 ];
}
const state={floor:0,z:0,transition:null,pending:null,stairRide:null,crouching:false};
// Clicks target a 3D point on the stair centreline. Explicit foot/head
// positions are exact endpoints, so a click can finish a floor transition.
function targetAlongStairs(part){
 const p=part.center??(part.corners?
  part.corners.reduce((sum,q)=>({x:sum.x+q.x/part.corners.length,
   y:sum.y+q.y/part.corners.length}),{x:0,y:0}):part);
 const h=Number.isFinite(part.prev)?(part.prev+part.z)/2:(part.z??0);
 if(part.top)return totalLength;
 if(distance(p,plan.top)<.08&&h>=HEIGHT-1)return totalLength;
 if(distance(p,plan.bottom)<.08&&h<=1)return 0;
 let best=Infinity,at=0,passed=0;
 for(let i=0;i<lengths.length;i++){
  const a=stairPath[i],b=stairPath[i+1],dx=b.x-a.x,dy=b.y-a.y,
   dz=(b.z-a.z)/24;
  const fraction=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(h-a.z)/24*dz)/
   Math.max(1e-8,dx*dx+dy*dy+dz*dz));
  const err=(p.x-a.x-dx*fraction)**2+(p.y-a.y-dy*fraction)**2+
   ((h-a.z)/24-dz*fraction)**2;
  if(err<best){best=err;at=passed+lengths[i]*fraction;}
  passed+=lengths[i];
 }
 return Math.max(0,Math.min(totalLength,at));
}
// Both keyboard and click motion use one freeform, radius-safe navigation
// surface rather than separate timing or single-centreline movement systems.
const stairController=window.AlleyStairController.make({
 plan,state,nav:navigation,length:totalLength,speeds:STAIR_SPEED,curving
});
const boardStairs=(actor,up=true,target=null)=>stairController.board(actor,up,target);
const aimStairs=part=>stairController.aim(part);
const tryEnterStairs=(actor,dx,dy)=>stairController.enter(actor,dx,dy);
const advanceStairs=(actor,dt,speed,dx=0,dy=0,options=null)=>
 stairController.advance(actor,dt,speed,dx,dy,options);
const api={enabled:true,height:HEIGHT,roomId:room.id,room,stairs,plan,ladder,upper,
 connectors,state,insideTop,playerInChamber,nearby,pose,createLayers,stairLength:totalLength,
 navigation,
 overStair,blocksGround,blocksTop,pickStair,speedOnStair,stairSpeed:STAIR_SPEED,
 boardStairs,aimStairs,targetAlongStairs,tryEnterStairs,advanceStairs};
window.AlleyVertical=api;
})();