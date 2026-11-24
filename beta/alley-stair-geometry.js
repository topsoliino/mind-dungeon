(() => {
'use strict';
// Architectural stair grammar. All geometry is in the same continuous (u,v,z)
// coordinates as the isometric scene. No separate fake perspective tiles.
const H=132,TAU=Math.PI*2,EPS=1e-6;
const K=(u,v)=>u+','+v;
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=t=>Math.max(0,Math.min(1,t));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const vec=(x,y)=>({x,y});
const norm=(x,y)=>{const r=Math.hypot(x,y)||1;return vec(x/r,y/r);};
const interpolate=(a,b,t)=>vec(lerp(a.x,b.x,t),lerp(a.y,b.y,t));
const ref={
 'straight-narrow':{w:3,h:8,width:1.45,steps:12,title:'Schmale gerade Treppe'},
 'straight-wide':{w:5,h:8,width:2.85,steps:12,title:'Breite gerade Treppe'},
 'grand':{w:6,h:11,width:3.35,steps:16,open:true,title:'Weite Prachttreppe'},
 'quarter':{w:8,h:8,width:1.7,steps:14,title:'Viertelgewendelte Treppe mit Podest'},
 'switchback':{w:8,h:9,width:1.7,steps:16,open:true,title:'Offene U-Treppe mit Zwischenpodest'},
 'switchback-closed':{w:8,h:9,width:1.7,steps:16,open:false,title:'U-Treppe mit geschlossenem Unterbau'},
 'spiral-tight':{open:true,w:6,h:6,inner:.64,outer:2.42,steps:13,title:'Enge Wendeltreppe'},
 'spiral-wide':{open:true,w:9,h:9,inner:1.05,outer:3.75,steps:17,title:'Weite Wendeltreppe'},
 'curved':{w:9,h:9,inner:2.05,outer:3.7,steps:12,open:true,title:'Geschwungene Freitreppe'}
};
const styles=Object.keys(ref);
function buildTemplate(kind){
 const cfg=ref[kind],{w,h}=cfg;
 const steps=[],path=[],landings=[],posts=[];
 const addFlight=(a,b,z0,z1,count,width)=>{
  const t=norm(b.x-a.x,b.y-a.y),n=vec(-t.y,t.x);
  for(let i=0;i<count;i++){
   const p=interpolate(a,b,i/count),q=interpolate(a,b,(i+1)/count);
   const left0=vec(p.x+n.x*width/2,p.y+n.y*width/2);
   const right0=vec(p.x-n.x*width/2,p.y-n.y*width/2);
   const left1=vec(q.x+n.x*width/2,q.y+n.y*width/2);
   const right1=vec(q.x-n.x*width/2,q.y-n.y*width/2);
   const z=lerp(z0,z1,(i+1)/count),prev=lerp(z0,z1,i/count);
   steps.push({corners:[left0,right0,right1,left1],start:[left0,right0],
    end:[left1,right1],z,prev,center:interpolate(p,q,.5),kind:'straight'});
  }
  const countBefore=path.length;
  if(!countBefore)path.push({...a,z:z0});
  else if(dist(path.at(-1),a)>.005)path.push({...a,z:z0});
  path.push({...b,z:z1});
 };
 if(kind.startsWith('straight')||kind==='grand'){
  const middle=w/2;
  addFlight(vec(middle,h-.92),vec(middle,.96),0,H,cfg.steps,cfg.width);
 }else if(kind==='quarter'){
  // Every flight ends at the edge of a single load-bearing landing.
  const a=vec(1.55,6.87),entry=vec(1.55,2.65);
  const corner=vec(1.55,1.65),exit=vec(2.65,1.65),b=vec(6.9,1.65);
  addFlight(a,entry,0,H/2,7,cfg.width);
  landings.push({corners:[vec(.55,.65),vec(2.65,.65),
   vec(2.65,2.65),vec(.55,2.65)],z:H/2});
  path.push({...corner,z:H/2},{...exit,z:H/2});
  addFlight(exit,b,H/2,H,7,cfg.width);
 }else if(kind==='switchback'||kind==='switchback-closed'){
  // Both flights meet the same flat landing edge at y=3.32.
  const a=vec(1.65,7.75),leftLip=vec(1.65,3.32);
  const leftInside=vec(1.65,2.38),rightInside=vec(6.15,2.38);
  const rightLip=vec(6.15,3.32),b=vec(6.15,7.75);
  addFlight(a,leftLip,0,H/2,8,cfg.width);
  landings.push({corners:[vec(.75,1.45),vec(7.05,1.45),
   vec(7.05,3.32),vec(.75,3.32)],z:H/2});
  path.push({...leftInside,z:H/2},{...rightInside,z:H/2},{...rightLip,z:H/2});
  addFlight(rightLip,b,H/2,H,8,cfg.width);
 }else{
  const wide=kind==='spiral-wide',curved=kind==='curved';
  const center=vec(w/2,h/2),r0=cfg.inner,r1=cfg.outer,walk=(r0+r1)/2;
  const arc=curved?Math.PI*.64:(wide?Math.PI*1.67:Math.PI*1.63);
  const start=curved?-.35:(wide?-.65:-.8); // One continuous turning direction.
  const polar=(angle,r)=>vec(center.x+Math.cos(angle)*r,center.y+Math.sin(angle)*r);
  const low=polar(start,walk),high=polar(start+arc,walk);
  path.push({...low,z:0});
  for(let i=0;i<cfg.steps;i++){
   const a=start+arc*i/cfg.steps,b=start+arc*(i+1)/cfg.steps;
   const mid=(a+b)/2,top=H*(i+1)/cfg.steps,bottom=H*i/cfg.steps;
   const corners=[polar(a,r0),polar(a,r1),polar(b,r1),polar(b,r0)];
   const pt=polar(b,walk);
   steps.push({corners,start:[corners[0],corners[1]],
    end:[corners[3],corners[2]],z:top,prev:bottom,center:polar(mid,walk),
    kind:'wedge',angleA:a,angleB:b});
   path.push({...pt,z:top});
  }
  // A real central spindle, rather than triangular stairs around a hole.
  if(!curved)posts.push({p:center,radius:r0*.65,z0:0,z1:H+22});
 }
 const first=path[0],last=path.at(-1);
 let entry,exit;
 if(kind.startsWith('spiral')||kind==='curved'){
  // Exit is tangential to the final tread. Radial exit pointed sideways
  // into an impossible upper half of the curved staircase.
  const center=vec(w/2,h/2);
  const firstRad=norm(first.x-center.x,first.y-center.y),
   lastRad=norm(last.x-center.x,last.y-center.y);
  const inTangent=vec(-firstRad.y,firstRad.x);
  const outTangent=vec(-lastRad.y,lastRad.x);
  entry=vec(first.x-inTangent.x*.45,first.y-inTangent.y*.45);
  exit=vec(last.x+outTangent.x*.55,last.y+outTangent.y*.55);
  const lastStep=steps.at(-1),a=lastStep.corners[3],b=lastStep.corners[2];
  const shifted=p=>vec(p.x+outTangent.x*.55,p.y+outTangent.y*.55);
  landings.push({corners:[a,b,shifted(b),shifted(a)],z:H,top:true});
 }else{
  const startDirection=norm(path[1].x-first.x,path[1].y-first.y);
  const endDirection=norm(last.x-path.at(-2).x,last.y-path.at(-2).y);
  entry=vec(first.x-startDirection.x*.45,first.y-startDirection.y*.45);
  exit=vec(last.x+endDirection.x*.56,last.y+endDirection.y*.56);
 }
 return {kind,cfg,steps,path,landings,posts,entry,exit,
  bottom:entry,top:exit,height:H,width:cfg.width||cfg.outer-cfg.inner,
  style:cfg.title};
}
function rotatePoint(point,o,w,h,rotation){
 const {x,y}=point;
 if(rotation===0)return vec(o[0]+x,o[1]+y);
 if(rotation===1)return vec(o[0]+h-y,o[1]+x);
 if(rotation===2)return vec(o[0]+w-x,o[1]+h-y);
 return vec(o[0]+y,o[1]+w-x);
}
function transform(template,origin,rotation){
 const {w,h}=template.cfg;
 const point=p=>rotatePoint(p,origin,w,h,rotation);
 const steps=template.steps.map(s=>({...s,corners:s.corners.map(point),
  start:s.start.map(point),end:s.end.map(point),center:point(s.center)}));
 const path=template.path.map(p=>({...point(p),z:p.z}));
 return {...template,steps,path,
  landings:template.landings.map(l=>({...l,corners:l.corners.map(point)})),
  posts:template.posts.map(post=>({...post,p:point(post.p)})),
  bottom:point(template.bottom),top:point(template.top),rotation,
  origin,region:[origin[0],origin[1],origin[0]+(rotation%2?h:w),origin[1]+(rotation%2?w:h)],
  length:template.steps.length};
}
// Shared 2D footprint kernel for candidate navigation. A stair is a solid
// occupied surface except for the short approach apron at its foot.
const distanceLine=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
 const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(len,.00001)));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
