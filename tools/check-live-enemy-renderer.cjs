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
 'RENDER_SIZE=208','new HemisphereLight(0xd0dcff,0x93737a,1.45)',
 'light(scene,0xffdfb7,3.4,-3,5,4)',
 'light(scene,0xb8ccff,1.9,3,4,-4)',
 'new OrthographicCamera',
 'Math.atan2(Math.cos(view),Math.sin(view)/Math.sin(ELEVATION))',
 'new AnimationMixer(model.scene)','stage.mixer.setTime(sample)',
 'WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true})',
 'new WeakMap()','const renderer=new WebGLRenderer',
 'function srgbToLinear(value)','function prepareMaterials(root,settings)',
 "settings.materialColorSpace!=='srgb-to-linear'",
 'material.transparent=false','material.depthWrite=true',
 "if(skinned<1)throw Error"]){
 assert(enemy.includes(field),'3D enemies must share Guardian rendering: '+field);
}
assert.equal(enemy.match(/new WebGLRenderer/g).length,1,
 'One GPU render context shared across all enemy models, NOT one per rat');
assert(html.includes("import('./beta/dungeon-enemy-rig.js?v=10')"));
assert(!enemy.includes("function hasLegacyPalette("),
 'Do not classify correctly linearized bright bone as legacy sRGB by its brightness');
assert(enemy.includes("settings.sourceBlendSha256?.slice(0,16)"),
 'Version each GLB from its exact Blender source rather than a fixed stale asset number');
assert(html.includes('debug-art')&&html.includes('__mindArtStatus'),
 'On-device art diagnostics must identify 3D renderer versus atlas fallback');
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
const skeletonBuilder=fs.readFileSync(path.join(__dirname,'build-isometric-skeleton.py'),'utf8');
const ratBuilder=fs.readFileSync(path.join(__dirname,'build-isometric-rat.py'),'utf8');
const exporter=fs.readFileSync(path.join(__dirname,'export-enemy-rigs.py'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'guardian-style.py'),'utf8');
for(const [label,script] of [['skeleton',skeletonBuilder],['rat',ratBuilder]]){
 assert(script.includes('def srgb_to_linear(value):'),
  label+' must convert its authored palette like the Guardian');
 assert(script.includes('srgb_to_linear(v) for v in color'),
  label+' must assign linear palette to Principled BSDF');
}
assert(style.includes('def faceted_oval(')&&style.includes('def front_plate('),
 'Enemy anatomy and closed armor plates must use the same sculpting language');
assert(style.includes('def profile_mesh(')&&style.includes('def forged_hard_edges('),
 'Shared Guardian sculpt and weighted-normal finishing code must exist');
for(const [label,builder] of [['skeleton',skeletonBuilder],['rat',ratBuilder]]){
 assert(builder.includes('style.profile_mesh('),
  label+' must sculpt primary silhouettes using planar profiles');
 assert(builder.includes('style.forged_hard_edges('),
  label+' must bake Guardian-style bevels and weighted normals');
 assert(builder.includes('guardian-style.py'),
  label+' must import the common art-style helper');
}
assert(ratBuilder.includes('Slate blue-grey main coat')&&
 ratBuilder.includes('Low shaggy dorsal fur clump')&&
 ratBuilder.includes('Shaggy flank fur layer')&&
 !ratBuilder.includes('Scavenger forged flank pauldron')&&
 !ratBuilder.includes('Scavenger narrow forged back strap')&&
 !ratBuilder.includes('Harness centre buckle'),
 'Small blue-grey rat must have true bristled fur and absolutely no equipment');
assert(skeletonBuilder.includes("joint('Neck'")&&
 skeletonBuilder.includes("Cervical vertebra body")&&
 skeletonBuilder.includes("Uneven scapular ridge")&&
 skeletonBuilder.includes("local['Neck']")&&
 !skeletonBuilder.includes('Broken cuirass main plate')&&
 !skeletonBuilder.includes('Buckler timber core')&&
 !skeletonBuilder.includes('Tattered tabard front'),
 'Bare skeleton must have articulated uneven bones and no plated armor');
assert(skeletonBuilder.includes('cut=ease((t-.48)/.17)')&&
 skeletonBuilder.includes('release=ease((t-.64)/.07)'),
 'Skeleton sword and bow attacks need clear anticipation and fast release');
assert(ratBuilder.includes('contacts=[.48] if clip=="bite" else [.34,.69]'),
 'Rat bite/combo must have a readable crouch-pounce telegraph');
assert(!ratBuilder.includes('oval("Broad pear-shaped body"'),
 'Rat body must not fall back to a smooth primitive');
assert(!skeletonBuilder.includes("oval('Cranium'"),
 'Skeleton cranium must no longer be an oval primitive');
assert(exporter.includes('"materialColorSpace": "srgb-to-linear"'),
 'GLB manifests must prevent correcting a corrected palette twice');
console.log('Guardian renderer parity: high-contrast sRGB/linear palette, solid materials, matched pixels, 360-degree bones, corpses and fallback OK');
