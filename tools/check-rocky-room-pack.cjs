const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const mods=['room-editor/catalog','room-editor/placement','room-editor/shape','room-editor/portals','room-packs/rocky-coast-1','alley-room-pack','alley-study-map','rocky-coast-prison','alley-generator','alley-stair-geometry','alley-stair-navigation','alley-stair-controller','alley-vertical','alley-level-sites'].map(f=>[f,fs.readFileSync(require('node:path').join(__dirname,'../beta',f+'.js'),'utf8')]);
for(let seed=4147;seed<=4156;seed++){
 const w={location:{search:'?szene=gasse&modus=generator&region=rocky-coast&level=1&run='+seed}},scope=vm.createContext({window:w,URLSearchParams,console});
 for(const [f,s] of mods)vm.runInContext(s,scope,{filename:f});
 const g=w.AlleyGenerator,rs=g.rooms.filter(r=>r.authored),sites=g.levelSites.sites;
 assert.equal(rs.length,7);assert.equal(new Set(rs.map(r=>r.authored.t.id)).size,7);
 assert.equal(g.rooms.filter(r=>r.kind==='raum').length,15);
 for(const [kind,n] of Object.entries({brew:1,chest:5,altar:10,door:2,merchant:1}))assert.equal(sites.filter(s=>s.kind===kind).length,n);
 for(const r of rs){
 const a=r.authored,[from,to]=r.exits[0].edges[0];assert.equal(g.roomAt(to[0],to[1]),r.id);
 w.RockyCoastPrison.atStorey(a.floor+1,()=>{for(let t=0;t<=1;t+=.1)
 assert(!g.blocked(from[0]+.5+(to[0]-from[0])*t,from[1]+.5+(to[1]-from[1])*t,.29)||sites.some(s=>s.room===r.id&&s.kind==='door'&&s.floor===a.floor),'blocked portal '+a.t.id);});
 for(const s of sites.filter(s=>s.kind!=='door'&&s.room===r.id&&s.floor===a.floor))assert(!a.t.blocked(s.x/48-a.x,s.y/48-a.y,.58,true));
 }
 // Open both destructible seals and walk the collision graph from the actual access.
 for(const site of sites.filter(s=>s.kind==='door'))g.levelSites.remove(site);
 for(let i=0;i<w.RockyCoastPrison.count;i++)w.RockyCoastPrison.atStorey(i+1,()=>{
  const v=w.AlleyVertical;
  const start=i?v.connectorsAt(i-1)[0].top:{x:12.5,y:4.5};
  const ok=(x,y)=>g.roomAt(x,y)>0&&!g.blocked(x,y,.29)&&!v.blocksGround(x,y,.29);
  const queue=[[Math.floor(start.x),Math.floor(start.y)]],seen=new Set(queue.map(p=>p.join(',')));
  for(let j=0;j<queue.length;j++){
   const [x,y]=queue[j];
   for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
    const a=x+dx,b=y+dy,k=a+','+b;
    if(seen.has(k)||!ok(a+.5,b+.5)||!ok(x+.5+dx*.5,y+.5+dy*.5))continue;
    seen.add(k);queue.push([a,b]);
   }
  }
  for(const site of sites.filter(site=>site.floor===i&&site.kind!=='door')){
   const x=site.x/48,y=site.y/48;
   assert([[0,0],[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy])=>
    seen.has(Math.floor(x+dx)+','+Math.floor(y+dy))),seed+' inaccessible '+site.kind+' '+site.room+' '+i);
  }
  for(const r of rs.filter(r=>r.authored.floor===i))assert(r.cells.some(p=>seen.has(p.join(','))),seed+' unreachable '+r.authored.t.id+' floor '+i);
 });
 console.log(seed,w.RockyCoastPrison.count,rs.map(r=>r.authored.port.reachable.size).join(','));
}
