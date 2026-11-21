// Run: node tools/check-isometric-stair-physics.cjs
// Cross-floor stair invariants: genuine connected landings, physical entry
// gates, bounded lateral motion, speed scaling inherited from DungeonStairs,
// bidirectional continuous Z and no escapes through the stair flank.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),read=p=>fs.readFileSync(path.join(__dirname,'../beta',p),'utf8');
const map=read('alley-study-map.js'),gen=read('alley-generator.js'),
 grammar=read('alley-stair-geometry.js'),vertical=read('alley-vertical.js');
function create(seed,style=''){
 const window={location:{search:'?szene=gasse&modus=generator&seed='+seed+
  (style?'&treppe='+style:'')}};
 const context={window,URLSearchParams};
 vm.runInNewContext(map,context);vm.runInNewContext(gen,context);
 vm.runInNewContext(grammar,context);vm.runInNewContext(vertical,context);
 return window.AlleyVertical;
}
const near=(a,b,epsilon=1e-5)=>Math.abs(a-b)<epsilon;
const seen=new Set();
for(let seed=0;seed<120;seed++){
 const v=create(seed),p=v.plan,s=v.state;
 seen.add(p.kind);
 assert(v.enabled);
 assert.equal(v.stairSpeed.straightUp,.68);
 assert.equal(v.stairSpeed.straightDown,.83);
 assert.equal(v.stairSpeed.curvedUp,.73);
 assert.equal(v.stairSpeed.curvedDown,.86);
 assert.equal(v.stairSpeed.landing,.95);
 assert.equal(v.stairSpeed.across,.58);
 const midway=p.steps[Math.floor(p.steps.length/2)].center;
 assert(v.blocksTop(midway.x,midway.y,.29),
  'an upper-floor walker cannot enter the stair from its flank');
 assert(!v.blocksTop(p.top.x,p.top.y,.29),
  'the upstairs stair-head gate remains accessible');
 assert(v.insideTop(p.top.x,p.top.y,.29),
  'the stair head must rest on a traversable upper landing');
 // Entry is only legal within .72 grid cells of the explicit foot or head.
 const actor={x:p.bottom.x*48,y:p.bottom.y*48,dir:0};
 const center=p.path[Math.floor(p.path.length/2)];
 assert(!v.boardStairs({x:center.x*48,y:center.y*48},true),
  'cannot enter halfway up the staircase');
 assert(v.boardStairs(actor,true),'bottom stair gate must accept entry');
 for(let j=0;j<12;j++)v.advanceStairs(actor,1/60,180);
 assert(near(s.stairRide.s,0),'entry must not automatically climb a single step');
 assert(v.aimStairs({center:p.top,z:132}),'the selected stair-head target must be reachable');
 assert(!v.boardStairs(actor,true),'cannot board an occupied staircase');
 let last=-1,frames=0;
 while(s.stairRide&&frames<1000){
  const out=v.advanceStairs(actor,1/60,180);
  assert(Number.isFinite(s.z)&&s.z>=-1e-6&&s.z<=132+1e-6);
  assert(s.z>=last-1e-5,'ascending height monotonic');
  last=s.z;frames++;
 }
 assert(frames<1000&&s.floor===1&&!s.stairRide,'ascent reaches upper story');
 assert(near(s.z,132));
 assert(near(actor.x,p.top.x*48)&&near(actor.y,p.top.y*48));
 assert(!v.boardStairs({x:p.bottom.x*48,y:p.bottom.y*48},true),
  'cannot board the downstairs entrance from the upper floor');
 assert(!v.boardStairs({x:p.bottom.x*48,y:p.bottom.y*48},false),
  'cannot descend from the wrong entry');
 assert(v.boardStairs(actor,false),'upper stair gate must accept descent');
 for(let j=0;j<12;j++)v.advanceStairs(actor,1/60,180);
 assert(near(s.stairRide.s,v.stairLength),'descent must not start without a target or movement');
 assert(v.aimStairs({center:p.bottom,z:0}));
 last=133;frames=0;
 while(s.stairRide&&frames<1000){
  v.advanceStairs(actor,1/60,180);
  assert(s.z<=last+1e-5,'descending height monotonic');
  last=s.z;frames++;
 }
 assert(frames<1000&&s.floor===0&&!s.stairRide);
 assert(near(actor.x,p.bottom.x*48)&&near(actor.y,p.bottom.y*48));
 assert(near(s.z,0));
 const internal=p.path[Math.floor(p.path.length/2)];
 assert(v.blocksGround(p.steps[0].center.x,p.steps[0].center.y,0),
  'the low underside is always solid');
 if(p.cfg.open)assert(p.steps.some(step=>step.prev-13>=92&&
   !v.blocksGround(step.center.x,step.center.y,0)),
   'open upper treads admit a guardian underneath');
 else assert(v.blocksGround(internal.x,internal.y,.29),
  'a closed stair is a solid collider');
 // Side push stays within guard rails even when applied for many frames.
 assert(v.boardStairs(actor,true));
 const ride=s.stairRide,origin=ride.s;
 for(let i=0;i<12;i++)v.advanceStairs(actor,1/60,180,0,0);
 assert(near(ride.s,origin),'input-driven stairs must stop without input');
 const entry=p.bottom,first=p.path[0];
 const dx=first.x-entry.x,dy=first.y-entry.y,d=Math.hypot(dx,dy);
 for(let i=0;i<12;i++)v.advanceStairs(actor,1/60,180,dx/d,dy/d);
 assert(ride.s>origin+.05,'input-driven stairs must move with forward input');
 assert(ride.targetS===null,'movement input overrides an automatic click target');
 for(let i=0;i<150;i++)v.advanceStairs(actor,1/60,180,1,0);
 assert(ride.s>=0&&ride.s<=v.stairLength);
 assert(Math.abs(ride.lateral)<=Math.max(0,p.width/2-.44)+1e-6,
  'no unrestricted lateral motion over the stair edge');
 s.stairRide=null;s.floor=0;s.z=0;
}
assert.equal(seen.size,8,'all eight stair families have physical traversal');
const u=create(4,'switchback').plan;
assert.equal(u.kind,'switchback');
assert.equal(u.landings.length,1);
const ledge=u.landings[0];
const distanceToEdge=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,
  ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
 return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
};
const onLandingEdge=p=>ledge.corners.some((a,i)=>
 distanceToEdge(p,a,ledge.corners[(i+1)%ledge.corners.length])<1e-5);
