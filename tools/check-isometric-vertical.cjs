// node tools/check-isometric-vertical.cjs
// Deterministic architectural verification of physically coherent staircases
// and independently accessible upper-floor exits for 200 dungeon seeds.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../beta',name),'utf8');
const map=read('alley-study-map.js'),generator=read('alley-generator.js'),
 geometry=read('alley-stair-geometry.js'),navigation=read('alley-stair-navigation.js'),
 controller=read('alley-stair-controller.js'),vertical=read('alley-vertical.js');
const K=(x,y)=>x+','+y,neighbors=[[1,0],[-1,0],[0,1],[0,-1]];
const within=(room,p)=>room.cells.some(([x,y])=>x===Math.floor(p.x)&&y===Math.floor(p.y));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cell=p=>K(Math.floor(p.x),Math.floor(p.y));
function setup(seed,style=''){
 const suffix=style?'&treppe='+style:'';
 const window={location:{search:'?szene=gasse&modus=generator&seed='+seed+suffix}};
 const ctx={window,URLSearchParams};
 vm.runInNewContext(map,ctx);vm.runInNewContext(generator,ctx);
 vm.runInNewContext(geometry,ctx);vm.runInNewContext(navigation,ctx);
 vm.runInNewContext(controller,ctx);vm.runInNewContext(vertical,ctx);
 return window;
}
function connected(upper,from,to){
 const a=cell(from),b=cell(to);
 if(!upper.has(a)||!upper.has(b))return false;
 const seen=new Set([a]),queue=[[Math.floor(from.x),Math.floor(from.y)]];
 for(let i=0;i<queue.length;i++)for(const [du,dv] of neighbors){
  const p=[queue[i][0]+du,queue[i][1]+dv],k=K(...p);
  if(upper.has(k)&&!seen.has(k)){seen.add(k);queue.push(p);}
 }
 return seen.has(b);
}
const kinds=new Map(),walls=new Map();
for(let seed=0;seed<200;seed++){
 const w=setup(seed),g=w.AlleyGenerator,v=w.AlleyVertical,plan=v.plan;
 assert.equal(g.rooms.length,10);
 assert(v.enabled);
 assert.equal(v.height,132);
 assert.equal(v.connectors.length,2);
 assert.equal(g.stairs[0].roomId,v.room.id);
 assert.equal(g.stairs[0].variant,plan.kind);
 assert.equal(plan.length,plan.steps.length);
 assert.equal(g.metadata.stairTitle,plan.style);
 kinds.set(plan.kind,(kinds.get(plan.kind)||0)+1);
 walls.set(v.ladder.wall,(walls.get(v.ladder.wall)||0)+1);
 assert(v.room.kind==='raum','stairs must be housed in a chamber');
 assert(within(v.room,plan.bottom)&&within(v.room,plan.top),
  'each landing must belong to the same room');
 const [lx,ly]=v.ladder.cell,dir=v.ladder;
 assert(within(v.room,dir.bottom));
 assert(!within(v.room,{x:lx+.5+dir.dx,y:ly+.5+dir.dy}),
  'ladder must rest on the actual external wall');
 assert(connected(v.upper,plan.top,v.ladder.top),
  'top stair and top ladder must remain connected after hatch cutout');
 for(const [idx,step] of plan.steps.entries()){
  assert.equal(step.corners.length,4,'four corners per physical tread');
  assert(Math.abs(step.prev-132*idx/plan.steps.length)<1e-7,
   'step riser begins at previous tread height');
  assert(Math.abs(step.z-132*(idx+1)/plan.steps.length)<1e-7,
   'equal increments of rise on all stair variants');
  const polygonArea=Math.abs(step.corners.reduce((sum,a,i)=>{
   const b=step.corners[(i+1)%4];return sum+a.x*b.y-b.x*a.y;
  },0))/2;
  assert(polygonArea>.05,'tread cannot have degenerate / missing surface');
  for(const p of step.corners)assert(Number.isFinite(p.x)&&Number.isFinite(p.y));
 }
 assert.equal(plan.posts.length,plan.kind.startsWith('spiral')?1:0,
  'a helical staircase has precisely one full-height central spindle');
 for(const connector of v.connectors){
  assert(within(v.room,connector.bottom)&&within(v.room,connector.top));
  for(const up of [true,false]){
   let previous=up?-1:133;
   for(let i=0;i<=40;i++){
    const p=v.pose(connector,up,i/40);
    assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));
    assert(p.z>=-.00001&&p.z<=132.00001);
    assert(up?p.z>=previous-1e-6:p.z<=previous+1e-6,
     'hero height must never jump backwards during climb');
    previous=p.z;
   }
   const a=v.pose(connector,up,0),b=v.pose(connector,up,1);
   assert.equal(a.z,up?0:132);
   assert.equal(b.z,up?132:0);
   assert.equal(b.floor,up?1:0);
   if(connector.kind==='ladder')
    assert.equal(a.clip,up?'climb-up':'climb-down');
  }
 }
}
assert.equal(kinds.size,9,'all nine stair families, including the closed U, appear');
assert.equal(walls.size,4,'ladders continue to vary across all four wall orientations');
for(const style of kinds.keys()){
 const found=Array.from({length:50},(_,seed)=>setup(seed,style))
  .some(w=>w.AlleyVertical.plan.kind===style);
 assert(found,'selectable design '+style+' must exist for at least one deterministic seed');
}
const html=read('index.html');
assert(html.includes('alley-stair-geometry.js?v=4'));
assert(html.indexOf('alley-stair-geometry.js?v=4')<html.indexOf('alley-stair-navigation.js?v=2'));
assert(html.indexOf('alley-stair-navigation.js?v=2')<html.indexOf('alley-stair-controller.js?v=6'));
assert(html.indexOf('alley-stair-controller.js?v=6')<html.indexOf('alley-vertical.js?v=10'));
assert(html.indexOf('alley-vertical.js?v=10')<html.indexOf('alley-study.js?v=10'));
assert(html.includes('state.floor=task.up?1:0'));
assert(html.includes("state.z=pose.z"));
console.log('200 levels passed: 9 staircase types, 4 ladder orientations, identical riser heights, connected landings and 2-way rig transitions.');
