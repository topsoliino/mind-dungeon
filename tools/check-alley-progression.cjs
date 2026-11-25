'use strict';
const assert=require('node:assert/strict');
const progression=require('../beta/alley-progression.js');
const rooms=Array.from({length:4},(_,id)=>({id}));
const doors=[{from:0,to:1},{from:1,to:2},{from:2,to:3}];
const gate={id:'gate',floor:0,from:1,to:2};
const lever={id:'lever',floor:1,room:3,localReachable:true};
const viaOtherFloor=progression.validate({rooms,doors,count:2,gates:[gate],levers:[lever],
 verticalLinks:[{fromFloor:0,fromRoom:0,toFloor:1,toRoom:0}]});
assert.equal(viaOtherFloor.ok,true);
assert.ok(viaOtherFloor.leverPaths[0].path.includes('1:3'));
const behindGate=progression.validate({rooms,doors,count:2,gates:[gate],levers:[lever],
 verticalLinks:[{fromFloor:0,fromRoom:2,toFloor:1,toRoom:2}]});
assert.equal(behindGate.ok,false);
assert.match(behindGate.reason,/nicht erreichbar/);
assert.equal(behindGate.leverPaths[0].path,null);
assert.equal(progression.validate({rooms,doors,count:1,gates:[gate],levers:[]}).missingLever,true);
assert.equal(progression.validate({rooms,doors,count:1,gates:[gate],levers:[{...lever,floor:0,room:1,localReachable:false}]}).ok,false);
const alternate=progression.validate({rooms,doors:[...doors,{from:0,to:2}],count:2,gates:[gate],levers:[{...lever,floor:0,room:3}],verticalLinks:[]});
assert.equal(alternate.ok,true);
console.log('Alley progression graph: multi-storey gate reachability and fail-open cases OK');
