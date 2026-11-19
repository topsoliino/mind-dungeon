(root=>{
root.DungeonWorld=(()=>{
'use strict';
const TILE=48,HERO_RADIUS=14,fallSeconds=.85,wallRecoilSeconds=.32;
const wallGrazeDepth=9*1.4,wallGrazeReach=23*1.4;
const wallRecoilForce=charged=>charged?25:18;
const legacyRooms=[[2,2,11,9],[14,2,12,9],[28,2,14,10],[14,17,12,11],[28,17,14,11]];
function fallEnemy(actor,dt){
 if(!actor.fall)return false;
 actor.fall.remaining-=dt;
 if(actor.fall.remaining<=1e-7){
  Object.assign(actor,actor.fall.safe);
  actor.fall=null;actor.hp=0;
 }
 return true;
}
function build(run,save){
const furnishingSeed=save.dungeonSeed;
const {rooms,corridors,map,regions,gates,annexes,terrain,rest,paths,layers={},links:linkTiles=[],doors:doorTiles=[],lofts=[],sewerRooms=[],roof=null,sewerRelic=null,stairs=[],crypt=null,extraRooms=[],alleys=null,sanctuary=null,bossArena:arenaTiles}=run.generate(save.dungeonSeed,save.variedRooms,save.layoutRevision,save.floor,save.templeDepth,save.templeRunSeed??save.dungeonSeed);
const H=map.length,W=map[0].length;
const annexByRegion=new Map(annexes.map(a=>[a.id,a]));
const annexPassages=new Map([...annexes.flatMap(a=>a.passage?[a.passage]:[]),...paths].map(path=>[path.id,path]));
const passages=new Set([...corridors.map(c=>c.id),...annexPassages.keys()]);
const isPassage=id=>passages.has(id);
const passageSealed=id=>gates.some(g=>g.corridorId===id&&!save.gates[g.id])||doors.some(d=>d.region===id&&doorHP(d)>0);
const court=annexes.find(a=>a.key==='court');
const cemetery=annexes.find(a=>a.key==='cemetery');
const templeRooms=annexes.filter(a=>a.key.startsWith('temple-'));
const bonePiles=cemetery?[[4,3],[9,6],[13,9]].map(([x,y],i)=>({x:(cemetery.x+x+.5)*TILE,y:(cemetery.y+y+.5)*TILE,id:save.floor+'-'+i})):[];
const templeShrineSites={'temple-entry':[3,6],'temple-court':[9,7],'temple-shrines':[7,5]};
const templeShrines=templeRooms.map((room,id)=>{
 const [x,y]=templeShrineSites[room.key];
 return {id,x:(room.x+x+.5)*TILE,y:(room.y+y+.5)*TILE};
});
const outsideRegions=new Map([...annexes.filter(room=>room.currentOutdoor||['court','cemetery'].includes(room.key)),
 ...paths.filter(path=>path.outdoors)].map(part=>[part.id,part]));
const labRoom=annexes.find(a=>a.key==='brewery');
const lab={x:(labRoom.cx+.5)*TILE,y:(labRoom.y+2.5)*TILE};
const pointIn=(room,dx,dy)=>({x:(room.cx+.5+dx)*TILE,y:(room.cy+.5+dy)*TILE});
function outsideAt(x,y){
 const region=regionAt(x,y);
 if(save.bossBattle?.rain&&region===bossArena?.id)return {rain:true};
 return outsideRegions.get(region);
}
const alleySight={day:1.25,evening:1,night:.59};
const sightScale=(x,y)=>alleySight[outsideAt(x,y)?.light]??1;
function inRain(x,y){return Boolean(outsideAt(x,y)?.rain);}
const zones=rooms.map((room,i)=>{
 const [oldX,oldY]=legacyRooms[i],shrine=[[2,3],[1,3],[2,3],[1,6],[3,6]][i];
 return {x:room.x+shrine[0],y:room.y+shrine[1],offsetX:room.x-oldX,offsetY:room.y-oldY};
});
const sanctuaryPoint=key=>tileCenter(sanctuary[key]);
const mercyWard=new Set(sanctuary?.safe??(rest?[rest.id]:[]));
const spawn=sanctuary?sanctuaryPoint('spawn'):rest?pointIn(rest,0,1.75):{x:(zones[0].x+1.5)*TILE,y:(zones[0].y+1.5)*TILE};
const cupPoint=rest&&save.floor<5?(sanctuary?sanctuaryPoint('cup'):pointIn(rest,-1.65,.2)):null;
const roomCat=(name,offset,mode)=>rest&&{...(sanctuary?sanctuaryPoint(name):pointIn(rest,offset,.4)),mode,age:0,duration:2,flip:false,target:null};
const restCat=roomCat('cat',2.65,'idle'),luckyCat=roomCat('luckyCat',-2.4,'sit');
const well=rest&&(sanctuary?sanctuaryPoint('well'):pointIn(rest,3.4,-2.1));
const wellUse=well&&(sanctuary?sanctuaryPoint('wellUse'):{x:well.x,y:well.y+44});
const glossaryStand=rest&&(sanctuary?sanctuaryPoint('archiveUse'):pointIn(rest,2.85,2.12));
const wellArrival=rest&&(sanctuary?sanctuaryPoint('wellArrival'):pointIn(rest,-2.5,2.35));
const smith=sanctuary&&sanctuaryPoint('smithUse'),ward=sanctuary&&sanctuaryPoint('ward');
const inRest=(x,y)=>mercyWard.has(regionAt(x,y));
const inSanctuary=(x,y)=>Boolean(sanctuary&&inRest(x,y)&&regionAt(x,y)!==rest.id);
function regionAt(x,y){return regions[Math.floor(y/TILE)]?.[Math.floor(x/TILE)]??-1;}
function tileCenter(p){return {x:(p.x+.5)*TILE,y:(p.y+.5)*TILE};}
const bossArena=arenaTiles&&(()=>{
 const {cx,cy,radius,id,altars,gate}=arenaTiles;
 const origin=tileCenter({x:cx,y:cy});
 const offsets=(pairs)=>pairs.map(([x,y])=>tileCenter({x:cx+x,y:cy+y}));
 const poolSize=TILE/3,stride=W*3,poolCells=new Set(),poolTiles=[];
 const pools=[[-5,-1.9,79,46,.2], [3,-4.1,67,51,-.34], [4,3,86,45,.46],
  [-2,4,72,39,-.22], [0,-1,58,45,.67]];
 for(const [i,[ox,oy,rx,ry,tilt]] of pools.entries()){
  const px=origin.x+ox*TILE,py=origin.y+oy*TILE;
  const cos=Math.cos(tilt),sin=Math.sin(tilt),extent=Math.max(rx,ry)*1.25;
  for(let y=Math.floor((py-extent)/poolSize);y<=Math.floor((py+extent)/poolSize);y++){
   for(let x=Math.floor((px-extent)/poolSize);x<=Math.floor((px+extent)/poolSize);x++){
    const dx=(x+.5)*poolSize-px,dy=(y+.5)*poolSize-py;
    const u=(dx*cos+dy*sin)/rx,v=(dy*cos-dx*sin)/ry,a=Math.atan2(v,u);
    const radius=1+Math.sin(a*3+i*2.41)*.16+Math.sin(a*5-i*1.28)*.08;
    const cell=y*stride+x;
    if(Math.hypot(u,v)>radius||poolCells.has(cell))continue;
    poolCells.add(cell);poolTiles.push({x,y,type:'boss-water'});
   }
  }
 }
 for(const p of poolTiles){
  const cell=p.y*stride+p.x;
  p.edges=[-1,-stride,1,stride].map(offset=>Number(!poolCells.has(cell+offset)));
 }
 return {...origin,id,radius:radius*TILE,gate:{...tileCenter(gate),vertical:true,span:3*TILE,face:16},
  altars:altars.map(tileCenter),vents:offsets([[-8,0],[-6,-6],[0,-8],[6,-6],[8,3],[6,6],[0,8],[-6,6]]),
  poolSize,poolTiles,inPool:(x,y)=>poolCells.has(Math.floor(y/poolSize)*stride+Math.floor(x/poolSize)),
  labProps:offsets([[-4,-7],[-2,-8],[2,-8],[4,-7],[-7,-4],[-7,4],[6,5]]),
  benches:offsets([[0,-7],[-6,6],[2,7],[6,-5]]),
  rubble:offsets([[-4,-4],[1,-6],[5,-1],[-5,3],[1,5],[-1,-2],[5,4]]).map((p,i)=>({...p,fallDelay:.46+i*.087}))};
})();
const layerForRegion=id=>layers[id]??0;
const layerAt=(x,y)=>layerForRegion(regionAt(x,y));
for(const stair of stairs){
 const landings=[stair.a,stair.b].map(p=>regions[p.y][p.x]);
 stair.regions=new Set([...stair.roomIds,...stair.stepIds,...landings]);
}
function stairsNear(actor){
 const x=actor.x/TILE,y=actor.y/TILE,id=regionAt(actor.x,actor.y);
 return stairs.filter(s=>s.regions.has(id)&&x>=s.x-1.2&&x<=s.x+s.w+1.2&&y>=s.y-1.65&&y<=s.y+s.h+1.65);
}
function stairConnected(a,b){
 const ar=regionAt(a.x,a.y),br=regionAt(b.x,b.y);
 return stairsNear(a).some(s=>s.regions.has(br))||stairsNear(b).some(s=>s.regions.has(ar));
}
function stairCrestClosed(stair,observer,explored){
 const row=observer.y/TILE;
 if(explored.has(stair.roomIds[1])||row<=stair.y+1.25)return false;
 return layerAt(observer.x,observer.y)<stair.upper||row<=stair.y+stair.h+1.65;
}
function hiddenByStairCrest(observer,target,explored){
 const region=regionAt(target.x,target.y);
 return stairsNear(observer).some(stair=>stair.roomIds[1]===region&&stairCrestClosed(stair,observer,explored));
}
const cryptAltar=crypt&&pointIn(crypt,2,0);
const links=linkTiles.flatMap(({id,kind,a,b,seal,labels})=>[[a,b],[b,a]].map(([from,to],side)=>({
 ...tileCenter(from),id:id+'-'+side,kind,seal,label:labels?.[side],layer:layerForRegion(regions[from.y][from.x]),exit:tileCenter(to)
})));
function nearestLink(actor,id){
 return links.find(s=>(id===undefined||s.id===id)&&Math.hypot(actor.x-s.x,actor.y-s.y)<=57&&
  !gateLineBlocked(actor.x,actor.y,s.x,s.y));
}
function stairsFor(actor,target){
 const layer=layerAt(actor.x,actor.y),goal=layerAt(target.x,target.y);
 const route=stairs.find(s=>s.lower===layer&&s.upper<=goal||s.upper===layer&&s.lower>=goal);
 if(route)return {...tileCenter(route.lower===layer?route.b:route.a),continuous:true};
 return links.find(s=>s.kind==='stairs'&&s.layer===layer&&
  Math.abs(layerAt(s.exit.x,s.exit.y)-goal)<Math.abs(layer-goal));
}
const lockName={earlier:'Schatzkammer',later:'Versiegeltes Depot','street-house-0':'Nördliches Gassenhaus','street-house-1':'Südliches Gassenhaus'};
const lockId=(depth,lock)=>depth+':'+lock;
const doors=doorTiles.map(d=>({...d,keyId:d.streetHouse||d.lock?lockId(save.floor,d.lock??d.id):null,x:(d.x+(save.layoutRevision>=10?d.w/2:Math.floor(d.w/2)+.5))*TILE,
 y:(d.y+(save.layoutRevision>=10?d.h/2:Math.floor(d.h/2)+.5))*TILE,span:(d.vertical?d.h:d.w)*TILE}));
const doorHP=d=>save.doors?.[d.id]??d.hp;
const returnPortal=rest&&save.floor>1?(sanctuary?sanctuaryPoint('retreat'):pointIn(rest,-2,-1.8)):null;
const keySources=[
 ...(save.floor<run.LAST_DEPTH?[{id:lockId(save.floor+1,'earlier'),type:save.floor%2?'merchant':'pantry'}]:[]),
 ...(save.floor>1?[{id:lockId(save.floor-1,'later'),type:'enemy'}]:[]),
 ...doors.filter(d=>d.streetHouse).map(d=>({id:d.keyId,type:d.north?'pantry':'merchant'}))
];
const keyName=id=>{
 if(typeof id!=='string')return 'Unbekanntes Schloss';
 const [depth,lock]=id.split(':');
 if(!lock||!/^\d+$/.test(depth))return 'Unbekanntes Schloss';
 return (Object.hasOwn(lockName,lock)?lockName[lock]:'Kammer')+' · Tiefe '+depth;
};
const keyItem=(id,source)=>({kind:'key',id,rarity:'common',source});
const keyOffers=(keyring,gold)=>keySources.filter(key=>key.type==='merchant'&&!keyring[key.id]).map(({id})=>({
 ...keyItem(id,'Fledermaushändler'),stock:'key-'+id,price:Math.min(10,gold)
}));
function nearestKeyDoor(actor,id){
 return doors.find(d=>d.keyId&&(id===undefined||d.id===id)&&doorHP(d)>0&&
  Math.hypot(actor.x-d.x,actor.y-d.y)<=72&&barrierVisible(actor,{...d,face:12}));
}
function unlockDoor(actor,id,keyring){
 const door=nearestKeyDoor(actor,id);
 if(!door)return null;
 if(keyring[door.keyId]!=='held')return {door,locked:true};
 keyring[door.keyId]='used';
 (save.doors??={})[door.id]=0;
 return {door,locked:false};
}
const keyCaches=doors.filter(d=>d.cache).map(d=>({...tileCenter(d.cache),id:d.id}));
const carrierFor=enemies=>enemies.find(e=>e.hp>0&&!e.bossRole&&regionAt(e.x,e.y)===0)?.id??null;
const accessState=site=>site?.seal?(save.access?.[site.seal]??'quiz'):'open';
function accessSite(actor,id){
 return [...links,...doors].find(site=>site.seal===id&&Math.hypot(actor.x-site.x,actor.y-site.y)<=85&&
  (site.kind?!gateLineBlocked(actor.x,actor.y,site.x,site.y):doorAhead(actor.x,actor.y,Math.atan2(site.y-actor.y,site.x-actor.x),86)===site));
}
function resolveAccess(site,correct){
 const state=(save.access??={})[site.seal]??=(correct?'open':'blocked');
 if(save.accessByDepth)(save.accessByDepth[save.floor+'-'+save.dungeonSeed]??={})[site.seal]=state;
 return state;
}
const dropTerrain=new Set(['abyss','river','clear-river','waterfall','tower-sky']);
function abyssAt(x,y){
 const row=Math.floor(y/TILE),col=Math.floor(x/TILE);
 return map[row]?.[col]===1&&dropTerrain.has(terrain[row]?.[col]);
}
function towerAir(x,y){
 const tile=terrain[Math.floor(y/TILE)]?.[Math.floor(x/TILE)];
 return Boolean(roof&&regionAt(x,y)===roof.id&&(tile==='abyss'||tile==='tower-sky'));
}
function pastLedge(x,y,bodyRadius=Infinity){
 const margin=Math.min(TILE*.28,bodyRadius*.46);
 return abyssAt(x,y)&&[-margin,margin].every(dx=>[-margin,margin].every(dy=>abyssAt(x+dx,y+dy)));
}
const hailAt=(x,y)=>Boolean(outsideAt(x,y)?.hail);
function doorAt(x,y,radius=0){
 return doors.find(d=>doorHP(d)>0&&(d.vertical?Math.abs(x-d.x)<9+radius&&Math.abs(y-d.y)<d.span/2:
  Math.abs(y-d.y)<9+radius&&Math.abs(x-d.x)<d.span/2));
}
function heroClearsDoor(actor,x,y){
 return !doors.some(d=>{
  if(doorHP(d)<=0)return false;
  const distance=Math.abs(d.vertical?x-d.x:y-d.y),prior=Math.abs(d.vertical?actor.x-d.x:actor.y-d.y);
  const tangent=Math.abs(d.vertical?y-d.y:x-d.x),clearance=d.vertical?28:d.north?29:31;
  return tangent<d.span/2+8&&distance<clearance&&distance<=prior;
 });
}
function strikeDoor(damage,door){
 if(door.keyId)return doorHP(door);
 if(accessState(door)!=='open')return doorHP(door);
 const hp=Math.max(0,doorHP(door)-Math.max(1,Math.round(damage)));
 (save.doors??={})[door.id]=hp;
 return hp;
}
function doorAhead(x,y,angle,reach){
 const dx=Math.cos(angle),dy=Math.sin(angle);
 for(let step=0;step<=reach;step+=5){
  const px=x+step*dx,py=y+step*dy;
  if(wall(px,py)||gateBlocked(px,py))return null;
  const door=doorAt(px,py);
  if(door)return door.keyId?null:door;
 }
 return null;
}
const waterAt=(x,y)=>{
 const row=Math.floor(y/TILE),col=Math.floor(x/TILE);
 if(bossArena&&save.bossBattle?.rain&&regions[row]?.[col]===bossArena.id&&bossArena.inPool(x,y))return 'boss-water';
 const tile=terrain[row]?.[col];
 return tile?.startsWith('sewer-')?tile:null;
};
function waterLightning(split,x,y){
 const wet=split.lightning&&waterAt(x,y),cold=split.frost&&hailAt(x,y);
 return wet||cold?{...split,...(wet?{lightning:split.lightning*1.35}:{}),...(cold?{frost:split.frost*1.35}:{})}:split;
}
function waterPulse(origin,target,split,amount){
 if(!split.lightning)return null;
 const point=waterAt(origin.x,origin.y)?origin:target&&waterAt(target.x,target.y)?target:null;
 return point?{x:point.x,y:point.y,radius:108,power:Math.max(4,amount*split.lightning*.24),life:.36}:null;
}
function pulseReaches(pulse,actor){
 return Math.hypot(actor.x-pulse.x,actor.y-pulse.y)<pulse.radius&&
  !gateLineBlocked(pulse.x,pulse.y,actor.x,actor.y);
}
function gateLineBlocked(x1,y1,x2,y2,aerial=false){const n=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/12));for(let i=0;i<=n;i++){const t=i/n,x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;if(gateBlocked(x,y)||wall(x,y)&&!(aerial&&towerAir(x,y))||doorAt(x,y))return true}return false}
function barrierVisible(actor,barrier){
 const {x,y,vertical,span,face}=barrier;
 if(layerAt(actor.x,actor.y)!==layerAt(x,y))return false;
 const normal=vertical?actor.x-x:actor.y-y;
 const tangent=vertical?actor.y-y:actor.x-x;
 const edge=span/2-8,nearest=Math.max(-edge,Math.min(edge,tangent));
 if(Math.hypot(normal,tangent-nearest)>232)return false;
 const front=Math.sign(normal||1)*Math.min(Math.abs(normal),face);
 return [nearest,0,-edge/2,edge/2].some(offset=>!gateLineBlocked(actor.x,actor.y,
  x+(vertical?front:offset),y+(vertical?offset:front)));
}
function barrierFloor(barrier){
 const {x,y,vertical,span,face}=barrier,cells=[];
 const rx=vertical?face:span/2,ry=vertical?span/2:face;
 for(let row=Math.floor((y-ry)/TILE);row<Math.ceil((y+ry)/TILE);row++){
  for(let col=Math.floor((x-rx)/TILE);col<Math.ceil((x+rx)/TILE);col++){
   if(map[row]?.[col]===0)cells.push(row*W+col);
  }
 }
 return cells;
}
function sightBarriers(){
 return [
  ...doors.map(door=>({...door,key:door.id,face:12,visible:()=>doorHP(door)>0})),
  ...gates.map((gate,i)=>({...tileCenter(gate),key:'gate-'+i,vertical:gate.vertical,span:4.2*TILE,face:.54*TILE,visible:()=>!save.gates[gate.id]})),
  ...(bossArena?[{...bossArena.gate,key:'boss-portcullis',visible:()=>root.DungeonBoss.gateClosed(save.bossBattle)}]:[])
 ].map(barrier=>({...barrier,floorCells:barrierFloor(barrier)}));
}
function gateBlocked(x,y){
 const gate=bossArena?.gate;
 if(gate&&root.DungeonBoss.gateClosed(save.bossBattle)&&Math.abs(x-gate.x)<gate.face&&Math.abs(y-gate.y)<gate.span/2)return true;
 return gates.some(g=>!save.gates[g.id]&&(g.vertical?Math.abs(x/TILE-(g.x+.5))<.52&&Math.abs(y/TILE-(g.y+.5))<2.1:Math.abs(y/TILE-(g.y+.5))<.52&&Math.abs(x/TILE-(g.x+.5))<2.1));
}
function wall(x,y){const i=Math.floor(x/TILE),j=Math.floor(y/TILE);return i<0||j<0||i>=W||j>=H||map[j][i]===1}

// Dimensions measure the footprint at the base rather than the full sprite.
const FURNITURE={
 table:{w:65,h:31,solid:true}, chair:{w:24,h:20,solid:true},
 cabinet:{w:43,h:27,solid:true}, bookcase:{w:43,h:26,solid:true},
 carpet:{w:92,h:54}, candle:{w:16,h:10,light:85}, torch:{w:18,h:17,light:134},
 barrel:{w:29,h:25,solid:true}, sarcophagus:{w:64,h:30,solid:true},
 roots:{w:33,h:24,solid:true}, crystal:{w:36,h:26,solid:true,light:115},
 lectern:{w:34,h:22,solid:true}, web:{w:34,h:33},lab:{w:68,h:36,solid:true,light:140},
 tree:{w:31,h:29,solid:true},pine:{w:27,h:22,solid:true},birch:{w:23,h:20,solid:true},grass:{w:27,h:20},provisions:{w:61,h:30,solid:true},
 alchemy:{w:61,h:30,solid:true},banquet:{w:67,h:31,solid:true},market:{w:151,h:59,solid:true},
 'round-table':{w:53,h:38,solid:true},'banquet-long':{w:122,h:38,solid:true},fence:{w:62,h:12,solid:true},'fence-end':{w:62,h:12,solid:true},
 'weapon-rack':{w:57,h:23,solid:true},'armor-rack':{w:41,h:26,solid:true},
 shelf:{w:51,h:24,solid:true},'straw-bed':{w:55,h:33,solid:true},
 display:{w:58,h:30,solid:true},dresser:{w:58,h:27,solid:true},statue:{w:45,h:27,solid:true},
 grave:{w:45,h:29,solid:true},'jungle-shrine':{w:45,h:28,solid:true,light:92},rubble:{w:47,h:23,solid:true},basket:{w:32,h:20,solid:true},bush:{w:36,h:23},vines:{w:22,h:12},bench:{w:55,h:22,solid:true},campfire:{w:47,h:34,solid:true,light:210},well:{w:72,h:43,solid:true,light:156},
 'large-barrel':{w:39,h:31,solid:true},'street-drain':{w:32,h:24},'street-stalls':{w:45,h:25,solid:true},
 'street-lantern':{w:20,h:14,light:106},'street-straw':{w:38,h:19},
 'sanctuary-mosaic':{w:49,h:41},'sanctuary-hearth':{w:63,h:47,solid:true,light:190},'sanctuary-smith':{w:65,h:36,solid:true},
 'sanctuary-archive':{w:48,h:29,solid:true,light:91},'sanctuary-tree':{w:28,h:24,solid:true},
 'sanctuary-pillar':{w:26,h:26,solid:true},'sanctuary-seat':{w:33,h:18,solid:true},
 'sanctuary-brazier':{w:24,h:21,solid:true,light:127},'sanctuary-arch':{w:64,h:42},
 'sanctuary-flowers':{w:27,h:23},'sanctuary-plaque':{w:27,h:22},'sanctuary-vault':{w:91,h:31},
 'lab-bench':{w:59,h:23,solid:true},'lab-apparatus':{w:59,h:25,solid:true},'roof-rubble':{w:45,h:29,solid:true}
};
const furniture=[];
const breakableHP={chair:14,barrel:24,'large-barrel':36,basket:12,bench:26,dresser:46,shelf:40,
 'straw-bed':34,fence:30,'fence-end':30,'weapon-rack':36,'armor-rack':42,
 'lab-bench':28,'lab-apparatus':32,'roof-rubble':44};
let solidTiles=null;
const stoneProps=new Set(['sarcophagus','crystal','statue','grave','jungle-shrine','rubble','well','roof-rubble']);
const woodProps=new Set(['table','chair','bookcase','cabinet','barrel','lectern','tree','pine','birch','roots',
 'provisions','alchemy','banquet','market','round-table','banquet-long','fence','fence-end','weapon-rack',
 'armor-rack','shelf','display','dresser','bench','basket','straw-bed','large-barrel','lab-bench','lab-apparatus']);
const reducedDepth=new Set(['cabinet','bookcase','shelf','dresser','display','weapon-rack','armor-rack','statue']);
const furnitureHP=p=>p.breakId?(save.furnitureDamage?.[p.breakId]??breakableHP[p.type]):null;
const furnitureIntact=p=>furnitureHP(p)!==0&&(p.fallDelay===undefined||
 (save.bossBattle?.roofCollapseAt!=null&&save.bossBattle.time-save.bossBattle.roofCollapseAt>=p.fallDelay));
function strikeFurniture(p,damage){
 const before=furnitureHP(p);
 if(!before||!furnitureIntact(p)||!Number.isFinite(damage)||damage<=0)return null;
 const hp=Math.max(0,before-Math.max(1,Math.round(damage)));
 (save.furnitureDamage??={})[p.breakId]=hp;
 return hp;
}
function furnitureAt(x,y,rx=12,ry=rx,original=false){
 const candidates=solidTiles&&rx<=40&&ry<=40?solidTiles.get(Math.floor(y/TILE)*W+Math.floor(x/TILE))??[]:furniture;
 return candidates.find(p=>{
  if(!p.solid||(original?p.fallDelay!==undefined:!furnitureIntact(p)))return false;
  const inset=reducedDepth.has(p.type)?Math.min(7,p.h*.24):0;
  return Math.abs(x-p.x)<p.w/2+rx&&Math.abs(y-p.y-inset)<p.h/2-inset+ry;
 });
}
function furnitureBlocked(x,y,rx=12,ry=rx,original=false){return Boolean(furnitureAt(x,y,rx,ry,original));}
function furnitureBetween(x,y,tx,ty,radius=2){
 const steps=Math.max(1,Math.ceil(Math.hypot(tx-x,ty-y)/5));
 for(let i=1;i<=steps;i++){
  const t=i/steps,prop=furnitureAt(x+(tx-x)*t,y+(ty-y)*t,radius);
  if(prop)return prop;
 }
 return null;
}
const furnitureCue=p=>stoneProps.has(p.type)?'hit_stone':woodProps.has(p.type)?'hit_wood':null;
function weaponImpact(x,y,angle,reach){
 const dx=Math.cos(angle),dy=Math.sin(angle);
 for(let step=6;step<=reach;step+=5){
  const px=x+step*dx,py=y+step*dy;
  if(doorAt(px,py))return null;
  if(stoneAt(px,py)||gateBlocked(px,py))return {x:px,y:py,cue:'hit_stone'};
  const prop=furnitureAt(px,py,2);
  if(prop)return {x:px,y:py,prop,cue:furnitureCue(prop)};
 }
 return null;
}
function meleeFurniture(x,y,angle,reach,weapon,contact,impact){
 const hits=new Set();
 if(impact?.prop&&beforeMeleeWall(x,y,impact.x,impact.y,weapon,contact))hits.add(impact.prop);
 for(const prop of furniture){
  if(!furnitureHP(prop)||!root.DungeonItems.meleeHit(weapon,prop.x-x,prop.y-y,angle,reach)||
   !beforeMeleeWall(x,y,prop.x,prop.y,weapon,contact)||gateLineBlocked(x,y,prop.x,prop.y))continue;
  const first=furnitureBetween(x,y,prop.x,prop.y);
  if(first===prop)hits.add(prop);
 }
 return hits;
}
function partitionBounds(tx,ty){
 const row=terrain[ty],west=row[tx-1]==='partition',east=row[tx+1]==='partition';
 const north=terrain[ty-1]?.[tx]==='partition',south=terrain[ty+1]?.[tx]==='partition';
 const x=tx*TILE,y=ty*TILE,cx=x+TILE/2,cy=y+TILE/2,boxes=[];
 if(west||east||!north&&!south)boxes.push([x+(west?0:2),cy-9,x+TILE-(east?0:2),cy+5]);
 if(north||south)boxes.push([cx-9,north?y:cy-9,cx+9,south?y+TILE:cy+5]);
 return boxes;
}
function footWall(x,y){
 const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
 if(terrain[ty]?.[tx]!=='partition')return wall(x,y);
 return partitionBounds(tx,ty).some(([left,top,right,bottom])=>x>=left&&x<=right&&y>=top&&y<=bottom);
}
function stoneAt(x,y){return footWall(x,y)&&!abyssAt(x,y);}
function weaponClearance(x,y,tx,ty){
 const n=Math.max(1,Math.ceil(Math.hypot(tx-x,ty-y)/3));
 for(let i=1;i<=n;i++){
  const t=i/n,px=x+(tx-x)*t,py=y+(ty-y)*t;
  if(stoneAt(px,py)||gateBlocked(px,py)||doorAt(px,py))return (i-1)/n;
 }
 return 1;
}
function weaponCover(x,y,radius){
 const faces=[];
 const fullWall=(col,row)=>map[row]?.[col]===1&&terrain[row]?.[col]!=='partition'&&!dropTerrain.has(terrain[row]?.[col]);
 const add=(vertical,at,from,to)=>{
  const axis=vertical?x:y,side=vertical?y:x;
  if(Math.abs(at-axis)<=radius&&from<=side+radius&&to>=side-radius)faces.push({vertical,at,from,to});
 };
 const box=(left,top,right,bottom,coverNorth=false)=>{
  if(x<left)add(true,left,top,bottom);
  if(x>right)add(true,right,top,bottom);
  if(y<top)add(false,top,left,right);
  if(coverNorth&&y>bottom)add(false,bottom,left,right);
 };
 for(let row=Math.floor((y-radius)/TILE);row<=Math.floor((y+radius)/TILE);row++){
  for(let col=Math.floor((x-radius)/TILE);col<=Math.floor((x+radius)/TILE);col++){
   if(terrain[row]?.[col]==='partition'){
    for(const bounds of partitionBounds(col,row))box(...bounds);
   }else if(fullWall(col,row)){
    const left=col*TILE,top=row*TILE,right=left+TILE,bottom=top+TILE;
    if(x<left&&!fullWall(col-1,row))add(true,left,top,bottom);
    if(x>right&&!fullWall(col+1,row))add(true,right,top,bottom);
    // See the weapon over the north wall when moving up.
    if(y<top&&!fullWall(col,row-1))add(false,top,left,right);
   }
  }
 }
 const barrier=(cx,cy,vertical,face,span)=>{
  const rx=vertical?face:span/2,ry=vertical?span/2:face;
  box(cx-rx,cy-ry,cx+rx,cy+ry,true);
 };
 for(const door of doors)if(doorHP(door)>0)barrier(door.x,door.y,door.vertical,9,door.span);
 for(const gate of gates)if(!save.gates[gate.id]){
  barrier((gate.x+.5)*TILE,(gate.y+.5)*TILE,gate.vertical,.52*TILE,4.2*TILE);
 }
 if(bossArena&&root.DungeonBoss.gateClosed(save.bossBattle)){
  const gate=bossArena.gate;
  barrier(gate.x,gate.y,gate.vertical,gate.face,gate.span);
 }
 if(!faces.length)return null;
 // Cast just to either side of every face endpoint to preserve the corners.
 const angles=[-.75*Math.PI,-.25*Math.PI,.25*Math.PI,.75*Math.PI];
 const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
 for(const {vertical,at,from,to} of faces)for(const end of [from,to]){
  const a=vertical?Math.atan2(end-y,at-x):Math.atan2(at-y,end-x);
  angles.push(wrap(a-.0001),wrap(a+.0001));
 }
 return angles.sort((a,b)=>a-b).map(angle=>{
  const dx=Math.cos(angle),dy=Math.sin(angle);
  let distance=radius/Math.max(Math.abs(dx),Math.abs(dy));
  for(const {vertical,at,from,to} of faces){
   const travel=vertical?(at-x)/dx:(at-y)/dy;
   if(travel<=0||travel>=distance)continue;
   const side=vertical?y+travel*dy:x+travel*dx;
   if(side>=from&&side<=to)distance=travel;
  }
  return {x:x+distance*dx,y:y+distance*dy};
 });
}
function meleeWall(x,y,dir,weapon,reach){
 if(weapon.projectile||weapon.reach<100)return null;
 const sweep=weapon.thrust?0:Math.acos(weapon.sweep);
 const activeArc=Math.min(.96,sweep*.76),count=Math.ceil(activeArc*48);
 for(let i=0;i<=count;i++){
  const offset=count?(2*i/count-1)*activeArc:0,angle=dir+offset;
  const dx=Math.cos(angle),dy=Math.sin(angle);
  const extent=reach*(weapon.thrust?1:.67+.33*Math.cos(offset/sweep*Math.PI/2));
  let first=0;
  for(let step=4;step<=extent;step+=3){
   const px=x+dx*step,py=y+dy*step;
   if(doorAt(px,py)||gateBlocked(px,py)||furnitureAt(px,py,2))break;
   if(!stoneAt(px,py)){first=0;continue;}
   if(!first)first=step;
   if(extent-first<wallGrazeReach)continue;
   const depth=first+wallGrazeDepth;
   if(step<depth&&(step+3<depth||!stoneAt(x+dx*depth,y+dy*depth)))continue;
   const hitX=x+dx*first,hitY=y+dy*first;
   const crossedX=!stoneAt(hitX-3*dx,hitY),crossedY=!stoneAt(hitX,hitY-3*dy);
   const horizontal=crossedX===crossedY?Math.abs(dx)>Math.abs(dy):crossedX;
   return {x:hitX,y:hitY,angle,aim:dir,offset,distance:first,
    normalX:horizontal?-Math.sign(dx):0,normalY:horizontal?0:-Math.sign(dy)};
  }
 }
 return null;
}
function beforeMeleeWall(x,y,tx,ty,weapon,contact){
 if(!contact)return true;
 const dx=tx-x,dy=ty-y;
 if(weapon.thrust)return dx*Math.cos(contact.aim)+dy*Math.sin(contact.aim)<contact.distance;
 const offset=Math.atan2(dy,dx)-contact.aim;
 const turn=Math.atan2(Math.sin(offset),Math.cos(offset));
 return turn<contact.offset-.05||turn<=contact.offset+.05&&Math.hypot(dx,dy)<contact.distance;
}
function valid(x,y,r=12,ignoreSeals=false,feet=false,allowFall=false,originalFurniture=false){
 const rx=feet?10:r,ry=feet?5:r,solid=feet?footWall:wall;
 for(const dx of [-rx,0,rx])for(const dy of [-ry,0,ry]){
  if(solid(x+dx,y+dy)&&!(allowFall&&abyssAt(x+dx,y+dy))||!ignoreSeals&&(gateBlocked(x+dx,y+dy)||doorAt(x+dx,y+dy)))return false;
 }
 return !furnitureBlocked(x,y,feet?9:r,feet?6:r,originalFurniture);
}
const merchantRandom=run.random(furnishingSeed^0x7157be6a);
const preferredMerchantRoom=1+Math.floor(merchantRandom()*4);
function accessiblePoint(x,y,radius=14){
 if(valid(x,y,radius,true))return {x,y};
 const tileX=Math.floor(x/TILE),tileY=Math.floor(y/TILE);
 for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[-2,0],[2,0]]){
  const px=(tileX+dx+.5)*TILE,py=(tileY+dy+.5)*TILE;
  if(valid(px,py,radius,true))return {x:px,y:py};
 }
 return {x,y};
}
function boneDropPosition(origin){
 for(const [dx,dy] of [[0,27],[0,-27],[27,0],[-27,0]]){
  const x=origin.x+dx,y=origin.y+dy;
  if(valid(x,y,5)&&!gateLineBlocked(origin.x,origin.y,x,y))return {x,y};
 }
 return origin;
}
const shrines=save.layoutRevision>=15?[]:zones.map((z,i)=>({...accessiblePoint((z.x+.5)*TILE,(z.y+.5)*TILE),i,topic:i,theme:i}));
const chestReservations=[...links,...shrines,...stairs.flatMap(s=>[tileCenter(s.a),tileCenter(s.b)])];
const chests=[[10.5,7.5],[23.5,4.5],[38.5,9.5],[22.5,25.5],[37.5,25.5]].map(([x,y],i)=>{
 const room=rooms[i],preferred=accessiblePoint((x+zones[i].offsetX)*TILE,(y+zones[i].offsetY)*TILE);
 const clear=p=>regionAt(p.x,p.y)===room.i&&valid(p.x,p.y,18,true)&&
  chestReservations.every(o=>Math.hypot(o.x-p.x,o.y-p.y)>=62);
 if(clear(preferred))return preferred;
 const cells=[];
 for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++){
  const p=tileCenter({x,y});
  if(clear(p))cells.push(p);
 }
 return cells.sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y))[0]??preferred;
});
const trialStart=1+Math.floor(run.random(save.dungeonSeed^0x71927a33)()*3);
const trialIndex=save.trialIndex??=[trialStart,1+trialStart%3,1+(trialStart+1)%3].find(i=>!save.opened.includes(i))??trialStart;
const roomRandom=run.random(furnishingSeed^0x7d3a912e);
// Room edges hold storage and lighting. Sets are placed as groups so seats
// follow their table and decorations never replace a clear path or landmark.
const roomPlans=[
 {fixed:[['cabinet',3.55,3.15],['barrel',4.55,3.2],['torch',2.45,5.05],['torch',11.55,5.05],['roots',2.65,9.75]],
  sets:[{at:[[7.5,7.8],[7.9,8.2]], pieces:[['carpet',0,.18],['table',0,0],['chair',0,1.02],['chair',-1.14,-.15]]}]},
 {fixed:[['torch',14.55,4.2],['torch',24.55,8.65],['barrel',22.7,3.05],['cabinet',24.15,3.05],['cabinet',17.5,9.8],['barrel',18.7,9.8]],
  sets:[{at:[[20.25,5],[20.65,5.35]], pieces:[['carpet',0,0],['table',0,0],['chair',0,.94],['chair',-1.14,-.06]]}]},
 {fixed:[['torch',28.45,4.55],['torch',40.55,8.8],['web',29.45,3.2],['web',40.7,3.15],['sarcophagus',34.4,3.35],['sarcophagus',37.0,3.35],['sarcophagus',40.1,5.65]],
  sets:[{at:[[32.4,8.95],[32,9.8]], pieces:[['sarcophagus',0,0],['candle',-.95,.15],['candle',.95,.15]]}]},
 {fixed:[['bookcase',15.05,18.25],['bookcase',16.45,18.25],['bookcase',17.85,18.25],['torch',14.45,20.1],['torch',24.85,25.4],['lectern',24.5,19.55],['cabinet',15.1,26.75]],
  sets:[{at:[[19.45,26.45],[18.8,26.65]], pieces:[['carpet',0,0],['table',0,0],['chair',-1.14,0],['chair',1.14,0]]}]},
 {fixed:[['crystal',28.9,18.6],['crystal',32.3,18.4],['crystal',39.9,19.6],['crystal',40,24.2],['sarcophagus',31.85,26.25],['torch',29.2,24.9]],
  sets:[{at:[[37.9,20.15],[38.3,19.7]], pieces:[['sarcophagus',0,0],['crystal',1.25,-.5],['candle',-1.1,.1]]}]}
];
const entrances=[...corridors,...(save.variedRooms?new Set([...annexPassages.values(),...paths]):[])].flatMap(c=>!c.vertical
 ? [{x:(c.x+c.w/2)*TILE,y:c.y*TILE},{x:(c.x+c.w/2)*TILE,y:(c.y+c.h)*TILE}]
 : [{x:c.x*TILE,y:(c.y+c.h/2)*TILE},{x:(c.x+c.w)*TILE,y:(c.y+c.h/2)*TILE}]);
