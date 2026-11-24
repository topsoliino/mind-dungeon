/* Standalone Room Atelier placement geometry; intentionally no live-game imports.
 * Every furniture/decor footprint can approach room and internal stone walls
 * up to a 1 cm world-space gap. Snapping is independent of the 0.25m grid.
 */
(function(root){
'use strict';
const EPS=.01, SNAP=.29;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const halfSize=(obj,catalog)=>{
 const item=catalog.furniture[obj.type];
 if(!item)return null;
 const rotated=(((Number(obj.rot)||0)%180)+180)%180===90;
 return {x:(rotated?item.footprint.h:item.footprint.w)*.5,
         y:(rotated?item.footprint.w:item.footprint.h)*.5};
};
function bounds(obj,catalog){
 const half=halfSize(obj,catalog);
 if(!half)return null;
 return {left:obj.x-half.x,right:obj.x+half.x,
         top:obj.y-half.y,bottom:obj.y+half.y};
}
const solidWalls=(room,catalog)=>(room.walls||[]).filter(w=>catalog.walls[w.style]?.solid);
const vertical=w=>w.edge==='west'||w.edge==='east';
function overlapsSegment(start,end,wallStart,wallEnd){
 return end>wallStart+EPS&&start<wallEnd-EPS;
}
function crossesWall(obj,room,catalog){
 const b=bounds(obj,catalog);
 if(!b)return true;
 return solidWalls(room,catalog).some(w=>{
  if(vertical(w))return overlapsSegment(b.top,b.bottom,w.y,w.y+1)&&
   b.left<w.x-EPS*.5&&b.right>w.x+EPS*.5;
  return overlapsSegment(b.left,b.right,w.x,w.x+1)&&
   b.top<w.y-EPS*.5&&b.bottom>w.y+EPS*.5;
 });
}
function snap(obj,room,catalog,previous=null){
 const half=halfSize(obj,catalog);
 if(!half||!Number.isFinite(obj.x)||!Number.isFinite(obj.y))return obj;
 const minX=half.x+EPS,maxX=room.width-half.x-EPS;
 const minY=half.y+EPS,maxY=room.height-half.y-EPS;
 if(maxX<minX||maxY<minY)return obj;
 const candidate={...obj,
  x:clamp(obj.x,minX,maxX),
  y:clamp(obj.y,minY,maxY)};
 const walls=solidWalls(room,catalog);
 for(const axis of ['x','y']){
  const otherAxis=axis==='x'?'y':'x';
  const radius=half[axis],otherRadius=half[otherAxis];
  const lower=axis==='x'?minX:minY,upper=axis==='x'?maxX:maxY;
  const targets=[lower,upper];
  for(const w of walls){
   if(vertical(w)!==(axis==='x'))continue;
   const coord=axis==='x'?w.x:w.y;
   const start=axis==='x'?w.y:w.x;
   const otherValue=candidate[otherAxis];
   if(!overlapsSegment(otherValue-otherRadius,otherValue+otherRadius,start,start+1))continue;
   const before=coord-radius-EPS,after=coord+radius+EPS;
   targets.push(before,after);
   // A dragged prop must not teleport through an internal wall if its
   // pointer crosses the wall in one event. Clamp on the original side.
   if(previous&&Number.isFinite(previous[axis])&&
      overlapsSegment(previous[otherAxis]-otherRadius,
                      previous[otherAxis]+otherRadius,start,start+1)){
    if(previous[axis]+radius<=coord+EPS&&candidate[axis]+radius>coord-EPS){
     candidate[axis]=Math.min(candidate[axis],before);
    }else if(previous[axis]-radius>=coord-EPS&&candidate[axis]-radius<coord+EPS){
     candidate[axis]=Math.max(candidate[axis],after);
    }
   }
  }
  const closest=targets.filter(t=>t>=lower-1e-6&&t<=upper+1e-6)
   .sort((a,b)=>Math.abs(a-candidate[axis])-Math.abs(b-candidate[axis]))[0];
  if(Number.isFinite(closest)&&Math.abs(candidate[axis]-closest)<=SNAP)
   candidate[axis]=closest;
  candidate[axis]=clamp(candidate[axis],lower,upper);
 }
 // When two perpendicular walls meet, a seemingly good axis snap can
 // cross the other wall. Keep the last legal candidate in that case.
 if(crossesWall(candidate,room,catalog)){
  const unSnapped={...obj,x:clamp(obj.x,minX,maxX),y:clamp(obj.y,minY,maxY)};
  return crossesWall(unSnapped,room,catalog)?obj:unSnapped;
 }
 return candidate;
}
const api=Object.freeze({snap,bounds,crossesWall,halfSize,epsilon:EPS});
root.MindRoomPlacement=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:{});
