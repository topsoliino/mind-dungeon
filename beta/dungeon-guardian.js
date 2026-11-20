(() => {
 'use strict';

 const scale=110/128,ground=.77597*110;
 const directionCount=8;
 // In each exported cut, the blade passes through the forward axis here.
 const strikeProgress={down:.51,up:.43,'heavy-sword':.28};
 const clamp=value=>Math.max(0,Math.min(1,value));
 const hitClip=share=>share>=.36?'hit-down':share>=.16?'hit-strong':'hit-light';

 function loadLayer(root,filenames){
  return Promise.all(filenames.map(name=>new Promise((resolve,reject)=>{
   const image=new Image();
   image.onload=()=>resolve(image);
   image.onerror=()=>reject(new Error('Wächter-Textur konnte nicht geladen werden: '+name));
   image.src=root+name+'?v=17';
  })));
 }
 async function load(root){
  const response=await fetch(root+'guardian-frames.json?v=17');
  if(!response.ok)throw new Error('Wächter-Animationen konnten nicht geladen werden.');
  const atlas=await response.json();
  try{
   const {loadRig}=await import('./dungeon-guardian-rig.js?v=1');
   return {atlas,rig:await loadRig(root+'guardian-rig.glb.gz?v=1')};
  }catch(error){
   console.warn('3D-Wächter nicht verfügbar. Sprite-Wächter wird verwendet.',error);
   const layers=await Promise.all(['body','weapon'].map(key=>loadLayer(root,atlas.sheets[key])));
   return {atlas,layers};
  }
 }
 function facing(angle){
  const projected=Math.atan2(Math.sin(angle)/.47,Math.cos(angle));
  return (Math.round(projected/(Math.PI/4))+directionCount)%directionCount;
 }
 function parts(guardian,clip,progress,angle,x,y,armed,alpha=1){
  const {atlas,layers}=guardian;
  const [start,count]=atlas.clips[clip];
  const step=Math.min(count-1,Math.floor(clamp(progress)*count));
  const index=(start+step)*directionCount+facing(angle);
  const raw=[atlas.body[index],armed?atlas.weapon[index]:null];
  return raw.map((data,layer)=>{
   if(!data)return null;
   const [sx,sy,w,h,dx,dy,page]=data;
   return {image:layers[layer][page],key:'beta-guardian-'+layer+'-'+page,frame:String(index),
    sx,sy,w,h,x:x-55+dx*scale,y:y-ground+dy*scale,width:w*scale,height:h*scale,alpha};
  }).filter(Boolean);
 }
 function hitDistance(hit,progress){
  const {path}=hit;
  const index=path.findIndex(([t])=>t>=progress);
  if(index<=0)return path[index<0?path.length-1:0][1];
  const [from,a]=path[index-1],[to,b]=path[index];
  const t=clamp((progress-from)/(to-from));
  return a+(b-a)*t*t*(3-2*t);
 }
 window.DungeonGuardian={load,parts,hitClip,hitDistance,strikeProgress};
})();
