window.DungeonSanctuary=(()=>{
 'use strict';
 function extend(layout){
  const {map,regions,terrain,rest,annexes,links}=layout;
  const left=map[0].length+4,width=left+42,height=34;
  for(const [grid,fill] of [[map,1],[regions,-1],[terrain,null]]){
   for(const row of grid)while(row.length<width)row.push(fill);
   while(grid.length<height)grid.push(Array(width).fill(fill));
  }
  const at=(x,y)=>({x:left+x,y});
  const safe=[rest.id],rooms=[];
  const fill=(x,y,id,tile,walkable=true)=>{
   map[y][left+x]=walkable?0:1;regions[y][left+x]=id;terrain[y][left+x]='sanctuary-'+tile;
  };
  function hall(id,name,x,y,rx,ry,tile){
   const room={...at(x-rx,y-ry),w:rx*2+1,h:ry*2+1,cx:left+x,cy:y,id,key:'sanctuary-'+id,name,theme:3};
   safe.push(id);rooms.push(room);annexes.push(room);
   for(let row=y-ry;row<=y+ry;row++)for(let col=x-rx;col<=x+rx;col++){
    if(((col-x)/(rx+.45))**2+((row-y)/(ry+.45))**2<=1)fill(col,row,id,tile);
   }
   return room;
  }
  function strip(id,tile,x,y,w,h){
   for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)fill(col,row,id,tile);
  }
  hall(120,'Ruheschrein',20,16,10,9,'court');
  hall(121,'Archiv der Reisenden',20,4,6,4,'stone');
  hall(122,'Schmiede',6,16,5,6,'forge');
  hall(123,'Brunnengarten',34,16,6,6,'garden');
  hall(124,'Untere Wandelhalle',20,28,8,4,'stone');
  hall(125,'Rundgang',8,6,5,5,'stone');
  hall(126,'Torgarten',32,27,6,5,'garden');
  hall(127,'Halle der stillen Sitze',7,26,5,5,'stone');
  strip(120,'stone',18,7,5,4);strip(120,'stairs-n',18,8,5,2);
  strip(120,'stone',18,22,5,4);strip(120,'stairs-s',18,23,5,2);
  strip(120,'stone',9,14,5,5);strip(120,'stairs-w',10,14,3,5);
  strip(120,'stone',27,14,5,5);strip(120,'stairs-e',28,14,3,5);
  strip(125,'stairs-e',11,4,5,3);
  strip(125,'stone',9,7,3,6);
  strip(125,'stairs-s',9,11,4,3);
  strip(125,'stone',11,11,4,3);
  strip(126,'stairs-s',30,19,4,5);
  strip(126,'stone',26,24,5,3);
  strip(126,'stairs-w',24,24,3,3);
  strip(127,'stone',7,19,3,5);
  strip(127,'stairs-e',10,25,4,3);
  const water=[];
  for(const [x,y] of [[28,9],[29,9],[29,10],[30,10],[30,11],[31,11],[32,11],[32,12],[33,12],
   [33,13],[34,13],[35,13],[34,14],[35,14],[36,14],[35,15],[36,15]]){
   fill(x,y,123,'water',false);water.push(at(x,y));
  }
  for(const [x,y] of [[15,11],[16,11],[15,12],[16,12],[24,11],[25,11],[24,12],[25,12],
   [13,19],[14,19],[14,20],[15,20],[25,20],[26,20],[25,21],[26,21],[35,18],[36,18],[36,19],[37,19]]){
   if(map[y][left+x]===0)fill(x,y,regions[y][left+x],'meadow');
  }
  const owns=new Set(safe);
  for(let y=0;y<height;y++)for(let x=left;x<width;x++){
   const tile=terrain[y][x];
   if(!tile||map[y][x]!==0||tile.includes('stairs'))continue;
   if((x+2*y)%3===0&&[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>!owns.has(regions[y+dy]?.[x+dx])))terrain[y][x]='sanctuary-ward';
  }
  for(let y=rest.y;y<rest.y+rest.h;y++)for(let x=rest.x;x<rest.x+rest.w;x++){
   if(regions[y][x]===rest.id&&[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>map[y+dy]?.[x+dx]===0&&regions[y+dy][x+dx]!==rest.id))
    terrain[y][x]='sanctuary-ward';
  }
  rest.name='Schreinvorhalle';
  const dungeonDoor=at(20,30);
  links.push({id:'sanctuary-passage',kind:'stairs',a:dungeonDoor,b:{x:rest.cx,y:rest.cy},labels:['Zur Schreinvorhalle','Zum Ruheschrein']});
  const seats=[[4,4],[7,3],[12,7],[16,3],[24,4],[32,17],[37,16],[36,25],[34,28],[12,27],[5,26],[18,27]];
  const decor=[
   ['sanctuary-mosaic',20,15],['sanctuary-hearth',20,15],['bench',17,17],['bench',23,17],
   ['sanctuary-smith',5,15],['sanctuary-brazier',3,15],['weapon-rack',6,12],['large-barrel',4,18],
   ['sanctuary-archive',20,3],['bookcase',16,4],['bookcase',24,3],['candle',18,3],['candle',22,3],
   ['sanctuary-vault',20,1],['sanctuary-vault',6,11],['sanctuary-vault',8,3],['sanctuary-vault',7,23],
   ['well',35,17],['bench',35,19],['sanctuary-brazier',32,20],
   ['sanctuary-arch',20,30],['sanctuary-arch',32,26],['sanctuary-plaque',23,29],
   ['sanctuary-brazier',17,29],['sanctuary-brazier',23,27],['sanctuary-brazier',32,25],
   ['sanctuary-pillar',8,6],['sanctuary-pillar',28,26],['sanctuary-pillar',7,24],
   ['sanctuary-tree',16,11],['sanctuary-tree',24,11],['sanctuary-tree',14,20],['sanctuary-tree',26,20],
   ['sanctuary-tree',33,10],['sanctuary-tree',36,13],
   ...[[15,11],[16,12],[23,11],[25,12],[13,19],[15,20],[25,21],[26,19],[28,12],[31,12],[33,18],[36,19],
    [34,23],[34,30],[30,28],[11,10],[9,9],[5,24],[19,25],[18,18],[22,18]].map(([x,y])=>['sanctuary-flowers',x,y]),
   ...seats.map(([x,y])=>['sanctuary-seat',x,y-1])
  ].filter(([,x,y])=>map[y]?.[left+x]===0).map(([type,x,y],variant)=>({type,...at(x,y),variant}));
  const points=Object.fromEntries(Object.entries({
   fire:[20,15],spawn:[20,18],cup:[17,18],cat:[18,16],luckyCat:[22,16],well:[35,17],wellUse:[35,18],
   wellArrival:[33,19],archive:[20,3],archiveUse:[20,4],smith:[5,15],smithUse:[5,16],
   retreat:[32,26],ward:[23,29],lobby:[rest.cx-left,rest.cy]
  }).map(([key,[x,y]])=>[key,at(x,y)]));
  return {...layout,sanctuary:{safe,rooms,water,seats:seats.map(([x,y])=>at(x,y)),decor,...points}};
 }
 return {extend};
})();
