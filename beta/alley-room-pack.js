// Attach translated Room Atelier templates to the already scaled legacy grid.
(function(root){
'use strict';
const cat=root.MindRoomKit.catalog,placement=root.MindRoomPlacement;
const normals={north:[0,-1],south:[0,1],west:[-1,0],east:[1,0]};
const opposite={north:'south',south:'north',west:'east',east:'west'};
const key=(x,y)=>x+','+y;
function shuffled(items,random){
 const copy=items.slice();
 for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
 return copy;
}
function geometry(data){
 const cells=data.floorCells?.map(p=>[p.x,p.y])??Array.from({length:data.width*data.height},(_,i)=>[i%data.width,Math.floor(i/data.width)]);
 const walls=data.walls.filter(o=>cat.walls[o.style].solid).map(o=>{
  const h=['north','south'].includes(o.edge);
  return [o.x-.045,o.y-.045,o.x+(h?1:0)+.045,o.y+(h?0:1)+.045];
 });
 const props=data.furniture.filter(o=>!cat.furniture[o.type]?.designKind).map(o=>{
  const b=placement.bounds(o,cat);
  return {id:o.id,solid:o.blocksMovement??cat.furniture[o.type].blocksMovement,box:[b.left,b.top,b.right,b.bottom]};
 });
 const overlaps=(box,x,y,r)=>x+r>=box[0]&&x-r<=box[2]&&y+r>=box[1]&&y-r<=box[3];
 const blocked=(x,y,r,all=false,removed=null)=>walls.some(b=>overlaps(b,x,y,r))||props.some(o=>!removed?.has(o.id)&&(all||o.solid)&&overlaps(o.box,x,y,r));
 const occupied=new Set(cells.map(p=>key(...p)));
 function access(x,y){
  const seen=new Set(),queue=[[x,y]];
  if(blocked(x+.5,y+.5,.30))return seen;
  seen.add(key(x,y));
  for(let i=0;i<queue.length;i++){
   const [a,b]=queue[i];
   for(const [dx,dy] of Object.values(normals)){
    const u=a+dx,v=b+dy,k=key(u,v);
    if(seen.has(k)||!occupied.has(k)||blocked(u+.5,v+.5,.30)||blocked(a+.5+dx*.5,b+.5+dy*.5,.30))continue;
    seen.add(k);queue.push([u,v]);
   }
  }
  return seen;
 }
 const portals=[];
 for(const p of data.portals){
  if(p.width!==1)continue;
  const status=root.MindRoomPortals.inspect(data,p,cat,placement);if(!status.ok)continue;
  const [[a,b]]=root.MindRoomPortals.segment(data,p),x=a-Number(p.side==='east'),y=b-Number(p.side==='south');
  const reachable=access(x,y);if(reachable.size>1)portals.push({p,x,y,reachable,gated:status.conditional===true,gates:status.gates||[]});
 }
 const gateIds=data.furniture.filter(o=>cat.furniture[o.type]?.designKind==='portcullis').map(o=>o.id),attachedGateIds=new Set(portals.flatMap(p=>p.gates));
 const orphanGates=gateIds.filter(id=>!attachedGateIds.has(id));
 return {cells,blocked,portals,walls,orphanGates,gatedPorts:portals.filter(p=>p.gated)};
}
let templates;
function attach(layout,random,count){
 const {rooms,doors,occ}=layout;
 templates??=Object.entries(root.RockyRoomPack).map(([id,data])=>({id,data,...geometry(data)}));
 const hosts=rooms.filter(r=>r.kind==='raum');
 const borders=hosts.flatMap(room=>room.cells.flatMap(([x,y])=>Object.entries(normals)
  .filter(([, [dx,dy]])=>!occ.has(key(x+dx,y+dy))).map(([side])=>({room,x,y,side}))));
 function append(kind,style,cells,parent,a,b,side){
  const id=rooms.length,door={from:parent.id,to:id,side,edges:[[a,b]]};
  const room={id,kind,style,cells,parent:parent.id,exits:[door],level:0};
  parent.exits.push(door);doors.push(door);rooms.push(room);for(const p of cells)occ.set(key(...p),id);
  return room;
 }
 let index=0;
 for(const t of shuffled(templates,random)){
  if(t.orphanGates?.length)return null;
  let placed=false;
  for(const host of shuffled(borders,random)){
   const [dx,dy]=normals[host.side],a=[host.x,host.y];
   if(host.room.exits.some(d=>d.edges.some(pair=>pair.some(([x,y])=>Math.hypot(x-host.x,y-host.y)<3))))continue;
   const passage=[1,2,3].map(i=>[a[0]+i*dx,a[1]+i*dy]);
   const clear=p=>p[0]>=13&&!occ.has(key(...p))&&Object.values(normals).every(([i,j])=>!occ.has(key(p[0]+i,p[1]+j))||p[0]+i===a[0]&&p[1]+j===a[1]);
   if(!passage.every(clear))continue;
   const dest=[a[0]+4*dx,a[1]+4*dy];
   const allowedPorts=t.gatedPorts?.length?t.gatedPorts:t.portals;
   for(const port of shuffled(allowedPorts,random).filter(q=>q.p.side===opposite[host.side])){
    const x=dest[0]-port.x,y=dest[1]-port.y,cells=t.cells.map(([u,v])=>[x+u,y+v]);
    if(!cells.every(clear))continue;
    const hall=append('gang','Verbindungsgang',passage,host.room,a,passage[0],host.side);
    const room=append('raum','Kammer',cells,hall,passage[2],dest,host.side);
    room.authored={t,x,y,floor:index++%count,removed:new Set(),port};placed=true;break;
   }
   if(placed)break;
  }
  if(!placed)return null;
 }
 return layout;
}
const images=new Map();
function image(path){
 if(!images.has(path)){const img=new Image();img.src='beta/room-editor/'+path;images.set(path,img);}
 const img=images.get(path);return img.complete&&img.naturalWidth?img:null;
}
function furniture(o,pt,depth){
 const spec=cat.furniture[o.type];if(!spec||spec.designKind)return null;
 const path=spec.asset+'-'+(o.wallRef?.startsWith('h:')?180:o.wallRef?.startsWith('v:')?90:o.rot??0)+'.'+(spec.extension||'webp');
 const img=image(path),size=184*(spec.editorSpriteScale||1);
 return img&&{image:img,key:path,x:pt.x,y:pt.y,width:size,height:size,originX:.5,originY:.683,depth};
}
root.AlleyRoomPack={attach,cat,image,furniture,shuffled};
})(window);
