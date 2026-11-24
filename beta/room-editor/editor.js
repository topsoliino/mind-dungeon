/* Mind Dungeon Room Atelier. Standalone: NEVER imports or changes the live dungeon. */
(function(){
'use strict';
const kit=window.MindRoomKit,cat=kit.catalog,P=cat.projection,TAU=Math.PI*2;
const placement=window.MindRoomPlacement,architecture=window.MindRoomArchitecture,portals=window.MindRoomPortals;
if(!placement||!architecture||!portals)throw Error('Room Atelier: placement, architecture or portal module missing');
const environment=window.MindRoomEnvironment;
 const shape=window.MindRoomShape;
 if(!shape)throw Error('Room Atelier: floor shape module missing');
 const $=id=>document.getElementById(id);
const c=$('editorCanvas'),ctx=c.getContext('2d',{alpha:false});
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const clone=o=>JSON.parse(JSON.stringify(o));
const rand=(x,y,s=0)=>{let n=Math.imul(x+1009,374761393)+Math.imul(y+41,668265263)+Math.imul(s+1,2246822519);n=Math.imul(n^n>>>13,1274126177);return ((n^n>>>16)>>>0)/4294967295};
const quant=x=>Math.round(x*4)/4;
const precise=x=>Math.round(x*1000)/1000;
let room=clone(kit.preset),selected=null,tool='select',chosenFurniture='prison-table';
let showGuardian=true,showGrid=false,playing=false,dragging=null,hover=null,dirty=true,frame=0;
let width=0,height=0,zoom=1,ox=0,oy=0;
let hero={x:3.5,y:2.6,z:0,target:null,vault:0,face:0,clock:0,moving:false},keys=new Set(),history=[],historyPos=0;
let playHP=new Map(),ambientRoutes=new Map(),lastAmbientFrame=0;
// Demand-load only views actually needed by the current scene.
 // Images are served as immutable, cacheable static files from GitHub Pages;
 // GitHub raw/API requests would add latency and rate limits.
const assets=new Map();
const spriteVersion='gothic-ruins-architecture-pbr-v2-crypt-v4';
let artRevision='',manifestState='prüfe Artwork-Manifest';
const retryDelays=[900,3500,12000];
function spriteName(type,rot){const spec=cat.furniture[type];return spec.asset+'-'+rot+'.'+(spec.extension||'webp')}
// The bars are genuine Cycles renders, not CSS gradients or flat line art.
 // Each small, front-orthographic PBR texture is projected onto a geometrically
 // exact 1-m wall panel so it joins adjacent stone and iron wall segments.
 const wallImages=new Map();
 function requestWallImage(style){
  const spec=cat.walls[style];if(spec?.render!=='blender-bars')return null;
  // Legacy prison bars and new full-height grilles share one cached PNG.
  let result=wallImages.get(spec.asset);
  if(result)return result;
  result={img:new Image(),ready:false,failed:false};
  wallImages.set(spec.asset,result);
  result.img.onload=()=>{result.ready=true;dirty=true;updateAssetInfo()};
  result.img.onerror=()=>{result.failed=true;dirty=true;updateAssetInfo()};
  result.img.src=spec.asset+'?v=forged-prison-bars-pbr-v1';
  return result;
 }
 function drawBlenderBars(w,spec,top0,top1,base0,base1){
  const render=requestWallImage(w.style);
  if(!render?.ready)return false;
  const source=render.img;
  // A 512px, square orthographic render from a straight-on camera.
  // The source crop is EXACTLY 1m wide and spec.height tall, without
  // relying on estimated transparency bounds that would alter spacing.
  const scale=spec.cameraOrthoScale;
  const sw=source.naturalWidth/scale,sh=source.naturalHeight*spec.height/scale;
  const sx=(source.naturalWidth-sw)*.5,sy=(source.naturalHeight-sh)*.5;
  ctx.save();
  ctx.transform(top1.x-top0.x,top1.y-top0.y,
                base0.x-top0.x,base0.y-top0.y,top0.x,top0.y);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(source,sx,sy,sw,sh,0,0,1,1);
  ctx.restore();
  return true;
 }
 
function spriteUrl(type,rot){return spriteName(type,rot)+'?v='+spriteVersion+(artRevision?'-'+artRevision:'')}
function loadSprite(entry,retry=false){
 const ticket=++entry.ticket;
 const img=new Image();entry.img=img;entry.ready=false;entry.failed=false;entry.loading=true;
 const url=spriteUrl(entry.type,entry.rot)+(retry?'&retry='+Date.now()+'-'+ticket:'');
 entry.url=url;
 img.onload=()=>{
  if(ticket!==entry.ticket)return;
  if(!img.naturalWidth||!img.naturalHeight){img.onerror();return;}
  entry.ready=true;entry.failed=false;entry.loading=false;entry.attempt=0;dirty=true;updateAssetInfo();
 };
 img.onerror=()=>{
  if(ticket!==entry.ticket)return;
  entry.failed=true;entry.loading=false;dirty=true;updateAssetInfo();
  if(entry.attempt<retryDelays.length){
   const delay=retryDelays[entry.attempt++];
   setTimeout(()=>{if(ticket===entry.ticket&&entry.failed)loadSprite(entry,true);},delay);
  }
 };
 img.src=url;
}
function requestSprite(type,rot){
 if(!cat.furniture[type]||cat.furniture[type].ambient)return null;
 const name=spriteName(type,rot);
 if(assets.has(name))return assets.get(name);
 const entry={type,rot,img:null,ready:false,failed:false,loading:false,attempt:0,ticket:0,url:''};
 assets.set(name,entry);loadSprite(entry);updateAssetInfo();return entry;
}
async function refreshArtManifest(force=false){
 try{
  const res=await fetch('assets/manifest.json?v='+Date.now(),{cache:'no-store'});
  if(!res.ok)throw Error('HTTP '+res.status);
  const m=await res.json();
  const revision=[m.generatorSha256,m.environmentGeneratorSha256,m.architectureGeneratorSha256].filter(Boolean).map(v=>v.slice(0,12)).join('-');
  manifestState=m.environmentGeneratorSha256?'Crypt-Modelle im Manifest: '+Object.keys(m.items||{}).length:'Crypt-Modelle fehlen im veröffentlichten Manifest';
  const changed=revision!==artRevision;artRevision=revision;
  for(const entry of assets.values())if(changed||force||entry.failed){entry.attempt=0;loadSprite(entry,force);}
  for(const thumb of document.querySelectorAll('img.catalog-thumb[data-asset-type]')){
   thumb.dataset.src=spriteUrl(thumb.dataset.assetType,0);
   if((changed||force)&&(thumb.getAttribute('src')||thumb.dataset.failed==='true')){thumb.dataset.failed='false';thumb.hidden=false;thumb.src=thumb.dataset.src+(force?'&retry='+Date.now():'');}
  }
 }catch(error){manifestState='Artwork-Manifest nicht erreichbar: '+error.message;if(force)for(const entry of assets.values())if(entry.failed){entry.attempt=0;loadSprite(entry,true);}}
 updateAssetInfo();schedule();
}
function updateAssetInfo(){
 const furniture=[...assets.values()].filter(v=>v.ready).length;
 const failedEntries=[...assets.values()].filter(v=>v.failed),failedSprites=failedEntries.length;
 const art=window.MindRoomArt?.status?.();
 $('assetStatus').textContent=(art?art.tiles+' · '+art.wallPhotos:'Materialien laden')+
  ' · Möbelansichten '+furniture+'/'+assets.size+' benötigt'+
  (failedSprites?' · '+failedSprites+' Fehler':'')+
  ' · Wächter '+(art?.guardianAuthentic?'Original':'lädt / nicht verfügbar');
 const failed=art?.failedTextures?.length||0;
 const fallback=art?.fallbackTextures?.length||0;
 $('assetInfo').textContent=failed?
  'Ladefehler bei '+failed+' Materialien: '+art.failedTextures.join(', ')+
  '. Bei einem veralteten GitHub-Pages-Build bitte die neueste Seite laden.' :
  (fallback?
   fallback+' Materialien werden bis zum Abschluss des GitHub-Asset-Builds direkt als Poly-Haven-Diffuse-Maps angezeigt. ':
   art?.assetWarning?art.assetWarning+'. ':'' )+
  'Nur sichtbare Boden-, Wand- und Möbelansichten werden bei Bedarf geladen. '+
  ' Maßstab und Texturrichtung sind an die Weltachsen gebunden. '+manifestState+
  (failedSprites?' · Fehlende Ansichten: '+failedEntries.map(v=>spriteName(v.type,v.rot)).join(', '):'');
}
const keyWall=w=>w.edge==='north'||w.edge==='south'?'h:'+w.x+':'+w.y:'v:'+w.x+':'+w.y;
const isWall=w=>Number.isInteger(w.x)&&Number.isInteger(w.y)&&
 ['north','south','west','east'].includes(w.edge)&&Boolean(cat.walls[w.style]);
function sanitize(raw){
 if(!raw||!Number.isInteger(raw.width)||!Number.isInteger(raw.height)||raw.width<2||raw.width>30||raw.height<2||raw.height>30)
  throw Error('Raumgröße muss zwischen 2 und 30 Feldern liegen.');
 const next={schema:'mind-dungeon-room/v1',
  id:String(raw.id||'untitled-room').slice(0,90),
  name:String(raw.name||'Unbenannter Raum').slice(0,80),
  width:raw.width,height:raw.height,
  floorStyle:cat.floors[raw.floorStyle]?raw.floorStyle:'dungeon-ashlar',
  wallStyle:cat.walls[raw.wallStyle]?raw.wallStyle:'stone',
  tiles:[],walls:[],furniture:[],notes:String(raw.notes||'').slice(0,2000)};
 if(Array.isArray(raw.floorCells)){next.floorCells=shape.normalize(next,raw.floorCells);if(!shape.connected(next))throw Error('Bodenfelder müssen zusammenhängen.');}
 for(const tile of raw.tiles||[]){
  if((!next.floorCells||shape.has(next,tile.x,tile.y))&&Number.isInteger(tile.x)&&tile.x>=0&&tile.x<next.width&&
   Number.isInteger(tile.y)&&tile.y>=0&&tile.y<next.height&&cat.floors[tile.style])
   next.tiles.push({x:tile.x,y:tile.y,style:tile.style});
 }
 const seen=new Set();
 for(const wall of raw.walls||[]){
  if(!isWall(wall))continue;
  const horizontal=wall.edge==='north'||wall.edge==='south';
  // The camera may hide walls but never deletes them.
  // Cutaway is visual only: retain authored south/east walls.
  if(wall.x<0||wall.y<0||wall.x>(horizontal?next.width-1:next.width)||
   wall.y>(horizontal?next.height:next.height-1))continue;
  const id=keyWall(wall);if(seen.has(id))continue;seen.add(id);
  next.walls.push({x:wall.x,y:wall.y,edge:horizontal?'north':'west',style:wall.style});
 }
 for(const item of raw.furniture||[]){
  if(!cat.furniture[item.type]||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const w=cat.furniture[item.type],rot=((Math.round(Number(item.rot)||0)/90%4)+4)%4*90;
  let saved={id:String(item.id||'furn-'+(next.furniture.length+1)).slice(0,64),
   type:item.type,x:precise(item.x),y:precise(item.y),rot,
   destroyable:typeof item.destroyable==='boolean'?item.destroyable:w.destroyable,
   vaultable:typeof item.vaultable==='boolean'?item.vaultable:w.vaultable,
   blocksMovement:typeof item.blocksMovement==='boolean'?item.blocksMovement:w.blocksMovement};
  if(w.lights?.length)saved.lit=item.lit!==false;
  if((w.wallMounted||w.category==='wall-architecture')){
   // Preserve a genuine segment reference. Invalid/orphaned wall decor may
   // not float in space after deletion, import or room resize.
   saved.wallRef=String(item.wallRef||'');
   saved.wallOffset=Number.isFinite(item.wallOffset)?item.wallOffset:.5;
   saved=architecture.refreshMount(saved,next,cat);
   if(!saved)continue;
  }
  next.furniture.push(saved);
 }
 next.portals=Array.isArray(raw.portals)?portals.normalize(raw.portals):[];
 return next;
}
function saveLocal(){
 ambientRoutes.clear();
 try{localStorage.setItem('mind-dungeon-room-atelier-v1',JSON.stringify(room))}catch{}
 $('editorStatus').textContent='Lokal gesichert · '+room.furniture.length+' Möbel · '+room.walls.length+' Wandsegmente';
 dirty=true;
}
function checkpoint(){
 const state=JSON.stringify(room);
 if(history[historyPos]===state){saveLocal();return}
 history=history.slice(0,historyPos+1);history.push(state);historyPos=history.length-1;
 if(history.length>60){history.shift();historyPos--}
 saveLocal();refreshUI();
}
function resetHistory(){history=[JSON.stringify(room)];historyPos=0;selected=null;saveLocal();refreshUI();}
function undo(step){const next=historyPos+step;if(next<0||next>=history.length)return;historyPos=next;room=sanitize(JSON.parse(history[next]));selected=null;saveLocal();refreshUI();}
try{const raw=JSON.parse(localStorage.getItem('mind-dungeon-room-atelier-v1')||'null');if(raw)room=sanitize(raw)}catch(error){console.warn('Room Atelier preset used:',error)}
resetHistory();
function project(u,v,z=0){return{x:ox+(u-v)*P.stepX*zoom,y:oy+(u+v)*P.stepY*zoom-z*P.stepX*zoom}}
function toWorld(x,y){const a=(x-ox)/(P.stepX*zoom),b=(y-oy)/(P.stepY*zoom);return{x:(a+b)/2,y:(b-a)/2}}
const pt=(x,y,z=0)=>project(x,y,z);
function polygon(pts,fill,stroke,line=1){
 ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
 for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
 ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line*zoom;ctx.stroke()}
}
function line(points,color,width=1){
 ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
 ctx.strokeStyle=color;ctx.lineWidth=Math.max(.65,width*zoom);ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
}
function fit(){
 const corners=[[0,0],[room.width,0],[room.width,room.height],[0,room.height]];
 const ps=corners.map(([x,y])=>({x:(x-y)*P.stepX,y:(x+y)*P.stepY}));
 const minX=Math.min(...ps.map(p=>p.x)),maxX=Math.max(...ps.map(p=>p.x));
 const minY=Math.min(...ps.map(p=>p.y))-P.stepX*2.4,maxY=Math.max(...ps.map(p=>p.y));
 zoom=clamp(Math.min((width-120)/Math.max(1,maxX-minX),(height-105)/Math.max(1,maxY-minY)),.45,2.1);
 ox=width/2-(minX+maxX)/2*zoom;
 oy=height/2-(minY+maxY)/2*zoom+15;
 dirty=true;updateZoom();
}
function updateZoom(){$('zoomValue').value=Math.round(zoom*100)+'%'}
function resize(){
 const rect=c.getBoundingClientRect(),previous=[width,height];width=rect.width;height=rect.height;
 const dpr=Math.min(window.devicePixelRatio||1,2);
 c.width=Math.max(1,Math.round(width*dpr));c.height=Math.max(1,Math.round(height*dpr));
 ctx.setTransform(dpr,0,0,dpr,0,0);if(!previous[0])fit();else{ox+=(width-previous[0])/2;oy+=(height-previous[1])/2}
 dirty=true;
}
new ResizeObserver(resize).observe($('canvasWrap'));
function wallEnds(w){
 if(w.edge==='north'||w.edge==='south')return [[w.x,w.y],[w.x+1,w.y]];
 return [[w.x,w.y],[w.x,w.y+1]];
}
function wallDepth(w){const [a,b]=wallEnds(w);return(pt(a[0],a[1]).y+pt(b[0],b[1]).y)/2+.5}
function isNearWall(w){
 if(room.floorCells){const s=shape.sides(room,w);return s.negative&&!s.positive;}
 return (w.edge==='north'||w.edge==='south')&&w.y===room.height||
  (w.edge==='west'||w.edge==='east')&&w.x===room.width;
}
function drawWall(w){
 if(isNearWall(w))return; // Isometric camera-side cutaway, not a collision hack.
 const type=cat.walls[w.style];if(!type||!type.height)return;
 const [a,b]=wallEnds(w),h=type.height,base0=pt(...a),base1=pt(...b),
  top0=pt(a[0],a[1],h),top1=pt(b[0],b[1],h),facing=(w.edge==='north'||w.edge==='south');
 if(type.render==='blender-bars'&&drawBlenderBars(w,type,top0,top1,base0,base1)){
  // Precise alpha mesh projection; keep the wall selection highlight.
  if(hover?.kind==='wall'&&hover.id===keyWall(w))line([top0,top1],'#ffde97',2);
  return;
 }
 if(type.render==='photo-wall-map'){
  const along=facing?w.x:w.y;
  if(window.MindRoomArt?.drawWallFace(ctx,w.style,top0,top1,base0,base1,along,h))return;
  // Do not replace the photographic wall with fake Blender bricks,
  // arbitrary grout lines, or extra edge highlights if assets are pending.
  polygon([top0,top1,base1,base0], '#444440', '#282729',.85);
 }else if(type.render==='metal-bars'||type.render==='blender-bars'){
  // Forged, open prison grilles. The same physical height drives both the
  // isometric shape and collision style: 2 m full versus 1 m half height.
  // Build lines directly from the same endpoints as photo walls so bars
  // connect without a gap on adjacent north/west wall segments.
  const metal=w.style==='gate'?'#978577':'#777b7b';
  const rails=type.variant==='half'?[.43]:[.34,.72];
  line([base0,base1],'#171b1d',5.5);
  line([base0,base1],'#494849',2.6);
  line([top0,top1],'#18191b',6.2);
  line([top0,top1],'#716d68',2.8);
  for(const ratio of rails){
   line([pt(a[0],a[1],h*ratio),pt(b[0],b[1],h*ratio)],'#202123',5);
   line([pt(a[0],a[1],h*ratio),pt(b[0],b[1],h*ratio)],'#5f5a55',2.1);
  }
  for(let i=0;i<=6;i++){
   const t=i/6,u=a[0]+(b[0]-a[0])*t,v=a[1]+(b[1]-a[1])*t;
   // Black iron core, worn metal edges and a faint highlight make each
   // round vertical bar legible against dark dungeon stone.
   line([pt(u,v,-.015),pt(u,v,h+.025)],'#18191c',5.2);
   line([pt(u,v,0),pt(u,v,h)],metal,2.9);
   line([pt(u,v,.025),pt(u,v,h)],'#c2b6a155',.72);
   if(i===0||i===6){
    line([pt(u,v,0),pt(u,v,h+.055)],'#1a1a1c',7.1);
    line([pt(u,v,0),pt(u,v,h+.038)],'#817a70',2.4);
   }
  }
  // Small hand-forged rivets at the intersections of rails and posts.
  for(const ratio of rails)for(const t of [0,.5,1]){
   const u=a[0]+(b[0]-a[0])*t,v=a[1]+(b[1]-a[1])*t;
   const p=pt(u,v,h*ratio);
   ctx.fillStyle='#b2a18a';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1,1.25*zoom),0,TAU);ctx.fill();
  }
  if(w.style==='gate'){
   const u=(a[0]+b[0])*.5,v=(a[1]+b[1])*.5;
   polygon([pt(u-.06,v-.06,h*.83),pt(u+.06,v-.06,h*.83),
    pt(u+.06,v+.06,h*.66),pt(u-.06,v+.06,h*.66)],'#ba9f72','#24242c',1);
   line([pt(u,v,h*.69),pt(u,v,h*.91)],'#d0ad62',3);
  }
 }
 if(hover?.kind==='wall'&&hover.id===keyWall(w))line([top0,top1],'#ffde97',2);
}
function oriented(obj,dx,dy){
 const radians=obj.rot*Math.PI/180,c=Math.round(Math.cos(radians)),s=Math.round(Math.sin(radians));
 return {x:obj.x+dx*c-dy*s,y:obj.y+dx*s+dy*c};
}
function footprint(obj){
 const spec=cat.furniture[obj.type],w=spec.footprint.w/2,h=spec.footprint.h/2;
 return [oriented(obj,-w,-h),oriented(obj,w,-h),oriented(obj,w,h),oriented(obj,-w,h)];
}
function bounds(obj){
 const corners=footprint(obj);
 return {left:Math.min(...corners.map(c=>c.x)),right:Math.max(...corners.map(c=>c.x)),
  top:Math.min(...corners.map(c=>c.y)),bottom:Math.max(...corners.map(c=>c.y))};
}
function fits(obj,ignoreId=null){
 if(!obj)return false;
 if(!architecture.validMount(obj,room,cat))return false;
 const a=bounds(obj);
 // The old .1m inset plus quarter-metre snapping caused visible wall gaps.
 // Keep just the physically tiny safety inset, irrespective of obstruction.
 const eps=placement.epsilon*.5;
 if(a.left<eps||a.top<eps||a.right>room.width-eps||a.bottom>room.height-eps)return false;
 if(room.floorCells&&!shape.contains(room,a))return false;
 // Nonblocking decorations are walk-through but must still respect stone
 // wall planes, otherwise rugs and puddles can appear in the next room.
 if(!cat.furniture[obj.type].wallMounted&&cat.furniture[obj.type].category!=='wall-architecture'&&
    placement.crossesWall(obj,room,cat))return false;
 for(const other of room.furniture){
  if(other.id===(ignoreId||obj.id))continue;
  if(cat.furniture[obj.type].surface&&cat.furniture[other.type]?.surface){const b=bounds(other);if(a.left<b.right-.01&&a.right>b.left+.01&&a.top<b.bottom-.01&&a.bottom>b.top+.01)return false;}
  if(!other.blocksMovement||!obj.blocksMovement)continue;
  const b=bounds(other);
  if(a.left<b.right-.08&&a.right>b.left+.08&&a.top<b.bottom-.08&&a.bottom>b.top+.08)return false;
 }
 return true;
}
function shadeFurniture(type,obj,paint,outline,highlight){
 const position=(x,y,z)=>{const o=oriented(obj,x,y);return pt(o.x,o.y,z)};
 const cuboid=(x1,y1,x2,y2,z0,z1,top,sideA,sideB)=>{
  const p0=position(x1,y1,z0),p1=position(x2,y1,z0),p2=position(x2,y2,z0),p3=position(x1,y2,z0),
   q0=position(x1,y1,z1),q1=position(x2,y1,z1),q2=position(x2,y2,z1),q3=position(x1,y2,z1);
  polygon([q1,q2,p2,p1],sideA,outline,.7);polygon([q2,q3,p3,p2],sideB,outline,.7);
  polygon([q0,q1,q2,q3],top,outline,.85);
 };
 if(cat.furniture[type].category==='lighting'){const p=position(0,0,cat.furniture[type].height*.75);ctx.fillStyle='#514940';ctx.beginPath();ctx.ellipse(p.x,p.y,2.5*zoom,6*zoom,0,0,TAU);ctx.fill();return;}
 if(cat.furniture[type].kind==='clutter'){
  polygon(footprint(obj).map(({x,y})=>pt(x,y)), '#4a454180','#8b8271',1);
  return;
 }
 if(cat.furniture[type].category==='wall-architecture'){
  // A neutral physical outline while its *real* Blender sprite is pending;
  // never substitute a medieval chair for a wall-mounted stone statue.
  const top=footprint(obj).map(({x,y})=>pt(x,y,Math.max(.4,cat.furniture[type].height)));
  const ground=footprint(obj).map(({x,y})=>pt(x,y));
  polygon([top[1],top[2],ground[2],ground[1]],'#47403a','#a39383',1);
  polygon([top[2],top[3],ground[3],ground[2]],'#342e2a','#8b8077',1);
  polygon(top,'#615951','#aaa095',1.1);
  return;
 }
 if(cat.furniture[type].category==='architectural-floor'){
  const surface=cat.furniture[type].surface;
  const height=surface.elevation;
  const ground=footprint(obj).map(({x,y})=>pt(x,y));
  const elevated=footprint(obj).map(({x,y})=>pt(x,y,height));
  polygon([elevated[1],elevated[2],ground[2],ground[1]],'#292928','#68665f',1);
  polygon([elevated[2],elevated[3],ground[3],ground[2]],'#34322f','#716c62',1);
  polygon(elevated,'#6b6257','#c4aa87',1.2);
  return;
 }
 if(cat.furniture[type].kind==='table'){
  for(const x of [-.76,.76])for(const y of [-.37,.37])
   cuboid(x-.06,y-.06,x+.06,y+.06,.04,.82,'#52403a','#342724','#40312e');
  cuboid(-.86,-.47,.86,.47,.77,.91,'#775c4b','#322724','#4c352c');
  for(let i=0;i<5;i++){
   const y=-.4+i*.2;
   line([position(-.83,y,.926),position(.83,y,.926)],i%2?'#b0906877':'#32272277',1);
  }
  for(const x of [-.68,.68]){
   for(const y of [-.28,.28]){
    const p=position(x,y,.925);ctx.fillStyle='#b0a198';ctx.beginPath();ctx.arc(p.x,p.y,1.2*zoom,0,TAU);ctx.fill();
   }
  }
 }else{
  for(const x of [-.3,.3])for(const y of [-.29,.29])
   cuboid(x-.047,y-.047,x+.047,y+.047,.03,.62,'#60463a','#2e2423','#422d27');
  cuboid(-.37,-.36,.37,.36,.58,.73,'#725642','#3b2825','#453027');
  // tall backrest rises on the -Y side; a crossbar + vertical tapered slats.
  for(const x of [-.31,.31])cuboid(x-.04,-.37,x+.04,-.29,.7,1.35,
   '#866449','#3a2a26','#50382d');
  cuboid(-.36,-.38,.36,-.28,1.23,1.37,'#7b5840','#342626','#422d27');
  for(const x of [-.19,0,.19])
   cuboid(x-.019,-.355,x+.019,-.31,.76,1.23,
    '#997558','#493429','#513a30');
 }
}
function drawFurniture(obj){
 if(playing&&playHP.has(obj.id)&&playHP.get(obj.id)<=0)return;
 const spec=cat.furniture[obj.type],p=pt(obj.x,obj.y),floor=spec.category==='architectural-floor',legacy=obj.type==='prison-table'||obj.type==='prison-chair',exact=floor||spec.category==='lighting'||obj.type.startsWith('deco-'),ortho=exact?3.5:3.35,size=(exact||legacy?42*Math.SQRT2*ortho:184*(spec.editorSpriteScale||1))*zoom;
 if(spec.ambient){if(!playing&&(selected===obj.id||obj.id==='ghost')){const p=pt(obj.x,obj.y);ctx.strokeStyle='#c6b49b';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,7*zoom,0,TAU);ctx.stroke();}return;}
 // Low-profile dungeon floor clutter is baked with its own Cycles ambient
 // occlusion. The generic furniture contact oval would hide wet puddles/rugs.
 if(!['floor-clutter','wall-architecture','architectural-floor','lighting','ambient-life'].includes(spec.category)){
  ctx.save();ctx.globalAlpha=.4;ctx.fillStyle='#000';
  ctx.beginPath();ctx.ellipse(p.x,p.y+5*zoom,spec.footprint.w*P.stepX*zoom*.75,
   spec.footprint.h*P.stepY*zoom*.8,0,0,TAU);ctx.fill();ctx.restore();
 }
 const sprite=requestSprite(obj.type,obj.rot);
 if(sprite?.ready){
  // Blender ortho target .72m projects the ground pivot to 68.3% of the cut.
  ctx.save();ctx.imageSmoothingEnabled=true;
  ctx.drawImage(sprite.img,p.x-size*.5,p.y-size*(exact||legacy?.5+.72*Math.sqrt(2/3)/ortho:.683),size,size);ctx.restore();
 }else{
  // Match the smaller published in-world scale during a pending Blender build.
  ctx.save();ctx.translate(p.x,p.y);
  const scale=obj.type==='prison-table'?.76:obj.type==='prison-chair'?.72:spec.editorSpriteScale||1;
  ctx.scale(scale,scale);
  ctx.translate(-p.x,-p.y);
  shadeFurniture(obj.type,obj,'#4a322b','#171316','#74523d');ctx.restore();
  if(exact&&(!sprite?.ready)){ctx.save();ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillStyle='#e1c394';ctx.fillText(sprite?.failed?'Asset fehlt':'Asset lädt…',p.x,p.y+13*zoom);ctx.restore();}
 }
 if(selected===obj.id){
  polygon(footprint(obj).map(({x,y})=>pt(x,y)), '#ffc97618',
   fits(obj,obj.id)?'#f1be6b':'#e86c73',1.9);
  const handle=pt(obj.x,obj.y,Math.max(0,spec.height)+.24);
  ctx.beginPath();ctx.arc(handle.x,handle.y,4.1*zoom,0,TAU);
  ctx.fillStyle='#ffdc97';ctx.fill();ctx.lineWidth=1;ctx.strokeStyle='#423024';ctx.stroke();
 }
}
function drawGhost(item){
 if(!item)return;
 ctx.save();ctx.globalAlpha=.55;drawFurniture(item);ctx.restore();
 polygon(footprint(item).map(({x,y})=>pt(x,y)),null,fits(item)?'#94d1a4':'#ea6876',2);
}
function cursorTile(x,y){
 const u=Math.floor(x),v=Math.floor(y);
 return shape.has(room,u,v)?{x:u,y:v}:null;
}
function nearestWall(x,y){
 const du=Math.abs(x-Math.round(x)),dv=Math.abs(y-Math.round(y));
 const horizontal=dv<=du;
 let u=horizontal?Math.floor(x):Math.round(x),v=horizontal?Math.round(y):Math.floor(y);
 if(horizontal){if(u<0||u>=room.width||v<0||v>room.height)return null}
 else{if(u<0||u>room.width||v<0||v>=room.height)return null}
 const wall={x:u,y:v,edge:horizontal?'north':'west',style:$('wallType').value};
 if(room.floorCells){const s=shape.sides(room,wall);if(!s.positive&&!s.negative)return null;}
 return {...wall,kind:'wall',id:keyWall(wall)};
}
// Click directly on the *vertical face* of a wall. Converting screen
// coordinates as floor Z=0 alone misses upper masonry by nearly a metre.
function wallFaceTarget(screen){
 let nearest=null,score=Infinity;
 for(const wall of room.walls){
  const spec=cat.walls[wall.style];
  if(!spec?.solid||isNearWall(wall))continue;
  const [a,b]=wallEnds(wall);
  for(let z=0;z<=Math.min(spec.height,2.05)+.01;z+=.25){
   const start=pt(a[0],a[1],z),end=pt(b[0],b[1],z);
   const dx=end.x-start.x,dy=end.y-start.y;
   const lengthSq=dx*dx+dy*dy||1;
   const t=clamp(((screen.x-start.x)*dx+(screen.y-start.y)*dy)/lengthSq,0,1);
   const hx=start.x+dx*t,hy=start.y+dy*t;
   const dist=Math.hypot(screen.x-hx,screen.y-hy);
   if(dist<score&&dist<19*zoom){
    score=dist;
    nearest={x:a[0]+(b[0]-a[0])*t,
             y:a[1]+(b[1]-a[1])*t};
   }
  }
 }
 return nearest;
}
function architecturalTarget(screen,uv){
 return wallFaceTarget(screen)||
  (architecture.wallCandidate(room,cat,uv.x,uv.y)?uv:null);
}
function hitFurniture(x,y){
 const px=x,py=y;
 return room.furniture.slice().sort((a,b)=>pt(b.x,b.y).y-pt(a.x,a.y).y).find(item=>{
  const p=pt(item.x,item.y),spec=cat.furniture[item.type];
  const dx=(px-p.x)/zoom,dy=(py-p.y)/zoom;
  // Hit testing follows the SHRUNKEN model/footprint; no invisible 117px
  // click box remains around a half-size chair or compact brewing table.
  const reachX=Math.max(15,spec.footprint.w*P.stepX*.85);
  // Sunken rooms/collapsed floors have negative elevation; they must
  // remain selectable instead of creating a negative click target.
  const reachTop=Math.max(20,Math.max(0,spec.height)*P.stepX*1.25+
   spec.footprint.h*P.stepY*.5);
  const reachBottom=Math.max(12,spec.footprint.h*P.stepY*.75)+
   Math.max(0,-spec.height)*P.stepX*.8;
  return Math.abs(dx)<reachX&&dy>-reachTop&&dy<reachBottom;
 })||null;
}
function draw(){
 if(width<1||height<1)return;
 dirty=false;frame++;
 ctx.setTransform(c.width/width,0,0,c.height/height,0,0);
 ctx.clearRect(0,0,width,height);
 ctx.fillStyle='#151722';ctx.fillRect(0,0,width,height);
 // Subtle technical drafting diagonals, no full-game textures to upload.
 ctx.strokeStyle='#cbb7a007';ctx.lineWidth=.7;
 for(let i=-width;i<width*2;i+=35){
  ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+height,height);ctx.stroke();
 }
 // A physical 3D floor PLATE under the individually editable stone tiles.
 // The two exposed edges have real thickness and catch cool ambient shadow.
 const slab=.22;
 if(room.floorCells){for(const b of shape.boundary(room)){if(b.side!=='south'&&b.side!=='east')continue;const [a,c]=portals.segment(room,b);polygon([pt(...a),pt(...c),pt(...c,-slab),pt(...a,-slab)],b.side==='south'?'#30303a':'#242730','#181821',1);}}
 else{
 polygon([pt(room.width,0),pt(room.width,room.height),
   pt(room.width,room.height,-slab),pt(room.width,0,-slab)],
   '#242730','#121820',1);
 polygon([pt(room.width,room.height),pt(0,room.height),
   pt(0,room.height,-slab),pt(room.width,room.height,-slab)],
   '#30303a','#181821',1);}
 // Render ONE continuous artifact. The image has a fixed 32x32 world scale:
 // a 5x5 room crops it, a 30x30 room uncovers almost all of it.
 const floorReady=window.MindRoomArt?.drawRoomFloor(ctx,room,pt);
 if(!floorReady){
  // Neutral-only fallback. Never resurrect the old artificial painted tiles.
  for(const {x,y} of shape.cells(room))polygon([pt(x,y),pt(x+1,y),pt(x+1,y+1),pt(x,y+1)],'#484744');
 }
 // Original photographs stay clean: NO fake grime, dirt, stains or per-cell overlays.
 // Grid is an optional EDITOR overlay, not part of the authored floor artwork.
 if(showGrid&&floorReady)for(const {x,y} of shape.cells(room))
  polygon([pt(x,y),pt(x+1,y),pt(x+1,y+1),pt(x,y+1)],null,'#c1bdbe13',.55);
 if(tool==='shapeAdd'||tool==='shapeRemove'){
  for(let y=-1;y<=room.height;y++)for(let x=-1;x<=room.width;x++){if(!shape.has(room,x,y)&&![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>shape.has(room,x+dx,y+dy)))continue;polygon([pt(x,y),pt(x+1,y),pt(x+1,y+1),pt(x,y+1)],null,'#a9c7c54a',.8);}
  if(hover?.kind==='brush'){const {x,y}=hover;polygon([pt(x,y),pt(x+1,y),pt(x+1,y+1),pt(x,y+1)],tool==='shapeAdd'?'#64d7ad50':'#e9798060',tool==='shapeAdd'?'#64d7ad':'#e97980',2);}
 }
 if(hover?.kind==='tile'&&tool==='floor'){
  const v=hover;polygon([pt(v.x,v.y),pt(v.x+1,v.y),pt(v.x+1,v.y+1),pt(v.x,v.y+1)],'#f4c87527','#e3bd78',1.2);
 }
 // Dark cavity only at the real local opening; never a flat mask over an entire platform.
 for(const obj of room.furniture){
  const spec=cat.furniture[obj.type],kind=spec?.surface?.type;if(kind!=='sunken'&&kind!=='collapsed')continue;
  const w=spec.footprint.w,h=spec.footprint.h,rx=w*(kind==='collapsed'?.23:.41),y0=-h*(kind==='collapsed'?.30:.42),y1=h*(kind==='collapsed'?.30:.20);
  const world=(x,y,z=0)=>{const p=oriented(obj,x,y);return pt(p.x,p.y,z);};
  polygon([world(-rx,y0),world(rx,y0),world(rx,y1),world(-rx,y1)],'#141416');
 }
 const layers=[];
 const active=room.furniture.filter(o=>!playing||!playHP.has(o.id)||playHP.get(o.id)>0);
 const lightPoints=active.flatMap(o=>{const spec=cat.furniture[o.type];if(!spec.lights?.length||o.lit===false)return [];
  // Never present detached fire as a successfully loaded light fixture.
  return requestSprite(o.type,o.rot)?.ready?environment.lightPoints(o,spec):[];
 });
 const now=performance.now()/1000;
 for(const w of room.walls)if(!isNearWall(w))layers.push({depth:wallDepth(w),draw:()=>drawWall(w)});
 // Floor clutter always sits on stone UNDER the Guardian and furniture,
 // regardless of a nonblocking patch extending slightly in front of the feet.
 // Sort clutter within its ground plane before depth-sorted solid objects.
 for(const obj of room.furniture){
  const floorProp=cat.furniture[obj.type]?.category==='floor-clutter';
  layers.push({depth:floorProp?-100000+pt(obj.x,obj.y).y:pt(obj.x,obj.y).y,
   draw:()=>drawFurniture(obj)});
 }
 const reference=shape.has(room,Math.floor(room.width/2),Math.floor(room.height/2))?{x:room.width/2,y:room.height/2}:(()=>{const c=shape.cells(room)[0];return{x:c.x+.5,y:c.y+.5};})();
 if(playing||showGuardian)layers.push({
  depth:Math.max(pt(playing?hero.x:reference.x,playing?hero.y:reference.y).y+.01,playing&&hero.z>.05&&architecture.surfaceAt(room,cat,hero.x,hero.y,placement).obj?pt(architecture.surfaceAt(room,cat,hero.x,hero.y,placement).obj.x,architecture.surfaceAt(room,cat,hero.x,hero.y,placement).obj.y).y+.1:-Infinity),
  draw:()=>window.MindRoomArt.drawGuardian(ctx,{
   point:pt(playing?hero.x:reference.x,playing?hero.y:reference.y,
            playing?(hero.z||0):0),
   angle:playing?hero.face:Math.PI/4,time:playing?hero.clock:0,
   moving:playing&&hero.moving,vault:playing?hero.vault:0,zoom
  })
 });
 // Ground-bound roaches render after floor clutter, but before every wall,
 // furniture mesh and the Guardian. Flying insects keep their previous pass.
 const drawAmbient=kind=>{
  for(const o of active)if(cat.furniture[o.type].ambient===kind){
   let path=ambientRoutes.get(o.id);
   if(!path){path=environment.route(room,cat,shape,placement,o);ambientRoutes.set(o.id,path);}
   environment.insects(room,cat,shape,placement,o,now,ctx,pt,zoom,path);
  }
 };
 layers.sort((a,b)=>a.depth-b.depth);
 let groundPass=false;
 for(const layer of layers){
  if(!groundPass&&layer.depth>=-50000){drawAmbient('roach');groundPass=true;}
  layer.draw();
 }
 if(!groundPass)drawAmbient('roach');
 environment.drawGlow(ctx,lightPoints,pt,now,zoom);
 for(const l of lightPoints)environment.drawFlame(ctx,pt(l.x,l.y,l.z),l.size,l.phase,now,zoom);
 drawAmbient('fly');
 if(!playing){
  if(['portal','wall','erase'].includes(tool))for(const w of room.walls){if(isNearWall(w)&&cat.walls[w.style]?.solid){const [a,b]=wallEnds(w);line([pt(...a),pt(...b)],'#aeb0ba',3);}}
  for(const p of room.portals||[]){if(p.offset+p.width>portals.span(room,p.side))continue;const [a,b]=portals.segment(room,p);line([pt(...a),pt(...b)],portals.inspect(room,p,cat,placement).ok?'#67d5b5':'#e97980',5);}
  if(tool==='portal'&&hover?.kind==='portal'){const p=hover.portal,[a,b]=portals.segment(room,p);line([pt(...a),pt(...b)],portals.inspect(room,p,cat,placement).ok?'#c0ffe7':'#ff7777',7);}
 }
 if(hover?.kind==='wall'&&(tool==='wall'||tool==='erase')){
  const [a,b]=wallEnds(hover);
  line([pt(...a),pt(...b)],tool==='erase'?'#e97980':'#f3d196',4.3);
 }
 if(tool==='place'&&!playing){
  const item=hover?.kind==='world'?
   makeInstance(chosenFurniture,hover.x,hover.y,0,'ghost'):null;
  if(item)drawGhost(item);
 }

}
function schedule(){dirty=true}
window.MindRoomArt?.onChange(()=>{
 const art=window.MindRoomArt.status();
 $('guardianBtn').disabled=art.guardian==='error';
 $('guardianBtn').textContent='◆ Spiel-Wächter '+(art.guardianAuthentic?
   (showGuardian?'ausblenden':'einblenden'):art.guardian==='loading'?'lädt …':'nicht verfügbar');
 updateAssetInfo();
 schedule();
});

