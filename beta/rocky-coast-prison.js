// Rocky Coast Prison: four navigable indoor stages, then the open terrain.
// Only L1 has an outside entrance; only L4 has a real exterior exit.
// L1-L3 advance through a completed, climbable 3D staircase.
(function(root){
 'use strict';
 const q=new URLSearchParams(root.location.search);
 const enabled=q.get('region')==='rocky-coast'&&q.get('szene')==='gasse'&&q.get('modus')==='generator';
 const level=enabled?Math.max(1,Math.min(5,Math.trunc(Number(q.get('level')))||1)):1;
 const description=['','Brandungsfundamente','Zellenblock','Versorgungsflügel',
  'Oberes Gefängnis','Rocky Coast · Hügel / Fluss / Meer'];
 const levels=Object.freeze(description.slice(1).map((title,i)=>Object.freeze({
  id:'rocky-coast-prison-l'+(i+1),index:i+1,title,
  type:i===4?'exterior':'interior',
  building:i===4?null:'rocky-coast-prison',
  region:'rocky-coast',dungeon:'rocky-coast-prison-dungeon',
  seed:(4147+7919*(i+1))>>>0
 })));
 const title='Rocky Coast Prison';
 const portalDistance=84;
 const toPoint=portal=>({x:portal.x*48,y:portal.y*48});
 const hasEntrance=enabled&&level===1,hasExit=enabled&&level===4;
 const hasAscent=enabled&&level>=1&&level<=3;
 let routing=false;
 function ascentPosition(){
  if(!hasAscent)return null;
  const vertical=root.AlleyVertical;
  if(!vertical?.enabled||vertical.state.floor!==1||
   vertical.state.stairRide||vertical.state.transition||vertical.state.pending)return null;
  const top=vertical.connectors.find(item=>item.kind==='stairs')?.top;
  return top?toPoint(top):null;
 }
 function nearest(actor,generator){
  if(!enabled||!actor)return null;
  if(level===5){
   const point={x:350,y:325},distance=Math.hypot(actor.x-point.x,actor.y-point.y);
   return distance<=portalDistance?{kind:'return',point,distance}:null;
  }
  const ascent=ascentPosition();
  if(ascent){
   const distance=Math.hypot(actor.x-ascent.x,actor.y-ascent.y);
   if(distance<=portalDistance)return {kind:'advance',point:ascent,distance};
  }
  // No entrance/exit on L2-L3; L4 is the sole exception with the
  // OUTGOING exit to the exterior. The starting doorway is never a shortcut.
  const exit=hasExit?generator?.outdoorExit:null;
  if(exit){
   if(root.AlleyVertical?.state?.floor===1)return null;
   const point=toPoint(exit),distance=Math.hypot(actor.x-point.x,actor.y-point.y);
   if(distance<=portalDistance)return {kind:'exit',point,distance};
  }
  return null;
 }
 function link(actor,generator){
  const portal=nearest(actor,generator);
  if(!portal)return null;
  if(portal.kind==='advance')return {
   kind:'stairs',target:level+1,entry:'from-lower',
   label:'Goldene Treppe · Aufstieg zu Ebene '+(level+1)
  };
  if(portal.kind==='exit')return {
   kind:'exit',target:5,entry:'from-lower',
   label:'Gefängnis verlassen · Rocky Coast'
  };
  if(portal.kind==='return')return {
   kind:'return',target:4,entry:'from-upper',
   label:'Zurück ins Gefängnis · Ebene 4'
  };
  return null;
 }
 function href(target,entry='from-lower'){
  if(!Number.isInteger(target)||target<1||target>5)throw Error('Invalid dungeon level '+target);
  const url=new URL(root.location.href);
  url.searchParams.set('szene','gasse');
  url.searchParams.set('modus','generator');
  url.searchParams.set('region','rocky-coast');
  url.searchParams.set('level',String(target));
  url.searchParams.set('seed',String(levels[target-1].seed));
  url.searchParams.set('entry',entry);
  url.searchParams.delete('treppe');
  url.searchParams.set('v','rocky-floor-transition-2');
  return url.href;
 }
 function route(target,entry=target<level?'from-upper':'from-lower'){
  if(!enabled||routing||target===level||!Number.isInteger(target)||target<1||target>5)return false;
  routing=true;
  root.location.assign(href(target,entry));
  return true;
 }
 const entry=q.get('entry');
 root.RockyCoastPrison={
  enabled,isExterior:enabled&&level===5,level,entry,levels,nearest,link,href,
  hasEntrance,hasExit,hasAscent,title,
  id:'rocky-coast-prison-dungeon',
  region:{id:'rocky-coast',biome:'temperate-grassland',topography:'hills',
   traversability:'open',features:['wide-river','ocean','cliff'],
   weather:['rain','storm','cold','fog'],buildingIds:['rocky-coast-prison']},
  levelTitle:levels[level-1].title,
  route
 };
})(window);
