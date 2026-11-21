// Blender-baked small rat: editable armature, 32 independent 3D views/animation.
window.AlleyRat=(()=>{
 'use strict';
 const CELL=96,VIEWS=32,TAU=Math.PI*2,VERSION=1;
 const files=['idle','run','stalk','jump','bite','combo','dodge','dodge-left','death'];
 const sheets=new Map();
 const DEATH_SECONDS=1.15;
 const clamp=(x)=>Math.max(0,Math.min(1,x));
 const wrap=(x,n)=>((x%n)+n)%n;
 async function load(){
  sheets.clear();
  await Promise.all(files.map(async clip=>{
   const image=new Image();
   image.src='beta/art/rat/'+clip+'.webp?v='+VERSION;
   try{
    await image.decode();
    if(image.height!==VIEWS*CELL||image.width<CELL||
       image.width%CELL||!image.width)
     throw Error('Unexpected rat atlas size '+image.width+'x'+image.height);
    sheets.set(clip,image);
   }catch(error){
    // A missing rat sheet must not block loading; legacy rat art is the fallback.
    console.warn('Rat Blender atlas unavailable: '+clip,error);
   }
  }));
 }
 function choose(e,rules,deathAge){
  if(deathAge!==null)return {clip:'death',t:clamp(deathAge/DEATH_SECONDS)};
  const motion=e.ratMotion;
  if(motion&&motion.time>0)
   return {clip:motion.name,t:clamp(1-motion.time/motion.duration)};
  const spec=rules.attacks[e.type];
  if(spec&&(e.windup>0||e.runAttack>0||e.recover>0)){
   const clip=e.ratAttackClip==='combo'?'combo':'bite';
   const t=e.windup>0?.25*(1-e.windup/spec.windup):
    e.runAttack>0?.25+.57*(1-e.runAttack/Math.max(.01,e.runDuration)):
    .82+.18*(1-e.recover/spec.recovery);
   return {clip,t:clamp(t)};
  }
  const stalk=Boolean(e.ratStalking);
  return {clip:e.moving?(stalk?'stalk':'run'):'idle',
   t:((e.phase*(stalk?1.05:e.moving?2.0:.85))%1+1)%1};
 }
 function sprite(e,iso,rules,deathAge=null){
  if(!e||e.type!==rules.RAT)return null; // Electro-rats retain their own effect.
  const {clip,t}=choose(e,rules,deathAge);
  const image=sheets.get(clip);
  if(!image)return null;
  const cols=image.width/CELL,col=Math.min(cols-1,Math.floor(t*cols));
  const facing=Number.isFinite(e.facing)?e.facing:Number.isFinite(e.angle)?e.angle:0;
  const exact=wrap(VIEWS/8-facing*VIEWS/TAU,VIEWS);
  const row=Math.floor(exact);
  const p=iso.toView(e.x,e.y);
  const alpha=deathAge===null?(e.hit>0?.75:1):clamp((2.6-deathAge)/.55);
  return {image,key:'rat-'+clip,frame:row+'-'+col,sx:col*CELL,sy:row*CELL,
   w:CELL,h:CELL,width:89*(e.size||1),height:89*(e.size||1),
   x:p.x,y:p.y,depth:p.y,originX:.5,originY:.76,alpha};
 }
 function sprites(e,iso,rules,deathAge=null){
  const base=sprite(e,iso,rules,deathAge);
  if(!base)return [];
  const facing=Number.isFinite(e.facing)?e.facing:Number.isFinite(e.angle)?e.angle:0;
  const exact=wrap(VIEWS/8-facing*VIEWS/TAU,VIEWS);
  const low=Math.floor(exact),w=exact-low;
  if(w<.02||w>.98)return [base];
  return [
   {...base,sy:low*CELL,frame:low+'-'+base.sx/CELL,alpha:base.alpha*(1-w)},
   {...base,sy:wrap(low+1,VIEWS)*CELL,frame:wrap(low+1,VIEWS)+'-'+base.sx/CELL,
    alpha:base.alpha*w,depth:base.depth+.0001}
  ];
 }
 return {load,sprite,sprites,choose,clips:files};
})();
