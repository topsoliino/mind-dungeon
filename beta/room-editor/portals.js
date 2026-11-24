/* Room-local portal geometry, no live-game dependencies. */
(function(root){
const api=(function factory(){
 const sides=['north','east','south','west'],horizontal=s=>s==='north'||s==='south';
 const span=(r,s)=>horizontal(s)?r.width:r.height;
 const key=p=>`${p.side}:${p.offset}:${p.width}`;
 const shape=p=>p&&sides.includes(p.side)&&Number.isInteger(p.offset)&&p.offset>=0&&Number.isInteger(p.width)&&p.width>=1&&p.width<=30;
 function normalize(raw){const seen=new Set();return (Array.isArray(raw)?raw:[]).filter(p=>shape(p)&&!seen.has(key(p))&&seen.add(key(p))).map(({side,offset,width})=>({side,offset,width}));}
 function segment(r,p){const a=p.offset,b=a+p.width;return p.side==='north'?[[a,0],[b,0]]:p.side==='south'?[[a,r.height],[b,r.height]]:p.side==='west'?[[0,a],[0,b]]:[[r.width,a],[r.width,b]];}
 const overlap=(a,b,c,d)=>Math.min(b,d)-Math.max(a,c)>1e-6;
 function inspect(r,p,cat,placement){
  const fail=reason=>({ok:false,reason});
  if(!shape(p)||p.offset+p.width>span(r,p.side))return fail('Außerhalb der Raumkante');
  const h=horizontal(p.side),[[x,y]]=segment(r,p),end=p.offset+p.width;
  for(const w of r.walls||[]){
   if(!cat.walls[w.style]?.solid)continue;
   const wh=horizontal(w.edge);
   if(h===wh?(h?w.y===y:w.x===x)&&overlap(p.offset,end,h?w.x:w.y,(h?w.x:w.y)+1):
    (h?w.x:w.y)>p.offset&&(h?w.x:w.y)<end&&overlap(h?w.y:w.x,(h?w.y:w.x)+1,(h?y:x)-.7,(h?y:x)+.7))
    return fail(cat.walls[w.style]?.door?'Zellentür ist derzeit eine feste Barriere':'Mauer oder Gitter im Durchgang');
  }
  if((r.portals||[]).some(q=>key(q)!==key(p)&&q.side===p.side&&overlap(p.offset,end,q.offset,q.offset+q.width)))return fail('Überlappt anderen Zugang');
  const d=.7,b=h?{left:p.offset,right:end,top:p.side==='north'?0:r.height-d,bottom:p.side==='north'?d:r.height}:{left:p.side==='west'?0:r.width-d,right:p.side==='west'?d:r.width,top:p.offset,bottom:end};
  let destructible=false;
  for(const o of r.furniture||[]){
   const s=cat.furniture[o.type],f=placement.bounds(o,cat);
   if(!s||!f||!overlap(b.left,b.right,f.left,f.right)||!overlap(b.top,b.bottom,f.top,f.bottom))continue;
   if(s.surface)return fail('Höhenfläche oder Abgrund am Zugang');
   if(o.blocksMovement??s.blocksMovement){if(!(o.destroyable??s.destroyable))return fail('Unzerstörbares Objekt am Zugang');destructible=true;}
  }
  return {ok:true,reason:destructible?'Zerstörbares Hindernis':'Freier Zugang'};
 }
 function nearest(r,x,y,width=1){
  const c=[['north',Math.abs(y),x],['east',Math.abs(x-r.width),y],['south',Math.abs(y-r.height),x],['west',Math.abs(x),y]].filter(([s,d,t])=>d<=.45&&t>=0&&t<span(r,s)&&span(r,s)>=width).sort((a,b)=>a[1]-b[1]);
  if(!c.length)return null;const [side,,t]=c[0];return {side,offset:Math.min(Math.floor(t),span(r,side)-width),width};
 }
 function suggest(r,cat,placement){
  const out=[];for(const side of sides){if((r.portals||[]).some(p=>p.side===side))continue;const n=span(r,side);const offsets=Array.from({length:n},(_,i)=>i).sort((a,b)=>Math.abs(a+.5-n/2)-Math.abs(b+.5-n/2));const p=offsets.map(offset=>({side,offset,width:1})).find(p=>inspect(r,p,cat,placement).ok);if(p)out.push(p);}return out;
 }
 return Object.freeze({normalize,segment,inspect,nearest,suggest,key,span});
})();
root.MindRoomPortals=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:{});
