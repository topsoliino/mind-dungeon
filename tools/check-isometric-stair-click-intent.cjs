// Regression: ground clicks on an elevated stair must descend and retain the
// flat-ground destination. The hidden upper floor gets a visible exit beacon.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../beta',name),'utf8');
const names=['alley-study-map.js','alley-generator.js','alley-stair-geometry.js',
 'alley-stair-navigation.js','alley-stair-controller.js','alley-vertical.js',
 'alley-route.js','alley-architecture.js','alley-study.js','dungeon-isometric.js'];
const html=read('index.html'),noop=()=>{};
const ctx=()=>new Proxy({createLinearGradient:()=>({addColorStop:noop}),
 createRadialGradient:()=>({addColorStop:noop}),
 measureText:()=>({width:8})},{get:(obj,k)=>k in obj?obj[k]:noop,
 set:(obj,k,v)=>(obj[k]=v,true)});
const doc={currentScript:{src:'https://example.org/beta/alley-architecture.js'},
 createElement:()=>({width:0,height:0,getContext:ctx})};
class Image{set src(v){this._src=v;}}
const cut=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a);
 assert(a>=0&&b>a,'missing integrated click handler '+start);
 return html.slice(a,b);
};
const clickSource=cut('function alleyClickScreen(){','function approachAlleyVertical(){');
const poseSource=cut('function alleyGuardianPose(){','function alleySprites(actor){');
const result=[];
function build(type){
 const win={location:{search:'?szene=gasse&modus=generator&seed=4147&treppe='+type},
  DungeonWorld:{TILE:48,HERO_RADIUS:14}};
 const scope={window:win,document:doc,Image,URL,URLSearchParams};
 for(const name of names)vm.runInNewContext(read(name),scope,{filename:name});
 return win;
}
for(const kind of ['switchback','curved']){
 const w=build(kind),iso=w.DungeonIsometric,alley=iso.create(),
  vertical=w.AlleyVertical,plan=vertical.plan,
  actor={x:plan.bottom.x*48,y:plan.bottom.y*48,dir:0};
 assert.equal(plan.kind,kind,'request must select the expected stair');
 assert(vertical.boardStairs(actor,true));
 const mouse={x:0,y:0};
 const ui=new Function('alleyVertical','alley','iso','renderedView','cam',
  'cw','ch','mouse','alleySneaking','frame','tell','player',
  'finishAlleyApproach',`
 let alleyRoute=null,alleyMove=null,alleyMarker=null,
  alleyQueuedLight=null,alleyStairFloorGoal=null;
 ${clickSource}
 return {approachClickStairs,aimAlleyStairFloor,alleyUpperExitMark,
  alleyUnderpassMark,get floorGoal(){return alleyStairFloorGoal}};
 `)(vertical,alley,iso,{x:0,y:0,zoom:1},{x:0,y:0},0,0,
  mouse,false,20,noop,actor,noop);
 const inputSource=cut('function movementInput(){','function setControllerPrompts(');
 const readInput=new Function('keys','alley','generationMode','iso','noMovement',
  'controllerMove',inputSource+';return movementInput();');
 for(const [key,screenX,screenY] of [['KeyW',0,-1],['KeyD',1,0],['ArrowLeft',-1,0]]){
  const delta=readInput({[key]:true},alley,true,iso,{x:0,y:0},{x:0,y:0});
  const origin=iso.toView(0,0),end=iso.toView(delta.x,delta.y);
  const dx=end.x-origin.x,dy=end.y-origin.y;
  assert(Math.abs(dx*screenY-dy*screenX)<1e-8&&dx*screenX+dy*screenY>0,
   key+' must steer the actual generator in screen space');
 }
 const top=ui.alleyUpperExitMark();
 assert(top,'hidden upstairs floor must still have an exit target');
 mouse.x=top.center.x;mouse.y=top.center.y;
 assert(ui.approachClickStairs(),'the upstairs exit marker must be clickable');
 assert.equal(vertical.state.stairRide.exitTarget,1,'marker targets upstairs');
 // The exact same sprint clip, not the old forced stair-walk clip, must run
 // while the guardian is actually on the stair surface.
 const pose=new Function('alleyVertical','player','alleySneaking',
  'alleyGaitBlend','alleyGait','frame','alleyHit','alleyChest','alleySwing',
  'heldAttack','consumeMove','combatClock','alleyNextLight',
  'alleyGaitMode','guardian','alley',`${poseSource}
 return alleyGuardianPose();`)(vertical,{moving:true,dir:0,moveAngle:0,
 dash:0},false,1,.32,10,null,null,null,null,null,0,'down','run',
 {atlas:{knockback:{}}},alley);
 assert.equal(pose.clip,'sprint','running stairs must use the real sprint rig');
 let ascent=0;
 while(vertical.state.z<vertical.height*.9&&ascent++<1600)
  vertical.advanceStairs(actor,1/60,180);
 assert(vertical.state.stairRide&&ascent<1600,'reach the visible upper deck');
 const deck=iso.toView(vertical.ladder.top.x*48,vertical.ladder.top.y*48,vertical.height);
 assert(ui.aimAlleyStairFloor(deck),'click on visible upper floor');
 assert.equal(ui.floorGoal.floor,1);
 assert.equal(vertical.state.stairRide.exitTarget,1);
 assert.equal(vertical.state.floor,0,'stay aboard until the portal');
 const ground=iso.toView(alley.spawn.x,alley.spawn.y,0);
 mouse.x=ground.x;mouse.y=ground.y;
 assert(!ui.approachClickStairs(),'floor click must not be misclassified as a tread');
 assert(ui.aimAlleyStairFloor(ground),
  'a floor click must plan a descent rather than be ignored');
 assert.equal(vertical.state.stairRide.exitTarget,0);
 assert(ui.floorGoal&&Math.hypot(ui.floorGoal.target.x-alley.spawn.x,
  ui.floorGoal.target.y-alley.spawn.y)<15,
  'the actual ground target must survive the stair descent');
 let frames=0;
 while(vertical.state.stairRide&&frames++<1600)
  vertical.advanceStairs(actor,1/60,180);
 assert(frames<1600&&vertical.state.floor===0,'must reach the ground portal');
 assert(alley.routeTo(actor,ui.floorGoal.target),
  'the remembered ground click must be reachable after exiting');
 // Even from a separate room, clicking the floating upper exit guide must
 // plan a path to the stair foot first (while the upstairs floor stays hidden).
 actor.x=alley.spawn.x;actor.y=alley.spawn.y;
 mouse.x=top.center.x;mouse.y=top.center.y;
 assert(ui.approachClickStairs(),'ground-to-upstairs beacon must trigger');
 assert(vertical.state.pending&&vertical.state.pending.up===true,
  'upper beacon from ground should approach the lower stair entrance');
 result.push({kind,groundClicks:true,upstairsBeacon:true,frames});
}
assert(html.includes('if(aimAlleyStairFloor(screen,e.altKey))return;'),
 'right-click handler must submit a floor intent while stair riding');
assert(html.includes('alleyMove={target:alleyStairFloorGoal.target,steps:null}'),
 'after portal completion, continue on the destination floor');
assert(html.includes('dot(top.center.x,top.center.y,7'),
 'upstairs beacon must be visibly rendered without the upper floor');
assert(html.includes("alleyGaitBlend*3"),
 'stair animation must use the standard walk-run-sprint blend');
console.log('Ground-click stair descent, deferred navigation, hidden upstairs beacon and movement blend OK: '+
 result.map(x=>x.kind).join(', '));
