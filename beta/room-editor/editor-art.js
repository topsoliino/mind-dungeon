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
   if(key==='floor'&&(img.naturalWidth!==4096||img.naturalHeight!==4096)){
    result.failed=true;console.warn('Old tile atlas detected; continuous floor build not published yet');
   }else result.ready=true;
   emit();
  };
  img.onerror=()=>{result.failed=true;emit()};
  img.src=src;
  return result;
 }
 preload('floor',ROOT+'tiles/floor-prison-01.webp?v=photographic-floor-v2');
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
 // One continuous 32x32 world-unit floor artwork. Small rooms reveal a centered
 // crop; large rooms reveal more of the SAME map. No texture scaling per room.
 // Low-cost cohesive placeholder while the high-detail WebP is being built.
 // Never fall back to visibly repeated floor tiles.
 let previewFloor=null;
 function getPreviewFloor(){
  if(previewFloor)return previewFloor;
  const image=document.createElement('canvas');image.width=image.height=1536;
  const gc=image.getContext('2d'),size=image.width;
  let seed=173641;
  const rnd=()=>{seed=(Math.imul(1664525,seed)+1013904223)|0;return (seed>>>0)/4294967296};
  gc.fillStyle='#303035';gc.fillRect(0,0,size,size);
  for(let i=0;i<2800;i++){
   const x=rnd()*size,y=rnd()*size,rx=7+rnd()*30,ry=5+rnd()*21;
   const c=Math.floor(47+rnd()*36);
   gc.fillStyle='rgb('+c+','+(c-1)+','+(c+1)+')';
   gc.strokeStyle='#202228';gc.lineWidth=1.7;
   gc.beginPath();
   for(let j=0;j<7;j++){
    const a=j*Math.PI*2/7,dist=.72+rnd()*.3;
    const px=x+Math.cos(a)*rx*dist,py=y+Math.sin(a)*ry*dist;
    if(!j)gc.moveTo(px,py);else gc.lineTo(px,py);
   }
   gc.closePath();gc.fill();gc.stroke();
  }
  for(let i=0;i<12000;i++){
   const c=rnd()>.5?'#16191d':'#837b7055';
   gc.fillStyle=c;const sz=.4+rnd()*2.8;
   gc.fillRect(rnd()*size,rnd()*size,sz,sz*.65);
  }
  previewFloor=image;return image;
 }
 const WORLD_FLOOR=32,UNIT_WORLD_X=42,WALL_ORTHO=3.25;
 function spriteSize(ortho,zoom){return UNIT_WORLD_X*ortho*Math.SQRT2*zoom}
 function drawRoomFloor(ctx,room,project){
  const asset=images.get('floor');
  const floorImage=asset?.ready?asset.img:getPreviewFloor();
  const corners=[project(0,0),project(room.width,0),
                 project(room.width,room.height),project(0,room.height)];
  const origin=corners[0],ex=project(1,0),ey=project(0,1);
  ctx.save();
  ctx.beginPath();ctx.moveTo(corners[0].x,corners[0].y);
  for(let i=1;i<corners.length;i++)ctx.lineTo(corners[i].x,corners[i].y);
  ctx.closePath();ctx.clip();
  // Image coordinates become WORLD coordinates before the isometric projection.
  ctx.transform(ex.x-origin.x,ex.y-origin.y,ey.x-origin.x,ey.y-origin.y,
                origin.x,origin.y);
  const offsetX=(room.width-WORLD_FLOOR)/2,offsetY=(room.height-WORLD_FLOOR)/2;
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(floorImage,offsetX,offsetY,WORLD_FLOOR,WORLD_FLOOR);
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
  return {
   tiles:(images.get('floor')?.ready?'1/1 – 4096px':'0/1 – Karte lädt'),
   guardian:guardianStatus,guardianAuthentic:guardianStatus==='ready',
   tileReady:images.get('floor')?.ready||false,
   wallsReady:images.get('wall-x')?.ready&&images.get('wall-y')?.ready
  };
 }
 return {drawGuardian,drawRoomFloor,drawWall,status,onChange(callback){watchers.push(callback)}};
})();
