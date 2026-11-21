// Eight baked Blender views per clip. Both isometric renderers use the same frame.
window.AlleySkeleton=(()=>{
 'use strict';
 const sheets=new Map(),cell=96,deathDuration=.78;
 async function load(){
  await Promise.all(['sabre','bow'].flatMap(kit=>
   ['idle','run',kit==='bow'?'shoot':'strike','death'].map(async clip=>{
    const key=kit+'-'+clip,image=new Image();
    image.src='beta/art/skeleton/'+key+'.webp';
    await image.decode();
    sheets.set(key,image);
   })));
 }
 function sprite(e,iso,rules,deathAge=null){
  const spec=rules.attacks[e.type],bow=e.skeleton==='bow';
  let clip=e.moving?'run':'idle',t=(e.phase*(e.moving?1.65:.8))%1;
  if(deathAge!==null){clip='death';t=Math.min(1,deathAge/deathDuration);}
  else if(e.windup>0||e.runAttack>0||e.recover>0){
   clip=bow?'shoot':'strike';
   const boundary=bow?.62:.47;
   t=e.windup>0?boundary*(1-e.windup/spec.windup):
    e.runAttack>0?boundary+(.89-boundary)*(1-e.runAttack/e.runDuration):
    .89+.11*(1-e.recover/spec.recovery);
  }
  const key=e.skeleton+'-'+clip,image=sheets.get(key);
  if(!image)return null;
  const count=image.width/cell,col=Math.max(0,Math.min(count-1,Math.floor(t*count)));
  const row=(Math.round(1-(e.facing??e.angle)/(Math.PI/4))%8+8)%8;
  const p=iso.toView(e.x,e.y),size=110*e.size;
  return {image,key:'skeleton-'+key,frame:row+'-'+col,sx:col*cell,sy:row*cell,w:cell,h:cell,
   width:size,height:size,x:p.x,y:p.y,depth:p.y,originX:.5,originY:.765,
   alpha:deathAge===null?(e.hit>0?.72:1):Math.min(1,Math.max(0,(2.6-deathAge)/.5))};
 }
 function encounters(generator,alley){
  const encounters=[];
  for(const room of generator.rooms.filter(r=>r.kind==='raum')){
   const [cx,cy]=room.cells.reduce(([a,b],[x,y])=>[a+x/room.cells.length,b+y/room.cells.length],[0,0]);
   const cells=room.cells.slice().sort(([x,y],[u,v])=>
    (x-cx)**2+(y-cy)**2-(u-cx)**2-(v-cy)**2);
   for(const [u,v] of cells){
    const point={x:(u+.5)*48,y:(v+.5)*48};
    if(!alley.walkable(point.x,point.y,19)||!alley.routeTo(alley.spawn,point))continue;
    encounters.push({...point,roomId:room.id,skeleton:encounters.length?'bow':'sabre'});
    break;
   }
   if(encounters.length===2)break;
  }
  return encounters;
 }
 return {load,sprite,encounters};
})();
