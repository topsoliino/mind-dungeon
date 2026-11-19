window.DungeonTemple=(()=>{
 'use strict';
 const directions=[[0,-1],[1,0],[0,1],[-1,0]];
 const names=['Mooshof','Affengang','Terrasse der Wurzeln','Regenhalle','Galerie der Masken','Hof der Lianen','Quellkammer'];
 function extend(layout,seed,random,shuffle){
  const {map,regions,terrain,rooms,annexes,paths,links,layers,stairs}=layout;
  const rng=random(seed^0x6f42a83d),roll=(n)=>Math.floor(rng()*n);
  const south=rng()<.45;
  const left=south?4+roll(26):map[0].length+5,top=south?map.length+5:3+roll(14);
  const width=Math.max(map[0].length,left+57),height=Math.max(map.length,top+58);
  for(const [grid,fill] of [[map,1],[regions,-1],[terrain,null]]){
   for(const row of grid)while(row.length<width)row.push(fill);
   while(grid.length<height)grid.push(Array(width).fill(fill));
  }
  const origin={col:0,row:roll(3)},second={col:1,row:origin.row,parent:origin};
  const nodes=[origin,second],count=3+roll(5);
  while(nodes.length<count){
   const options=nodes.flatMap(parent=>directions.map(([dx,dy])=>({col:parent.col+dx,row:parent.row+dy,parent})))
    .filter(node=>node.col>=0&&node.col<3&&node.row>=0&&node.row<3&&!nodes.some(p=>p.col===node.col&&p.row===node.row));
   nodes.push(options[roll(options.length)]);
  }
  const upper=rng()<.57?shuffle(nodes.filter(n=>n.parent&&n.parent.col===n.col&&n.row<n.parent.row&&!nodes.some(p=>p.parent===n)),rng)[0]:null;
  const roomNames=shuffle([...names],rng);
  const carve=(id,x,y,w,h,tile=null,open=true)=>{
   for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){
    map[row][col]=open?0:1;regions[row][col]=id;terrain[row][col]=tile;
   }
  };
  for(const [i,node] of nodes.entries()){
   const cx=left+8+node.col*19,cy=top+8+node.row*19,w=9+2*roll(3),h=9+2*roll(3);
   const room={id:140+i,key:'temple-'+(i===0?'entry':i===1?'court':i===2?'shrines':'wing-'+i),
    name:'Tempel · '+roomNames[i],theme:6,x:cx-(w>>1),y:cy-(h>>1),w,h,cx,cy,jungle:true};
   if(i<3)room.shrine={x:room.x+2+roll(2),y:room.y+2};
   layers[room.id]=Number(node===upper);
   node.room=room;annexes.push(room);
   carve(room.id,room.x,room.y,w,h,'jungle-mosaic');
   for(const [dx,dy] of [[0,0],[w-1,0],[0,h-1],[w-1,h-1]])carve(room.id,room.x+dx,room.y+dy,1,1,'jungle-wall',false);
  }
  let rivers=0;
  for(const [i,node] of nodes.entries()){
   if(!node.parent)continue;
   const id=158+i*2,a=node.parent.room,b=node.room;
   if(a.cy===b.cy){
    const [west,east]=a.cx<b.cx?[a,b]:[b,a],x=west.x+west.w,y=west.cy-1,w=east.x-x;
    const bridge=i===1||rivers<3&&rng()<.65;
    if(bridge){
     rivers++;
     const crest=Math.min(west.y,east.y)-1,last=Math.max(west.y+west.h,east.y+east.h)+1;
     carve(id,x,crest,w,last-crest,'clear-river',false);
     carve(id,x,crest,w,1,'waterfall',false);
    }
    carve(id,x,y,w,3,bridge?'bridge-x':'jungle-mosaic');
    paths.push({id,x,y,w,h:3,theme:6,vertical:true,templeBanks:bridge?[a.id,b.id]:null});
   }else{
    const [north,south]=a.cy<b.cy?[a,b]:[b,a],x=north.cx-2,y=north.y+north.h,end=south.y;
    if(node===upper){
     const split=Math.floor((y+end)/2);
     for(let row=y;row<end;row++)carve(row<split?id:id+1,x,row,4,1,'jungle-stairs');
     for(const col of [x-1,x+4])carve(id,col,y,1,end-y,'jungle-wall',false);
     layers[id]=1;layers[id+1]=0;
     paths.push({id,x,y,w:4,h:split-y,theme:6},{id:id+1,x,y:split,w:4,h:end-split,theme:6});
     stairs.push({id:'jungle-stairs-'+i,x,y,w:4,h:end-y,upper:1,lower:0,roomIds:[south.id,north.id],stepIds:[id,id+1],
      a:{x:x+1,y:end},b:{x:x+1,y:y-1}});
    }else{
     carve(id,x,y,4,end-y,'jungle-mosaic');
     paths.push({id,x,y,w:4,h:end-y,theme:6,vertical:false});
    }
   }
  }
  const room=origin.room;
  const door=shuffle(rooms.filter(r=>r.i!==0),rng).flatMap(r=>[
   [r.cx,r.cy],[r.cx-2,r.cy],[r.cx+2,r.cy],[r.cx,r.cy+2]
  ].map(([x,y])=>({x,y,region:r.i}))).find(({x,y,region})=>
   map[y][x]===0&&regions[y][x]===region&&!links.some(l=>[l.a,l.b].some(p=>Math.abs(p.x-x)+Math.abs(p.y-y)<3)));
  links.push({id:'jungle-trail',kind:'stairs',a:door,b:{x:room.x+2,y:room.cy},labels:['Zum Dschungeltempel','Zurück in den Dungeon']});
  return layout;
 }
 return {extend};
})();
