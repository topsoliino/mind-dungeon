// Regression: preserve the actual skinned Guardian mesh in ordinary play
// and exclude reused Gasse houses/roof silhouettes from prison entrance L1.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const script=path=>fs.readFileSync('beta/'+path,'utf8');
const game=script('index.html'),study=script('alley-study.js'),rig=script('dungeon-guardian-rig.js');
assert(game.includes("guardianBaked=false;\n updateArtStatus()"),
 'The normal fast path must not opt into the obsolete eight-direction Guardian');
assert(!game.includes("guardianBaked=Boolean(await guardianArt.ensureFallback(data))"),
 'Never replace the player with the old sprite sheet at initial game load');
const adaptation=game.slice(game.indexOf('function adaptGuardianQuality(dt){'),
 game.indexOf('// Load genuine Blender GLB snapshots'));
assert(!adaptation.includes('guardianArt.ensureFallback'),
 'Low FPS can throttle 3D sampling, not alter the Guardian mesh');
const originalRender=game.slice(game.indexOf('function alleySprites(actor){'),
 game.indexOf('// New GPU snapshots',game.indexOf('function alleySprites(actor){')));
assert(originalRender.includes('guardian.rig&&!guardianBaked')&&
 originalRender.includes("add(rig.canvas,'alley-guardian-rig'"),
 'Both Canvas and Phaser must display the actual skinned Three.js GLB');
assert(rig.includes('const renderSize=176')&&rig.includes('renderer.render(scene,camera)')&&
 rig.includes('mixer.setTime('),'Use the original animated model at the original render resolution');
const homes=study.slice(study.indexOf('const prisonInterior='),study.indexOf('// A long wall spans'));
assert(homes.includes('const homes=prisonInterior?[]')&&
 homes.includes('const gateway=prisonInterior?null:'),
 'Procedural prison must not inherit Gasse houses or its trial arch');
const structures=study.slice(study.indexOf('function structures(x,y){'),
 study.indexOf('function architecture(ctx,x,y){'));
assert(structures.includes('if(!prisonInterior)result.push({image:gateway'),
 'No foreign arch sprite may be drawn across L1 entrance');
assert(study.includes('!prisonInterior&&solids.some'),
 'The invisible old Gasse arch collider must not block the prison entrance');
const forecourt=study.slice(study.indexOf('const street=combinedGround'),study.indexOf('if(street)bakedGround.push'));
assert(!forecourt.includes('facadeArt.skyline')&&
 !forecourt.includes('facadeArt.building')&&
 forecourt.includes('paving(ctx,surface,random)'),
 'Entry forecourt must be walkable paving without imported house silhouettes');
console.log('Original live 3D player and clean L1 prison forecourt verified');
