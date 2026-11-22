// Rocky Coast outdoor heightfield + normal map + walkmesh + collision zones.
// The same interface as DungeonIsometric's indoor scene lets the existing
// Guardian, attacks, rolling and interactive movement work unchanged.
(function(root){
'use strict';
const REGION='rocky-coast',SIZE=30,WIDTH=1500,HEIGHT=1350;
const NX=WIDTH/SIZE,NY=HEIGHT/SIZE,TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const coast=y=>165+39*Math.sin(y/180)+12*Math.sin(y/49);
const river=x=>805+73*Math.sin(x/179)+17*Math.sin(x/69);
const bridge=x=>x>1015&&x<1105;
function dangerAt(x,y){
 if(x<coast(y)+1)return 'ocean';
 if(Math.abs(y-river(x))<68&&!bridge(x))return 'river';
 return null;
}
function borderAt(x,y){
 if(x<0||y<0||x>WIDTH||y>HEIGHT)return 'world-edge';
 if(y<65)return 'prison-fence';
 if(x>1450)return 'cliff-wall';
 if(y>1280)return 'dense-forest';
 // Independent boulder/rock wall marks the upper-left ridge.
 if(x<300&&y<210)return 'rock-wall';
 // The prison itself is solid. Only its exterior gate apron is walkable.
 if(x>235&&x<397&&y>175&&y<300)return 'prison-wall';
 return null;
}
function gaussian(x,y,cx,cy,rx,ry){
 return Math.exp(-(((x-cx)/rx)**2)-(((y-cy)/ry)**2));
}
function heightAt(x,y){
 const coastEdge=coast(y);
 const steep=135*smooth((x-coastEdge)/83);
 const rolling=17*Math.sin(x/154)+13*Math.cos(y/148)+
  9*Math.sin((x+y)/87)+6*Math.cos((x-y)/74);
 const ridge=94*gaussian(x,y,745,405,85,110)+
  76*gaussian(x,y,875,1085,76,98);
 const terrace=45*gaussian(x,y,410,1010,128,86);
 const h=8+steep+rolling+ridge+terrace;
 return Math.max(0,h);
}
function normalAt(x,y){
 const dx=(heightAt(x+5,y)-heightAt(x-5,y))/10;
 const dy=(heightAt(x,y+5)-heightAt(x,y-5))/10;
 const norm=Math.hypot(dx,dy,1);
 return {x:-dx/norm,y:-dy/norm,z:1/norm,dx,dy,
  grade:Math.hypot(dx,dy),angle:Math.atan(Math.hypot(dx,dy))*180/Math.PI};
}
function surfaceAt(x,y){
 const danger=dangerAt(x,y),border=borderAt(x,y),normal=normalAt(x,y);
 const slope=normal.angle;
 return {height:heightAt(x,y),normal,slope,
  zone:danger?'death':border?'border':slope>=53?'cliff-slide':
   slope>=32?'slide':slope>=23?'strain':'walk',
  danger,border};
}
function createNormalMap(){
 const canvas=document.createElement('canvas');canvas.width=NX+1;canvas.height=NY+1;
 const c=canvas.getContext('2d'),pixels=c.createImageData(NX+1,NY+1);
 for(let y=0;y<=NY;y++)for(let x=0;x<=NX;x++){
  const n=normalAt(x*SIZE,y*SIZE),i=(y*(NX+1)+x)*4;
  pixels.data[i]=Math.round((n.x*.5+.5)*255);
  pixels.data[i+1]=Math.round((n.y*.5+.5)*255);
  pixels.data[i+2]=Math.round((n.z*.5+.5)*255);
  pixels.data[i+3]=255;
 }
 c.putImageData(pixels,0,0);return canvas;
}
function create(options){
 const {tile=48,radius=14,toView,toWorld}=options;
 const spawn={x:350,y:325},prison={x:350,y:325};
 const normalMap=createNormalMap();
 const zoneNames={'world-edge':'Unpassierbare Grenze','prison-fence':'Gefängniszaun',
  'cliff-wall':'Unüberwindbare Felswand','dense-forest':'Undurchdringlicher Wald',
  'rock-wall':'Felsbarriere','prison-wall':'Gefängnismauer'};
 function walkableOnFloor(x,y,floor=0,r=radius){
  if(floor!==0)return false;
  // A death zone is not an invisible collision wall: stepping into water
  // starts the fall/death action, whereas physical borders stop traversal.
  const probes=[[0,0],[r,0],[-r,0],[0,r],[0,-r]];
  return probes.every(([dx,dy])=>!borderAt(x+dx,y+dy));
 }
 const walkable=(x,y,r=radius)=>walkableOnFloor(x,y,0,r);
 function safe(x,y,r=radius){
  if(!walkable(x,y,r)||dangerAt(x,y))return false;
  return normalAt(x,y).angle<32;
 }
 function line(from,to,fn=safe){
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/18));
  for(let i=1;i<=steps;i++){
   const t=i/steps;if(!fn(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t))return false;
  }
  return true;
 }
 // Coarse, cached A* for right-click; physical collision and height sampling
 // are still continuous. 8-way edges never cut across water/cliff borders.
 const GRID=45,GX=Math.ceil(WIDTH/GRID),GY=Math.ceil(HEIGHT/GRID);
 const nodes=new Map(),id=(x,y)=>x+','+y;
 for(let y=0;y<GY;y++)for(let x=0;x<GX;x++){
  const p={x:(x+.5)*GRID,y:(y+.5)*GRID,gx:x,gy:y};
  if(safe(p.x,p.y,10))nodes.set(id(x,y),p);
 }
 const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
 for(const p of nodes.values()){
  p.links=directions.map(([dx,dy])=>nodes.get(id(p.gx+dx,p.gy+dy)))
   .filter(q=>q&&line(p,q,(x,y)=>safe(x,y,8)));
 }
 function nearest(target){
  let best=null,score=Infinity;
  for(const p of nodes.values()){
   const d=(p.x-target.x)**2+(p.y-target.y)**2;
   if(d<score&&line(p,target,(x,y)=>safe(x,y,2))){score=d;best=p;}
  }
  return best;
 }
 function routeTo(start,target){
  const goal={x:target.x,y:target.y};
  if(!safe(goal.x,goal.y,5))return null;
  if(line(start,goal))return {goal,steps:[goal]};
  const first=nearest(start),last=nearest(goal);
  if(!first||!last)return null;
  const queue=[{p:first,g:0,f:Math.hypot(first.x-last.x,first.y-last.y)}],
   score=new Map([[id(first.gx,first.gy),0]]),prev=new Map();
  let found=null;
  for(let k=0;k<2200&&queue.length;k++){
   let best=0;for(let i=1;i<queue.length;i++)if(queue[i].f<queue[best].f)best=i;
   const current=queue.splice(best,1)[0],p=current.p;
   if(current.g>(score.get(id(p.gx,p.gy))??Infinity)+.001)continue;
   if(p===last){found=p;break;}
   for(const q of p.links){
    const key=id(q.gx,q.gy),g=current.g+Math.hypot(p.x-q.x,p.y-q.y);
    if(g>=(score.get(key)??Infinity))continue;
    score.set(key,g);prev.set(key,p);
    queue.push({p:q,g,f:g+Math.hypot(q.x-last.x,q.y-last.y)});
   }
  }
  if(!found)return null;
  const path=[];for(let p=found;p&&p!==first;p=prev.get(id(p.gx,p.gy)))path.push(p);
  path.reverse();const points=[start,...path,goal],steps=[];
  for(let i=0;i<points.length-1;){
   let far=i+1;for(let j=points.length-1;j>far;j--){
    if(line(points[i],points[j])){far=j;break;}
   }
   steps.push({x:points[far].x,y:points[far].y});i=far;
  }
  return {goal,steps};
 }
 function nearestTerrainPoint(screen,reverse=toWorld){
  let p=reverse(screen.x,screen.y,0);
  // Iteratively invert the height-displaced isometric projection.
  for(let i=0;i<6;i++){
   const candidate=reverse(screen.x,screen.y,heightAt(p.x,p.y));
   if(Math.hypot(candidate.x-p.x,candidate.y-p.y)<.2){p=candidate;break;}
   p.x+=(candidate.x-p.x)*.65;p.y+=(candidate.y-p.y)*.65;
  }
  return p;
 }
 function cameraOrigin(actor,cw,ch,zoom){
  const point=toView(actor.x,actor.y,heightAt(actor.x,actor.y));
  return {x:point.x-cw/(2*zoom),y:point.y-ch/(2*zoom)};
 }
 const palette={
  walk:['#697363','#6e7967','#75816c','#64705f'],
  strain:['#7d8173','#7d857a'],
  slide:['#797d77','#666f71'],
  'cliff-slide':['#666d73','#56636b'],
  border:['#414d51','#4b585a'],
  death:['#354e5a','#456371']
 };
 const chunks=[],CHUNK=6;
 const shade=(color,n)=>{
  const intensity=clamp(.71+n.z*.33+n.x*.18-n.y*.14,.45,1.24);
  return '#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*intensity)
   .toString(16).padStart(2,'0')).join('');
 };
 const paintPoly=(ctx,points,color,stroke)=>{
  ctx.beginPath();
  for(let i=0;i<points.length;i++){const [x,y]=points[i];if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y)}
  ctx.closePath();ctx.fillStyle=color;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}
 };
 function terrainColor(x,y){
  if(x<coast(y))return '#253e50';
  if(Math.abs(y-river(x))<68&&!bridge(x))return '#527d89';
  if(Math.abs(y-river(x))<68&&bridge(x))return '#93928d';
  const z=surfaceAt(x,y);
  if(z.border)return '#40494c';
  const group=palette[z.zone],i=Math.abs((Math.floor(x/30)*13+Math.floor(y/30)*19))%group.length;
  return group[i];
 }
 for(let cy=0;cy<NY;cy+=CHUNK)for(let cx=0;cx<NX;cx+=CHUNK){
  const cells=[];
  for(let j=cy;j<Math.min(cy+CHUNK,NY);j++)
   for(let i=cx;i<Math.min(cx+CHUNK,NX);i++){
    const x=i*SIZE,y=j*SIZE,verts=[[x,y],[x+SIZE,y],[x+SIZE,y+SIZE],[x,y+SIZE]];
    const view=verts.map(([u,v])=>toView(u,v,heightAt(u,v)));
    cells.push({world:verts,view,x,y});
   }
  const points=cells.flatMap(cell=>cell.view);
  const minX=Math.floor(Math.min(...points.map(p=>p.x)))-3,
   minY=Math.floor(Math.min(...points.map(p=>p.y)))-4,
   maxX=Math.ceil(Math.max(...points.map(p=>p.x)))+3,
   maxY=Math.ceil(Math.max(...points.map(p=>p.y)))+3;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,maxX-minX);canvas.height=Math.max(1,maxY-minY);
  const ctx=canvas.getContext('2d');
  for(const cell of cells){
   const local=cell.view.map(p=>[p.x-minX,p.y-minY]);
   const n=normalAt(cell.x+SIZE/2,cell.y+SIZE/2),color=shade(
    terrainColor(cell.x+SIZE/2,cell.y+SIZE/2),n);
   paintPoly(ctx,[local[0],local[1],local[2]],color);
   paintPoly(ctx,[local[0],local[2],local[3]],color);
  }
  chunks.push({canvas,x:minX,y:minY,depth:-10,visible:true,alpha:1,
   world:[cx*SIZE,cy*SIZE,Math.min(WIDTH,(cx+CHUNK)*SIZE),Math.min(HEIGHT,(cy+CHUNK)*SIZE)]});
 }
 // Exterior greybox: one connected fortress climbing from ocean spray up
 // the cliff. These are architectural volumes, not a second landscape
 // building; the upper gate is the playable return portal to dungeon L4.
 const prisonBlocks=[
  {area:[217,194,271,280],height:72},
  {area:[258,177,321,288],height:96},
  {area:[301,184,370,306],height:115},
  {area:[348,219,412,304],height:88}
 ];
 function makePrison(){
  const corners=prisonBlocks.flatMap(({area:[x,y,r,b],height:h})=>
   [[x,y],[r,y],[r,b],[x,b]].flatMap(([u,v])=>[
    toView(u,v,heightAt(u,v)),toView(u,v,heightAt(u,v)+h)]));
  const minX=Math.floor(Math.min(...corners.map(p=>p.x)))-24,
   minY=Math.floor(Math.min(...corners.map(p=>p.y)))-38,
   maxX=Math.ceil(Math.max(...corners.map(p=>p.x)))+24,
   maxY=Math.ceil(Math.max(...corners.map(p=>p.y)))+25;
  const canvas=document.createElement('canvas');
  canvas.width=maxX-minX;canvas.height=maxY-minY;
  const ctx=canvas.getContext('2d');ctx.translate(-minX,-minY);
  for(const [index,block] of prisonBlocks.entries()){
   const [x,y,r,b]=block.area,h=block.height,
    p=[[x,y],[r,y],[r,b],[x,b]],
    base=p.map(([u,v])=>toView(u,v,heightAt(u,v))),
    top=p.map(([u,v])=>toView(u,v,heightAt(u,v)+h)),
    pair=a=>[a.x,a.y];
   paintPoly(ctx,[pair(base[1]),pair(base[2]),pair(top[2]),pair(top[1])],
    index%2?'#535c67':'#626b74','#3c4650');
   paintPoly(ctx,[pair(base[2]),pair(base[3]),pair(top[3]),pair(top[2])],
    index%2?'#47525f':'#53606b','#37424d');
   paintPoly(ctx,top.map(pair),index%2?'#818b95':'#8c96a0','#d5d1c2');
   for(let k=1;k<4;k++){
    const z=h*k/4;
    const p1=toView(r,y,heightAt(r,y)+z),p2=toView(r,b,heightAt(r,b)+z);
    ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);
    ctx.strokeStyle='#bcc4c15a';ctx.lineWidth=2;ctx.stroke();
   }
  }
  const gate=toView(prison.x,prison.y,heightAt(prison.x,prison.y));
  ctx.fillStyle='#d9c6aa';ctx.fillRect(gate.x-13,gate.y-48,26,46);
  ctx.fillStyle='#111923';ctx.fillRect(gate.x-9,gate.y-42,18,40);
  ctx.fillStyle='#e5e4dc';ctx.font='bold 12px system-ui';ctx.textAlign='center';
  ctx.fillText('ROCKY COAST PRISON',gate.x,gate.y-58);
  return {canvas,x:minX,y:minY,depth:toView(335,285,0).y-.1,
   visible:true,alpha:1};
 }
 const prisonArt=makePrison(),artLayers=[...chunks,prisonArt];
 const layers=()=>artLayers;
 function addLayers(scene){
  return artLayers.map((chunk,i)=>{
   const key='rocky-terrain-'+i;
   scene.textures.addCanvas(key,chunk.canvas);
   return scene.add.image(chunk.x,chunk.y,key).setOrigin(0).setDepth(chunk.depth);
  });
 }
 function visibleRect(view){
  const pad=160,z=view.zoom||1;
  return {x:view.x-pad,y:view.y-pad,
   right:view.x+view.width/z+pad,bottom:view.y+view.height/z+pad};
 }
 function refreshLayers(images,actor,opened,view){
  if(!view)return;
  const rect=visibleRect(view);
  for(let i=0;i<images.length;i++){
   const c=artLayers[i],on=!(c.x>rect.right||c.y>rect.bottom||
    c.x+c.canvas.width<rect.x||c.y+c.canvas.height<rect.y);
   if(images[i].visible!==on)images[i].setVisible(on);
  }
 }
 function drawLayers(ctx,actor,opened,actors){
  const sorted=artLayers.concat(actors).sort((a,b)=>a.depth-b.depth);
  const t=ctx.getTransform(),bounds={
   left:-t.e/t.a-140,top:-t.f/t.d-140,
   right:(ctx.canvas.width-t.e)/t.a+140,bottom:(ctx.canvas.height-t.f)/t.d+140};
  for(const layer of sorted){
   if(layer.draw){layer.draw();continue;}
   if(layer.x>bounds.right||layer.y>bounds.bottom||
    layer.x+layer.canvas.width<bounds.left||
    layer.y+layer.canvas.height<bounds.top)continue;
   ctx.drawImage(layer.canvas,layer.x,layer.y);
  }
 }
 function uphillBlocked(from,x,y){
  const terrain=surfaceAt(from.x,from.y);
  if(terrain.slope<32)return false;
  // Movement against gravity on a slope too steep to stand on is suppressed,
  // while downhill and lateral steering remain possible. Sliding still uses
  // the same continuous heightfield and collision surfaces.
  const uphill=(x-from.x)*terrain.normal.dx+(y-from.y)*terrain.normal.dy;
  return uphill>.004;
 }
 function slide(actor,dt,tryMove,onDanger){
  const zone=surfaceAt(actor.x,actor.y),n=zone.normal;
  actor.alleyZ=zone.height;
  if(zone.danger){onDanger(zone.danger);return zone;}
  if(zone.zone!=='slide'&&zone.zone!=='cliff-slide'){
   actor.rockySlide=null;return zone;
  }
  const sliding=actor.rockySlide||{vx:0,vy:0,elapsed:0};
  sliding.elapsed+=dt;
  const length=Math.hypot(n.dx,n.dy)||1,cliff=zone.zone==='cliff-slide';
  const speed=clamp(n.grade*122,cliff?135:55,cliff?370:220);
  const direction={x:-n.dx/length,y:-n.dy/length};
  const follow=1-Math.exp(-dt*(cliff?10:6));
  sliding.vx+=(direction.x*speed-sliding.vx)*follow;
  sliding.vy+=(direction.y*speed-sliding.vy)*follow;
  actor.rockySlide=sliding;actor.dash=0;
  const nx=actor.x+sliding.vx*dt,ny=actor.y+sliding.vy*dt;
  if(dangerAt(nx,ny)){onDanger(dangerAt(nx,ny));return zone;}
  if(!walkable(nx,ny)){sliding.vx=sliding.vy=0;return zone;}
  tryMove(sliding.vx*dt,sliding.vy*dt);
  actor.alleyZ=heightAt(actor.x,actor.y);
  actor.moving=true;
  return zone;
 }
 function mountDebug(actor){
  const holder=document.createElement('div');
  holder.id='rocky-terrain-map';
  holder.style.cssText='position:fixed;left:12px;bottom:12px;z-index:16;background:#101821eb;color:#d7d7d4;border:1px solid #718086;border-radius:7px;padding:8px;font:12px system-ui';
  const heading=document.createElement('div');
  heading.textContent='ROCKY COAST · HEIGHTFIELD / NORMALMAP';
  heading.style.cssText='font-weight:bold;margin-bottom:5px';holder.append(heading);
  const canvas=document.createElement('canvas');
  canvas.width=260;canvas.height=234;
  canvas.style.cssText='width:260px;height:234px;display:block';holder.append(canvas);
  const note=document.createElement('div');note.style.cssText='font:10px system-ui;max-width:260px;opacity:.8;margin-top:4px';
  note.textContent='Grün: offen · Gelb: Hang · Rot: Rutschklippe · Blau: Todeszone · Grau: Grenze';
  holder.append(note);document.body.append(holder);
  const ctx=canvas.getContext('2d');
  const background=document.createElement('canvas');
  background.width=260;background.height=234;
  const ground=background.getContext('2d');
  for(let py=0;py<234;py+=3)for(let px=0;px<260;px+=3){
   const x=(px+.5)/260*WIDTH,y=(py+.5)/234*HEIGHT,v=surfaceAt(x,y);
   ground.fillStyle=v.danger?'#3c6e89':v.border?'#50555c':
    v.zone==='cliff-slide'?'#b65d52':v.zone==='slide'?'#c7a173':
    v.zone==='strain'?'#a0b27c':'#627a67';
   ground.fillRect(px,py,3,3);
  }
  let last=-Infinity;
  function draw(now=0){
   if(now-last<140)return;
   last=now;
   const a=actor();ctx.clearRect(0,0,260,234);ctx.drawImage(background,0,0);
   const x=a.x/WIDTH*260,y=a.y/HEIGHT*234;
   ctx.beginPath();ctx.arc(x,y,4.2,0,TAU);ctx.fillStyle='#f6f8dc';ctx.fill();
   ctx.strokeStyle='#152027';ctx.lineWidth=1.8;ctx.stroke();
  }
  draw(1000);return {draw,element:holder};
 }
 function zoneAt(actor){
  const surface=surfaceAt(actor.x,actor.y);
  return 'Rocky Coast · '+(surface.zone==='slide'?'Rutschhang':
   surface.zone==='cliff-slide'?'Steile Klippe':surface.zone==='strain'?'Hügel':
   surface.border?zoneNames[surface.border]||'Kartenrand':'Grasland');
 }
 const noop=()=>false;
 return {
  region:REGION,exterior:true,spawn,prison,normalMap,mountDebug,heightAt,normalAt,
  surfaceAt,dangerAt,borderAt,slide,uphillBlocked,nearestTerrainPoint,level:5,
  walkable,walkableOnFloor,groundWalkable:walkable,
  routeTo,routeToFloor:routeTo,clearLine:(x,y,u,v)=>line({x,y},{x:u,y:v}),
  clearLineOnFloor:(x,y,u,v)=>line({x,y},{x:u,y:v}),
  cameraOrigin,addLayers,refreshLayers,drawLayers,layers,
  chest:spawn,archer:spawn,knowledge:spawn,lab:spawn,
  canInteract:noop,vertical:null,
  enemies:{archive:[],lab:[]},archiveUnlocked:()=>true,unlockArchive:noop,
  zoneAt,nearKnowledge:noop,nearLab:noop,inEncounter:noop,
  lootPosition:actor=>({x:actor.x,y:actor.y}),chestRoute:()=>null,chestFacing:0,
  clearStrike:(x,y,u,v)=>Number(line({x,y},{x:u,y:v},(a,b)=>!borderAt(a,b))),
  diagnostic:{width:WIDTH,height:HEIGHT,cell:SIZE,chunkCount:chunks.length,
   slopeBands:{walk:23,strain:32,slide:53}}
 };
}
root.RockyCoastTerrain={create,heightAt,normalAt,surfaceAt,dangerAt,borderAt,
 coast,river,bridge,createNormalMap,WIDTH,HEIGHT};
})(window);