assert(u.steps[7].end.every(onLandingEdge)&&u.steps[8].start.every(onLandingEdge),
 'U stair flights must contact the same solid landing perimeter after rotation');
assert(near(u.path[2].z,66)&&near(u.path[3].z,66)&&near(u.path[4].z,66),
 'the U turn must remain at a constant mid-landing elevation');
// Clicking a genuine intermediate platform must target its polygon center
// without NaN coordinates, and stop at a constant-height part of the U turn.
const uFlight=create(4,'switchback'),uActor={x:uFlight.plan.bottom.x*48,
 y:uFlight.plan.bottom.y*48,dir:0};
assert(uFlight.boardStairs(uActor,true));
assert(uFlight.aimStairs(uFlight.plan.landings[0]));
const midTarget=uFlight.state.stairRide.targetS;
assert(Number.isFinite(midTarget)&&midTarget>0&&midTarget<uFlight.stairLength);
let platformFrames=0;
while(uFlight.state.stairRide?.targetS!==null&&platformFrames++<1200)
 uFlight.advanceStairs(uActor,1/60,180);
assert(platformFrames<1200&&uFlight.state.stairRide,
 'clicking a plateau stops there rather than finishing the staircase');
assert(near(uFlight.state.z,66,1e-2),'mid-platform elevation remains flat');
const curved=create(7,'curved').plan;
 assert(curved.cfg.open,'curved flight must have an open underside');
const prev=curved.path.at(-2),crest=curved.path.at(-1),exit=curved.top;
const a=Math.atan2(crest.y-prev.y,crest.x-prev.x),
 b=Math.atan2(exit.y-crest.y,exit.x-crest.x);
assert(Math.cos(a-b)>.94,
 'curved stair must leave the last rising tread tangentially, not radially');
assert(curved.landings.some(l=>l.top),'curved stair ends on real flat cap');
console.log('120 stair levels: 8 types, real U-landing contact, tangent curved crest, guarded sides, calibrated stair speeds and continuous two-way physics OK');
