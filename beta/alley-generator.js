(() => {
'use strict';
const query=new URLSearchParams(window.location.search);
if(query.get('szene')!=='gasse'||query.get('modus')!=='generator'){
 window.AlleyGenerator={enabled:false};return;
}
const input=Number(query.get('seed'));
const seed=Number.isSafeInteger(input)&&input>=0?input>>>0:4147;
const key=(x,y)=>x+','+y;
const edge=(a,b)=>[key(...a),key(...b)].sort().join('|');
const dirs=[[1,0,'east'],[-1,0,'west'],[0,1,'south'],[0,-1,'north']];
const rgen=n=>()=>{n=(n+0x6d2b79f5)>>>0;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
const between=(rnd,a,b)=>a+Math.floor(rnd()*(b-a+1));
const pick=(rnd,arr)=>arr[Math.floor(rnd()*arr.length)];
const has=(arr,x,y)=>arr.some(p=>p[0]===x&&p[1]===y);
function connected(mask){
 const known=new Set([key(...mask[0])]),queue=[mask[0]];
 for(let i=0;i<queue.length;i++)for(const [dx,dy] of dirs){
  const a=queue[i],x=a[0]+dx,y=a[1]+dy;
  if(has(mask,x,y)&&!known.has(key(x,y))){queue.push([x,y]);known.add(key(x,y));}
 }
 return known.size===mask.length;
}
function makeShape(rnd,kind,dx){
 const len=between(rnd,4,8),wide=between(rnd,1,3);
 const w=kind==='gang'?(dx?len:wide):between(rnd,4,8);
 const h=kind==='gang'?(dx?wide:len):between(rnd,4,7);
 const style=kind==='gang'?pick(rnd,['gerade','gerade','versatz','bucht']):
  pick(rnd,['L-form','Eckabschnitt','Abstufung','Nische','Saal','Doppelnische']);
 const mask=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let omit=false;
  if(kind==='gang'){
   if(style==='versatz'&&dx&&h>=2)omit=(x<w/2&&y===h-1)||(x>=w/2&&y===0);
   if(style==='versatz'&&!dx&&w>=2)omit=(y<h/2&&x===w-1)||(y>=h/2&&x===0);
   if(style==='bucht'&&dx&&h>=2)omit=(x<2||x>w-3)&&y===h-1;
   if(style==='bucht'&&!dx&&w>=2)omit=(y<2||y>h-3)&&x===w-1;
  }else{
   if(style==='L-form')omit=x>=w-2&&y<h-2;
   if(style==='Eckabschnitt')omit=(x===0&&y===h-1)||(x===w-1&&y===0);
   if(style==='Abstufung')omit=(x===0&&y<h-2)||(x===w-1&&y>1);
   if(style==='Nische')omit=x<2&&y<h-2;
   if(style==='Doppelnische')omit=(x===0||x===w-1)&&y<h-2;
  }
  if(!omit)mask.push([x,y]);
 }
 return connected(mask)?{mask,kind,style,w,h}:null;
}
function generate(n){
 const rnd=rgen(n),occ=new Map();
 const start={id:0,kind:'start',style:'Gasse',cells:[[11,3],[11,4],[11,5],[11,6]],exits:[],level:0};
 const rooms=[start],doors=[];
 for(const p of start.cells)occ.set(key(...p),0);
 const len=between(rnd,3,6),width=between(rnd,2,3),y0=width===2?4:3,first=[];
 for(let x=12;x<12+len;x++)for(let y=y0;y<y0+width;y++)first.push([x,y]);
 const passage={id:1,kind:'gang',style:width===2?'schmal':'breit',cells:first,parent:0,exits:[],level:0};
 first.forEach(p=>occ.set(key(...p),1));rooms.push(passage);
 const door={from:0,to:1,edges:[[[11,4],[12,4]]],side:'east'};
 if(width===3)door.edges.push([[11,5],[12,5]]);
 doors.push(door);start.exits.push(door);passage.exits.push(door);
 for(let id=2;id<10;id++){
  let accepted=false;
  for(let trial=0;trial<1600&&!accepted;trial++){
   const parents=rooms.slice(1).filter(p=>p.exits.length<(p.kind==='gang'?3:4));
   if(!parents.length)break;
   const parent=pick(rnd,parents),anchor=pick(rnd,parent.cells),d=pick(rnd,dirs);
   const [dx,dy,side]=d,neighbor=[anchor[0]+dx,anchor[1]+dy];
   if(occ.has(key(...neighbor)))continue;
   const kind=rooms.filter(p=>p.kind==='gang').length>=5?'raum':
    ([3,7].includes(id)||rnd()<.17?'gang':'raum');
   const shape=makeShape(rnd,kind,dx);if(!shape)continue;
   const border=shape.mask.filter(([x,y])=>!has(shape.mask,x-dx,y-dy));
   const touching=pick(rnd,border),ox=neighbor[0]-touching[0],oy=neighbor[1]-touching[1];
   const cells=shape.mask.map(([x,y])=>[x+ox,y+oy]);
   if(cells.some(([x,y])=>x<12||x>37||y< -9||y>17||occ.has(key(x,y))))continue;
   let collision=false;
   for(const [x,y] of cells){
    for(const [sx,sy] of dirs){
     const other=occ.get(key(x+sx,y+sy));
     if(other!==undefined&&other!==parent.id){collision=true;break;}
    }
    if(collision)break;
   }
   if(collision)continue;
   const connection={from:parent.id,to:id,edges:[[anchor,neighbor]],side};
   if(rnd()<.38)for(const sign of [-1,1]){
    const sx=dx?0:sign,sy=dx?sign:0;
    const a=[anchor[0]+sx,anchor[1]+sy],b=[neighbor[0]+sx,neighbor[1]+sy];
    if(occ.get(key(...a))===parent.id&&has(cells,...b)){
     connection.edges.push([a,b]);break;
    }
   }
   const room={id,kind,style:shape.style,cells,parent:parent.id,exits:[connection],level:0};
   rooms.push(room);parent.exits.push(connection);doors.push(connection);
   cells.forEach(p=>occ.set(key(...p),id));accepted=true;
  }
  if(!accepted)return null;
 }
 // Grow every generated room by 2x in each ground-plane dimension, including
 // the corridor footprints. The starter alley keeps its established scale.
 // Transform doors as *edges*, not just their centre points: every expanded
 // portal spans at least two full cells so the guardian can pass comfortably.
 const unit=2,expand=([x,y])=>[12+(x-12)*unit,4+(y-y0)*unit];
 const largerCells=cell=>{const [x,y]=expand(cell);return [
  [x,y],[x+1,y],[x,y+1],[x+1,y+1]
 ];};
 const expandedOccupancy=new Map(start.cells.map(p=>[key(...p),0]));
 for(const room of rooms.slice(1)){
  room.cells=room.cells.flatMap(largerCells);
  for(const cell of room.cells)expandedOccupancy.set(key(...cell),room.id);
 }
 for(const portal of doors){
  if(portal.from===0){
   portal.edges=[[[11,4],[12,4]],[[11,5],[12,5]]];continue;
  }
  portal.edges=portal.edges.flatMap(([a,b])=>{
   const [ax,ay]=expand(a),[bx,by]=expand(b),dx=b[0]-a[0],dy=b[1]-a[1];
   if(dx===1)return [0,1].map(j=>[[ax+1,ay+j],[bx,by+j]]);
   if(dx===-1)return [0,1].map(j=>[[ax,ay+j],[bx+1,by+j]]);
   if(dy===1)return [0,1].map(j=>[[ax+j,ay+1],[bx+j,by]]);
   return [0,1].map(j=>[[ax+j,ay],[bx+j,by+1]]);
  });
 }
 return {rooms,doors,occ:expandedOccupancy};
}
let result=null,actualSeed=seed;
for(let i=0;i<15&&!result;i++){actualSeed=(seed+i*7919)>>>0;result=generate(actualSeed);}
if(!result)throw Error('Generator: kein zusammenhängender 10-Raum-Grundriss möglich');
const {rooms,doors,occ}=result;
const openings=new Set(doors.flatMap(p=>p.edges.map(([a,b])=>edge(a,b))));
// The first two-cell threshold already leads from the street into the building.
const entrance={name:'Eingang',roomId:1,x:12,y:5,dx:-1,dy:0};
const depths=[0];
for(const room of rooms.slice(1))depths[room.id]=depths[room.parent]+1;
const exteriorCandidates=[];
for(const room of rooms.filter(room=>room.kind==='raum')){
 for(const [x,y] of room.cells)for(const [dx,dy] of dirs){
  const sx=dy?1:0,sy=dx?1:0;
  if(occ.get(key(x+sx,y+sy))!==room.id)continue;
  const cells=[];
  for(let side=0;side<2;side++)for(let step=1;step<=2;step++)
   cells.push([x+side*sx+step*dx,y+side*sy+step*dy]);
  if(cells.some(([u,v])=>u<13||occ.has(key(u,v))))continue;
  const distance=Math.hypot(x-entrance.x,y-entrance.y);
  exteriorCandidates.push({roomId:room.id,x:x+.5+(sx+dx)/2,y:y+.5+(sy+dy)/2,
   dx,dy,cells,score:depths[room.id]*100+distance,
   edges:[[[x,y],[x+dx,y+dy]],[[x+sx,y+sy],[x+sx+dx,y+sy+dy]]]});
 }
}
exteriorCandidates.sort((a,b)=>b.score-a.score);
const exit=exteriorCandidates[0];
if(!exit)throw Error('Kein freier Außenwandabschnitt für den Ausgang');
exit.name='Ausgang';
const exterior=new Set(exit.cells.map(cell=>key(...cell)));
for(const [a,b] of exit.edges)openings.add(edge(a,b));
const portals=[entrance,exit];
const segments=[];
for(const room of rooms.slice(1))for(const [x,y] of room.cells)for(const [dx,dy,side] of dirs){
 const nx=x+dx,ny=y+dy,other=occ.get(key(nx,ny));
 if(other===room.id||openings.has(edge([x,y],[nx,ny])))continue;
 if(other>0&&room.id>other)continue; // one partition, not overlapping duplicates
 const axis=dx?'u':'v',p=dx?x+(dx>0?1:0):y+(dy>0?1:0),start=dx?y:x;
 // All partitions in one contiguous building share the SAME cut height.
 // Their location (not a random height offset) establishes front/back order.
 segments.push({axis,p,start,end:start+1,room:room.id,side,
  height:96,tone:['grey-a','grey-b','grey-c'][room.id%3]});
}
segments.sort((a,b)=>a.room-b.room||a.axis.localeCompare(b.axis)||a.p-b.p||a.side.localeCompare(b.side)||a.start-b.start);
const groups=[];
for(const segment of segments){
 const last=groups[groups.length-1];
 if(last&&last.room===segment.room&&last.axis===segment.axis&&last.p===segment.p&&
  last.side===segment.side&&last.end===segment.start){last.end=segment.end;continue;}
 groups.push({...segment});
}
const th=.075;
const rect=g=>g.axis==='u'?[g.p-th,g.start,g.p+th,g.end]:[g.start,g.p-th,g.end,g.p+th];
const walls=groups.map(g=>({...g,area:rect(g)}));
const wallBlocks=segments.map(rect);
// Spatial hash: testing a nearby wall costs O(local wall segments), not O(all walls).
// The key covers the wall footprint and neighbouring cells for hero-radius checks.
const wallIndex=new Map();
for(const area of wallBlocks){
 for(let x=Math.floor(area[0]-1);x<=Math.ceil(area[2]+1);x++)
  for(let y=Math.floor(area[1]-1);y<=Math.ceil(area[3]+1);y++){
   const cell=key(x,y),batch=wallIndex.get(cell)||[];
   batch.push(area);wallIndex.set(cell,batch);
  }
}
const materials={
 'grey-a':{pitch:[.59,.53],colors:['#606575','#687082','#727585','#565f72'],edge:'#a0a6b1a8'},
 'grey-b':{pitch:[.46,.55],colors:['#5b6470','#68717a','#596977','#737985'],edge:'#9caeb2a8'},
 'grey-c':{pitch:[.54,.44],colors:['#666378','#5d6279','#777186','#555b6f'],edge:'#b4a7b2a8'}
};
let stairs=null;
for(const room of rooms.slice(2).reverse()){
 if(room.kind!=='raum'||room.cells.length<14)continue;
 for(const [x,y] of room.cells){
  const patch=[];
  for(let dx=0;dx<2;dx++)for(let dy=0;dy<3;dy++)patch.push([x+dx,y+dy]);
  if(!patch.every(p=>has(room.cells,...p)))continue;
  if(doors.some(d=>d.edges.some(pair=>pair.some(([u,v])=>Math.abs(u-x-1)<2.1&&Math.abs(v-y-1.5)<2.4))))continue;
  stairs={roomId:room.id,area:[x,y,x+2,y+3],levelFrom:0,levelTo:1,reserved:true};break;
 }
 if(stairs)break;
}
// Fallback: a landing is mandatory. Pick the best 2x3 footprint even when an
// entrance is nearby; it remains reserved for a later vertical traversal system.
if(!stairs){
 for(const room of rooms.slice(2).sort((a,b)=>b.cells.length-a.cells.length)){
  for(const [x,y] of room.cells){
   if(!Array.from({length:6},(_,i)=>[x+i%2,y+Math.floor(i/2)])
    .every(p=>has(room.cells,...p)))continue;
   stairs={roomId:room.id,area:[x,y,x+2,y+3],levelFrom:0,levelTo:1,reserved:true};
   break;
  }
  if(stairs)break;
 }
}
// Interior partitions are real structural walls, not randomly placed obstacles.
// Each spans between two external boundaries; a one-cell doorway is cut into it.
const innerWalls=[];
for(const room of rooms.filter(p=>p.kind==='raum').sort((a,b)=>b.cells.length-a.cells.length)){
 if(innerWalls.length>=4)break; // Two split chambers, two wall wings each.
 const xs=room.cells.map(p=>p[0]),ys=room.cells.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 if(maxX-minX<3||maxY-minY<3)continue;
 let chosen=null;
 for(let seam=minX+2;seam<=maxX-1;seam++){
  const full=Array.from({length:maxY-minY+1},(_,i)=>minY+i).every(y=>
   has(room.cells,seam-1,y)&&has(room.cells,seam,y));
  if(!full)continue;
  if(stairs?.roomId===room.id&&seam>stairs.area[0]&&seam<stairs.area[2])continue;
  chosen=seam;break;
 }
 if(chosen===null)continue;
 const opening=minY+Math.floor((maxY-minY)/2);
 for(const [a,b] of [[minY,opening],[opening+1,maxY+1]]){
  if(b<=a)continue;
  const wall={axis:'u',p:chosen,start:a,end:b,room:room.id,side:'west',
   height:96,tone:['grey-a','grey-b','grey-c'][room.id%3],interior:true};
  wall.area=rect(wall);walls.push(wall);wallBlocks.push(wall.area);innerWalls.push(wall);
  for(let x=Math.floor(wall.area[0]-1);x<=Math.ceil(wall.area[2]+1);x++)
   for(let y=Math.floor(wall.area[1]-1);y<=Math.ceil(wall.area[3]+1);y++){
    const k=key(x,y),list=wallIndex.get(k)||[];list.push(wall.area);wallIndex.set(k,list);
   }
 }
}
const depth=Math.max(1,Math.min(12,Number(query.get('tiefe'))||1));
const programRng=rgen(actualSeed^(depth*2654435761));
const uses=['Studierzimmer','Waffenkammer','Werkstatt','Versuchszimmer','Wachraum','Ruhekammer','Lagerraum'];
const useCounts=new Map();
for(const room of rooms){
 if(room.id===0){room.plannedUse='Startgasse';continue;}
 if(room.kind==='gang'){room.plannedUse='Verbindungsgang';continue;}
 const choices=uses.filter(type=>(useCounts.get(type)||0)<2);
 const roll=programRng();
 const weighted=choices.filter(type=>depth>=3||!['Wachraum','Versuchszimmer'].includes(type));
 const pool=weighted.length?weighted:choices;
 room.plannedUse=pool[Math.floor(roll*pool.length)]||'Studierzimmer';
 useCounts.set(room.plannedUse,(useCounts.get(room.plannedUse)||0)+1);
}

const metadata={seed:actualSeed,requestedSeed:seed,rooms:rooms.length,
 corridors:rooms.filter(p=>p.kind==='gang').length,doors:doors.length,
 interiorWalls:innerWalls.length,stairs:stairs?[stairs]:[],depth,roomLinearScale:2,wallCutHeight:96};
function extend(map){
 for(const [x,y] of exit.cells){
  const area=[x,y,x+1,y+1];
  map.logic.walkable.push(area);
  map.art.ground.push({area,material:'court'});
 }
 const strips=new Map();
 for(const room of rooms.slice(1))for(const [x,y] of room.cells){
  const name=room.id+':'+y,values=strips.get(name)||[];values.push(x);strips.set(name,values);
  map.logic.walkable.push([x,y,x+1,y+1]);
 }
 for(const [id,xs] of strips){
  const [room,y]=id.split(':').map(Number),sorted=xs.sort((a,b)=>a-b);
  let start=sorted[0],end=start;
  for(let i=1;i<=sorted.length;i++){
   if(i<sorted.length&&sorted[i]===end+1){end=sorted[i];continue;}
   map.art.ground.push({area:[start,y,end+1,y+1],material:['grey-a','grey-b','grey-c'][room%3]});
   if(i<sorted.length)start=end=sorted[i];
  }
 }
 for(const door of doors)for(const [a,b] of door.edges)
  map.logic.waypoints.push([(a[0]+b[0]+1)/2,(a[1]+b[1]+1)/2]);
 map.art.routeWalls=walls;
}
function blocked(u,v,r=0){
 return (wallIndex.get(key(Math.floor(u),Math.floor(v)))||[]).some(([a,b,c,d])=>
  u+r>a&&u-r<c&&v+r>b&&v-r<d);
}
const alleyGround=[[1,2.75,12,6.85],[4.5,6.8,8.1,9.4],[9.5,.8,12,2.75]];
function containsGround(u,v){
 return exterior.has(key(Math.floor(u),Math.floor(v)))||occ.has(key(Math.floor(u),Math.floor(v)))||
  alleyGround.some(([a,b,c,d])=>u>=a&&u<=c&&v>=b&&v<=d);
}
function areaAt(u,v){
 const cell=key(Math.floor(u),Math.floor(v));
 if(exterior.has(cell))return 'Draußen · Hinterausgang';
 const id=occ.get(cell);
 if(id===undefined||id===0)return 'Gasse · Startraum';
 const room=rooms[id];
 return String(id+1).padStart(2,'0')+' / 10 · '+(room.kind==='gang'?'Gang':'Raum')+' · '+room.style;
}
function renderFloor(ctx,{project,polygon,line}){
 for(const room of rooms.slice(1)){
  const [u,v]=room.cells.reduce((a,b)=>[a[0]+b[0],a[1]+b[1]],[0,0]).map(t=>t/room.cells.length);
  const [x,y]=project(u+.5,v+.5);
  ctx.save();ctx.font='bold 16px system-ui';ctx.textAlign='center';
  ctx.fillStyle='#dfd4c4';ctx.fillText(String(room.id+1).padStart(2,'0'),x,y);
  ctx.font='10px system-ui';ctx.fillStyle='#ddd3d4';
  ctx.fillText(room.kind==='gang'?'GANG':room.style.toUpperCase(),x,y+14);ctx.restore();
 }
 for(const door of doors)for(const [a,b] of door.edges){
  const u=(a[0]+b[0]+1)/2,v=(a[1]+b[1]+1)/2,du=a[0]!==b[0]?.13:.4,dv=a[1]!==b[1]?.13:.4;
  polygon(ctx,[project(u-du,v-dv),project(u+du,v-dv),project(u+du,v+dv),project(u-du,v+dv)],
   '#ad9b8a87','#dcc8aa');
 }
 if(stairs&&!window.AlleyVertical?.enabled){
  const [u,v,r,b]=stairs.area;
  polygon(ctx,[project(u,v),project(r,v),project(r,b),project(u,b)],'#4d5368','#b5b9c6');
  for(let i=0;i<7;i++){
   const at=v+(b-v)*i/7,z=i*4.8;
   polygon(ctx,[project(u,at,z),project(r,at,z),project(r,at+(b-v)/8,z),project(u,at+(b-v)/8,z)],
    i%2?'#8b91a5':'#757f96','#c3bbc9');
  }
  const [x,y]=project(u+1,v+1.4,19);
  ctx.save();ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffe4bb';
  ctx.fillText('↑ 1. ETAGE',x,y);ctx.restore();
 }
}
function renderWall(ctx,wall,{project,polygon,line}){
 const [u,v,r,b]=wall.area,{height,side,tone}=wall;
 const palette=tone==='grey-a'?['#5e6475','#424a5d','#82889c']:
  tone==='grey-b'?['#586874','#3d4d5b','#8499a2']:['#655f73','#454059','#998f9e'];
 const lower=[project(u,v),project(r,v),project(r,b),project(u,b)];
 const top=[project(u,v,height),project(r,v,height),project(r,b,height),project(u,b,height)];
 polygon(ctx,[lower[1],lower[2],top[2],top[1]],palette[0],'#343446');
 polygon(ctx,[lower[2],lower[3],top[3],top[2]],palette[1],'#343446');
 polygon(ctx,top,palette[2],'#b6aeba');
 line(ctx,[top[0],top[1],top[2],top[3]],'#c6b6c6',1.3);
 if(side==='south'||side==='east')return;
 const along=wall.axis==='u'?[[u,v],[u,b]]:[[u,v],[r,v]];
 for(let z=18;z<height;z+=22)line(ctx,along.map(p=>project(...p,z)),'#29283a9b',1.2);
}
// One deterministic navigation graph per generated floor and collision
// model. Geometry is baked once, before gameplay, not rebuilt on each click.
const navigation=new Map(),NAV_TILE=48;
function lineClear(a,b,canWalk){
 const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/4));
 for(let i=1;i<=n;i++)
  if(!canWalk(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return false;
 return true;
}
function prewarm(canWalk,floor=0){
 const found=navigation.get(floor);
 if(found&&found.canWalk===canWalk)return found;
 const cells=new Map();
 for(const [u,v,r,b] of window.AlleyStudyMap.logic.walkable)
  for(let x=Math.floor(u);x<Math.ceil(r);x++)
   for(let y=Math.floor(v);y<Math.ceil(b);y++){
    const p={x:(x+.5)*NAV_TILE,y:(y+.5)*NAV_TILE,gx:x,gy:y};
    if(canWalk(p.x,p.y))cells.set(key(x,y),p);
   }
 // Precompute obstacle-safe edges. A click now only solves an A* traversal
 // through already verified neighbors; it does not redo collision sampling.
 for(const p of cells.values()){
  p.links=[];
  for(const [dx,dy] of dirs){
   const other=cells.get(key(p.gx+dx,p.gy+dy));
   if(other&&lineClear(p,other,canWalk))p.links.push(other);
  }
 }
 const graph={cells,nodes:[...cells.values()],canWalk};
 navigation.set(floor,graph);
 return graph;
}
function path(from,target,canWalk,floorOverride=null){
 const stairState=window.AlleyVertical?.state,
  floor=floorOverride??(stairState?.floor===1?1:stairState?.crouching?'0-crouch':0),
  {nodes}=prewarm(canWalk,floor);
 const goal={x:target.x,y:target.y};
 if(!canWalk(goal.x,goal.y))return null;
 if(lineClear(from,goal,canWalk))return {goal,steps:[goal]};
 // Only test the closest few candidates, not every reachable tile against
 // both origin and destination on every right click.
 const closest=p=>nodes.map(q=>({node:q,d:(q.x-p.x)**2+(q.y-p.y)**2}))
  .sort((a,b)=>a.d-b.d).slice(0,40)
  .filter(q=>lineClear(p,q.node,canWalk)).slice(0,6).map(q=>q.node);
 const starts=closest(from),ends=closest(goal);
 if(!starts.length||!ends.length)return null;
 const goalIds=new Set(ends.map(p=>key(p.gx,p.gy))),
  open=[],dist=new Map(),prev=new Map();
 const heuristic=p=>Math.hypot(goal.x-p.x,goal.y-p.y);
 const push=(node,g)=>{
  const id=key(node.gx,node.gy);
  if(g>=(dist.get(id)??Infinity))return;
  dist.set(id,g);open.push({node,id,g,f:g+heuristic(node)});
 };
 for(const node of starts){
  prev.set(key(node.gx,node.gy),null);
  push(node,Math.hypot(node.x-from.x,node.y-from.y));
 }
 let found=null;
 while(open.length){
  // For a small ten-room navmesh a linear minimum extraction is cheaper
  // than sorting the entire frontier on every expanded node.
  let best=0;
  for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
  const current=open.splice(best,1)[0];
  if(current.g>(dist.get(current.id)??Infinity)+1e-6)continue;
  if(goalIds.has(current.id)){found=current.id;break;}
  for(const other of current.node.links){
   const id=key(other.gx,other.gy),g=current.g+NAV_TILE;
   if(g>=(dist.get(id)??Infinity))continue;
   prev.set(id,current.id);push(other,g);
  }
 }
 if(!found)return null;
 const graph=navigation.get(floor).cells,ordered=[];
 for(let id=found;id!=null;id=prev.get(id))ordered.push(graph.get(id));
 ordered.reverse();
 const points=[from,...ordered,goal],steps=[];
 let i=0;
 while(i<points.length-1){
  let far=i+1;
  for(let j=points.length-1;j>far;j--)
   if(lineClear(points[i],points[j],canWalk)){far=j;break;}
  steps.push({x:points[far].x,y:points[far].y});i=far;
 }
 return {goal,steps};
}
const generator={
 enabled:true,seed:actualSeed,requestedSeed:seed,rooms,doors,walls,portals,containsGround,
 stairs:stairs?[stairs]:[],materials,metadata,seal:null,
 extend,blocked,areaAt,renderFloor,renderWall,
 renderSeal(){},renderProp(){},unlock(){},isUnlocked(){return true;},path,prewarm
};
generator.extend(window.AlleyStudyMap);
window.AlleyGenerator=generator;
})();