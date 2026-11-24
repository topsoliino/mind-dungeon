/* Mind Dungeon Room Atelier art pipeline, independent from the game.
 * Blender files are rendered once by CI; browser only blits cached images.
 * The Guardian is sampled from the ORIGINAL Guardian character atlas.
 */
window.MindRoomArt=(()=>{
 'use strict';
 const ROOT='./assets/',ROOT_GUARDIAN='../art/player-study/';
 const images=new Map(),watchers=[];
 const emit=()=>watchers.forEach(listener=>listener());
 // Load the published 30m atlas when available. During slow art builds
 // fall back to the EXACT original 2K Poly Haven Diffuse JPEG so users see
 // real floor/wall graphics immediately, never an empty grey material.
 function preload(key,src,fallbackSrc=null,worldWidth=null){
  const result={img:null,ready:false,failed:false,src,kind:'atlas',
                worldWidth,fallbackSrc,attemptedFallback:false};
  images.set(key,result);
  const img=new Image();
  result.img=img;
  img.onload=()=>{
   if(img.naturalWidth<700||img.naturalHeight<700){
    result.failed=true;
    console.warn('Editor material too small:',key);
   }else{
    result.failed=false;
    result.ready=true;
   }
   emit();
  };
  img.onerror=()=>{
   if(result.fallbackSrc&&!result.attemptedFallback){
    result.attemptedFallback=true;
    result.kind='diffuse';
    console.info('Room Atelier: original Poly Haven diffuse fallback for',key);
    img.src=result.fallbackSrc;
    return;
   }
   result.failed=true;emit();
  };
  img.src=src;
  return result;
 }
 // Only true flat UV diffuse maps, NEVER perspective presentation previews.
 // Eight 30m floor atlases and three aligned 30m wall strips break the
 // highly visible 2m material-repetition grid while retaining stone scale.
 const PHOTOS=[
  ['dungeon-ashlar','floor-albedo-01.jpg','floor-atlas-01.jpg','dark_rock_02',false],
  ['dungeon-coast-rocks','floor-albedo-02.jpg','floor-atlas-02.jpg','coast_sand_rocks_02',false],
  ['dungeon-cut-stone','floor-albedo-03.jpg','floor-atlas-03.jpg','cobblestone_floor_09',false],
  ['dungeon-mossy-cobbles','floor-albedo-04.jpg','floor-atlas-04.jpg','cobblestone_floor_04',false],
  ['dungeon-ruined-cobbles','floor-albedo-05.jpg','floor-atlas-05.jpg','cobblestone_floor_03',false],
  ['dungeon-aged-paving','floor-albedo-06.jpg','floor-atlas-06.jpg','stone_floor',false],
  ['dungeon-rustic-slate','floor-albedo-07.jpg','floor-atlas-07.jpg','slate_floor_02',false],
  ['dungeon-wet-mud','floor-albedo-08.jpg','floor-atlas-08.jpg','brown_mud_03',false],
  ['stone','wall-albedo-01.jpg','wall-atlas-01.jpg','rock_wall_17',true],
  ['stone-cut','wall-albedo-02.jpg','wall-atlas-02.jpg','rock_wall_16',true],
  ['stone-old','wall-albedo-03.jpg','wall-atlas-03.jpg','old_stone_wall',true],
  ['stone-rough-12','wall-albedo-04.jpg','wall-atlas-04.jpg','rock_wall_12',true],
  ['stone-rough-13','wall-albedo-05.jpg','wall-atlas-05.jpg','rock_wall_13',true],
  ['stone-rough-14','wall-albedo-06.jpg','wall-atlas-06.jpg','rock_wall_14',true],
  ['stone-rough-15','wall-albedo-07.jpg','wall-atlas-07.jpg','rock_wall_15',true],
  ['stone-castle-slates','wall-albedo-08.jpg','wall-atlas-08.jpg','castle_wall_slates',true],
  ['stone-castle-aged','wall-albedo-09.jpg','wall-atlas-09.jpg','castle_wall_varriation',true]
 ];
 for(const [key] of PHOTOS)images.set(key,{img:null,ready:false,requested:false,failed:false,src:''});
 // Load each material independently. A malformed variant record must NEVER
 // blank all floors and all walls again (regression: wall keys were emitted
 // inside floorVariants in the first v6 asset manifest).
 let atlasWarning='',materialManifestReady=false;
 const materialSources=new Map(),materialDemand=new Set();
 // Material PNG/JPG atlases are huge. Only request the current room floor
 // and stone-wall styles actually present in the scene; keep the full
 // manifest validation and original Poly Haven fallback on first demand.
 function ensureMaterial(style){
  const resource=images.get(style);
  if(!resource||resource.requested)return;
  materialDemand.add(style);
  if(!materialManifestReady)return;
  const source=materialSources.get(style);
  if(!source)return;
  preload(style,source.src,source.fallback,source.worldWidth).requested=true;
 }
 async function loadPhotographicMaterials(){
  let manifest=null;
  try{
   const response=await fetch(ROOT+'tiles/manifest.json?v=nine-walls-v8',{cache:'no-store'});
   if(!response.ok)throw Error('Materialmanifest HTTP '+response.status);
   manifest=await response.json();
   if(!['mind-dungeon-room-tiles/v6','mind-dungeon-room-tiles/v7','mind-dungeon-room-tiles/v8'].includes(manifest.schema)||
      manifest.textureMode!=='uv-ready-polyhaven-diffuse')
    throw Error('Falsche Materialmanifest-Version');
  }catch(error){
   atlasWarning='Manifest nicht verfügbar; prüfe Bilddateien direkt';
   console.warn('Room Atelier manifest:',error.message);
  }
  for(const [style,rawFile,atlasFile,assetId,wall] of PHOTOS){
   const raw=manifest?.assetInfo?.[style];
   const atlas=manifest?.atlasInfo?.[style];
   const file=(wall?manifest?.wallVariants:manifest?.floorVariants)?.[style];
   const atlasMapped=(wall?manifest?.wallAtlases:manifest?.floorAtlases)?.[style];
   const cat=(wall?window.MindRoomKit.catalog.walls:
                   window.MindRoomKit.catalog.floors)[style];
   const valid=file===rawFile&&atlasMapped===atlasFile&&
      raw?.file===rawFile&&raw?.asset===assetId&&
      raw?.byteIdenticalToSource===true&&
      raw?.textureRole==='Diffuse/albedo, flat UV ready'&&
      /^[0-9a-f]{64}$/.test(raw?.sha256||'')&&
      atlas?.file===atlasFile&&atlas?.sourceSha256===raw.sha256&&
      /^[0-9a-f]{64}$/.test(atlas?.sha256||'')&&
      Math.abs(atlas?.worldWidth-30)<.01&&
      Math.abs(atlas?.worldHeight-(wall?2:30))<.01&&
      Number.isFinite(cat?.worldWidth)&&
      Math.abs(cat.worldWidth-raw.worldWidth)<.01;
   if(!valid){
    atlasWarning='Mindestens ein Manifesteintrag fehlt; Bilder werden direkt geladen';
    console.warn('Room Atelier: material-manifest mismatch for',style,
                 '- trying the verified atlas filename instead');
   }
   // The known v6 atlas filenames are unique to the corrected Diffuse pipeline.
   // Even during a stale Pages deployment, try these exact editor-local assets.
   const version=valid?atlas.sha256:'eight-floors-v7';
   materialSources.set(style,{
    src:ROOT+'tiles/'+atlasFile+'?v='+version,
    fallback:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/'+assetId+
     '/'+assetId+'_diff_2k.jpg',
    worldWidth:cat?.worldWidth
   });
  }
  materialManifestReady=true;
  for(const style of materialDemand)ensureMaterial(style);
  emit();
 }
 void loadPhotographicMaterials();
 // In the game the Guardian's pre-rendered atlas is the verified fallback
 // to the expensive GLB rig. Use the exact same frame metadata and images.
 let guardianAtlas=null,guardianBody=[],guardianWeapon=[],guardianStatus='loading';
 async function loadGuardian(){
  try{
   const response=await fetch(ROOT_GUARDIAN+'guardian-frames.json?v=18',{cache:'no-cache'});
   if(!response.ok)throw Error('guardian frame manifest unavailable');
   guardianAtlas=await response.json();
   guardianBody=new Array(guardianAtlas.sheets.body.length).fill(null);
   guardianWeapon=new Array(guardianAtlas.sheets.weapon.length).fill(null);
   // Only the animation pages currently required by the visible character
   // are fetched. Walking/vault frames load when the playtest needs them.
   guardianStatus='ready';
  }catch(error){
   guardianStatus='error';
   console.warn('Room editor Guardian atlas unavailable:',error);
  }
  emit();
 }
 void loadGuardian();
 function guardianPage(sheet,index){
  if(!guardianAtlas||!Number.isInteger(index)||index<0||
     index>=guardianAtlas.sheets[sheet].length)return null;
  const pages=sheet==='body'?guardianBody:guardianWeapon;
  if(!pages[index]){
   const img=new Image(),entry={img,ready:false,failed:false};
   pages[index]=entry;
   img.onload=()=>{entry.ready=true;emit()};
   img.onerror=()=>{entry.failed=true;console.warn('Missing Guardian sheet',sheet,index);emit()};
   img.src=ROOT_GUARDIAN+guardianAtlas.sheets[sheet][index]+'?v=17';
  }
  return pages[index].ready?pages[index].img:null;
 }
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function viewFacing(worldAngle){
  // Identical view transform to AlleyStudy's 42 × 24.249 isometric camera.
  const dx=Math.cos(worldAngle),dy=Math.sin(worldAngle);
  const screenAngle=Math.atan2((dx+dy)/Math.sqrt(3),dx-dy);
  // This is DungeonGuardian.facing() (8 authored directions) rather than
  // guessing image filenames that do not exist.
  const projected=Math.atan2(Math.sin(screenAngle)/.47,Math.cos(screenAngle));
  return (Math.round(projected/(Math.PI/4))+8)%8;
 }
 function drawGuardian(ctx,{point,angle=0,time=0,moving=false,vault=0,zoom=1}){
  const p=point,scale=110/128*zoom;
  ctx.save();
  ctx.globalAlpha=.33;ctx.fillStyle='#090c14';
  ctx.beginPath();ctx.ellipse(p.x,p.y+3*zoom,14*zoom,6*zoom,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
  // Never invent a proxy character: only the real game Guardian may appear.
  if(guardianStatus!=='ready')return false;
  const name=vault>0?'vault':moving?'walk':'idle';
  const [start,count]=guardianAtlas.clips[name];
  // Walking is cyclic. Vault is a one-shot synchronized with the light
  // physics preview and the original Guardian's 19-frame animation.
  const t=vault>0?clamp(1-vault,0,.999):moving?(time*1.5)%1:(time*.6)%1;
  const pose=Math.min(count-1,Math.floor(t*count)),index=(start+pose)*8+viewFacing(angle);
  const drawLayer=(data,sheet)=>{
   if(!data)return;
   const [sx,sy,w,h,dx,dy,page]=data,img=guardianPage(sheet,page);
   if(img)ctx.drawImage(img,sx,sy,w,h,
    p.x-55*zoom+dx*scale,p.y-.77597*110*zoom+dy*scale,
    w*scale,h*scale);
  };
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  drawLayer(guardianAtlas.body[index],'body');
  drawLayer(guardianAtlas.weapon[index],'weapon');
  ctx.restore();
  return true;
 }
 // Only one world-aligned atlas is sampled for the entire visible room.
 // No per-tile texture restarting at all. The source JPEGs remain separately
 // available for material thumbnails and provenance.
 function getPhoto(style){
  ensureMaterial(style);
  const data=images.get(style);
  return data?.ready?data.img:null;
 }
 function drawRoomFloor(ctx,room,project){
  const image=getPhoto(room.floorStyle);
  const corners=[project(0,0),project(room.width,0),
                 project(room.width,room.height),project(0,room.height)];
  const origin=corners[0],ex=project(1,0),ey=project(0,1);
  ctx.save();
  ctx.beginPath();
  if(Array.isArray(room.floorCells)){
   // Merge contiguous cells into row strips before clipping one continuous atlas.
   const rows=new Map();for(const {x,y} of room.floorCells){const row=rows.get(y)||[];row.push(x);rows.set(y,row);}
   for(const [y,xs] of rows){xs.sort((a,b)=>a-b);let start=xs[0],end=start;for(let i=1;i<=xs.length;i++){if(xs[i]===end+1){end=xs[i];continue;}const points=[project(start,y),project(end+1,y),project(end+1,y+1),project(start,y+1)];ctx.moveTo(points[0].x,points[0].y);for(let k=1;k<4;k++)ctx.lineTo(points[k].x,points[k].y);ctx.closePath();start=end=xs[i];}}
  }else{ctx.moveTo(corners[0].x,corners[0].y);for(let i=1;i<corners.length;i++)ctx.lineTo(corners[i].x,corners[i].y);ctx.closePath();}
  ctx.clip();
  ctx.transform(ex.x-origin.x,ex.y-origin.y,ey.x-origin.x,ey.y-origin.y,
                origin.x,origin.y);
  if(image){
   const x=(room.width-30)*.5,y=(room.height-30)*.5;
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   const resource=images.get(room.floorStyle);
   if(resource?.kind==='atlas'){
    ctx.drawImage(image,x,y,30,30);
   }else{
    // Temporary direct-source fallback until the editor-only CI bakes its
    // non-repeating 30m atlas. Keep the native photographed stone scale.
    const worldW=resource?.worldWidth||2;
    const worldH=worldW*image.naturalHeight/image.naturalWidth;
    for(let v=0;v<room.height;v+=worldH)
     for(let u=0;u<room.width;u+=worldW)
      ctx.drawImage(image,u,v,worldW,worldH);
   }
  }else{
   ctx.fillStyle='#484846';ctx.fillRect(0,0,room.width,room.height);
  }
  ctx.restore();
  return true;
 }
 function drawWallFace(ctx,style,topA,topB,bottomA,bottomB,along,height=2){
  const image=getPhoto(style);
  if(!image)return false;
  // A 30-metre horizontal wall strip, 2 metres vertically. Source is actual
  // FLAT diffuse material, not a photograph of a tilted wall demo.
  const resource=images.get(style);
  const span=resource?.kind==='atlas'?30:(resource?.worldWidth||2);
  const sourceX=resource?.kind==='atlas'?
    Math.max(0,Math.min(29,along))*image.naturalWidth/30:
    (((along%span)+span)%span)*image.naturalWidth/span;
  const sourceW=image.naturalWidth/span;
  ctx.save();
  ctx.beginPath();ctx.moveTo(topA.x,topA.y);ctx.lineTo(topB.x,topB.y);
  ctx.lineTo(bottomB.x,bottomB.y);ctx.lineTo(bottomA.x,bottomA.y);
  ctx.closePath();ctx.clip();
  // Basis u is along the top wall edge; v is physical vertical DOWN.
  // This is orthogonal in world axes despite the skew of the iso camera.
  ctx.transform(topB.x-topA.x,topB.y-topA.y,
                bottomA.x-topA.x,bottomA.y-topA.y,
                topA.x,topA.y);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  // During direct-source fallback preserve physical scale in BOTH
  // directions: e.g. a 1.6-metre scan must not stretch to a 2-metre wall.
  // Instead repeat the original albedo vertically until the wall is filled.
  const usable=Math.min(sourceW,image.naturalWidth-sourceX);
  const portion=usable/sourceW;
  const sourceH=resource?.kind==='atlas'?height:
                 span*image.naturalHeight/image.naturalWidth;
  const drawStrip=(v,worldH)=>{
   const dv=worldH/height;
   const sy=0,sh=(worldH/sourceH)*image.naturalHeight;
   ctx.drawImage(image,sourceX,sy,usable,sh,0,v/height,portion,dv);
   if(portion<.999999)
    ctx.drawImage(image,0,sy,sourceW-usable,sh,
                  portion,v/height,1-portion,dv);
  };
  if(resource?.kind==='atlas')drawStrip(0,height);
  else for(let v=0;v<height;v+=sourceH)
   drawStrip(v,Math.min(sourceH,height-v));
  ctx.restore();
  return true;
 }
 function status(){
  // Reporting must never trigger downloading every material.
  const floors=PHOTOS.filter(p=>!p[4]&&images.get(p[0])?.ready).length;
  const walls=PHOTOS.filter(p=>p[4]&&images.get(p[0])?.ready).length;
  const requestedFloors=PHOTOS.filter(p=>!p[4]&&images.get(p[0])?.requested).length;
  const requestedWalls=PHOTOS.filter(p=>p[4]&&images.get(p[0])?.requested).length;
  return {
   tiles:floors+'/'+requestedFloors+' benötigte Böden',
   wallPhotos:walls+'/'+requestedWalls+' benötigte Mauern',
   guardian:guardianStatus,guardianAuthentic:guardianStatus==='ready'&&guardianBody.some(p=>p?.ready),
   tileReady:floors>0,wallsReady:walls===requestedWalls,
   assetWarning:atlasWarning,
   failedTextures:PHOTOS.filter(p=>images.get(p[0])?.failed).map(p=>p[0]),
   fallbackTextures:PHOTOS.filter(p=>images.get(p[0])?.ready&&images.get(p[0])?.kind==='diffuse').map(p=>p[0])
  };
 }
 return {drawGuardian,drawRoomFloor,drawWallFace,status,onChange(callback){watchers.push(callback)}};
})();
