// Level-aware enemy AI for the procedural isometric dungeon.
// Guards see only on their own floor, investigate the LAST SEEN place,
// climb through real stairs/ladder portals, and eventually return to post.
window.AlleyEnemyPursuit=(()=>{
 'use strict';
 const H=132;
 const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const point=p=>({x:p.x,y:p.y});
 const clamp=x=>Math.max(0,Math.min(1,x));
 function create(vertical,alley){
  const height=vertical.height||H;
  const prison=window.RockyCoastPrison?.enabled?window.RockyCoastPrison:null;
  const base=()=>prison?prison.storey-1:0;
  const plane=f=>prison?0:f;
  const portals=(from,to)=>prison?vertical.connectorsAt(to>from?from:from-1):vertical.connectors;
  const onFloor=(index,read)=>prison?prison.atStorey(index+1,read):read();
  const routeOn=(e,target)=>onFloor(ownFloor(e),()=>alley.routeToFloor(e,target,plane(ownFloor(e))));
  const ownFloor=e=>e.alleyFloor??0;
  const heroFloor=()=>{
   // A character on the flight is at neither ordinary floor. In particular
   // skeletons may NOT slash or shoot from the EG through the OG slab.
   if(vertical.state.transition||vertical.state.stairRide)return -1;
   return base()+vertical.state.floor;
  };
  const destinationFloor=()=>{
   const crossing=vertical.state.transition;
   if(crossing)return base()+(crossing.up?1:0);
   const ride=vertical.state.stairRide;
   if(ride)return base()+(ride.entry==='bottom'?1:0);
   return base()+vertical.state.floor;
  };
  function surface(e){
   const ride=e?e.alleyClimb:vertical.state.stairRide;
   if(!ride)return {floor:e?ownFloor(e):heroFloor()};
   if(e&&ride.connector.kind!=='stairs')return {floor:-1};
   const t=e?ride.age/ride.duration:ride.s/vertical.stairLength;
   return {lower:e?Math.min(ride.from,ride.to):base(),t:e&&!ride.up?1-t:t,
    length:e?ride.connector.length:vertical.stairLength*48,
    z:e?vertical.pose(ride.connector,ride.up,t).z:vertical.state.z};
  }
  function reachable(a,b,distance){
   if(a.lower==null&&b.lower==null)return a.floor>=0&&a.floor===b.floor;
   if(a.lower==null)return reachable(b,a,distance);
   let t=b.t,z=b.z;
   if(b.lower==null){
    t=b.floor-a.lower;
    if(t!==0&&t!==1)return false;
    z=t*height;
   }else if(a.lower!==b.lower)return false;
   // Reject overlapping arms of a switchback and actors behind a slab.
   return Math.abs(a.z-z)<=42&&Math.abs(a.t-t)*a.length<=distance+24;
  }
  const canFight=(e,hero)=>reachable(surface(e),surface(),d(e,hero));
  const onTread=(lower,x,y)=>lower!=null&&onFloor(lower,()=>vertical.overStair(x/48,y/48));
  function stairLine(e,hero){
   const a=surface(e),b=surface(),lower=a.lower??b.lower;
   if(lower==null||!reachable(a,b,d(e,hero)))return false;
   const landing=a.lower==null?a:b.lower==null?b:null;
   const count=Math.max(1,Math.ceil(d(e,hero)/8));
   for(let i=0;i<=count;i++){
    const x=e.x+(hero.x-e.x)*i/count,y=e.y+(hero.y-e.y)*i/count;
    if(!onTread(lower,x,y)&&(!landing||!onFloor(landing.floor,()=>
     alley.walkableOnFloor(x,y,plane(landing.floor),0))))return false;
   }
   return true;
  }
  const inSight=(e,hero)=>{
   if(ownFloor(e)!==heroFloor())return false;
   if(d(e,hero)>350)return false;
   return alley.clearLineOnFloor(e.x,e.y,hero.x,hero.y,plane(ownFloor(e)));
  };
  function resetNavigation(e){
   e.alleyWaypoints=null;e.alleyRouteKey=null;e.alleyRepathAt=0;
   e.alleyStuck=0;
  }
  function walk(e,target,dt,now,mover,speed){
   const key=ownFloor(e)+':'+Math.round(target.x/8)+':'+Math.round(target.y/8);
   if(e.alleyRouteKey!==key||now>=(e.alleyRepathAt||0)||
      !e.alleyWaypoints){
    const path=routeOn(e,target);
    if(!path)return false;
    e.alleyWaypoints=path.steps.slice();
    e.alleyRouteKey=key;e.alleyRepathAt=now+.62;
   }
   while(e.alleyWaypoints.length&&d(e,e.alleyWaypoints[0])<1)
    e.alleyWaypoints.shift();
   const next=e.alleyWaypoints[0]||target;
   const dx=next.x-e.x,dy=next.y-e.y,length=Math.hypot(dx,dy);
   if(length<1)return true;
   const pace=Math.min(length,speed*dt),before={x:e.x,y:e.y};
   mover(e,dx/length*pace,dy/length*pace);
   if(d(e,before)<.04){
    e.alleyStuck=(e.alleyStuck||0)+dt;
    if(e.alleyStuck>.65){e.alleyRepathAt=0;e.alleyStuck=0;}
   }else e.alleyStuck=0;
   return true;
  }
  function getPortal(e,targetFloor,target,now){
   const from=ownFloor(e);
   const memo=e.alleyPortalMemo;
   if(memo&&memo.from===from&&memo.to===targetFloor&&now<memo.until)
    return memo.choice;
   const choices=portals(from,targetFloor).filter(c=>c.kind!=='ladder'||e.skeleton).map(connector=>{
    const entry=targetFloor>from?connector.bottom:connector.top,
     exit=targetFloor>from?connector.top:connector.bottom,
     goal={x:entry.x*48,y:entry.y*48};
    const route=routeOn(e,goal);
    return {connector,entry:goal,exit:{x:exit.x*48,y:exit.y*48},
     route,cost:d(e,goal)+d({x:exit.x*48,y:exit.y*48},target)};
   }).filter(q=>q.route).sort((a,b)=>a.cost-b.cost);
   const choice=choices[0]||null;
   // A* is relatively expensive; choose a connector roughly once/second,
   // not two full path searches per enemy and every rendered frame.
   e.alleyPortalMemo={from,to:targetFloor,choice,until:now+1.2};
   return choice;
  }
  function climb(e,dt){
   const ride=e.alleyClimb;
   ride.age=Math.max(0,Math.min(ride.duration,ride.age+dt));
   const pose=vertical.pose(ride.connector,ride.up,ride.age/ride.duration);
   e.x=pose.x;e.y=pose.y;e.alleyZ=pose.z+(Math.min(ride.from,ride.to)-base())*height;
   e.facing=pose.angle;e.angle=pose.angle;
   e.moving=true;
   e.ratMoveAngle=pose.angle;
   if(ride.age>=ride.duration||(dt<0&&ride.age===0)){
    e.alleyFloor=ride.age===0?ride.from:ride.to;e.alleyZ=(e.alleyFloor-base())*height;
    e.alleyClimb=null;resetNavigation(e);
   }
  }
  function moveOnStairs(e,dx,dy){
   const ride=e.alleyClimb;
   if(ride?.connector.kind!=='stairs')return false;
   const t=ride.age/ride.duration;
   const a=vertical.pose(ride.connector,ride.up,Math.max(0,t-.001));
   const b=vertical.pose(ride.connector,ride.up,Math.min(1,t+.001));
   const sx=b.x-a.x,sy=b.y-a.y;
   const along=(dx*sx+dy*sy)/Math.max(.001,Math.hypot(sx,sy));
   if(Math.abs(along)>.001)climb(e,along/ride.connector.length*ride.duration);
   return true;
  }
  function idle(e,dt){
   e.phase=(e.phase||0)+dt;e.moving=false;
   e.hit=Math.max(0,(e.hit||0)-dt);
   e.attack=(e.attack||0)-dt;
   e.windup=0;e.runAttack=0;e.recover=0;
  }
  function investigateFloorChange(e,hero,now){
   const targetFloor=destinationFloor();
   if(targetFloor===ownFloor(e)||!e.alleyLastSeen||e.alleyLastSeen.floor===targetFloor||
      now-e.alleyLastSeen.time>3.3)return;
   // The guard remembers a visible stair entrance; it does not magically
   // know the player's position in an unseen room on another storey.
   const link=portals(ownFloor(e),targetFloor).find(connector=>{
    const before=targetFloor>ownFloor(e)?connector.bottom:connector.top,
     after=targetFloor>ownFloor(e)?connector.top:connector.bottom;
    const witnessed=vertical.state.stairRide?connector.kind==='stairs':
     vertical.state.transition?.connector?.id===connector.id;
    return d(e.alleyLastSeen,{x:before.x*48,y:before.y*48})<155&&(witnessed||
     d(hero,{x:after.x*48,y:after.y*48})<205);
   });
   if(!link)return;
   const exit=targetFloor>ownFloor(e)?link.top:link.bottom;
   e.alleyLastSeen={x:exit.x*48,y:exit.y*48,floor:targetFloor,
    time:e.alleyLastSeen.time};
   e.alleyMode='investigate';resetNavigation(e);
  }
  function update(e,hero,dt,now,mover,groundSpeed=e.skeleton?92:119){
   if(!e||e.hp<=0)return false;
   if(!e.alleyHome){
    e.alleyFloor??=0;e.alleyZ=prison?0:e.alleyFloor*height;
    e.alleyHome={x:e.x,y:e.y,floor:e.alleyFloor};
    e.alleyMode='guard';
   }
   if(e.alleyClimb){
    const ride=e.alleyClimb;
    const self=surface(e),target=surface();
    if(self.lower!=null){
     e.alleyZ=self.z+(self.lower-base())*height;
     if(reachable(self,target,d(e,hero))&&d(e,hero)<(e.skeleton==='bow'?340:85)){
      e.aggro=Math.max(e.aggro||0,1);return false;
     }
    }
    idle(e,dt);e.skeletonAction=null;e.ratMotion=null;
    const reverse=self.lower!=null&&target.lower===self.lower&&
     (target.t-self.t)*(ride.up?1:-1)<0;
    climb(e,reverse?-dt:dt);return true;
   }
   if(vertical.state.stairRide&&canFight(e,hero)&&d(e,hero)<70){
    e.aggro=Math.max(e.aggro||0,1);return false;
   }
   e.alleyZ=(ownFloor(e)-base())*height;
   const seen=inSight(e,hero);
   if(seen){
    e.alleyLastSeen={...point(hero),floor:heroFloor(),time:now};
    e.alleyMode='chase';e.alleySearch=null;
    resetNavigation(e);
    return false; // Ordinary attack and animation AI only on the SAME floor.
   }
   idle(e,dt);
   e.skeletonAction=null;e.ratMotion=null;
   investigateFloorChange(e,hero,now);
   if(e.alleyMode==='guard')return true;
   const remembered=e.alleyLastSeen;
   if(e.alleyMode!=='return'&&(!remembered||
      (e.alleyMode!=='search'&&now-remembered.time>17))){
    e.alleyMode='return';resetNavigation(e);
   }
   if(e.alleyMode==='search'){
    if(!e.alleySearch){
     // Probe different directions from the last sighting without reading the hidden hero.
     const angle=e.facing??0,targets=[];
     for(const offset of [0,Math.PI/2,-Math.PI/2,Math.PI]){
      const p={x:remembered.x+120*Math.cos(angle+offset),y:remembered.y+120*Math.sin(angle+offset)};
      if(routeOn(e,p))targets.push(p);
      if(targets.length===3)break;
     }
     e.alleySearch={targets,until:now+4};
    }
    const search=e.alleySearch,target=search.targets[0];
    if(!target){e.alleyMode='return';resetNavigation(e);}
    else if(now>search.until||d(e,target)<10||!walk(e,target,dt,now,mover,groundSpeed)){
     search.targets.shift();search.until=now+4;resetNavigation(e);
    }
    return true;
   }
   const returning=e.alleyMode==='return';
   const target=returning?e.alleyHome:remembered;
   if(!target){
    e.alleyMode='guard';return true;
   }
   if(ownFloor(e)!==target.floor){
    // Traverse the same physical connectors as the player, rather than
    // moving vertically through a ceiling at identical XY coordinates.
    const portal=getPortal(e,target.floor,target,now);
    if(!portal){
     e.alleyMode='return';
     if(returning){e.alleyMode='guard';e.alleyLastSeen=null;}
     return true;
    }
    if(d(e,portal.entry)<=6){
     const up=target.floor>ownFloor(e);
     e.alleyClimb={connector:portal.connector,up,from:ownFloor(e),to:ownFloor(e)+(up?1:-1),age:0,
      duration:portal.connector.kind==='ladder'?portal.connector.duration:
       portal.connector.length/Math.max(1,groundSpeed)};
     e.alleyRouteKey=null;
     return true;
    }
    walk(e,portal.entry,dt,now,mover,groundSpeed);
    return true;
   }
   if(d(e,target)<24){
    if(returning){
     e.alleyMode='guard';e.alleyLastSeen=null;
     e.aggro=0;resetNavigation(e);
    }else{
     e.alleyMode='search';e.alleySearch=null;resetNavigation(e);
    }
    return true;
   }
   if(!walk(e,target,dt,now,mover,e.skeleton?83:108)){
    e.alleyMode=returning?'guard':'search';
    e.alleySearch=null;resetNavigation(e);
   }
   return true;
  }
  return {update,inSight,heroFloor,destinationFloor,ownFloor,surface,reachable,canFight,onTread,stairLine,moveOnStairs};
 }
 return {create};
})();

