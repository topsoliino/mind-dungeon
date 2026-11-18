window.DungeonStrata=(()=>{
 'use strict';
 const layouts=[
  {name:'Archiv',theme:3,group:'study'},{name:'Wachstube',theme:0,group:'guard'},
  {name:'Werkstatt',theme:1,group:'workshop'},{name:'Refektorium',theme:2,group:'dining'},
  {name:'Vorratslager',theme:4,group:'storage'}
 ];
 const edges=[[1,0],[-1,0],[0,1],[0,-1]];
 function extend(base,seed,depth,random,shuffle,revision,sewerAt){
  const {rooms,corridors,map,regions,gates,terrain,annexes,paths}=base;
  const rng=random(Math.imul(seed^0x2bb5c943,1597334677));
  const minX=map[0].length+6,cols=8+Math.floor(rng()*3),rows=3+Math.floor(rng()*2);
  const roll=random(Math.imul(seed^0x2d3c461b,0x45d9f3b))();
  const stories=revision<9?2:roll<.032?4:roll<.14?3:roll<.67?2:1;
  const hasSewer=revision>=9?depth===sewerAt:null;
  const width=stories===1&&hasSewer===false?map[0].length:minX+Math.max(cols*4+2,revision>=9?39:0);
  for(const [grid,fill] of [[map,1],[regions,-1],[terrain,null]]){
   for(const row of grid)while(row.length<width)row.push(fill);
  }
  const links=[],doors=[],layers={},sewerRooms=[];
  let roof=null,sewerRelic=null;
  function carve(x,y,w,h,id,water=null){
   for(let iy=y;iy<y+h;iy++)for(let ix=x;ix<x+w;ix++){
    map[iy][ix]=0;regions[iy][ix]=id;terrain[iy][ix]=water;
   }
  }
  const nameplates=shuffle([...layouts],rng);
  const loftWidth=10+Math.floor(rng()*3),loftDepth=8+Math.floor(rng()*3);
  const lofts=(stories>1?[0,1]:[]).map(i=>{
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
  function anchor(room){
   const points=shuffle([[0,2],[0,-2],[-2,0],[2,0],[-2,2],[2,2],[0,0]],rng);
   const [dx,dy]=points.find(([dx,dy])=>map[room.cy+dy][room.cx+dx]===0)??[0,0];
   return {x:room.cx+dx,y:room.cy+dy};
  }
  if(stories>1){
   const [start,end]=lofts,hallY=start.cy-1;
   carve(end.x-2,hallY,2,3,32);
   const hall={id:32,x:end.x-2,y:hallY,w:2,h:3,vertical:true,theme:start.theme};
   layers[32]=1;paths.push(hall);
   doors.push({id:'upper-door',region:32,x:hall.x,y:hall.y,w:hall.w,h:hall.h,vertical:true,hp:36});
   links.push({id:'upper-stairs',kind:'stairs',a:anchor(rooms[0]),b:{x:start.x+2,y:start.cy}});
   const seal=revision>=9&&rng()<.55?'quiz-ladder':null;
   links.push({id:'upper-ladder',kind:'ladder',seal,a:anchor(rooms[1]),b:{x:end.x+end.w-3,y:end.cy}});
   if(revision>=9&&rng()<.55){
    const x=end.x+end.w+1,y=end.cy-2;
    const vault={id:36,key:'sealed-vault',name:'Versiegelte Schatzkammer',x,y,w:5,h:5,cx:x+2,cy:y+2,theme:4};
    carve(x,y,5,5,36);carve(x-1,end.cy-1,1,3,37);
    layers[36]=layers[37]=1;annexes.push(vault);
    paths.push({id:37,x:x-1,y:end.cy-1,w:1,h:3,vertical:true,theme:4});
    doors.push({id:'vault-door',region:37,x:x-1,y:end.cy-1,w:1,h:3,vertical:true,hp:105,seal:'quiz-vault',reward:{x:x+2,y:y+2}});
   }
  }
  if(stories>=3){
   const extra={...nameplates[2],id:33,key:'upper-tower',x:minX,y:22,w:13,h:8,cx:minX+6,cy:26};
   carve(extra.x,extra.y,extra.w,extra.h,extra.id);
   annexes.push(extra);lofts.push(extra);layers[33]=2;
   links.push({id:'tower-stairs',kind:'stairs',a:{x:lofts[1].cx,y:lofts[1].cy},b:{x:extra.x+2,y:extra.cy}});
   if(stories===4){
    const x=minX+19,y=22,w=11,h=8;
    const weather=rng();
    roof={id:35,key:'tower-roof',name:'Turmspitze',theme:4,x,y,w,h,cx:x+5,cy:y+4,
     currentOutdoor:true,rain:weather<.33,hail:weather>=.33&&weather<.77};
    carve(x,y,w,h,35,'roof-stone');
    for(let iy=y-1;iy<=y+h;iy++)for(let ix=x-1;ix<=x+w;ix++){
     if(map[iy][ix]===1){terrain[iy][ix]='abyss';regions[iy][ix]=35;}
    }
    annexes.push(roof);layers[35]=3;
    links.push({id:'roof-stairs',kind:'stairs',a:{x:extra.x+extra.w-3,y:extra.cy},b:{x:roof.x+2,y:roof.cy}});
   }
  }
  const openHalls=shuffle(corridors.filter(h=>!gates.some(g=>g.corridorId===h.id)),rng);
  for(const h of openHalls.slice(0,depth>=3?2:1)){
   doors.push({...h,region:h.id,id:'door-'+h.id,hp:36+6*(depth-1)});
  }

  if(revision>=9?hasSewer:rng()<.72){
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
   if(revision>=9){sewerRelic={x:last.x-1,y:last.y};terrain[sewerRelic.y][sewerRelic.x]=null;}
   links.push({id:'sewer-ladder-west',kind:'ladder',a:anchor(rooms[2]),b:first});
   links.push({id:'sewer-ladder-east',kind:'ladder',a:anchor(rooms[4]),b:last});
  }
  return {...base,links,doors,layers,lofts,sewerRooms,roof,sewerRelic};
 }
 return {extend};
})();
