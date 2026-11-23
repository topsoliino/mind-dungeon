/* Mind Dungeon Room Atelier art pipeline, independent from the game.
 * Blender files are rendered once by CI; browser only blits cached images.
 * The Guardian is sampled from the ORIGINAL Guardian character atlas.
 */
window.MindRoomArt=(()=>{
 'use strict';
 const ROOT='./assets/',ROOT_GUARDIAN='../art/player-study/';
 const images=new Map(),watchers=[];
 const emit=()=>watchers.forEach(listener=>listener());
 function preload(key,src){
  const result={img:null,ready:false,failed:false,src};
  images.set(key,result);
  const img=new Image();
  result.img=img;
  img.onload=()=>{
   if(img.naturalWidth<700||img.naturalHeight<700){
    result.failed=true;
    console.warn('Original source photo too small:',key);
   }else result.ready=true;
   emit();
  };
  img.onerror=()=>{result.failed=true;emit()};
  img.src=src;
  return result;
 }
 // Texture options must come from a verified, published material manifest.
 // Assets are independently selectable, and the same map is sampled across
 // consecutive wall segments at a fixed scale without 1-tile repetitions.
 const PHOTO_KEYS=['floor','floor-cut','wall-photo-stone','wall-photo-stone-cut'];
 for(const key of PHOTO_KEYS)images.set(key,{img:null,ready:false,failed:false,src:''});
 async function loadPhotographicMaterials(){
  try{
   const response=await fetch(ROOT+'tiles/manifest.json?v=original-material-v4',{cache:'no-cache'});
   if(!response.ok)throw Error('Material manifest unavailable');
   const manifest=await response.json();
   if(manifest.textureMode!=='original-photo-byte-identical'||
      manifest.floorMaterial!=='original-photo-byte-identical'||
      manifest.wallMaterial!=='original-photo-byte-identical')
    throw Error('Original untouched photo materials not published yet');
   if(!/^[0-9a-f]{64}$/.test(manifest.floorGeneratorSha256||'')||
      !/^[0-9a-f]{64}$/.test(manifest.wallGeneratorSha256||''))
    throw Error('Material build hash missing');
   const materials=[
    ['floor','dungeon-ashlar',manifest.floorVariants?.['dungeon-ashlar']],
    ['floor-cut','dungeon-cut-stone',manifest.floorVariants?.['dungeon-cut-stone']],
    ['wall-photo-stone','stone',manifest.wallVariants?.stone],
    ['wall-photo-stone-cut','stone-cut',manifest.wallVariants?.['stone-cut']]
   ];
   const allowed=/^(floor-prison-0[12]\.png|wall-masonry-0[12]\.png)$/;
   for(const [key,style,file] of materials){
    const info=manifest.assetInfo?.[style];
    if(typeof file!=='string'||!allowed.test(file)||info?.file!==file||
       !/^[0-9a-f]{64}$/.test(info?.sha256||'')||
       info.byteIdenticalToSource!==true)
      throw Error('Original photo asset missing or unverified: '+style);
    preload(key,ROOT+'tiles/'+file+'?v='+info.sha256);
   }
  }catch(error){
   for(const key of PHOTO_KEYS)images.get(key).failed=true;
   console.warn('Room Atelier photographic materials pending:',error.message);
   emit();
  }
 }
 void loadPhotographicMaterials();
 preload('wall-x',ROOT+'tiles/wall-prison-x.webp');
 preload('wall-y',ROOT+'tiles/wall-prison-y.webp');
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
 // The assets are imported byte-for-byte from Poly Haven's visible
 // previews, not authored or color-graded by the editor. Only the camera
 // projection maps those unchanged source pixels onto our room geometry.
 const UNIT_WORLD_X=42,WALL_ORTHO=3.25;
 function spriteSize(ortho,zoom){return UNIT_WORLD_X*ortho*Math.SQRT2*zoom}
 function drawRoomFloor(ctx,room,project){
  const asset=images.get(room.floorStyle==='dungeon-cut-stone'?'floor-cut':'floor');
  const corners=[project(0,0),project(room.width,0),
                 project(room.width,room.height),project(0,room.height)];
  const origin=corners[0],ex=project(1,0),ey=project(0,1);
  ctx.save();
  ctx.beginPath();ctx.moveTo(corners[0].x,corners[0].y);
  for(let i=1;i<corners.length;i++)ctx.lineTo(corners[i].x,corners[i].y);
  ctx.closePath();ctx.clip();
  // Transform the existing image plane only. Never draw dirt or colored
  // overlays, and never modify the original source pixels.
  ctx.transform(ex.x-origin.x,ex.y-origin.y,ey.x-origin.x,ey.y-origin.y,
                origin.x,origin.y);
  if(asset?.ready){
   const img=asset.img;
   // A 2:1 original scan occupies 12x6 world units at readable stone
   // size. Repeat the UNCHANGED image only for rooms larger than the map.
   const spanY=6,spanX=spanY*img.naturalWidth/img.naturalHeight;
   const centerX=(room.width-spanX)/2,centerY=(room.height-spanY)/2;
   const firstX=centerX+Math.floor(-centerX/spanX)*spanX;
   const firstY=centerY+Math.floor(-centerY/spanY)*spanY;
   ctx.imageSmoothingEnabled=true;
   ctx.imageSmoothingQuality='high';
   for(let y=firstY;y<room.height;y+=spanY)
    for(let x=firstX;x<room.width;x+=spanX)
     ctx.drawImage(img,x,y,spanX,spanY);
  }else{
   // Neutral placeholder instead of the old fake stone polygons and grime.
   ctx.fillStyle='#484744';ctx.fillRect(0,0,room.width,room.height);
  }
  ctx.restore();
  return true;
 }
 function drawWallFace(ctx,style,topA,topB,bottomA,bottomB,along){
  const key=style==='stone-cut'?'wall-photo-stone-cut':'wall-photo-stone';
  const asset=images.get(key);
  if(!asset?.ready)return false;
  const img=asset.img;
  // Each photo covers four world units by two wall-height units. Sampling
  // adjacent slices retains source continuity; the image is NEVER rebuilt.
  const columns=Math.max(1,Math.round(2*img.naturalWidth/img.naturalHeight));
  const part=((along%columns)+columns)%columns;
  const unit=img.naturalWidth/columns;
  ctx.save();
  ctx.beginPath();ctx.moveTo(topA.x,topA.y);ctx.lineTo(topB.x,topB.y);
  ctx.lineTo(bottomB.x,bottomB.y);ctx.lineTo(bottomA.x,bottomA.y);
  ctx.closePath();ctx.clip();
  ctx.transform(topB.x-topA.x,topB.y-topA.y,
                bottomA.x-topA.x,bottomA.y-topA.y,topA.x,topA.y);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(img,part*unit,0,unit,img.naturalHeight,0,0,1,1);
  ctx.restore();
  return true;
 }
 function drawWall(ctx,center,axis,zoom){
  const asset=images.get(axis==='x'?'wall-x':'wall-y');
  if(!asset?.ready)return false;
  const size=spriteSize(WALL_ORTHO,zoom);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(asset.img,center.x-size/2,center.y-size/2,size,size);
  return true;
 }
 function status(){
  const floors=['floor','floor-cut'].filter(k=>images.get(k)?.ready).length;
  const walls=['wall-photo-stone','wall-photo-stone-cut'].filter(k=>images.get(k)?.ready).length;
  return {
   tiles:floors+'/2 Originalböden',
   wallPhotos:walls+'/2 Originalmauern',
   guardian:guardianStatus,guardianAuthentic:guardianStatus==='ready',
   tileReady:floors>0,
   wallsReady:walls===2,
   floorReady:images.get('floor')?.ready||false,
   floorCutReady:images.get('floor-cut')?.ready||false,
  };
 }
 return {drawGuardian,drawRoomFloor,drawWall,drawWallFace,status,onChange(callback){watchers.push(callback)}};
})();