function getPointer(e){
 const rect=c.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top};
}
function makeInstance(type,x,y,rot=0,id){
 const cfg=cat.furniture[type];
 if((cfg.wallMounted||cfg.category==='wall-architecture')){
  const mounted=architecture.attach(type,room,cat,x,y,id);
  return mounted&&cfg.lights?.length?{...mounted,lit:true}:mounted;
 }
 const initial={id:id||type+'-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1000),
  type,x:quant(x),y:quant(y),rot,destroyable:cfg.destroyable,vaultable:cfg.vaultable,
  blocksMovement:cfg.blocksMovement,...(cfg.lights?.length?{lit:true}:{})};
 return placement.snap(initial,room,cat);
}
function chooseTool(next){
 if(playing&&next!=='select')togglePlay(false);
 tool=next;hover=null;
 document.querySelectorAll('[data-tool]').forEach(btn=>btn.classList.toggle('active',btn.dataset.tool===next));
 $('sceneStatus').textContent={
  select:'V · Möbel anklicken und ziehen · R = 90° drehen',
  floor:'B · ausgewählten Originalboden auf den ganzen Raum anwenden',
   shapeAdd:'N · Bodenfelder malen · Linksklick ziehen, auch am äußeren Rand',
   shapeRemove:'M · Bodenfelder entfernen · Linksklick ziehen',
  wall:'W · Wandkante anklicken · Gitter und Türen platzieren',
  place:(cat.furniture[chosenFurniture]?.wallMounted||cat.furniture[chosenFurniture]?.category==='wall-architecture')?
   'F · Wandverzierung nur auf vorhandener massiver Wand platzieren':
   'F · Möbel / Bauplattform auf Boden platzieren',
  portal:'C · freie Außenkante anklicken · erneut anklicken = entfernen',
   erase:'E · Möbel entfernen oder Wandkante aufheben'}[next];
 schedule();
}
function select(id){
 selected=id;
 refreshUI();
 schedule();
}
function changeRoom(fn){
 fn();
 room=sanitize(room);
 checkpoint();
}
function item(){return room.furniture.find(f=>f.id===selected)||null}
function togglePlay(active){
 playing=active;keys.clear();dragging=null;hero.target=null;hero.vault=0;hero.moving=false;hero.clock=0;
 playHP=new Map(active?room.furniture.map(obj=>[obj.id,cat.furniture[obj.type].maxHP]):[]);
 if(active){
  let found=null;
  for(let y=.5;y<room.height&&!found;y+=.5)for(let x=.5;x<room.width&&!found;x+=.5)
   if(canOccupy(x,y)&&architecture.surfaceAt(room,cat,x,y,placement).height===0)
    found={x,y};
  if(!found){playing=false;playHP.clear();$('editorStatus').textContent='Kein begehbarer Startpunkt im Raum.';return;}
  hero={...hero,...found};
  hero.z=architecture.surfaceAt(room,cat,hero.x,hero.y,placement).height;
  chooseTool('select');
 }
 $('playBtn').classList.toggle('active',active);
 $('playBtn').textContent=active?'■ Spieltest beenden':'▶ Spieltest';
 $('playHint').hidden=!active;
 $('sceneStatus').textContent=active?'WASD · Rechtsklick Ziel · Linksklick Angriff · Leertaste Vault':'V · Auswahl';
 schedule();
}
function canOccupy(x,y,allowVault=false){
 const r=.17;
 if(x<r||y<r||x>room.width-r||y>room.height-r)return false;
 if(room.floorCells&&!shape.contains(room,{left:x-r,right:x+r,top:y-r,bottom:y+r}))return false;
 for(const obj of room.furniture)if(obj.blocksMovement&&
  (!playing||!playHP.has(obj.id)||playHP.get(obj.id)>0)){
  const b=bounds(obj);
  if(x+r>b.left&&x-r<b.right&&y+r>b.top&&y-r<b.bottom)return false;
 }
 const surface=architecture.surfaceAt(room,cat,x,y,placement);
 if(surface.blocked)return false;
 if(playing&&!allowVault&&!architecture.transition(room,cat,placement,
   {x:hero.x,y:hero.y,z:hero.z||0},{x,y}).allowed)return false;
 for(const wall of room.walls)if(cat.walls[wall.style].solid){
  const [a,b]=wallEnds(wall),d=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(d<.5)continue;
  if(wall.edge==='north'||wall.edge==='south'){
   if(Math.abs(y-wall.y)<r&&x>=wall.x-r&&x<=wall.x+1+r)return false;
  }else if(Math.abs(x-wall.x)<r&&y>=wall.y-r&&y<=wall.y+1+r)return false;
 }
 return true;
}
function playStep(dt){
 const previousX=hero.x,previousY=hero.y;
 hero.clock=(hero.clock||0)+dt;
 const sx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),
  sy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
 let dx=sx,dy=sy;
 if(!dx&&!dy&&hero.target){
  dx=hero.target.x-hero.x;dy=hero.target.y-hero.y;
  if(Math.hypot(dx,dy)<.08){hero.target=null;dx=dy=0}
 }
 const len=Math.hypot(dx,dy);
 if(len>.001){
  dx/=len;dy/=len;hero.face=Math.atan2(dy,dx);
  const step=Math.min(len,dt*2.3);
  if(canOccupy(hero.x+dx*step,hero.y+dy*step)){hero.x+=dx*step;hero.y+=dy*step}
  else if(canOccupy(hero.x+dx*step,hero.y)){hero.x+=dx*step;hero.target=null}
  else if(canOccupy(hero.x,hero.y+dy*step)){hero.y+=dy*step;hero.target=null}
  else hero.target=null;
 }
 hero.moving=Math.hypot(hero.x-previousX,hero.y-previousY)>.001;
 const surface=architecture.surfaceAt(room,cat,hero.x,hero.y,placement);
 const targetZ=surface.blocked?(hero.z||0):surface.height;
 hero.z+=(targetZ-(hero.z||0))*Math.min(1,dt*11);
 hero.vault=Math.max(0,hero.vault-dt*2.7);
}
function vault(){
 let to=null;
 const dx=Math.cos(hero.face),dy=Math.sin(hero.face);
 const start={x:hero.x+dx*.4,y:hero.y+dy*.4};
 const obj=room.furniture.find(o=>{
  const b=bounds(o);return o.vaultable&&o.blocksMovement&&start.x>b.left&&start.x<b.right&&start.y>b.top&&start.y<b.bottom;
 });
 if(obj){
  const b=bounds(obj),distance=Math.max(b.right-b.left,b.bottom-b.top)+.7;
  const candidate={x:hero.x+dx*distance,y:hero.y+dy*distance};
  if(canOccupy(candidate.x,candidate.y)){to=candidate;hero.vault=1}
 }
 // A wall-mounted wooden ledge at 1.33m is a true platform rather than
 // decorative art: Space vaults onto/off the ledge within Guardian reach.
 if(!to){
  const origin=architecture.surfaceAt(room,cat,hero.x,hero.y,placement);
  for(const distance of [.45,.65,.85]){
   const candidate={x:hero.x+dx*distance,y:hero.y+dy*distance};
   const dest=architecture.surfaceAt(room,cat,candidate.x,candidate.y,placement);
   const climb=origin.obj?.type==='wall-wood-ledge'||
    dest.obj?.type==='wall-wood-ledge';
   if(climb&&Math.abs(dest.height-origin.height)>.29&&
      Math.abs(dest.height-origin.height)<=1.4&&
      canOccupy(candidate.x,candidate.y,true)){
    to=candidate;hero.vault=1;break;
   }
  }
 }
 if(to){hero.x=to.x;hero.y=to.y;schedule()}
}
function paintFloor(screen,add){
 const uv=toWorld(screen.x,screen.y),x=Math.floor(uv.x),y=Math.floor(uv.y);
 const result=shape.edit(room,x,y,add,bounds);
 if(!result.ok){if(result.reason)$('editorStatus').textContent=result.reason;return;}
 room=result.room;
 // Rebase the room if painting on its north/west side without making
 // any already placed object or the mouse target jump on screen.
 ox-=(result.dx-result.dy)*P.stepX*zoom;oy-=(result.dx+result.dy)*P.stepY*zoom;
 $('roomW').value=room.width;$('roomH').value=room.height;
 schedule();
}
c.addEventListener('pointerdown',e=>{
 const pos=getPointer(e),uv=toWorld(pos.x,pos.y);
 if(playing){
  e.preventDefault();
  if(e.button===2){
   hero.target={x:clamp(uv.x,0,room.width),y:clamp(uv.y,0,room.height)};
  }else if(e.button===0){
   // Editor-only combat collision probe. A non-destroyable prop survives,
   // destroyed props disappear from the preview without changing room JSON.
   const target=hitFurniture(pos.x,pos.y);
   if(target&&Math.hypot(target.x-hero.x,target.y-hero.y)<=1.6&&target.destroyable){
    const hp=(playHP.get(target.id)??cat.furniture[target.type].maxHP)-25;
    playHP.set(target.id,hp);
    $('editorStatus').textContent=hp<=0?
     cat.furniture[target.type].label+' zerstört (nur Spieltest)':
     cat.furniture[target.type].label+' · '+Math.max(0,hp)+' HP';
   }else $('editorStatus').textContent='Kein zerstörbares Möbelstück in Schlagreichweite.';
  }
  schedule();return;
 }
 if(e.button===1||e.button===2||keys.has(' ')){
  e.preventDefault();c.setPointerCapture(e.pointerId);
  dragging={type:'pan',x:e.clientX,y:e.clientY,ox,oy};return;
 }
 c.setPointerCapture(e.pointerId);
 if(tool==='shapeAdd'||tool==='shapeRemove'){
  dragging={type:'brush',add:tool==='shapeAdd',last:pos};paintFloor(pos,dragging.add);return;
 }
 const hit=hitFurniture(pos.x,pos.y);
 if(tool==='select'){
  select(hit?.id||null);
  if(hit)dragging={type:'move',id:hit.id,deltaX:hit.x-uv.x,deltaY:hit.y-uv.y,previous:JSON.stringify(room)};
 }else if(tool==='place'){
  const wallOnly=(cat.furniture[chosenFurniture]?.wallMounted||cat.furniture[chosenFurniture]?.category==='wall-architecture');
  const target=wallOnly?architecturalTarget(pos,uv):uv;
  const obj=target?makeInstance(chosenFurniture,target.x,target.y):null;
  if(fits(obj)){room.furniture.push(obj);selected=obj.id;checkpoint()}
  else $('editorStatus').textContent=(cat.furniture[chosenFurniture]?.wallMounted||cat.furniture[chosenFurniture]?.category==='wall-architecture')?
   'Wandverzierungen können NUR an einer vorhandenen massiven Wand angebracht werden.':
   'Hier kollidiert das Objekt mit Wand oder Einrichtung.';
 }else if(tool==='floor'){
  // Full-surface PHOTO selection, never painted squares or dirt splashes.
  if(cursorTile(uv.x,uv.y)){
   room.floorStyle=$('floorType').value;
   room.tiles=[];
   checkpoint();
  }
 }else if(tool==='portal'){
  const clicked=portals.nearest(room,uv.x,uv.y,1),p=portals.nearest(room,uv.x,uv.y,Number($('portalWidth').value));
  if(!clicked){$('editorStatus').textContent='Nur Außenkanten sind als Verbindungspunkte möglich.';return;}
  room.portals=room.portals||[];
  const old=room.portals.find(q=>q.side===clicked.side&&shape.line(room,q)===shape.line(room,clicked)&&clicked.offset>=q.offset&&clicked.offset<q.offset+q.width);
  if(old){room.portals=room.portals.filter(q=>portals.key(q)!==portals.key(old));checkpoint();}
  else if(p){const status=portals.inspect(room,p,cat,placement);if(status.ok){room.portals.push(p);checkpoint();}else $('editorStatus').textContent=status.reason+' · Wand bleibt unverändert.';}
  else $('editorStatus').textContent='Durchgang ist breiter als diese Raumseite.';
 }else if(tool==='wall'){
  const at=nearestWall(uv.x,uv.y);
  if(at){const old=room.walls.find(w=>keyWall(w)===at.id);
   if(old)old.style=at.style;else room.walls.push({x:at.x,y:at.y,edge:at.edge,style:at.style});
   if(!cat.walls[at.style]?.solid)
    room.furniture=room.furniture.filter(o=>o.wallRef!==at.id);
   checkpoint();}
 }else if(tool==='erase'){
  if(hit){room.furniture=room.furniture.filter(f=>f.id!==hit.id);selected=null;checkpoint();}
  else{
   const wall=nearestWall(uv.x,uv.y);
   const nearEdge=Math.min(Math.abs(uv.x-Math.round(uv.x)),
    Math.abs(uv.y-Math.round(uv.y)))<.23;
   if(wall&&nearEdge&&room.walls.some(w=>keyWall(w)===wall.id)){
    room.walls=room.walls.filter(w=>keyWall(w)!==wall.id);
    room.furniture=room.furniture.filter(o=>o.wallRef!==wall.id);
    checkpoint();
   }else{
    const cell=cursorTile(uv.x,uv.y);
    if(cell){room.tiles=room.tiles.filter(t=>t.x!==cell.x||t.y!==cell.y);checkpoint()}
   }
  }
 }
 schedule();
});
c.addEventListener('pointermove',e=>{
 const pos=getPointer(e),uv=toWorld(pos.x,pos.y);
 if(dragging?.type==='pan'){
  ox=dragging.ox+e.clientX-dragging.x;oy=dragging.oy+e.clientY-dragging.y;
 }else if(dragging?.type==='brush'){
  const last=dragging.last,steps=Math.min(120,Math.max(1,Math.ceil(Math.hypot(pos.x-last.x,pos.y-last.y)/(Math.max(4,P.stepY*zoom*.35)))));
  for(let i=1;i<=steps;i++)paintFloor({x:last.x+(pos.x-last.x)*i/steps,y:last.y+(pos.y-last.y)*i/steps},dragging.add);
  dragging.last=pos;
 }else if(dragging?.type==='move'){
  const obj=room.furniture.find(f=>f.id===dragging.id);
  if(obj){const prior={...obj};
   const wallTarget=architecturalTarget(pos,uv);
   const next=(cat.furniture[obj.type].wallMounted||cat.furniture[obj.type].category==='wall-architecture')?
    (wallTarget?architecture.attach(obj.type,room,cat,wallTarget.x,wallTarget.y,obj.id):null):
    placement.snap({...obj,x:quant(uv.x+dragging.deltaX),
      y:quant(uv.y+dragging.deltaY)},room,cat,prior);
   if(next)Object.assign(obj,next);
   if(!fits(obj,obj.id))Object.assign(obj,prior);
   ambientRoutes.clear();
   refreshInspector();
  }
 }
 const currentTile=cursorTile(uv.x,uv.y);
 const target=tool==='place'&&(cat.furniture[chosenFurniture]?.wallMounted||cat.furniture[chosenFurniture]?.category==='wall-architecture')?
  architecturalTarget(pos,uv):uv;
 const portalTarget=tool==='portal'?portals.nearest(room,uv.x,uv.y,Number($('portalWidth').value)):null;
 const brushUV=toWorld(pos.x,pos.y);
 hover=tool==='shapeAdd'||tool==='shapeRemove'?{kind:'brush',x:Math.floor(brushUV.x),y:Math.floor(brushUV.y)}:tool==='portal'?(portalTarget?{kind:'portal',portal:portalTarget}:null):tool==='wall'||tool==='erase'?nearestWall(uv.x,uv.y):
  tool==='floor'?(currentTile?{...currentTile,kind:'tile'}:null):
  target?{x:precise(target.x),y:precise(target.y),kind:'world'}:null;
 $('sceneStatus').textContent=(playing?'Spieltest · ':'')+'Raster '+uv.x.toFixed(2)+' × '+uv.y.toFixed(2)+' · '+(tool==='select'?'Möbel verschieben':tool);
 schedule();
});
function pointerEnd(){
 if(!dragging)return;
 if(dragging.type==='move'||dragging.type==='brush')checkpoint();
 dragging=null;
}
c.addEventListener('pointerup',pointerEnd);c.addEventListener('pointercancel',pointerEnd);
c.addEventListener('contextmenu',e=>e.preventDefault());
c.addEventListener('wheel',e=>{
 e.preventDefault();const p=getPointer(e),before=toWorld(p.x,p.y);
 zoom=clamp(zoom*Math.exp(-e.deltaY*.0011),.35,3.5);
 const after=project(before.x,before.y);
 ox+=p.x-after.x;oy+=p.y-after.y;updateZoom();schedule();
},{passive:false});
function rotate(delta){
 const obj=item();if(!obj)return;
 if((cat.furniture[obj.type].wallMounted||cat.furniture[obj.type].category==='wall-architecture')){
  $('editorStatus').textContent='Wandverzierungen drehen sich automatisch zur befestigten Wand.';return;
 }
 const previous={...obj};obj.rot=(obj.rot+delta+360)%360;
 const snapped=placement.snap(obj,room,cat);
 obj.x=snapped.x;obj.y=snapped.y;
 if(!fits(obj,obj.id)){Object.assign(obj,previous);return}
 checkpoint();refreshInspector();
}
function changeSelected(key,value){
 const obj=item();if(!obj)return;
 const prior={...obj};
 if((cat.furniture[obj.type].wallMounted||cat.furniture[obj.type].category==='wall-architecture')&&
  ['x','y','rot'].includes(key)){
  $('editorStatus').textContent='Wandverzierung direkt an eine andere Wand ziehen.';refreshInspector();return;
 }
 obj[key]=value;
 if(key==='x'||key==='y'||key==='rot'){
  const next=placement.snap(obj,room,cat,prior);
  obj.x=next.x;obj.y=next.y;
 }
 if(!fits(obj,obj.id)){
  Object.assign(obj,prior);
  $('editorStatus').textContent='Nicht möglich: Möbel würde kollidieren.';
 }
 checkpoint();refreshUI();
}
function deleteSelected(){
 if(!selected)return;room.furniture=room.furniture.filter(f=>f.id!==selected);
 selected=null;checkpoint();
}
function download(){
 const clean=sanitize(room),invalid=clean.portals.filter(p=>!portals.inspect(clean,p,cat,placement).ok);
 if((invalid.length||!clean.portals.length)&&!confirm('Verbindungspunkte fehlen oder sind ungültig. Trotzdem als Entwurf exportieren?'))return;
 const data=JSON.stringify(clean,null,2);
 const blob=new Blob([data+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=(room.id||'mind-room').replace(/[^a-z0-9-_]/gi,'-')+'.json';a.click();URL.revokeObjectURL(url);
 $('editorStatus').textContent=invalid.length||!clean.portals.length?'JSON als Entwurf gespeichert · Verbindungspunkte prüfen.':'JSON gespeichert · Verbindungspunkte enthalten.';
}
function refreshInspector(){
 const obj=item();$('inspector').hidden=!obj;$('noSelection').hidden=Boolean(obj);
 if(!obj){
  for(const id of ['propX','propY','propRotation','rotLeft','rotRight'])$(id).disabled=false;
  return;
 }
 $('selectedType').textContent=cat.furniture[obj.type].label;
 $('selectedId').value=obj.id;
 $('propX').value=obj.x;$('propY').value=obj.y;$('propRotation').value=obj.rot;
 const mounted=(cat.furniture[obj.type].wallMounted||cat.furniture[obj.type].category==='wall-architecture');
 $('propX').disabled=mounted;$('propY').disabled=mounted;
 $('propRotation').disabled=mounted;$('rotLeft').disabled=mounted;$('rotRight').disabled=mounted;
 $('propDestroyable').checked=obj.destroyable;$('propVaultable').checked=obj.vaultable;
 $('propBlocks').checked=obj.blocksMovement;
 $('lightStateRow').hidden=!cat.furniture[obj.type].lights?.length;
 $('propLit').checked=obj.lit!==false;
 const footprint=cat.furniture[obj.type].footprint;
 const spec=cat.furniture[obj.type];
 $('footprintLabel').textContent=(mounted?'WANDGEBUNDEN · '+obj.wallRef+' · ':
  spec.category==='architectural-floor'?'HÖHENOBERFLÄCHE · ':'Kollision ')+
  footprint.w+' × '+footprint.h+' m · '+(spec.surface?
   'begehbare Höhe '+spec.surface.elevation+' m · '+spec.surface.access:
   'Höhe '+spec.height+' m')+' · '+(obj.vaultable?'Vault erlaubt':'Vault gesperrt');
}
function refreshPortals(){
 const list=$('portalList');list.replaceChildren();let valid=0;
 for(const p of room.portals||[]){const status=portals.inspect(room,p,cat,placement);if(status.ok)valid++;const b=document.createElement('button');const side={north:'Nord',east:'Ost',south:'Süd',west:'West'}[p.side];b.textContent=(status.ok?'✓ ':'! ')+side+' '+(p.offset+1)+' · '+p.width+' m · '+status.reason+' · ×';b.title='Markierung entfernen';b.onclick=()=>{room.portals=room.portals.filter(q=>portals.key(q)!==portals.key(p));checkpoint()};list.appendChild(b);}
 $('portalStatus').textContent=valid+' gültig / '+(room.portals||[]).length+' markiert'+(valid?'':' · mindestens einen Zugang festlegen');
}
function refreshUI(){
 refreshPortals();
 $('roomName').value=room.name;$('roomW').value=room.width;$('roomH').value=room.height;
 $('floorType').value=room.floorStyle;$('wallType').value=room.wallStyle;
 $('sceneLabel').textContent=room.name.toUpperCase()+' · '+room.width+' × '+room.height+' · '+shape.cells(room).length+' Bodenfelder';
 $('gridBtn').classList.toggle('active',showGrid);
 $('undoBtn').disabled=historyPos<=0;$('redoBtn').disabled=historyPos>=history.length-1;
 document.querySelectorAll('[data-floor]').forEach(el=>el.classList.toggle('active',el.dataset.floor===room.floorStyle));
 document.querySelectorAll('[data-wall]').forEach(el=>el.classList.toggle('active',el.dataset.wall===room.wallStyle));
 const list=$('objectList');list.replaceChildren();
 for(const obj of room.furniture){
  const b=document.createElement('button');
  b.className=obj.id===selected?'selected':'';
  const label=document.createElement('span');label.textContent=cat.furniture[obj.type].label;
  const angle=document.createElement('small');angle.textContent=obj.wallRef?
   'Wand '+obj.wallRef:(cat.furniture[obj.type].surface?
    cat.furniture[obj.type].surface.elevation+' m':obj.rot+'°');
  b.append(label,angle);b.onclick=()=>{select(obj.id);chooseTool('select')};list.appendChild(b);
 }
 refreshInspector();schedule();
}
function previewBackground(entry){
 // Preview is optional: never eagerly download 17 huge material scans.
 // Also avoid CSS background *layers*, which caused both Poly Haven
 // fallbacks to download even when the local image had loaded.
 return 'url("'+entry.asset+'?v=uv-8floors-9walls")';
}
function requestSwatchPreview(button,entry){
 if(button.dataset.previewLoaded)return;
 button.dataset.previewLoaded='1';
 button.style.backgroundImage=previewBackground(entry);
}
function wireSwatchPreview(button,entry){
 button.addEventListener('pointerenter',()=>requestSwatchPreview(button,entry),{once:true});
 button.addEventListener('focus',()=>requestSwatchPreview(button,entry),{once:true});
}
for(const [type,entry] of Object.entries(cat.floors)){
 const option=document.createElement('option');option.value=type;option.textContent=entry.label;$('floorType').appendChild(option);
 const b=document.createElement('button');b.className='swatch';
 b.style.background='linear-gradient(150deg,'+entry.accent+','+entry.base+','+entry.grout+')';
 // Keep a fast CSS color swatch until the material is actually inspected.
 wireSwatchPreview(b,entry);
 b.style.backgroundSize='cover';
 b.setAttribute('aria-label','Boden wählen: '+entry.label);
 b.dataset.floor=type;b.title=entry.label;b.onclick=()=>{
  requestSwatchPreview(b,entry);
  $('floorType').value=type;room.floorStyle=type;room.tiles=[];checkpoint();};
 $('floorSwatches').appendChild(b);
}
for(const [type,entry] of Object.entries(cat.walls)){
 const option=document.createElement('option');option.value=type;option.textContent=entry.label;
 $('wallType').appendChild(option);
 // Metal bars and doors need swatches too: previously they were hidden
 // in the dropdown despite existing as drawable wall types.
 if(!['photo-wall-map','metal-bars','blender-bars'].includes(entry.render))continue;
 const button=document.createElement('button');
 button.className='swatch';
 button.dataset.wall=type;
 button.setAttribute('aria-label','Wand wählen: '+entry.label);
 button.title=entry.label+(entry.variant==='half'?' · 1 m':entry.variant==='full'?' · 2 m':'');
 if(entry.render==='photo-wall-map'){
  button.style.background='#4e4b47';
  wireSwatchPreview(button,entry);
  button.style.backgroundSize='cover';
  button.style.backgroundPosition='center';
 }else{
  button.classList.add('prison-bar-swatch');
  if(entry.variant==='half')button.classList.add('half-height');
  button.setAttribute('aria-description',entry.height+' Meter hoch, blockiert Bewegung');
 }
 button.onclick=()=>{
  if(entry.render==='photo-wall-map')requestSwatchPreview(button,entry);
  $('wallType').value=type;room.wallStyle=type;checkpoint();
 };
 $('wallSwatches').appendChild(button);
}
// Thumbnail bytes are requested only for palette entries near the viewport.
const thumbnailObserver=('IntersectionObserver' in window)?
 new IntersectionObserver(entries=>{
  for(const item of entries)if(item.isIntersecting){
   const img=item.target;
   img.src=img.dataset.src;
   thumbnailObserver.unobserve(img);
  }
 },{root:document.querySelector('.sidebar.left'),rootMargin:'32px'}):null;
const categoryRank=e=>e.category==='lighting'?3:e.category==='ambient-life'?4:e.category==='floor-clutter'?2:e.category==='architectural-floor'?5:e.category==='wall-architecture'?1:0;
 for(const [type,entry] of Object.entries(cat.furniture).sort((a,b)=>categoryRank(a[1])-categoryRank(b[1]))){
  if(['lighting','ambient-life'].includes(entry.category)&&!document.querySelector('.'+entry.category+'-heading')){const heading=document.createElement('div');heading.className='catalog-section-label '+entry.category+'-heading';heading.textContent=entry.category==='lighting'?'BELEUCHTUNGSQUELLEN · animiertes Feuer':'AMBIENT-LEBEN · bewegte Insekten';$('furnitureCatalog').appendChild(heading);}
 if(entry.category==='wall-architecture'&&!document.querySelector('.wall-architecture-heading')){
  const heading=document.createElement('div');
  heading.className='catalog-section-label wall-architecture-heading';
  heading.textContent='WANDVERZIERUNGEN · nur an vorhandenen Wänden';
  $('furnitureCatalog').appendChild(heading);
 }
 if(entry.category==='architectural-floor'&&!document.querySelector('.architectural-floor-heading')){
  const heading=document.createElement('div');
  heading.className='catalog-section-label architectural-floor-heading';
  heading.textContent='BODENARCHITEKTUR · echte Höhen und Übergänge';
  $('furnitureCatalog').appendChild(heading);
 }
 if(entry.category==='floor-clutter'&&!document.querySelector('.floor-clutter-heading')){
  const heading=document.createElement('div');heading.className='catalog-section-label floor-clutter-heading';
  heading.textContent='BODENDEKORATION · begehbare Kleinteile und Geröll';
  $('furnitureCatalog').appendChild(heading);
 }
 const b=document.createElement('button');b.className='catalog-item';
 b.dataset.furniture=type;
 const icon=document.createElement('span');icon.className='catalog-icon';
 const thumb=document.createElement('img');thumb.className='catalog-thumb';thumb.alt=entry.label+' · 0°';
 thumb.loading='lazy';thumb.decoding='async';thumb.dataset.assetType=type;thumb.dataset.src=spriteUrl(type,0);
 if(!entry.ambient){if(thumbnailObserver)thumbnailObserver.observe(thumb);else thumb.src=thumb.dataset.src;}
 thumb.onerror=()=>{thumb.dataset.failed='true';thumb.title='Sprite konnte nicht geladen werden: '+thumb.dataset.src;};
 thumb.onload=()=>{thumb.dataset.failed='false';thumb.title='';};
 if(entry.ambient)icon.textContent=entry.ambient==='roach'?'♣':'✳';else icon.appendChild(thumb);
 const contents=document.createElement('span');contents.innerHTML='<strong>'+entry.label+'</strong><small>'+
  entry.footprint.w+' × '+entry.footprint.h+' Felder · '+
  ((entry.wallMounted||entry.category==='wall-architecture')?'nur an Wand':entry.ambient?'animierte Umgebung':
   entry.surface?'Höhe '+entry.surface.elevation+' m · '+entry.surface.access:
   entry.blocksMovement?(entry.vaultable?'überspringbar':'blockiert Bewegung'):'begehbar')+'</small>';
 b.append(icon,contents);b.onclick=()=>{
  chosenFurniture=type;if(!entry.ambient)requestSprite(type,0);
  document.querySelectorAll('[data-furniture]').forEach(el=>el.classList.toggle('selected',el===b));
  chooseTool('place');
 };$('furnitureCatalog').appendChild(b);
}
document.querySelector('[data-furniture]').classList.add('selected');
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>chooseTool(b.dataset.tool));
$('roomName').addEventListener('change',e=>changeRoom(()=>room.name=e.target.value.trim().slice(0,80)||'Raum'));
for(const [id,field] of [['roomW','width'],['roomH','height']])$(id).addEventListener('change',e=>{
 const val=clamp(Number(e.target.value)|0,2,30);
 if(room.floorCells){
  const limit=field==='width'?'x':'y';if(room.floorCells.some(c=>c[limit]>=val)){$('editorStatus').textContent='Zuerst Bodenfelder außerhalb der neuen Größe entfernen.';e.target.value=room[field];return;}
  room[field]=val;checkpoint();fit();return;
 }
 changeRoom(()=>{
  const oldW=room.width,oldH=room.height;
  room[field]=val;
  // Keep the boundary walls attached to the RESIZED room, not suspended
  // at the old perimeter. Other placed internal walls remain where drawn.
  for(const w of room.walls){
   if(field==='width'&&w.edge==='west'&&w.x===oldW)w.x=val;
   if(field==='height'&&w.edge==='north'&&w.y===oldH)w.y=val;
  }
  room.tiles=room.tiles.filter(t=>t.x<room.width&&t.y<room.height);
  room.walls=room.walls.filter(w=>w.x<=room.width&&w.y<=room.height);
  // Expand a pre-existing enclosed cell along any NEW exterior perimeter
  // while retaining all internal tile and gate edits.
  if(field==='width'&&val>oldW)for(let x=oldW;x<val;x++){
   if(room.walls.some(w=>w.edge==='north'&&w.y===0))
    room.walls.push({x,y:0,edge:'north',style:'stone'});
   if(room.walls.some(w=>w.edge==='north'&&w.y===room.height))
    room.walls.push({x,y:room.height,edge:'north',style:'bars'});
  }
  if(field==='height'&&val>oldH)for(let y=oldH;y<val;y++){
   if(room.walls.some(w=>w.edge==='west'&&w.x===0))
    room.walls.push({x:0,y,edge:'west',style:'stone'});
   if(room.walls.some(w=>w.edge==='west'&&w.x===room.width))
    room.walls.push({x:room.width,y,edge:'west',style:'stone'});
  }
  room.furniture=room.furniture.filter(o=>{
   const f=bounds(o),eps=placement.epsilon*.5;
   return f.left>=eps&&f.top>=eps&&
    f.right<=room.width-eps&&f.bottom<=room.height-eps;
  });
 });fit();
});
$('floorType').addEventListener('change',e=>changeRoom(()=>{room.floorStyle=e.target.value;room.tiles=[]}));
$('wallType').addEventListener('change',e=>{room.wallStyle=e.target.value;checkpoint()});
$('rotLeft').onclick=()=>rotate(-90);$('rotRight').onclick=()=>rotate(90);
$('propRotation').onchange=e=>changeSelected('rot',Number(e.target.value));
$('selectedId').onchange=e=>{const value=e.target.value.trim();
 if(!value||room.furniture.some(f=>f.id===value&&f.id!==selected)){refreshInspector();return}
 changeSelected('id',value);selected=value;refreshUI();};
for(const [id,key] of [['propX','x'],['propY','y']])$(id).onchange=e=>changeSelected(key,Math.round(Number(e.target.value)*1000)/1000);
for(const [id,key] of [['propDestroyable','destroyable'],['propVaultable','vaultable'],['propBlocks','blocksMovement'],['propLit','lit']])
 $(id).onchange=e=>changeSelected(key,e.target.checked);
$('deleteBtn').onclick=deleteSelected;
$('duplicateBtn').onclick=()=>{
 const obj=item();if(!obj)return;
 const copy=placement.snap({...clone(obj),id:obj.type+'-'+Date.now().toString(36),
  x:quant(obj.x+.75),y:quant(obj.y+.75)},room,cat);
 if(!fits(copy)){ $('editorStatus').textContent='Kein Platz für ein Duplikat.';return }
 room.furniture.push(copy);selected=copy.id;checkpoint();
};
$('portalSuggest').onclick=()=>{const found=portals.suggest(room,cat,placement);if(!found.length){$('editorStatus').textContent='Keine weiteren geeigneten freien Außenkanten gefunden.';return;}if(!confirm(found.length+' vorgeschlagene Verbindungspunkte übernehmen? Wände bleiben unverändert.'))return;room.portals=[...(room.portals||[]),...found];checkpoint();chooseTool('portal');};
 $('portalWidth').onchange=()=>{hover=null;schedule()};
 $('exportBtn').onclick=download;
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{room=sanitize(JSON.parse(await file.text()));resetHistory();fit();
  $('editorStatus').textContent='Raumdatei geladen · '+file.name;
 }catch(error){alert('Raum konnte nicht importiert werden: '+error.message)}
 e.target.value='';
};
$('presetBtn').onclick=async()=>{
 if(!confirm('Musterzelle laden und aktuellen Entwurf ersetzen?'))return;
 let preset=kit.preset;
 try{
  const response=await fetch('./presets/prison-cell-01.json',{cache:'no-cache'});
  if(response.ok)preset=await response.json();
 }catch(error){console.warn('Editor verwendet eingebautes Zell-Preset:',error)}
 room=sanitize(preset);resetHistory();fit();
};
$('newBtn').onclick=()=>{if(!confirm('Neuen leeren Raum anlegen?'))return;
 room=sanitize({id:'new-prison-room',name:'Neuer Gefängnisraum',width:7,height:5,
  floorStyle:room.floorStyle,wallStyle:'stone',walls:[],furniture:[]});resetHistory();fit();};
