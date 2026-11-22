// Dedicated action-driven combat for Blender skeletons. Movement is independent
// of upper-body attack playback, except while performing a cartwheel.
(function(root){
'use strict';
const TAU=Math.PI*2;
function create(hooks){
 const {move,aim,advance,fireArrow,throwVessel,damage,blocked,random}=hooks;
 const clipDur={shoot:.49,'double-shoot':.83,throw:.75,flee:.46,
   combo:1.15,slash:.82,overhead:.80,'cartwheel-enter':.28,
   cartwheel:1.32,'cartwheel-exit':.29};
 function begin(e,name){
  e.skeletonAction={name,age:0,duration:clipDur[name],hits:0};
  e.windup=0;e.runAttack=0;e.recover=0;
  e.skeletonCooldown={shoot:.63,'double-shoot':1.08,throw:1.45,
   combo:1.50,slash:1.06,overhead:1.13,'cartwheel-enter':2.5,
   flee:.37}[name]??.68;
 }
 function travel(e,direction,speed,dt,face){
  const x=e.x,y=e.y;
  move(e,Math.cos(direction)*speed*dt,Math.sin(direction)*speed*dt);
  aim(e,face);
  return Math.hypot(e.x-x,e.y-y)>.1;
 }
 function hit(e,hero,label,amount,reach,face){
  if(!hero||hero.hp<=0||Math.hypot(hero.x-e.x,hero.y-e.y)>reach||
     blocked(e,hero))return;
  if(Math.cos(Math.atan2(hero.y-e.y,hero.x-e.x)-face)<.18)return;
  if(damage(e,hero,label,amount)&&label==='Säbelcombo')
   hero.inv=Math.min(hero.inv||0,.09);
 }
 function update(e,hero,dt,spec,d,angle,visible){
  e.skeletonCooldown=Math.max(0,(e.skeletonCooldown||0)-dt);
  e.soulCooldown=Math.max(0,(e.soulCooldown??5)-dt);
  aim(e,angle);
  let a=e.skeletonAction;
  if(!e.aggro&&!a)return;
  if(a){
   const old=a.age;a.age=Math.min(a.duration,a.age+dt);
   const crossed=t=>old<t&&a.age>=t;
   const back=angle+Math.PI,bow=e.skeleton==='bow';
   if(bow){
    if(d<260||a.name==='flee')
     travel(e,back,spec.speed*(a.name==='flee'?2.3:1.72),dt,angle);
    else if(d>spec.range*.83)
     travel(e,angle,spec.speed*.8,dt,angle);
    const shot=(offset=0)=> {
     e.target={x:hero.x,y:hero.y};
     const face=e.angle;
     e.angle=angle+offset;
     fireArrow(e);
     e.angle=face;
    };
    if(a.name==='shoot'&&crossed(.27))shot();
    if(a.name==='double-shoot'){
     if(crossed(.23)){shot(-.045);a.hits++;}
     if(crossed(.55)){shot(.045);a.hits++;}
    }
   }else if(a.name==='cartwheel'){
    travel(e,angle+Math.PI*.5*(e.skeletonWheelSide||1),
           spec.speed*1.52*3,dt,angle);
    e.skeletonWheelContact=Math.max(0,(e.skeletonWheelContact||0)-dt);
    if(e.skeletonWheelContact<=0&&
       Math.hypot(e.x-hero.x,e.y-hero.y)<38){
      hit(e,hero,'Rad-Kollision',10,42,angle);
      e.skeletonWheelContact=.29;
    }
   }else if(a.name==='combo'){
    travel(e,angle,spec.speed*1.8,dt,angle);
    const strikes=[.13,.30,.47,.64,.81,.99];
    while(a.hits<strikes.length&&crossed(strikes[a.hits])){
     hit(e,hero,'Säbelcombo',6,80,angle);a.hits++;
    }
   }else if(a.name==='slash'){
    if(a.age<.42)travel(e,angle,spec.speed*1.4,dt,angle);
    else if(a.age>.47)travel(e,back,spec.speed*2.25,dt,angle);
    if(crossed(.38))hit(e,hero,'Säbelschnitt',18,90,angle);
   }else if(a.name==='overhead'){
    if(a.age<.47)travel(e,angle,spec.speed,dt,angle);
    if(crossed(.50))hit(e,hero,'Überkopfschlag',24,84,angle);
   }else if(a.name==='throw'){
    if(d>90)travel(e,angle,spec.speed*.60,dt,angle);
   }
   if(a.name==='throw'&&crossed(.48)){
    throwVessel(e,angle);
    e.soulCooldown=6+random()*2.8;
   }
   if(a.age>=a.duration-1e-6){
    if(a.name==='cartwheel-enter')begin(e,'cartwheel');
    else if(a.name==='cartwheel')begin(e,'cartwheel-exit');
    else if(a.name==='cartwheel-exit'){
     // The exit can immediately convert into an advancing slash.
     if(random()<.72)begin(e,'slash');
     else e.skeletonAction=null;
    }else e.skeletonAction=null;
   }
   return;
  }
  if(!e.aggro)return;
  if(!visible){
   if(d>80)advance(e,dt,spec.speed*1.1,false);
   return;
  }
  if(e.soulCooldown<=0&&d<350&&random()<.22){
   begin(e,'throw');return;
  }
  if(e.skeleton==='bow'){
   if(d<105&&e.skeletonCooldown<=.12){
    begin(e,'flee');
   }else if(e.skeletonCooldown<=0&&d<spec.range*1.25){
    e.skeletonShots=(e.skeletonShots||0)+1;
    begin(e,e.skeletonShots%3===0?'double-shoot':'shoot');
   }else if(d<210){
    travel(e,angle+Math.PI,spec.speed*1.68,dt,angle);
   }else if(d>spec.range*.86){
    advance(e,dt,spec.speed*.9,true);
   }else if(e.skeletonCooldown<=0&&random()<.04){
    begin(e,'flee');
   }
   return;
  }
  if(e.skeletonCooldown<=0&&d<177){
   e.skeletonChoice=(e.skeletonChoice||0)+1;
   const name=['combo','slash','overhead','cartwheel-enter'][(e.skeletonChoice-1)%4];
   if(name==='cartwheel-enter')e.skeletonWheelSide=random()<.5?-1:1;
   begin(e,name);
  }else if(d>44){
   advance(e,dt,spec.speed*1.52,true);
  }
 }
 return {update,begin,clips:Object.keys(clipDur)};
}
root.SkeletonCombat={create};
})(typeof window==='undefined'?globalThis:window);
