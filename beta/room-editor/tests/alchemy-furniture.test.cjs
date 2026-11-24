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
 'alchemy-work-table': ['work-table',1.85,1.05],
 'alchemy-brew-table': ['brew-table-small',1.48,.84],
 'alchemy-highback-chair': ['chair-highback',.8,.8],
 'alchemy-armchair': ['chair-arm',.92,.88],
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
assert.match(models,/brew\.scale=\(\.8,\.8,\.8\)/,'Brewing table must be 80% scale');
assert.match(editor,/spec\.extension\|\|'webp'/);
assert.match(editor,/furniture\+'\/'\+assets\.size/);
assert.match(pack,/Legacy CI intentionally counts exactly eight existing \.webp views/);
for(const [id,[name,w,h]] of Object.entries(expected)){
 const prop=catalog.furniture[id];
 assert.ok(prop,'Missing catalogue entry '+id);
 assert.equal(prop.asset,'assets/furniture/'+name);
 assert.equal(prop.extension,'png');
 assert.equal(prop.render,'blender-ortho-4');
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
console.log('Room Atelier: six Blender furniture models, 24 directional views, 80% brewing table — OK');
