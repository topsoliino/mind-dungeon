// Rocky Coast Prison Dungeon: five logical levels, four indoor greybox
// stages and the outdoor terrain as fifth. No landscape art dependencies.
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
 const portalDistance=94;
 const toPoint=portal=>({x:portal.x*48,y:portal.y*48});
 function nearest(actor,generator){
  if(!enabled)return null;
  if(level===5){
   const point={x:350,y:325},distance=Math.hypot(actor.x-point.x,actor.y-point.y);
   return distance<=portalDistance?{kind:'return',point,distance}:null;
  }
  if(!generator?.portals?.length)return null;
  const points=[{kind:'return',portal:generator.portals[0]},
   {kind:'advance',portal:generator.portals[1]}];
  return points.map(item=>({...item,point:toPoint(item.portal),
   distance:Math.hypot(actor.x-item.portal.x*48,actor.y-item.portal.y*48)}))
   .filter(item=>item.distance<=portalDistance)
   .sort((a,b)=>a.distance-b.distance)[0]||null;
 }
 function link(actor,generator){
  const p=nearest(actor,generator);
  if(!p)return null;
  if(p.kind==='advance')return {target:Math.min(5,level+1),entry:'from-lower',label:
   level===4?'Gefängnis verlassen → Rocky Coast':'Aufstieg → Dungeon-Ebene '+(level+1)};
  if(level===1)return null;
  return {target:level-1,entry:'from-upper',label:'Abstieg → Dungeon-Ebene '+(level-1)};
 }
 function href(target,entry='from-lower'){
  const url=new URL(root.location.href);
  url.searchParams.set('szene','gasse');
  url.searchParams.set('modus','generator');
  url.searchParams.set('region','rocky-coast');
  url.searchParams.set('level',String(target));
  url.searchParams.set('seed',String(levels[target-1].seed));
  url.searchParams.set('entry',entry);
  url.searchParams.delete('treppe');
  url.searchParams.set('v','rocky-greybox-1');
  return url.href;
 }
 const entry=q.get('entry');
 root.RockyCoastPrison={
  enabled,isExterior:enabled&&level===5,level,entry,levels,nearest,link,href,
  id:'rocky-coast-prison-dungeon',
  region:{id:'rocky-coast',biome:'temperate-grassland',topography:'hills',
   traversability:'open',features:['wide-river','ocean','cliff'],
   weather:['rain','storm','cold','fog'],buildingIds:['rocky-coast-prison']},
  title:levels[level-1].title,
  route(levelNumber){if(enabled)root.location.assign(href(levelNumber,
   levelNumber<level?'from-upper':'from-lower'));}
 };
})(window);