function nearPolygon(p,points,r){
 let pos=false,neg=false;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  const cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
  pos||=cross>1e-7;neg||=cross< -1e-7;
 }
 return !(pos&&neg)||r>0&&points.some((a,i)=>
  distanceLine(p,a,points[(i+1)%points.length])<=r);
}
function blocksCandidate(model,u,v,r){
 const p=vec(u,v);
 if(dist(p,model.bottom)<=.58+r*.65)return false;
 return model.steps.concat(model.landings).some(part=>nearPolygon(p,part.corners,r));
}
function candidateAccessible(generator,model){
 // Linear-time grid flood fill, not a full A* invocation for every possible
 // position. This check happens before creating renderer art.
 // Enclosed dungeon floors start within their own corridor. Using the
 // original outside alley would make every upstairs stair falsely unreachable.
 const enclosed=window.RockyCoastPrison?.enabled&&!window.RockyCoastPrison.hasEntrance;
 const start=enclosed?[14.5,5.5]:window.AlleyStudyMap.logic.spawn,
  R=.29,goal=model.bottom;
 const [a,b,c,d]=model.region;
 const pointOK=(u,v)=>{
  if(generator.blocked(u,v,R)||![[u-R,v],[u+R,v],[u,v-R],[u,v+R]]
   .every(([x,y])=>generator.containsGround(x,y)))return false;
  if(u>=a-R&&u<=c+R&&v>=b-R&&v<=d+R&&
   blocksCandidate(model,u,v,R))return false;
  return true;
 };
 if(!pointOK(goal.x,goal.y))return false;
 const tiles=new Set();
 for(const [x,y,r,b] of window.AlleyStudyMap.logic.walkable)
  for(let u=Math.floor(x);u<Math.ceil(r);u++)
   for(let v=Math.floor(y);v<Math.ceil(b);v++)tiles.add(K(u,v));
 const sx=Math.floor(start[0]),sy=Math.floor(start[1]);
 const begin=K(sx,sy),seen=new Set([begin]),queue=[[sx,sy]];
 const segmentClear=(x,y,u,v)=>{
  const dist=Math.hypot(u-x,v-y),n=Math.max(1,Math.ceil(dist/.14));
  for(let i=1;i<=n;i++)if(!pointOK(x+(u-x)*i/n,y+(v-y)*i/n))return false;
  return true;
 };
 const exit=generator.outdoorExit;
 const targets=[goal,...(exit?[{x:exit.x+exit.dx,y:exit.y+exit.dy}]:[])];
 if(model.ladder)targets.push(model.ladder.bottom);
 for(let i=0;i<queue.length;i++){
  const [u,v]=queue[i],x=u+.5,y=v+.5;
  for(let j=targets.length-1;j>=0;j--){
   const target=targets[j];
   if(dist(vec(x,y),target)<1.5&&segmentClear(x,y,target.x,target.y))targets.splice(j,1);
  }
  if(!targets.length)return true;
  for(const [du,dv] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=u+du,ny=v+dv,k=K(nx,ny);
   if(seen.has(k)||!tiles.has(k)||!pointOK(nx+.5,ny+.5)||
    !segmentClear(x,y,nx+.5,ny+.5))continue;
   seen.add(k);queue.push([nx,ny]);
  }
 }
 return false;
}
function select(generator,placeLadder,reserved=null,previousKind=null){
 const asked=new URLSearchParams(window.location.search).get('treppe');
 // Rank all families deterministically, including the fallbacks when a
 // large flight doesn't fit. Prefer a different family on the next floor.
 let salt=(generator.seed^(previousKind?0x9e3779b9:0))>>>0;
 const order=styles.slice();
 for(let i=order.length-1;i>0;i--){
  salt=(Math.imul(salt,1664525)+1013904223)>>>0;
  const j=Math.floor(salt/4294967296*(i+1));
  [order[i],order[j]]=[order[j],order[i]];
 }
 if(previousKind)order.push(...order.splice(order.indexOf(previousKind),1));
 if(styles.includes(asked))order.unshift(...order.splice(order.indexOf(asked),1));
 const doorCells=generator.doors.flatMap(d=>d.edges.flatMap(([a,b])=>[a,b]));
 const viable=[];
 for(const style of order){
  const template=buildTemplate(style),{w,h}=template.cfg;
  for(const room of generator.rooms.filter(r=>r.kind==='raum'&&!r.authored)){
   const occupied=new Set(room.cells.map(([x,y])=>K(x,y))),
    cells=room.cells,rx=cells.map(c=>c[0]),ry=cells.map(c=>c[1]);
   const minX=Math.min(...rx),maxX=Math.max(...rx),minY=Math.min(...ry),maxY=Math.max(...ry);
   for(let rotation=0;rotation<4;rotation++){
    const W=rotation%2?h:w,L=rotation%2?w:h;
    for(let x=minX;x<=maxX-W+1;x++)for(let y=minY;y<=maxY-L+1;y++){
     let fits=true;
     for(let a=x;a<x+W&&fits;a++)for(let b=y;b<y+L;b++){
      if(!occupied.has(K(a,b))){fits=false;break;}
     }
     if(!fits)continue;
     if(reserved&&x<reserved[2]+1&&x+W>reserved[0]-1&&y<reserved[3]+1&&y+L>reserved[1]-1)continue;
     // Rank cheap footprint descriptors first. Construct detailed meshes only
     // for candidates actually being validated, one mesh at a time.
     const clearance=Math.min(5,...doorCells.map(([u,v])=>
      Math.hypot(Math.max(x-u-1,0,u-x-W),Math.max(y-v-1,0,v-y-L))));
     const variety=((Math.imul(generator.seed+31,(x+53)*17+(y+43)*13+rotation*7)>>>0)%53)/53;
     const score=clearance*3+Math.min(35,room.cells.length-W*L)*.55+variety;
     viable.push({room,occupied,x,y,rotation,score});
    }
   }
  }
  if(viable.length){
   viable.sort((a,b)=>b.score-a.score);
   for(const {room,occupied,x,y,rotation} of viable){
     const model={...transform(template,[x,y],rotation),room};
     // A usable upper and lower landing must remain in the SAME room.
     if(!occupied.has(K(Math.floor(model.bottom.x),Math.floor(model.bottom.y)))||
      !occupied.has(K(Math.floor(model.top.x),Math.floor(model.top.y))))continue;
     // No interior wall is allowed to cut a stair, or obstruct the character.
     if(generator.walls.some(wall=>wall.interior&&
      wall.area[0]<model.region[2]-.23&&wall.area[2]>model.region[0]+.23&&
      wall.area[1]<model.region[3]-.23&&wall.area[3]>model.region[1]+.23))continue;
     if(generator.blocked(model.bottom.x,model.bottom.y,.27)||
        generator.blocked(model.top.x,model.top.y,.27))continue;
     // Reserve an approach and a step-off beyond the last visible riser.
     if(window.RockyCoastPrison?.enabled){
      const clearApron=(gate,lip)=>{
       const dx=gate.x-lip.x,dy=gate.y-lip.y,d=Math.hypot(dx,dy);
       for(const step of [.4,.85]){
        const u=gate.x+dx/d*step,v=gate.y+dy/d*step;
        if(!occupied.has(K(Math.floor(u),Math.floor(v)))||generator.blocked(u,v,.32))return false;
       }
       return true;
      };
      if(!clearApron(model.bottom,model.path[0])||
         !clearApron(model.top,model.path.at(-1)))continue;
     }
     const [left,back,right,front]=model.region;
     if(doorCells.some(([u,v])=>u+1>left&&u<right&&v+1>back&&v<front&&
      blocksCandidate(model,u+.5,v+.5,.42)))continue;
    // Check the actual tread and landing polygons against every wall,
    // including perimeter walls near a rotated or curved outer rail.
    const intersectsWall=(corners,[x0,y0,x1,y1])=>{
     const box=[vec(x0-.08,y0-.08),vec(x1+.08,y0-.08),vec(x1+.08,y1+.08),vec(x0-.08,y1+.08)];
     const separated=(points,other)=>points.some((a,i)=>{
      const b=points[(i+1)%points.length],nx=a.y-b.y,ny=b.x-a.x;
      const project=p=>p.x*nx+p.y*ny;
      return Math.max(...points.map(project))<Math.min(...other.map(project))||
       Math.max(...other.map(project))<Math.min(...points.map(project));
     });
     return !separated(box,corners)&&!separated(corners,box);
    };
    const walls=generator.walls.filter(({area:[x,y,r,b]})=>x<=right+.1&&r>=left-.1&&y<=front+.1&&b>=back-.1);
    if(walls.some(w=>model.steps.concat(model.landings).some(p=>intersectsWall(p.corners,w.area))))continue;
    const plan=withUpperDeck(model);
    if((!placeLadder||placeLadder(plan))&&candidateAccessible(generator,plan))return plan;
   }
   viable.length=0;
  }
 }
 throw Error('No physically reachable stair footprint fits any chamber');
}
function withUpperDeck(chosen){
 const room=chosen.room;
 const avoid=new Set();
 for(const step of chosen.steps){
  if(step.z>H*.77)continue;
  const corners=step.corners,
   xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
  // Carve upper slab only where low treads physically need headroom.
  for(let x=Math.floor(Math.min(...xs));x<=Math.floor(Math.max(...xs));x++)
   for(let y=Math.floor(Math.min(...ys));y<=Math.floor(Math.max(...ys));y++){
    const center=vec(x+.5,y+.5);
    if(dist(center,step.center)<Math.max(.85,chosen.width*.68))
     avoid.add(K(x,y));
   }
 }
 const upper=new Set(room.cells.map(p=>K(...p)));
 for(const cell of avoid)upper.delete(cell);
 // Guarantee a guardian-radius landing apron. Low stair holes may otherwise
 // carve a neighbouring cell immediately beside a helical top-out point.
 const tx=Math.floor(chosen.top.x),ty=Math.floor(chosen.top.y);
 const occupied=new Set(room.cells.map(([x,y])=>K(x,y)));
 for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
  const x=tx+dx,y=ty+dy;
  if(occupied.has(K(x,y)))upper.add(K(x,y));
 }
 // Ensure the upstairs exit physically meets the deck and can walk further.
 const topCell=[Math.floor(chosen.top.x),Math.floor(chosen.top.y)],
   neighbors=[[1,0],[-1,0],[0,1],[0,-1]]
    .filter(([du,dv])=>upper.has(K(topCell[0]+du,topCell[1]+dv)));
 if(!neighbors.length){
  // Preserve a short bridge at exactly the upper finished level.
  const cells=room.cells.filter(([x,y])=>Math.abs(x-topCell[0])+Math.abs(y-topCell[1])===1);
  if(cells.length)upper.add(K(...cells[0]));
 }
 // A rendered upper deck must have one connected footprint, not loose,
 // inaccessible islands left behind by the stair-shaft carving.
 const head=K(Math.floor(chosen.top.x),Math.floor(chosen.top.y));
 const connected=new Set([head]),queue=[head];
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i].split(',').map(Number);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const cell=K(x+dx,y+dy);
   if(upper.has(cell)&&!connected.has(cell)){
    connected.add(cell);queue.push(cell);
   }
  }
 }
 for(const cell of upper)if(!connected.has(cell))upper.delete(cell);
 return {...chosen,upper};
}
window.AlleyStairGeometry={height:H,styles,templates:ref,make:buildTemplate,select};
})();


