(() => {
'use strict';
function mount({generator:g,player,iso}){
 if(!g?.enabled||document.getElementById('iso-generator-tools'))return;
 const panel=document.createElement('aside');
 panel.id='iso-generator-tools';
 Object.assign(panel.style,{position:'fixed',left:'14px',bottom:'14px',zIndex:'32',
  width:'306px',padding:'11px',borderRadius:'9px',background:'#171c2bec',
  border:'1px solid #a2a8b18c',color:'#e8e3d9',font:'12px/1.4 system-ui,sans-serif',
  boxShadow:'0 8px 28px #050915aa'});
 const grammar=window.AlleyStairGeometry;
 const stairOptions=(grammar?.styles||[]).map(id=>'<option value="'+id+'">'+
  grammar.templates[id].title+'</option>').join('');
 panel.innerHTML=
  '<div style="display:flex;justify-content:space-between;align-items:center">'+
  '<strong id="iso-gen-level">GREYBOX · ERDGESCHOSS</strong><button id="iso-gen-toggle" aria-expanded="true">Karte −</button></div>'+
  '<div style="font-size:11px;color:#bac9d2;margin:6px 0">'+
  g.metadata.rooms+' Räume · '+g.metadata.corridors+' Gänge · '+g.metadata.doors+
  ' Verbindungen · 1 Treppe · 1 Leiter</div>'+
  '<div style="font-size:11px;color:#d9c7b0;margin-bottom:7px">'+
  (g.metadata.stairTitle||'Treppenkonstruktion')+'</div>'+
  '<div id="iso-gen-body"><canvas id="iso-gen-map" width="576" height="360" '+
  'aria-label="Isometrischer Grundriss und Spielerposition" style="width:100%;height:180px;'+
  'display:block;border:1px solid #75869c66;border-radius:6px;background:#111827"></canvas>'+
  '<div style="font-size:10px;color:#b9c4d2;margin-top:5px">● Held · Türkis: OG-Ziel · Violett: Kriechpassage (Strg) · L Leiter</div>'+
  '<div style="margin-top:8px"><label for="iso-gen-stair-style">Treppentyp</label>'+
  '<select id="iso-gen-stair-style" style="width:100%;padding:6px;margin-top:3px;'+
  'background:#101725;color:#eee;border:1px solid #8190a1;border-radius:4px">'+
  stairOptions+'</select></div>'+
  '<div style="display:flex;gap:5px;align-items:center;margin-top:8px">'+
  '<label for="iso-gen-seed">Seed</label><input id="iso-gen-seed" type="number" min="0" step="1" '+
  'value="'+g.requestedSeed+'" style="width:100%;min-width:0;padding:5px;background:#101725;color:white;'+
  'border:1px solid #8190a1;border-radius:4px"><button id="iso-gen-apply">Laden</button></div>'+
  '<button id="iso-gen-new" style="width:100%;margin-top:7px;padding:8px;font-weight:bold">'+
  'Neue Ebene generieren</button></div>';
 document.body.append(panel);
 for(const b of panel.querySelectorAll('button'))
  Object.assign(b.style,{padding:'5px 8px',color:'#f4e8da',background:'#4c5566',
   border:'1px solid #948c8b',borderRadius:'5px',cursor:'pointer'});
 const body=panel.querySelector('#iso-gen-body'),toggle=panel.querySelector('#iso-gen-toggle');
 toggle.onclick=()=>{
  const open=body.style.display==='none';body.style.display=open?'':'none';
  toggle.textContent=open?'Karte −':'Karte +';
  toggle.setAttribute('aria-expanded',String(open));
 };
 const styleSelect=panel.querySelector('#iso-gen-stair-style');
 if(styleSelect){
  styleSelect.value=g.metadata.stairVariant;
  styleSelect.onchange=()=>{
   const url=new URL(window.location.href);
   url.searchParams.set('treppe',styleSelect.value);
   url.searchParams.set('v','20');
   window.location.assign(url.href);
  };
 }
 const field=panel.querySelector('#iso-gen-seed');
 function setSeed(v){
  const n=Math.max(0,Math.min(4294967295,Math.floor(Number(v)||0)));
  const url=new URL(window.location.href);
  url.searchParams.set('szene','gasse');url.searchParams.set('modus','generator');
  url.searchParams.set('seed',String(n));url.searchParams.set('v','20');window.location.assign(url.href);
 }
 panel.querySelector('#iso-gen-apply').onclick=()=>setSeed(field.value);
 panel.querySelector('#iso-gen-new').onclick=()=>setSeed((g.requestedSeed+1)>>>0);
 field.onkeydown=e=>{if(e.key==='Enter')setSeed(field.value);};
 const canvas=panel.querySelector('#iso-gen-map'),display=canvas.getContext('2d');
 const background=document.createElement('canvas');
 background.width=canvas.width;background.height=canvas.height;
 const ctx=background.getContext('2d');
 const alley=[[1,2.75,12,6.85],[4.5,6.8,8.1,9.4],[9.5,.8,12,2.75]];
 const vertices=[...alley.flatMap(([u,v,r,b])=>[[u,v],[r,b]]),
  ...g.rooms.slice(1).flatMap(room=>room.cells.flatMap(([u,v])=>[[u,v],[u+1,v+1]]))];
 const projected=vertices.map(([u,v])=>iso.toView(u*48,v*48));
 const minX=Math.min(...projected.map(p=>p.x)),maxX=Math.max(...projected.map(p=>p.x));
 const minY=Math.min(...projected.map(p=>p.y)),maxY=Math.max(...projected.map(p=>p.y));
 const zoom=Math.min(526/(maxX-minX||1),310/(maxY-minY||1),1);
 const padX=(canvas.width-(maxX-minX)*zoom)/2,padY=(canvas.height-(maxY-minY)*zoom)/2;
 const xy=(u,v)=>{
  const p=iso.toView(u*48,v*48);
  return [padX+(p.x-minX)*zoom,padY+(p.y-minY)*zoom];
 };
 const quad=(u,v,r,b)=>[xy(u,v),xy(r,v),xy(r,b),xy(u,b)];
 function poly(corners,fill,stroke){
  ctx.beginPath();corners.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.3;ctx.stroke();}
 }
 const colors=['#687182','#617d87','#827487','#707e75'];
 const vertical=window.AlleyVertical;
 function drawBackground(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(const [u,v,r,b] of alley)poly(quad(u,v,r,b),'#495461','#8e9da3');
  for(const room of g.rooms.slice(1))
   for(const [u,v] of room.cells)poly(quad(u,v,u+1,v+1),colors[room.id%4]);
  if(vertical?.enabled&&vertical.state.floor===1){
   for(const str of vertical.upper){
    const [u,v]=str.split(',').map(Number);
    poly(quad(u,v,u+1,v+1),'#528796','#a8e3e7');
   }
  }
  for(const wall of g.walls){
   const [u,v,r,b]=wall.area;
   const a=wall.axis==='u'?xy((u+r)/2,v):xy(u,(v+b)/2);
   const z=wall.axis==='u'?xy((u+r)/2,b):xy(r,(v+b)/2);
   ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...z);
   ctx.strokeStyle=wall.height>20?'#e3d6c6':'#7d8b9c';
   ctx.lineWidth=wall.height>20?2.6:1.3;ctx.stroke();
  }
  for(const door of g.doors)for(const [a,b] of door.edges){
   const p=xy((a[0]+b[0]+1)/2,(a[1]+b[1]+1)/2);
   ctx.beginPath();ctx.arc(p[0],p[1],3.5,0,Math.PI*2);ctx.fillStyle='#f4d394';ctx.fill();
  }
  if(vertical?.enabled&&vertical.plan){
   for(const step of vertical.plan.steps)
    poly(step.corners.map(p=>xy(p.x,p.y)),
     step.z>vertical.height*.5?'#7da7b6':'#436777','#9db6c4');
   for(const land of vertical.plan.landings)
    poly(land.corners.map(p=>xy(p.x,p.y)),'#8fa4b0','#d2e8f4');
   const top=xy(vertical.plan.top.x,vertical.plan.top.y);
   ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillStyle='#fcf1cb';
   ctx.fillText('OG',top[0],top[1]+5);
   if(vertical.plan.kind==='switchback'){
    const landing=vertical.plan.landings.find(l=>!l.top);
    if(landing){
     const p=landing.corners.reduce((a,b)=>({x:a.x+b.x/landing.corners.length,
      y:a.y+b.y/landing.corners.length}),{x:0,y:0});
     const under=xy(p.x,p.y);
     ctx.beginPath();ctx.arc(under[0],under[1],6,0,Math.PI*2);
     ctx.fillStyle='#b48cff';ctx.fill();ctx.strokeStyle='#fff';ctx.stroke();
    }
   }
  }else for(const stair of g.stairs){
   const [u,v,r,b]=stair.area;poly(quad(u,v,r,b),'#437c96','#d2e8f4');
  }
  if(vertical?.enabled){
   const at=vertical.ladder.bottom,p=xy(at.x,at.y);
   ctx.beginPath();ctx.arc(p[0],p[1],6.5,0,Math.PI*2);
   ctx.fillStyle='#d3ae73';ctx.fill();
   ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#211a20';
   ctx.fillText('L',p[0],p[1]+3.7);
   panel.querySelector('#iso-gen-level').textContent=
    'GREYBOX · '+(vertical.state.floor?'OBERGESCHOSS':'ERDGESCHOSS');
  }
 }
 let cachedFloor=null,lastX=null,lastY=null;
 function draw(){
  if(body.style.display==='none')return;
  const floor=vertical?.state.floor??0,hero=player();
  if(cachedFloor===floor&&hero.x===lastX&&hero.y===lastY)return;
  if(cachedFloor!==floor){drawBackground();cachedFloor=floor;}
  lastX=hero.x;lastY=hero.y;
  display.clearRect(0,0,canvas.width,canvas.height);
  display.drawImage(background,0,0);
  const dot=xy(hero.x/48,hero.y/48);
  display.beginPath();display.arc(dot[0],dot[1],5.6,0,Math.PI*2);display.fillStyle='#ed6384';display.fill();
  display.strokeStyle='#fff';display.lineWidth=1.7;display.stroke();
 }
 draw();
 const timer=setInterval(()=>{
  if(!panel.isConnected){clearInterval(timer);return;}draw();
 },200);
}
window.AlleyGeneratorUI={mount};
})();