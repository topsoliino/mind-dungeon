/* Standalone architectural placement and height surfaces.
 * Pure geometry shared by editor drag/drop, JSON validation and playtest.
 * A wall decoration can never exist without a real, solid wall reference.
 */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const wallKey=w=>(w.edge==='north'||w.edge==='south'?'h:':'v:')+w.x+':'+w.y;
const horizontal=w=>w.edge==='north'||w.edge==='south';
function wallByRef(room,cat,ref){
 return (room.walls||[]).find(w=>wallKey(w)===ref&&cat.walls[w.style]?.solid&&
  !(horizontal(w)&&w.y===room.height)&&
  !(!horizontal(w)&&w.x===room.width))||null;
}
function wallCandidate(room,cat,x,y,range=.48){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 const scored=[];
 for(const w of room.walls||[]){
  if(!cat.walls[w.style]?.solid||horizontal(w)&&w.y===room.height||
     !horizontal(w)&&w.x===room.width)continue;
  const t=horizontal(w)?x-w.x:y-w.y;
  if(t<-.12||t>1.12)continue;
  const d=horizontal(w)?Math.abs(y-w.y):Math.abs(x-w.x);
  if(d>range)continue;
  scored.push({wall:w,dist:d+Math.abs(clamp(t,0,1)-t)*2,offset:clamp(t,.25,.75)});
 }
 scored.sort((a,b)=>a.dist-b.dist);
 return scored[0]||null;
}
function attach(type,room,cat,x,y,id){
 const spec=cat.furniture[type];
 if(!spec||spec.category!=='wall-architecture')return null;
 const found=wallCandidate(room,cat,x,y);
 if(!found)return null;
 const {wall:w,offset}=found;
 const isHorizontal=horizontal(w);
 const halfDepth=spec.footprint.h/2;
 return {
  id:id||type+'-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*999),
  type,wallRef:wallKey(w),wallOffset:offset,
  x:isHorizontal?w.x+offset:w.x+halfDepth+.015,
  y:isHorizontal?w.y+halfDepth+.015:w.y+offset,
  rot:isHorizontal?0:90,
  destroyable:spec.destroyable,vaultable:spec.vaultable,
  blocksMovement:spec.blocksMovement
 };
}
function refreshMount(obj,room,cat){
 const spec=cat.furniture[obj.type];
 if(spec?.category!=='wall-architecture')return obj;
 const wall=wallByRef(room,cat,obj.wallRef);
 if(!wall)return null;
 const offset=clamp(Number(obj.wallOffset)||.5,.25,.75);
 const h=horizontal(wall),d=spec.footprint.h/2+.015;
 return {...obj,wallOffset:offset,rot:h?0:90,
  x:h?wall.x+offset:wall.x+d,
  y:h?wall.y+d:wall.y+offset};
}
function validMount(obj,room,cat){
 if(cat.furniture[obj.type]?.category!=='wall-architecture')return true;
 const valid=refreshMount(obj,room,cat);
 return !!valid && Math.abs(obj.x-valid.x)<.011&&Math.abs(obj.y-valid.y)<.011&&
  obj.rot===valid.rot;
}
const within=(b,x,y)=>x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;
function surfaceAt(room,cat,x,y,placement){
 let chosen={height:0,obj:null,blocked:false};
 for(const obj of room.furniture||[]){
  const spec=cat.furniture[obj.type];
  if(spec?.category!=='architectural-floor'||!spec.surface)continue;
  const b=placement.bounds(obj,cat);
  if(!b||!within(b,x,y))continue;
  const surf=spec.surface;
  // The collapsed intermediate floor has a genuine central void, not an
  // invisible solid walkway over the rendered broken joists.
  if(surf.type==='collapsed'){
   const nx=(x-obj.x)/(b.right-b.left);
   const ny=(y-obj.y)/(b.bottom-b.top);
   const hole=Math.abs(nx)<.23&&Math.abs(ny)<.30;
   if(hole)return {height:0,obj,blocked:true};
   chosen={height:0,obj,blocked:false};
   continue;
  }
  let z=surf.elevation;
  if(surf.access==='ramp'){
   const relative=(y-b.top)/(b.bottom-b.top);
   z=surf.elevation*(1-clamp(relative,0,1));
  }
  chosen={height:z,obj,blocked:false};
 }
 return chosen;
}
function transition(room,cat,placement,from,to){
 const dest=surfaceAt(room,cat,to.x,to.y,placement);
 if(dest.blocked)return {allowed:false,height:from.z||0,reason:'hole'};
 const origin=surfaceAt(room,cat,from.x,from.y,placement);
 if(origin.blocked)return {allowed:false,height:from.z||0,reason:'hole'};
 const current=origin.height,next=dest.height;
 if(Math.abs(next-current)<=.29)return {allowed:true,height:next};
 // Heights are connected by the visible front stairs; direct clipping
 // through the back / side walls of a tall dais is not permitted.
 // Entering a sunken platform is a *descent*, so the accessible stairs
 // belong to the destination rather than the higher source floor. Likewise,
 // leaving a dais uses the stairs attached to the original surface.
 const bridge=[dest,origin].find(hit=>
  hit.obj&&cat.furniture[hit.obj.type]?.surface?.access==='steps')||dest;
 const spec=bridge.obj?cat.furniture[bridge.obj.type]:null;
 if(spec?.surface.access==='steps'){
  const b=placement.bounds(bridge.obj,cat);
  const fromSouth=from.y>=b.bottom-.38||to.y>=b.bottom-.38;
  const withinStairs=Math.abs(to.x-bridge.obj.x)<=Math.min(.58,(b.right-b.left)*.45);
  if(fromSouth&&withinStairs)return {allowed:true,height:next,via:'steps'};
 }
 return {allowed:false,height:current,reason:'height-edge'};
}
const api=Object.freeze({wallKey,wallByRef,wallCandidate,attach,refreshMount,
 validMount,surfaceAt,transition});
root.MindRoomArchitecture=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:{});
