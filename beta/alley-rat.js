// Blender-baked small rat: editable armature, 32 independent 3D views/animation.
window.AlleyRat=(()=>{
 'use strict';
 const CELL=128,VIEWS=32,TAU=Math.PI*2,VERSION=9;
 const files=['idle','run','stalk','strafe-left','strafe-right','back','jump','bite','combo','dodge','dodge-left','death'];
 const sheets=new Map(),pending=new Map();
 const DEATH_SECONDS=1.15;
 const clamp=(x)=>Math.max(0,Math.min(1,x));
 const wrap=(x,n)=>((x%n)+n)%n;
 // The old eager loader decoded twelve enormous 4k-high atlases at once.
 // Keep only the common gaits in memory and load special clips on demand.
 // GPU residency is likewise limited to actual in-view animation frames.
 function ensure(clip){
  if(sheets.has(clip))return Promise.resolve(sheets.get(clip));
  if(pending.has(clip))return pending.get(clip);
  const task=(async()=>{
   const image=new Image();
   image.src='beta/art/rat/'+clip+'.webp?v='+VERSION;
   try{
    await image.decode();
    const textureCell=image.height/VIEWS;
    if(![96,128].includes(textureCell)||image.width<textureCell||
       image.width%textureCell||!image.width)
     throw Error('Unexpected rat atlas size '+image.width+'x'+image.height);
    sheets.set(clip,image);
    return image;
   }catch(error){
    console.warn('Rat Blender atlas unavailable: '+clip,error);
    return null;
   }finally{pending.delete(clip);}
  })();
  pending.set(clip,task);
  return task;
 }
 async function load(){
  sheets.clear();pending.clear();
  // Death is a 4096px-high atlas. Decode it only when a rat is
  // seriously hurt or dying; locomotion and bite remain preloaded.
  await Promise.all(['idle','run','bite'].map(ensure));
 }
 function choose(e,rules,deathAge){
  if(deathAge!==null)return {clip:'death',t:clamp(deathAge/DEATH_SECONDS)};
  if(e.alleyClimb)return {clip:'run',t:(e.alleyClimb.age*2)%1};
  const motion=e.ratMotion;
  if(motion&&motion.time>0)
   return {clip:motion.name,t:clamp(1-motion.time/motion.duration)};
  const spec=rules.attacks[e.type];
  if(!e.moving&&spec&&(e.windup>0||e.runAttack>0||e.recover>0)){
   const clip=e.ratAttackClip==='combo'?'combo':'bite';
   const t=e.windup>0?.25*(1-e.windup/spec.windup):
    e.runAttack>0?.25+.57*(1-e.runAttack/Math.max(.01,e.runDuration)):
    .82+.18*(1-e.recover/spec.recovery);
   return {clip,t:clamp(t)};
  }
  const stalk=Boolean(e.ratStalking);
  let clip=e.moving?(stalk?'stalk':'run'):'idle';
  if(e.moving){
   // Facing stays pointed at the target: use the actual collision-resolved
   // translation vector to animate lateral steps and rearward retreat.
   const look=Number.isFinite(e.angle)?e.angle:e.facing??0;
   const move=Number.isFinite(e.ratMoveAngle)?e.ratMoveAngle:
    Number.isFinite(e.facing)?e.facing:look;
   const difference=Math.atan2(Math.sin(move-look),Math.cos(move-look));
   if(Math.cos(difference)<-.52)clip='back';
   else if(Math.abs(Math.sin(difference))>.70&&Math.abs(Math.cos(difference))<.72)
    clip=Math.sin(difference)>0?'strafe-right':'strafe-left';
  }
  return {clip,t:e.moving&&Number.isFinite(e.gait)?e.gait:((e.phase*(stalk?1.05:e.moving?2.0:.85))%1+1)%1};
 }
 function sprite(e,iso,rules,deathAge=null){
  if(!e||e.type!==rules.RAT)return null; // Electro-rats retain their own effect.
  // Start decoding the Blender death atlas before the fatal hit whenever
  // possible, without paying its full memory cost during loading.
  if(deathAge===null&&e.max>0&&e.hp>0&&e.hp/e.max<.42&&!sheets.has('death'))
   void ensure('death');
  const {clip,t}=choose(e,rules,deathAge);
  // Older cached atlases remain valid while Blender CI rebuilds the new
  // gait sheets. Missing directions fall back to the existing run atlas.
  if(!sheets.has(clip)&&!pending.has(clip))void ensure(clip);
  const renderedClip=sheets.has(clip)?clip:
   sheets.has('run')?'run':sheets.has('idle')?'idle':clip;
  const image=sheets.get(renderedClip);
  if(!image)return null;
  const textureCell=image.height/VIEWS;
  const cols=image.width/textureCell,col=Math.min(cols-1,Math.floor(t*cols));
  const facing=Number.isFinite(e.facing)?e.facing:Number.isFinite(e.angle)?e.angle:0;
  const exact=wrap(VIEWS/8-facing*VIEWS/TAU,VIEWS);
  const row=wrap(Math.round(exact),VIEWS);
  const p=iso.toView(e.x,e.y,e.alleyZ||0);
  const alpha=deathAge===null?1:clamp((2.6-deathAge)/.55);
  return {image,key:'rat-'+renderedClip,frame:row+'-'+col,sx:col*textureCell,sy:row*textureCell,
   w:textureCell,h:textureCell,width:114*(e.size||1),height:114*(e.size||1),
   x:p.x,y:p.y,depth:(e.alleyFloor===1||e.alleyClimb?7000:0)+p.y,originX:.5,originY:.65,alpha};
 }
 function sprites(e,iso,rules,deathAge=null){
  // OPAQUE nearest-facing 3D model. The previous weighted pair rendered
  // two individually semi-transparent complete rats, making the stone floor
  // show through both bodies in the screenshot. Thirty-two facings already
  // provide 11.25-degree coverage without translucent ghosting.
  const view=sprite(e,iso,rules,deathAge);
  return view?[view]:[];
 }
 function encounters(generator,alley,occupied=[]){
  const rooms=(generator.rooms||[]).filter(r=>r.kind==='raum'&&r.id!==0&&r.cells?.length);
  const results=[];
  for(const room of rooms){
   if(room.id%2===0)continue; // occasional small enemies, not a swarm in every room
   const cells=room.cells.slice().sort((a,b)=>{
    const center=room.cells.reduce((s,p)=>[s[0]+p[0]/room.cells.length,s[1]+p[1]/room.cells.length],[0,0]);
    return Math.hypot(a[0]-center[0],a[1]-center[1])-
     Math.hypot(b[0]-center[0],b[1]-center[1]);
   });
   for(const [u,v] of cells){
    const point={x:(u+.5)*48,y:(v+.5)*48};
    if(Math.hypot(point.x-alley.spawn.x,point.y-alley.spawn.y)<168||
       occupied.concat(results).some(p=>Math.hypot(p.x-point.x,p.y-point.y)<78)||
       !alley.walkable(point.x,point.y,15)||
       !alley.routeTo(alley.spawn,point))continue;
    results.push({...point,roomId:room.id});
    break;
   }
   if(results.length>=3)break;
  }
  return results;
 }
 return {load,sprite,sprites,choose,encounters,clips:files};
})();

