/* Cached frames for ground effects, cast tells and impacts. */
window.DungeonEffectsArt = (() => {
 'use strict';
 function paint(type,frame){
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d');
  const pixel=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
  function shape(points,color){
   const rows=points.map(p=>p[1]);
   for(let y=Math.floor(Math.min(...rows));y<Math.ceil(Math.max(...rows));y++){
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
  }else if(type==='altar'){
   const ring=[26,20,14,8,4,13][frame];
   for(let i=0;i<12;i++){
    const a=i*Math.PI/6,x=32+Math.cos(a)*ring,y=30+Math.sin(a)*ring*.76;
    const col=frame<4?(i%2?'#c8c1f0':'#8fbdc0'):'#ffdf99';
    pixel(x,y,3,3,col);pixel(x+2,y+1,1,1,'#f6eded');
   }
   const size=[2,5,8,11,15,5][frame];
   shape([[32,29-size],[34+size,30],[32,32+size],[30-size,30]],'#80b5c1a0');
   shape([[32,31-size],[34+size/2|0,30],[32,31+size],[30-size/2|0,30]],'#fbebbc');
   pixel(31,22,2,17,'#fff2db');
  }else if(type==='arrow'||type==='poison-arrow'||type==='frost-arrow'){
   const poisonous=type==='poison-arrow',frost=type==='frost-arrow';
   if(frost)for(let i=0;i<10;i++)pixel(4+i*4,31+((i*7+frame)%9)-4,2+(i%2),2,i%2?'#a0e5f9aa':'#d2f7ff90');
   if(poisonous)for(let i=0;i<9;i++)pixel(4+i*3,31+((i*5+frame)%7)-3,3,2,i%2?'#71944daa':'#cadb9270');
   pixel(5,30,50,4,'#292420');pixel(6,31,49,2,'#c29566');
   shape([[49,27],[62,32],[49,37]],poisonous?'#9eba68':frost?'#82cced':'#d9d1b7');
   pixel(50,31,7,1,poisonous?'#dde5a1':frost?'#e8fbff':'#fff1d4');
   shape([[3,26],[14,28],[17,32],[14,36],[3,38],[7,32]],'#b49672');
  }else if(type==='web-shot'){
   for(const [x,y] of [[14,23],[22,16],[35,16],[47,23],[48,36],[39,46],[25,47],[16,39]]){
    const dx=x-32,dy=y-32;
    shape([[32,31],[x,y],[x+2,y+2],[32+Math.sign(dx),33+Math.sign(dy)]],'#aaa09a');
   }
   shape([[19,29],[25,20],[37,21],[45,29],[44,37],[34,44],[24,40],[18,34]],'#7e6f78');
   shape([[21,29],[28,24],[37,24],[42,30],[39,38],[28,40],[22,35]],'#d7cbb3');
   pixel(25+frame%3,28,10,3,'#f4e9d2');pixel(28,34,8,2,'#fbf3de');
  }else if(['critical-hit','counter-hit','fatal-hit','level-rise'].includes(type)){
   const fatal=type==='fatal-hit',level=type==='level-rise';
   const glow=fatal?'#ed5972':type==='counter-hit'?'#63cfbf':level?'#9bd8be':'#e4a35d',bright=fatal?'#ffe2b4':'#fff0b9';
   for(let i=0;i<(fatal?16:10);i++){
    const a=i*Math.PI*2/(fatal?16:10),dist=7+4*frame+(i%3)*2;
    const x=32+Math.cos(a)*dist,y=34+Math.sin(a)*dist*(level?.64:1);
    const d=Math.max(1,4-(frame>>1));
    shape([[x-d,y],[x,y-d*2],[x+d,y],[x,y+d*2]],i%2?glow:bright);
   }
   if(frame<=2)shape([[31,8+frame*4],[36,24],[55-frame*3,30],[38,36],[31,52-frame*3],[27,35],[11+frame*3,30],[27,25]],glow);
   if(frame<=1)shape([[31,13],[34,26],[45,30],[34,34],[31,44],[28,33],[18,30],[28,27]],bright);
   if(level)for(let i=0;i<5;i++)pixel(21+i*5,51-7*frame-i%3*6,2,8,bright);
   if(fatal&&frame<4){pixel(27-frame*2,29,12+frame*4,3,bright);pixel(31,20-frame*2,2,22+frame*4,bright);}
  }else if(type==='waterfall-flow'){
   pixel(0,10,64,47,'#305e5b');pixel(0,49,64,11,'#487973');
   for(let i=0;i<13;i++){
    const x=i*5,width=3+(i*7)%7,phase=(frame*7+i*17)%39;
    const outline=2+i%3;
    pixel(x,4+i%3,width,48,'#578e85');
    pixel(x+outline,13,width*.56,35,'#77aca0');
    pixel(x+outline,12+phase,Math.max(1,width*.36),11,'#c9e9d3');
    pixel(x,48+i%5,3+i%4,5,'#a4d6c2');
   }
   for(let i=0;i<15;i++){
    const x=(i*11+frame*4)%64,y=50+(i*5+frame)%12;
    pixel(x,y,4+i%4,1+i%2,i%3?'#d9f1d8':'#7fb19d');
    if(i%3===0)pixel(x,47-(frame+i)%7,2,2,'#ecf6e6');
   }
   pixel(0,7,64,3,'#b1d4b6');
  }else if(type==='lion-rake'||type==='lion-tell'){
   const warning=type==='lion-tell';
   for(let i=0;i<3;i++){
    const y=17+i*11,shift=frame*2;
    shape([[2,y+20],[15,y+8],[35,y+1],[57,y-4+shift],[63,y+2+shift],[48,y+6+shift],[27,y+10],[13,y+16]],
     warning?'#bd8e515e':'#ab654cbd');
    if(!warning)shape([[10,y+15],[27,y+5],[54,y+shift-1],[59,y+shift],[49,y+shift+4],[27,y+8]],'#ffe0a3');
   }
  }else if(['blood-burst','meal-glow','potion-burst','potion-coat'].includes(type)){
   const blood=type==='blood-burst',meal=type==='meal-glow',coat=type==='potion-coat';
   const colors=blood?['#8b293f','#d24e61','#f48f84']:meal?['#979c57','#d7c778','#ffdc91']:['#8276b2','#bb9ace','#ead4ed'];
   for(let i=0;i<(blood?23:15);i++){
    const a=Math.PI*2*i/(blood?23:15)+frame*.14;
    const radius=coat?16+i%4:6+frame*4+i%4;
    const x=32+Math.cos(a)*radius,y=31+Math.sin(a)*radius*(coat?.84:.67)-(coat?(i+frame*2)%8:frame);
    const size=coat?2:Math.max(1,4-frame/2);
    if(blood)shape([[x,y-size*2],[x+size,y],[x,y+size],[x-size,y]],colors[i%3]);
    else{pixel(x,y,1,size+2,colors[i%3]);pixel(x-1,y+1,3,1,colors[i%3]);}
   }
   if(!coat&&frame<3)
    shape([[31,12+frame*4],[37,28],[49,32],[37,35],[31,48],[27,35],[16,32],[27,28]],colors[1]);
  }else if(type==='charge-aura'){
   const full=frame>=4;
   for(let i=0;i<22;i++){
    const a=Math.PI*2*i/22+frame*.15;
    const x=32+Math.cos(a)*(26-frame*1.4),y=35+Math.sin(a)*(16-frame*.6);
    if(full||i%3!==0)pixel(x,y,full?3:2,full?3:2,i%3?'#cd9c62':'#ffedb6');
   }
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4+frame*.55,x=32+Math.cos(a)*(10+frame),y=34+Math.sin(a)*(10+frame);
    pixel(x,y,1+(i%2),2,i%2?'#d39a66':'#ffe6a6');
   }
   if(full)shape([[32,8],[34,24],[45,29],[34,32],[32,48],[30,32],[19,29],[30,24]],'#fff3beab');
  }else if(type==='arcane-shot'){
   const sway=frame%3-1;
   shape([[3,31],[20,24-sway],[36,21],[51,24],[59,32],[48,42],[33,43],[20,38+sway]],'#7650a9a8');
   shape([[13,32],[30,25],[43,23],[55,32],[44,39],[30,38]],'#ae80e8');
   shape([[26,32],[40,25],[50,31],[43,37]],'#d9c8ff');
   pixel(38,31,10,2,'#f8eaff');pixel(45,29,3,5,'#f8eaff');
   for(let i=0;i<7;i++)pixel(6+(i*13+frame*7)%42,20+(i*17+frame*3)%24,2,1,'#c5a2fb');
  }else if(type==='counter-mark'){
   const shift=frame%3;
   shape([[32,14-shift],[47,28],[32,43+shift],[17,28]],'#73daca');
   shape([[32,18-shift],[43,28],[32,39+shift],[21,28]],'#25434a');
   shape([[32,22],[39,28],[32,35],[25,28]],'#f4efbf');
  }else if(type==='charged-swing'){
   const offset=frame*2;
   shape([[8,19],[27,8],[46,13],[60,29],[56,43],[41,57],[15,57],[34,46],[45,33],[40,22],[25,17]],
    frame<3?'#e7a764b8':'#c5875c75');
   shape([[13,15+offset],[29,11],[48,16],[58,29],[55,37],[38,50],[47,33],[43,22],[28,16]],'#fff0b9');
   for(let i=0;i<7;i++)pixel(28+i*4,18+(i*19+frame*7)%32,2,2,'#ffe6a8');
  }else if(['bat-warning','bat-beam','bat-lightning-warning','storm-bolt','storm-mark'].includes(type)){
   const ice=type==='bat-beam'||type==='bat-lightning-warning'||type.startsWith('storm');
   const tone=ice?'#78bfe9':'#df804b',hot=ice?'#d9f5ff':'#ffe2a4';
   if(type==='storm-mark'){
    for(let i=0;i<12;i++){const a=i*Math.PI/6;pixel(31+Math.cos(a)*25,31+Math.sin(a)*19,4,2,i%2?tone:hot);}
    pixel(27,30,11,2,hot);pixel(31,26,2,10,tone);
   }else if(type==='storm-bolt'){
    shape([[39,1],[44,1],[29,22],[38,24],[30,43],[33,47],[21,63],[25,44],[21,43],[29,26],[22,25]],tone);
    shape([[39,2],[41,2],[27,24],[34,24],[24,48],[25,44],[24,43],[31,25],[24,25]],hot);
    for(let i=0;i<5;i++)pixel(10+i*9,49+i%3*4,5,1,hot);
   }else if(type==='bat-lightning-warning'){
    for(let x=frame*2;x<64;x+=8){
     const y=30+(x%3===0?2:0);
     pixel(x,y,5,1,'#bcdbf7ba');pixel(x+1,y+1,3,2,'#6979e0a0');
    }
    pixel(58,28,2,9,'#b7c8f2b3');
   }else if(type==='bat-warning'){
    shape([[1,31],[61,10],[63,11],[63,52],[60,53]],'#783a4160');
    for(let x=4+frame%3;x<62;x+=6){
     const spread=Math.round(x*.32);
     pixel(x,31-spread,4,1,'#e5a266ac');pixel(x,31+spread,4,1,'#e5a266ac');
    }
   }else{
    const arc=(points,color,width)=>{
     for(let i=1;i<points.length;i++){
      const [x0,y0]=points[i-1],[x1,y1]=points[i],n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));
      for(let step=0;step<=n;step++){
       const x=x0+(x1-x0)*step/n,y=y0+(y1-y0)*step/n;
       pixel(x,y-Math.floor(width/2),1,width,color);
      }
     }
    };
    const spine=[[0,32]];
    for(let i=1;i<9;i++)spine.push([i*7,32+((i*i*3+i*13+frame*(11+i*2))%19)-9]);
    spine.push([63,32+(frame%3-1)*7]);
    arc(spine,'#624dc453',17);arc(spine,'#958cf6a0',10);arc(spine,'#81c5f5',5);
    for(let i=1;i<8;i++){
     const [x,y]=spine[i],dir=(i+frame)%2?1:-1;
     if((i+frame)%3!==0)arc([[x,y],[x+4,y+8*dir],[x+7,y+6*dir],[x+10,y+18*dir]],'#a0b7fdcb',2);
     pixel(x+3,y+dir*(11+i%5),2,3,'#badeff');
    }
    arc(spine,'#e7f8ff',2);
    shape([[0,24],[6,29],[11,32],[6,35],[0,40],[2,32]],'#d7fbff');
   }
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
    web:['#57505b','#aea29e','#f2e5cc'],bow:['#65583c','#ad9568','#e9d3a4'],crossbow:['#54433a','#a28056','#ded0aa'],reap:['#764039','#bc6654','#f8b786'],
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
 const types=['ice','ice-tell','shadow','burst','charge','rift','web','web-shot','reap','grab','bite','bow','crossbow','arrow','poison-arrow','frost-arrow','arcane-shot','waterfall-flow','lion-rake','lion-tell','blood-burst','meal-glow','potion-burst','potion-coat','altar','critical-hit','counter-hit','fatal-hit','level-rise','charge-aura','counter-mark','charged-swing','bat-warning','bat-flame','bat-beam','bat-lightning-warning','storm-bolt','storm-mark'];
 const flameFrames=24;
 const spread=t=>4+t*52;
 const emberSeeds=Array.from({length:32},(_,i)=>({phase:(i*.61803399)%1,side:Math.sin(i*53.17),turn:i*2.9}));
 function paintFlame(frame){
  const canvas=document.createElement('canvas');canvas.width=192;canvas.height=144;
  const g=canvas.getContext('2d'),phase=frame/flameFrames,turn=phase*Math.PI*2,mid=72;
  for(let i=0;i<10;i++){
   const p=(phase+i*.37)%1,x=72+p*113,y=mid+Math.sin(turn+i*1.4)*spread(p)*.65-8*p;
   const radius=13+p*30,smoke=g.createRadialGradient(x,y,0,x,y,radius);
   smoke.addColorStop(0,'rgba(94,65,56,'+(.19*Math.sin(Math.PI*p))+')');
   smoke.addColorStop(1,'rgba(51,36,44,0)');
   g.fillStyle=smoke;g.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  function tongue(lane,length,shape,stops){
   const offset=t=>lane*spread(t)*.72+Math.sin(turn*2+t*9+lane*4)*spread(t)*.29;
   const tipY=mid+offset(1),bellyY=mid+offset(.58);
   const heat=g.createLinearGradient(0,mid,length,tipY);
   for(const [at,color] of stops)heat.addColorStop(at,color);
   g.fillStyle=heat;
   g.beginPath();g.moveTo(1,mid-2);
   g.bezierCurveTo(length*.19,mid-6,length*.42,bellyY-shape,length*.66,bellyY-shape*.72);
   g.bezierCurveTo(length*.83,bellyY-shape*.62,length*.92,tipY+shape*.24,length,tipY);
   g.bezierCurveTo(length*.86,tipY+shape*.72,length*.72,bellyY-shape*.02,length*.59,bellyY+shape*.48);
   g.bezierCurveTo(length*.39,bellyY+shape*.38,length*.22,mid+7,1,mid+2);
   g.fill();
  }
  for(let i=0;i<8;i++){
   const lane=(i-3.5)/3.7,wave=Math.sin(turn*2+i*2.2),length=149+(i%3)*12+wave*12;
   tongue(lane,length,12+(i%3)*4,[
    [0,'#ffe19ca0'],[.19,'#ffc2609b'],[.48,'#f77a2a85'],[.72,'#cc442562'],[.9,'#9e31234a'],[1,'#a42f2300']
   ]);
  }
  g.globalCompositeOperation='lighter';
  for(let i=0;i<4;i++){
   const lane=(i-1.5)*.35,length=95+i*14+Math.cos(turn*2+i*1.7)*11;
   tongue(lane,length,6+i*2,[
    [0,'#fff5da86'],[.20,'#ffe8a864'],[.47,'#ffc04a64'],[.76,'#f7661e49'],[1,'#f24f1600']
   ]);
  }
  const image=g.getImageData(0,0,192,144),pixels=image.data;
  for(let y=0;y<144;y++)for(let x=0;x<192;x++){
   const i=(y*192+x)*4;
   if(!pixels[i+3])continue;
   const flow=x*.064-turn*3,twist=y*.24+x*.05+Math.sin(flow)*1.3;
   const density=.5+.31*Math.sin(twist)+.19*Math.sin(x*.16-y*.41-turn*4);
   const breakup=Math.min(1,Math.max(0,(x-18)/148));
   pixels[i+3]*=1-breakup*(1-density)*.79;
   pixels[i+1]*=.84+.16*density;
  }
  g.putImageData(image,0,0);
  for(const {phase:seed,side,turn:curl} of emberSeeds){
   const age=(phase+seed)%1,x=26+age*159,y=mid+side*spread(age)+Math.sin(turn*2+curl)*age*9;
   const alpha=Math.sin(Math.PI*age)*(.7-age*.35),size=1.15-age*.55;
   g.strokeStyle='rgba(255,149,66,'+alpha*.63+')';g.lineWidth=size;
   g.beginPath();g.moveTo(x-4-age*6,y+side*2);g.lineTo(x,y);g.stroke();
   g.fillStyle='rgba(255,213,124,'+alpha+')';g.fillRect(x,y,size+1,size);
  }
  return canvas;
 }
 const frames=Object.fromEntries(types.map(type=>[type,type==='bat-flame'?Array.from({length:flameFrames},(_,i)=>paintFlame(i)):Array.from({length:6},(_,i)=>paint(type,i))]));
 return {frames};
})();
