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
  const {loadRig}=await import('./dungeon-guardian-rig.js?v=8');
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
 window.DungeonGuardian={load,hitClip,hitDistance,heavyImpact,get light(){return light;}};
})();

