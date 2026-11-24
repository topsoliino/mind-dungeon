/* Room-local portal geometry, no live-game dependencies. */
(function(root){
const api=(function factory(){
 const geometry=root.MindRoomShape||(typeof module!=='undefined'&&module.exports?require('./shape.js'):null);
 const sides=['north','east','south','west'],horizontal=s=>s==='north'||s==='south';
 const span=(r,s)=>horizontal(s)?r.width:r.height;
 const key=p=>`${p.side}:${p.line??'outer'}:${p.offset}:${p.width}`;
 const shape=p=>p&&sides.includes(p.side)&&Number.isInteger(p.offset)&&p.offset>=0&&Number.isInteger(p.width)&&p.width>=1&&p.width<=30&&(p.line===undefined||Number.isInteger(p.line)&&p.line>=0&&p.line<=30);
 function normalize(raw){const seen=new Set();return (Array.isArray(raw)?raw:[]).filter(p=>shape(p)&&!seen.has(key(p))&&seen.add(key(p))).map(({side,offset,width,line})=>({side,offset,width,...(line===undefined?{}:{line})}));}
 function segment(r,p){const a=p.offset,b=a+p.width,l=geometry.line(r,p);return horizontal(p.side)?[[a,l],[b,l]]:[[l,a],[l,b]];}
 const overlap=(a,b,c,d)=>Math.min(b,d)-Math.max(a,c)>1e-6;
 function inspect(r,p,cat,placement){
  const fail=reason=>({ok:false,reason});
  if(!shape(p)||p.offset+p.width>span(r,p.side))return fail('Außerhalb der Raumkante');
  const h=horizontal(p.side),[[x,y]]=segment(r,p),end=p.offset+p.width,l=geometry.line(r,p);
  for(let i=p.offset;i<end;i++){const pos=h?geometry.has(r,i,l):geometry.has(r,l,i),neg=h?geometry.has(r,i,l-1):geometry.has(r,l-1,i);const inward=p.side==='north'||p.side==='west';if(inward?(!pos||neg):(!neg||pos))return fail('Kein Außenrand des Grundrisses');}
  for(const w of r.walls||[]){
   if(!cat.walls[w.style]?.solid)continue;
   const wh=horizontal(w.edge);
   if(h===wh?(h?w.y===y:w.x===x)&&overlap(p.offset,end,h?w.x:w.y,(h?w.x:w.y)+1):
    (h?w.x:w.y)>p.offset&&(h?w.x:w.y)<end&&overlap(h?w.y:w.x,(h?w.y:w.x)+1,(h?y:x)-.7,(h?y:x)+.7))
    return fail(cat.walls[w.style]?.door?'Zellentür ist derzeit eine feste Barriere':'Mauer oder Gitter im Durchgang');
  }
  if((r.portals||[]).some(q=>key(q)!==key(p)&&q.side===p.side&&geometry.line(r,q)===l&&overlap(p.offset,end,q.offset,q.offset+q.width)))return fail('Überlappt anderen Zugang');
  const d=.7,b=h?{left:p.offset,right:end,top:p.side==='north'?l:l-d,bottom:p.side==='north'?l+d:l}:{left:p.side==='west'?l:l-d,right:p.side==='west'?l+d:l,top:p.offset,bottom:end};
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
  if(r.floorCells){const edges=geometry.boundary(r),rank=edges.filter(e=>{const t=horizontal(e.side)?x:y,l=horizontal(e.side)?y:x;return Math.abs(l-e.line)<=.45&&t>=e.offset&&t<e.offset+1;}).sort((a,b)=>Math.abs((horizontal(a.side)?y:x)-a.line)-Math.abs((horizontal(b.side)?y:x)-b.line));for(const e of rank)for(let off=e.offset;off>=Math.max(0,e.offset-width+1);off--){if(Array.from({length:width},(_,i)=>off+i).every(n=>edges.some(q=>q.side===e.side&&q.line===e.line&&q.offset===n)))return {...e,offset:off,width};}return null;}
  const c=[['north',Math.abs(y),x],['east',Math.abs(x-r.width),y],['south',Math.abs(y-r.height),x],['west',Math.abs(x),y]].filter(([s,d,t])=>d<=.45&&t>=0&&t<span(r,s)&&span(r,s)>=width).sort((a,b)=>a[1]-b[1]);
  if(!c.length)return null;const [side,,t]=c[0];return {side,offset:Math.min(Math.floor(t),span(r,side)-width),width};
 }
 function suggest(r,cat,placement){
  const out=[];if(r.floorCells){for(const side of sides){if((r.portals||[]).some(p=>p.side===side))continue;const choice=geometry.boundary(r).find(p=>p.side===side&&inspect(r,p,cat,placement).ok);if(choice)out.push(choice);}return out;}for(const side of sides){if((r.portals||[]).some(p=>p.side===side))continue;const n=span(r,side);const offsets=Array.from({length:n},(_,i)=>i).sort((a,b)=>Math.abs(a+.5-n/2)-Math.abs(b+.5-n/2));const p=offsets.map(offset=>({side,offset,width:1})).find(p=>inspect(r,p,cat,placement).ok);if(p)out.push(p);}return out;
 }
 return Object.freeze({normalize,segment,inspect,nearest,suggest,key,span});
})();
root.MindRoomPortals=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:{});
