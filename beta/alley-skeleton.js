// Blender-exported 360-degree directional atlases with continuous view interpolation.
window.AlleySkeleton=(()=>{
 'use strict';
 const sheets=new Map(),cell=128,deathDuration=.78,assetVersion=6,turn=Math.PI*2;
 async function load(){
  sheets.clear();
  await Promise.all(['sabre','bow'].flatMap(kit=>
   ['idle','run',kit==='bow'?'shoot':'strike','death'].map(async clip=>{
    const key=kit+'-'+clip,image=new Image();
    image.src='beta/art/skeleton/'+key+'.webp?v='+assetVersion;
    try{
     await image.decode();
     const textureCell=image.height/32;
     if(![96,128].includes(textureCell)||
        image.width<textureCell||image.width%textureCell)
      throw new Error('Ungültige Sprite-Abmessungen '+image.width+'×'+image.height);
     sheets.set(key,image);
    }catch(error){
     // One broken sprite must not prevent the entire dungeon from loading.
     // The standard enemy renderer remains available for this one enemy.
     console.warn('Skelett-Atlas fehlt oder ist beschädigt: '+key,error);
    }
   })));
 }
 function choose(e,rules,deathAge=null){
  const spec=rules.attacks[e.type],bow=e.skeleton==='bow';
  if(!spec||!e.skeleton)return null;
  let clip=e.moving?'run':'idle',t=(e.phase*(e.moving?1.65:.8))%1;
  if(deathAge!==null){clip='death';t=Math.min(1,deathAge/deathDuration);}
  else if(e.windup>0||e.runAttack>0||e.recover>0){
   clip=bow?'shoot':'strike';
   const boundary=bow?.62:.47;
   t=e.windup>0?boundary*(1-e.windup/spec.windup):
    e.runAttack>0?boundary+(.89-boundary)*(1-e.runAttack/Math.max(.01,e.runDuration)):
    .89+.11*(1-e.recover/Math.max(.01,spec.recovery));
  }
  return {clip,t:Math.max(0,Math.min(1,t)),kit:e.skeleton};
 }
 function sprite(e,iso,rules,deathAge=null){
  const selected=choose(e,rules,deathAge);
  if(!selected)return null;
  const {clip,t}=selected;
  const key=e.skeleton+'-'+clip,image=sheets.get(key);
  if(!image)return null;
  const textureCell=image.height/32;
  const count=image.width/textureCell,col=Math.max(0,Math.min(count-1,Math.floor(t*count)));
  const facing=Number.isFinite(e.facing)?e.facing:Number.isFinite(e.angle)?e.angle:0;
  // The atlas is baked camera-relatively: row zero looks toward the viewer,
  // while row two faces right in the projected scene.
  const views=image.height/cell;
  const row=((Math.round(views/8-facing*views/turn)%views)+views)%views;
  const p=iso.toView(e.x,e.y,e.alleyZ||0),size=140*e.size;
  return {image,key:'skeleton-'+key,frame:row+'-'+col,sx:col*textureCell,sy:row*textureCell,
   w:textureCell,h:textureCell,
   width:size,height:size,x:p.x,y:p.y,depth:(e.alleyFloor===1||e.alleyClimb?7000:0)+p.y,originX:.5,originY:.765,
   alpha:deathAge===null?1:Math.min(1,Math.max(0,(2.6-deathAge)/.5))};
 }
 function sprites(e,iso,rules,deathAge=null){
  // 32 independently baked 3D directions: use solid nearest-frame
  // rendering instead of two translucent skeletons overlaid. The old
  // cross-fade showed the dungeon floor through the bones (ghosting).
  const view=sprite(e,iso,rules,deathAge);
  return view?[view]:[];
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
 return {load,sprite,sprites,choose,encounters};
})();