const shopObstacles=[...entrances,...shrines,...chests,...links];
function wallMarket(room){
 const halfWidth=FURNITURE.market.w/2,halfDepth=FURNITURE.market.h/2;
 const left=room.x*TILE,right=(room.x+room.w)*TILE,top=room.y*TILE,sites=[];
 function addSite(x,y,wallPenalty){
  if(![-halfWidth,0,halfWidth].every(dx=>[-halfDepth,0,halfDepth].every(dy=>!wall(x+dx,y+dy))))return;
  const approach={x,y:y+halfDepth+24};
  if(links.some(link=>Math.abs(link.x-x)<halfWidth+24&&Math.abs(link.y-y)<halfDepth+24||
   Math.hypot(link.x-approach.x,link.y-approach.y)<48))return;
  if(!valid(approach.x,approach.y,14,true))return;
  const clearance=Math.min(...shopObstacles.map(o=>Math.min(
   Math.hypot(x-o.x,y-o.y),Math.hypot(approach.x-o.x,approach.y-o.y))));
  sites.push({roomId:room.i,x,y,clearance,approach,score:clearance-wallPenalty});
 }
 for(let row=0;row<room.h-3;row++)for(let col=2;col<room.w-2;col++){
  const x=left+(col+.5)*TILE,wallBottom=top+row*TILE;
  if([-halfWidth,-halfWidth/2,0,halfWidth/2,halfWidth].every(dx=>wall(x+dx,wallBottom-6))){
   addSite(x,wallBottom+halfDepth+26,row?24:0);
  }
 }
 for(let row=1;row<room.h-2;row++){
  const y=top+(row+.5)*TILE;
  for(const side of [-1,1]){
   const edge=side===-1?left:right;
   if([-halfDepth,0,halfDepth].every(dy=>wall(edge+side*6,y+dy))){
    addSite(edge-side*(halfWidth+9),y,48);
   }
  }
 }
 return sites.sort((a,b)=>b.score-a.score)[0];
}
const roomsForShop=[rooms[preferredMerchantRoom],...rooms.slice(1).filter(room=>room.i!==preferredMerchantRoom),rooms[0]];
const shopSites=roomsForShop.map(wallMarket).filter(Boolean);
const fallbackMarket=pointIn(rooms[preferredMerchantRoom],0,-1.15);
const shop=shopSites.find(site=>site.clearance>=95)||shopSites.sort((a,b)=>b.score-a.score)[0]||
 {roomId:preferredMerchantRoom,...fallbackMarket,approach:accessiblePoint(fallbackMarket.x,fallbackMarket.y+54)};
