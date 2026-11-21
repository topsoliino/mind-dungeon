(() => {
'use strict';
// User-controlled traversal across the full width of stair and platform meshes.
const norm=(x,y)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function controller({plan,state,nav,length,speeds,curving}){
 const H=plan.height,stairs=[...plan.steps,...plan.landings];
 function gate(up){return up?plan.bottom:plan.top;}
 function board(actor,up=true,target=null){
  if(state.stairRide||state.transition||state.pending||state.floor!==(up?0:1))return false;
  const entry=gate(up);
  if(distance({x:actor.x/48,y:actor.y/48},entry)>.72)return false;
  const origin=nav.legalTarget(entry);
  if(!origin)return false;
  const ride={x:origin.x,y:origin.y,s:up?0:length,dir:up?1:-1,
   lateral:0,gait:0,target:null,path:null,entry:up?'bottom':'top',
   traveled:0,leftEntry:false};
  state.stairRide=ride;state.z=up?0:H;
  actor.x=ride.x*48;actor.y=ride.y*48;actor.moving=false;
  if(target&&!aim(target)){
   state.stairRide=null;return false;
  }
  return true;
 }
 function aim(target){
  const ride=state.stairRide;
  if(!ride)return false;
  if(!target){ride.path=null;ride.target=null;return true;}
  const piece=target.part??target;
  let point=target.point??piece.center;
  if(!point&&piece.corners){
   const n=piece.corners.length;
   point={x:piece.corners.reduce((s,p)=>s+p.x,0)/n,
    y:piece.corners.reduce((s,p)=>s+p.y,0)/n};
  }
  if(!point&&Number.isFinite(piece.x)&&Number.isFinite(piece.y))point=piece;
  if(!point)return false;
  const isHead=piece.top||distance(point,plan.top)<.08;
  const isFoot=distance(point,plan.bottom)<.08;
  if(isHead)point=plan.top;
  if(isFoot)point=plan.bottom;
  const goal=nav.legalTarget(point,piece.corners?piece:null);
  if(!goal)return false;
  const path=nav.route({x:ride.x,y:ride.y},goal);
  if(!path)return false;
  ride.target=goal;ride.path=path;return true;
 }
 function enter(actor,dx,dy){
  if(state.stairRide||state.transition||state.pending||!dx&&!dy)return false;
  const up=state.floor===0,entry=gate(up);
  if(distance({x:actor.x/48,y:actor.y/48},entry)>.61)return false;
  const seq=up?plan.path:[...plan.path].reverse(),
   dir=norm(seq[1].x-seq[0].x,seq[1].y-seq[0].y);
  return dx*dir.x+dy*dir.y>.32&&board(actor,up);
 }
 function advance(actor,dt,worldSpeed,dx=0,dy=0,options=null){
  const ride=state.stairRide;
  if(!ride)return false;
  const manual=Math.hypot(dx,dy)>.12;
  if(manual){ride.path=null;ride.target=null;}
  else if(ride.path){
   while(ride.path.length&&distance(ride.path[0],ride)<.065)ride.path.shift();
   if(!ride.path.length){ride.path=null;ride.target=null;}
   else {dx=ride.path[0].x-ride.x;dy=ride.path[0].y-ride.y;}
  }
  const magnitude=Math.hypot(dx,dy),old={x:ride.x,y:ride.y};
  if(magnitude>1e-6){
   dx/=magnitude;dy/=magnitude;
   // Decompose input into movement along and across the actual local tread,
   // without constraining position to its former centreline. On flat platforms
   // every direction uses the ordinary landing speed.
   const current=nav.surface(ride,state.z);
   let factor=speeds.landing;
   if(current?.part.kind==='tread'){
    const start=current.part.start,end=current.part.end,
     a={x:(start[0].x+start[1].x)/2,y:(start[0].y+start[1].y)/2},
     b={x:(end[0].x+end[1].x)/2,y:(end[0].y+end[1].y)/2},
     axis=norm(b.x-a.x,b.y-a.y),along=dx*axis.x+dy*axis.y,
     across=dx*(-axis.y)+dy*axis.x,
     forwardSpeed=along>=0?(curving?speeds.curvedUp:speeds.straightUp):
      (curving?speeds.curvedDown:speeds.straightDown);
    factor=Math.hypot(along*forwardSpeed,across*speeds.across);
   }
   if(options?.rolling)factor=1;
   let step=(Math.max(0,worldSpeed)/48)*Math.min(.05,dt)*factor;
   if(!manual&&ride.path)step=Math.min(step,distance(ride.path[0],ride));
   const next=nav.move(old,dx*step,dy*step);
   ride.x=next.x;ride.y=next.y;
  }
  const traveled=distance(ride,old);
  ride.traveled+=traveled;
  if(distance(ride,ride.entry==='bottom'?plan.bottom:plan.top)>.7)
   ride.leftEntry=true;
  actor.x=ride.x*48;actor.y=ride.y*48;
  if(traveled>1e-5){
   actor.dir=Math.atan2(ride.y-old.y,ride.x-old.x);
   actor.moveAngle=actor.dir;
   ride.dir=1;ride.gait+=traveled*2;
  }
  actor.moving=traveled>1e-5;
  const surface=nav.surface(ride,state.z);
  if(surface)state.z=surface.z;
  ride.s=length*clamp(state.z/H);
  if(!manual&&ride.path&&distance(ride,ride.target)<.075){
   ride.target=null;ride.path=null;
  }
  // Only leave through a gate when moving toward it. Merely standing in
  // its proximity after a sideways dodge must not terminate the stair ride.
  const into=(gate)=>(gate.x-old.x)*(ride.x-old.x)+
   (gate.y-old.y)*(ride.y-old.y)>1e-5;
  // A click toward another tread must never be mistaken for a request
  // to leave via the nearby entrance, even if the safe A* route briefly
  // passes through that entrance's trigger circle.
  const permitsExit=gate=>!ride.target||distance(ride.target,gate)<.35;
  const atHead=state.z>=H-.35&&distance(ride,plan.top)<.32&&
   into(plan.top)&&permitsExit(plan.top);
  const atFoot=state.z<=.35&&distance(ride,plan.bottom)<.32&&
   into(plan.bottom)&&permitsExit(plan.bottom);
  if(ride.traveled>.07&&
   (atHead&&(ride.entry==='bottom'||ride.leftEntry)||
    atFoot&&(ride.entry==='top'||ride.leftEntry))){
   const floor=atHead?1:0,exit=atHead?plan.top:plan.bottom;
   state.floor=floor;state.z=floor?H:0;
   actor.x=exit.x*48;actor.y=exit.y*48;actor.moving=false;
   state.stairRide=null;
   return {completed:true,floor};
  }
  return {completed:false,floor:state.floor,z:state.z,
   along:ride.s,total:length,position:{x:ride.x,y:ride.y}};
 }
 // Any visible top, riser or side of a tread selects that specific stair
 // surface. An 8 px pick halo covers the small projected wedge seams.
 function pick(screen,iso){
  const inConvex=(p,pts)=>{
   let sign=0;
   for(let i=0;i<pts.length;i++){
    const a=pts[i],b=pts[(i+1)%pts.length],
     cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
    if(Math.abs(cross)<1e-6)continue;
    const dir=Math.sign(cross);if(sign&&sign!==dir)return false;sign=dir;
   }
   return true;
  };
  const edgeDistance=(p,a,b)=>{
   const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,
    k=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(1e-8,d));
   return Math.hypot(p.x-a.x-k*dx,p.y-a.y-k*dy);
  };
  let best=-Infinity,chosen=null;
  for(const piece of stairs){
   if(piece.top&&state.floor===0&&!state.stairRide)continue;
   const pts=piece.corners,z=piece.z,
    underside=Number.isFinite(piece.prev)?piece.prev:Math.max(0,z-13),
    top=pts.map(p=>iso.toView(p.x*48,p.y*48,z)),
    low=pts.map(p=>iso.toView(p.x*48,p.y*48,underside));
   const faces=[top];
   for(let i=0;i<4;i++)faces.push([
    low[i],low[(i+1)%4],top[(i+1)%4],top[i]]);
   for(let i=0;i<faces.length;i++){
    const outline=faces[i],inside=inConvex(screen,outline);
    const distancePx=Math.min(...outline.map((a,j)=>
     edgeDistance(screen,a,outline[(j+1)%outline.length])));
    if(!inside&&distancePx>9)continue;
    // Top-face hits outrank projected side faces. On curved stairs several
    // raised treads overlap in screen space; choose the closest actual tread
    // centre instead of whichever happens to be later in the array.
    const centroid=piece.center??{
     x:pts.reduce((sum,p)=>sum+p.x,0)/pts.length,
     y:pts.reduce((sum,p)=>sum+p.y,0)/pts.length
    };
    const onScreen=iso.toView(centroid.x*48,centroid.y*48,z),
     centreDistance=distance(onScreen,screen);
    const score=inside?
     (i===0?900-centreDistance*1.4:450-centreDistance*.2):
     90-distancePx*5-centreDistance*.1;
    if(score<best)continue;
    let point;
    if(i===0){
     const p=iso.toWorld(screen.x,screen.y,z);
     point={x:p.x/48,y:p.y/48};
    }else{
     const j=i-1,a=pts[j],b=pts[(j+1)%4];
     point={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    }
    const legal=nav.legalTarget(point,piece);
    if(!legal)continue;
    best=score;chosen={part:piece,point:legal,z};
   }
  }
  return chosen;
 }
 return {board,aim,enter,advance,pick};
}
window.AlleyStairController={make:controller};
})();