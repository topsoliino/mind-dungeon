// The ONLY fallback for live skeletons: authentic Guardian-lit Blender
// animation views, baked from the very same skinned GLB for smooth gameplay.
window.AlleySkeleton=(()=>{
 'use strict';
 const deathDuration=.78;
 function choose(e,rules,deathAge=null){
  const spec=rules.attacks[e.type],bow=e.skeleton==='bow';
  if(!spec||!e.skeleton)return null;
  let clip=e.moving?'run':'idle',t=(e.phase*(e.moving?1.65:.8))%1;
  if(deathAge!==null){clip='death';t=Math.min(1,deathAge/deathDuration);}
  else if(e.alleyClimb){
   const ride=e.alleyClimb;
   if(ride.connector.kind==='ladder'){
    clip='climb';t=(ride.age/ride.duration*3)%1;
    if(!ride.up)t=1-t;
   }else{clip='run';t=(ride.age*1.65)%1;}
  }
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
 // Authoritative Blender GLB snapshots, baked OFFLINE to 32 full 3D
 // directions. Never draw a made-up skeletal placeholder or retired model.
 const TAU=Math.PI*2,VIEWS=32,ELEVATION=Math.atan(1/Math.sqrt(2));
 const sheets=new Map(),pending=new Map();
 let atlas=null;
 const name=(kit,clip)=>clip==='climb'?'both-climb':kit+'-'+clip;
 const wrap=(n,max)=>((n%max)+max)%max;
 async function ensure(kit,clip){
  if(!atlas?.clips?.[kit]?.[clip])return null;
  const key=name(kit,clip);
  if(sheets.has(key))return sheets.get(key);
  if(pending.has(key))return pending.get(key);
  const task=(async()=>{
   try{
    const src=clip==='climb'?'beta/art/skeleton/atlas-both-climb.webp?v=1':'beta/art/skeleton/atlas-'+kit+'-'+clip+
     '.webp?v='+atlas.source[kit].slice(0,16);
    const image=new Image();image.src=src;
    await image.decode();
    if(image.width!==atlas.cell*atlas.clips[kit][clip]||
       image.height!==atlas.cell*VIEWS)
     throw Error('Unexpected Blender atlas dimensions '+kit+':'+clip);
    sheets.set(key,image);return image;
   }catch(error){
    console.warn('Blender skeleton pose atlas unavailable:',key,error);
    return null;
   }finally{pending.delete(key);}
  })();
  pending.set(key,task);
  return task;
 }
 async function load(){
  try{
   const response=await fetch('beta/art/skeleton/skeleton-atlas.json?v=2',
    {cache:'no-cache'});
   if(!response.ok)throw Error('Original skeleton atlases not published yet');
   const config=await response.json();
   const manifest=await (await fetch('beta/art/skeleton/skeleton-live.json?v=11',
    {cache:'no-cache'})).json();
   if(config.views!==VIEWS||config.cell<96||
      config.source?.sabre!==manifest.sabre.sourceBlendSha256||
      config.source?.bow!==manifest.bow.sourceBlendSha256)
    throw Error('Atlas differs from current original Blender skeleton models');
   atlas=config;
   const loaded=await Promise.all([
    ensure('sabre','idle'),ensure('sabre','run'),
    ensure('bow','idle'),ensure('bow','run'),ensure('bow','climb')
   ]);
   if(loaded.every(Boolean)){
    // Predecode the first likely melee and ranged attack while the loading
    // screen is up. Their real bone animation will be available immediately.
    await Promise.allSettled([ensure('sabre','combo'),ensure('bow','shoot')]);
    return true;
   }
   atlas=null;sheets.clear();
   return false;
  }catch(error){
   console.warn('Using original live 3D Blender skeletons:',error);
   atlas=null;sheets.clear();return false;
  }
 }
 function hasBaked(){return Boolean(atlas&&
  sheets.has('sabre-idle')&&sheets.has('sabre-run')&&
  sheets.has('bow-idle')&&sheets.has('bow-run'));}
 function loaded(){return [...sheets].map(([key,image])=>({
  key:'alley-skeleton-baked-'+key,image,
  columns:atlas.clips[key.startsWith('both-')?'bow':key.split('-')[0]][key.slice(key.indexOf('-')+1)],
  rows:VIEWS,cell:atlas.cell
 }));}
 function sprite(e,iso,rules,deathAge=null){
  if(!hasBaked())return null;
  const selected=choose(e,rules,deathAge);
  if(!selected)return null;
  const kit=selected.kit,clip=selected.clip;
  if(!sheets.has(name(kit,clip)))void ensure(kit,clip);
  // While a special pose is decoding, retain the same authentic 3D skeleton
  // with its run/idle movement instead of drawing a fake dummy.
  const shown=sheets.has(name(kit,clip))?clip:
   e.moving&&sheets.has(name(kit,'run'))?'run':'idle';
  const image=sheets.get(name(kit,shown));
  if(!image)return null;
  const frames=atlas.clips[kit][shown],column=Math.max(0,
   Math.min(frames-1,Math.floor(selected.t*frames)));
  const heading=Number.isFinite(e.facing)?e.facing:
   Number.isFinite(e.angle)?e.angle:0;
  const view=iso.viewAngle(heading);
  const yaw=Math.atan2(Math.cos(view),Math.sin(view)/Math.sin(ELEVATION));
  const row=wrap(Math.round(yaw/TAU*VIEWS),VIEWS);
  const p=iso.toView(e.x,e.y,e.alleyZ||0);
  const feet=iso.toView(e.x,e.y,0).y;
  const size=116*(e.size||1),cell=atlas.cell;
  return {image,key:'alley-skeleton-baked-'+name(kit,shown),
   frame:row+'-'+column,sx:column*cell,sy:row*cell,
   w:cell,h:cell,x:p.x-size/2,
   y:p.y-size*(atlas.groundFraction[kit]??.71),
   width:size,height:size,originX:0,originY:0,
   depth:(e.alleyFloor===1||e.alleyClimb?7000:0)+feet,
   alpha:deathAge===null?1:Math.max(0,Math.min(1,(2.6-deathAge)/.55))};
 }
 return {choose,encounters,load,hasBaked,loaded,sprite};
})();

