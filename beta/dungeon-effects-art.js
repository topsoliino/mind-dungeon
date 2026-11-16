/* Fixed-resolution pixel frames for ground effects, cast tells and impacts. */
window.DungeonEffectsArt = (() => {
 'use strict';
 function paint(type,frame){
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d');
  const pixel=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
  function shape(points,color){
   const rows=points.map(p=>p[1]);
   for(let y=Math.min(...rows);y<Math.max(...rows);y++){
    const bounds=[];
    for(let i=0;i<points.length;i++){
     const [x1,y1]=points[i],[x2,y2]=points[(i+1)%points.length],m=y+.5;
     if(m>=Math.min(y1,y2)&&m<Math.max(y1,y2))bounds.push(x1+(m-y1)*(x2-x1)/(y2-y1));
    }
    bounds.sort((a,b)=>a-b);
    for(let i=0;i+1<bounds.length;i+=2)pixel(bounds[i],y,Math.round(bounds[i+1])-Math.round(bounds[i]),1,color);
   }
  }
  const ice=type==='ice'||type==='ice-tell';
  if(ice){
   const active=type==='ice',rim=active?'#5f91a9':'#537f9699';
   const edge=[[3,23],[9,13],[19,8],[39,7],[51,12],[60,23],[62,36],[55,49],[42,57],[21,56],[9,51],[3,41]];
   shape(edge,active?'#172a36dc':'#21394fb0');
   shape([[5,24],[13,14],[27,9],[40,10],[51,16],[58,26],[59,36],[50,47],[39,54],[24,53],[12,47],[6,38]],rim);
   shape([[9,26],[17,16],[29,13],[40,15],[50,20],[55,28],[54,38],[46,46],[37,50],[24,48],[13,43],[9,34]],active?'#294e66':'#305066b0');
   shape([[14,31],[20,22],[29,24],[36,17],[48,24],[49,37],[41,43],[32,45],[22,42],[16,38]],active?'#59849b':'#3e6b86a0');
   for(const [x,y] of [[14,26],[45,28],[29,40],[43,44],[22,22],[17,43]])pixel(x,y,5,1,'#c2eef6a8');
   for(const [a,b,d] of [[[9,35],[22,30],[28,34]],[[27,14],[30,25],[26,30]],[[53,30],[40,37],[35,34]],[[34,50],[30,40],[34,35]]]){
    shape([a,b,d,[d[0],d[1]+2],[b[0],b[1]+2]],'#afe7ef');
   }
   if(active){
    const crystals=[[16,40,7,14],[27,47,9,20],[40,43,8,16],[48,34,6,12],[20,29,6,12]];
    for(const [x,y,w,h] of crystals){
     const rise=h+((x+frame)%3)-1;
     shape([[x-w,y],[x-w+2,y-rise+7],[x+1,y-rise],[x+5,y-rise+6],[x+w,y],[x+2,y+4]],'#2b4c6a');
     shape([[x-w+2,y-1],[x+1,y-rise+2],[x+1,y+1]],'#a7e1ee');
     shape([[x+1,y-rise+2],[x+w-1,y-1],[x+1,y+1]],'#5eacc7');
     pixel(x,y-rise+2,2,4,'#e2faf3');
    }
   }
   for(let i=0;i<6;i++){
    const x=13+(i*11+frame*3)%39,y=13+(i*7+frame*2)%38;
    if((frame+i)%3!==0){pixel(x-2,y,5,1,'#defff0b8');pixel(x,y-2,1,5,'#defff0b8');}
   }
  }else if(type==='shadow'){
   // Horizontal ribbon tile; rotated to follow the actual dash.
   shape([[0,15],[12,10],[24,13],[36,8],[48,14],[63,11],[64,51],[50,53],[38,48],[25,56],[13,51],[0,55]],'#2619366a');
   shape([[0,20],[11,16],[24,19],[36,13],[49,20],[64,17],[64,46],[50,48],[37,42],[25,50],[12,45],[0,49]],'#23162ee8');
   shape([[0,28],[13,23],[22,25],[34,18],[47,25],[64,23],[64,41],[49,42],[34,37],[20,43],[9,38],[0,42]],'#452858');
   shape([[0,31],[12,29],[24,33],[36,25],[47,32],[64,29],[64,34],[50,37],[38,30],[24,39],[10,34],[0,36]],'#8b52a8');
   shape([[0,32],[12,31],[23,35],[37,26],[48,34],[64,31],[48,36],[37,28],[23,37],[12,33]],'#c987dcb8');
   for(let i=0;i<7;i++){
    const x=(i*13+frame*5)%63,y=12+(i*7+frame*2)%40;
    pixel(x,y,2+(i%3),1,i%2?'#e199d9a8':'#714c9c');
   }
  }else if(type==='web-shot'){
   for(const [x,y] of [[14,23],[22,16],[35,16],[47,23],[48,36],[39,46],[25,47],[16,39]]){
    const dx=x-32,dy=y-32;
    shape([[32,31],[x,y],[x+2,y+2],[32+Math.sign(dx),33+Math.sign(dy)]],'#aaa09a');
   }
   shape([[19,29],[25,20],[37,21],[45,29],[44,37],[34,44],[24,40],[18,34]],'#7e6f78');
   shape([[21,29],[28,24],[37,24],[42,30],[39,38],[28,40],[22,35]],'#d7cbb3');
   pixel(25+frame%3,28,10,3,'#f4e9d2');pixel(28,34,8,2,'#fbf3de');
  }else if(type==='burst'){
   for(let i=0;i<13;i++){
    const a=i*2.4,d=4+frame*(3+i%3),x=32+Math.cos(a)*d,y=32+Math.sin(a)*d;
    const size=Math.max(1,5-(frame>>1));
    const tint=['#d3ad70','#8a5050','#493149','#b5bb72'][i%4];
    shape([[Math.round(x),Math.round(y-size)],[Math.round(x+size),Math.round(y)],[Math.round(x),Math.round(y+size)],[Math.round(x-size),Math.round(y)]],tint);
    if(frame<4)pixel(x,y,2,2,'#e7bf9a');
   }
  }else{
   const palettes={
    charge:['#775334','#bd8b50','#f1cd81'],rift:['#40254e','#985bb2','#e0a7ec'],
    web:['#57505b','#aea29e','#f2e5cc'],reap:['#764039','#bc6654','#f8b786'],
    grab:['#44543b','#8d9058','#d8bd7d'],bite:['#4c5838','#9fa067','#e8ce83']
   };
   const [low,mid,high]=palettes[type];
   const shift=frame%3;
   if(type==='reap'||type==='grab'||type==='bite'){
    for(const spread of (type==='bite'?[0]:[-10,0,10])){
     shape([[3,32+spread+shift],[18,20+spread],[45,17+spread],[59,22+spread],[47,25+spread],[22,26+spread],[8,34+spread]],low+'bb');
     shape([[6,31+spread],[21,23+spread],[43,20+spread],[55,22+spread],[43,23+spread],[21,25+spread]],mid);
     pixel(38+frame,21+spread,8,1,high);
    }
   }else{
    shape([[1,29],[42,29],[42,18],[62,32],[42,46],[42,35],[1,35]],low+'ca');
    shape([[3,31],[46,31],[46,23],[58,32],[46,41],[46,33],[3,33]],mid);
    for(let x=6+shift*4;x<56;x+=12)pixel(x,31,6,2,high);
   }
  }
  return c;
 }
 const types=['ice','ice-tell','shadow','burst','charge','rift','web','web-shot','reap','grab','bite'];
 const frames=Object.fromEntries(types.map(type=>[type,Array.from({length:6},(_,i)=>paint(type,i))]));
 return {frames};
})();
