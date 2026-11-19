window.DungeonBossArt=(()=>{
'use strict';
const make=(w,h,paint)=>{
 const c=document.createElement('canvas');c.width=w;c.height=h;
 const g=c.getContext('2d'),rect=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h);};
 paint(g,rect);return c;
};
const faces=[
 {hair:'#bfc3ce',shadow:'#697184',coat:'#b5d3d3',tie:'#613b64',skin:'#d6a38a'},
 {hair:'#2e2738',shadow:'#564455',coat:'#d4c6ca',tie:'#85394d',skin:'#cf9a7b'},
 {hair:'#754f40',shadow:'#453039',coat:'#bfcba8',tie:'#75552d',skin:'#e3ae86'}
];
const people=faces.map((f,i)=>Array.from({length:6},(_,frame)=>make(64,64,(g,r)=>{
 const bob=frame%3===1?1:0,step=[0,2,3,0,-2,-3][frame];
 g.fillStyle='#17102085';g.beginPath();g.ellipse(31,47,22,8,0,0,2*Math.PI);g.fill();
 g.translate(0,bob);
 r(19,39,9,12+step,'#201c2b');r(34,39,9,12-step,'#201c2b');
 r(17,49+step,12,5,'#211b25');r(34,49-step,12,5,'#211b25');
 r(16,25,31,21,'#252535');r(17,25,30,16,f.coat);r(19,39,25,7,'#818799');
 r(11,27,11,12,'#292637');r(12,27,10,9,f.coat);r(12,35,7,4,f.skin);
 r(42,28,12,12,'#282638');r(44,28,9,9,f.coat);r(46,35,7,5,f.skin);
 r(24,27,17,15,'#e3e1d6');r(29,27,5,13,f.tie);r(20,25,6,14,'#f5eddf');r(38,26,5,14,'#999ba5');
 r(20,9,23,17,'#26222c');r(22,8,19,16,f.skin);r(22,18,18,5,'#a36d62');r(24,18,14,4,f.skin);
 r(19,9,4,10,f.shadow);r(21,6,19,5,f.hair);r(23,5,13,3,f.hair);r(37,9,5,8,f.hair);
 if(i===1){r(20,6,19,6,f.hair);r(18,9,7,9,f.hair);r(25,20,10,2,f.hair);}
 if(i===2){r(19,8,6,9,f.shadow);r(25,20,12,3,f.hair);r(28,22,8,2,f.hair);}
 r(24,13,5,3,'#33313c');r(33,13,5,3,'#33313c');r(26,13,2,1,'#c9d9df');r(33,13,2,1,'#c9d9df');
 if(i===0){r(23,12,16,1,'#373d4d');r(28,15,6,1,'#373d4d');}
 r(48,12,5,35,'#232737');r(49,10,3,36,'#98acaf');r(48,11,5,4,'#577680');
 r(48,6,5,5,'#78e7e7');r(49,5,3,5,'#ddffff');
 })));
