// Canonical skeleton selection for the Guardian-derived LIVE 3D GLB rigs.
// All eight legacy 32-way WebP atlases and their loader were permanently
// retired. Rendering remains in dungeon-enemy-rig.js for EVERY pose.
window.AlleySkeleton=(()=>{
 'use strict';
 const deathDuration=.78;
 function choose(e,rules,deathAge=null){
  const spec=rules.attacks[e.type],bow=e.skeleton==='bow';
  if(!spec||!e.skeleton)return null;
  let clip=e.moving?'run':'idle',t=(e.phase*(e.moving?1.65:.8))%1;
  if(deathAge!==null){clip='death';t=Math.min(1,deathAge/deathDuration);}
  else if(e.skeletonAction){
   const a=e.skeletonAction;
   clip=a.name;
   if(clip.startsWith('cartwheel')&&e.skeletonWheelSide<0)
    clip+='-left';
   if(e.moving&&['shoot','double-shoot','throw','combo','slash','overhead'].includes(clip))
    clip+='-run';
   t=a.age/Math.max(.001,a.duration);
  }else if(e.windup>0||e.runAttack>0||e.recover>0){
   clip=bow?'shoot':'strike';
   const boundary=bow?.62:.47;
   t=e.windup>0?boundary*(1-e.windup/spec.windup):
    e.runAttack>0?boundary+(.89-boundary)*(1-e.runAttack/Math.max(.01,e.runDuration)):
    .89+.11*(1-e.recover/Math.max(.01,spec.recovery));
  }
  return {clip,t:Math.max(0,Math.min(1,t)),kit:e.skeleton};
 }
 function encounters(generator,alley){
  const rooms=(generator.rooms||[]).filter(r=>r.kind==='raum'&&r.cells?.length);
  // Keep the starting chamber safe. Spread at most four visible opponents
  // through a ten-room floor, alternating melee and ranged encounters.
  const limit=Math.min(4,Math.ceil(rooms.length/3));
  const encounters=[];
  for(const room of rooms){
   const [cx,cy]=room.cells.reduce(([a,b],[x,y])=>[a+x/room.cells.length,b+y/room.cells.length],[0,0]);
   const cells=room.cells.slice().sort(([x,y],[u,v])=>
    (x-cx)**2+(y-cy)**2-(u-cx)**2-(v-cy)**2);
   for(const [u,v] of cells){
    const point={x:(u+.5)*48,y:(v+.5)*48};
    if(Math.hypot(point.x-alley.spawn.x,point.y-alley.spawn.y)<168||
       encounters.some(p=>Math.hypot(point.x-p.x,point.y-p.y)<112)||
       !alley.walkable(point.x,point.y,19)||!alley.routeTo(alley.spawn,point))continue;
    encounters.push({...point,roomId:room.id,skeleton:encounters.length%2?'bow':'sabre'});
    break;
   }
   if(encounters.length>=limit)break;
  }
  return encounters;
 }
 return {choose,encounters};
})();