$('undoBtn').onclick=()=>undo(-1);$('redoBtn').onclick=()=>undo(1);
$('playBtn').onclick=()=>togglePlay(!playing);
$('guardianBtn').onclick=()=>{
 showGuardian=!showGuardian;
 $('guardianBtn').classList.toggle('active',showGuardian);
 $('guardianBtn').textContent='◆ Spiel-Wächter '+(showGuardian?'ausblenden':'einblenden');
 schedule();
};
$('gridBtn').onclick=()=>{showGrid=!showGrid;refreshUI()};
$('fitBtn').onclick=fit;
for(const [id,factor] of [['zoomInBtn',1.18],['zoomOutBtn',1/1.18]])
 $(id).onclick=()=>{zoom=clamp(zoom*factor,.35,3.5);updateZoom();schedule()};
window.addEventListener('keydown',e=>{
 const inField=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
 if(e.ctrlKey||e.metaKey){
  if(e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey?1:-1)}
  if(e.key.toLowerCase()==='y'){e.preventDefault();undo(1)}
  if(e.key.toLowerCase()==='d'&&!inField){e.preventDefault();$('duplicateBtn').click()}
  return;
 }
 if(inField)return;
 const k=e.key.toLowerCase();keys.add(k);
 if(playing){
  if(k==='p'){togglePlay(false)}
  if(k===' '){e.preventDefault();vault()}
  if(['arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  return;
 }
 const shortcuts={v:'select',b:'floor',w:'wall',f:'place',e:'erase',c:'portal',n:'shapeAdd',m:'shapeRemove'};
 if(shortcuts[k])chooseTool(shortcuts[k]);
 if(k==='r')rotate(90);
 if(k==='g'){$('gridBtn').click()}
 if(k==='p')togglePlay(true);
 if(k==='delete'||k==='backspace')deleteSelected();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
let last=performance.now();
function loop(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;
 if(playing){playStep(dt);dirty=true}
 if(!document.hidden&&now-lastAmbientFrame>=1000/24&&room.furniture.some(o=>cat.furniture[o.type]?.lights||cat.furniture[o.type]?.ambient)){lastAmbientFrame=now;dirty=true;}
 if(dirty)draw();
 requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
refreshUI();updateAssetInfo();
$('reloadArtBtn').onclick=()=>refreshArtManifest(true);
refreshArtManifest();
window.addEventListener('focus',()=>{if([...assets.values()].some(v=>v.failed))refreshArtManifest();});
window.MindRoomEditor={
 get room(){return clone(room)},get selected(){return selected},
 exportJSON:()=>JSON.stringify(sanitize(room),null,2),
 load(value){room=sanitize(value);resetHistory();fit()},
 get catalog(){return cat},
 project:(u,v,z)=>project(u,v,z),unproject:(x,y)=>toWorld(x,y),
 get assetsReady(){return [...assets.values()].filter(v=>v.ready).length}
};
})();