const merchantRoomId=shop.roomId,market={x:shop.x,y:shop.y},merchant=shop.approach;
const mapRandom=run.random(furnishingSeed^Math.imul(save.floor,0xa34fc319));
const mapSites=[];
for(const room of run.shuffle(rooms.slice(1),mapRandom)){
 for(let y=room.y+1;y<room.y+room.h-1;y++)for(let x=room.x+1;x<room.x+room.w-1;x++){
  const p={x:(x+.5)*TILE,y:(y+.5)*TILE};
  const byShop=room.i===merchantRoomId&&Math.abs(p.x-market.x)<111&&Math.abs(p.y-market.y)<73;
  if(!byShop&&valid(p.x,p.y,16,true)&&[...shopObstacles,merchant].every(o=>Math.hypot(p.x-o.x,p.y-o.y)>95))mapSites.push(p);
 }
}
const mapPickup=mapSites[Math.floor(mapRandom()*mapSites.length)]||pointIn(rooms[1],0,0);
const landmarks=[...links,...(returnPortal?[returnPortal]:[]),...(save.layoutRevision>=10?doors:[]),...stairs.flatMap(s=>[tileCenter(s.a),tileCenter(s.b)]),...(cryptAltar?[cryptAltar]:[]),...(sewerRelic?[tileCenter(sewerRelic)]:[]),...shrines,...chests,merchant,mapPickup,spawn,...bonePiles,...templeShrines,...(restCat?[restCat,wellUse,wellArrival,...(save.layoutRevision>=12?[luckyCat]:[])]:[]),market];
furniture.push({type:'market',...market,zone:merchantRoomId,...FURNITURE.market});
function placeRoomSet(pieces,ax,ay,zone){
 const group=[];
 for(const [type,dx,dy] of pieces){
  const d=FURNITURE[type],x=(ax+dx)*TILE,y=(ay+dy)*TILE;
  if(wall(x,y)||terrain[Math.floor(y/TILE)]?.[Math.floor(x/TILE)]?.startsWith('stairs-'))return false;
  if(d.solid){
   const rx=d.w/2+4,ry=d.h/2+4;
   if([[-rx,-ry],[rx,-ry],[-rx,ry],[rx,ry]].some(([u,v])=>wall(x+u,y+v)))return false;
   if(entrances.some(p=>Math.hypot(x-p.x,y-p.y)<Math.max(rx,ry)+69))return false;
   if(landmarks.some(p=>Math.hypot(x-p.x,y-p.y)<Math.max(rx,ry)+32))return false;
   if([...furniture,...group].some(p=>p.solid&&Math.abs(x-p.x)<(p.w+d.w)/2+6&&Math.abs(y-p.y)<(p.h+d.h)/2+6))return false;
  }
  group.push({type,x,y,zone,...d});
 }
 furniture.push(...group);
 return true;
}
const wallFurniture=new Set(['cabinet','bookcase','dresser','weapon-rack','armor-rack','display','provisions','alchemy','statue']);
function placeWallFurniture(type,room,preferredX,preferredY,zone){
 const d=FURNITURE[type],left=room.x*TILE,top=room.y*TILE,right=(room.x+room.w)*TILE;
 const rear=d.h/2+(type==='statue'?28:type==='shelf'?5:9),side=d.w/2+(type==='shelf'?5:9),sites=[];
 for(let i=1;i<room.w-1;i++){
  const x=left+(i+.5)*TILE;
  if(wall(x,top-7))sites.push({x,y:top+rear,score:Math.abs(x/TILE-preferredX)});
 }
 for(let i=1;i<room.h-1;i++){
  const y=top+(i+.5)*TILE;
  if(wall(left-7,y))sites.push({x:left+side,y,score:5+Math.hypot(left/TILE-preferredX,y/TILE-preferredY)});
  if(wall(right+7,y))sites.push({x:right-side,y,score:5+Math.hypot(right/TILE-preferredX,y/TILE-preferredY)});
 }
 sites.sort((a,b)=>a.score-b.score);
 return sites.some(({x,y})=>placeRoomSet([[type,0,0]],x/TILE,y/TILE,zone));
}
function furnishRoom(type,room,x,y,zone){
 if(save.layoutRevision>=5&&wallFurniture.has(type))return placeWallFurniture(type,room,x,y,zone);
 return placeRoomSet([[type,0,0]],x,y,zone);
}
const purposefulGroups={
 study:{wall:['bookcase','shelf'],pieces:[['carpet',0,0],['table',0,0],['chair',0,.85],['candle',.28,-.1]]},
 guard:{wall:['weapon-rack','armor-rack'],pieces:[['round-table',0,0],['chair',0,.86],['candle',0,0]]},
 workshop:{wall:['alchemy','dresser'],pieces:[['table',0,0],['barrel',1.08,0],['candle',.27,0]]},
 dining:{wall:['provisions','shelf'],pieces:[['banquet-long',0,0],['chair',-.75,.94],['chair',.75,.94]]},
 storage:{wall:['provisions','cabinet'],pieces:[['barrel',0,0],['barrel',.85,.25],['basket',.18,.73]]}
};
function furnishPurpose(room,zone,group){
 const design=purposefulGroups[group];
 for(const [i,type] of design.wall.entries())placeWallFurniture(type,room,room.x+room.w*(i?.7:.3),room.y,zone);
 const anchors=run.shuffle([[.5,.53],[.36,.4],[.66,.4],[.34,.66],[.68,.68],[.5,.29],[.5,.76]],roomRandom);
 for(const [x,y] of anchors)if(placeRoomSet(design.pieces,room.x+x*room.w,room.y+y*room.h,zone))break;
}
const roomGroupings={
 0:{at:[[.42,.69],[.62,.72],[.63,.3]],pieces:[['carpet',0,.18],['round-table',0,0],['chair',0,1],['chair',-1.06,0]]},
 1:{at:[[.53,.34],[.50,.70],[.6,.48]],pieces:[['banquet-long',0,0],['chair',-.75,1],['chair',.75,1]]},
 3:{at:[[.61,.7],[.36,.66],[.58,.31]],pieces:[['carpet',0,.2],['round-table',0,0],['chair',-1.07,0],['chair',1.07,0]]}
};
const roomAccents=[
 [['round-table','dresser'],['display','armor-rack']],
 [['banquet-long','fence'],['weapon-rack','armor-rack']],
 [['statue','display'],['fence','dresser']],
 [['display','round-table'],['dresser','weapon-rack']],
 [['armor-rack','statue'],['banquet-long','fence']]
];
for(const [zone,plan] of roomPlans.entries()){
 const {offsetX,offsetY}=zones[zone];
 const room=rooms[zone];
 let arranged=false;
 if(save.layoutRevision>=8){
  const group=run.shuffle(Object.keys(purposefulGroups),roomRandom)[0];
  furnishPurpose(room,zone,group);
  placeRoomSet([['torch',0,0]],room.x+1.15,room.y+room.h*.58,zone);
  continue;
 }
 if(save.layoutRevision>=5){
  for(const [type,x,y] of plan.fixed)if(wallFurniture.has(type))furnishRoom(type,room,x+offsetX,y+offsetY,zone);
  for(const [index,types] of roomAccents[zone].entries()){
   const storage=types.filter(type=>wallFurniture.has(type));
   for(const [i,type] of storage.entries())furnishRoom(type,room,room.x+room.w*(index===0?.24+i*.12:.76-i*.12),room.y+1,zone);
  }
  const grouping=roomGroupings[zone];
  if(grouping)arranged=grouping.at.some(([x,y])=>placeRoomSet(grouping.pieces,room.x+room.w*x,room.y+room.h*y,zone));
 }else if(save.layoutRevision>=3)for(const types of roomAccents[zone]){
  const anchors=run.shuffle([[.23,.27],[.77,.26],[.24,.74],[.76,.74],[.23,.47],[.76,.49],[.5,.27],[.5,.75]],roomRandom);
  for(const type of types){
   if(save.layoutRevision>=4&&type==='fence')continue;
   const placed=anchors.findIndex(([x,y])=>placeRoomSet([[type,0,0]],room.x+room.w*x,room.y+room.h*y,zone));
   if(placed>=0)anchors.splice(placed,1);
  }
 }
 for(const [type,x,y] of plan.fixed){
  if(save.layoutRevision<5||!wallFurniture.has(type))furnishRoom(type,room,x+offsetX,y+offsetY,zone);
 }
 for(const {at,pieces} of plan.sets){
  if(arranged)continue;
  const choices=run.shuffle([...at],roomRandom);
  // Alternate anchors keep a full furniture group available near varying exits.
  const [left,top,w,h]=legacyRooms[zone];
  choices.push([left+w*.57,top+h*.25],[left+w*.65,top+h*.7],[left+w*.7,top+h*.49]);
  for(const [x,y] of choices)if(placeRoomSet(pieces,x+offsetX,y+offsetY,zone))break;
 }
}
furniture.push({type:'lab',...lab,zone:1,...FURNITURE.lab});
const annexDecor={
 rest:[],
 pantry:[['provisions',1.05,1.35],['provisions',5.9,1.35],['banquet',5.45,3.1],['barrel',1.05,3.15],['barrel',1.85,3.1],['torch',.65,4.7]],
 brewery:[['alchemy',1.3,1.55],['alchemy',7.6,1.55],['alchemy',1.3,4.5],['dresser',7.65,4.9],['carpet',4.5,4.7],
  ['barrel',.85,5.55],['torch',.6,2.6],['torch',8.45,2.6],['candle',6.2,4.1]],
 court:[['tree',2.2,2.05],['tree',10.8,2.05],['tree',2.35,6.12],['tree',10.65,6.18],['grass',3.3,4.4],
  ['grass',1.7,3.35],['grass',9.3,3.5],['grass',11.25,4.65],['grass',5,6.8],['grass',8,6.8],['grass',5.2,1.7]]
};
if(sanctuary){
 for(const {type,x,y,variant} of sanctuary.decor)furniture.push({type,...tileCenter({x,y}),variant,zone:3,...FURNITURE[type]});
 furniture.push({type:'sanctuary-arch',...sanctuaryPoint('lobby'),zone:3,...FURNITURE['sanctuary-arch']});
}else if(rest){
 const bed=stairs.length?['straw-bed',3.5,2.85]:['straw-bed',0,-2.7];
 const decor=[['campfire',0,0],['bench',-1.65,.2],['bench',1.65,.2],bed,['torch',-3,-2.5],['torch',2.15,-2.7],
  ['round-table',-3.55,1.42],['dresser',4.72,1.6],['armor-rack',-4.88,-.65],['well',3.4,-2.1]];
 for(const [type,dx,dy] of decor)furniture.push({type,...pointIn(rest,dx,dy),zone:rest.theme,...FURNITURE[type]});
 furniture.push({type:'lectern',...glossaryStand,zone:rest.theme,...FURNITURE.lectern});
}
const annexAccents={pantry:[['dresser',1.3,4.5],['round-table',5.4,4.35]],brewery:[['display',7.6,3.19],['dresser',1.55,3.1]],
 court:[...(save.layoutRevision<4?[['fence',3.8,1.6],['fence',9,1.6]]:[]),['statue',10.2,4.5]],rest:[]};
