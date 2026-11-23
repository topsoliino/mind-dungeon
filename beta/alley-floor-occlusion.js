// Single source of truth for enemy visibility and painter depth across
// prison storeys, upper slabs, and the last exposed stair treads.
// Pure logic: no canvases, allocations beyond one tiny result, GPU work or
// camera assumptions. The same rules cover skeletal and rat silhouettes.
window.AlleyFloorOcclusion=(()=>{
 'use strict';
 const clamp=x=>Math.max(0,Math.min(1,x));
 function evaluate(enemy,{base=0,viewFloor=base,height=132,mouth=false}={}){
  if(!enemy)return {visible:false,depthBand:0};
  const realFloor=Number.isInteger(enemy.alleyFloor)?enemy.alleyFloor:base;
  const ride=enemy.alleyClimb;
  // e.alleyZ is the physical height relative to the CURRENT storey's
  // ground plane. It is not an absolute level number. Sorting by
  // alleyFloor===1 or Boolean(alleyClimb) makes low-level rats and skeletons
  // draw IN FRONT of the second-storey slab.
  const relative=ride?(Number.isFinite(enemy.alleyZ)?enemy.alleyZ:0):
   realFloor===base+1?height:
   Number.isFinite(enemy.alleyZ)?enemy.alleyZ:0;
  const depthBand=relative>=height*.73?7000:0;
  if(!ride)return {visible:realFloor===viewFloor,depthBand};
  const t=clamp((ride.age||0)/Math.max(.001,ride.duration||1));
  const rising=ride.to>ride.from;
  let visible=false;
  if(viewFloor===ride.from){
   // The departing enemy remains on the origin level until it reaches
   // the stairhead; an enemy descending from above disappears as its
   // feet leave the overhead opening.
   visible=rising?t<.94:t<.4;
  }else if(viewFloor===ride.to){
   // Reveal an ascending enemy just BEFORE the top landing, but only
   // through the visible aperture. Never let it show through solid slab.
   visible=rising?(t>=.68&&mouth):t>=.72;
  }
  return {visible,depthBand};
 }
 return {evaluate};
})();
