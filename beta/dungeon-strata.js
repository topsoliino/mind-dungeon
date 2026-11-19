window.DungeonStrata=(()=>{
 'use strict';
 const layouts=[
  {name:'Archiv',theme:3,group:'study'},{name:'Wachstube',theme:0,group:'guard'},
  {name:'Werkstatt',theme:1,group:'workshop'},{name:'Refektorium',theme:2,group:'dining'},
  {name:'Vorratslager',theme:4,group:'storage'}
 ];
 const edges=[[1,0],[-1,0],[0,1],[0,-1]];
 function extend(base,seed,depth,random,shuffle,revision,sewerAt,hasCrypt,lastDepth){
  const {rooms,corridors,map,regions,gates,terrain,annexes,paths,rest}=base;
  const continuous=revision>=10,varied=revision>=12,variedAlleys=revision>=13;
  const rng=random(Math.imul(seed^0x2bb5c943,1597334677));
  const minX=map[0].length+6,cols=8+Math.floor(rng()*3),rows=3+Math.floor(rng()*2);
  const roll=random(Math.imul(seed^0x2d3c461b,0x45d9f3b))();
  const stories=revision<9?2:roll<.032?4:roll<.14?3:roll<.67?2:1;
  const hasSewer=revision>=9?depth===sewerAt:null;
  const groundWidth=map[0].length,cryptWidth=13,cryptGap=13;
  const strataWidth=stories===1&&hasSewer===false?groundWidth:minX+Math.max(cols*4+2,revision>=9?39:0);
  const width=Math.max(strataWidth,hasCrypt?rest.x+rest.w+cryptGap+4+cryptWidth+2:0,continuous&&stories>1?rest.cx+(varied?62:24):0);
  for(const [grid,fill] of [[map,1],[regions,-1],[terrain,null]]){
   for(const row of grid)while(row.length<width)row.push(fill);
  }
  const links=[],doors=[],layers={},sewerRooms=[],stairs=[];
  let roof=null,sewerRelic=null,crypt=null,bossArena=null,alleys=null;
  const extraRooms=[];
  const variation=random(Math.imul(seed^0x3e2a0be7,0x45d9f3b));
  const rollInt=(min,max)=>min+Math.floor(variation()*(max-min+1));
  const roomTypes=[...layouts.filter(room=>room.group!=='storage'),{name:'Vorratskammer',theme:4,group:'storage'}];
  const roomType=(storage=.2)=>variation()<storage?roomTypes.at(-1):roomTypes[rollInt(0,roomTypes.length-2)];
  function carve(x,y,w,h,id,water=null){
   for(let iy=y;iy<y+h;iy++)for(let ix=x;ix<x+w;ix++){
    map[iy][ix]=0;regions[iy][ix]=id;terrain[iy][ix]=water;
   }
  }
  function addRoom(id,x,y,w,h,nameplate,key,layer){
   const room={...nameplate,id,key,x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)};
   carve(x,y,w,h,id);layers[id]=layer;annexes.push(room);
   return room;
  }
  const nameplates=shuffle([...layouts],rng);
  const loftWidth=10+Math.floor(rng()*3),loftDepth=8+Math.floor(rng()*3);
  const lofts=(stories>1&&!continuous?[0,1]:[]).map(i=>{
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
  if(stories>1&&!continuous){
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
  if(stories>=3&&!continuous){
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
  const openHalls=shuffle(corridors.filter(h=>!gates.some(g=>g.corridorId===h.id)&&
   (!continuous||!terrain[h.y]?.[h.x]?.startsWith('bridge-'))),rng);
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
  if(continuous){
   const headroom=40;
   for(const [grid,fill] of [[map,1],[regions,-1],[terrain,null]]){
    grid.unshift(...Array.from({length:headroom},()=>Array(width).fill(fill)));
   }
   for(const site of new Set([...rooms,...corridors,...gates,...annexes,...paths,...annexes.map(r=>r.passage),
    ...doors,...links.flatMap(link=>[link.a,link.b]),sewerRelic].filter(Boolean))){
    site.y+=headroom;
    if(Number.isFinite(site.cy))site.cy+=headroom;
   }
   const cx=rest.cx;
   function addStairs(id,position,top,bottom,upper,lower,roomIds){
    const w=4,x=position-2,split=Math.floor((top+bottom)/2);
    for(let y=top;y<=bottom;y++){
     const high=y<split,region=high?id:id+1;
     carve(x,y,w,1,region,'stairs-'+(y===top?'top':y===bottom?'base':'step'));
     layers[region]=high?upper:lower;
     for(const col of [x-1,x+w]){map[y][col]=1;terrain[y][col]='stair-wall';regions[y][col]=region;}
    }
    const run={id:'stairs-'+id,x,y:top,w,h:bottom-top+1,upper,lower,roomIds,stepIds:[id,id+1],
     a:{x:position-1,y:bottom+1},b:{x:position-1,y:top-1}};
    stairs.push(run);
    for(const offset of [0,1])paths.push({id:id+offset,x,y:offset?split:top,w,h:offset?bottom-split+1:split-top,theme:3});
   }
   function branchingRooms(from,layer,id,count){
    for(let i=0;i<count;i++){
     const gap=rollInt(1,4),w=rollInt(7,10),h=rollInt(6,8),x=from.x+from.w+gap;
     const y=layer===1?rollInt(28,30):rollInt(16,17),room=addRoom(id+i*2,x,y,w,h,roomType(),'wing-'+(id+i*2),layer);
     const entryY=Math.max(from.y,room.y)+2,passage={id:room.id+1,x:x-gap,y:entryY,w:gap,h:2,theme:room.theme,vertical:true};
     carve(passage.x,passage.y,passage.w,passage.h,passage.id);
     paths.push(passage);layers[passage.id]=layer;lofts.push(room);
     if(variation()<.45)doors.push({...passage,id:'wing-door-'+room.id,region:passage.id,w:1,hp:38});
     from=room;
    }
   }
   if(stories>1){
    const startW=varied?rollInt(10,13):11,startY=varied?rollInt(27,30):29;
    const start=addRoom(30,cx-Math.floor(startW/2),startY,startW,38-startY,nameplates[0],'upper-0',1);
    const gap=varied?rollInt(1,4):1, endY=varied?rollInt(28,31):29;
    const end=addRoom(31,start.x+start.w+gap,endY,varied?rollInt(11,15):12,varied?rollInt(7,9):9,nameplates[1],'upper-1',1);
    lofts.push(start,end);
    addStairs(50,cx,36,43,1,0,[rest.id,start.id]);
    const walkX=rest.x-2,landing=44,approachY=rooms[0].y+2;
    carve(walkX,landing,cx-walkX+2,2,60);
    carve(walkX,landing,2,approachY-landing+2,60);
    for(let y=approachY;y<approachY+2;y++)for(let x=walkX;x<rooms[0].x+1;x++){
     if(map[y][x]===1&&!terrain[y][x])carve(x,y,1,1,60);
    }
    paths.push({id:60,x:walkX,y:landing,w:2,h:approachY-landing+2,theme:3});
    carve(end.x-gap,32,gap,3,32);layers[32]=1;
    paths.push({id:32,x:end.x-gap,y:32,w:gap,h:3,theme:start.theme,...(varied?{vertical:true}:{})});
    doors.push({id:'upper-door',region:32,x:end.x-1,y:32,w:1,h:3,vertical:true,hp:44});
    links.push({id:'upper-ladder',kind:'ladder',seal:rng()<.55?'quiz-ladder':null,
     a:anchor(rooms[1]),b:{x:end.x+2,y:end.cy}});
    let onward=end;
    if(!varied||variation()<.65){
     const wallX=end.x+(varied?rollInt(6,7):7);
     for(let y=end.y;y<end.y+end.h;y++){
      map[y][wallX]=1;terrain[y][wallX]='stair-wall';
     }
     const pocket=addRoom(62,wallX+1,end.y,end.x+end.w-wallX-1,end.h,
      {name:'Nebenraum',theme:end.theme},'upper-pocket',1);
     carve(wallX,end.cy,1,2,61);layers[61]=1;
     paths.push({id:61,x:wallX,y:end.cy,w:1,h:2,theme:pocket.theme,...(varied?{vertical:true}:{})});
     doors.push({id:'upper-inner-door',region:61,x:wallX,y:end.cy,w:1,h:2,vertical:true,hp:40});
     onward={...pocket,w:end.x+end.w-pocket.x};
    }
    if(varied){
     branchingRooms(onward,1,70,rollInt(0,2));
     const x=start.x+2,y=start.y+2;
     if(x<cx-3&&y<35){
      map[y][x]=map[y+1][x]=1;terrain[y][x]=terrain[y+1][x]='partition';
     }
    }
    if(stories>=3){
     const towerW=varied?rollInt(10,14):11,towerY=varied?rollInt(15,17):17;
     const extra=addRoom(33,cx-Math.floor(towerW/2),towerY,towerW,25-towerY,nameplates[2],'upper-tower',2);
     lofts.push(extra);addStairs(52,cx,23,30,2,1,[start.id,extra.id]);
     if(varied)branchingRooms(extra,2,74,rollInt(0,2));
     if(stories===4){
      const weather=rng();
      roof=addRoom(35,cx-5,5,varied?rollInt(10,14):11,varied?rollInt(8,9):8,{name:'Turmspitze',theme:4,currentOutdoor:true,
       rain:weather<.33,hail:weather>=.33&&weather<.77},'tower-roof',3);
      carve(roof.x,roof.y,roof.w,roof.h,35,'roof-stone');
      for(let y=roof.y-1;y<=roof.y+roof.h;y++)for(let x=roof.x-1;x<=roof.x+roof.w;x++){
       if(map[y][x]===1){regions[y][x]=35;terrain[y][x]='abyss';}
      }
      addStairs(54,cx,11,18,3,2,[extra.id,roof.id]);
     }
    }
   }
   for(const side of [-1,1]){
    const target=rooms.find(r=>r.cx===cx+side*18&&r.cy===rooms[0].cy);
    if(!target||side===1&&hasCrypt||rng()<.23)continue;
    const edge=side<0?rest.x:rest.x+rest.w;
    const x=Math.min(edge,target.cx-1),end=Math.max(edge,target.cx+2),y=rest.cy-1,id=side<0?56:57;
    carve(x,y,end-x,3,id);carve(target.cx-1,y,3,target.y-y,id);
    paths.push({id,x,y,w:end-x,h:3,theme:3});
   }
   const pantry=annexes.find(room=>room.key==='pantry');
   if(rng()<.55){
    const y=pantry.y+pantry.h-2,x=pantry.cx-1;
    for(let col=pantry.x;col<pantry.x+pantry.w;col++){
     map[y][col]=1;terrain[y][col]='stair-wall';
    }
    carve(x,y,2,1,63);paths.push({id:63,x,y,w:2,h:1,theme:pantry.theme});
    doors.push({id:'pantry-door',region:63,x,y,w:2,h:1,vertical:false,hp:30});
    addRoom(64,pantry.x,y+1,pantry.w,1,{name:pantry.name,theme:pantry.theme},'pantry-nook',0);
   }
   if(hasCrypt){
    const x=rest.x+rest.w+cryptGap+Math.floor(rng()*5),y=rest.y-1,id=58;
    crypt=addRoom(id,x,y,cryptWidth,11,{name:'Krypta',theme:2},'crypt',0);
    const from=rest.x+rest.w;
    carve(from,rest.cy-1,x-from,3,59);
    paths.push({id:59,x:from,y:rest.cy-1,w:x-from,h:3,theme:2});
    doors.push({id:'crypt-door',region:59,x:x-1,y:rest.cy-1,w:1,h:3,vertical:true,hp:58});
   }
  }
  if(revision>=11&&depth===1){
   const extraWidth=30;
   for(const [grid,fill] of [[map,1],[regions,-1],[terrain,null]]){
    for(const row of grid)row.unshift(...Array(extraWidth).fill(fill));
   }
   for(const site of new Set([...rooms,...corridors,...gates,...annexes,...paths,...annexes.map(r=>r.passage),
    ...doors,...links.flatMap(link=>[link.a,link.b]),...stairs.flatMap(stair=>[stair,stair.a,stair.b]),sewerRelic].filter(Boolean))){
    site.x+=extraWidth;
    if(Number.isFinite(site.cx))site.cx+=extraWidth;
   }
   const cx=11,cy=rest.cy,radius=9,id=65,gateX=cx+radius+1;
   for(let y=cy-radius;y<=cy+radius;y++)for(let x=cx-radius;x<=cx+radius;x++){
    if((x-cx)**2+(y-cy)**2<=radius**2)carve(x,y,1,1,id,'boss-carpet');
   }
   carve(gateX-1,cy-1,1,3,id,'boss-carpet');
   const hall={id:66,x:gateX,y:cy-1,w:rest.x-gateX,h:3,theme:3,vertical:true};
   for(let y=cy-1;y<=cy+1;y++)for(let x=gateX;x<rest.x;x++){
    if(map[y][x]===1)carve(x,y,1,1,hall.id,'boss-carpet');
   }
   paths.push(hall);
   bossArena={id,cx,cy,radius,gate:{x:gateX,y:cy},altars:[{x:gateX+2,y:cy-1},{x:gateX+2,y:cy+1}]};
   annexes.push({id,key:'behaviorist-arena',name:'Versuchslabor',x:cx-radius,y:cy-radius,w:2*radius+1,h:2*radius+1,cx,cy,theme:3});
  }
  if(varied){
   const south=map.length,castle=annexes.filter(room=>['pantry','brewery'].includes(room.key)).sort((a,b)=>a.cx-b.cx);
   const [west,east]=castle;
   const wingCount=rollInt(0,3),hasAlleys=depth===1||random(Math.imul(seed^0x291cba7^Math.imul(depth,1597334677),0x45d9f3b))()<.27;
   const alleyY=south+15,swing=rollInt(-4,4),eastY=alleyY+swing,center=Math.round((west.cx+east.cx)/2);
   const right=Math.max(map[0].length,east.cx+16,east.cx+9+wingCount*14+3);
   for(const [grid,fill] of [[map,1],[regions,-1],[terrain,null]]){
    for(const row of grid)while(row.length<right)row.push(fill);
    const end=hasAlleys?Math.max(alleyY,eastY)+(variedAlleys?19:14):wingCount?south+18:south;
    while(grid.length<end)grid.push(Array(right).fill(fill));
   }
   function passage(id,x,y,w,h,vertical,theme=3,tile=null,outdoor=null){
    const path={id,x,y,w,h,vertical,theme,...outdoor};
    for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){
     if(map[row][col]===1&&!terrain[row][col])carve(col,row,1,1,id,tile);
    }
    paths.push(path);
   }
   const wingY=south+3;
   if(wingCount||hasAlleys)passage(84,east.cx-1,east.y+east.h,3,(hasAlleys?eastY+2:wingY+3)-east.y-east.h,false,1);
   if(wingCount){
    let start=east.cx+2;
    for(let i=0;i<wingCount;i++){
     const id=85+i*2,gap=rollInt(2,5),w=rollInt(7,9),h=rollInt(6,9),x=start+gap,y=wingY-rollInt(0,2);
     const room=addRoom(id,x,y,w,h,roomType(),'ground-wing-'+i,0);
     extraRooms.push(room);
     passage(id+1,start,wingY,gap,3,true,room.theme);
     if(variation()<.48)doors.push({id:'ground-door-'+i,region:id+1,x:x-1,y:wingY,w:1,h:3,vertical:true,hp:36+depth*4});
     start=x+w;
    }
   }
   if(hasAlleys){
    const light=['day','evening','night'][rollInt(0,2)],weather=variation();
    const phase={name:'Die Gassen',outdoors:true,light,rain:weather<.43,storm:weather<.17,hail:weather>.90};
    const id=93,tile='street-'+light,streetRandom=random(Math.imul(seed^0xa915f2a3,0x45d9f3b));
    passage(92,west.cx-1,west.y+west.h,3,alleyY+2-west.y-west.h,false);
    const first=Math.max(1,west.cx-11),last=east.cx+12;
    const widths=shuffle([3,4,5,6,7],streetRandom);
    const corners=widths.slice(1).map((_,i)=>Math.round(first+(last-first)*(i+1)/5+streetRandom()*4-2));
    const streetWidth=x=>widths[corners.filter(edge=>edge<=x).length];
    if(variedAlleys){
     const top=Math.min(alleyY,eastY),bottom=Math.max(alleyY,eastY)+7;
     paths.push({id,x:first,y:top,w:last-first,h:bottom-top,vertical:true,theme:5,...phase});
     for(let x=first;x<last;x++){
      const y=x<center?alleyY:eastY;
      const begin=x>=center-2&&x<center+2?top:y;
      const end=x>=center-2&&x<center+2?Math.max(alleyY+streetWidth(center-2),eastY+streetWidth(center+1)):y+streetWidth(x);
      for(let row=begin;row<end;row++){
       if(map[row][x]===1&&!terrain[row][x])carve(x,row,1,1,id,tile);
      }
     }
    }else{
     passage(id,first,alleyY,center-first+2,4,true,5,tile,phase);
     passage(id,center-1,Math.min(alleyY,eastY),4,Math.abs(swing)+4,false,5,tile,phase);
     passage(id,center-1,eastY,last-center+1,4,true,5,tile,phase);
    }
    const paved=[];
    const streetEdges=new Map();
    for(let y=Math.min(alleyY,eastY);y<Math.max(alleyY,eastY)+(variedAlleys?7:4);y++)for(let x=first;x<last;x++){
     if(map[y][x]!==0||![id,84,92].includes(regions[y][x]))continue;
     regions[y][x]=id;terrain[y][x]=tile;paved.push({x,y});
     const bounds=streetEdges.get(x);
     if(bounds)bounds.south=y+1;else streetEdges.set(x,{north:y,south:y+1});
    }
    alleys={id,...phase,paved,houses:[],lights:[]};
    const styles=['timber','limestone','brick'];
    const styleOrder=shuffle([...styles],streetRandom);
    const styleAt=x=>styleOrder[Math.floor((x-first+3)/5)%styles.length];
    function wallTile(x,y,tier,style,mark='plain'){
     if(map[y]?.[x]!==1||terrain[y][x])return false;
     terrain[y][x]='street-'+tier+'-'+style+'-'+mark+'-'+light;regions[y][x]=id;
     return true;
    }
    function facade(x,y,direction,style,mark){
     if(!wallTile(x,y,direction>0?'rear':'facade',style,mark))return false;
     if(light!=='day'&&(mark==='lamp'||direction<0&&mark==='lit')){
      alleys.lights.push({x:x+.5,y:y+.5-direction*.7,window:mark==='lit'});
     }
     return true;
    }
    const buildHouse=(index,centerX,fixedEdge,north)=>{
     const w=rollInt(5,centerX<6?5:7),h=rollInt(5,6),x=centerX-Math.floor(w/2);
     const side=north?'north':'south',edge=variedAlleys?streetEdges.get(centerX)[side]:fixedEdge;
     const houseEdges=Array.from({length:w},(_,i)=>streetEdges.get(x+i)?.[side]??edge);
     const wallEdge=variedAlleys?(north?Math.min(...houseEdges):Math.max(...houseEdges)):edge;
     const y=north?wallEdge-h-2:wallEdge+2;
     const room=addRoom(94+index*2,x,y,w,h,roomType(.30),'street-house-'+index,0);
     carve(x,y,w,h,room.id,'house-boards');
     const threshold=north?edge-2:edge;
     const doorY=variedAlleys&&north?edge-1:threshold,houseId=room.id+1;
     const doorX=variedAlleys?centerX:centerX-1,doorWidth=variedAlleys?1:2,style=styleOrder[index];
     const begin=north?y+h:edge,end=north?edge:y;
     const door={id:room.key,region:houseId,x:doorX,y:doorY,w:doorWidth,h:1,vertical:false,hp:1,streetHouse:true,style,north};
     carve(doorX,begin,doorWidth,end-begin,houseId,'house-boards');
     paths.push({id:houseId,x:doorX,y:begin,w:doorWidth,h:end-begin,theme:room.theme});
     doors.push(door);alleys.houses.push(room);
     const stepY=north?edge:edge-1;
     for(let col=doorX;col<doorX+doorWidth;col++)if(regions[stepY]?.[col]===id)terrain[stepY][col]='street-step-'+side+'-'+light;
     for(let col=x-1;col<=x+w;col++){
      const front=north?edge-1:edge,back=north?-1:1;
      const nearDoor=col===doorX-1||col===doorX+doorWidth;
      facade(col,front,back,style,nearDoor?'lamp':col%2?'lit':'window');
      wallTile(col,front+back,north?'roof':'backroof',style);
     }
    };
    buildHouse(0,west.cx-6,alleyY,true);
    buildHouse(1,east.cx+7,eastY+4,false);
    for(const [x,bounds] of streetEdges){
     for(const dir of [-1,1]){
      const y=dir===-1?bounds.north-1:bounds.south;
      const style=styleAt(x+(dir>0?3:0)),bay=(x-first)%5;
      const mark=bay===1?'lamp':bay===2?'lit':bay>=3?'window':'plain';
      if(!facade(x,y,dir,style,mark))continue;
      const tall=dir<0&&['timber','brick'].includes(style);
      if(tall)wallTile(x,y+dir,'upper',style,bay>=2?'window':'plain');
      wallTile(x,y+dir*(tall?2:1),dir<0?'roof':'backroof',style);
     }
    }
   }
  }
  if(revision>=14){
   const keyRandom=random(seed^0x42f78d21);
   const candidates=shuffle(rooms.flatMap(room=>[-1,1].flatMap(side=>
    Array.from({length:room.w-4},(_,i)=>({room,x:room.x+i+2,y:side<0?room.y:room.y+room.h-1,side})))),keyRandom);
   for(const [index,lock] of ['earlier','later'].entries()){
    if(lock==='earlier'&&depth===1||lock==='later'&&depth===lastDepth)continue;
    const site=candidates.find(({room,x,y,side})=>{
     if(regions[y][x]!==room.i||map[y][x]!==0||map[y-side][x]!==0)return false;
     for(let offset=1;offset<=6;offset++)for(let col=x-3;col<=x+3;col++){
      const row=y+side*offset;
      if(map[row]?.[col]!==1||terrain[row][col])return false;
     }
     return true;
    });
    if(!site)throw Error('Kein Platz für die verschlossene Kammer');
    const {x,y,side}=site,id=110+index*2,doorY=y+side;
    const room=addRoom(id,x-2,side<0?y-5:y+2,5,4,
     {name:lock==='earlier'?'Schatzkammer':'Versiegeltes Depot',theme:4},'key-room-'+lock,0);
    carve(room.x,room.y,room.w,room.h,id,'house-boards');
    carve(x,doorY,1,1,id+1,'house-boards');
    paths.push({id:id+1,x,y:doorY,w:1,h:1,theme:4});
    doors.push({id:room.key,lock,region:id+1,x,y:doorY,w:1,h:1,vertical:false,north:side<0,
     hp:1,style:lock==='earlier'?'limestone':'timber',cache:{x:room.cx,y:room.cy}});
   }
  }
  return {...base,links,doors,layers,lofts,sewerRooms,roof,sewerRelic,stairs,crypt,bossArena,extraRooms,alleys};
 }
 return {extend};
})();