if(save.layoutRevision>=4){
 const fenceGroup=[['fence',0,0],['fence',1.43,0],['fence-end',2.86,0]];
 if(court)placeRoomSet(fenceGroup,court.x+5,court.y+7.05,court.theme);
 for(const room of rooms){
  if(save.layoutRevision>=8||room.i%2===0)continue;
  for(const dy of [1.45,room.h-1.55]){
   if(placeRoomSet(fenceGroup,room.x+room.w*.25,room.y+dy,room.i))break;
  }
 }
}
Object.assign(annexDecor,{
 cemetery:[['tree',2,2],['tree',14,2],['tree',13.8,10.7],['tree',2.2,10.7],['grave',4,3],['grave',6,3],['grave',8,3],['grave',10,3],['grave',12,3],['grave',4,9],['grave',6,9],['grave',8,9],['grave',10,9],['grave',12,9],['grass',4,4],['grass',11,8],['grass',2.3,8]],
 'temple-entry':[['vines',2,1],['vines',8,1],['basket',2,2],['bush',2,3],['bush',8.9,9],['rubble',2.5,8.5],['rubble',8.9,8.5],['torch',3,2.3]],
 'temple-court':[['vines',2.4,1.2],['vines',9.3,1.25],['vines',6,1.4],['rubble',10,4],['rubble',4,10.8],['basket',10.4,8.5],['bush',2,10.5],['bush',9.85,9],['torch',2.5,2.4]],
 'temple-shrines':[['vines',2.8,1.2],['vines',6.8,1.2],['vines',10.8,1.2],['basket',2.4,8],['basket',11.9,8],['bush',1.8,3.5],['bush',12,3],['rubble',12,9.5],['torch',5,6],['torch',9,6]]
});
if(save.layoutRevision>=7){
 const gardens=[[court,'court'],[cemetery,'cemetery']];
 for(const [room,key] of gardens){
  if(!room)continue;
  annexDecor[key].push(['pine',room.w-2,2.35],['birch',room.w-1.65,room.h-2.1],
   ['birch',3.3,room.h-1.6],['pine',room.w*.58,room.h-1.4],['bench',room.w-2.65,room.h*.65],
   ['bush',1.85,room.h*.47],['bush',room.w*.72,room.h-1.25],['grass',room.w-2.8,room.h*.49],
   ['grass',room.w*.34,room.h-1.5],['bush',room.w*.38,1.25],['birch',room.w*.65,2.05],
   ['pine',2.4,room.h*.46],['bush',room.w-1.75,room.h*.40],['grass',room.w*.59,room.h*.63]);
 }
}
annexDecor.crypt=[['sarcophagus',3,2],['sarcophagus',6,2],['sarcophagus',9,2],['sarcophagus',3,9],['sarcophagus',6,9],['sarcophagus',9,9],
 ['torch',1.25,2.5],['torch',11.5,2.5],['torch',11.5,8.5],['rubble',4,7],['crystal',11,6]];
