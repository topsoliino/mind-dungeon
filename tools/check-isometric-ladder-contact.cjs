// Protect actual wall contact between Blender Guardian and generated ladder.
// Run: node tools/check-isometric-ladder-contact.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../beta',file),'utf8');
const files=['alley-study-map.js','alley-generator.js','alley-stair-geometry.js',
 'alley-stair-navigation.js','alley-stair-controller.js','alley-vertical.js'];
function setup(seed){
 const window={location:{search:'?szene=gasse&modus=generator&seed='+seed}};
 const context={window,URLSearchParams};
 for(const file of files)vm.runInNewContext(read(file),context,{filename:file});
 return window;
}
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rad=a=>Math.atan2(Math.sin(a),Math.cos(a));
const close=(a,b,epsilon=1e-5)=>assert(Math.abs(a-b)<=epsilon,a+' != '+b);
const walls=new Set();
for(let seed=0;seed<200;seed++){
 const {AlleyVertical:v}=setup(seed),ladder=v.ladder,contact=v.ladderContact;
 const [u,w]=ladder.cell,dir={x:ladder.dx,y:ladder.dy};
 const wall={x:u+.5+dir.x*.38,y:w+.5+dir.y*.38};
 close(contact.wall.x,wall.x);close(contact.wall.y,wall.y);
 close(contact.climb.x,wall.x-dir.x*.30);
 close(contact.climb.y,wall.y-dir.y*.30);
 const midpoint={
  x:(contact.rails[0].x+contact.rails[1].x)/2,
  y:(contact.rails[0].y+contact.rails[1].y)/2
 };
 close(midpoint.x,wall.x);close(midpoint.y,wall.y);
 close(gap(midpoint,contact.climb),.30);
 close(gap(contact.rails[0],contact.rails[1]),.52);
 assert(v.insideTop(ladder.top.x,ladder.top.y,.29),
  'upper dismount must be collision-radius safe, seed '+seed);
 walls.add(ladder.wall);
 const transition=v.connectors.find(c=>c.kind==='ladder');
 assert(transition&&transition.face===ladder.face);
 for(const up of [true,false]){
  const start=up?transition.bottom:transition.top;
  const finish=up?transition.top:transition.bottom;
  const first=v.pose(transition,up,0),last=v.pose(transition,up,1);
  close(first.x,start.x*48);close(first.y,start.y*48);
  close(last.x,finish.x*48);close(last.y,finish.y*48);
  close(first.z,up?0:v.height);close(last.z,up?v.height:0);
  close(last.floor,up?1:0);
  assert.equal(first.clip,up?'climb-up':'climb-down');
  let previous=first.z,previousX=first.x,previousY=first.y;
  for(let i=1;i<=120;i++){
   const t=i/120,pose=v.pose(transition,up,t);
   const delta=Math.hypot(pose.x-previousX,pose.y-previousY);
   assert(delta<4.5,'sudden teleport during climb '+seed+' '+t);
   if(t>=.15&&t<=.85){
    close(pose.x,contact.climb.x*48,1e-3);
    close(pose.y,contact.climb.y*48,1e-3);
   }
   if(up)assert(pose.z>=previous-1e-7,'up height must be monotone');
   else assert(pose.z<=previous+1e-7,'down height must be monotone');
   previous=pose.z;previousX=pose.x;previousY=pose.y;
  }
  const midway=v.pose(transition,up,.5);
  close(midway.z,v.height*.5);
  close(rad(midway.angle-transition.face),0);
  const before=v.pose(transition,up,.84);
  close(rad(before.angle-transition.face),0);
  const after=v.pose(transition,up,1);
  close(Math.abs(rad(after.angle-transition.face)),Math.PI);
 }
}
assert.equal(walls.size,4,'test all four ladder wall orientations');
console.log('200 seeds: four wall orientations, shared painted rails, zero XY drift, continuous mount/top-out, radius-safe upper exits OK');
