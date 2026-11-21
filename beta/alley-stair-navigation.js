(() => {
'use strict';
// 2.5-D stair navmesh: each tread, flat landing and end apron is a walkable
// convex polygon. The player's (u,v) is free; z is sampled from the surface.
const EPS=1e-7,TAU=Math.PI*2,GRID=.18,RADIUS=.29,CLEARANCE=.035;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const center=pts=>({x:pts.reduce((n,p)=>n+p.x,0)/pts.length,
 y:pts.reduce((n,p)=>n+p.y,0)/pts.length});
function make(plan){
 const first=plan.steps[0],last=plan.steps.at(-1);
 function apron(edge,goal,id,z){
  const c=center(edge),d={x:goal.x-c.x,y:goal.y-c.y},
   len=Math.hypot(d.x,d.y)||1,stretch={x:d.x+d.x/len*.4,y:d.y+d.y/len*.4};
  return {kind:id,id,corners:[edge[0],edge[1],
   {x:edge[1].x+stretch.x,y:edge[1].y+stretch.y},
   {x:edge[0].x+stretch.x,y:edge[0].y+stretch.y}],z,prev:z};
 }
 const pieces=[
  apron(first.start,plan.bottom,'bottom',0),
  ...plan.steps.map((p,i)=>({...p,id:'step-'+i,kind:'tread'})),
  ...plan.landings.map((p,i)=>({...p,id:'landing-'+i,kind:'landing'})),
  apron(last.end,plan.top,'top',plan.height)
 ].map((p,i)=>({...p,index:i,bounds:{
  x0:Math.min(...p.corners.map(v=>v.x)),x1:Math.max(...p.corners.map(v=>v.x)),
  y0:Math.min(...p.corners.map(v=>v.y)),y1:Math.max(...p.corners.map(v=>v.y))
 }}));
 function inPoly(p,obj){
  const pts=obj.corners,b=obj.bounds??{
   x0:Math.min(...pts.map(v=>v.x)),x1:Math.max(...pts.map(v=>v.x)),
   y0:Math.min(...pts.map(v=>v.y)),y1:Math.max(...pts.map(v=>v.y))
  };
  if(p.x<b.x0-EPS||p.x>b.x1+EPS||p.y<b.y0-EPS||p.y>b.y1+EPS)return false;
  let positive=false,negative=false;
  for(let i=0;i<pts.length;i++){
   const a=pts[i],z=pts[(i+1)%pts.length];
   const cross=(z.x-a.x)*(p.y-a.y)-(z.y-a.y)*(p.x-a.x);
   if(cross>EPS)positive=true;
   if(cross< -EPS)negative=true;
   if(positive&&negative)return false;
  }
  return true;
 }
 function contains(p){return pieces.some(piece=>inPoly(p,piece));}
 const r=RADIUS+CLEARANCE,probe=Array.from({length:12},(_,i)=>({
  x:Math.cos(i*TAU/12)*r,y:Math.sin(i*TAU/12)*r
 }));
 function canStand(p){
  if(!contains(p))return false;
  for(const d of probe)if(!contains({x:p.x+d.x,y:p.y+d.y}))return false;
  return true;
 }
 function surface(p,previousZ=null){
  const all=pieces.filter(piece=>inPoly(p,piece));
  if(!all.length)return null;
  const height=part=>{
   if(part.kind!=='tread')return part.z;
   const a=center(part.start),b=center(part.end),
    dx=b.x-a.x,dy=b.y-a.y,
    t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1));
   return part.prev+(part.z-part.prev)*t;
  };
  let pick=all[0],z=height(pick);
  if(previousZ!==null){
   let best=Math.abs(z-previousZ);
   for(let i=1;i<all.length;i++){
    const value=height(all[i]),score=Math.abs(value-previousZ);
    if(score<best-1e-6){best=score;pick=all[i];z=value;}
   }
  }else{
   const tread=all.find(p=>p.kind==='tread');
   if(tread){pick=tread;z=height(tread);}
  }
  return {part:pick,z};
 }
 const bbox={
  x0:Math.min(...pieces.map(p=>p.bounds.x0))-r,
  x1:Math.max(...pieces.map(p=>p.bounds.x1))+r,
  y0:Math.min(...pieces.map(p=>p.bounds.y0))-r,
  y1:Math.max(...pieces.map(p=>p.bounds.y1))+r
 };
 const nodes=[],nodeByCell=new Map();
 const key=(x,y)=>x+','+y;
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
 function clear(a,b){
  const d=dist(a,b),n=Math.max(1,Math.ceil(d/.08));
  for(let i=1;i<=n;i++){
   const f=i/n;
   if(!canStand({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f}))return false;
  }
  return true;
 }
 for(let ix=Math.floor(bbox.x0/GRID);ix<=Math.ceil(bbox.x1/GRID);ix++)
  for(let iy=Math.floor(bbox.y0/GRID);iy<=Math.ceil(bbox.y1/GRID);iy++){
   const p={x:ix*GRID,y:iy*GRID};
   if(canStand(p)){
    const node={...p,ix,iy,index:nodes.length,edges:[]};
    nodes.push(node);nodeByCell.set(key(ix,iy),node);
   }
  }
 for(const a of nodes)for(const [dx,dy] of dirs){
  const b=nodeByCell.get(key(a.ix+dx,a.iy+dy));
  if(b&&canStand({x:(a.x+b.x)/2,y:(a.y+b.y)/2}))
   a.edges.push({to:b.index,cost:Math.hypot(dx,dy)*GRID});
 }
 function nearest(point,restrict=null){
  let best=null,d2=Infinity;
  for(const n of nodes){
   if(restrict&&!inPoly(n,restrict))continue;
   const d=(n.x-point.x)**2+(n.y-point.y)**2;
   if(d<d2){best=n;d2=d;}
  }
  return best;
 }
 function legalTarget(pos,part=null){
  if(canStand(pos))return {x:pos.x,y:pos.y};
  const node=nearest(pos,part)||nearest(pos);
  return node?{x:node.x,y:node.y}:null;
 }
 // A* on a baked, radius-safe eight-connected grid; smoothed only through
 // collision-checked straight segments to approach the shortest safe path.
 function route(start,target){
  if(!nodes.length)return null;
  const from=legalTarget(start),to=legalTarget(target);
  if(!from||!to)return null;
  if(clear(from,to))return [to];
  const a=nearest(from),b=nearest(to);
  if(!a||!b)return null;
  const scores=new Float64Array(nodes.length).fill(Infinity),
   parents=new Int32Array(nodes.length).fill(-1),closed=new Uint8Array(nodes.length);
  const heap=[];
  const push=(id,priority)=>{
   let i=heap.length;heap.push({id,priority});
   while(i>0){const j=(i-1)>>1;if(heap[j].priority<=priority)break;
    heap[i]=heap[j];i=j;}heap[i]={id,priority};
  };
  const pop=()=>{
   const root=heap[0],tail=heap.pop();
   if(heap.length){
    let i=0;
    while(i*2+1<heap.length){
     let child=i*2+1;
     if(child+1<heap.length&&heap[child+1].priority<heap[child].priority)child++;
     if(heap[child].priority>=tail.priority)break;
     heap[i]=heap[child];i=child;
    }
    heap[i]=tail;
   }
   return root;
  };
  scores[a.index]=0;push(a.index,dist(a,b));
  while(heap.length){
   const current=pop().id;if(closed[current])continue;
   if(current===b.index)break;
   closed[current]=1;
   for(const edge of nodes[current].edges){
    if(closed[edge.to])continue;
    const g=scores[current]+edge.cost;
    if(g<scores[edge.to]-1e-8){
     scores[edge.to]=g;parents[edge.to]=current;
     push(edge.to,g+dist(nodes[edge.to],b));
    }
   }
  }
  if(!Number.isFinite(scores[b.index]))return null;
  const raw=[to],stack=[];
  for(let id=b.index;id!==a.index;id=parents[id]){
   if(id<0)return null;
   stack.push(nodes[id]);
  }
  stack.push(a);
  stack.reverse();
  raw.unshift(...stack);
  raw.unshift(from);
  const result=[],dedup=[];
  for(const p of raw){
   if(!dedup.length||dist(dedup.at(-1),p)>.03)dedup.push({x:p.x,y:p.y});
  }
  let i=0;
  while(i<dedup.length-1){
   let j=dedup.length-1;
   while(j>i+1&&!clear(dedup[i],dedup[j]))j--;
   result.push(dedup[j]);i=j;
  }
  return result;
 }
 // No physics body can cross the boundary. Move in small substeps and slide
 // along valid facets rather than forcing the actor onto the centreline.
 function move(start,dx,dy){
  let pos={x:start.x,y:start.y},distanceTotal=Math.hypot(dx,dy);
  const count=Math.max(1,Math.ceil(distanceTotal/.075));
  for(let step=0;step<count;step++){
   const mx=dx/count,my=dy/count,next={x:pos.x+mx,y:pos.y+my};
   if(canStand(next)){pos=next;continue;}
   const options=[{x:pos.x+mx,y:pos.y},{x:pos.x,y:pos.y+my}];
   // Slide along local boundary directions for diagonally oriented flights.
   const current=pieces.find(p=>inPoly(pos,p));
   if(current)for(let i=0;i<current.corners.length;i++){
    const a=current.corners[i],b=current.corners[(i+1)%current.corners.length],
     ex=b.x-a.x,ey=b.y-a.y,n=Math.hypot(ex,ey)||1,
     alignment=(mx*ex+my*ey)/n;
    const f=clamp(alignment,-distanceTotal/count,distanceTotal/count);
    options.push({x:pos.x+ex/n*f,y:pos.y+ey/n*f});
   }
   let best=null,score=0;
   for(const item of options){
    if(!canStand(item))continue;
    const d=(item.x-pos.x)*mx+(item.y-pos.y)*my;
    if(d>score){score=d;best=item;}
   }
   if(best){pos=best;continue;}
   // Approach the boundary without crossing it or teleporting sideways.
   let lo=0,hi=1;
   for(let k=0;k<8;k++){
    const t=(lo+hi)/2;
    if(canStand({x:pos.x+mx*t,y:pos.y+my*t}))lo=t;else hi=t;
   }
   if(lo>.01)pos={x:pos.x+mx*lo,y:pos.y+my*lo};
  }
  return pos;
 }
 return {pieces,nodes,RADIUS,canStand,contains,surface,nearest,legalTarget,
  route,move,clear,GRID};
}
window.AlleyStairNavigation={make};
})();