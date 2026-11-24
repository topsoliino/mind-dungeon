/* Level-design markers and procedural environment previews. Editor only.
 * Markers are not physical gameplay entities; the live generator must resolve
 * them through its authoritative item/enemy/site registries. */
(function(root){
'use strict';
const ENEMIES=['Anstürmer','Dunkelpriester','Spinne','Skelett','Frostgeist','Zombie','Schlange','Skelettbogenschütze','Armbrustzombie','Löwe','Löwin','Feuerfledermaus','Sturmfledermaus','Kleine Ratte','Elektrodenratte','Adler','Eiszombie','Armbrust-Eiszombie','Ork in weißer Robe','Ork in schwarzer Robe','Straßenhund'];
const ITEM_OPTIONS=[['weapon:hammer','Hammer'],['weapon:blade','Schwert'],['weapon:rapier','Rapier'],['weapon:dagger','Dolch'],['weapon:greatsword','Großschwert'],['weapon:bow','Bogen'],['weapon:staff','Zauberstab'],['weapon:farm-scythe','Bauernsense'],['ring:height','Ring der Höhe'],['ring:merchant','Händlerring'],['ring:madness','Ring des Wahnsinns'],['ring:avoidance','Ring der Vermeidung'],['ring:precision','Ring der Präzision'],['ring:brewer','Ring des Sudmeisters'],['food:bread','Brot'],['food:banana','Banane'],['food:chicken','Hühnchen'],['food:glucose','Traubenzucker'],['cup:cup','Becher']];
const defs=[
 ['focus-merchant','Händler','gameplay','merchant','H',1.2,1.2,1.3],
 ['focus-altar','Wissensaltar','gameplay','altar','?',1,1,1],
 ['focus-chest','Truhe','gameplay','chest','T',.9,.7,.6],
 ['focus-brew','Brauerei-Tisch','gameplay','brew','B',1.2,.85,.95],
 ['focus-soul','Seelencontainer','gameplay','soul','◇',.45,.45,.7],
 ['focus-enemy','Gegner-Spawn','gameplay','enemy','!',.55,.55,1],
 ['focus-next-level','Treppe zur nächsten Ebene','gameplay','next-level','↓',1.15,1.3,.15],
 ['mechanism-lever','Hebel · Fallgitter der nächsten Ebene','mechanisms','lever','↕',.38,.40,.85],
 ['mechanism-portcullis','Fallgitter · lokaler Test / Eingang','mechanisms','portcullis','▥',1.15,.24,1.95],
 ['mechanism-hatch','Falltür über Leiter nach unten','mechanisms','hatch','▣',1.05,1.05,.12],
 ['ceiling-chain','Hängende Eisenkette','ceiling','chain','⛓',.4,.4,2.2],
 ['ceiling-beam','Alter Deckenbalken','ceiling','beam','━',2,.24,2.25],
 ['ceiling-chandelier','Eiserner Kronleuchter','ceiling','chandelier','✦',.95,.95,2.1],
 ['ceiling-web','Spinnweben · Deckenecke','ceiling','web','◈',.95,.95,2.2],
 ['ceiling-cage','Hängender Eisenkäfig','ceiling','cage','▥',.65,.65,2.1],
 ['ceiling-collapse','Gebrochene Deckenbalken','ceiling','collapse','╱',1.7,1.2,2.2],
 ['water-pool','Flache Wasserfläche','liquid','pool','≈',1.6,1.6,.02],
 ['water-channel','Wasserrinne','liquid','channel','≈',2,.55,.02],
 ['water-cell','Wasser-Brush · Rasterfeld','liquid','water-cell','≈',.99,.99,.02],
 ['water-flood','Überfluteter Bodenbereich','liquid','flood','≈',2.5,2.5,.02],
 ['water-blood','Blutlache','liquid','blood','●',.9,.72,.01],
 ['water-poison','Giftige Flüssigkeit','liquid','poison','≈',1.4,1.4,.02],
 ['water-well','Steinerner Brunnen','liquid','well','◉',1.05,1.05,.65],
 ['fx-mist','Bodennebel','atmosphere','mist','≋',.5,.5,.12],
 ['fx-dust','Schwebender Staub','atmosphere','dust','·',.5,.5,1.2],
 ['fx-smoke','Aufsteigender Rauch','atmosphere','smoke','≋',.5,.5,1.5],
 ['fx-drip','Herabtropfendes Wasser','atmosphere','drip','•',.4,.4,2],
 ['fx-lightshaft','Lichtstrahl von oben','atmosphere','lightshaft','✧',.5,.5,2.2],
 ['fx-sparks','Glühende Funken','atmosphere','sparks','✳',.5,.5,1],
 ['sound-drip','Geräusch · Wassertropfen','sound','drip','♪',.3,.3,.1],
 ['sound-fire','Geräusch · Feuerknistern','sound','fire','♪',.3,.3,.1],
 ['sound-chain','Geräusch · Kettenrasseln','sound','chain','♪',.3,.3,.1],
 ['sound-wind','Geräusch · Windzug','sound','wind','♪',.3,.3,.1],
 ['sound-wood','Geräusch · knarrendes Holz','sound','wood','♪',.3,.3,.1],
 ['sound-whisper','Geräusch · unheimliches Flüstern','sound','whisper','♪',.3,.3,.1]
];
function install(cat){
 for(const [id,label,category,designKind,icon,w,h,height] of defs)cat.furniture[id]={label,category,designKind,icon,kind:'level-design',asset:null,render:'procedural-level-design',footprint:{w,h},height,destroyable:designKind==='hatch',vaultable:false,blocksMovement:['portcullis','well'].includes(designKind),blocksProjectiles:designKind==='portcullis',maxHP:designKind==='hatch'?100:1};
}
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),num=(x,d,a,b)=>Number.isFinite(x)?clamp(x,a,b):d;
function normalize(spec,raw={}){
 raw=raw&&typeof raw==='object'?raw:{};
 const k=spec.designKind,c=spec.category,d={};
 if(k==='enemy'){d.enemyType=Number.isInteger(raw.enemyType)&&raw.enemyType>=0&&raw.enemyType<ENEMIES.length?raw.enemyType:3;d.elite=raw.elite===true;}
 if(k==='soul'){d.lootMode=raw.lootMode==='fixed'?'fixed':'random';if(d.lootMode==='fixed'){const id=typeof raw.item==='string'?raw.item.trim():'';d.item=/^(weapon|ring|armor|food|cup|potion):[a-z0-9-]{1,70}$/.test(id)?id:'weapon:hammer';d.rarity=['common','rare','epic','legendary','mythic'].includes(raw.rarity)?raw.rarity:'common';}}
 if(k==='lever')d.target='next-level-exit';
 if(k==='portcullis')d.target='next-level-exit';
 if(k==='hatch')d.lock=['sealed','breakable','random'].includes(raw.lock)?raw.lock:'random';
 if(c==='ceiling')d.z=num(raw.z,2.2,1.4,4);
 if(c==='liquid')d.depth=num(raw.depth,k==='flood'?.20:.06,.01,.5);
 if(c==='atmosphere'||c==='sound'){d.radius=num(raw.radius,c==='sound'?3:1.5,.3,8);d.intensity=num(raw.intensity,.55,.05,1);}
 if(c==='sound')d.interval=num(raw.interval,4,.5,30);
 if(c==='gameplay'&&typeof raw.note==='string')d.note=raw.note.slice(0,200);
 return d;
}
function rules(room,cat){
 const list=(room.furniture||[]).filter(o=>cat.furniture[o.type]?.designKind);
 const of=k=>list.filter(o=>cat.furniture[o.type].designKind===k).map(o=>o.id);
 return {schema:'mind-dungeon-progression/v1',nextLevelExit:{lockedIfLever:of('lever').length>0,unlock:'any-level-lever',leverIds:of('lever'),localGateIds:of('portcullis'),exitMarkerIds:of('next-level')},hatches:list.filter(o=>cat.furniture[o.type].designKind==='hatch').map(o=>({id:o.id,lock:normalize(cat.furniture[o.type],o.design).lock,destination:'lower-storey',sealedSequence:['unseal','destroy','descend'],breakableSequence:['destroy','descend']}))};
}
function createState(room,cat){
 const gates=new Set(),hatches=new Map(),levers=new Set();
 for(const o of room.furniture||[]){const s=cat.furniture[o.type],k=s?.designKind;
  if(k==='portcullis')gates.add(o.id);
  if(k==='hatch'){const d=normalize(s,o.design);hatches.set(o.id,{sealed:d.lock==='sealed'||d.lock==='random'&&hash(o.id)>.5,hp:100});}
 }
 return {gates,hatches,levers,unlocked:false,requiresLever:(room.furniture||[]).some(o=>cat.furniture[o.type]?.designKind==='lever')};
}
function interact(state,o,s){
 const k=s.designKind;
 if(k==='lever'){state.levers.add(o.id);state.unlocked=true;state.gates.clear();return 'Hebel aktiviert · Ebenen-Fallgitter geöffnet (lokale Simulation).';}
 if(k==='portcullis')return state.gates.has(o.id)?'Fallgitter verschlossen · Hebel suchen.':'Fallgitter offen.';
 if(k==='hatch'){const h=state.hatches.get(o.id);if(!h)return '';if(h.sealed){h.sealed=false;return 'Magisches Siegel gelöst (Testsimulation) · Falltür jetzt aufschlagen.';}return h.hp>0?'Falltür mit Angriffen aufschlagen.':'Leiter nach unten frei · Ebenenwechsel im Hauptspiel.';}
 if(k==='next-level')return !state.unlocked&&(state.gates.size||state.requiresLever)?'Treppenzugang gesperrt · Hebel suchen.':'Treppenzugang · echter Ebenenwechsel im Hauptspiel.';
 return s.category==='gameplay'?s.label+' · reservierter Fokuspunkt (keine Spielinstanz)':'';
}
function hit(state,o,s){
 if(s.designKind==='portcullis')return 'Fallgitter nicht zerstörbar · Hebel benutzen.';
 if(s.designKind!=='hatch')return null;
 const h=state.hatches.get(o.id);if(!h)return '';
 if(h.sealed)return 'Magisches Siegel schützt die Falltür · zuerst E zum Entsiegeln (Test).';
 h.hp=Math.max(0,h.hp-25);return h.hp?'Falltür · '+h.hp+' HP':'Falltür aufgeschlagen · E an der Leiter.';
}
const TAU=Math.PI*2;
function hash(s){let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)/4294967296;}
function draw(ctx,o,s,project,zoom,t,playing,state,selected,hero){
 const k=s.designKind,c=s.category,d=normalize(s,o.design),p=project(o.x,o.y,0),w=s.footprint.w,h=s.footprint.h,rad=o.rot*Math.PI/180,co=Math.cos(rad),si=Math.sin(rad),q=(x,y,z=0)=>project(o.x+x*co-y*si,o.y+x*si+y*co,z),z=d.z||2.2;
 const line=(ps,color,width=1)=>{ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);for(const a of ps.slice(1))ctx.lineTo(a.x,a.y);ctx.strokeStyle=color;ctx.lineWidth=width*zoom;ctx.lineCap='round';ctx.stroke();};
 const poly=(ps,color,stroke)=>{ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);for(const a of ps.slice(1))ctx.lineTo(a.x,a.y);ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8*zoom;ctx.stroke();}};
 const ellipse=(x,y,rx,ry,col)=>{ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);ctx.fillStyle=col;ctx.fill();};
 const rect=(a,b,zz=0)=>[q(-a,-b,zz),q(a,-b,zz),q(a,b,zz),q(-a,b,zz)];
 const box=(a,b,lo,hi,top,side)=>{const v=rect(a,b,lo),u=rect(a,b,hi);poly([v[1],v[2],u[2],u[1]],side,'#25211c');poly([v[2],v[3],u[3],u[2]],'#282622','#211f1b');poly(u,top,'#76634d');};
 const label=(txt,at=p,color='#e8cba1')=>{ctx.font='bold '+Math.max(10,11*zoom)+'px sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#18191b';ctx.strokeText(txt,at.x,at.y);ctx.fillStyle=color;ctx.fillText(txt,at.x,at.y);};
 ctx.save();
 if(c==='gameplay'){
  if(!playing||selected){poly(rect(w/2,h/2),'#7770af35','#b9a7e4');const a=q(0,0,.55);line([p,a],'#b9a7e4',1);ellipse(a.x,a.y,10*zoom,10*zoom,'#463d64');label(s.icon,a,'#f1dfff');label(k==='enemy'?ENEMIES[d.enemyType]:k==='soul'?(d.lootMode==='fixed'?d.item:'Zufallsloot'):s.label,{x:a.x,y:a.y-16*zoom},'#d8c8f6');}
 }else if(c==='mechanisms'){
  if(k==='lever'){box(.16,.17,0,.14,'#54483b','#393026');const a=q(0,0,.16),b=q(0,playing&&state.levers.has(o.id)?.22:-.22,.72);line([a,b],'#1e1c1a',6);line([a,b],'#8c8270',2);ellipse(b.x,b.y,4*zoom,4*zoom,'#714833');}
  if(k==='portcullis'){const open=playing&&!state.gates.has(o.id),lo=open?1.75:0,hi=open?2.05:1.95;for(let i=0;i<7;i++){let x=-w*.46+i*w*.153;line([q(x,0,lo),q(x,0,hi)],'#1a191b',5);line([q(x,0,lo),q(x,0,hi)],'#79746b',1.5);}for(const a of [lo+.08,hi-.08])line([q(-w/2,0,a),q(w/2,0,a)],'#504a42',4);}
  if(k==='hatch'){const hstate=playing?state.hatches.get(o.id):null,opened=hstate&&hstate.hp<=0,sealed=hstate?hstate.sealed:d.lock==='sealed';poly(rect(w/2,h/2),'#171719','#736958');if(!opened){box(w*.46,h*.46,0,.06,'#4f3b2b','#29211b');for(let i=1;i<6;i++)line([q(-w*.46+i*w*.153,-h*.45,.065),q(-w*.46+i*w*.153,h*.45,.065)],'#241e18',1);for(const y of [-.32,.32])line([q(-w*.45,y,.08),q(w*.45,y,.08)],'#77746c',3);if(sealed||!playing&&d.lock==='random'){ctx.strokeStyle='#b19cda';ctx.lineWidth=1.5*zoom;ctx.beginPath();ctx.ellipse(p.x,p.y,15*zoom,8*zoom,0,0,TAU);ctx.stroke();label('✧',{x:p.x,y:p.y+3*zoom},'#d8c4ff');}}
   else for(let i=0;i<5;i++)line([q(-.26,-.34,-i*.12),q(.26,-.34,-i*.12)],'#8e7756',2);}
 }else if(c==='ceiling'){
  if(playing&&hero&&Math.hypot(o.x-hero.x,o.y-hero.y)<1.1)ctx.globalAlpha*=.34;
  if(k==='beam'||k==='collapse'){box(w/2,h*.12,z-.18,z,'#65503a','#372c23');if(k==='collapse')for(let i=0;i<5;i++)line([q(-w*.45+i*w*.2,0,z),q(-w*.40+i*w*.2,h*.42,z-.28-(i%3)*.12)],'#4a3727',4);}
  else if(k==='chain'||k==='chandelier'||k==='cage'){for(let i=0;i<9;i++){const a=q(0,0,z-i*.075);ctx.beginPath();ctx.ellipse(a.x,a.y,2.2*zoom,4*zoom,i%2?.7:-.7,0,TAU);ctx.strokeStyle='#8b8376';ctx.lineWidth=1.3*zoom;ctx.stroke();}
   if(k==='chandelier'){const a=q(0,0,z-.7);ctx.beginPath();ctx.ellipse(a.x,a.y,20*zoom,11*zoom,0,0,TAU);ctx.strokeStyle='#62584a';ctx.lineWidth=3*zoom;ctx.stroke();for(let i=0;i<6;i++){const b=q(Math.cos(i*TAU/6)*.40,Math.sin(i*TAU/6)*.40,z-.66);line([a,b],'#615a4d',2);line([b,{x:b.x,y:b.y-7*zoom}],'#b2a07a',3);}}
   if(k==='cage'){const lo=z-1.15,hi=z-.65;poly(rect(.30,.30,lo),'#302d29','#796f60');for(const x of [-.30,-.15,0,.15,.30])for(const y of [-.30,.30])line([q(x,y,lo),q(x,y,hi)],'#77736a',1.8);poly(rect(.30,.30,hi),'#3f3a32','#77736a');}}
  else {const a=q(-w/2,-h/2,z);for(let i=0;i<=8;i++)line([a,q(w/2,-h/2+i*h/8,z-.12)],'#99968a80',.6);for(let i=1;i<6;i++){const f=i/6;line([q(-w/2+w*f,-h/2,z-.12*f),q(-w/2+w*f,h/2,z-.12*f)],'#a4a09670',.6);}}
 }else if(c==='liquid'){
  const col=k==='blood'?'#571d20b5':k==='poison'?'#4c6333b5':'#344b51bc',edge=k==='blood'?'#8f3a3b':k==='poison'?'#819256':'#728b8b';
  if(k==='well'){box(.50,.50,0,.54,'#6d6558','#3c3a34');poly(rect(.35,.35,.55),col,'#202c2c');}
  else {const ps=[];for(let i=0;i<16;i++){const a=i*TAU/16,rr=k==='channel'||k==='flood'||k==='water-cell'?1/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a))):.88+.10*Math.sin(i*2.1);ps.push(q(Math.cos(a)*w*.5*rr,Math.sin(a)*h*.5*rr,.015));}poly(ps,col,k==='water-cell'?null:edge);}
  const zz=k==='well'?.56:.026;
  for(let i=0;i<4;i++){const y=(i-1.5)*h*.15,a=q(-w*.27,y,zz),b=q(w*.27,y+.018*Math.sin(t*2+i),zz);line([a,b],edge+'55',.9);}
 }else if(c==='atmosphere'){
  const phase=hash(o.id)*TAU,r=d.radius;
  if(k==='lightshaft'){const a=q(0,0,2.3),b=q(0,0,.06);poly([{x:a.x-4*zoom,y:a.y},{x:a.x+4*zoom,y:a.y},{x:b.x+18*r*zoom,y:b.y},{x:b.x-18*r*zoom,y:b.y}],'rgba(222,202,146,'+d.intensity*.09+')');}
  else for(let i=0;i<(k==='mist'||k==='smoke'?7:12);i++){const f=(t*(k==='drip'?.75:.13)+i*.157+phase)%1,a=i*2.399+t*.15,dx=Math.cos(a)*r*.45*f,dy=Math.sin(a)*r*.45*f,zz=k==='mist'?.08:k==='drip'?2*(1-f):k==='smoke'?f*1.5:.2+f*1.4;
   const b=q(dx,dy,zz),alpha=d.intensity*(1-f);if(k==='mist'||k==='smoke'){const rr=(9+f*16)*zoom;const g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,rr);g.addColorStop(0,'rgba(166,168,158,'+alpha*.14+')');g.addColorStop(1,'rgba(166,168,158,0)');ellipse(b.x,b.y,rr,rr*.55,g);}
   else ellipse(b.x,b.y,(k==='drip'?1.1:1.4)*zoom,(k==='drip'?3:1.2)*zoom,k==='sparks'?'rgba(235,145,62,'+alpha+')':k==='drip'?'rgba(163,206,225,'+alpha+')':'rgba(205,199,178,'+alpha+')');}
 }else if(c==='sound'&&!playing){ctx.strokeStyle='#79b5c4';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(p.x,p.y,d.radius*42*zoom,d.radius*24*zoom,0,0,TAU);ctx.stroke();ctx.setLineDash([]);label('♪',p,'#a9d7df');}
 if(!playing&&selected){poly(rect(w/2,h/2),'#ffffff08','#dfb16e');if(c==='atmosphere')label(s.icon,p);}
 ctx.restore();
}
let audio=null,noise=null,nextSounds=new Map();
function enableAudio(){try{if(!audio){const C=root.AudioContext||root.webkitAudioContext;if(!C)return false;audio=new C();noise=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate);const data=noise.getChannelData(0);let n=0;for(let i=0;i<data.length;i++){n=.89*n+.11*(Math.random()*2-1);data[i]=n;}}audio.resume().catch(()=>{});return true;}catch(e){return false;}}
function stopAudio(){if(audio)audio.suspend().catch(()=>{});nextSounds.clear();}
function soundTick(room,cat,hero,t){if(!audio||audio.state!=='running')return;for(const o of room.furniture){const s=cat.furniture[o.type];if(s?.category!=='sound')continue;const d=normalize(s,o.design),dist=Math.hypot(o.x-hero.x,o.y-hero.y);if(dist>d.radius||t<(nextSounds.get(o.id)||0))continue;nextSounds.set(o.id,t+d.interval*(.75+hash(o.id+Math.floor(t))*.5));const now=audio.currentTime,src=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain(),pan=audio.createStereoPanner?.();src.buffer=noise;const k=s.designKind,dur=k==='wind'||k==='whisper'?1.6:k==='fire'?.55:.2;filter.type='bandpass';filter.frequency.value={drip:1800,fire:1000,chain:2700,wind:220,wood:420,whisper:750}[k]||500;filter.Q.value=k==='chain'?5:1.8;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(d.intensity*.16*(1-dist/d.radius),now+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+dur);src.connect(filter).connect(gain);if(pan){pan.pan.value=clamp((o.x-hero.x)/d.radius,-1,1);gain.connect(pan).connect(audio.destination);}else gain.connect(audio.destination);src.start(now,hash(o.id)*.3,dur);}}
const api={install,normalize,rules,createState,interact,hit,draw,enableAudio,stopAudio,soundTick,ENEMIES,ITEM_OPTIONS};
root.MindRoomLevelDesign=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:{});
