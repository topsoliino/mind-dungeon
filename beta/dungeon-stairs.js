window.DungeonStairs=(()=>{
 'use strict';
 const lerp=(a,b,t)=>a+(b-a)*t;
 const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
 const middle=([a,b])=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
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
  const vertices=edges.flat(),xs=vertices.map(p=>p[0]),ys=vertices.map(p=>p[1]);
  const left=Math.floor(Math.min(...xs)),top=Math.floor(Math.min(...ys));
  return {x:left,y:top,w:Math.ceil(Math.max(...xs))-left,h:Math.ceil(Math.max(...ys))-top,
   edges,core:{x,y:y-.35},style:'sanctuary',curve:true};
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
 function sample(steps,x,y){
  let best=null,distance=Infinity;
  for(const [index,step] of steps.entries()){
   const {ax,ay,dx,dy}=step,norm=dx*dx+dy*dy;
   const t=clamp(((x-ax)*dx+(y-ay)*dy)/norm,0,1);
   const gap=(x-ax-dx*t)**2+(y-ay-dy*t)**2;
   if(gap<distance){distance=gap;best={index,t,dx,dy};}
  }
  return best;
 }
 function motion(flight,step,dx,dy){
  if(flight.curve){
   const span=Math.hypot(step.dx,step.dy),x=step.dx/span,y=step.dy/span;
   const along=dx*x+dy*y,across=dy*x-dx*y;
   const speed=along>0?.73:.86;
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
 return {straight,spiral,sections,touches,sample,middle,motion};
})();
