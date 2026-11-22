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
 // Visible emergency drawing when a compressed GLB, Three.js CDN or WebGL
 // cannot load. This is a NEW lightweight bone silhouette, not the discarded
 // legacy skeleton atlas; the Blender 3D model remains the preferred render.
 const fallbackImages=new Map();
 function safeImage(kind,pose,step){
  const key=kind+'-'+pose+'-'+step;
  if(fallbackImages.has(key))return fallbackImages.get(key);
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  const phase=step*Math.PI/4,swing=pose==='run'?Math.sin(phase)*9:0;
  const attack=pose==='strike'||pose==='combo'||pose==='slash'||
   pose==='overhead'||pose==='shoot'||pose==='throw';
  const arm=attack?Math.sin((step+1)*Math.PI/8)*16:0;
  function bone(x,y,u,v,w=5){
   g.lineCap='round';g.lineJoin='round';
   g.strokeStyle='#323d42';g.lineWidth=w+3;
   g.beginPath();g.moveTo(x+1,y+2);g.lineTo(u+1,v+2);g.stroke();
   g.strokeStyle='#d2cab0';g.lineWidth=w;
   g.beginPath();g.moveTo(x,y);g.lineTo(u,v);g.stroke();
   g.strokeStyle='#f1e8cf';g.lineWidth=Math.max(1,w*.28);
   g.beginPath();g.moveTo(x-1,y-1);g.lineTo(u-1,v-1);g.stroke();
  }
  g.fillStyle='#00000033';g.beginPath();g.ellipse(64,111,20,5,0,0,Math.PI*2);g.fill();
  // Legs, pelvis, ribs and vertebrae: always recognizable as a skeleton.
  bone(55,69,50+swing,88,8);bone(50+swing,88,48+swing*1.4,109,6);
  bone(71,69,76-swing,89,8);bone(76-swing,89,81-swing*1.4,109,6);
  bone(55,69,71,69,8);bone(63,36,63,72,6);
  for(let j=0;j<4;j++){
   const y=43+j*6,r=13-j*1.7;
   bone(63,y,63-r,y+3,3);bone(63,y,63+r,y+3,3);
  }
  bone(62,30,63,37,6);
  bone(56,39,43,51+arm*.3,6);bone(43,51+arm*.3,37,67+arm*.6,4);
  bone(71,39,83,50-arm*.3,6);bone(83,50-arm*.3,91,66-arm*.9,4);
  g.fillStyle='#dfd4b7';g.strokeStyle='#3b4140';g.lineWidth=2;
  g.beginPath();g.ellipse(63,21,12,15,0,0,Math.PI*2);g.fill();g.stroke();
  g.fillStyle='#1b252b';g.beginPath();g.ellipse(58,22,3,4,-.2,0,Math.PI*2);
  g.ellipse(68,22,3,4,.2,0,Math.PI*2);g.fill();
  g.strokeStyle='#394347';g.lineWidth=1.4;g.beginPath();
  g.moveTo(58,32);g.lineTo(68,32);g.stroke();
  if(kind==='bow'){
   g.strokeStyle='#8c5c38';g.lineWidth=4;g.beginPath();
   g.arc(93,58-arm*.8,21,-Math.PI*.45,Math.PI*.45);g.stroke();
   g.strokeStyle='#e0cda3';g.lineWidth=1;g.beginPath();
   g.moveTo(96,41-arm*.8);g.lineTo(96,75-arm*.8);g.stroke();
   if(attack){bone(55,59,104,56,2);}
  }else{
   bone(91,66-arm*.9,96,44-arm*.9,3);
   g.strokeStyle='#d9e4e0';g.lineWidth=5;g.beginPath();
   g.moveTo(96,44-arm*.9);g.lineTo(108,16-arm*.9);g.stroke();
   g.strokeStyle='#8ba9ad';g.lineWidth=2;g.beginPath();
   g.moveTo(96,44-arm*.9);g.lineTo(108,16-arm*.9);g.stroke();
  }
  fallbackImages.set(key,c);
  return c;
 }
 function fallback(e,iso,deathAge=null){
  const selection=choose(e,{attacks:{[e.type]:{windup:.4,recovery:.4}}},deathAge);
  const pose=deathAge!==null?'death':selection?.clip||'idle';
  const step=Math.floor((deathAge!==null?deathAge*6:e.phase*6)%8);
  const image=safeImage(e.skeleton||'sabre',pose,step);
  const p=iso.toView(e.x,e.y,e.alleyZ||0);
  const foot=iso.toView(e.x,e.y,0).y;
  const size=116*(e.size||1);
  return {image,key:'alley-skeleton-safe-'+(e.skeleton||'sabre')+'-'+pose+'-'+step,
   x:p.x-size/2,y:p.y-size*.87,width:size,height:size,
   originX:0,originY:0,depth:(e.alleyFloor===1||e.alleyClimb?7000:0)+foot,
   alpha:deathAge===null?1:Math.max(0,1-deathAge/1.4),
   angle:deathAge===null?0:Math.min(.95,deathAge)*1.1};
 }
 return {choose,encounters,fallback};
})();
