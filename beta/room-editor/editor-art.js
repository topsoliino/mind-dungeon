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
 for(const [key] of PHOTOS)images.set(key,{img:null,ready:false,failed:false,src:''});
 // Load each material independently. A malformed variant record must NEVER
 // blank all floors and all walls again (regression: wall keys were emitted
 // inside floorVariants in the first v6 asset manifest).
 let atlasWarning='';
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
   preload(style,ROOT+'tiles/'+atlasFile+'?v='+version,
     'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/'+assetId+
     '/'+assetId+'_diff_2k.jpg',cat?.worldWidth);
  }
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
   const load=(name)=>{
    return new Promise((resolve,reject)=>{
     const img=new Image();
     img.onload=()=>resolve(img);
     img.onerror=()=>reject(Error('Missing Guardian atlas '+name));
     img.src=ROOT_GUARDIAN+name+'?v=17';
    });
   };
   // Armature poses are already baked in two body pages + weapon atlas.
   // All pages are loaded without any runtime WebGL dependency.
   const pages=await Promise.all([
    ...guardianAtlas.sheets.body.map(load),
    ...guardianAtlas.sheets.weapon.map(load)
   ]);
   guardianBody=pages.slice(0,guardianAtlas.sheets.body.length);
   guardianWeapon=pages.slice(guardianAtlas.sheets.body.length);
   guardianStatus='ready';
  }catch(error){
   guardianStatus='error';
   console.warn('Room editor Guardian atlas unavailable:',error);
  }
  emit();
 }
 void loadGuardian();
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
  const drawLayer=(data,pages)=>{
   if(!data)return;
   const [sx,sy,w,h,dx,dy,page]=data,img=pages[page];
   if(img)ctx.drawImage(img,sx,sy,w,h,
    p.x-55*zoom+dx*scale,p.y-.77597*110*zoom+dy*scale,
    w*scale,h*scale);
  };
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  drawLayer(guardianAtlas.body[index],guardianBody);
  drawLayer(guardianAtlas.weapon[index],guardianWeapon);
  ctx.restore();
  return true;
 }
 // Only one world-aligned atlas is sampled for the entire visible room.
 // No per-tile texture restarting at all. The source JPEGs remain separately
 // available for material thumbnails and provenance.
 function getPhoto(style){
  const data=images.get(style);
  return data?.ready?data.img:null;
 }
 function drawRoomFloor(ctx,room,project){
  const image=getPhoto(room.floorStyle);
  const corners=[project(0,0),project(room.width,0),
                 project(room.width,room.height),project(0,room.height)];
  const origin=corners[0],ex=project(1,0),ey=project(0,1);
  ctx.save();
  ctx.beginPath();ctx.moveTo(corners[0].x,corners[0].y);
  for(let i=1;i<corners.length;i++)ctx.lineTo(corners[i].x,corners[i].y);
  ctx.closePath();ctx.clip();
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
  // Two crops if a one-metre wall section crosses the original diffuse edge.
  const usable=Math.min(sourceW,image.naturalWidth-sourceX);
  const portion=usable/sourceW;
  ctx.drawImage(image,sourceX,0,usable,image.naturalHeight,0,0,portion,1);
  if(portion<.999999)
   ctx.drawImage(image,0,0,sourceW-usable,image.naturalHeight,
                 portion,0,1-portion,1);
  ctx.restore();
  return true;
 }
 function status(){
  const floors=PHOTOS.filter(p=>!p[4]&&getPhoto(p[0])).length;
  const walls=PHOTOS.filter(p=>p[4]&&getPhoto(p[0])).length;
  return {
   tiles:floors+'/8 Poly-Haven-Böden',
   wallPhotos:walls+'/9 Poly-Haven-Mauern',
   guardian:guardianStatus,guardianAuthentic:guardianStatus==='ready',
   tileReady:floors>0,wallsReady:walls===9,
   assetWarning:atlasWarning,
   failedTextures:PHOTOS.filter(p=>images.get(p[0])?.failed).map(p=>p[0]),
   fallbackTextures:PHOTOS.filter(p=>images.get(p[0])?.ready&&images.get(p[0])?.kind==='diffuse').map(p=>p[0])
  };
 }
 return {drawGuardian,drawRoomFloor,drawWallFace,status,onChange(callback){watchers.push(callback)}};
})();
