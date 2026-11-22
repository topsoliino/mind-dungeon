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
 'WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true})',
 'new WeakMap()','const renderer=new WebGLRenderer',
 'function srgbToLinear(value)','function prepareMaterials(root,settings)',
 "settings.materialColorSpace!=='srgb-to-linear'",
 'material.transparent=false','material.depthWrite=true',
 "if(skinned<1)throw Error"]){
 assert(enemy.includes(field),'3D enemies must share Guardian rendering: '+field);
}
assert.equal(enemy.match(/new WebGLRenderer/g).length,2,
 'One gameplay GPU context plus one offline-only atlas baking context');
assert(html.includes("import('./beta/dungeon-enemy-rig.js?v=24')"));
assert(!enemy.includes("function hasLegacyPalette("),
 'Do not classify correctly linearized bright bone as legacy sRGB by its brightness');
assert(enemy.includes("settings.sourceBlendSha256?.slice(0,16)"),
 'Version each GLB from its exact Blender source rather than a fixed stale asset number');
assert(html.includes('debug-art')&&html.includes('__mindArtStatus'),
 'On-device art diagnostics must identify 3D renderer versus atlas fallback');
assert(html.includes("enemyRig?.draw(e,e.skeleton,skeletonArt.choose(e,enemyRules),iso)"));
assert(!html.includes('skeletonArt.sprites('),
 'The low-quality legacy skeleton atlases must NEVER render again');
assert(!html.includes('const skeletonReady=alley?skeletonArt.load()'),
 'Do not decode retired skeleton WebP atlases at startup');
assert(source('alley-skeleton.js').includes('atlas-'+"'"+'+kit')||
 source('alley-skeleton.js').includes("'beta/art/skeleton/atlas-'"),
 'Skeleton atlases must be built from the Guardian-derived GLBs');
assert(source('alley-skeleton.js').includes('return {choose,encounters,load,hasBaked,loaded,sprite}')&&
 !source('alley-skeleton.js').includes('safeImage('),
 'Only authentic baked Blender skeletons and live GLB may render');
assert(html.includes("enemyRig?.draw(e,'rat',ratArt.choose(e,enemyRules,null),iso)"));
assert(html.includes("enemyRig?.beginFrame(renderStats.fps)"));
assert(html.includes("only:enemyArtPreview?null:['sabre','bow']"));
assert(enemy.includes('const frames=new Map(),MAX_FRAMES=176'));
assert(enemy.includes('lastImage:stage.idleImage')&&
 enemy.includes('const cached=frames.get(signature)'),
 'Every enemy must reuse the shared genuine 3D GLB pose cache');
assert(enemy.includes('cachedTextureKeys')&&enemy.includes('live:false')&&
 html.includes('enemyRig?.cachedTextureKeys?.()'),
 'Phaser needs a bounded immutable pose-texture cache, not per-enemy uploads');
assert(enemy.includes('const ghostProps=[]')&&
 html.includes('ghostFog?.set3DFrames(renderer.ghostProps)'),
 'Small poison spheres must avoid 24 unnecessary GLB GPU pre-renders');
assert(enemy.includes('cacheHits:0'));
assert(html.includes('const visibleEnemies=enemies.filter(e=>onScreen(e))'));
assert(html.includes("const rig=enemyRig?.draw(enemy,kind,selector.choose(enemy,enemyRules,age),iso,age)"));
assert(html.includes('const ratReady=alley?ratArt.load()'),
 'Use baked rat frames to avoid expensive live GPU skinning');

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
rat.ratStalking=false;rat.angle=0;rat.facing=0;
rat.ratMoveAngle=Math.PI/2;
assert.equal(window.AlleyRat.choose(rat,rules,null).clip,'strafe-right');
rat.ratMoveAngle=-Math.PI/2;
assert.equal(window.AlleyRat.choose(rat,rules,null).clip,'strafe-left');
rat.ratMoveAngle=Math.PI;
assert.equal(window.AlleyRat.choose(rat,rules,null).clip,'back');
rat.ratMotion={name:'dodge-left',duration:.4,time:.2};
assert.equal(window.AlleyRat.choose(rat,rules,null).clip,'dodge-left');
assert.equal(window.AlleyRat.choose(rat,rules,.9).clip,'death');
const skeletonBuilder=fs.readFileSync(path.join(__dirname,'build-isometric-skeleton.py'),'utf8');
const ratBuilder=fs.readFileSync(path.join(__dirname,'build-isometric-rat.py'),'utf8');
const exporter=fs.readFileSync(path.join(__dirname,'export-enemy-rigs.py'),'utf8');
const furBuilder=fs.readFileSync(path.join(__dirname,'creature_fur.py'),'utf8');
const furRuntime=source('creature-fur.js');
const oldGuardian=fs.readFileSync(path.join(__dirname,'build-player-sprite-study.py'),'utf8');
for(const helper of ['def mesh(', 'def profile(', 'def limb(', 'def plate(',
 'def point(', 'def bend_joint(', 'def attached(', 'def gait_foot(']){
 assert(oldGuardian.includes(helper),
  'Guardian reference has changed: '+helper);
 assert(skeletonBuilder.includes(helper),
  'Fresh skeleton must use original Guardian model/IK primitive: '+helper);
}
assert(skeletonBuilder.includes('def srgb_to_linear(v):')&&
 skeletonBuilder.includes('srgb_to_linear(v) for v in rgb'),
 'Skeleton uses Guardians original sRGB conversion, not old palettes');
