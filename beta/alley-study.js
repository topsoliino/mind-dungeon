(() => {
 'use strict';

 const generatorMode=Boolean(window.AlleyGenerator?.enabled);
 const stepX=42,stepY=stepX/Math.sqrt(3);
 // World geometry grows with the generator, not by shrinking the camera.
 // Reserve room for the cut walls above every floor edge; keep the original
 // coordinate system untouched when the handcrafted alley is selected.
 const areas=generatorMode?[
  ...window.AlleyStudyMap.art.ground.map(o=>o.area),
  ...window.AlleyStudyMap.art.standing.map(o=>o.area),
  ...window.AlleyStudyMap.art.backdrop.map(o=>o.area),
  window.AlleyStudyMap.art.foreground.arch.area
 ]:[];
 const uv=areas.flatMap(([u,v,r,b])=>[[u,v],[u,b],[r,v],[r,b]]);
 const diff=uv.map(([u,v])=>u-v),sum=uv.map(([u,v])=>u+v);
 const originX=generatorMode?Math.ceil(250-Math.min(...diff)*stepX):491;
 const originY=generatorMode?Math.ceil(240-Math.min(...sum)*stepY):73;
 const width=generatorMode?Math.ceil(originX+Math.max(...diff)*stepX+250):1900;
 const height=generatorMode?Math.ceil(originY+Math.max(...sum)*stepY+180):1050;
 const footOffset=16;
 const project=(u,v,z=0)=>[originX+(u-v)*stepX,originY+(u+v)*stepY-z];
 const position=(u,v)=>{
  const [x,y]=project(u,v);
  return {x,y:y-footOffset};
 };
 const unproject=(x,y)=>{
  const horizontal=(x-originX)/stepX,vertical=(y+footOffset-originY)/stepY;
  return [(vertical+horizontal)/2,(vertical-horizontal)/2];
 };
 const corners=([u,v,r,b],z=0)=>[project(u,v,z),project(r,v,z),project(r,b,z),project(u,b,z)];
 const contains=([u,v,r,b],x,y)=>x>=u&&x<=r&&y>=v&&y<=b;

 function trace(ctx,points) {
  ctx.moveTo(...points[0]);
  for(const point of points.slice(1))ctx.lineTo(...point);
  ctx.closePath();
 }
 function polygon(ctx,points,fill,stroke) {
  ctx.beginPath();
  trace(ctx,points);
  ctx.fillStyle=fill;
  ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
 }
 function line(ctx,points,color,size=1) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for(const point of points.slice(1))ctx.lineTo(...point);
  ctx.strokeStyle=color;
  ctx.lineWidth=size;
  ctx.stroke();
  ctx.lineWidth=1;
 }
 function bitmap(draw) {
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  draw(canvas.getContext('2d'));
  return canvas;
 }
 function cacheObject(area,objectHeight,draw) {
  const points=corners(area);
  const horizontal=points.map(point=>point[0]),vertical=points.map(point=>point[1]);
  const x=Math.floor(Math.min(...horizontal))-2;
  const y=Math.floor(Math.min(...vertical)-objectHeight)-2;
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(Math.max(...horizontal))-x+2;
  canvas.height=Math.ceil(Math.max(...vertical))-y+2;
  const ctx=canvas.getContext('2d');
  ctx.translate(-x,-y);
  draw(ctx);
  return {x,y,canvas};
 }
 function face(ctx,low,high,from,to,color,edge) {
  polygon(ctx,[low[from],low[to],high[to],high[from]],color,edge);
 }
 function block(ctx,area,height,colors) {
  const bottom=corners(area),top=corners(area,height);
  face(ctx,bottom,top,1,2,colors[0],colors[3]);
  face(ctx,bottom,top,2,3,colors[1],colors[3]);
  polygon(ctx,top,colors[2],colors[3]);
 }
 const facadeArt=window.AlleyArchitecture.create({project,polygon,line});
 const route=window.AlleyRoute??null;
 const stone={
  basalt:{pitch:[.47,.29],colors:['#4e5363','#565c6e','#5d6272','#494e5f','#626674','#535565'],edge:'#7e849388'},
  court:{pitch:[.42,.43],colors:['#626577','#6e6e80','#7e7886','#696878','#737184'],edge:'#a69baa9c'},
  curb:{pitch:[.55,.38],colors:['#737385','#80798a','#6f6d80','#817d8e'],edge:'#a9a1acaa'},
  threshold:{pitch:[.51,.43],colors:['#655568','#705d70','#735e71','#7c687a'],edge:'#a5899eaa'},
  ...(route?.materials??{})
 };
 function paving(ctx,{area,material},random) {
  const [minU,minV,maxU,maxV]=area;
  const {pitch:[du,dv],colors,edge}=stone[material];
  ctx.save();
  ctx.beginPath();trace(ctx,corners(area));ctx.clip();
  polygon(ctx,corners(area),'#282935');
  for(let row=0,v=minV;v<maxV;row++,v=minV+row*dv){
   for(let u=minU-row%2*du/2;u<maxU;u+=du){
    const padU=.011,padV=.012;
    const a=u+padU,b=v+padV,c=u+du-padU,d=v+dv-padV;
    const chip=()=>.008+.026*random();
    const shape=[
     project(a+chip(),b),project(c-chip(),b),project(c,b+chip()),project(c,d-chip()),
     project(c-chip(),d),project(a+chip(),d),project(a,d-chip()),project(a,b+chip())
    ];
    polygon(ctx,shape,colors[Math.floor(random()*colors.length)]);
    line(ctx,[shape[6],shape[7],shape[0],shape[1]],edge);
    line(ctx,[shape[2],shape[3],shape[4],shape[5]],'#1b1d2d90',1.3);
    if(random()<.62){
     const s=a+du*.18*random(),t=b+dv*(.2+.15*random());
     line(ctx,[project(s,t),project(s+du*.20,t+.012),project(s+du*.32,t-.007)],'#b0a7ba45');
    }
    if(random()<.12)line(ctx,[project(c-.055,d),project(c-.09,d-.038),project(c-.08,d-.075)],'#2d263888');
   }
  }
  ctx.restore();
 }
 function drawDetails(ctx,{drain:[u,v],courtInlay:[cu,cv]}) {
  polygon(ctx,corners([u-.33,v-.29,u+.33,v+.29]),'#252733','#a598a9');
  for(let i=-2;i<=2;i++){
   const offset=i*.096;
   line(ctx,[project(u-.24,v+offset),project(u+.24,v+offset)],'#676778',1.8);
  }
  const diamond=([x,y],r)=>[project(x-r,y),project(x,y-r),project(x+r,y),project(x,y+r)];
  const center=[cu,cv];
  polygon(ctx,diamond(center,.7),'#504254','#a48a80');
  polygon(ctx,diamond(center,.54),'#756776','#bb9b84');
  polygon(ctx,diamond(center,.28),'#b99a82','#e1bca0');
  line(ctx,[project(cu-.39,cv),project(cu+.39,cv)],'#d6b491');
  line(ctx,[project(cu,cv-.39),project(cu,cv+.39)],'#d6b491');
 }
 const timber=['#5a4144','#74534b','#9b735a','#352936'];
 const brass='#c49d6b';
 function drawChest(ctx,u,v,open) {
  const box=[u-.26,v-.36,u+.26,v+.36],height=15;
  block(ctx,box,height,timber);
  if(open){
   polygon(ctx,corners(box,height+.5),'#392634','#b18a67');
   polygon(ctx,[project(u-.26,v-.36,height),project(u-.26,v+.36,height),
    project(u-.42,v+.36,36),project(u-.42,v-.36,36)],'#896555','#4b3541');
  }else{
   const lid=corners(box,height+4);
   face(ctx,corners(box,height),lid,1,2,'#9c7358','#492f3c');
   face(ctx,corners(box,height),lid,2,3,'#b08761','#513642');
   polygon(ctx,lid,'#a88366','#513642');
   for(const dv of [-.26,.26])line(ctx,[project(u-.24,v+dv,height+4),project(u+.26,v+dv,height+4),
    project(u+.26,v+dv,4)],'#c5a27a',2);
   polygon(ctx,[project(u+.26,v-.07,10),project(u+.26,v+.07,10),
    project(u+.26,v+.07,16),project(u+.26,v-.07,16)],brass,'#513444');
  }
 }
 function drawTable(ctx,u,v,empty) {
  const top=31;
  for(const [a,b] of [[-.31,-.49],[.31,-.49],[-.31,.49],[.31,.49]]){
   block(ctx,[u+a-.055,v+b-.055,u+a+.055,v+b+.055],top,timber);
  }
  const area=[u-.43,v-.64,u+.43,v+.64];
  const slabs=corners(area,top),bottom=corners(area,top-5);
  face(ctx,bottom,slabs,1,2,timber[0],timber[3]);
  face(ctx,bottom,slabs,2,3,timber[1],timber[3]);
  polygon(ctx,slabs,timber[2],timber[3]);
  for(const offset of [-.29,.05,.38])line(ctx,[project(u-.42,v+offset,top),project(u+.42,v+offset,top)],'#755447',1.3);
  if(!empty){
   const [x,y]=project(u-.06,v-.14,top);
   polygon(ctx,[[x-5,y-4],[x-2,y-7],[x+4,y-7],[x+6,y-3],[x,y+2]],'#b8445f','#542942');
   line(ctx,[[x-2,y-5],[x+3,y-5]],'#ef91a1');
  }
 }
 function drawBarrel(ctx,u,v,{radius,height},units) {
  const [x,y]=project(u,v),rx=radius*units,ry=rx/2,h=height*units*.882;
  ctx.beginPath();
  ctx.ellipse(x,y-h,rx,ry,0,Math.PI,0);
  ctx.lineTo(x+rx*.83,y);
  ctx.ellipse(x,y,rx*.83,ry*.83,0,0,Math.PI);
  ctx.closePath();ctx.fillStyle='#7e574a';ctx.fill();ctx.strokeStyle='#392b3b';ctx.stroke();
  for(const ratio of [.2,.77]){
   ctx.beginPath();ctx.ellipse(x,y-h*ratio,rx*(.84+.16*ratio),ry,0,0,Math.PI);
   ctx.strokeStyle='#4d4656';ctx.lineWidth=2.5;ctx.stroke();
  }
  ctx.lineWidth=1;
  ctx.beginPath();ctx.ellipse(x,y-h,rx,ry,0,0,Math.PI*2);
  ctx.fillStyle='#a2785c';ctx.fill();ctx.strokeStyle='#4f3b43';ctx.stroke();
 }
 function glow(ctx,x,y,radius,flatten,color,edge='#e6a55d00') {
  ctx.save();ctx.translate(x,y);ctx.scale(1,flatten);
  const gradient=ctx.createRadialGradient(0,0,1,0,0,radius);
  gradient.addColorStop(0,color);
  gradient.addColorStop(1,edge);
  ctx.fillStyle=gradient;ctx.fillRect(-radius,-radius,radius*2,radius*2);
  ctx.restore();
 }
 function shortestRoute(start,goal,waypoints,clearSegment){
  if(clearSegment(start,goal))return [goal];
  const nodes=[start,goal,...waypoints],cost=nodes.map(()=>Infinity),parent=nodes.map(()=>-1),closed=new Set();
  cost[0]=0;
  while(true){
   let current=-1,best=Infinity;
   for(let i=0;i<nodes.length;i++)if(!closed.has(i)&&cost[i]<best){current=i;best=cost[i];}
   if(current===-1)return null;
   if(current===1){
    const route=[];
    for(let i=1;i!==0;i=parent[i])route.push(nodes[i]);
    return route.reverse();
   }
   closed.add(current);
   const from=nodes[current];
   for(let i=1;i<nodes.length;i++){
    if(closed.has(i))continue;
    const to=nodes[i],candidate=best+Math.hypot(to.x-from.x,to.y-from.y);
    if(candidate<cost[i]&&clearSegment(from,to)){cost[i]=candidate;parent[i]=current;}
   }
  }
 }
 function create(sceneControls=null) {
  const map=window.AlleyStudyMap;
  const {backdrop,ground,groundDetails,lighting,standing,atmosphere,foreground}=map.art;
  const {walkable,stations,barrel,spawn,waypoints}=map.logic;
  const {arch:gate}=foreground;
  const [u,v,r,b]=gate.area,[a,c]=gate.opening;
  const solids=[[u,v,r,a],[u,c,r,b]];
  const routePainter={project,polygon,line,block};
  const drawUnderlay=ctx=>{
   const gradient=ctx.createLinearGradient(0,45,0,height);
   gradient.addColorStop(0,'#272637');gradient.addColorStop(.85,'#151622');
   ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
   ctx.save();
   ctx.globalAlpha=.62;
   for(const [index,building] of backdrop.entries())facadeArt.skyline(ctx,{...building,roof:18+index*5},index);
   ctx.restore();
   for(const area of walkable){
    const [u,v,r,b]=area;
    block(ctx,[u-.13,v-.13,r+.13,b+.13],0,['#272635','#272635','#39394b','#20212f']);
   }
  };
  const underlay=bitmap(drawUnderlay);
  let seed=71129;
  const random=()=>{
   seed=(Math.imul(1664525,seed)+1013904223)>>>0;
   return seed/4294967296;
  };
  const floor=bitmap(ctx=>{
   for(const surface of ground)paving(ctx,surface,random);
   route?.renderFloor(ctx,routePainter);
  });
  const detail=bitmap(ctx=>drawDetails(ctx,groundDetails));
  const homes=standing.map(home=>({...home,image:cacheObject(home.area,home.height+home.roof,ctx=>facadeArt.building(ctx,home))}));
  const gateway=cacheObject(gate.area,gate.height,ctx=>facadeArt.arch(ctx,gate));
  // A long wall spans many projected depth values. Split its RENDERING into
  // short immutable panels; physics still uses the unbroken structural wall.
  const renderWalls=(route?.walls??[]).flatMap(wall=>{
   if(!generatorMode||wall.axis==null)return [wall];
   const count=Math.ceil((wall.end-wall.start)/1.75);
   return Array.from({length:count},(_,i)=>{
    const begin=wall.start+(wall.end-wall.start)*i/count;
    const end=wall.start+(wall.end-wall.start)*(i+1)/count,th=.075;
    return {...wall,start:begin,end,area:wall.axis==='u'?
     [wall.p-th,begin,wall.p+th,end]:[begin,wall.p-th,end,wall.p+th]};
   });
  });
  const roomWalls=renderWalls.map(wall=>({...wall,image:cacheObject(wall.area,wall.height,ctx=>route.renderWall(ctx,wall,routePainter))}));
  const labSeal=route?.seal?cacheObject(route.seal,88,ctx=>route.renderSeal(ctx,routePainter)):null;
  const artListeners=[],chunkCache=[];
  const redrawImage=(image,draw)=>{
   const ctx=image.canvas.getContext('2d');
   ctx.resetTransform();
   ctx.clearRect(0,0,image.canvas.width,image.canvas.height);
   ctx.translate(-image.x,-image.y);
   draw(ctx);
  };
  facadeArt.onReady(()=>{
   const backdropContext=underlay.getContext('2d');
   backdropContext.clearRect(0,0,width,height);
   drawUnderlay(backdropContext);
   homes.forEach(home=>redrawImage(home.image,ctx=>facadeArt.building(ctx,home)));
   redrawImage(gateway,ctx=>facadeArt.arch(ctx,gate));
   // Refresh immutable GPU-sized copies after asynchronous facade textures load.
   for(const {canvas,source,x,y} of chunkCache){
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(source,-x,-y);
   }
   for(const listener of artListeners)listener();
  });
  const toggles=Object.fromEntries([...(sceneControls?.querySelectorAll('input')??[])].map(input=>[input.value,input]));
  const enabled=layer=>toggles[layer]?.checked??layer!=='logic';
  if(sceneControls)sceneControls.hidden=false;

  function blockedGround(u,v,radius){
   const samples=[[u-radius,v],[u+radius,v],[u,v-radius],[u,v+radius]];
   const outside=samples.some(([x,y])=>generatorMode?!route.containsGround(x,y):
    !walkable.some(area=>contains(area,x,y)));
   return outside||solids.some(([a,b,c,d])=>
    contains([a-radius,b-radius,c+radius,d+radius],u,v))||Boolean(route?.blocked(u,v,radius));
  }
  function blocked(x,y){return blockedGround(...unproject(x,y),.23);}
  function clearSegment(from,to){
   const dx=to.x-from.x,dy=to.y-from.y;
   const steps=Math.ceil(Math.hypot(dx,dy)/3);
   for(let i=1;i<=steps;i++){
    if(blocked(from.x+dx*i/steps,from.y+dy*i/steps))return false;
   }
   return true;
  }
  // Depth is purely structural: the camera angle is fixed, so a wall's
  // projected foot position cannot change when the player moves.
  const depthAt=area=>position((area[0]+area[2])/2,(area[1]+area[3])/2).y;
  const occlusionHull=(area,h)=>{
   const pts=[...corners(area),...corners(area,h)].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
   const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
   const lower=[],upper=[];
   for(const pt of pts){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),pt)<=0)lower.pop();lower.push(pt);}
   for(const pt of pts.slice().reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),pt)<=0)upper.pop();upper.push(pt);}
   return lower.slice(0,-1).concat(upper.slice(0,-1));
  };
  const segmentsIntersect=(a,b,c,d)=>{
   const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
   return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
  };
  const polygonOverlaps=(poly,box)=>{
   const rect=[[box.x1,box.y1],[box.x2,box.y1],[box.x2,box.y2],[box.x1,box.y2]];
   const within=([x,y])=>x>=box.x1&&x<=box.x2&&y>=box.y1&&y<=box.y2;
   const inside=p=>{
    let yes=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
     const a=poly[i],b=poly[j];
     if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
    }
    return yes;
   };
   if(poly.some(within)||rect.some(inside))return true;
   return poly.some((a,i)=>rect.some((c,j)=>segmentsIntersect(a,poly[(i+1)%poly.length],c,rect[(j+1)%4])));
  };
  const wallVisibility=(wall,heroX,heroY)=>{
   const depth=wall.renderDepth;
   // Behind-the-player walls are always fully opaque. Foreground panels fade
   // independently, so two or three overlapping panels can fade together.
   if(depth<=heroY-footOffset+2)return 1;
   return polygonOverlaps(wall.hull,{x1:heroX-29,x2:heroX+29,y1:heroY-94,y2:heroY+14})?.24:1;
  };
  const structureInfo=(image,area,height)=>({
   image,area,renderDepth:depthAt(area),hull:occlusionHull(area,height)
  });
  const wallPanels=roomWalls.map(wall=>({...structureInfo(wall.image,wall.area,wall.height),wall}));
  const housePanels=homes.map(home=>({...structureInfo(home.image,home.area,home.height+home.roof),home}));
  const archPanel=structureInfo(gateway,gate.area,gate.height);
  const sealPanel=labSeal?structureInfo(labSeal,route.seal,88):null;
  function drawGround(ctx,time){
   if(enabled('background'))ctx.drawImage(underlay,0,0);
   if(enabled('ground'))ctx.drawImage(floor,0,0);
   if(enabled('details'))ctx.drawImage(detail,0,0);
   if(enabled('ground'))drawGroundLight(ctx,time);
  }
  function drawGroundLight(ctx,time){
   if(enabled('light')){
    ctx.save();ctx.globalCompositeOperation='screen';
    for(const {at,radius,phase,tint} of lighting){
     ctx.globalAlpha=.87+.13*Math.sin(time*3.2+phase);
     glow(ctx,...project(...at),radius,.54,tint??'#a35b4090');
    }
    ctx.restore();
   }
  }
  function structures(x,y){
   const result=[],heroY=y+footOffset;
   const archDepth=archPanel.renderDepth;
   if(enabled('standing')){
    for(const {home,image,renderDepth,hull} of housePanels){
     const area=home.area;
     // This is a permanent rear-house / gateway ordering, not hero-dependent.
     const behind=home.behindArch||(area[2]>=gate.area[0]-.18&&
      area[1]<gate.area[1]&&area[3]<=gate.area[1]+.23);
     const depth=behind&&enabled('foreground')?Math.min(renderDepth,archDepth-2):renderDepth;
     const alpha=wallVisibility({renderDepth:depth,hull},x,heroY);
     result.push({image,depth,alpha});
    }
    for(const wall of wallPanels){
     result.push({image:wall.image,depth:wall.renderDepth,
      alpha:wallVisibility(wall,x,heroY)});
    }
   }
   if(enabled('foreground')){
    result.push({image:gateway,depth:archDepth,
     alpha:wallVisibility(archPanel,x,heroY)});
    if(sealPanel)result.push({image:labSeal,depth:sealPanel.renderDepth,
     alpha:route.isUnlocked()?0:wallVisibility(sealPanel,x,heroY)});
   }
   return result;
  }
  function architecture(ctx,x,y){
   return structures(x,y).map(({image,depth,alpha})=>({depth,draw:()=>{
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.drawImage(image.canvas,image.x,image.y);
    ctx.restore();
   }}));
  }
  function drawOverlays(ctx,time){
   if(enabled('atmosphere')){
    for(const {at,radius,phase} of atmosphere){
     const [x,y]=project(...at,8);
     glow(ctx,x+7*Math.sin(time*.6+phase),y,radius,.62,'#9999c02f','#9999c000');
    }
   }
   if(!enabled('light'))return;
   for(const {at,height,radius,phase,tint} of lighting){
    const [x,y]=project(...at,height);
    ctx.save();
    ctx.globalAlpha=.87+.13*Math.sin(time*3.2+phase);
    glow(ctx,x,y,radius*.47,.87,tint??'#eea25878');
    line(ctx,[[x+5,y-9],[x,y-7],[x,y-4]],'#33313d',2);
    polygon(ctx,[[x-4,y-5],[x+4,y-5],[x+3,y+5],[x-3,y+5]],'#df9962','#392c34');
    ctx.fillStyle='#f4ca93';ctx.fillRect(x-1.5,y-2.5,3,5);
    ctx.restore();
   }
  }
  function drawLogic(ctx){
   if(!enabled('logic'))return;
   for(const area of walkable)polygon(ctx,corners(area),'#48d4bd25','#69dec9');
   for(const area of solids)polygon(ctx,corners(area),'#fb78676b','#f5a28d');
   const marker=(at,color)=>{
    const [x,y]=project(...at);
    ctx.beginPath();ctx.ellipse(x,y,8,4,0,0,Math.PI*2);
    ctx.fillStyle=color;ctx.fill();
   };
   marker(spawn,'#79ddce');marker(barrel,'#ff9a81');
   for(const point of Object.values(stations))marker(point.at,'#f4c176');
  }
  const chunks=(source,depth)=>{
   const maxSize=1536,out=[];
   for(let y=0;y<height;y+=maxSize)for(let x=0;x<width;x+=maxSize){
    const canvas=document.createElement('canvas');
    canvas.width=Math.min(maxSize,width-x);canvas.height=Math.min(maxSize,height-y);
    canvas.getContext('2d').drawImage(source,-x,-y);
    chunkCache.push({canvas,source,x,y});
    out.push({canvas,x,y,depth});
   }
   return out;
  };
  function drawProp(ctx,prop,vault,units){
   const [u,v]=unproject(prop.x,prop.y);
   if(prop.kind==='chest')drawChest(ctx,u,v,prop.completed);
   else if(prop.kind==='pickup-high')drawTable(ctx,u,v,prop.completed);
   else if(route&&(prop.kind==='knowledge'||prop.kind==='apparatus'))route.renderProp(ctx,prop.kind,u,v,routePainter);
   else drawBarrel(ctx,u,v,vault,units);
  }
  return {spawn:position(...spawn),stations:Object.fromEntries(Object.entries(stations).map(([key,{at,front}])=>[key,{...position(...at),front}])),
   barrel:position(...barrel),waypoints:waypoints.map(point=>position(...point)),
   blocked,blockedGround,clearSegment,drawGround,drawProp,architecture,drawOverlays,drawLogic,structures,
   groundLayers:()=>{
    const layers=[underlay,floor,detail,bitmap(ctx=>drawGroundLight(ctx,0))];
    return generatorMode?layers.flatMap((canvas,i)=>chunks(canvas,-4+i)):
     layers.map((canvas,i)=>({canvas,x:0,y:0,depth:-4+i}));
   },
   onArtReady:listener=>artListeners.push(listener),
   overlayLayers:()=>{
    const canvas=bitmap(ctx=>drawOverlays(ctx,0));
    return generatorMode?chunks(canvas,height+1):[{canvas,x:0,y:0,depth:height+1}];
   },
   overlayLayer:()=>bitmap(ctx=>drawOverlays(ctx,0))};
 }
 window.AlleyStudy={create,shortestRoute,project,unproject,width,height,footOffset};
})();
