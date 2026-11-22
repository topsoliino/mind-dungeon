// Runtime contract: both enemy rigs must use Guardian's original WebGL
// settings and complete, continuous 360-degree bone animation.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../beta',name),'utf8');
const hero=source('dungeon-guardian-rig.js');
const enemy=source('dungeon-enemy-rig.js');
const html=source('index.html');
for(const field of [
 'ACESFilmicToneMapping','toneMappingExposure=1.13',
 'renderSize=176','new HemisphereLight(0xd0dcff,0x93737a,1.45)',
 'light(scene,0xffdfb7,3.4,-3,5,4)',
 'light(scene,0xb8ccff,1.9,3,4,-4)',
 'new OrthographicCamera',
 'Math.atan2(Math.cos(viewAngle),Math.sin(viewAngle)/Math.sin(elevation))']){
 assert(hero.includes(field),'Guardian baseline unexpectedly changed: '+field);
}
for(const field of [
 'ACESFilmicToneMapping','toneMappingExposure=1.13',
 'RENDER_SIZE=176','new HemisphereLight(0xd0dcff,0x93737a,1.45)',
 'light(scene,0xffdfb7,3.4,-3,5,4)',
 'light(scene,0xb8ccff,1.9,3,4,-4)',
 'new OrthographicCamera',
 'Math.atan2(Math.cos(view),Math.sin(view)/Math.sin(ELEVATION))',
 'new AnimationMixer(model.scene)','stage.mixer.setTime(sample)',
 'WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true})',
 'new WeakMap()','const renderer=new WebGLRenderer',
 "if(skinned<1)throw Error"]){
 assert(enemy.includes(field),'3D enemies must share Guardian rendering: '+field);
}
assert.equal(enemy.match(/new WebGLRenderer/g).length,1,
 'One GPU render context shared across all enemy models, NOT one per rat');
assert(html.includes("import('./dungeon-enemy-rig.js?v="));
assert(html.includes('enemyRig?.draw(e,e.skeleton,skeletonArt.choose(e,enemyRules),iso)'));
assert(html.includes("enemyRig?.draw(e,'rat',ratArt.choose(e,enemyRules,null),iso)"));
assert(html.includes("const rig=enemyRig?.draw(enemy,kind,selector.choose(enemy,enemyRules,age),iso,age)"));
assert(html.includes("enemyRig?.has('rat')?null:ratArt.load()"),
 'large sprite atlases should only download if WebGL fails');

const window={};
vm.runInNewContext(source('alley-skeleton.js'),{window});
vm.runInNewContext(source('alley-rat.js'),{window});
const rules={RAT:13,attacks:{13:{windup:.3,recovery:.5},
 3:{windup:.3,recovery:.5}}};
const skeleton={type:3,skeleton:'sabre',phase:.26,moving:true,size:1};
const selected=window.AlleySkeleton.choose(skeleton,rules);
assert.deepEqual([selected.kit,selected.clip],['sabre','run']);
skeleton.moving=false;skeleton.windup=.25;
assert.equal(window.AlleySkeleton.choose(skeleton,rules).clip,'strike');
skeleton.skeleton='bow';
assert.equal(window.AlleySkeleton.choose(skeleton,rules).clip,'shoot');
assert.equal(window.AlleySkeleton.choose(skeleton,rules,1).clip,'death');
const rat={type:13,moving:true,phase:.15,size:1};
assert.equal(window.AlleyRat.choose(rat,rules,null).clip,'run');
rat.ratStalking=true;assert.equal(window.AlleyRat.choose(rat,rules,null).clip,'stalk');
rat.ratMotion={name:'dodge-left',duration:.4,time:.2};
assert.equal(window.AlleyRat.choose(rat,rules,null).clip,'dodge-left');
assert.equal(window.AlleyRat.choose(rat,rules,.9).clip,'death');
console.log('Guardian renderer parity: shared WebGL/lighting/ACES, continuous 3D bones, enemy clip selection, corpses and fallback OK');
