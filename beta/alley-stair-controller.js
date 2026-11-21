(() => {
'use strict';
// User-controlled traversal across the full width of stair and platform meshes.
const norm=(x,y)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function controller({plan,state,nav,length,speeds,curving}){
 const H=plan.height,stairs=[...plan.steps,...plan.landings];
 const rise=H/plan.steps.length;
 const gates=[
  {floor:0,at:plan.bottom,out:norm(plan.bottom.x-plan.path[0].x,
   plan.bottom.y-plan.path[0].y)},
  {floor:1,at:plan.top,out:norm(plan.top.x-plan.path.at(-1).x,
   plan.top.y-plan.path.at(-1).y)}
 ];
 function atExit(ride,gate,inputX,inputY,manual){
  const delta={x:ride.x-gate.at.x,y:ride.y-gate.at.y},
   along=delta.x*gate.out.x+delta.y*gate.out.y,
   lateral=Math.abs(delta.x*gate.out.y-delta.y*gate.out.x);
  // Reaching within almost a whole cell of the portal was causing the
  // floor switch to teleport the Guardian 35–50 pixels to the gate centre.
  // Keep broad lateral freedom, but complete only at the actual landing lip.
  const corridor=lateral<plan.width/2+.18&&along>-.12&&along<.8;
  const height=gate.floor===1?state.z>=H-rise*.65:state.z<=rise*.65;
  const pressed=inputX*gate.out.x+inputY*gate.out.y>.24;
  const click=ride.exitTarget===gate.floor;
  const enteredHere=ride.entry===(gate.floor?'top':'bottom');
  return corridor&&height&&(click||manual&&pressed)&&
   (!enteredHere||ride.leftEntry||click||ride.traveled>.9);
 }
 function gate(up){return up?plan.bottom:plan.top;}
 function entranceFrame(up){
  const entry=gate(up),lip=up?plan.path[0]:plan.path.at(-1),
   out=norm(entry.x-lip.x,entry.y-lip.y);
  return {entry,out,side:{x:-out.y,y:out.x}};
 }
 function entrancePosition(at,up){
  const frame=entranceFrame(up),d={x:at.x-frame.entry.x,y:at.y-frame.entry.y},
   along=d.x*frame.out.x+d.y*frame.out.y,
   sideways=d.x*frame.side.x+d.y*frame.side.y;
  return {frame,along,sideways,
   allowed:along>=-.76&&along<=.92&&Math.abs(sideways)<=plan.width*.5+.18};
 }
 function board(actor,up=true,target=null){
  if(state.stairRide||state.transition||state.pending||state.floor!==(up?0:1))return false;
  const where={x:actor.x/48,y:actor.y/48},
   approach=entrancePosition(where,up);
  // Helical flights can project the ground entrance almost directly below
  // the upper landing. XY proximity alone must NEVER board the wrong portal.
  // Ignore the opposite portal's very centre: spiral stairheads may
  // overlap in XY, but ordinary off-centre upper entry must remain possible.
  if(!approach.allowed||distance(where,gate(!up))<.13)return false;
  const {frame,sideways}=approach,
   safeSide=clamp(sideways,-plan.width*.5+nav.RADIUS+.02,
    plan.width*.5-nav.RADIUS-.02);
  const landing={x:frame.entry.x+frame.side.x*safeSide,
   y:frame.entry.y+frame.side.y*safeSide};
  const origin=nav.legalTarget(landing);
  if(!origin)return false;
  const ride={x:origin.x,y:origin.y,s:up?0:length,dir:up?1:-1,
   lateral:0,gait:0,target:null,path:null,entry:up?'bottom':'top',
   traveled:0,leftEntry:false,exitTarget:null};
  state.stairRide=ride;state.z=up?0:H;
  if(target&&!aim(target)){
   state.stairRide=null;return false;
  }
  actor.x=ride.x*48;actor.y=ride.y*48;
  return true;
 }
 function aim(target){
  const ride=state.stairRide;
  if(!ride)return false;
  if(!target){ride.path=null;ride.target=null;ride.exitTarget=null;return true;}
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
  ride.target=goal;ride.path=path;ride.exitTarget=isHead?1:isFoot?0:null;return true;
 }
 function enter(actor,dx,dy){
  if(state.stairRide||state.transition||state.pending||!dx&&!dy)return false;
  const up=state.floor===0,approach=entrancePosition(
   {x:actor.x/48,y:actor.y/48},up);
  if(!approach.allowed)return false;
  const inward=-(dx*approach.frame.out.x+dy*approach.frame.out.y);
  return inward>.28&&board(actor,up);
 }
 function advance(actor,dt,worldSpeed,dx=0,dy=0,options=null){
  const ride=state.stairRide;
  if(!ride)return false;
  const manual=Math.hypot(dx,dy)>.12;
  if(manual){ride.path=null;ride.target=null;ride.exitTarget=null;}
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
   // Running remains running on the stairs. An uphill grade is felt
   // slightly, but must not silently switch the hero to a walk cadence.
   if(options?.running)factor=Math.max(.88,factor);
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
  // Finish when the intended motion reaches the full-width landing portal.
  // A held movement key works even when the boundary collider stops the actor.
  // A click back to the floor directly beneath the entrance must also work
  // before the hero has moved a step; no roll or invisible detour required.
  if(ride.traveled>.04||ride.exitTarget!==null){
   const portal=gates.find(gate=>atExit(ride,gate,dx,dy,manual));
   if(portal){
    state.floor=portal.floor;state.z=portal.floor?H:0;
    // Change the navigable floor WITHOUT moving XY. The actor has already
    // reached this physical portal by normal collision-checked locomotion.
    // Do not snap off-centre players onto a hidden centreline.
    actor.moving=false;
    state.stairRide=null;
    return {completed:true,floor:portal.floor};
   }
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
   // Guardrails belong to the corresponding tread as well. They sit roughly
   // 27 projected pixels above its sides, outside the ordinary top-face halo.
   if(Number.isFinite(piece.prev)){
    const [a,b,c,d]=pts,rails=plan.kind.startsWith('spiral')||
     plan.kind==='curved'?[[b,c]]:[[a,d],[b,c]];
    for(const [start,end] of rails){
     const p=iso.toView(start.x*48,start.y*48,piece.prev+27),
      q=iso.toView(end.x*48,end.y*48,piece.z+27),
      gap=edgeDistance(screen,p,q);
     if(gap>8)continue;
     const score=420-gap*7;
     if(score<=best)continue;
     const goal=nav.legalTarget(piece.center,piece);
     if(goal){chosen={part:piece,point:goal,z};best=score;}
    }
   }
  }
  return chosen;
 }
 return {board,aim,enter,advance,pick};
}
window.AlleyStairController={make:controller};
})();