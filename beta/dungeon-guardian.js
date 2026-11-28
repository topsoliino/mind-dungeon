(() => {
 'use strict';

 // In each exported cut, the blade passes through the forward axis here.
 const heavyImpact=.28;
 let light={duration:.36,impact:.25,chain:.8,retime:{}};
 const clamp=value=>Math.max(0,Math.min(1,value));
 const hitClip=share=>share>=.36?'hit-down':share>=.16?'hit-strong':'hit-light';

 async function load(root){
  const [response,settings]=await Promise.all([
   fetch(root+'guardian-frames.json?v=18'),fetch(root+'guardian-light-attacks.json?v=1').catch(()=>null)
  ]);
  if(!response.ok)throw new Error('Wächter-Animationen konnten nicht geladen werden.');
  const atlas=await response.json();
  if(settings?.ok)light=await settings.json();
  const {loadRig}=await import('./dungeon-guardian-rig.js?v=strike2');
  const rig=await loadRig(root+'guardian-rig.glb.gz?v=3',atlas.clips);
  return {atlas,rig};
 }
 function hitDistance(hit,progress){
  const {path}=hit;
  const index=path.findIndex(([t])=>t>=progress);
  if(index<=0)return path[index<0?path.length-1:0][1];
  const [from,a]=path[index-1],[to,b]=path[index];
  const t=clamp((progress-from)/(to-from));
  return a+(b-a)*t*t*(3-2*t);
 }
 function attackProgress(clip,time){
  const keys=light.retime?.[clip],t=clamp(time);
  if(keys){
   for(let i=1;i<keys.length;i++){
    const [end,to]=keys[i];if(t>end)continue;
    const [start,from]=keys[i-1];return from+(to-from)*(t-start)/(end-start);
   }
  }
  if(clip==='heavy-sword'||clip==='heavy-hammer'){
   const hit=clip==='heavy-hammer'?7/21:heavyImpact;
   if(t<=hit){const u=t/hit;return hit*u*(.42+.58*u);}
   const u=(t-hit)/(1-hit);return hit+(1-hit)*u*(1.45-.45*u);
  }
  return t;
 }
 window.DungeonGuardian={attackProgress,load,hitClip,hitDistance,heavyImpact,get light(){return light;}};
})();

