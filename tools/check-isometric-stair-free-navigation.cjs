// node tools/check-isometric-stair-free-navigation.cjs
// Regression for free 2.5-D stair navigation, robust 3D click selection,
// click-to-point routes, broad platforms and rolls with guarded cliff edges.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../beta',name),'utf8');
const modules=['alley-study-map.js','alley-generator.js','alley-stair-geometry.js',
 'alley-stair-navigation.js','alley-stair-controller.js','alley-vertical.js'];
const iso={
 toView(x,y,z=0){const u=x/48,v=y/48;return {x:(u-v)*42,y:(u+v)*24-z};},
 toWorld(x,y,z=0){const diff=x/42,sum=(y+z)/24;return {
  x:(sum+diff)*24,y:(sum-diff)*24};}
};
const center=pts=>({x:pts.reduce((a,p)=>a+p.x,0)/pts.length,
 y:pts.reduce((a,p)=>a+p.y,0)/pts.length});
const moved=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=actor=>({x:actor.x/48,y:actor.y/48});
function make(seed,style=''){
 const window={location:{search:'?szene=gasse&modus=generator&seed='+seed+
  (style?'&treppe='+style:'')}};
 const context={window,URLSearchParams};
 for(const name of modules)vm.runInNewContext(read(name),context,{filename:name});
 return window.AlleyVertical;
}
const kinds=new Set();
for(let seed=0;seed<32;seed++){
 const v=make(seed),plan=v.plan,nav=v.navigation,actor={
  x:plan.bottom.x*48,y:plan.bottom.y*48,dir:0};
 kinds.add(plan.kind);
 assert(nav.nodes.length>25,'polygon navmesh must have real 2D nodes');
 for(const step of plan.steps){
  const top=iso.toView(step.center.x*48,step.center.y*48,step.z);
  const hit=v.pickStair(top,iso);
  assert(hit&&hit.part===step,
   'top face must resolve its correct tread even if the projection overlaps');
  assert(nav.canStand(hit.point),'every click must resolve to a safe point');
  const a=center(step.start),face=iso.toView(a.x*48,a.y*48,(step.z+step.prev)/2);
  assert(v.pickStair(face,iso),'clicks on risers should also select stairs');
 }
 assert.equal(v.pickStair({x:99999,y:99999},iso),null);
 assert(v.boardStairs(actor,true),'bottom gate is required for boarding');
 const initial=point(actor);
 for(let i=0;i<15;i++)v.advanceStairs(actor,1/60,180);
 assert(moved(initial,point(actor))<1e-6,
  'standing without movement or a click must not activate autopilot');
 const middle=plan.steps[Math.floor(plan.steps.length/2)];
 const middleClick=v.pickStair(iso.toView(
  middle.center.x*48,middle.center.y*48,middle.z),iso);
 assert(v.aimStairs(middleClick));
 let frames=0;
 while(v.state.stairRide?.path&&frames++<1200){
  v.advanceStairs(actor,1/60,180);
  assert(nav.canStand(point(actor)),'click-to-point route must not leave the mesh');
 }
 assert(frames<1200&&v.state.stairRide,
  'a click on a middle tread must stop there, not continue up the stairs');
 const initialSide=point(actor);
 const forward={x:middle.end[0].x-middle.start[0].x,
  y:middle.end[0].y-middle.start[0].y},d=Math.hypot(forward.x,forward.y)||1;
 for(let i=0;i<36;i++){
  v.advanceStairs(actor,1/60,180,-forward.y/d,forward.x/d);
  assert(nav.canStand(point(actor)),
   'free lateral stair movement must remain inside the entire protected mesh');
 }
 assert(moved(initialSide,point(actor))>.12,
  'the player must be able to leave the old centreline');
 for(let i=0;i<20;i++){
  v.advanceStairs(actor,1/60,540,-forward.y/d,forward.x/d,{rolling:true});
  assert(nav.canStand(point(actor)),
   'a fast dodge must slide against a cliff edge instead of falling');
 }
 assert(v.aimStairs({point:plan.top,part:plan.top}));
 frames=0;
 while(v.state.stairRide&&frames++<1400)
  v.advanceStairs(actor,1/60,180);
 assert(frames<1400&&v.state.floor===1,'stair head must reach the upper floor');
 assert(v.boardStairs(actor,false,{point:plan.bottom,part:plan.bottom}),
  'upstairs entry must lead downward through the same safe polygon mesh');
 frames=0;
 while(v.state.stairRide&&frames++<1400)
  v.advanceStairs(actor,1/60,180);
 assert(frames<1400&&v.state.floor===0,'descent must reach ground floor');
}
assert.equal(kinds.size,8,'the fixture must exercise all eight stair families');
const u=make(4,'switchback'),hero={x:u.plan.bottom.x*48,y:u.plan.bottom.y*48};
assert(u.boardStairs(hero,true,u.plan.landings[0]));
let frames=0;
while(u.state.stairRide?.path&&frames++<1200)
 u.advanceStairs(hero,1/60,180);
assert(frames<1200&&u.state.stairRide&&Math.abs(u.state.z-66)<.1,
 'the U-platform is a walkable horizontal surface, not an automatic transition');
console.log('32 levels: all eight stair families, every tread/riser click, radius-safe free XY movement, rolling, plateau and two-way routes OK');
