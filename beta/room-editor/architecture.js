/* Standalone architectural placement and height surfaces.
 * Pure geometry shared by editor drag/drop, JSON validation and playtest.
 * A wall decoration can never exist without a real, solid wall reference.
 */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const wallKey=w=>(w.edge==='north'||w.edge==='south'?'h:':'v:')+w.x+':'+w.y;
const horizontal=w=>w.edge==='north'||w.edge==='south';
// Wall mesh front is Blender +Y; baked view rot uses rig Z = 90 - rot.
// Camera +X/+Y maps Blender +X to editor +Y and Blender +Y to editor +X.
// Thus 180 faces into the north wall's +Y interior, 90 into west's +X.
// Use the same mapping during placement, dragging and saved JSON refresh.
const geometry=root.MindRoomShape||(typeof module!=='undefined'&&module.exports?require('./shape.js'):null);
const positiveSide=(room,w)=>!room.floorCells||geometry.sides(room,w).positive;
const mountRotation=(room,w)=>horizontal(w)?(positiveSide(room,w)?180:0):(positiveSide(room,w)?90:270);
function wallByRef(room,cat,ref){
 return (room.walls||[]).find(w=>wallKey(w)===ref&&cat.walls[w.style]?.solid&&
  (room.floorCells?(geometry.sides(room,w).positive||geometry.sides(room,w).negative):!(horizontal(w)&&w.y===room.height)&&!(!horizontal(w)&&w.x===room.width)))||null;
}
function wallCandidate(room,cat,x,y,range=.48){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 const scored=[];
 for(const w of room.walls||[]){
  if(!cat.walls[w.style]?.solid||!wallByRef(room,cat,wallKey(w)))continue;
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
 if(!spec||!spec.wallMounted&&spec.category!=='wall-architecture')return null;
 const found=wallCandidate(room,cat,x,y);
 if(!found)return null;
 const {wall:w,offset}=found;
 const isHorizontal=horizontal(w);
 const halfDepth=(spec.footprint.h/2+.015)*(positiveSide(room,w)?1:-1);
 return {
  id:id||type+'-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*999),
  type,wallRef:wallKey(w),wallOffset:offset,
  x:isHorizontal?w.x+offset:w.x+halfDepth,
  y:isHorizontal?w.y+halfDepth:w.y+offset,
  rot:mountRotation(room,w),
  destroyable:spec.destroyable,vaultable:spec.vaultable,
  blocksMovement:spec.blocksMovement
 };
}
function refreshMount(obj,room,cat){
 const spec=cat.furniture[obj.type];
 if(!spec?.wallMounted&&spec?.category!=='wall-architecture')return obj;
 const wall=wallByRef(room,cat,obj.wallRef);
 if(!wall)return null;
 const offset=clamp(Number(obj.wallOffset)||.5,.25,.75);
 const h=horizontal(wall),s=room.floorCells?geometry.sides(room,wall):null;
 const negative=!!s?.negative&&(!s.positive||(h?obj.y<wall.y:obj.x<wall.x));
 const d=(spec.footprint.h/2+.015)*(negative?-1:1);
 return {...obj,wallOffset:offset,rot:h?(negative?0:180):(negative?270:90),
  x:h?wall.x+offset:wall.x+d,
  y:h?wall.y+d:wall.y+offset};
}
function validMount(obj,room,cat){
 if(!cat.furniture[obj.type]?.wallMounted&&cat.furniture[obj.type]?.category!=='wall-architecture')return true;
 const valid=refreshMount(obj,room,cat);
 return !!valid && Math.abs(obj.x-valid.x)<.011&&Math.abs(obj.y-valid.y)<.011&&
  obj.rot===valid.rot;
}
const within=(b,x,y)=>x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;
// Transform world coordinates into the same local axes as the floor sprite.
function localPoint(obj,x,y){const a=(obj.rot||0)*Math.PI/180,c=Math.round(Math.cos(a)),s=Math.round(Math.sin(a));const dx=x-obj.x,dy=y-obj.y;return{x:dx*c+dy*s,y:-dx*s+dy*c};}
function surfaceAt(room,cat,x,y,placement){
 let chosen={height:0,obj:null,blocked:false};
 for(const obj of room.furniture||[]){
  const spec=cat.furniture[obj.type],surf=spec?.surface;if(!surf)continue;
  const p=localPoint(obj,x,y),w=spec.footprint.w,h=spec.footprint.h,nx=p.x/w,ny=p.y/h;
  if(Math.abs(nx)>.5||Math.abs(ny)>.5)continue;
  if(surf.type==='collapsed'){if(Math.abs(nx)<.23&&Math.abs(ny)<.30)return {height:0,obj,blocked:true};continue;}
  if(surf.access==='vault'){chosen={height:surf.elevation,obj,blocked:false};continue;}
  if(surf.access==='ramp'){chosen={height:surf.elevation*(.5-ny),obj,blocked:false};continue;}
  if(surf.type==='sunken'&&(Math.abs(nx)>=.41||ny<-.42))continue;
  // Three physical front treads, at y=.2.. .5; the side flanks are level ground.
  if(ny>=.2){if(Math.abs(nx)>.29)continue;const step=Math.min(2,Math.floor((ny-.2)/.1));chosen={height:surf.elevation*(2-step)/3,obj,blocked:false};}
  else chosen={height:surf.elevation,obj,blocked:false};
 }
 return chosen;
}
function transition(room,cat,placement,from,to){
 const dest=surfaceAt(room,cat,to.x,to.y,placement),origin=surfaceAt(room,cat,from.x,from.y,placement);
 if(dest.blocked||origin.blocked)return {allowed:false,height:from.z||0,reason:'hole'};
 const diff=Math.abs(dest.height-origin.height);
 if(diff<=.27)return {allowed:true,height:dest.height};
 const bridge=[dest,origin].find(hit=>hit.obj&&cat.furniture[hit.obj.type]?.surface?.access==='steps');
 if(bridge){
  const obj=bridge.obj,spec=cat.furniture[obj.type],a=localPoint(obj,from.x,from.y),b=localPoint(obj,to.x,to.y),h=spec.footprint.h,w=spec.footprint.w;
  if(Math.min(a.y,b.y)>=h*.14&&Math.max(a.y,b.y)>=h*.2&&Math.abs(a.x)<=w*.29&&Math.abs(b.x)<=w*.29&&diff<=Math.abs(spec.surface.elevation)/3+.035)return {allowed:true,height:dest.height,via:'steps'};
 }
 return {allowed:false,height:origin.height,reason:'height-edge'};
}
const api=Object.freeze({wallKey,wallByRef,wallCandidate,attach,refreshMount,
 validMount,surfaceAt,transition,localPoint});
root.MindRoomArchitecture=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:{});
