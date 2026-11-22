// Small, rolling poison orbs. The same world-space density field drives
// both the visible fog and poison damage; collision checks are authoritative.
(function(root){
'use strict';
const SIZE=15,HALF=7,CELL=18,COUNT=SIZE*SIZE,RADIUS=7;
const index=(x,y)=>y*SIZE+x;
function create({state,floor,heroes,poison,origin,random,heroFloor}){
 state.soulVessels??=[];
 const solid=(x,y,r=RADIUS)=>Boolean(
  floor.wall(x,y)||floor.gateBlocked(x,y)||floor.doorAt?.(x,y)||
  floor.inRest(x,y)||floor.furnitureBlocked(x,y,r));
 const collides=(x,y)=>solid(x,y)||solid(x+RADIUS,y,3)||
  solid(x-RADIUS,y,3)||solid(x,y+RADIUS,3)||solid(x,y-RADIUS,3);
 const permeability=(x,y)=>solid(x,y,4)?0:1;
 function throwVessel(e,angle){
  const stones=state.soulVessels;
  if(stones.length>=10)stones.shift();
  const speed=195,ground=(e.alleyFloor??0)*132;
  stones.push({x:e.x,y:e.y,z:Math.max(ground,e.alleyZ||0)+63,
   vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:95,gravity:530,
   radius:RADIUS,spin:0,age:0,emission:10,life:12.5,landed:false,tick:0,
   alleyFloor:e.alleyFloor??0,seed:random()*1000,cloudX:e.x,cloudY:e.y,
   cells:Array(COUNT).fill(0),origin:origin(e,'Geisterbehälter')});
 }
 // Keep existing smoke in WORLD coordinates as the orb rolls through it.
 // Shift only when the source crosses a grid cell, then seed its new center.
 function recenter(v){
  const sx=Math.trunc((v.x-v.cloudX)/CELL);
  const sy=Math.trunc((v.y-v.cloudY)/CELL);
  if(!sx&&!sy)return;
  if(Math.abs(sx)>=SIZE||Math.abs(sy)>=SIZE){
   v.cells.fill(0);
  }else{
   const previous=v.cells,next=Array(COUNT).fill(0);
   for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const a=x+sx,b=y+sy;
    if(a>=0&&a<SIZE&&b>=0&&b<SIZE)
     next[index(x,y)]=previous[index(a,b)];
   }
   v.cells=next;
  }
  v.cloudX+=sx*CELL;v.cloudY+=sy*CELL;
 }
 function stepField(v){
  recenter(v);
  const prev=v.cells,next=prev.slice(),pass=new Float32Array(COUNT);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)
   pass[index(x,y)]=permeability(v.cloudX+(x-HALF)*CELL,
                                v.cloudY+(y-HALF)*CELL);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   const i=index(x,y);if(!pass[i]){next[i]=0;continue;}
   for(const [dx,dy] of [[1,0],[0,1]]){
    const nx=x+dx,ny=y+dy;
    if(nx>=SIZE||ny>=SIZE)continue;
    const j=index(nx,ny),transfer=(prev[i]-prev[j])*.16*
     Math.min(pass[i],pass[j]);
    next[i]-=transfer;next[j]+=transfer;
   }
  }
  for(let i=0;i<COUNT;i++)next[i]=pass[i]?Math.max(0,next[i]*.993):0;
  if(v.emission>0){
   const cx=Math.max(0,Math.min(SIZE-1,Math.round((v.x-v.cloudX)/CELL)+HALF));
   const cy=Math.max(0,Math.min(SIZE-1,Math.round((v.y-v.cloudY)/CELL)+HALF));
   const i=index(cx,cy);
   if(pass[i])next[i]=Math.min(1.55,next[i]+.33);
  }
  v.cells=next;
 }
 function update(dt){
  // Substeps prevent the small orb passing through thin furniture/walls.
  dt=Math.max(0,Math.min(.06,dt));
  for(const v of state.soulVessels){
   v.age+=dt;v.life-=dt;
   const ground=v.alleyFloor*132+RADIUS;
   const steps=Math.max(1,Math.ceil(dt/(1/120)));
   for(let n=0;n<steps;n++){
    const t=dt/steps;
    if(!v.landed){
     v.z+=v.vz*t-.5*v.gravity*t*t;v.vz-=v.gravity*t;
     if(v.z<=ground){
      v.z=ground;
      // First impact: a short bounce, then rolling friction.
      if(Math.abs(v.vz)>80){v.vz=Math.abs(v.vz)*.24;}
      else{v.landed=true;v.vz=0;}
     }
    }
    // Preserve horizontal momentum after impact. Resolve X/Y separately
    // so a hit against one wall can still slide along the other axis.
    const nx=v.x+v.vx*t;
    if(!collides(nx,v.y))v.x=nx;
    else v.vx*=-.42;
    const ny=v.y+v.vy*t;
    if(!collides(v.x,ny))v.y=ny;
    else v.vy*=-.42;
    if(v.landed){
     const friction=Math.exp(-2.25*t);
     v.vx*=friction;v.vy*=friction;
     if(Math.hypot(v.vx,v.vy)<2){v.vx=0;v.vy=0;}
    }
    v.spin+=Math.hypot(v.vx,v.vy)*t/RADIUS;
   }
   // Emit a conspicuous cloud directly after the first contact, while
   // rolling; cells survive behind the moving ball.
   if(v.z>ground+3)returnGasOnly(v);
   else{
    v.emission=Math.max(0,v.emission-dt);
    v.tick+=dt;
    let diffusionSteps=0;
    while(v.tick>=1/12&&diffusionSteps++<3){
     v.tick-=1/12;stepField(v);
    }
    if(v.emission===0){
     const decay=Math.exp(-dt*.65);
     for(let i=0;i<COUNT;i++)v.cells[i]*=decay;
    }
   }
   for(const hero of heroes()){
    if(hero.hp<=0||hero.dash>0||hero.poison||
       (heroFloor?.(hero)!==undefined&&heroFloor(hero)!==v.alleyFloor))continue;
    const cx=Math.round((hero.x-v.cloudX)/CELL)+HALF;
    const cy=Math.round((hero.y-v.cloudY)/CELL)+HALF;
    if(cx<0||cy<0||cx>=SIZE||cy>=SIZE)continue;
    const density=v.cells[index(cx,cy)];
    if(density>.13&&permeability(hero.x,hero.y)>0)
     poison(hero,{untilTick:.75,ticks:3,power:Math.min(1.15,.35+density*.6),
      origin:{source:'Geisterbehälter',action:'Giftnebel'}});
   }
  }
  for(let i=state.soulVessels.length-1;i>=0;i--){
   const v=state.soulVessels[i];
   if(v.life<=0||(v.emission<=0&&v.cells.every(value=>value<.02)))
    state.soulVessels.splice(i,1);
  }
 }
 // Intentionally no emission while the projectile is high in the air.
 function returnGasOnly(v){v.tick=0;}
 return {throwVessel,update,SIZE,CELL,RADIUS};
}
root.SoulVessels={create,SIZE,CELL,RADIUS};
})(typeof window==='undefined'?globalThis:window);
