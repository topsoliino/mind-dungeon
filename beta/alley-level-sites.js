// One placement plan per dungeon level, shared by its resident storeys.
(() => {
 'use strict';
 const g=window.AlleyGenerator,v=window.AlleyVertical,p=window.RockyCoastPrison;
 if(!g?.enabled||!v?.enabled)return;
 const count=p.enabled?p.count:1,sites=[];
 const floorRooms=Array.from({length:count},(_,i)=>{
  const links=[...v.connectorsAt(i),...(i?v.connectorsAt(i-1):[])];
  return new Set(links.map(c=>c.roomId));
 });
 const prefix=[g.seed,g.dungeonLevel].join('-');
 const doors=g.doors.flatMap(d=>d.edges.flat());
 const exits=[g.outdoorEntrance,g.outdoorExit].filter(Boolean);
 const roomCounts=new Map();
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
   for(const [a,b] of room.cells){
    const u=a+.5,w=b+.5;
    if(![[-1,-1],[-1,1],[1,-1],[1,1]].every(([dx,dy])=>g.roomAt(u+dx,w+dy)===room.id)||
      g.blocked(u,w,1.1)||doors.some(([x,y])=>Math.hypot(x+.5-u,y+.5-w)<3)||
      exits.some(e=>Math.hypot(e.x-u,e.y-w)<4)||
      sites.some(s=>s.floor===floor&&Math.hypot(s.x/48-u,s.y/48-w)<3))continue;
    const value=roll()-(roomCounts.get(room.id)||0);
    if(value>score){score=value;best={room:room.id,u,w};}
   }
  }
  if(!best)throw Error('Kein freier Platz für '+kind+' in '+prefix);
  add(kind,floor,best.room,best.u,best.w,{gold:kind==='chest'?8+Math.floor(roll()*13):0});
  roomCounts.set(best.room,(roomCounts.get(best.room)||0)+1);
 }
 for(let i=0;i<2;i++){
  const floor=i%count;
  const candidates=g.doors.filter(d=>d.from>1&&g.rooms[d.to].kind==='raum'&&
   !floorRooms[floor].has(d.from)&&!floorRooms[floor].has(d.to)&&
   !sites.some(s=>s.kind==='door'&&s.room===d.to)&&
   d.edges.every(pair=>pair.every(([u,w])=>exits.every(e=>Math.hypot(e.x-u,e.y-w)>4))));
  candidates.sort((a,b)=>g.rooms[a.to].exits.length-g.rooms[b.to].exits.length);
  const door=candidates[0];
  if(!door)throw Error('Kein freier Türdurchgang in '+prefix);
  const centers=door.edges.map(([a,b])=>[(a[0]+b[0]+1)/2,(a[1]+b[1]+1)/2]);
  const mean=k=>centers.reduce((sum,c)=>sum+c[k],0)/centers.length;
  const vertical=['east','west'].includes(door.side);
  const u=mean(0),w=mean(1),half=centers.length/2;
  add('door',floor,door.to,u,w,{vertical,half,open:false});
 }
 const floor=()=>p.enabled?p.storey-1:0;
 const locks=sites.filter(s=>s.kind==='door');
 const wallBlocked=g.blocked;
 g.blocked=(u,w,r=0)=>wallBlocked(u,w,r)||locks.some(s=>!s.open&&s.floor===floor()&&
  Math.abs(u-s.x/48)<r+(s.vertical?.09:s.half)&&Math.abs(w-s.y/48)<r+(s.vertical?s.half:.09));
 function unlock(s){if(!s.open){s.open=true;g.clearNavigation();}}
 function active(){return v.state.floor||v.state.transition||v.state.stairRide?[]:sites.filter(s=>s.floor===floor());}
 g.levelSites={sites,labels,active,unlock};
})();
