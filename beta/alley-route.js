(() => {
 'use strict';
 // Keep the handcrafted 4a route separate; generator mode owns its geometry instead.
 if(window.AlleyGenerator?.enabled){window.AlleyRoute=window.AlleyGenerator;return;}
 // Etappe 4a: layout anchors only. Etappe 4b will fill these rooms with set dressing.
 const entry=[11.76,1.06,14.50,2.57],archive=[14.12,-.52,19.62,6.48];
 const passage=[19.32,2.03,21.43,3.77],laboratory=[21.12,-.52,28.12,7.40];
 const seal=[20.18,2.03,20.49,3.77];
 const stations={knowledge:{at:[17.02,3.82]},lab:{at:[25.20,3.55]}};
 const encounters={archive:[[16.55,1.12],[18.02,5.03]],lab:[[23.22,1.30],[26.15,5.62]]};
 const zones=[
  {id:'entry',area:entry,material:'vault',name:'Torhalle'},
  {id:'archive',area:archive,material:'archive',name:'Archiv der Verstärkung'},
  {id:'passage',area:passage,material:'vault',name:'Versuchsgang'},
  {id:'lab',area:laboratory,material:'lab',name:'Behavioristen-Labor'}
 ];
 const walls=[
  {area:[11.77,1.02,14.49,1.10],height:80,tone:'vault',side:'north'},
  {area:[14.11,-.57,19.63,-.49],height:108,tone:'archive',side:'north'},
  {area:[14.07,-.51,14.15,1.06],height:108,tone:'archive',side:'west'},
  {area:[14.07,2.57,14.15,6.46],height:108,tone:'archive',side:'west'},
  {area:[21.10,-.57,28.11,-.49],height:112,tone:'lab',side:'north'},
  {area:[21.07,-.52,21.15,2.03],height:112,tone:'lab',side:'west'},
  {area:[21.07,3.77,21.15,7.39],height:112,tone:'lab',side:'west'}
 ];
 const materials={
  vault:{pitch:[.63,.44],colors:['#55556a','#606074','#646478','#4d5064'],edge:'#b2a4b0a8'},
  archive:{pitch:[.52,.52],colors:['#435e6c','#4c6772','#596e7c','#57727c','#69808b'],edge:'#a4baba98'},
  lab:{pitch:[.48,.48],colors:['#545a6a','#5f6674','#6d707f','#616979','#707986'],edge:'#b8b8bda2'}
 };
 const palettes={
  vault:['#4d5263','#323949','#898698','#a6a3ad'],
  archive:['#526b73','#364c5a','#96aab2','#b9c8c6'],
  lab:['#596977','#394853','#98abb0','#bfd0cc']
 };
 let unlocked=false;
 const includes=([u,v,r,b],x,y)=>x>=u&&x<=r&&y>=v&&y<=b;
 function extend(map){
  for(const zone of zones){map.art.ground.push({area:zone.area,material:zone.material});map.logic.walkable.push(zone.area);}
  map.art.routeWalls=walls;
  map.art.lighting.push({at:[17,2],height:51,radius:130,phase:2,tint:'#568ea17c'},
   {at:[25,2.1],height:61,radius:155,phase:.6,tint:'#6388a783'});
  map.art.atmosphere.push({at:[17.2,2.4],radius:125,phase:1.2},{at:[25.5,2.4],radius:160,phase:3.3});
  map.logic.stations.knowledge=stations.knowledge;
  map.logic.stations.lab=stations.lab;
  map.logic.encounter.archive=encounters.archive;
  map.logic.encounter.lab=encounters.lab;
  map.logic.waypoints.push([11.65,1.9],[13.25,1.87],[14.42,1.86],
   [15.4,1.84],[16.7,2.52],[18.56,2.69],[18.42,5.85],
   [15.3,5.78],[19.46,2.80],[19.94,2.83],[20.65,2.86],
   [21.57,2.86],[22.72,2.82],[25,2.76],[26.15,4.4]);
 }
 function blocked(u,v,r=0){
  return !unlocked&&u+r>=seal[0]&&u-r<=seal[2]&&v+r>=seal[1]&&v-r<=seal[3];
 }
 function areaAt(u,v){
  return [...zones].reverse().find(zone=>includes(zone.area,u,v))?.name??'Gasse der Forscher';
 }
 function lines(ctx,paths,color,width=1){
  ctx.beginPath();ctx.moveTo(...paths[0]);
  paths.slice(1).forEach(p=>ctx.lineTo(...p));
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();ctx.lineWidth=1;
 }
 function renderFloor(ctx,{project,polygon,line}){
  for(const zone of zones){
   const [u,v,r,b]=zone.area,edge=zone.material==='archive'?'#87abb2':zone.material==='lab'?'#c0a9a6':'#a4a1ae';
   const inset=.14,outline=[[u+inset,v+inset],[r-inset,v+inset],
    [r-inset,b-inset],[u+inset,b-inset],[u+inset,v+inset]].map(p=>project(...p));
   line(ctx,outline,edge+'9b',2);
   if(zone.id==='archive'||zone.id==='lab'){
    const x=(u+r)/2,y=(v+b)/2,d=zone.id==='lab'?1.12:.88;
    polygon(ctx,[[x-d,y],[x,y-d],[x+d,y],[x,y+d]].map(p=>project(...p)),
     zone.id==='lab'?'#353e5e':'#234452',edge+'d5');
    polygon(ctx,[[x-.48,y],[x,y-.48],[x+.48,y],[x,y+.48]].map(p=>project(...p)),
     zone.id==='lab'?'#9c8796':'#6c999b',edge);
    for(let i=0;i<4;i++){
     const a=i*Math.PI/2,p=project(x+Math.cos(a)*d*.7,y+Math.sin(a)*d*.7);
     ctx.beginPath();ctx.arc(p[0],p[1],2.5,0,Math.PI*2);
     ctx.fillStyle=edge;ctx.fill();
    }
   }
  }
  for(const [u,v,r,b] of [[14.11,1.10,14.43,2.54],[21.10,2.06,21.42,3.74]]){
   polygon(ctx,[project(u,v),project(r,v),project(r,b),project(u,b)],'#877783a6','#c7b1a1');
   for(let y=v+.20;y<b;y+=.22)line(ctx,[project(u,y),project(r,y)],'#323241ac');
  }
 }
 function renderWall(ctx,wall,{project,polygon,line}){
  const {area,height,tone,side}=wall,[u,v,r,b]=area;
  const [front,shade,top,edge]=palettes[tone];
  const bottom=[project(u,v),project(r,v),project(r,b),project(u,b)];
  const raised=[project(u,v,height),project(r,v,height),project(r,b,height),project(u,b,height)];
  polygon(ctx,[bottom[1],bottom[2],raised[2],raised[1]],front,'#252b3a');
  polygon(ctx,[bottom[2],bottom[3],raised[3],raised[2]],shade,'#252b3a');
  polygon(ctx,raised,top,edge);
  for(let z=16;z<height;z+=24){
   const x=side==='north'?r:u,yy=side==='north'?v:b;
   line(ctx,[project(u,v,z),project(x,yy,z)],'#263649',1.5);
   line(ctx,[project(u,v,z+1),project(x,yy,z+1)],'#d0c5bd43',.8);
  }
  const span=side==='north'?r-u:b-v;
  for(let t=.48;t<span;t+=.48){
   const a=side==='north'?[u+t,v]:[u,v+t],d=side==='north'?[u+t,b]:[r,v+t];
   line(ctx,[project(...a,1),project(...d,1)],'#b6b2b243',1);
   line(ctx,[project(...a,height-7),project(...d,height-7)],'#b6b2b243',.8);
  }
  if(span>3.3){
   const p=side==='north'?project((u+r)/2,v,height*.58):project(u,(v+b)/2,height*.58);
   const [x,y]=p,light=ctx.createRadialGradient(x,y,0,x,y,33);
   light.addColorStop(0,tone==='lab'?'#8cdbea91':'#d8b79892');
   light.addColorStop(1,'#ffffff00');ctx.fillStyle=light;ctx.fillRect(x-33,y-33,66,66);
   polygon(ctx,[[x-5,y],[x+5,y],[x+3,y+8],[x-3,y+8]],'#3b3846',edge);
   ctx.fillStyle=tone==='lab'?'#b3eeeb':'#f0d29d';ctx.fillRect(x-1,y+1,2,5);
  }
 }
 function renderSeal(ctx,{project,polygon,line}){
  const [u,v,r,b]=seal,x=(u+r)/2;
  for(const y of [v-.13,b+.13]){
   const q=[u-.16,y-.14,r+.16,y+.14],h=84;
   const a=[[q[0],q[1]],[q[2],q[1]],[q[2],q[3]],[q[0],q[3]]];
   polygon(ctx,[project(...a[1]),project(...a[2]),project(...a[2],h),project(...a[1],h)],'#586171','#333745');
   polygon(ctx,a.map(p=>project(...p,h)),'#a5a3ac','#c9b7b5');
  }
  for(let i=0;i<=8;i++){
   const vv=v+(b-v)*i/8;
   line(ctx,[project(x,vv,0),project(x,vv,75)],'#2c4856',3);
   line(ctx,[project(x+.01,vv,2),project(x+.01,vv,73)],'#8cc5c7',1);
  }
  for(const z of [12,66])line(ctx,[project(x,v,z),project(x,b,z)],'#a8c2bd',2);
  const [px,py]=project(x,(v+b)/2,42);
  polygon(ctx,[[px,py-15],[px+11,py],[px,py+15],[px-11,py]],'#648b92','#e9d5b6');
 }
 function renderProp(ctx,kind,u,v,{project,polygon,line,block}){
  if(kind==='knowledge'){
   block(ctx,[u-.26,v-.22,u+.26,v+.22],32,['#4a6472','#5b7882','#899b9e','#283746']);
   const p=project(u,v,35);
   polygon(ctx,[[p[0]-15,p[1]-3],[p[0]+2,p[1]-8],[p[0]+16,p[1]-3],[p[0],p[1]+4]],
    '#ccbfae','#aecac3');
   line(ctx,[[p[0]-4,p[1]-4],[p[0]+9,p[1]-4]],'#3c6e7b',1.6);
  }else if(kind==='apparatus'){
   block(ctx,[u-.4,v-.3,u+.4,v+.3],37,['#4e5663','#5b7280','#7c8d90','#2b3846']);
   const [x,y]=project(u,v,41);
   polygon(ctx,[[x-18,y-3],[x+8,y-8],[x+18,y-2],[x-9,y+4]],'#29424c','#d0b88f');
   for(let i=0;i<5;i++){ctx.fillStyle='#8cc6c8';ctx.fillRect(x-10+i*4,y-5,1.5,2);}
  }
 }
 window.AlleyRoute={
  materials,walls,zones,seal,stations,encounters,
  extend,areaAt,blocked,renderFloor,renderWall,renderSeal,renderProp,
  unlock(){unlocked=true;},isUnlocked(){return unlocked;}
 };
 window.AlleyRoute.extend(window.AlleyStudyMap);
})();