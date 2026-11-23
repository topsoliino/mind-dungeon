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
 // Six CC0 photos. Accept ONLY the new manifest mapping, source SHA and
 // physically calibrated width. No recolor or artificial dirt at runtime.
 const PHOTOS=[
  ['dungeon-ashlar','floor-prison-01.png','dark_rock_02',false],
  ['dungeon-coast-rocks','floor-prison-02.png','coast_sand_rocks_02',false],
  ['dungeon-cut-stone','floor-prison-03.png','cobblestone_floor_09',false],
  ['stone','wall-masonry-01.png','rock_wall_17',true],
  ['stone-cut','wall-masonry-02.png','rock_wall_16',true],
  ['stone-old','wall-masonry-03.png','old_stone_wall',true]
 ];
 const PHOTO_KEYS=PHOTOS.map(info=>info[0]);
 for(const key of PHOTO_KEYS)
  images.set(key,{img:null,ready:false,failed:false,src:''});
 async function loadPhotographicMaterials(){
  try{
   const response=await fetch(ROOT+'tiles/manifest.json?v=wet-dungeon-six-v1',{cache:'no-cache'});
   if(!response.ok)throw Error('Material manifest unavailable');
   const manifest=await response.json();
   if(manifest.schema!=='mind-dungeon-room-tiles/v4'||
      manifest.textureMode!=='original-photo-byte-identical')
    throw Error('Six new Poly Haven photos are not published yet');
   const selections=[];
   for(const [style,file,assetId,wall] of PHOTOS){
    const info=manifest.assetInfo?.[style];
    const expected=(wall?manifest.wallVariants:manifest.floorVariants)?.[style];
    const catalog=(wall?window.MindRoomKit.catalog.walls:window.MindRoomKit.catalog.floors)[style];
    if(expected!==file||info?.file!==file||info?.asset!==assetId||
       info.byteIdenticalToSource!==true||
       info.imageRotationDegrees!==0||info.imageMirrored!==false||
       !/^[0-9a-f]{64}$/.test(info?.sha256||'')||
       !Number.isFinite(info?.worldWidth)||Math.abs(info.worldWidth-catalog.worldWidth)>.01)
      throw Error('Missing or incorrectly scaled original: '+style);
    selections.push([style,ROOT+'tiles/'+file+'?v='+info.sha256]);
   }
   for(const [style,src] of selections)preload(style,src);
  }catch(error){
   for(const key of PHOTO_KEYS){
    const info=images.get(key);
    if(!info.ready)info.failed=true;
   }
   console.warn('Room Atelier six-photo build not yet available:',error.message);
   emit();
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
 // The photos are transferred UNCHANGED. The only transformation is
 // mapping source picture coordinates into the isometric world geometry.
 // Poly Haven specifies each photo's physical size in metres. Our preview
 // is calibrated to about 1 game-grid unit per metre (Guardian ~2 units tall).
 // A photo does not restart on every floor tile or every wall segment.
 function getPhoto(style){
  const entry=images.get(style);
  return entry?.ready?entry.img:null;
 }
 function photoSpan(style,image,wall){
  const data=wall?window.MindRoomKit.catalog.walls[style]:
                  window.MindRoomKit.catalog.floors[style];
  const width=data?.worldWidth;
  if(!Number.isFinite(width)||width<=0)return null;
  return [width,width*image.naturalHeight/image.naturalWidth];
 }
 function fillOriginal(ctx,image,scaleX,scaleY,x,y,w,h){
  // The Pattern transform is in WORLD coordinates, not CSS/screen pixels.
  // This is a single GPU-friendly fill even for 30x30 rooms.
  const pattern=ctx.createPattern(image,'repeat');
  if(pattern&&typeof pattern.setTransform==='function'&&
     typeof DOMMatrix==='function'){
   pattern.setTransform(new DOMMatrix([
    scaleX/image.naturalWidth,0,0,scaleY/image.naturalHeight,-x,-y
   ]));
   ctx.fillStyle=pattern;
   ctx.fillRect(0,0,w,h);
   return;
  }
  // Correctly aligned fallback for older browsers without pattern transforms.
  const firstX=-(x%scaleX+scaleX)%scaleX;
  const firstY=-(y%scaleY+scaleY)%scaleY;
  for(let py=firstY;py<h;py+=scaleY)
   for(let px=firstX;px<w;px+=scaleX)
    ctx.drawImage(image,px,py,scaleX,scaleY);
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
   const [spanX,spanY]=photoSpan(room.floorStyle,image,false);
   ctx.imageSmoothingEnabled=true;
   ctx.imageSmoothingQuality='high';
   // World-anchored orientation: x-axis of original texture == room x-axis.
   fillOriginal(ctx,image,spanX,spanY,0,0,room.width,room.height);
  }else{
   ctx.fillStyle='#454545';ctx.fillRect(0,0,room.width,room.height);
  }
  ctx.restore();
  return true;
 }
 function drawWallFace(ctx,style,topA,topB,bottomA,bottomB,along,height=2){
  const image=getPhoto(style);
  if(!image)return false;
  const [spanX,spanY]=photoSpan(style,image,true);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topA.x,topA.y);ctx.lineTo(topB.x,topB.y);
  ctx.lineTo(bottomB.x,bottomB.y);ctx.lineTo(bottomA.x,bottomA.y);
  ctx.closePath();ctx.clip();
  // Canvas coordinates (u,v) travel along each wall and down its height.
  // A full wall is height metres; v is normalized to 0..1 here.
  ctx.transform(topB.x-topA.x,topB.y-topA.y,
                bottomA.x-topA.x,bottomA.y-topA.y,topA.x,topA.y);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  // Image spans spanX metres along the wall, spanY metres vertically.
  // The negative offset ensures adjacent segments sample contiguous pixels.
  fillOriginal(ctx,image,spanX,spanY/height,along,0,1,1);
  ctx.restore();
  return true;
 }
 function status(){
  const floors=PHOTOS.filter(p=>!p[3]&&getPhoto(p[0])).length;
  const walls=PHOTOS.filter(p=>p[3]&&getPhoto(p[0])).length;
  return {
   tiles:floors+'/3 Poly-Haven-Böden',
   wallPhotos:walls+'/3 Poly-Haven-Mauern',
   guardian:guardianStatus,guardianAuthentic:guardianStatus==='ready',
   tileReady:floors>0,wallsReady:walls===3
  };
 }
 return {drawGuardian,drawRoomFloor,drawWallFace,status,onChange(callback){watchers.push(callback)}};
})();
