window.DungeonVision=(()=>{
 'use strict';
 const adjacent=[[1,0],[-1,0],[0,1],[0,-1]];
 const nearWalls=[...adjacent,[1,1],[1,-1],[-1,1],[-1,-1]];
 const memoryVersion=1;
 function create(world,tileSize,barriers,prior,explored){
  const {map,regions,W,H,stairs,rest,rooms}=world;
  const size=W*H,opaque=new Uint8Array(size),obstacles=new Uint8Array(size),live=new Uint8Array(size),known=new Uint8Array(size);
  const seenTiles=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   if(map[y][x]===1&&!world.abyssAt((x+.5)*tileSize,(y+.5)*tileSize))opaque[y*W+x]=1;
  }
  let revision=0,signature='',visibleBarriers=new Set(),viewOrigin;
  const inside=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  function remember(id){
   if(known[id])return;
   known[id]=1;seenTiles.push(id);revision++;
  }
  function rememberFloor(id){
   if(known[id])return;
   remember(id);
   if(opaque[id])return;
   const y=Math.floor(id/W),x=id%W;
   for(const [dx,dy] of nearWalls){
    const col=x+dx,row=y+dy,neighbor=row*W+col;
    if(inside(col,row)&&opaque[neighbor])remember(neighbor);
   }
  }
  function updateObstacles(observer,closed){
   obstacles.set(opaque);
   for(const [index,barrier] of barriers.entries()){
    if(closed[index])for(const id of barrier.floorCells)obstacles[id]=1;
   }
   const point={x:observer.x*tileSize,y:observer.y*tileSize};
   for(const s of stairs){
    if(!world.stairCrestClosed(s,point,explored))continue;
    for(let x=s.x;x<s.x+s.w;x++)obstacles[s.y*W+x]=1;
   }
  }
  function sightOrigin(x,y,closed){
   const id=Math.floor(y)*W+Math.floor(x);
   const blockers=barriers.filter((barrier,i)=>closed[i]&&barrier.floorCells.includes(id));
   return {x,y,blockers};
  }
  // The tile trace skips its starting cell. Within a door cell, test the
  // actual door plane so the threshold stays lit up to the near face.
  function crossesOriginBarrier(origin,x,y){
   for(const b of origin.blockers){
    const from=b.vertical?origin.x:origin.y,to=b.vertical?x:y;
    if(from===to)continue;
    const t=((b.vertical?b.x:b.y)/tileSize-from)/(to-from);
    if(t<0||t>=1)continue;
    const tangent=b.vertical?origin.y+t*(y-origin.y):origin.x+t*(x-origin.x);
    if(Math.abs(tangent*tileSize-(b.vertical?b.y:b.x))<=b.span/2)return true;
   }
   return false;
  }
  // A ray can touch the front of a blocker. It cannot continue through it
  // or slip along the exact corner of a neighboring blocking cell.
  function trace(origin,tx,ty,allow){
   if(crossesOriginBarrier(origin,tx+.5,ty+.5))return false;
   const {x:sx,y:sy}=origin;
   let x=Math.floor(sx),y=Math.floor(sy);
   const dx=tx+.5-sx,dy=ty+.5-sy,stepX=Math.sign(dx),stepY=Math.sign(dy);
   const strideX=dx?1/Math.abs(dx):Infinity,strideY=dy?1/Math.abs(dy):Infinity;
   let crossX=dx?(stepX>0?x+1-sx:sx-x)*strideX:Infinity;
   let crossY=dy?(stepY>0?y+1-sy:sy-y)*strideY:Infinity;
   while(x!==tx||y!==ty){
    if(Math.abs(crossX-crossY)<1e-9){
     if(obstacles[y*W+x+stepX]||obstacles[(y+stepY)*W+x])return false;
     x+=stepX;y+=stepY;crossX+=strideX;crossY+=strideY;
    }else if(crossX<crossY){
     x+=stepX;crossX+=strideX;
    }else{
     y+=stepY;crossY+=strideY;
    }
    if(x===tx&&y===ty)return true;
    if(obstacles[y*W+x]||allow&&!allow(regions[y][x]))return false;
   }
   return true;
  }
  function rememberSteps(s){
   for(let y=s.y;y<s.y+s.h;y++)for(let x=s.x-1;x<=s.x+s.w;x++)remember(y*W+x);
  }
  function rememberStart(){
   const start=rest??rooms[0],id=rest?.id??start.i,layer=world.layerForRegion(id);
   const allow=region=>region===id||world.isPassage(region)&&world.layerForRegion(region)===layer;
   const starts=[],passages=[];
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const region=regions[y][x],cell=y*W+x;
    if(!opaque[cell]&&world.isPassage(region)&&allow(region))passages.push({x,y,cell});
    if(region!==id||opaque[cell])continue;
    rememberFloor(cell);
    if(adjacent.some(([dx,dy])=>world.isPassage(regions[y+dy]?.[x+dx])&&map[y+dy]?.[x+dx]===0)){
     starts.push({x:x+.5,y:y+.5});
    }
   }
   const closed=barriers.map(b=>b.visible());
   for(const start of starts){
    const origin=sightOrigin(start.x,start.y,closed);
    updateObstacles(origin,closed);
    for(const p of passages)if(!known[p.cell]&&trace(origin,p.x,p.y,allow))rememberFloor(p.cell);
   }
   for(const s of stairs)if(s.roomIds.includes(id))rememberSteps(s);
  }
  if(Array.isArray(prior)){
   for(const id of prior)if(Number.isInteger(id)&&id>=0&&id<size)remember(id);
  }else{
   for(let id=0;id<size;id++){
    const region=regions[Math.floor(id/W)][id%W];
    if(explored.has(region)&&!world.isPassage(region)&&!opaque[id])rememberFloor(id);
   }
  }
  rememberStart();
  function update(observer,width,height){
   const x=observer.x/tileSize,y=observer.y/tileSize;
   if(!inside(Math.floor(x),Math.floor(y)))return;
   const closed=barriers.map(b=>b.visible()),upper=stairs.map(s=>explored.has(s.roomIds[1]));
   const origin=sightOrigin(x,y,closed);
   if(!origin.blockers.length){
    origin.x=(Math.floor(x*4)+.5)/4;
    origin.y=(Math.floor(y*4)+.5)/4;
   }
   const {x:sx,y:sy}=origin;
   const rx=Math.max(10,Math.ceil(width/tileSize/2)+3),ry=Math.max(8,Math.ceil(height/tileSize/2)+3);
   const key=[sx,sy,rx,ry,closed.map(Number).join(''),upper.map(Number).join('')].join('|');
   if(key===signature)return;
   signature=key;viewOrigin=origin;live.fill(0);
   updateObstacles(origin,closed);
   for(let y=Math.max(0,Math.floor(sy-ry));y<=Math.min(H-1,Math.ceil(sy+ry));y++){
    for(let x=Math.max(0,Math.floor(sx-rx));x<=Math.min(W-1,Math.ceil(sx+rx));x++){
     if(!trace(origin,x,y))continue;
     const id=y*W+x;live[id]=1;rememberFloor(id);
    }
   }
   visibleBarriers=new Set();
   for(const [i,barrier] of barriers.entries()){
    if(closed[i]&&barrier.floorCells.some(id=>live[id])){
     visibleBarriers.add(barrier);
     for(const id of barrier.floorCells)rememberFloor(id);
    }
   }
   for(const s of stairs){
    let seen=false;
    for(let y=s.y;!seen&&y<s.y+s.h;y++)for(let x=s.x;x<s.x+s.w;x++)if(live[y*W+x]){seen=true;break;}
    if(seen)rememberSteps(s);
   }
  }
  function sees(x,y,view){
   const col=Math.floor(x/tileSize),row=Math.floor(y/tileSize);
   return inside(col,row)&&Boolean(view[row*W+col]);
  }
  return {update,seenTiles,known,get revision(){return revision;},
   sees:(x,y)=>sees(x,y,live)&&!crossesOriginBarrier(viewOrigin,x/tileSize,y/tileSize),
   remembers:(x,y)=>sees(x,y,known),barrierVisible:barrier=>visibleBarriers.has(barrier)};
 }
 return {create,memoryVersion};
})();
