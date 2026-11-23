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
  img.onload=()=>{result.ready=true;emit()};
  img.onerror=()=>{result.failed=true;emit()};
  img.src=src;
  return result;
 }
 preload('floor',ROOT+'tiles/floor-prison-01.webp');
 preload('wall-x',ROOT+'tiles/wall-prison-x.webp');
 preload('wall-y',ROOT+'tiles/wall-prison-y.webp');
 // In the game the Guardian's pre-rendered atlas is the verified fallback
 // to the expensive GLB rig. Use the exact same frame metadata and images.
 let guardianAtlas=null,guardianBody=[],guardianWeapon=[],guardianStatus='loading';
 async function loadGuardian(){
  try{
   const response=await fetch(ROOT_GUARDIAN+'guardian-frames.json?v=18');
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
  if(guardianStatus!=='ready'){
   // Visible armored-human silhouette ONLY while the authentic atlas loads.
   // Never show the former sphere/eye placeholder.
   ctx.save();
   ctx.translate(p.x,p.y);
   ctx.fillStyle='#242b35';
   ctx.beginPath();ctx.ellipse(0,-30*zoom,15*zoom,30*zoom,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#8f95a0';
   ctx.fillRect(-13*zoom,-49*zoom,26*zoom,30*zoom);
   ctx.fillStyle='#b9b9b7';ctx.fillRect(-9*zoom,-67*zoom,18*zoom,19*zoom);
   ctx.fillStyle='#36363d';ctx.fillRect(-7*zoom,-58*zoom,14*zoom,5*zoom);
   ctx.restore();return false;
  }
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
 // Tile sprites rendered by Blender at 512×512 from an orthographic camera
 // aligned to AlleyStudy's screen axes. Each artwork is larger than a tile:
 // its empty transparent padding makes the world foot pivot exact.
 const ASSET_PX=512;
 const UNIT_WORLD_X=42;
 const FLOOR_ORTHO=2.65,WALL_ORTHO=3.25;
 function spriteSize(ortho,zoom){return UNIT_WORLD_X*ortho*Math.SQRT2*zoom}
 function drawFloor(ctx,center,zoom){
  const asset=images.get('floor');
  if(!asset?.ready)return false;
  const size=spriteSize(FLOOR_ORTHO,zoom);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(asset.img,center.x-size/2,center.y-size/2,size,size);
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
  return {
   tiles:[...images.values()].filter(x=>x.ready).length+'/3',
   guardian:guardianStatus,guardianAuthentic:guardianStatus==='ready',
   tileReady:images.get('floor')?.ready||false,
   wallsReady:images.get('wall-x')?.ready&&images.get('wall-y')?.ready
  };
 }
 return {drawGuardian,drawFloor,drawWall,status,onChange(callback){watchers.push(callback)}};
})();