assert(skeletonBuilder.includes("'Ossuary guardian-IK armature'")&&
 skeletonBuilder.includes("profile('Ossuary cranium'")&&
 skeletonBuilder.includes("Uneven iliac wing")&&
 skeletonBuilder.includes("Anatomical rib")&&
 skeletonBuilder.includes("Bow yew limb")&&
 skeletonBuilder.includes("Saber wrapped grip")&&
 skeletonBuilder.includes("def sample_pose("),
 'Full bone geometry, Guardian pose solver and two weapon variants must be rebuilt');
assert(!skeletonBuilder.includes('style.profile_mesh(')&&
 !skeletonBuilder.includes('Broken cuirass main plate')&&
 !skeletonBuilder.includes('Buckler timber core'),
 'Legacy skeleton architecture and armor must be deleted, not restyled');
for(const helper of ['def mesh(', 'def profile(', 'def limb(', 'def plate(',
 'def point(', 'def bend_joint(', 'def attached(', 'def gait_foot(']){
 assert(ratBuilder.includes(helper),
  'New rat must use the Guardian source geometry/IK helper: '+helper);
}
assert(ratBuilder.includes('def material(name,hex_color')&&
 ratBuilder.includes('srgb_to_linear(v) for v in rgb')&&
 ratBuilder.includes('Guardian IK rat quadruped')&&
 ratBuilder.includes('Guardian rat slate-blue fur')&&
 ratBuilder.includes('Guardian rat graphite underfur')&&
 ratBuilder.includes('Guardian rat silver guard hairs')&&
 ratBuilder.includes('Shaggy slate-blue torso')&&
 ratBuilder.includes('Compact flank guard hairs')&&
 ratBuilder.includes('def sample_pose('),
 'The old rat must be discarded and replaced with the genuine Guardian pipeline');
assert(!ratBuilder.includes('style.profile_mesh(')&&
 !ratBuilder.includes('guardian-style.py')&&
 !ratBuilder.includes('Scavenger forged')&&
 !ratBuilder.includes('saddle')&&
 !ratBuilder.includes('pauldron'),
 'No legacy rat sculpt pipeline or equipment may survive');
assert(ratBuilder.includes('"rat_"+clip')&&
 ratBuilder.includes('MIND_DUNGEON_RIG_ONLY')&&
 ratBuilder.includes('def place_paw('),
 'Retain all existing 3D clip names with Guardian planted-paw animation');
assert(ratBuilder.includes('add_coat("Rat torso dense underwool"')&&
 ratBuilder.includes('add_coat("Fully furred skull and cheeks"')&&
 ratBuilder.includes('add_limb_fur("Lower hindleg coat "')&&
 furBuilder.includes('def groom_coat(')&&
 furBuilder.includes('def groom_limb(')&&
 furBuilder.includes('uv.data[loop].uv')&&
 furRuntime.includes('prepareCreatureFur')&&furRuntime.includes('updateCreatureFur')&&
 enemy.includes('stage.fur=prepareCreatureFur(model.scene)')&&
 enemy.includes('updateCreatureFur(stage.fur,enemy,selection,state)'),
 'Reusable Blender fur groom and spring shader must be connected to live rigs');
assert(exporter.includes('"materialColorSpace": "srgb-to-linear"'),
 'Exporter must not gamma-correct live rigs twice');
console.log('Guardian original-model skeleton and unchanged rat contracts OK');
