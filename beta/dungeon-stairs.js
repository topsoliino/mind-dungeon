window.DungeonStairs=(()=>{
 'use strict';
 const lerp=(a,b,t)=>a+(b-a)*t;
 const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
 const middle=([a,b])=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
 function bounds(edges){
  const vertices=edges.flat(),xs=vertices.map(p=>p[0]),ys=vertices.map(p=>p[1]);
  const x=Math.floor(Math.min(...xs)+1e-8),y=Math.floor(Math.min(...ys)+1e-8);
  return {x,y,w:Math.ceil(Math.max(...xs)-1e-8)-x,h:Math.ceil(Math.max(...ys)-1e-8)-y};
 }
 function straight({x,y,w,h,direction='n',style='stone'}){
  const side=direction==='e'||direction==='w',reverse=direction==='n'||direction==='w';
  const count=Math.max(3,Math.round((side?w:h)*2.15));
  const edges=Array.from({length:count+1},(_,i)=>{
   const t=i/count,p=reverse?1-t:t;
   if(side){
    const slope=.44-t*.88;
    return [[x+w*p,y+.49+slope],[x+w*p,y+h-.49+slope]];
   }
   const inset=lerp(.11,.34,t);
   return [[x+inset,y+h*p],[x+w-inset,y+h*p]];
  });
  return {x,y,w,h,edges,style,side,direction};
 }
 function spiral(x,y){
  const count=26,rx=7.05,ry=4.9,width=1.35;
  const edges=Array.from({length:count+1},(_,i)=>{
   const t=i/count,angle=lerp(2.73,-1.42,t);
   return [width,-width].map(offset=>[
    x+(rx+offset)*Math.cos(angle),
    y+(ry+offset*.87)*Math.sin(angle)-t*2.65
   ]);
  });
  return {...bounds(edges),edges,core:{x,y:y-.35},style:'sanctuary',curve:true};
 }
 function ribbon(trace,width,style,tangents){
  // Sample by distance so both bends and straight approaches keep the same tread spacing.
  const samples=Array.from({length:97},(_,i)=>trace(i/96));
  const distances=[0];
  for(let i=1;i<samples.length;i++){
   const [x,y]=samples[i],[px,py]=samples[i-1];
   distances.push(distances.at(-1)+Math.hypot(x-px,y-py));
  }
  const length=distances.at(-1),count=Math.max(4,Math.round(length*2.45));
  let i=1;
  const edges=Array.from({length:count+1},(_,step)=>{
   const distance=length*step/count;
   while(i<samples.length-1&&distances[i]<distance)i++;
   const [ax,ay]=samples[i-1],[bx,by]=samples[i];
   const t=(distance-distances[i-1])/(distances[i]-distances[i-1]);
   const lo=samples[Math.max(0,i-2)],hi=samples[Math.min(samples.length-1,i+1)];
   const tangent=step===0?tangents?.[0]:step===count?tangents?.[1]:null;
   const [dx,dy]=tangent??[hi[0]-lo[0],hi[1]-lo[1]],scale=width/2/Math.hypot(dx,dy);
   const x=lerp(ax,bx,t),y=lerp(ay,by,t);
   return [[x-dy*scale,y+dx*scale],[x+dy*scale,y-dx*scale]];
  });
  return {...bounds(edges),edges,style,curve:true,width};
 }
 function bend(a,c,d,b,width,style){
  return ribbon(t=>{
   const u=1-t;
   return a.map((v,i)=>u**3*v+3*u*u*t*c[i]+3*u*t*t*d[i]+t**3*b[i]);
  },width,style,[c.map((v,i)=>v-a[i]),b.map((v,i)=>v-d[i])]);
 }
 function connecting(x,y,goal,top,width,style,landing=false){
  const reach=(y-top)*.43;
  const flight=bend([x,y],[x,y-reach],[goal,top+reach],[goal,top],width,style);
  if(landing&&flight.edges.length>=15){
   const center=Math.floor((flight.edges.length-1)/2);
   flight.landing=[center-2,center+2];
  }
  return flight;
 }
 function wideSpiral(x,y){
  const flight=ribbon(t=>{
   const angle=lerp(2.73,-1.42,t);
   return [x+7.05*Math.cos(angle),y+4.9*Math.sin(angle)-t*2.65];
  },2.72,'sanctuary');
  return {...flight,core:{x,y:y-.35}};
 }
 function sections(flight){
  return flight.edges.slice(1).map((back,i)=>{
   const front=flight.edges[i],[ax,ay]=middle(front),[bx,by]=middle(back);
   return {front,back,ax,ay,dx:bx-ax,dy:by-ay,polygon:[front[0],front[1],back[1],back[0]]};
  });
 }
 function touches(section,x,y){
  // Stair sections are convex. Include shared edges so they have no collision seam.
  let positive=false,negative=false;
  for(let i=0;i<4;i++){
   const [ax,ay]=section.polygon[i],[bx,by]=section.polygon[(i+1)%4];
   const cross=(bx-ax)*(y-ay)-(by-ay)*(x-ax);
   positive||=cross>1e-8;negative||=cross< -1e-8;
   if(positive&&negative)return false;
  }
  return true;
 }
 function footprint(flight){
  const cells=new Map();
  for(const [index,section] of sections(flight).entries()){
   const pts=section.polygon;
   const {x,y,w,h}=bounds(pts.map(p=>[p,p]));
   const axes=pts.map(([ax,ay],i)=>{
    const [bx,by]=pts[(i+1)%4],dx=by-ay,dy=ax-bx,project=([px,py])=>px*dx+py*dy;
    const span=pts.map(project);
    return {dx,dy,min:Math.min(...span),max:Math.max(...span)};
   });
   for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){
    const cx=col+.5,cy=row+.5;
    if(axes.some(({dx,dy,min,max})=>{
     const mid=cx*dx+cy*dy,radius=(Math.abs(dx)+Math.abs(dy))/2;
     return mid+radius<=min+1e-8||mid-radius>=max-1e-8;
    }))continue;
    const key=col+','+row;
    if(!cells.has(key))cells.set(key,{x:col,y:row,steps:[]});
    cells.get(key).steps.push({...section,index});
   }
  }
  return [...cells.values()];
 }
 function sample(steps,x,y){
  let best=null,distance=Infinity;
  for(const [index,step] of steps.entries()){
   const {ax,ay,dx,dy}=step,norm=dx*dx+dy*dy;
   const t=clamp(((x-ax)*dx+(y-ay)*dy)/norm,0,1);
   const gap=(x-ax-dx*t)**2+(y-ay-dy*t)**2;
   if(gap<distance){distance=gap;best={index:step.index??index,t,dx,dy};}
  }
  return best;
 }
 function motion(flight,step,dx,dy){
  if(flight.curve){
   const span=Math.hypot(step.dx,step.dy),x=step.dx/span,y=step.dy/span;
   const along=dx*x+dy*y,across=dy*x-dx*y;
   const atLanding=flight.landing&&step.index>=flight.landing[0]&&step.index<flight.landing[1];
   const speed=atLanding?.95:along>0?.73:.86;
   return {x:x*along*speed-y*across*.58,y:y*along*speed+x*across*.58};
  }
  if(flight.side){
   const sign=flight.direction==='e'?1:-1;
   const x=dx*(dx*sign>0?.83:.92);
   return {x,y:dy-x*sign*.88/flight.w};
  }
  const sign=flight.direction==='n'?-1:1;
  return {x:dx,y:dy*(dy*sign>0?.68:.83)};
 }
 return {straight,spiral,wideSpiral,bend,connecting,sections,touches,footprint,sample,middle,motion};
})();
