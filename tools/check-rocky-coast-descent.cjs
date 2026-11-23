// Regression: descending staircase must not be suppressed by the nearer
// (current-level) upward flight. Exercise the REAL index.html interaction.
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('beta/index.html','utf8');
const a=html.indexOf('function switchRockyStorey(delta){');
const b=html.indexOf('function goRockyFloor(',a);
assert(a>=0&&b>a,'Cannot extract actual Rocky Coast descent controller');
const run=new Function('rockyPrison','alleyVertical','player','alley','cam','tell',
 'let renderedView=null,alleyRoute=null,alleyMove=null,alleyMarker=null,'+
 'alleyStairFloorGoal=null;\n'+html.slice(a,b)+
 '\nreturn {descendAtLanding,get route(){return alleyRoute;}};');
function setup(distance){
 const link={kind:'stairs',id:'stone-stairs',top:{x:20,y:12},
  bottom:{x:10,y:11}};
 const state={floor:0,z:0,pending:null,transition:null,stairRide:null};
 const calls=[];
 const prison={storey:2,count:4,
  changeStorey(delta){this.storey+=delta;calls.push('storey:'+delta);return true;},
  atStorey(index,fn){calls.push('previous:'+index);return fn();}};
 const vertical={height:132,state,connectorsAt:()=>[link],
  nearby:()=>({distance:5}), // current upward flight is even closer
  boardStairs(actor,up,target){
   calls.push('board:'+up);
   if(state.floor!==1||up)throw Error('Wrong stair entry plane');
   state.stairRide={from:'top',target};return true;
  }};
 const player={x:link.top.x*48+distance,y:link.top.y*48};
 const alley={routeTo:()=>({goal:{x:link.top.x*48,y:link.top.y*48},
  steps:[{x:link.top.x*48,y:link.top.y*48}]})};
 const controller=run(prison,vertical,player,alley,{y:0},()=>{});
 return {prison,state,calls,controller};
}
const near=setup(14);
assert.equal(near.controller.descendAtLanding(),true,
 'E near the downhill hatch must descend even if the next upstairs stair is closer');
assert.equal(near.prison.storey,1,'Actual dungeon storey must decrement');
assert.equal(near.state.floor,1,'Physical descent begins at previous flight TOP');
assert(near.state.stairRide,'Descent must ride the existing navmesh, not teleport');
assert(near.calls.includes('previous:1')&&near.calls.includes('board:false'));
const far=setup(200);
assert.equal(far.controller.descendAtLanding(),false,
 'Far away downward hatch must not steal normal staircase interaction');
const approach=setup(80);
assert.equal(approach.controller.descendAtLanding(),true,
 'E within approach distance must route to a real downhill landing');
assert.equal(approach.prison.storey,2,'Approach alone never changes floors');
assert(approach.state.pending?.descent,'Approach retains precise descent target');
console.log('Physical downstairs E, queued approach and competing upstairs staircase OK');
