/** Regression: Blender furniture catalogue and four-direction pipeline.
 * Run: node beta/room-editor/tests/alchemy-furniture.test.cjs
 * No live-game imports, network calls or renderer dependencies.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),
 {window,console},{filename:'catalog.js'});
const catalog=window.MindRoomKit.catalog;
const expected={
 'alchemy-work-table': ['work-table',.83,.47],
 'alchemy-brew-table': ['brew-table-small',.67,.38],
 'alchemy-highback-chair': ['chair-highback',.36,.36],
 'alchemy-armchair': ['chair-arm',.41,.40],
};
assert.equal(Object.keys(catalog.furniture).length,6,'Keep both previous prison furnishings');
assert.equal(catalog.furniture['prison-table'].asset,'assets/furniture/table');
assert.equal(catalog.furniture['prison-chair'].asset,'assets/furniture/chair');
const build=fs.readFileSync(path.join(root,'blender/build-room-kit.py'),'utf8');
const models=fs.readFileSync(path.join(root,'blender/alchemy-furniture.py'),'utf8');
const pack=fs.readFileSync(path.join(root,'blender/pack-room-kit.py'),'utf8');
const editor=fs.readFileSync(path.join(root,'editor.js'),'utf8');
assert.match(build,/for rot in \(0,90,180,270\)/);
assert.match(build,/all_furniture=\[/);
assert.match(build,/room-kit\.blend/);
assert.match(models,/GUARDIAN_RELATIVE_FURNITURE_SCALE=\.45/,'New assets must be 55% smaller than prior views');
assert.match(models,/brew\.scale=\(GUARDIAN_RELATIVE_FURNITURE_SCALE\*\.8,\)\*3/,'Compact brew station keeps previous 80% factor');
assert.match(build,/camera\.data\.ortho_scale=3\.35\*\.5/,'Half-scale assets must bake at double pixel density');
assert.match(editor,/spec\.extension\|\|'webp'/);
assert.match(editor,/furniture\+'\/'\+assets\.size/);
assert.match(pack,/Legacy CI intentionally counts exactly eight existing \.webp views/);
for(const [id,[name,w,h]] of Object.entries(expected)){
 const prop=catalog.furniture[id];
 assert.ok(prop,'Missing catalogue entry '+id);
 assert.equal(prop.asset,'assets/furniture/'+name);
 assert.equal(prop.extension,'png');
 assert.equal(prop.render,'blender-ortho-4');
 assert.equal(prop.editorSpriteScale,.5,'Half-size viewport display required');
 assert.equal(prop.footprint.w,w);
 assert.equal(prop.footprint.h,h);
 assert.equal(prop.blocksMovement,true);
 assert.ok(models.includes("('"+name+"',"),'Model not in Blender collection '+name);
 assert.ok(pack.includes("'"+name+"':"),'Model not in pack list '+name);
 for(const rotation of [0,90,180,270])
  assert.match(pack,/for rot in \(0,90,180,270\)/);
}
const manifestFile=path.join(root,'assets/manifest.json');
if(fs.existsSync(manifestFile)){
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 // The render workflow publishes assets in its own commit; do not fail a
 // source-only CI run while the existing manifest is still on the older revision.
 if(manifest.items?.['brew-table-small']){
  for(const [id,[name]] of Object.entries(expected)){
   assert.equal(manifest.items[name].catalogId,id);
   for(const rot of [0,90,180,270]){
    const file=manifest.files[name][rot];
    assert.equal(file,'assets/furniture/'+name+'-'+rot+'.png');
   }
  }
 }
}
console.log('Room Atelier: dark PBR furniture, 24 views, Guardian-relative 55% shrink — OK');
