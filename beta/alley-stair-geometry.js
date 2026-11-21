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
 'grand':{w:6,h:11,width:3.35,steps:16,title:'Weite Prachttreppe'},
 'quarter':{w:8,h:8,width:1.7,steps:14,title:'Viertelgewendelte Treppe mit Podest'},
 'switchback':{w:8,h:9,width:1.7,steps:16,title:'U-Treppe mit Zwischenpodest'},
 'spiral-tight':{w:6,h:6,inner:.64,outer:2.42,steps:13,title:'Enge Wendeltreppe'},
 'spiral-wide':{w:9,h:9,inner:1.05,outer:3.75,steps:17,title:'Weite Wendeltreppe'},
 'curved':{w:9,h:9,inner:2.05,outer:3.7,steps:12,title:'Geschwungene Freitreppe'}
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
 }else if(kind==='switchback'){
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
 const start=window.AlleyStudyMap.logic.spawn,TILE=48,R=.29;
 const destination={x:model.bottom.x*TILE,y:model.bottom.y*TILE};
 const walkable=(px,py)=>{
  const u=px/TILE,v=py/TILE;
  return [[u-R,v],[u+R,v],[u,v-R],[u,v+R]].every(([x,y])=>
   generator.containsGround(x,y))&&
   !generator.blocked(u,v,R)&&!blocksCandidate(model,u,v,R);
 };
 return walkable(destination.x,destination.y)&&
  Boolean(generator.path({x:start[0]*TILE,y:start[1]*TILE},destination,walkable));
}
function select(generator){
 const asked=new URLSearchParams(window.location.search).get('treppe');
 const preferred=styles.includes(asked)?asked:styles[generator.seed%styles.length],
  order=[preferred,...styles.filter(s=>s!==preferred)];
 const viable=[];
 for(const style of order){
  const template=buildTemplate(style),{w,h}=template.cfg;
  for(const room of generator.rooms.filter(r=>r.kind==='raum')){
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
     const model=transform(template,[x,y],rotation);
     // A usable upper and lower landing must remain in the SAME room.
     if(!occupied.has(K(Math.floor(model.bottom.x),Math.floor(model.bottom.y)))||
      !occupied.has(K(Math.floor(model.top.x),Math.floor(model.top.y))))continue;
     // No interior wall is allowed to cut a stair, or obstruct the character.
     if(generator.walls.some(wall=>wall.interior&&
      wall.area[0]<model.region[2]-.23&&wall.area[2]>model.region[0]+.23&&
      wall.area[1]<model.region[3]-.23&&wall.area[3]>model.region[1]+.23))continue;
     if(generator.blocked(model.bottom.x,model.bottom.y,.27)||
        generator.blocked(model.top.x,model.top.y,.27))continue;
     const doorCells=generator.doors.flatMap(d=>d.edges.flatMap(([a,b])=>[a,b]));
     const clearance=doorCells.length?Math.min(...doorCells.map(c=>
      Math.min(dist(model.bottom,vec(c[0]+.5,c[1]+.5)),
       dist(model.top,vec(c[0]+.5,c[1]+.5))))):4;
     const old=generator.stairs?.[0]?.roomId===room.id?1:0;
     const variety=((Math.imul(generator.seed+31,(x+53)*17+(y+43)*13+rotation*7)>>>0)%53)/53;
     const score=Math.min(4,clearance)*2+old*2+variety;
     viable.push({...model,room,score,style});
    }
   }
  }
  if(viable.length){
   viable.sort((a,b)=>b.score-a.score);
   const possible=viable.find(model=>candidateAccessible(generator,model));
   if(possible){viable.length=0;viable.push(possible);break;}
   viable.length=0;
  }
 }
 if(!viable.length)throw Error('No physically reachable stair footprint fits any chamber');
 const chosen=viable[0],room=chosen.room;
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
 return {...chosen,upper};
}
window.AlleyStairGeometry={height:H,styles,templates:ref,make:buildTemplate,select};
})();