for(const shrine of templeShrines)furniture.push({...shrine,type:'jungle-shrine',zone:6,...FURNITURE['jungle-shrine']});
for(const annex of annexes){
 for(const [type,x,y] of [...(annexDecor[annex.key]||[]),...(annexAccents[annex.key]||[])])furnishRoom(type,annex,annex.x+x,annex.y+y,annex.theme);
}
for(const room of [...rooms,...annexes.filter(room=>['rest','pantry','brewery'].includes(room.key))]){
 const zone=room.theme??room.i;
 for(const fraction of [.27,.72])placeWallFurniture('shelf',room,room.x+room.w*fraction,room.y,zone);
}

for(const room of [...lofts,...extraRooms,...(alleys?.houses??[])]){
 furnishPurpose(room,room.theme,room.group);
 placeRoomSet([['torch',0,0]],room.x+room.w-1.4,room.y+2.6,room.theme);
}
if(alleys){
 const stages=[
  [['large-barrel',0,0],['basket',.99,0]],
  [['street-stalls',0,0],['street-lantern',0,0],['street-straw',.96,.18]],
  [['large-barrel',0,0],['large-barrel',.98,.10]],
  [['basket',0,0],['basket',.91,.21],['street-straw',1.6,.19]]
 ];
 const streetRandom=run.random(furnishingSeed^0x6b386d),sideSites=alleys.paved.filter(({x,y})=>
  terrain[y-1]?.[x]?.startsWith('street-facade-')||terrain[y+1]?.[x]?.startsWith('street-facade-'));
 const left=Math.min(...sideSites.map(p=>p.x)),right=Math.max(...sideSites.map(p=>p.x));
 for(const [i,group] of stages.entries()){
  const goal=left+(right-left)*(i+.5)/stages.length;
  const sites=sideSites.map(p=>({...p,score:Math.abs(p.x-goal)+streetRandom()*2})).sort((a,b)=>a.score-b.score);
  sites.some(p=>placeRoomSet(group,p.x+.5,p.y+.5,5));
 }
 const lane=alleys.paved.filter(({x,y})=>[-1,1].every(dy=>regions[y+dy]?.[x]===alleys.id&&!map[y+dy][x]));
 const drains=[];
 for(const {x,y} of run.shuffle(lane,streetRandom)){
  if(drains.some(d=>Math.abs(d-x)<8)||furnitureBlocked((x+.5)*TILE,(y+.5)*TILE,10))continue;
  if(placeRoomSet([['street-drain',0,0]],x+.5,y+.5,5))drains.push(x);
  if(drains.length===3)break;
 }
}
for(const room of sewerRooms){
 for(let y=room.y;y<room.y+room.h;y+=4){
  const x=room.x+(y%3)*4+1,wx=(x+.5)*TILE,wy=(y+.5)*TILE;
  if(regionAt(wx,wy)===room.id&&!wall(wx,wy))furniture.push({type:'torch',x:wx,y:wy,zone:5,...FURNITURE.torch});
 }
}
const cabinets=furniture.filter(p=>p.type==='cabinet'||p.type==='bookcase').map((p,id)=>({...p,id,
 gold:run.random(save.dungeonSeed^(0x111723+id*2246822519))()<.44?9+save.floor*3+id%5:0
}));
// Exclude decorative pockets that the player cannot physically enter, even
// after opening the seals. The grid also covers half-tile corridors.
function reachableSpawnTiles(){
 const step=TILE/4,cols=W*TILE/step,rows=H*TILE/step,seen=new Uint8Array(cols*rows);
 const frontier=[];
 const enqueue=(x,y)=>{
  if(x<0||x>=cols||y<0||y>=rows)return;
  const id=y*cols+x;
  if(seen[id])return;
  seen[id]=1;
  if(valid(x*step,y*step,HERO_RADIUS,true,true,false,true)){seen[id]=2;frontier.push(id);}
 };
 enqueue(Math.round(spawn.x/step),Math.round(spawn.y/step));
 for(const p of links)enqueue(Math.round(p.exit.x/step),Math.round(p.exit.y/step));
 for(let i=0;i<frontier.length;i++){
  const id=frontier[i],x=id%cols,y=Math.floor(id/cols);
  enqueue(x-1,y);enqueue(x+1,y);enqueue(x,y-1);enqueue(x,y+1);
 }
 return (x,y)=>seen[Math.round(y/step)*cols+Math.round(x/step)]===2;
}
const bossFurniture=bossArena?[
 ...bossArena.labProps.map((p,variant)=>({...p,variant,type:'lab-apparatus'})),
 ...bossArena.benches.map(p=>({...p,type:'lab-bench'})),
 ...bossArena.rubble.map((p,variant)=>({...p,variant,type:'roof-rubble'}))
].map(p=>({...p,zone:5,...FURNITURE[p.type]})):[];
furniture.push(...bossFurniture);
function bossBeamFurniture({from,to,width}){
 return bossFurniture.filter(p=>{
  if(!furnitureIntact(p))return false;
  let enter=0,exit=1;
  for(const [axis,half] of [['x',p.w/2+width],['y',p.h/2+width]]){
   const start=from[axis]-p[axis],delta=to[axis]-from[axis];
   if(!delta){if(Math.abs(start)>half)return false;continue;}
   const a=(-half-start)/delta,b=(half-start)/delta;
   enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
  }
  return enter<=exit;
 });
}
function resetBossFurniture(){
 for(const p of bossFurniture)delete save.furnitureDamage?.[p.breakId];
}
function clearRoofLanding(actor,rock,radius){
 const dx=actor.x-rock.x,dy=actor.y-rock.y,start=Math.atan2(dy,dx);
 const {w,h}=FURNITURE['roof-rubble'];
 if(Math.abs(dx)>=w/2+radius||Math.abs(dy)>=h/2+radius)return;
 for(let i=0;i<8;i++){
  const angle=start+(i%2?1:-1)*Math.ceil(i/2)*Math.PI/4,distance=32+radius;
  const x=rock.x+Math.cos(angle)*distance,y=rock.y+Math.sin(angle)*distance;
  if(regionAt(x,y)===bossArena.id&&valid(x,y,radius)){actor.x=x;actor.y=y;return;}
 }
}
solidTiles=new Map();
for(const piece of furniture){
 if(!piece.solid)continue;
 if(Object.hasOwn(breakableHP,piece.type))piece.breakId=piece.type+'@'+Math.round(piece.x*10)+','+Math.round(piece.y*10);
 for(let ty=Math.floor((piece.y-piece.h/2-40)/TILE);ty<=Math.floor((piece.y+piece.h/2+40)/TILE);ty++)
  for(let tx=Math.floor((piece.x-piece.w/2-40)/TILE);tx<=Math.floor((piece.x+piece.w/2+40)/TILE);tx++){
   if(tx<0||tx>=W||ty<0||ty>=H)continue;
   const key=ty*W+tx;
   if(!solidTiles.has(key))solidTiles.set(key,[]);
   solidTiles.get(key).push(piece);
  }
}
const canReachSpawn=save.layoutRevision>=5?reachableSpawnTiles():()=>true;
const pantry=annexes.find(a=>a.key==='pantry');
const pantrySites=Array.from({length:pantry.h},(_,j)=>Array.from({length:pantry.w},(_,i)=>
 tileCenter({x:pantry.x+i,y:pantry.y+j}))).flat().filter(p=>
  regionAt(p.x,p.y)===pantry.id&&valid(p.x,p.y,17)&&canReachSpawn(p.x,p.y));
