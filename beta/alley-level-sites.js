// One placement plan per dungeon level, shared by its resident storeys.
(() => {
 'use strict';
 const g=window.AlleyGenerator,v=window.AlleyVertical,p=window.RockyCoastPrison;
 if(!g?.enabled||!v?.enabled)return;
 const count=p.enabled?p.count:1,sites=[];
 const catalog=window.MindRoomKit?.catalog,design=window.MindRoomLevelDesign,progression=window.AlleyProgression;
 const authoredLevers=[],authoredGates=[],reservedMarkers=[];
 const floorRooms=Array.from({length:count},(_,i)=>{
  const links=[...v.connectorsAt(i),...(i?v.connectorsAt(i-1):[])];
  return new Set(links.map(c=>c.roomId));
 });
 const prefix=[g.seed,g.dungeonLevel].join('-');
 const doors=g.doors.flatMap(d=>d.edges.flat());
 const exits=[g.outdoorEntrance,g.outdoorExit].filter(Boolean);
 const roomCounts=new Map();
 for(const room of g.rooms){const a=room.authored;if(!a||!catalog||!design)continue;
  for(const marker of a.t.data.furniture||[]){const spec=catalog.furniture[marker.type];if(!spec?.designKind)continue;
   const x=a.x+marker.x,y=a.y+marker.y,floor=a.floor;
   if(spec.designKind==='lever'){const cell=Math.floor(marker.x)+','+Math.floor(marker.y);
    const localReachable=Boolean(a.port.reachable?.has(cell))&&!a.t.blocked(marker.x,marker.y,.28,true);
    const rec={id:marker.id,floor,room:room.id,x,y,localReachable,note:marker.design?.note||''};authoredLevers.push(rec);reservedMarkers.push(rec);}
   if(spec.designKind==='portcullis'&&a.port.gates?.includes(marker.id)){const rotated=Math.abs((marker.rot||0)%180)===90,w=spec.footprint.w,h=spec.footprint.h;
    const rec={id:marker.id,floor,room:room.id,from:room.parent,to:room.id,x,y,halfX:(rotated?h:w)/2,halfY:(rotated?w:h)/2,rot:marker.rot||0,open:false};authoredGates.push(rec);reservedMarkers.push(rec);}
  }
 }
 let random=g.seed;
 function roll(){random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;}
 function add(kind,floor,room,u,w,details={}){
  sites.push({id:prefix+'-'+sites.length,kind,floor,room,x:u*48,y:w*48,...details});
 }
 const labels={altar:'Karteikarte beantworten',chest:'Goldtruhe öffnen',door:'Türsiegel lösen',
  brew:'Brautisch',merchant:'Fledermaushändler'};
 for(let i=0;i<17;i++){
  const floor=i%count,kind=i<10?'altar':i<15?'chest':i===15?'brew':'merchant';
  let best=null,score=-Infinity;
  for(const room of g.rooms){
   if(room.kind!=='raum'||floorRooms[floor].has(room.id))continue;
   const authored=room.authored?.floor===floor?room.authored:null;
   for(const [a,b] of room.cells){
    const u=a+.5,w=b+.5;
    if(authored&&(!authored.port.reachable.has((a-authored.x)+','+(b-authored.y))||
      authored.t.blocked(u-authored.x,w-authored.y,kind==='brew'?.58:.65,true)))continue;
    if(reservedMarkers.some(m=>m.floor===floor&&Math.hypot(m.x-u,m.y-w)<1.1))continue;
    if(![[-1,-1],[-1,1],[1,-1],[1,1]].every(([dx,dy])=>g.roomAt(u+dx,w+dy)===room.id)||
      p.atStorey(floor+1,()=>g.blocked(u,w,.68))||doors.some(([x,y])=>Math.hypot(x+.5-u,y+.5-w)<3)||
      exits.some(e=>Math.hypot(e.x-u,e.y-w)<4)||
      sites.some(s=>s.floor===floor&&Math.hypot(s.x/48-u,s.y/48-w)<3))continue;
    const value=roll()+(authored?.t.id.startsWith('shrine_')&&kind==='altar'?1:0)-(roomCounts.get(room.id)||0);
    if(value>score){score=value;best={room:room.id,u,w};}
   }
  }
  if(!best)throw Error('Kein freier Platz für '+kind+' in '+prefix);
  add(kind,floor,best.room,best.u,best.w,{gold:kind==='chest'?8+Math.floor(roll()*13):0});
  if(kind==='chest'){
   // Face the closest doorway into this chamber. The four baked lock faces
   // point along +v, +u, -v and -u respectively in the projected floor.
   const approaches=g.rooms[best.room].exits.flatMap(d=>d.edges.flat());
   const nearest=approaches.reduce((a,b)=>Math.hypot(a[0]+.5-best.u,a[1]+.5-best.w)<
    Math.hypot(b[0]+.5-best.u,b[1]+.5-best.w)?a:b);
   const du=nearest[0]+.5-best.u,dv=nearest[1]+.5-best.w;
   sites.at(-1).turn=Math.abs(du)>Math.abs(dv)?(du>0?1:3):(dv>0?0:2);
  }
  roomCounts.set(best.room,(roomCounts.get(best.room)||0)+1);
 }
 const verticalLinks=[];
 for(let floor=0;floor<count-1;floor++)for(const c of v.connectorsAt(floor)){
  const from=g.roomAt?.(c.bottom?.x,c.bottom?.y)??c.roomId,to=g.roomAt?.(c.top?.x,c.top?.y)??c.roomId;
  if(from!=null&&to!=null)verticalLinks.push({fromFloor:floor,fromRoom:from,toFloor:floor+1,toRoom:to,kind:c.kind});
 }
 const check=progression?.validate({rooms:g.rooms,doors:g.doors,verticalLinks,count,startFloor:0,startRoom:0,levers:authoredLevers,gates:authoredGates})||
  {ok:authoredGates.length===0&&authoredLevers.length===0,reason:'Progressionsprüfung nicht verfügbar',unreachableLevers:[],gateCount:authoredGates.length,leverCount:authoredLevers.length};
 for(const gate of authoredGates){gate.open=!check.ok;gate.invalid=!check.ok;add('gate',gate.floor,gate.room,gate.x,gate.y,{sourceId:gate.id,halfX:gate.halfX,halfY:gate.halfY,rot:gate.rot,open:gate.open,invalid:gate.invalid});}
 for(const lever of authoredLevers)add('lever',lever.floor,lever.room,lever.x,lever.y,{sourceId:lever.id,localReachable:lever.localReachable,note:lever.note});
 const progressionState={...check,hasMechanisms:authoredGates.length>0||authoredLevers.length>0,gates:authoredGates.map(s=>s.id),levers:authoredLevers.map(s=>s.id),verticalLinks};
 if(!check.ok&&progressionState.hasMechanisms)console.warn('Mind Dungeon progression validation failed; all authored fallgates stay open:',check.reason,check.unreachableLevers);
 for(let i=0;i<2;i++){
  const floor=i%count;
  const candidates=g.doors.filter(d=>d.from>1&&g.rooms[d.to].kind==='raum'&&
   !floorRooms[floor].has(d.from)&&!floorRooms[floor].has(d.to)&&
   !sites.some(s=>s.kind==='door'&&s.room===d.to)&&
   d.edges.every(pair=>pair.every(([u,w])=>exits.every(e=>Math.hypot(e.x-u,e.y-w)>4))));
  candidates.sort((a,b)=>Number(g.rooms[b.to].authored?.floor===floor)-Number(g.rooms[a.to].authored?.floor===floor)||
   g.rooms[a.to].exits.length-g.rooms[b.to].exits.length);
  const door=candidates[0];
  if(!door)throw Error('Kein freier Türdurchgang in '+prefix);
  const centers=door.edges.map(([a,b])=>[(a[0]+b[0]+1)/2,(a[1]+b[1]+1)/2]);
  const mean=k=>centers.reduce((sum,c)=>sum+c[k],0)/centers.length;
  const vertical=['east','west'].includes(door.side);
  const u=mean(0),w=mean(1),half=centers.length/2;
  add('door',floor,door.to,u,w,{vertical,half,open:false});
 }
 const floor=()=>p.enabled?p.storey-1:0;
 const solids=sites.filter(s=>['door','chest','altar','gate'].includes(s.kind));
 const wallBlocked=g.blocked;
 g.blocked=(u,w,r=0)=>wallBlocked(u,w,r)||solids.some(s=>{
  if(s.floor!==floor()||s.open)return false;
  const dx=Math.abs(u-s.x/48),dy=Math.abs(w-s.y/48);
  if(s.kind==='gate')return dx<r+s.halfX&&dy<r+s.halfY;
  if(s.kind==='door')return dx<r+(s.vertical?.09:s.half)&&dy<r+(s.vertical?s.half:.09);
  if(s.kind==='altar')return Math.hypot(dx,dy)<.48*.8+r;
  const across=s.turn%2===0;
  return Math.hypot(Math.max(0,dx-(across?.42:.28)),Math.max(0,dy-(across?.28:.42)))<=r;
 });
 function remove(s){s.open=true;g.clearNavigation();}
 function activateLever(s){if(s?.kind!=='lever'||!progressionState.ok)return false;for(const gate of sites.filter(q=>q.kind==='gate'))remove(gate);return true;}
 function unlock(s){s.unsealed=true;s.hp??=320;}
 function strike(s,damage){
  if(!s.unsealed||s.open)return;
  s.hp=Math.max(0,s.hp-damage);
  if(!s.hp)remove(s);
  return s.hp;
 }
 function active(){return v.state.floor||v.state.transition||v.state.stairRide?[]:sites.filter(s=>s.floor===floor());}
 g.levelSites={sites,labels,active,unlock,strike,remove,activateLever,progression:progressionState};
})();