const dualPeople=people.map(frames=>frames.map(frame=>make(64,64,(g,r)=>{
 g.drawImage(frame,0,0);r(7,11,5,36,'#232737');r(8,7,3,37,'#98acaf');r(7,5,5,6,'#78e7e7');r(8,4,3,4,'#ddffff');
})));
const gestures=people.map((frames,i)=>Object.fromEntries(['plant','raise','thrust'].map(kind=>[kind,make(64,64,(g,r)=>{
 g.drawImage(frames[0],0,0);g.clearRect(47,3,8,36);
 r(44,28,7,7,faces[i].coat);r(47,28,6,4,faces[i].skin);
 if(kind==='thrust'){
  r(37,31,25,5,'#232737');r(39,32,23,2,'#98acaf');r(58,31,5,4,'#aef9f1');
 }else{
  const x=kind==='raise'?51:49,y=kind==='raise'?3:16;
  r(x,y,5,36,'#232737');r(x+1,y+2,3,34,'#98acaf');
  r(x,y,5,5,kind==='raise'?'#d8ffff':'#9edbdf');
 }
})])));
const gate=make(58,198,(_,r)=>{
 r(0,0,58,198,'#271e28');
 r(6,4,46,190,'#151824');r(9,7,40,184,'#252f3a');
 for(const x of [11,21,31,41]){
  r(x,6,4,182,'#727d86');r(x,6,1,182,'#bad0cf');
  r(x,187,3,4,'#939c9d');r(x+1,191,1,3,'#b1b5ba');
 }
 for(const y of [7,65,125,181]){r(9,y,40,5,'#766555');r(9,y,40,2,'#a3927a');}
 for(const x of [0,49]){r(x,0,9,198,'#40363a');r(x+2,0,3,198,'#7c6860');}
 r(22,93,14,14,'#965641');r(25,95,8,8,'#ed9474');r(28,98,3,3,'#fff4c5');
});
const props=Array.from({length:7},(_,i)=>make(104,90,(g,r)=>{
 g.fillStyle='#1e192259';g.beginPath();g.ellipse(52,69,46,13,0,0,2*Math.PI);g.fill();
 r(13,43,77,26,'#251e29');r(17,43,70,16,'#745246');r(17,57,8,13,'#47343c');r(79,57,8,13,'#47343c');r(14,41,77,5,'#be8a61');
 if(i%3===0){
  r(24,13,55,29,'#232833');r(26,15,51,26,'#5e7a79');r(28,18,47,21,'#373e4b');
  for(let x=31;x<76;x+=6)r(x,17,2,23,'#9ab0ad');
  r(59,25,13,3,'#bc9b59');r(66,22,3,6,'#dec67b');r(31,34,16,5,'#674837');
 }else if(i%3===1){
  r(36,9,32,31,'#26313e');r(38,11,28,22,'#659390');r(40,13,24,8,'#83c3b8');
  for(let x=42;x<65;x+=5)r(x,23+(x%3),3,6,'#ad8052');
  r(40,32,24,6,'#272c3d');r(48,39,7,5,'#d6a967');
 }else{
  r(23,25,53,16,'#3d4248');r(24,23,51,3,'#9baba8');r(29,30,43,6,'#28393a');
  for(let x=30;x<72;x+=9)r(x,31,4,4,x%2===0?'#8be8d1':'#d37469');
  g.strokeStyle='#51465c';g.lineWidth=3;g.beginPath();g.moveTo(26,34);g.bezierCurveTo(4,36,18,74,56,72);g.stroke();
 }
}));
const vent=make(40,27,(_,r)=>{
 r(5,7,30,16,'#2a212a');r(7,10,26,11,'#110f19');
 r(5,7,30,3,'#8c7470');r(6,20,28,3,'#5d494e');
 for(let x=8;x<34;x+=5)r(x,11,2,8,'#4a414e');
});
const rabbit=make(64,64,(_,r)=>{
 r(29,11,6,8,'#b3874f');r(27,8,10,4,'#e8c384');
 r(16,20,32,36,'#6a463c');r(20,18,24,40,'#c69b66');r(21,22,22,30,'#443548');
 r(26,23,5,13,'#f7e8dc');r(34,20,5,15,'#f2e8de');r(24,34,17,13,'#fff3e0');
 r(36,39,2,2,'#624650');r(39,42,3,2,'#d99499');
});
function ui(rules){
 const effects=document.createElement('canvas'),hud=document.createElement('section'),intro=document.createElement('section');
 effects.id='boss-effects';effects.hidden=true;effects.setAttribute('aria-hidden','true');
 hud.id='boss-hud';hud.hidden=true;hud.setAttribute('aria-label',rules.name);
 intro.id='boss-intro';intro.hidden=true;
 intro.innerHTML='<h2 class="boss-title"></h2><div class="boss-lineup"></div><div class="boss-subtitle" aria-live="polite"><strong></strong><span></span></div>';
 intro.querySelector('h2').textContent=rules.name;
 for(const frames of people){
  const img=document.createElement('img');img.src=frames[0].toDataURL();img.alt='';intro.querySelector('.boss-lineup').append(img);
 }
 const subtitle=intro.querySelector('.boss-subtitle');
 const title=document.createElement('h2');title.textContent=rules.name;
 const phase=document.createElement('p');hud.append(title,phase);
 const meters=rules.scientists.map(name=>{
  const row=document.createElement('div');row.className='boss-health';
  const label=document.createElement('span');label.textContent=name;
  const meter=document.createElement('meter');meter.min=0;meter.max=1;meter.setAttribute('aria-label',name);
  row.append(label,meter);hud.append(row);return {row,meter};
 });
 document.body.append(effects,hud,intro);
 const g=effects.getContext('2d');
 const circle=(x,y,r)=>{g.moveTo(x+r,y);g.arc(x,y,r,0,Math.PI*2);};
 const lightning=(from,to,seed)=>{
  g.beginPath();g.moveTo(from.x,from.y);
  for(let i=1;i<8;i++){
   const t=i/8;g.lineTo(from.x+(to.x-from.x)*t+Math.sin(seed+i*42)*12,from.y+(to.y-from.y)*t+Math.cos(seed+i*17)*10);
  }
  g.lineTo(to.x,to.y);g.stroke();
 };
 function paint(arena,battle,scrollX,scrollY,w,h,dpr){
  if(effects.width!==Math.round(w*dpr)||effects.height!==Math.round(h*dpr)){effects.width=Math.round(w*dpr);effects.height=Math.round(h*dpr);}
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,effects.width,effects.height);
  g.setTransform(dpr,0,0,dpr,-scrollX*dpr,-scrollY*dpr);
  const time=battle.time;
  g.save();g.beginPath();circle(arena.x,arena.y,arena.radius);g.clip();
  if(battle.rain){
   for(const p of arena.puddles){
    const glow=g.createRadialGradient(p.x,p.y,5,p.x,p.y,p.rx);
    glow.addColorStop(0,'#346c8877');glow.addColorStop(.72,'#33667878');glow.addColorStop(1,'#65bfd300');
    g.save();g.translate(p.x,p.y);g.scale(1,p.ry/p.rx);g.translate(-p.x,-p.y);
    g.fillStyle=glow;g.beginPath();circle(p.x,p.y,p.rx);g.fill();
    for(let i=0;i<3;i++){
     const phase=(time*1.5+i/3)%1;
     g.strokeStyle='rgba(183,237,242,'+(.34*(1-phase))+')';g.lineWidth=1.2;
     g.beginPath();circle(p.x+(i-1)*20,p.y+i*6,5+phase*25);g.stroke();
    }
    g.restore();
   }
  }
  for(const m of battle.cues){
   const hot=time>=m.hit;
   const alpha=hot?Math.max(.15,1-(time-m.hit)/.46):.38+.23*Math.sin(time*16);
   g.globalAlpha=alpha;
   g.strokeStyle=hot?'#f9f5ff':'#9de6f6';g.fillStyle=hot?'#b7edff':'#6298b542';g.lineWidth=hot?4:2;
   if(m.kind==='triangle'&&m.points.length===3){
    const color=m.outside?'#6dbff8':'#f07175';
    const path=()=>{g.moveTo(m.points[0].x,m.points[0].y);for(const p of m.points.slice(1))g.lineTo(p.x,p.y);g.closePath();};
    g.fillStyle=color+(hot?'99':'69');g.strokeStyle=color;
    g.beginPath();if(m.outside)circle(arena.x,arena.y,arena.radius);path();g.fill('evenodd');
    g.beginPath();path();g.stroke();
    for(const p of m.points){
     g.fillStyle='#222225';g.fillRect(Math.round(p.x-4),Math.round(p.y-14),8,18);
     g.fillStyle=color;g.fillRect(Math.round(p.x-4),Math.round(p.y-17),8,5);
     if(hot)lightning({x:p.x,y:p.y-23},p,time*45);
    }
   }else if(m.from){
    g.beginPath();g.moveTo(m.from.x,m.from.y);g.lineTo(m.to.x,m.to.y);
    g.lineWidth=hot?m.width:m.width*.6;
    g.strokeStyle=hot?'#73ddf37a':'#82abfc77';g.stroke();
    g.lineWidth=hot?4:2;g.strokeStyle=hot?'#effcff':'#a1d5e8';
    if(hot)lightning(m.from,m.to,time*55);
   }else{
    g.beginPath();circle(m.x,m.y,m.r);g.stroke();
    if(hot&&m.kind==='storm'){g.fill();g.lineWidth=5;lightning({x:m.x-26,y:m.y-210},{x:m.x,y:m.y},m.bolt+time*37);}
   }
  }
  g.restore();g.globalAlpha=1;
 }
 function show(arena,battle,enemies,local,scrollX,scrollY,w,h,dpr){
  const inArena=arena&&local&&battle;
  const introOn=inArena&&battle.phase==='intro';
  intro.hidden=!introOn;
  if(introOn){
   const i=battle.time>=rules.lines[2].at?2:battle.time>=rules.lines[1].at?1:0;
   if(intro.dataset.speaker!==String(i)){
    intro.dataset.speaker=i;subtitle.querySelector('strong').textContent=rules.lines[i].name;
    subtitle.querySelector('span').textContent=rules.lines[i].text;
   }
  }else delete intro.dataset.speaker;
  hud.hidden=!(inArena&&['waves','fight'].includes(battle.phase));
  if(!hud.hidden){
   const label=battle.phase==='waves'?'Rattenwelle '+Math.max(1,battle.waves)+' / 3':battle.rain?'Regen · Blitz breitet sich in Pfützen aus':'';
   if(phase.textContent!==label)phase.textContent=label;
   for(const [i,{row,meter}] of meters.entries()){
    const e=enemies.find(e=>e.scientist===i&&e.bossRole==='scientist');
    meter.value=e?Math.max(0,e.hp/e.max):0;row.classList.toggle('warded',Boolean(e?.warded));
   }
  }
  effects.hidden=!(inArena&&(battle.rain||battle.cues.length));
  if(!effects.hidden)paint(arena,battle,scrollX,scrollY,w,h,dpr);
 }
 return {show};
}
return {people,dualPeople,gestures,gate,props,vent,rabbit,ui};
})();