const pantryKeySite=id=>pantrySites[keySources.findIndex(key=>key.id===id)%pantrySites.length]??spawn;
function lootPosition(origin,anchor=origin){
 const pos={x:Math.round(origin.x),y:Math.round(origin.y)};
 const clear=p=>valid(p.x,p.y,17)&&canReachSpawn(p.x,p.y)&&
  links.every(link=>Math.hypot(p.x-link.x,p.y-link.y)>=23);
 const originalRegion=regionAt(anchor.x,anchor.y),layer=layerForRegion(originalRegion);
 const onFloor=valid(anchor.x,anchor.y,0),sameSide=p=>!onFloor||!gateLineBlocked(anchor.x,anchor.y,p.x,p.y);
 if(clear(pos)&&sameSide(pos))return pos;
 const candidates=[];
 const tx=Math.floor(pos.x/TILE),ty=Math.floor(pos.y/TILE);
 for(let y=Math.max(0,ty-3);y<=Math.min(H-1,ty+3);y++)for(let x=Math.max(0,tx-3);x<=Math.min(W-1,tx+3);x++){
  if(map[y][x]!==0||layerForRegion(regions[y][x])!==layer)continue;
  const p=tileCenter({x,y});
  if(!clear(p)||!sameSide(p))continue;
  const penalty=originalRegion>=0&&regions[y][x]!==originalRegion?96:0;
  candidates.push({...p,score:Math.hypot(p.x-pos.x,p.y-pos.y)+penalty});
 }
 candidates.sort((a,b)=>a.score-b.score);
 const safe=candidates[0];
 return safe?{x:safe.x,y:safe.y}:null;
}
function portalPosition(origin){
 const {x,y}=origin,region=regionAt(x,y);
 const options=[[60,0],[-60,0],[0,60],[0,-60],[0,0]].map(([dx,dy])=>({x:x+dx,y:y+dy}));
 return options.find(p=>regionAt(p.x,p.y)===region&&valid(p.x,p.y)&&!gateLineBlocked(x,y,p.x,p.y))??
  lootPosition(origin)??(roof&&region===roof.id?lootPosition(tileCenter({x:roof.cx,y:roof.cy})):null)??spawn;
}
function inTempleLine(x1,y,x2){
 const n=Math.ceil(Math.abs(x2-x1)/12);
 for(let i=0;i<=n;i++)if(wall(x1+(x2-x1)*i/Math.max(1,n),y))return false;
 return true;
}
const pressurePlates=templeRooms.flatMap(room=>{
 const marks=room.key==='temple-entry'?[[5,4],[7,8]]:room.key==='temple-shrines'?[[6,2],[10,8]]:[[5,5],[8,9]];
 return marks.map(([x,y])=>{
  const pos={x:(room.x+x+.5)*TILE,y:(room.y+y+.5)*TILE};
  const sites=[.65,room.w-.65,x-1.3,x+1.6];
  if(Math.floor(pos.y/TILE)%2===1)[sites[0],sites[1]]=[sites[1],sites[0]];
  const x0=sites.map(t=>(room.x+t)*TILE).find(px=>{
   if(!inTempleLine(px,pos.y,pos.x))return false;
   const steps=Math.ceil(Math.abs(px-pos.x)/6);
   return Array.from({length:steps+1},(_,i)=>i).every(i=>
    !furnitureBlocked(px+(pos.x-px)*i/Math.max(1,steps),pos.y,2));
  });
  const origin={x:x0,y:pos.y};
  return {...pos,origin,angle:x0<pos.x?0:Math.PI,pressed:false,timer:0,cooldown:0};
 }).filter(p=>Number.isFinite(p.origin.x)&&valid(p.x,p.y,5,true));
});
if(save.layoutRevision>=15){
 const random=run.random(furnishingSeed^0x25c3315d),count=3+Math.floor(random()*4);
 const reserved=[...landmarks,lab,...pressurePlates,cupPoint,glossaryStand].filter(Boolean);
 const areas=new Map([...rooms.map(room=>[room.i,room.i]),...annexes.filter(room=>room.id!==bossArena?.id&&(!sanctuary||!mercyWard.has(room.id))).map(room=>[room.id,room.theme]),
  ...(alleys?[[alleys.id,5]]:[])]);
 const candidates=new Map([...areas.keys()].map(id=>[id,[]]));
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const cell=candidates.get(regions[y][x]),tile=terrain[y][x];
  if(!cell||map[y][x]||tile?.startsWith('bridge-')||tile==='sewer-pool')continue;
  const p=tileCenter({x,y});
  if(canReachSpawn(p.x,p.y)&&valid(p.x,p.y,17,true,false,false,true)&&reserved.every(o=>Math.hypot(o.x-p.x,o.y-p.y)>=64))cell.push(p);
 }
 const ids=run.shuffle([...areas.keys()].filter(id=>candidates.get(id).length),random);
 const varied=ids.find(id=>id===alleys?.id||layerForRegion(id)!==0);
 const selected=[...(ids.includes(0)?[0]:[]),...(varied===undefined?[]:[varied]),...ids];
 for(const id of new Set(selected)){
  const p=run.shuffle(candidates.get(id),random).find(p=>shrines.every(o=>Math.hypot(o.x-p.x,o.y-p.y)>=95));
  if(!p)continue;
  const shrine={...p,i:shrines.length,theme:areas.get(id),topic:id<rooms.length?id:Math.floor(random()*rooms.length)};
  shrines.push(shrine);landmarks.push(shrine);
  if(shrines.length===count)break;
 }
}
return {
 rooms,corridors,map,regions,gates,annexes,terrain,rest,
 paths,H,W,alleys,extraRooms,annexByRegion,annexPassages,isPassage,passageSealed,court,cemetery,templeRooms,
 bonePiles,templeShrines,labRoom,lab,pointIn,outsideAt,inRain,sightScale,zones,
 spawn,sanctuary,smith,ward,returnPortal,keySources,keyName,keyItem,keyOffers,keyCaches,pantryKeySite,carrierFor,nearestKeyDoor,unlockDoor,cupPoint,restCat,luckyCat,well,wellUse,glossaryStand,wellArrival,inRest,inSanctuary,bossArena,bossBeamFurniture,resetBossFurniture,clearRoofLanding,
 regionAt,layerAt,layerForRegion,links,stairs,stairsNear,stairConnected,stairCrestClosed,hiddenByStairCrest,nearestLink,stairsFor,doors,doorHP,doorAt,heroClearsDoor,doorAhead,strikeDoor,accessState,accessSite,resolveAccess,lofts,sewerRooms,roof,crypt,cryptAltar,sewerRelic:sewerRelic&&tileCenter(sewerRelic),abyssAt,pastLedge,hailAt,waterAt,waterLightning,waterPulse,pulseReaches,gateLineBlocked,barrierVisible,barrierFloor,gateBlocked,wall,furniture,furnitureBlocked,furnitureAt,furnitureBetween,furnitureHP,furnitureIntact,furnitureCue,strikeFurniture,meleeFurniture,footWall,valid,weaponImpact,weaponClearance,weaponCover,meleeWall,beforeMeleeWall,
 merchantRoomId,merchant,mapPickup,market,landmarks,shrines,chests,trialIndex,towerAir,portalPosition,
 cabinets,pressurePlates,canReachSpawn,accessiblePoint,boneDropPosition,sightBarriers,lootPosition
};
}
function spawnEnemies(run,enemyRules,save,floor,coop){
 const {ZOMBIE,SNAKE,ARCHER,CROSSBOW,LION,LIONESS,BAT,STORM_BAT,RAT,ELECTRO_RAT,EAGLE,FROST_ZOMBIE,FROST_CROSSBOW,WHITE_ORC,BLACK_ORC,STREET_DOG}=enemyRules;
 const {rooms,templeRooms,court,cemetery,canReachSpawn,regionAt,landmarks,spawn}=floor;
 const valid=(x,y,r,ignoreSeals)=>floor.valid(x,y,r,ignoreSeals,false,false,true);
 const enemies=[],defeated=new Set(save.defeated),furnishingSeed=save.dungeonSeed,TAU=2*Math.PI;
 const enemyHealth=(type,boss)=>Math.max(1,Math.round(enemyRules.health(type,boss,save.floor)*(coop?1:.5)));
const rangedRandom=run.random(furnishingSeed^0xc48ff2a3);
const zombieRandom=run.random(furnishingSeed^0xba518b47);
const encounterRandom=run.random(furnishingSeed^0xab3298bf);
for(const room of rooms){
 const {i:roomId,x:left,y:top,w,h}=room;
 const positions=[];
 for(let j=top+1;j<top+h-1;j++)for(let i=left+1;i<left+w-1;i++){
  const x=(i+.5)*TILE,y=(j+.5)*TILE;
  if(canReachSpawn(x,y)&&valid(x,y,19,true)&&landmarks.every(p=>Math.hypot(x-p.x,y-p.y)>45)
     &&(roomId!==0||Math.hypot(x-spawn.x,y-spawn.y)>175))positions.push({x,y});
 }
 run.shuffle(positions,encounterRandom);
 const roster=run.shuffle([0,1,2,3,4],encounterRandom);
 const count=3+Math.floor((save.floor-1)/2)+(roomId===0?0:1);
 for(let k=0;k<count&&positions.length;k++){
  const pos=positions.pop(),id=roomId+'-'+k;
  const rolled=k<2?roster[k]:roster[Math.floor(encounterRandom()*(save.floor>=3?4:3))];
  const melee=k===count-1&&(roomId===2||zombieRandom()<.40)?ZOMBIE:rolled;
  const ranged=rangedRandom()<.34;
  let type=ranged&&melee===3?ARCHER:ranged&&melee===ZOMBIE?CROSSBOW:melee;
  if(save.layoutRevision>=9&&[ZOMBIE,CROSSBOW].includes(type)&&zombieRandom()<.26+.06*save.floor){
   type=type===CROSSBOW?FROST_CROSSBOW:FROST_ZOMBIE;
  }
  const boss=k===0&&roomId!==0;
  const max=enemyHealth(type,boss);
  const phase=encounterRandom()*6,attack=1.2+encounterRandom()*1.8;
  if(!defeated.has(id))enemies.push({...pos,id,type,roomId,hp:max,max,boss,size:boss?1.3:1,phase,
   hit:0,attack,windup:0,angle:0});
  for(let i=positions.length-1;i>=0;i--)if(Math.hypot(positions[i].x-pos.x,positions[i].y-pos.y)<43)positions.splice(i,1);
 }
}
function stockTempleEnemies(){
 for(const room of templeRooms){
  const entrance=room.key==='temple-entry',courtRoom=room.key==='temple-court';
  const picks=entrance?[[2,4,SNAKE],[5,9,SNAKE],[8,3,LIONESS]]:courtRoom?
   [[4,3,LION],[8,6,LIONESS],[10,9,LION],[5,9,SNAKE],[9,3,SNAKE]]:
   [[3,3,SNAKE],[7,3,SNAKE],[10,3,SNAKE],[8,8,LIONESS]];
  for(const [i,[dx,dy,type]] of picks.entries()){
   const id='temple-'+room.id+'-'+i;if(defeated.has(id))continue;
   const candidates=[[dx,dy],[dx,dy+1],[dx+1,dy],[dx-1,dy],[dx,dy-1],[dx+1,dy+1],[dx-1,dy-1]];
   const pos=candidates.map(([x,y])=>({x:(room.x+x+.5)*TILE,y:(room.y+y+.5)*TILE})).find(p=>
    regionAt(p.x,p.y)===room.id&&canReachSpawn(p.x,p.y)&&valid(p.x,p.y,type===SNAKE?8:18,true)&&
    enemies.every(e=>Math.hypot(e.x-p.x,e.y-p.y)>40));
   if(!pos)continue;
   const max=enemyHealth(type,false);
   const fireSnake=type===SNAKE&&(entrance&&i===0||run.random(furnishingSeed^(room.id*719+i*9007))()<.37);
   enemies.push({...pos,id,type,fireSnake,roomId:0,size:type===SNAKE?.58:type===LION?1.19:1.06,hp:max,max,phase:i,attack:1.4+i*.3,hit:0,angle:0,windup:0});
  }
 }
}
stockTempleEnemies();
function stockOutdoorEnemies(){
 if(save.layoutRevision<7)return;
 const rng=run.random(save.dungeonSeed^0x8af2d315);
 for(const room of [court,cemetery].filter(Boolean)){
  const points=[];
  for(let y=room.y+1;y<room.y+room.h-1;y++)for(let x=room.x+1;x<room.x+room.w-1;x++){
   const point={x:(x+.5)*TILE,y:(y+.5)*TILE};
   if(regionAt(point.x,point.y)===room.id&&valid(point.x,point.y,17,true)&&canReachSpawn(point.x,point.y)&&
    landmarks.every(site=>Math.hypot(site.x-point.x,site.y-point.y)>57))points.push(point);
  }
  run.shuffle(points,rng);
  const pack=2+Math.floor(rng()*3),count=pack+2+Math.floor(rng()*3);
  const anchor=points[0];
  if(!anchor)continue;
  const cluster=(a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y);
  points.sort(cluster);
  const residents=run.shuffle([0,1,2,3,4,ZOMBIE,SNAKE,ARCHER,CROSSBOW,LION,LIONESS],rng);
  for(let i=0;i<count&&points.length;i++){
   const pos=i<pack?points.shift():points.pop(),id='garden-'+room.id+'-'+i;
   const type=i<pack?(rng()<.35?STORM_BAT:BAT):residents[i-pack];
   const max=enemyHealth(type,false),phase=rng()*TAU,attack=1+rng();
   if(!defeated.has(id))enemies.push({...pos,id,type,roomId:0,hp:max,max,size:i<pack?.72:type===SNAKE?.58:1.04,phase,attack,hit:0,windup:0,angle:0});
  }
 }
}
stockOutdoorEnemies();
const extraRng=run.random(furnishingSeed^0x4fab947c);
const upperRoster=save.layoutRevision>=9?[0,2,3,ARCHER,FROST_ZOMBIE,FROST_CROSSBOW]:[0,2,3,ARCHER];
for(const room of [...floor.lofts,...floor.extraRooms,...floor.sewerRooms]){
 const sewer=room.key.startsWith('sewer'),sites=[];
 for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++){
  const p={x:(x+.5)*TILE,y:(y+.5)*TILE};
  if(regionAt(p.x,p.y)===room.id&&valid(p.x,p.y,sewer?14:18,true)&&canReachSpawn(p.x,p.y)&&
    landmarks.every(o=>Math.hypot(o.x-p.x,o.y-p.y)>100))sites.push(p);
 }
 run.shuffle(sites,extraRng);
 const count=sewer?3+Math.floor(extraRng()*3):2+Math.floor(extraRng()*2);
 for(let i=0;i<count&&sites.length;i++){
  const id=room.key+'-'+i,pos=sites.pop();
  const type=sewer?(i===0||i>1&&extraRng()<.32?ELECTRO_RAT:RAT):upperRoster[Math.floor(extraRng()*upperRoster.length)];
  const max=enemyHealth(type,false);
  if(!defeated.has(id))enemies.push({...pos,id,type,roomId:0,hp:max,max,phase:extraRng()*TAU,
   hit:0,attack:1.2+extraRng(),windup:0,angle:0,size:type===RAT?.61:type===ELECTRO_RAT?1.08:1});
  for(let j=sites.length-1;j>=0;j--)if(Math.hypot(sites[j].x-pos.x,sites[j].y-pos.y)<83)sites.splice(j,1);
 }
}
if(floor.alleys){
 const {id,light,paved}=floor.alleys;
 const streetRandom=run.random(Math.imul(furnishingSeed^0xfe49bd67,0x45d9f3b));
 const residents=streetRandom()<.57?[WHITE_ORC,BLACK_ORC]:[RAT,RAT,RAT];
 const roster=[STREET_DOG,STREET_DOG,STREET_DOG,...residents,...(light==='night'?[BAT,STORM_BAT]:[])];
 const sites=run.shuffle(paved.map(({x,y})=>({x:(x+.5)*TILE,y:(y+.5)*TILE})).filter(p=>
  regionAt(p.x,p.y)===id&&valid(p.x,p.y,17)&&canReachSpawn(p.x,p.y)),streetRandom);
 for(const [i,type] of roster.entries()){
  const pos=sites.pop(),id='street-'+i,max=enemyHealth(type,false),phase=streetRandom()*TAU;
  if(!pos)break;
  if(!defeated.has(id))enemies.push({...pos,id,type,roomId:0,hp:max,max,alleyRing:i===0&&save.floor===1,
   size:type===RAT?.58:type===BAT||type===STORM_BAT?.76:1.08,phase,hit:0,attack:1.4,windup:0,angle:0});
  for(let j=sites.length-1;j>=0;j--)if(Math.hypot(sites[j].x-pos.x,sites[j].y-pos.y)<96)sites.splice(j,1);
 }
}
if(floor.roof){
 const {roof}=floor;
 for(const [i,dx,dy,type] of [[0,5,2,EAGLE],[1,8,5,BAT],[2,8,2,EAGLE],[3,5,6,STORM_BAT]]){
  const x=(roof.x+dx+.5)*TILE,y=(roof.y+dy+.5)*TILE,id='roof-'+i,max=enemyHealth(type,false);
  if(!defeated.has(id))enemies.push({x,y,id,type,roomId:0,hp:max,max,size:type===EAGLE?1.09:.78,
   phase:i,hit:0,attack:1.2+i*.3,windup:0,angle:0});
 }
}
if(floor.crypt){
 const {crypt}=floor;
 const roster=[WHITE_ORC,BLACK_ORC,WHITE_ORC,BLACK_ORC,RAT,RAT,BAT,BAT],sites=[];
 for(let y=crypt.y+1;y<crypt.y+crypt.h-1;y++)for(let x=crypt.x+2;x<crypt.x+crypt.w-1;x++){
  const p={x:(x+.5)*TILE,y:(y+.5)*TILE};
  if(valid(p.x,p.y,16,true)&&canReachSpawn(p.x,p.y)&&landmarks.every(o=>Math.hypot(p.x-o.x,p.y-o.y)>75))sites.push(p);
 }
 run.shuffle(sites,extraRng);
 for(const [i,type] of roster.entries()){
  const p=sites.pop(),id='crypt-'+i,max=enemyHealth(type,false);
  if(!p)break;
  if(!defeated.has(id))enemies.push({...p,id,type,roomId:0,hp:max,max,size:type===RAT?.55:type===BAT?.7:1.05,
   phase:i,hit:0,angle:0,windup:0,attack:1.3+i*.21});
  for(let j=sites.length-1;j>=0;j--)if(Math.hypot(p.x-sites[j].x,p.y-sites[j].y)<72)sites.splice(j,1);
 }
}
return enemies;
}
return {TILE,HERO_RADIUS,fallSeconds,wallRecoilSeconds,wallRecoilForce,fallEnemy,build,spawnEnemies};
})();
})(typeof window==='undefined'?globalThis:window);
