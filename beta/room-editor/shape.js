/* Explicit occupied floor cells for irregular Room Atelier plans. */
(function(root){const api=(function factory(){
 const key=(x,y)=>x+','+y,cache=new WeakMap(),dirs=[[1,0],[-1,0],[0,1],[0,-1]];
 function cells(r){return Array.isArray(r.floorCells)?r.floorCells:Array.from({length:r.width*r.height},(_,i)=>({x:i%r.width,y:Math.floor(i/r.width)}));}
 function has(r,x,y){if(x<0||y<0||x>=r.width||y>=r.height||!Number.isInteger(x)||!Number.isInteger(y))return false;if(!Array.isArray(r.floorCells))return true;let s=cache.get(r.floorCells);if(!s){s=new Set(r.floorCells.map(c=>key(c.x,c.y)));cache.set(r.floorCells,s);}return s.has(key(x,y));}
 function normalize(r,raw){if(!Array.isArray(raw))return undefined;const seen=new Set(),out=[];for(const c of raw){if(!c||!Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.y<0||c.x>=r.width||c.y>=r.height)throw Error('Ungültiges Bodenfeld');const k=key(c.x,c.y);if(!seen.has(k)){seen.add(k);out.push({x:c.x,y:c.y});}}if(!out.length)throw Error('Grundriss benötigt mindestens ein Bodenfeld');return out.sort((a,b)=>a.y-b.y||a.x-b.x);}
 function contains(r,b){const eps=1e-7;if(!b||b.left<0||b.top<0||b.right>r.width||b.bottom>r.height)return false;for(let y=Math.floor(b.top+eps);y<Math.ceil(b.bottom-eps);y++)for(let x=Math.floor(b.left+eps);x<Math.ceil(b.right-eps);x++)if(!has(r,x,y))return false;return true;}
 function sides(r,w){const h=w.edge==='north'||w.edge==='south';return {positive:has(r,w.x,w.y),negative:h?has(r,w.x,w.y-1):has(r,w.x-1,w.y)};}
 function boundary(r){const out=[];for(const {x,y} of cells(r)){if(!has(r,x,y-1))out.push({side:'north',line:y,offset:x,width:1});if(!has(r,x,y+1))out.push({side:'south',line:y+1,offset:x,width:1});if(!has(r,x-1,y))out.push({side:'west',line:x,offset:y,width:1});if(!has(r,x+1,y))out.push({side:'east',line:x+1,offset:y,width:1});}return out;}
 function connected(r){const a=cells(r);if(!a.length)return false;const seen=new Set([key(a[0].x,a[0].y)]),q=[a[0]];for(let i=0;i<q.length;i++)for(const [dx,dy] of dirs){const x=q[i].x+dx,y=q[i].y+dy,k=key(x,y);if(!seen.has(k)&&has(r,x,y)){seen.add(k);q.push({x,y});}}return q.length===a.length;}
 function line(r,p){return Number.isInteger(p.line)?p.line:p.side==='north'||p.side==='west'?0:p.side==='south'?r.height:r.width;}
 function edit(r,x,y,add,bounds){
  const fail=reason=>({ok:false,reason});
  if(has(r,x,y)===add)return fail('');
  if(add&&!dirs.some(([dx,dy])=>has(r,x+dx,y+dy)))return fail('Neue Felder müssen seitlich an vorhandenen Boden anschließen.');
  const dx=Math.max(0,-x),dy=Math.max(0,-y),w=Math.max(r.width+dx,x+dx+1),h=Math.max(r.height+dy,y+dy+1);
  if(w>30||h>30)return fail('Maximal 30 × 30 Rasterfelder.');
  const shift=c=>({...c,x:c.x+dx,y:c.y+dy});
  const next={...r,width:w,height:h,floorCells:cells(r).filter(c=>add||c.x!==x||c.y!==y).map(shift),walls:(r.walls||[]).map(shift),tiles:(r.tiles||[]).filter(c=>add||c.x!==x||c.y!==y).map(shift),furniture:(r.furniture||[]).map(o=>{const n=shift(o);if(o.wallRef){const [axis,a,b]=o.wallRef.split(':');n.wallRef=axis+':'+(Number(a)+dx)+':'+(Number(b)+dy);}return n;}),portals:(r.portals||[]).map(p=>{const hor=p.side==='north'||p.side==='south';return {...p,line:line(r,p)+(hor?dy:dx),offset:p.offset+(hor?dx:dy)};})};
  if(add)next.floorCells.push({x:x+dx,y:y+dy});
  if(!connected(next))return fail('Der Grundriss muss zusammenhängend bleiben.');
  if(next.walls.some(w=>{const s=sides(next,w);return !s.positive&&!s.negative;}))return fail('Zuerst die Wand auf dieser Kante entfernen.');
  if(next.furniture.some(o=>!contains(next,bounds(o))))return fail('Zuerst das Möbel auf diesem Feld verschieben.');
  next.floorCells=normalize(next,next.floorCells);
  return {ok:true,room:next,dx,dy};
 }
 return Object.freeze({cells,has,normalize,contains,sides,boundary,connected,line,edit});
})();root.MindRoomShape=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:{});
