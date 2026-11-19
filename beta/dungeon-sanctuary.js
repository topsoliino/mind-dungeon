window.DungeonSanctuary=(()=>{
 'use strict';
 function extend(layout,revision){
  const raised=revision>=18,winding=revision>=19;
  const {map,regions,terrain,rest,annexes,links,layers,paths,stairs}=layout;
  const left=map[0].length+4,width=left+(raised?56:42),height=34;
  for(const [grid,fill] of [[map,1],[regions,-1],[terrain,null]]){
   for(const row of grid)while(row.length<width)row.push(fill);
   while(grid.length<height)grid.push(Array(width).fill(fill));
  }
  const at=(x,y)=>({x:left+x,y});
  const safe=[rest.id],rooms=[],flights=[];
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
  function steps(id,x,y,w,h,direction){
   strip(id,'stairs-'+direction,x,y,w,h);
   flights.push({x:left+x,y,w,h,direction,style:'sanctuary'});
  }
  hall(120,'Ruheschrein',20,16,10,9,'court');
  hall(121,'Archiv der Reisenden',20,4,6,4,'stone');
  hall(122,'Schmiede',6,16,5,6,'forge');
  hall(123,'Brunnengarten',34,16,6,6,'garden');
  hall(124,'Untere Wandelhalle',20,28,8,4,'stone');
  hall(125,'Rundgang',8,6,5,5,'stone');
  hall(126,'Torgarten',32,27,6,5,'garden');
  hall(127,'Halle der stillen Sitze',7,26,5,5,'stone');
  strip(120,'stone',18,7,5,4);steps(120,18,raised?7:8,5,raised?4:2,'n');
  strip(120,'stone',18,22,5,4);steps(120,18,raised?22:23,5,raised?4:2,'s');
  strip(120,'stone',9,14,5,5);steps(120,raised?9:10,14,raised?5:3,5,'w');
  strip(120,'stone',27,14,5,5);steps(120,raised?27:28,14,raised?5:3,5,'e');
  steps(125,11,4,5,3,'e');
  strip(125,'stone',9,7,3,6);
  steps(125,9,11,2,3,'s');
  strip(125,'stone',11,11,4,3);
  steps(126,30,19,4,5,'s');
  strip(126,'stone',26,24,5,3);
  steps(126,24,24,3,3,'w');
  strip(127,'stone',7,19,3,5);
  steps(127,10,25,4,3,'e');
  if(raised){
   for(const id of [121,122,123,124,125,126,127,129])layers[id]=1;
   layers[128]=layers[130]=2;
   hall(128,'Apothekerkammer',44,4,7,4,'apothecary');
   safe.push(129,130);
  }
  if(winding){
   const geometry=window.DungeonStairs,flight=geometry.spiral(left+46.7,12.7);
   const sections=geometry.sections(flight);
   strip(129,'stone',38,14,2,4);
   for(let y=flight.y;y<flight.y+flight.h;y++)for(let x=flight.x;x<flight.x+flight.w;x++){
    if(map[y][x]===0)continue;
    const samples=[.04,.28,.5,.72,.96];
    if(!samples.some(dy=>samples.some(dx=>sections.some(section=>geometry.touches(section,x+dx,y+dy)))))continue;
    const near=geometry.sample(sections,x+.5,y+.5);
    fill(x-left,y,near.index<sections.length/2?129:130,'spiral');
   }
   for(let y=flight.y-1;y<=flight.y+flight.h;y++)for(let x=flight.x-1;x<Math.min(width,flight.x+flight.w+1);x++){
    if(map[y][x]===1&&!terrain[y][x])terrain[y][x]='sanctuary-spiral-void';
   }
   for(const id of [129,130])paths.push({id,x:flight.x,y:flight.y,w:flight.w,h:flight.h,theme:3,name:'Wendeltreppe'});
   stairs.push({...flight,id:'sanctuary-spiral',upper:2,lower:1,roomIds:[123,128],stepIds:[130,129],
    a:at(39,15),b:at(48,5)});
  }else if(raised){
   strip(129,'stone',39,16,5,3);
   steps(129,43,18,10,3,'e');
   strip(129,'stairs-n',50,14,3,5);
   strip(130,'stairs-n',50,9,3,5);
   steps(130,43,7,10,2,'w');
   strip(128,'apothecary',43,6,3,2);
   for(let y=9;y<=19;y++){
    fill(53,y,y<14?130:129,'spiral-wall',false);
    if(y<=17)fill(49,y,y<14?130:129,'spiral-wall',false);
   }
   for(let x=44;x<50;x++)fill(x,17,129,'spiral-wall',false);
   paths.push({id:129,x:left+39,y:14,w:14,h:7,theme:3,name:'Wendeltreppe'},
    {id:130,x:left+43,y:7,w:10,h:7,theme:3,name:'Wendeltreppe'});
   stairs.push({id:'sanctuary-spiral',...at(50,9),w:3,h:9,upper:2,lower:1,
    roomIds:[129,128],stepIds:[130,129],a:at(51,18),b:at(51,8)});
  }
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
   if(!tile||map[y][x]!==0||tile.includes('stairs')||tile==='sanctuary-spiral')continue;
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
   ...(raised?[['sanctuary-ban-table',44,4],['sanctuary-vault',44,1],['sanctuary-pillar',41,3],['sanctuary-pillar',48,3],
    ['bookcase',39,4],['bookcase',49,4],['sanctuary-brazier',41,6],['sanctuary-brazier',47,6]]:[]),
   ...(winding?[['sanctuary-brazier',39,17]]:raised?[['sanctuary-pillar',40,16],['sanctuary-pillar',44,17],['sanctuary-pillar',48,16],
    ['sanctuary-brazier',47,20],['sanctuary-brazier',52,14],['sanctuary-brazier',49,7]]:[]),
   ...[[15,11],[16,12],[23,11],[25,12],[13,19],[15,20],[25,21],[26,19],[28,12],[31,12],[33,18],[36,19],
    [34,23],[34,30],[30,28],[11,10],[9,9],[5,24],[19,25],[18,18],[22,18]].map(([x,y])=>['sanctuary-flowers',x,y]),
   ...seats.map(([x,y])=>['sanctuary-seat',x,y-1])
  ].filter(([,x,y])=>map[y]?.[left+x]===0).map(([type,x,y],variant)=>({type,...at(x,y),variant}));
  const points=Object.fromEntries(Object.entries({
   fire:[20,15],spawn:[20,18],cup:[17,18],cat:[18,16],luckyCat:[22,16],well:[35,17],wellUse:[35,18],
   wellArrival:[33,19],archive:[20,3],archiveUse:[20,4],smith:[5,15],smithUse:[5,16],
   retreat:[32,26],ward:[23,29],lobby:[rest.cx-left,rest.cy]
  }).map(([key,[x,y]])=>[key,at(x,y)]));
  return {...layout,sanctuary:{safe,rooms,water,flights,seats:seats.map(([x,y])=>at(x,y)),decor,...points}};
 }
 return {extend};
})();
