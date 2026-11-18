window.DungeonStrata=(()=>{
 'use strict';
 const layouts=[
  {name:'Archiv',theme:3,group:'study'},{name:'Wachstube',theme:0,group:'guard'},
  {name:'Werkstatt',theme:1,group:'workshop'},{name:'Refektorium',theme:2,group:'dining'},
  {name:'Vorratslager',theme:4,group:'storage'}
 ];
 const edges=[[1,0],[-1,0],[0,1],[0,-1]];
 function extend(base,seed,depth,random,shuffle){
  const {rooms,corridors,map,regions,gates,terrain,annexes,paths}=base;
  const rng=random(Math.imul(seed^0x2bb5c943,1597334677));
  const minX=map[0].length+6,cols=8+Math.floor(rng()*3),rows=3+Math.floor(rng()*2);
  const width=minX+cols*4+2;
  for(const [grid,fill] of [[map,1],[regions,-1],[terrain,null]]){
   for(const row of grid)while(row.length<width)row.push(fill);
  }
  const links=[],doors=[],layers={},sewerRooms=[];
  function carve(x,y,w,h,id,water=null){
   for(let iy=y;iy<y+h;iy++)for(let ix=x;ix<x+w;ix++){
    map[iy][ix]=0;regions[iy][ix]=id;terrain[iy][ix]=water;
   }
  }
  const nameplates=shuffle([...layouts],rng);
  const loftWidth=10+Math.floor(rng()*3),loftDepth=8+Math.floor(rng()*3);
  const lofts=[0,1].map(i=>{
   const id=30+i,x=minX+i*(loftWidth+2),y=8,w=loftWidth,h=loftDepth;
   const room={...nameplates[i],id,key:'upper-'+i,x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)};
   carve(x,y,w,h,id);
   const mirrored=rng()<.5,length=rng()<.45?5:7;
   for(let u=2;u<length;u++){
    const px=x+(mirrored?w-u-1:u),py=y+(i===0?1:h-2);
    map[py][px]=1;terrain[py][px]='partition';
   }
   layers[id]=1;annexes.push(room);
   return room;
  });
  const start=lofts[0],end=lofts[1],hallY=start.cy-1;
  carve(end.x-2,hallY,2,3,32);
  const hall={id:32,x:end.x-2,y:hallY,w:2,h:3,vertical:true,theme:start.theme};
  layers[32]=1;paths.push(hall);
  doors.push({id:'upper-door',region:32,x:hall.x,y:hall.y,w:hall.w,h:hall.h,vertical:true,hp:36});
  function anchor(room){
   const points=shuffle([[0,2],[0,-2],[-2,0],[2,0],[-2,2],[2,2],[0,0]],rng);
   const [dx,dy]=points.find(([dx,dy])=>map[room.cy+dy][room.cx+dx]===0)??[0,0];
   return {x:room.cx+dx,y:room.cy+dy};
  }
  links.push({id:'upper-stairs',kind:'stairs',a:anchor(rooms[0]),b:{x:start.x+2,y:start.cy}});
  links.push({id:'upper-ladder',kind:'ladder',a:anchor(rooms[1]),b:{x:end.x+end.w-3,y:end.cy}});
  const openHalls=shuffle(corridors.filter(h=>!gates.some(g=>g.corridorId===h.id)),rng);
  for(const h of openHalls.slice(0,depth>=3?2:1)){
   doors.push({...h,region:h.id,id:'door-'+h.id,hp:36+6*(depth-1)});
  }

  if(rng()<.72){
   const nodes=Array.from({length:cols*rows},(_,i)=>({index:i,col:i%cols,row:i/cols|0,neighbors:[]}));
   const stack=[nodes[0]],visited=new Set([0]);
   function connect(a,b){a.neighbors.push(b);b.neighbors.push(a);}
   function adjacent(n){
    return edges.map(([dx,dy])=>[n.col+dx,n.row+dy]).filter(([x,y])=>x>=0&&x<cols&&y>=0&&y<rows)
     .map(([x,y])=>nodes[y*cols+x]);
   }
   while(stack.length){
    const tip=stack.at(-1),next=shuffle(adjacent(tip),rng).find(n=>!visited.has(n.index));
    if(!next){stack.pop();continue;}
    connect(tip,next);visited.add(next.index);stack.push(next);
   }
   // Keep dead ends, with a few return loops and shortcuts.
   for(const n of nodes)if(n.neighbors.length===1&&rng()<.24){
    const shortcut=shuffle(adjacent(n),rng).find(p=>!n.neighbors.includes(p));
    if(shortcut)connect(n,shortcut);
   }
   for(let section=0;section<3;section++){
    const id=40+section,from=Math.ceil(section*cols/3),to=Math.ceil((section+1)*cols/3);
    layers[id]=-1;
    const room={id,key:'sewer-'+section,name:'Kanalisation',theme:5,x:minX+from*4,y:33,w:(to-from)*4,h:rows*4,
     cx:minX+from*4+1,cy:34};
    sewerRooms.push(room);annexes.push(room);
   }
   for(const n of nodes){
    const x=minX+n.col*4,y=33+n.row*4,region=40+Math.min(2,Math.floor(n.col*3/cols));
    const flow=rng()<.5?'sewer-flow-x':'sewer-flow-y';
    carve(x,y,2,2,region,n.index===0||n.neighbors.length<=2&&rng()<.48?'sewer-pool':rng()<.35?flow:null);
    for(const next of n.neighbors){
     const wet=n.index===0||rng()<.42;
     if(next.col>n.col)carve(x+2,y,2,2,region,wet?'sewer-flow-x':null);
     if(next.row>n.row)carve(x,y+2,2,2,region,wet?'sewer-flow-y':null);
    }
   }
   const first={x:minX,y:33},last={x:minX+(cols-1)*4+1,y:33+(rows-1)*4+1};
   for(const p of [first,last])terrain[p.y][p.x]=null;
   links.push({id:'sewer-ladder-west',kind:'ladder',a:anchor(rooms[2]),b:first});
   links.push({id:'sewer-ladder-east',kind:'ladder',a:anchor(rooms[4]),b:last});
  }
  return {...base,links,doors,layers,lofts,sewerRooms};
 }
 return {extend};
})();
