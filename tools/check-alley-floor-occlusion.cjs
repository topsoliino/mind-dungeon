// Height-aware enemy rendering contract. Both Blender skeletons and rats
// obey the exact same physical floor/occlusion result.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('beta/alley-floor-occlusion.js','utf8');
const scope={window:{}};vm.runInNewContext(code,scope);
const {evaluate}=scope.window.AlleyFloorOcclusion;
for(const kind of ['sabre','bow','rat']){
 const e={skeleton:kind==='rat'?null:kind,type:kind==='rat'?13:3,alleyFloor:0,alleyZ:0};
 assert.deepEqual({...evaluate(e,{base:0,viewFloor:0})},{visible:true,depthBand:0});
 assert.equal(evaluate(e,{base:0,viewFloor:1}).visible,false,
  'Enemy standing beneath an opaque upper slab must never show through');
 e.alleyFloor=1;e.alleyZ=0; // prison AI stores only its own floor-relative z
 assert.deepEqual({...evaluate(e,{base:0,viewFloor:1})},{visible:true,depthBand:7000});
 assert.equal(evaluate(e,{base:0,viewFloor:0}).visible,false,
  'Residents on the next floor must not leak down through the floor');
 e.alleyFloor=0;e.alleyClimb={from:0,to:1,up:true,age:4,duration:10};
 e.alleyZ=42;
 assert.equal(evaluate(e,{base:0,viewFloor:1,mouth:false}).visible,false,
  'Partway-up enemy remains hidden to hero on second floor');
 e.alleyClimb.age=8.5;e.alleyZ=118;
 assert.equal(evaluate(e,{base:0,viewFloor:1,mouth:false}).visible,false,
  'Even near top, no through-floor visibility outside the hatch aperture');
 const approaching=evaluate(e,{base:0,viewFloor:1,mouth:true});
 assert.equal(approaching.visible,true,'Real visible last treads reveal approaching enemy');
 assert.equal(approaching.depthBand,7000,'Only near crest may enemy sort ahead of slab');
 e.alleyClimb={from:1,to:0,up:false,age:1,duration:10};e.alleyFloor=1;e.alleyZ=118;
 assert.equal(evaluate(e,{base:0,viewFloor:0}).visible,false,
  'Descending enemy still physically upstairs may not pass through slab');
 assert.equal(evaluate(e,{base:0,viewFloor:1}).visible,true);
 e.alleyClimb.age=9;e.alleyZ=12;
 const arriving=evaluate(e,{base:0,viewFloor:0});
 assert.equal(arriving.visible,true,'Near bottom, descending enemy enters lower floor');
 assert.equal(arriving.depthBand,0,'Near bottom, sprite must draw BELOW upper slab');
 delete e.alleyClimb;e.alleyFloor=2;e.alleyZ=0;
 assert.equal(evaluate(e,{base:1,viewFloor:2}).depthBand,7000,
  'Higher prison storeys must not rely on literal alleyFloor===1');
}
const html=fs.readFileSync('beta/index.html','utf8');
assert(html.includes("window.AlleyFloorOcclusion.evaluate(e"),
 'Actual game must use physical occlusion rules');
assert(html.includes("sprites.push({...baked,depth})"),
 'Animated Blender skeleton sprites must inherit height-aware depth');
assert(html.includes("frames.map(sprite=>({...sprite,depth}))"),
 'Rat atlas sprites must inherit the SAME depth as skeletons');
assert(!html.includes("if(!onScreen(enemy)||rockyPrison&&!enemySameFloor(enemy))"),
 'Corpses must not skip physical occlusion checks');
console.log('36 skeleton/rat slab and stair-mouth visibility assertions OK');
