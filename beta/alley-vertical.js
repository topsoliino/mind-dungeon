(() => {
'use strict';
const generator=window.AlleyGenerator,grammar=window.AlleyStairGeometry;
if(!generator?.enabled||!generator.stairs?.length||!grammar){
 window.AlleyVertical={enabled:false};return;
}
const prison=window.RockyCoastPrison?.enabled?window.RockyCoastPrison:null;
const HEIGHT=grammar.height;
const key=(u,v)=>u+','+v;
const directions=[{id:'north',dx:0,dy:-1},{id:'west',dx:-1,dy:0},
 {id:'east',dx:1,dy:0},{id:'south',dx:0,dy:1}];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const norm=(x,y)=>{const length=Math.hypot(x,y)||1;return {x:x/length,y:y/length};};
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
const intersectsStair=(part,p,r)=>insideConvex(p,part.corners)||r>0&&
 part.corners.some((a,i)=>distanceEdge(p,a,part.corners[(i+1)%part.corners.length])<=r);
// Find a second chamber with a real wall and trace a gallery from the stair head.
const buildingCells=new Map();
for(const chamber of generator.rooms.slice(1))
 for(const cell of chamber.cells)buildingCells.set(key(...cell),chamber);
const tile=p=>key(Math.floor(p.x),Math.floor(p.y));
function placeLadder(plan){
 const {room,upper}=plan;
 const upperStart=tile(plan.top),parent=new Map([[upperStart,null]]);
 const queue=[[Math.floor(plan.top.x),Math.floor(plan.top.y)]];
 const surfaces=plan.steps.concat(plan.landings);
 function clearDeck(x,y){
  const cell=key(Math.floor(x),Math.floor(y));
  return buildingCells.has(cell)&&(buildingCells.get(cell)!==room||
   upper.has(cell)&&(distance({x,y},plan.top)<=.58+.29*.65||
   !surfaces.some(part=>intersectsStair(part,{x,y},.29))));
 }
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  for(const {dx,dy} of directions){
   const u=x+dx,v=y+dy,cell=key(u,v);
   if(parent.has(cell)||!clearDeck(u+.5,v+.5)||
    !clearDeck(x+.5+dx*.5,y+.5+dy*.5))continue;
   parent.set(cell,key(x,y));queue.push([u,v]);
  }
 }
 const openings=new Set(generator.doors.flatMap(d=>d.edges.flatMap(pair=>pair.map(p=>key(...p)))));
 for(const p of generator.outdoorExit?.edges||[])openings.add(key(...p[0]));
 const candidates=[];
 for(const chamber of generator.rooms.filter(r=>r.kind==='raum'&&r!==room)){
  for(const [u,v] of chamber.cells)for(const dir of directions){
   if(prison&&(dir.id==='south'||dir.id==='east'))continue;
   const cell=key(u,v),wall=key(u+dir.dx,v+dir.dy);
   if(openings.has(cell)||buildingCells.has(wall))continue;
   // The top-out must be radius-safe INSIDE the adjacent upper-floor cell,
   // but as close to the hatch lip as possible (not the distant tile centre).
   const bottom={x:u+.5,y:v+.5},top={
    x:bottom.x-dir.dx*.89,y:bottom.y-dir.dy*.89
   };
   if(buildingCells.get(tile(top))!==chamber||!parent.has(tile(top))||
    generator.blocked(bottom.x,bottom.y,.3))continue;
   const preferred=(directions.indexOf(dir)+generator.seed)%4===0?1:0;
   const score=(Math.floor(room.id/5)!==Math.floor(chamber.id/5)?1000:0)+
    preferred*100+distance(bottom,plan.bottom);
   candidates.push({roomId:chamber.id,wall:dir.id,dx:dir.dx,dy:dir.dy,cell:[u,v],
    bottom,top,face:Math.atan2(dir.dy,dir.dx),score});
  }
 }
 candidates.sort((a,b)=>b.score-a.score);
 const ladders=[];
 for(const candidate of candidates){
  if(ladders.some(other=>distance(other.bottom,candidate.bottom)<5))continue;
  const hatch=key(...candidate.cell);
  let valid=true;
  for(let k=tile(candidate.top);k!==null;k=parent.get(k)){
   if(k===hatch){valid=false;break;}
  }
  if(!valid)continue;
  const id=ladders.length?'wall-ladder-'+(ladders.length+1):'wall-ladder';
  ladders.push({...candidate,id,kind:'ladder',height:HEIGHT});
  if(ladders.length===(prison?3:1))break;
 }
 if(!ladders.length)return false;
 for(const ladder of ladders){
  for(const cell of generator.rooms[ladder.roomId].cells)upper.add(key(...cell));
  for(let k=tile(ladder.top);k!==null;k=parent.get(k))upper.add(k);
 }
 for(const ladder of ladders)upper.delete(key(...ladder.cell));
 plan.ladders=ladders;plan.ladder=ladders[0];
 return true;
}
const state={floor:0,z:0,transition:null,pending:null,stairRide:null,crouching:false};
function buildFlight(parity,previous){
const plan=grammar.select(generator,placeLadder,previous?.plan.region,previous?.plan.kind),room=plan.room;
const ladder=plan.ladder,upper=plan.upper;
// Share ONE wall-space reference for ladder artwork and player root motion.
// The wall rails sit .38 of a cell outward from the ladder-cell centre.
// The Blender wrists reach a rail 0.36 model-units in front of the body:
// a root .30 cells inside the wall keeps the hands on the visible rungs.
function contactFor(ladder){
const ladderWall={
 x:ladder.cell[0]+.5+ladder.dx*.16,
 y:ladder.cell[1]+.5+ladder.dy*.16
};
return {
 wall:ladderWall,
 climb:{x:ladderWall.x-ladder.dx*.30,y:ladderWall.y-ladder.dy*.30},
 rails:ladder.dx?[
  {x:ladderWall.x,y:ladder.cell[1]+.24},
  {x:ladderWall.x,y:ladder.cell[1]+.76}
 ]:[
  {x:ladder.cell[0]+.24,y:ladderWall.y},
  {x:ladder.cell[0]+.76,y:ladderWall.y}
 ]
};
}
const ladderContact=contactFor(ladder);
const occupied=new Set(room.cells.map(p=>key(...p)));
const contains=(u,v)=>occupied.has(key(Math.floor(u),Math.floor(v)));
const stairs=parity?{...generator.stairs[0]}:generator.stairs[0];
stairs.roomId=room.id;
stairs.area=plan.region;
stairs.variant=plan.kind;
stairs.steps=plan.length;
stairs.levelFrom=0;stairs.levelTo=1;
generator.metadata.stairs=generator.stairs;
generator.metadata.stairVariant=plan.kind;
generator.metadata.stairTitle=plan.style;
room.plannedUse='Treppenraum';
generator.rooms[ladder.roomId].plannedUse='Leiterkammer';
const stairsConnector={
 flight:parity,id:'stone-stairs',roomId:room.id,kind:'stairs',floorFrom:0,floorTo:1,
 bottom:plan.bottom,top:plan.top,
 face:Math.atan2(plan.path[1].y-plan.path[0].y,plan.path[1].x-plan.path[0].x),
 duration:Math.max(2.1,plan.length*.19),variant:plan.kind
};
stairsConnector.mouth=plan.steps.slice(-4);
stairsConnector.lip=plan.path.at(-1);
const ladders=plan.ladders??[ladder];
const connectors=[stairsConnector,...ladders.map(l=>({
 flight:parity,id:l.id,roomId:l.roomId,kind:'ladder',floorFrom:0,floorTo:1,
 bottom:l.bottom,top:l.top,face:l.face,duration:2.8,contact:contactFor(l)
}))];
const floors=prison?Array.from({length:prison.count},(_,index)=>{
 if(index===prison.count-1)return prison.level===4?[]:[stairsConnector];
 const hash=Math.imul(generator.seed^(index+1),0x45d9f3b);
 return connectors.slice(0,1+((hash^(hash>>>16))>>>0)%connectors.length);
}):[connectors];
const connectorsAt=index=>prison?(floors[index]??[]):connectors;
const active=()=>connectorsAt((prison?.storey??1)-1);
const hasStairs=()=>active().length>0;
const insideTop=(u,v,r=0)=>[[u-r,v],[u+r,v],[u,v-r],[u,v+r]]
 .every(([x,y])=>upper.has(key(Math.floor(x),Math.floor(y))));
const playerInChamber=actor=>contains(actor.x/48,actor.y/48);
function nearby(actor,floor=0,maxDist=110){
 const point={x:actor.x/48,y:actor.y/48};
 return active().map(connector=>{
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
const stairSurfaces=plan.steps.concat(plan.landings);
const points=stairSurfaces.flatMap(part=>part.corners).concat(plan.posts.flatMap(({p,radius})=>[{x:p.x-radius,y:p.y-radius},{x:p.x+radius,y:p.y+radius}]));
const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
const bounds=[Math.min(...xs)-.1,Math.min(...ys)-.1,Math.max(...xs)+.1,Math.max(...ys)+.1];
stairsConnector.length=totalLength*48;
const navigation=window.AlleyStairNavigation.make(plan);
function overStair(u,v,r=0){
 const p={x:u,y:v};
 return stairSurfaces.some(part=>intersectsStair(part,p,r));
}
// Closed stairs obstruct the ground. Open construction allows passage only
// where the underside has standing clearance; no falls are enabled yet.
const HEAD_CLEARANCE=92,SLAB_THICKNESS=13;
const CROUCH_CLEARANCE=39;
function blocksGround(u,v,r=0,crouching=state.crouching){
 if(u+r<bounds[0]||v+r<bounds[1]||u-r>bounds[2]||v-r>bounds[3]||!hasStairs())return false;
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
function pickStair(screen,iso){return hasStairs()?stairController.pick(screen,iso):null;}
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
 const p=clamp(t),phase=p;
 let current,travel=phase;
 if(connector.kind==='stairs'){
  current=walkStairs(up?phase:1-phase);
 }else{
  const from=up?connector.bottom:connector.top,to=up?connector.top:connector.bottom;
  const contact=(connector.contact??ladderContact).climb;
  // Do not lerp XY between bottom and top for the WHOLE climb: that makes
  // the guardian drift diagonally away from the fixed wall-mounted ladder.
  // The first/last 15% is a physical approach/top-out; the middle 70%
  // climbs strictly in place on the rail contact line.
  const mount=smooth(clamp(p/.15)),stepOff=smooth(clamp((p-.85)/.15));
  travel=smooth(clamp((p-.15)/.70));
  let x,y;
  if(p<.15){
   x=from.x+(contact.x-from.x)*mount;
   y=from.y+(contact.y-from.y)*mount;
  }else if(p<=.85){
   x=contact.x;y=contact.y;
  }else{
   x=contact.x+(to.x-contact.x)*stepOff;
   y=contact.y+(to.y-contact.y)*stepOff;
  }
  const z=HEIGHT*(up?travel:1-travel);
  // Step backward away from the wall only after releasing both hands.
  const exitTurn=smooth(clamp((p-.88)/.12));
  current={x,y,z,face:connector.face+Math.PI*exitTurn};
 }
 return {x:current.x*48,y:current.y*48,z:current.z,progress:p,
  floor:up?(travel>=.97?1:0):(travel>=.97?0:1),
  angle:connector.kind==='ladder'?current.face:
   current.face+(up?0:Math.PI),
  clip:connector.kind==='ladder'?(up?'climb-up':'climb-down'):'walk',
  landing:p>.82?clamp((p-.82)/.18):0};
}
function createLayers({project,polygon,line,cacheObject,cacheStair=cacheObject,pattern}){
 function tread(ctx,points,z,color,edge){
  const face=points.map(p=>project(p.x,p.y,z));polygon(ctx,face,color,edge);
  if(!pattern)return;
  const [x,y]=project(0,0,z),k=2.4/192,[u,v]=project(k,0,z),[w,h]=project(0,k,z);
  pattern(ctx,'stairFloor',face,[u-x,v-y,w-x,h-y,x,y]);
 }
 function masonry(ctx,a,b,base,z,color,edge){
  const face=[project(a.x,a.y,base),project(b.x,b.y,base),project(b.x,b.y,z),project(a.x,a.y,z)];
  polygon(ctx,face,color,edge);
  if(!pattern)return;
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  if(!len)return;
  const [x,y]=project(a.x,a.y),[u,v]=project(b.x,b.y);
  const along=(a.x*dx+a.y*dy)/len,tx=(u-x)/len,ty=(v-y)/len;
  pattern(ctx,'stairWall',face,[tx*2/192,ty*2/192,0,96/192,x-tx*along,y-ty*along]);
 }
 const batches=new Map();
 for(const str of upper){
  const [u,v]=str.split(',').map(Number),id=key(Math.floor(u/8),Math.floor(v/8));
  if(!batches.has(id))batches.set(id,[]);
  batches.get(id).push([u,v]);
 }
 const slabs=Array.from(batches.values(),cells=>{
  const xs=cells.map(p=>p[0]),ys=cells.map(p=>p[1]);
  const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs)+1,Math.max(...ys)+1];
  return {kind:'upper-deck',level:1,depth:4000,image:cacheStair(bounds,HEIGHT+34,ctx=>{
  const palette=['#687787','#728494','#677785','#788c99'];
  // The upper floor consists of genuine Z-elevated tiles. The cutout matches
  // the actual stair shaft instead of a fictitious hole in a rectangle.
  for(const [u,v] of cells){
   const id=Math.abs((u*23+v*41)%4);
   tread(ctx,[{x:u,y:v},{x:u+1,y:v},{x:u+1,y:v+1},{x:u,y:v+1}],HEIGHT,
    palette[id],'#96a8b4');
   if(!upper.has(key(u+1,v)))
    masonry(ctx,{x:u+1,y:v},{x:u+1,y:v+1},HEIGHT-17,HEIGHT,'#435464','#7b90a0');
   if(!upper.has(key(u,v+1)))
    masonry(ctx,{x:u,y:v+1},{x:u+1,y:v+1},HEIGHT-17,HEIGHT,'#394c5b','#748896');
  }
  })};
 });
 // Static raster art is baked per tread at scene construction, with separate
 // scene depths. It is never re-rasterized when the guardian moves.
 const stairObjects=[];
 const boundsFor=points=>[Math.min(...points.map(p=>p.x)),
  Math.min(...points.map(p=>p.y)),Math.max(...points.map(p=>p.x)),
  Math.max(...points.map(p=>p.y))];
 // Only outward-facing vertical faces can reach this fixed +u/+v camera.
 // Wedges and rectangular landings can have opposite polygon windings.
 function front(corners,i){
  const area=corners.reduce((s,a,k)=>{const b=corners[(k+1)%corners.length];return s+a.x*b.y-b.x*a.y;},0);
  const a=corners[i],b=corners[(i+1)%corners.length];
  return Math.sign(area)*(b.y-a.y-b.x+a.x)>1e-8;
 }
 function drawPrism(ctx,corners,z,base,posts=false){

  for(let i=0;i<corners.length;i++){
   const j=(i+1)%corners.length;
   if(!front(corners,i))continue;
   masonry(ctx,corners[i],corners[j],base,z,
    i%2?'#697788':'#536174','#354352');
  }
  if(posts&&base>5)for(const corner of corners){
   const q=.085,x=corner.x,y=corner.y;
   const pts=[{x:x-q,y:y-q},{x:x+q,y:y-q},
    {x:x+q,y:y+q},{x:x-q,y:y+q}];
   for(let i=0;i<4;i++){
    const j=(i+1)%4;
    if(!front(pts,i))continue;
    masonry(ctx,pts[i],pts[j],0,base,
     i%2?'#586778':'#788798','#424e5c');
   }
   tread(ctx,pts,base,'#adb8bf','#354452');
  }
  tread(ctx,corners,z,'#939ca8','#d4d6db');
 }
 for(const [index,step] of plan.steps.entries()){
  const image=cacheStair(boundsFor(step.corners),HEIGHT+58,ctx=>{
   const [a,b,c,d]=step.corners,z=step.z,prev=step.prev;
   const top=p=>project(p.x,p.y,z),
    baseZ=plan.cfg.open?Math.max(0,z-13):0;
   // Closed flights have stone infill to the floor; open flights have a
   // 13px load-bearing soffit and allow passage under high sections.
   if(front(step.corners,3))masonry(ctx,a,d,baseZ,z,'#485565','#343d4b');
   if(front(step.corners,1))masonry(ctx,b,c,baseZ,z,'#647384','#3e4654');
   if(front(step.corners,0))masonry(ctx,a,b,prev,z,'#555f70','#424a57');
   // At the head of a solid straight flight there is no next tread
   // to conceal the end wall. Its foundation reaches the ground.
   const solidHead=plan.kind.startsWith('straight')&&index===plan.steps.length-1;
   if(front(step.corners,2)&&(plan.cfg.open||solidHead))masonry(ctx,c,d,baseZ,z,'#485565','#343d4b');
   tread(ctx,step.corners,z,
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
  stairObjects.push({kind:'stair-tread',image,level:0,surfaceZ:step.prev,
   depth:project(step.center.x,step.center.y,0)[1]+step.z*.5+.25});
 }
 for(const landing of plan.landings.filter(l=>!l.top)){
  const center=landing.corners.reduce((p,q)=>({x:p.x+q.x/landing.corners.length,
   y:p.y+q.y/landing.corners.length}),{x:0,y:0});
  const image=cacheStair(boundsFor(landing.corners),HEIGHT+58,ctx=>
   drawPrism(ctx,landing.corners,landing.z,
    plan.cfg.open?Math.max(0,landing.z-13):0,plan.cfg.open));
  stairObjects.push({kind:'stair-landing',image,level:0,surfaceZ:landing.z,
   depth:project(center.x,center.y,0)[1]+landing.z*.5+.25});
 }
 for(const post of plan.posts){
  const p=post.p,r=post.radius,
   corners=[{x:p.x-r,y:p.y-r},{x:p.x+r,y:p.y-r},
    {x:p.x+r,y:p.y+r},{x:p.x-r,y:p.y+r}];
  const image=cacheStair(boundsFor(corners),post.z1+20,ctx=>
   drawPrism(ctx,corners,post.z1,0,false));
  stairObjects.push({kind:'stair-spindle',image,level:0,
   depth:project(p.x,p.y,0)[1]+.3});
 }
 const doorFrames=generator.portals.map(door=>{
  const sx=door.dy,sy=-door.dx;
  const at=(offset,z)=>project(door.x+sx*offset,door.y+sy*offset,z);
  const bounds=[door.x-Math.abs(sx)-.15,door.y-Math.abs(sy)-.15,
   door.x+Math.abs(sx)+.15,door.y+Math.abs(sy)+.15];
  const image=cacheObject(bounds,102,ctx=>{
   for(const side of [-1,1]){
    const outer=side*.99,inner=side*.85;
    polygon(ctx,[at(outer,0),at(inner,0),at(inner,82),at(outer,82)],'#796046','#c0a079');
    for(let z=18;z<80;z+=19)line(ctx,[at(outer,z),at(inner,z)],'#4c4037',2);
   }
   polygon(ctx,[at(-1,79),at(1,79),at(1,94),at(-1,94)],'#524339','#c9ab7f');
   const [x,y]=at(0,90);
   ctx.font='bold 11px system-ui';ctx.textAlign='center';
   ctx.lineWidth=3;ctx.strokeStyle='#2c2423';ctx.strokeText(door.name,x,y);
   ctx.fillStyle='#ffe6b6';ctx.fillText(door.name,x,y);
  });
  return {kind:'door-frame',door,level:0,image,depth:at(0,0)[1]+.5};
 });
 const ladderLayers=ladders.map(ladder=>{
 const ladderContact=contactFor(ladder);
 const cell=ladder.cell,ladderArea=ladder.wall==='north'||ladder.wall==='south'?
  [cell[0]+.15,cell[1]-.12,cell[0]+.85,cell[1]+1.12]:
  [cell[0]-.12,cell[1]+.15,cell[0]+1.12,cell[1]+.85];
 const ladderImage=cacheObject(ladderArea,HEIGHT+52,ctx=>{
  const [u,v]=cell;
  // Exactly the same rail coordinates as used to anchor the climber.
  const along=ladderContact.rails.map(p=>[p.x,p.y]);
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
 return {kind:'ladder-3d',connectorId:ladder.id,image:ladderImage,
  depth:project(ladder.bottom.x,ladder.bottom.y)[1]+.25,level:0};
 });
 // Separate upper-only details. They MUST NOT leak into the ground-floor view.
 const descending=prison?connectors.map(link=>{
  const steps=plan.steps.slice(-4);
  const hatch=link.kind==='stairs'?steps.flatMap(s=>s.corners):(()=>{
   const {x,y}=link.bottom;
   return [{x:x-.38,y:y-.38},{x:x+.38,y:y-.38},{x:x+.38,y:y+.38},{x:x-.38,y:y+.38}];
  })();
  const image=cacheStair(boundsFor(hatch),8,ctx=>{
   const openings=link.kind==='stairs'?steps.map(step=>step.corners):[hatch];
   for(const points of openings)polygon(ctx,points.map(p=>project(p.x,p.y,0)),'#252b38','#535b66');
   ctx.save();ctx.beginPath();
   for(const points of openings){
    points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...project(p.x,p.y,0)));
    ctx.closePath();
   }
   ctx.clip();
   if(link.kind==='stairs'){
    for(const step of steps)drawPrism(ctx,step.corners,step.z-HEIGHT,step.prev-HEIGHT);
   }else{
    const rails=link.contact.rails;
    for(const rail of rails)line(ctx,[project(rail.x,rail.y,0),project(rail.x,rail.y,-40)],'#b39169',4);
    for(const z of [-4,-15,-26])line(ctx,rails.map(p=>project(p.x,p.y,z)),'#ba9972',3);
   }
   ctx.restore();
  });
  return {kind:'descending-access',level:0,downId:link.id,image,depth:0};
 }):[];
 return [
  ...descending,...slabs,
  ...stairObjects,...doorFrames,
  ...ladderLayers
 ];
}
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
 plan,state,nav:navigation,length:totalLength,speeds:STAIR_SPEED,curving,walkStairs,alongStairs:targetAlongStairs,speedOnStair,
 canExit:(floor,x,y)=>floor?insideTop(x,y,14/48):
  !blocksGround(x,y,14/48)&&!generator.blocked(x,y,14/48)
});
const boardStairs=(actor,up=true,target=null)=>hasStairs()&&stairController.board(actor,up,target);
const aimStairs=part=>stairController.aim(part);
const tryEnterStairs=(actor,dx,dy)=>hasStairs()&&stairController.enter(actor,dx,dy);
const advanceStairs=(actor,dt,speed,dx=0,dy=0,options=null)=>
 stairController.advance(actor,dt,speed,dx,dy,options);
const api={enabled:true,height:HEIGHT,roomId:room.id,room,stairs,plan,ladder,ladderContact,upper,
 get connectors(){return active();},connectorsAt,hasStairs,state,insideTop,playerInChamber,nearby,pose,createLayers,stairLength:totalLength,
 navigation,
 overStair,blocksGround,blocksTop,pickStair,speedOnStair,stairSpeed:STAIR_SPEED,
 boardStairs,aimStairs,targetAlongStairs,tryEnterStairs,advanceStairs};
return api;
}
const primary=buildFlight(0,null);
if(!prison){window.AlleyVertical=primary;return;}
const flights=[primary,buildFlight(1,primary)];
const flightAt=i=>flights[(i%2+2)%2];
const current=()=>flightAt(prison.storey-1);
const shared={
 state,
 previousStairEntry(actor,dx,dy){
  if(prison.storey<2||state.floor||state.transition||state.pending||state.stairRide)return false;
  const index=prison.storey-2,flight=flightAt(index);
  if(distance({x:actor.x/48,y:actor.y/48},flight.plan.top)>flight.plan.width*.5+1)return false;
  state.floor=1;state.z=HEIGHT;
  let entered=false;
  try{entered=prison.atStorey(index+1,()=>flight.tryEnterStairs(actor,dx,dy));}
  finally{if(!entered){state.floor=0;state.z=0;}}
  return entered;
 },
 inMouth(link,x,y,z){
  if(link.kind==='ladder')return z>=HEIGHT-35;
  return z>=link.mouth[0].prev-.01&&(distance({x,y},link.top)<.6||
   link.mouth.some(step=>insideConvex({x,y},step.corners)));
 },
 connectorsAt:i=>i<0?[]:flightAt(i).connectorsAt(i),
 pose:(link,...args)=>flights[link.flight??0].pose(link,...args),
 createLayers:painter=>flights.flatMap((flight,i)=>flight.createLayers(painter)
  .filter(p=>i===0||!p.door).map(p=>({...p,flight:i})))
};
window.AlleyVertical=new Proxy(shared,{get:(self,key)=>key in self?self[key]:current()[key]});
})();

