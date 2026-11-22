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
    const path=alley.routeToFloor(e,target,plane(ownFloor(e)));
    if(!path)return false;
    e.alleyWaypoints=path.steps.slice();
    e.alleyRouteKey=key;e.alleyRepathAt=now+.62;
   }
   while(e.alleyWaypoints.length&&d(e,e.alleyWaypoints[0])<6)
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
    const route=alley.routeToFloor(e,goal,plane(from));
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
   ride.age=Math.min(ride.duration,ride.age+dt);
   const pose=vertical.pose(ride.connector,ride.up,ride.age/ride.duration);
   e.x=pose.x;e.y=pose.y;e.alleyZ=pose.z+(Math.min(ride.from,ride.to)-base())*height;
   e.facing=pose.angle;e.angle=pose.angle;
   e.moving=true;
   e.phase+=dt;
   if(ride.age>=ride.duration){
    e.alleyFloor=ride.to;e.alleyZ=prison?0:e.alleyFloor*height;
    e.alleyClimb=null;resetNavigation(e);
   }
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
  function update(e,hero,dt,now,mover){
   if(!e||e.hp<=0)return false;
   if(!e.alleyHome){
    e.alleyFloor??=0;e.alleyZ=prison?0:e.alleyFloor*height;
    e.alleyHome={x:e.x,y:e.y,floor:e.alleyFloor};
    e.alleyMode='guard';
   }
   if(e.alleyClimb){idle(e,dt);climb(e,dt);return true;}
   const seen=inSight(e,hero);
   if(seen){
    e.alleyLastSeen={...point(hero),floor:heroFloor(),time:now};
    e.alleyMode='chase';e.alleySearch=0;
    resetNavigation(e);
    return false; // Ordinary attack and animation AI only on the SAME floor.
   }
   idle(e,dt);
   investigateFloorChange(e,hero,now);
   if(e.alleyMode==='guard')return true;
   const remembered=e.alleyLastSeen;
   if(e.alleyMode!=='return'&&(!remembered||
      now-remembered.time>17)){
    e.alleyMode='return';resetNavigation(e);
   }
   if(e.alleyMode==='search'){
    e.alleySearch=(e.alleySearch||0)+dt;
    e.facing=(e.facing??0)+dt*.82;
    if(e.alleySearch>2.2){
     e.alleyMode='return';resetNavigation(e);
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
    if(d(e,portal.entry)<17){
     const up=target.floor>ownFloor(e);
     e.alleyClimb={connector:portal.connector,up,from:ownFloor(e),to:ownFloor(e)+(up?1:-1),age:0,
      duration:portal.connector.kind==='ladder'?3.25:
       Math.max(2.5,portal.connector.duration*1.15)};
     e.alleyRouteKey=null;
     return true;
    }
    walk(e,portal.entry,dt,now,mover,e.skeleton?92:119);
    return true;
   }
   if(d(e,target)<24){
    if(returning){
     e.alleyMode='guard';e.alleyLastSeen=null;
     e.aggro=0;resetNavigation(e);
    }else{
     e.alleyMode='search';e.alleySearch=0;resetNavigation(e);
    }
    return true;
   }
   if(!walk(e,target,dt,now,mover,e.skeleton?83:108)){
    e.alleyMode=returning?'guard':'search';
    e.alleySearch=0;resetNavigation(e);
   }
   return true;
  }
  return {update,inSight,heroFloor,destinationFloor,ownFloor};
 }
 return {create};
})();
