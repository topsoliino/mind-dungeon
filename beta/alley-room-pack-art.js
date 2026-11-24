// Reuse the editor's physical UV scale, grille crop and sprite foot anchors.
(function(root){
'use strict';
const {cat,image,furniture}=root.AlleyRoomPack;
const sx=cat.projection.stepX,sy=cat.projection.stepY,cache=new Map();
function bitmap(key,w,h,paint){
 if(!cache.has(key)){
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(w);canvas.height=Math.ceil(h);
  paint(canvas.getContext('2d'));cache.set(key,canvas);
 }
 return cache.get(key);
}
function floorArt(t){
 const spec=cat.floors[t.data.floorStyle],img=image(spec.asset);
 if(!img)return null;
 const {width:w,height:h}=t.data;
 return bitmap('floor/'+t.id,(w+h)*sx+2,(w+h)*sy+2,ctx=>{
  ctx.translate(h*sx+1,1);ctx.transform(sx,sy,-sx,sy,0,0);
  const pattern=ctx.createPattern(img,'repeat');
  pattern.setTransform(new DOMMatrix().scale(spec.worldWidth/img.width,spec.worldWidth/img.height));
  ctx.fillStyle=pattern;ctx.beginPath();
  for(const [x,y] of t.cells)ctx.rect(x,y,1,1);
  ctx.fill();
 });
}
function wallArt(o){
 const spec=cat.walls[o.style],h=spec.height*48;
 if(!h)return null;
 const img=image(spec.asset);
 if(!img)return null;
 const horizontal=o.edge==='north'||o.edge==='south',along=horizontal?o.x:o.y;
 const key=['wall',o.style,horizontal,along].join('/');
 const canvas=bitmap(key,sx+2,sy+h+2,ctx=>{
  ctx.translate(horizontal?1:sx+1,1);
  ctx.transform(horizontal?sx:-sx,sy,0,h,0,0);
  if(spec.render==='blender-bars'){
   const sw=img.width/spec.cameraOrthoScale,sh=img.height*spec.height/spec.cameraOrthoScale;
   ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,0,0,1,1);
  }else{
   const pattern=ctx.createPattern(img,'repeat');
   pattern.setTransform(new DOMMatrix().translate(-along,0).scale(spec.worldWidth/img.width,spec.worldWidth/spec.height/img.height));
   ctx.fillStyle=pattern;ctx.fillRect(0,0,1,1);
  }
 });
 return {canvas,key,dx:horizontal?-1:-sx-1,dy:-h-1};
}
function lift(a,x,y){
 for(const o of a.t.data.furniture){
  if(a.removed.has(o.id))continue;
  const spec=cat.furniture[o.type];if(!spec.surface)continue;
  const b=root.MindRoomPlacement.bounds(o,cat),u=x-a.x,v=y-a.y;
  if(u>=b.left&&u<=b.right&&v>=b.top&&v<=b.bottom)
   return spec.surface.elevation*48*(1-(v-b.top)/(b.bottom-b.top));
 }
 return 0;
}
function append(sprites,a,iso,z,alpha){
 if(alpha<=0)return;
 const {t}=a,world=(x,y)=>iso.toView((x+a.x)*48,(y+a.y)*48,z);
 const depth=z?4000:0,origin=world(0,0),ground=floorArt(t);
 function layer(img,key,x,y,d){
  sprites.push({image:img,key:'authored/'+key,x,y,width:img.width,height:img.height,depth:d,originX:0,originY:0,alpha});
 }
 if(ground)layer(ground,t.id,origin.x-t.data.height*sx-1,origin.y-1,depth-.5);
 for(const wall of t.data.walls){
  // A camera-facing boundary is hidden; internal partitions stay visible.
  if(!root.MindRoomShape.has(t.data,wall.x,wall.y))continue;
  const art=wallArt(wall);if(!art)continue;
  const pt=world(wall.x,wall.y);
  layer(art.canvas,art.key,pt.x+art.dx,pt.y+art.dy,depth+pt.y+sy*.5);
 }
 for(const o of t.data.furniture){
  if(a.removed.has(o.id))continue;
  const pt=world(o.x,o.y),clutter=cat.furniture[o.type].category==='floor-clutter';
  const obj=furniture(o,pt,depth+(clutter?-.2:pt.y+.1));
  if(obj){obj.alpha=alpha;sprites.push(obj);}
 }
}
root.AlleyRoomPackArt={append,lift};
})(window);
