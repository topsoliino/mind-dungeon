// node tools/check-isometric-stair-exits.cjs
// Every stair admits ordinary walking through BOTH exits, without rolling,
// clicking or the historical narrow-point/velocity triggers.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),read=p=>fs.readFileSync(path.join(__dirname,'../beta',p),'utf8');
const modules=['alley-study-map.js','alley-generator.js','alley-stair-geometry.js',
 'alley-stair-navigation.js','alley-stair-controller.js','alley-vertical.js'];
const families=['straight-narrow','straight-wide','grand','quarter','switchback',
 'spiral-tight','spiral-wide','curved','switchback-closed'];
function setup(seed,style){
 const window={location:{search:'?szene=gasse&modus=generator&seed='+seed+'&treppe='+style}};
 const scope={window,URLSearchParams};
 for(const file of modules)vm.runInNewContext(read(file),scope,{filename:file});
 return window.AlleyVertical;
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pos=actor=>({x:actor.x/48,y:actor.y/48});
let tested=0;
for(const style of families){
 // Search a few fixed layouts; the exact requested staircase may not fit
 // a particular room, in which case the generator legitimately substitutes.
 let v=null;
 for(const seed of [4,8,7,3,2,4147,0,1,12]){
  const candidate=setup(seed,style);
  if(candidate.plan.kind===style){v=candidate;break;}
 }
 assert(v,'must be able to build stair family '+style);
 const actor={x:v.plan.bottom.x*48,y:v.plan.bottom.y*48,dir:0};
 for(const up of [true,false]){
  assert(v.boardStairs(actor,up),'could not enter '+style);
  const points=up?[...v.plan.path,v.plan.top]:
   [...v.plan.path].reverse().concat([v.plan.bottom]);
  let i=0,frames=0;
  while(v.state.stairRide&&frames++<1700){
   const at=pos(actor);
   while(i<points.length-1&&distance(at,points[i])<.15)i++;
   const target=points[i],step={x:target.x-at.x,y:target.y-at.y};
   let d=Math.hypot(step.x,step.y);
   if(d<.14){
    const lip=up?v.plan.path.at(-1):v.plan.path[0],
     exit=up?v.plan.top:v.plan.bottom;
    step.x=exit.x-lip.x;step.y=exit.y-lip.y;d=Math.hypot(step.x,step.y);
   }
   v.advanceStairs(actor,1/60,180,step.x/d,step.y/d);
  }
  assert(frames<1700&&v.state.floor===(up?1:0),
   style+' '+(up?'up':'down')+' must exit using ordinary movement');
  tested++;
 }
 // A second pass enters the same staircase from both floors close to the
 // side of the entry, proving the character isn't restricted to the midpoint.
 for(const up of [true,false]){
  const entry=up?v.plan.bottom:v.plan.top,
   lip=up?v.plan.path[0]:v.plan.path.at(-1),
   dx=entry.x-lip.x,dy=entry.y-lip.y,d=Math.hypot(dx,dy);
  const normal={x:dx/d,y:dy/d},side={x:-normal.y,y:normal.x},
   offset=v.plan.width*.27;
  actor.x=(entry.x+normal.x*.30+side.x*offset)*48;
  actor.y=(entry.y+normal.y*.30+side.y*offset)*48;
  assert(v.tryEnterStairs(actor,-normal.x,-normal.y),
   style+' must allow off-centre '+(up?'lower':'upper')+' entry');
  const exit=up?v.plan.top:v.plan.bottom;
  assert(v.aimStairs({part:exit,point:exit}));
  let frames=0;
  while(v.state.stairRide&&frames++<1600)
   v.advanceStairs(actor,1/60,180);
  assert(frames<1600&&v.state.floor===(up?1:0),
   style+' must complete off-centre entry and reach the opposite floor');
  tested++;
 }
}
// Physical underpass availability depends on standing vs crouched body
// height, not just whether the U-platform looks open.
const open=setup(4,'switchback'),closed=setup(4,'switchback-closed');
const deck=open.plan.landings[0],center={
 x:deck.corners.reduce((s,p)=>s+p.x,0)/deck.corners.length,
 y:deck.corners.reduce((s,p)=>s+p.y,0)/deck.corners.length
};
assert(open.blocksGround(center.x,center.y,.29,false));
assert(!open.blocksGround(center.x,center.y,.29,true));
assert(closed.blocksGround(center.x,center.y,.29,false));
assert(closed.blocksGround(center.x,center.y,.29,true));
// Ground combat and inventory actions must not be gated on stairRide.
const html=read('index.html');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
assert(!between('function startAttack(','const jumping=').includes('stairRide'),
 'stair riding must not block attacks');
const strike=between('function canStrike(){','function requestAlleyLight');
assert(!strike.includes('stairRide'),'light and heavy attacks work on stairs');
const anim=between('function alleyGuardianPose(){','function alleySprites(');
assert(anim.indexOf('if(consumeMove)')<anim.indexOf('if(alleyVertical?.state.stairRide)'),
 'food and potion animation must take precedence over stair gait');
console.log(tested+' manual two-way exits on '+families.length+
 ' stair styles, U underpass clearance and stair-action source guards OK');
