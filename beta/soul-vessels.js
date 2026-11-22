// Shared stone-vessel physics, ten-second sources, obstacle-aware poison gas.
// Uses deterministic low-resolution diffusion; display shader samples this
// SAME field. Cells are plain numbers to keep multiplayer saves serializable.
(function(root){
'use strict';
const SIZE=15,HALF=7,CELL=18,COUNT=SIZE*SIZE;
const index=(x,y)=>y*SIZE+x;
const neighbors=[[1,0],[-1,0],[0,1],[0,-1]];
function create({state,floor,heroes,poison,origin,random,heroFloor}){
 state.soulVessels??=[];
 const solid=(x,y)=>Boolean(floor.wall(x,y)||floor.gateBlocked(x,y)||
    floor.doorAt?.(x,y)||floor.inRest(x,y));
 const permeability=(x,y)=>solid(x,y)?0:
    floor.furnitureBlocked(x,y,4)?.20:1;
 function throwVessel(e,angle){
  const stones=state.soulVessels;
  if(stones.length>=10)stones.shift();
  const speed=205;
  stones.push({x:e.x,y:e.y,z:78+(e.alleyZ||0),vx:Math.cos(angle)*speed,
   vy:Math.sin(angle)*speed,vz:133,gravity:495,
   age:0,emission:10,life:12.5,landed:false,tick:0,
   alleyFloor:e.alleyFloor??0,seed:random()*1000,
   cells:Array(COUNT).fill(0),origin:origin(e,'Geisterbehälter')});
 }
 function stepField(v){
  const prev=v.cells,next=prev.slice(),pass=new Float32Array(COUNT);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   pass[index(x,y)]=permeability(v.x+(x-HALF)*CELL,
                                v.y+(y-HALF)*CELL);
  }
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   const i=index(x,y);if(!pass[i]){next[i]=0;continue;}
   for(const [dx,dy] of [[1,0],[0,1]]){
    const nx=x+dx,ny=y+dy;
    if(nx>=SIZE||ny>=SIZE)continue;
    const j=index(nx,ny),transfer=(prev[i]-prev[j])*.18*
      Math.min(pass[i],pass[j]);
    next[i]-=transfer;next[j]+=transfer;
   }
  }
  for(let i=0;i<COUNT;i++)next[i]=Math.max(0,next[i]*.991);
  if(v.emission>0)next[index(HALF,HALF)]=
    Math.min(1.35,next[index(HALF,HALF)]+.23);
  v.cells=next;
 }
 function update(dt){
  for(const v of state.soulVessels){
   v.age+=dt;v.life-=dt;
   if(!v.landed){
    for(let k=0,steps=Math.max(1,Math.ceil(dt/.012));k<steps;k++){
     const t=dt/steps,x=v.x+v.vx*t,y=v.y+v.vy*t;
     if(solid(x,y)||floor.furnitureBlocked(x,y,5)){
      v.vx*=-.23;v.vy*=-.23;v.vz*=.46;
     }else{v.x=x;v.y=y;}
     v.z+=v.vz*t-.5*v.gravity*t*t;v.vz-=v.gravity*t;
     if(v.z<=v.alleyFloor*132+7){
      v.z=v.alleyFloor*132+7;v.landed=true;
      v.vx=v.vy=v.vz=0;break;
     }
    }
    continue;
   }
   v.emission=Math.max(0,v.emission-dt);
   v.tick+=dt;
   let steps=0;
   while(v.tick>=1/12&&steps++<3){
    v.tick-=1/12;stepField(v);
   }
   if(v.emission===0)v.cells=v.cells.map(value=>value*Math.exp(-dt*.6));
   for(const hero of heroes()){
    if(hero.hp<=0||hero.dash>0||hero.poison||
       heroFloor?.(hero)!==undefined&&heroFloor(hero)!==v.alleyFloor)continue;
    const cx=Math.round((hero.x-v.x)/CELL)+HALF;
    const cy=Math.round((hero.y-v.y)/CELL)+HALF;
    if(cx<0||cy<0||cx>=SIZE||cy>=SIZE)continue;
    const density=v.cells[index(cx,cy)];
    if(density>.13&&permeability(hero.x,hero.y)>0){
     poison(hero,{untilTick:.75,ticks:3,power:Math.min(1.15,.35+density*.60),
       origin:{source:'Geisterbehälter',action:'Giftnebel'}});
    }
   }
  }
  for(let i=state.soulVessels.length-1;i>=0;i--){
   const v=state.soulVessels[i];
   if(v.life<=0||v.emission<=0&&v.cells.every(value=>value<.02))
    state.soulVessels.splice(i,1);
  }
 }
 return {throwVessel,update,SIZE,CELL};
}
root.SoulVessels={create,SIZE,CELL};
})(typeof window==='undefined'?globalThis:window);
