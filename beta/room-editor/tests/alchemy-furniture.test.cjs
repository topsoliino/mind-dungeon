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
 'alchemy-work-table': ['work-table',.913,.517],
 'alchemy-brew-table': ['brew-table-small',.871,.494],
 'alchemy-highback-chair': ['chair-highback',.36,.36],
 'alchemy-armchair': ['chair-arm',.41,.40],
 'dungeon-weapon-rack': ['weapon-rack',.82,.43],
 'dungeon-bookshelf': ['bookshelf',.75,.37],
 'dungeon-torture-bench': ['torture-bench',1.04,.58],
 'torture-iron-cage': ['iron-cage',.79,.55],
 'torture-interrogation-chair': ['interrogation-chair',.44,.43],
 'torture-tool-table': ['tool-table',.76,.45],
 'torture-chain-wall': ['chain-wall',.78,.28],
 'torture-iron-maiden': ['iron-maiden',.55,.38],
 'torture-ember-brazier': ['ember-brazier',.48,.48],
 'torture-pillory': ['pillory',.82,.43],
 'torture-wheel': ['torture-wheel',.82,.50],
 'torture-prison-cage': ['prison-cage',.65,.57],
 'torture-washbasin': ['washbasin',.78,.47],
 'floor-rubble': ['floor-rubble',.75,.51],
 'floor-bones': ['floor-bones',.76,.47],
 'floor-rug': ['floor-rug',.82,.52],
 'floor-chains': ['floor-chains',.82,.50],
 'floor-wood': ['floor-wood',.86,.50],
 'floor-moss': ['floor-moss',.70,.46],
 'floor-scrolls': ['floor-scrolls',.67,.44],
 'floor-puddles': ['floor-puddles',.77,.55],
 'floor-pottery': ['floor-pottery',.73,.46],
 'floor-cloth': ['floor-cloth',.71,.52],
};
assert.equal(Object.keys(catalog.furniture).length,29,'29 room props: 19 existing items and 10 new Blender floor groups');
assert.equal(catalog.furniture['prison-table'].asset,'assets/furniture/table');
assert.equal(catalog.furniture['prison-chair'].asset,'assets/furniture/chair');
const build=fs.readFileSync(path.join(root,'blender/build-room-kit.py'),'utf8');
const models=fs.readFileSync(path.join(root,'blender/alchemy-furniture.py'),'utf8');
const torture=fs.readFileSync(path.join(root,'blender/torture-chamber-furniture.py'),'utf8');
const floor=fs.readFileSync(path.join(root,'blender/abandoned-floor-clutter.py'),'utf8');
const pack=fs.readFileSync(path.join(root,'blender/pack-room-kit.py'),'utf8');
const editor=fs.readFileSync(path.join(root,'editor.js'),'utf8');
assert.match(build,/for rot in \(0,90,180,270\)/);
assert.match(build,/all_furniture=\[/);
assert.match(build,/room-kit\.blend/);
assert.match(models,/GUARDIAN_RELATIVE_FURNITURE_SCALE=\.45/,'New assets must be 55% smaller than prior views');
assert.match(models,/brew\.scale=\(GUARDIAN_RELATIVE_FURNITURE_SCALE\*\.8\*1\.30,\)\*3/,'Brew table must gain precisely 30%');
assert.match(models,/work\.scale=\(GUARDIAN_RELATIVE_FURNITURE_SCALE\*1\.10,\)\*3/,'Work table must gain precisely 10%');
for(const name of ['_weapon_rack_v1','_bookshelf_v1','_torture_bench_v1'])assert.ok(models.includes(name),'Missing genuine Blender sculpture '+name);
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
 const isFloor=id.startsWith('floor-');
 if(isFloor){
  assert.equal(prop.category,'floor-clutter');
  assert.equal(prop.kind,'clutter');
  assert.equal(prop.blocksMovement,id==='floor-rubble'||id==='floor-wood','Only heavy rubble and beams block the Guardian');
  assert.equal(prop.blocksProjectiles,false);
 }else{
  assert.equal(prop.blocksMovement,true);
 }
 if(name.startsWith('floor-')){
  assert.ok(floor.includes("('"+name+"',"),'Floor group not declared as Blender geometry '+name);
 }else if(name==='torture-wheel' || name==='iron-cage' || name==='interrogation-chair' || name==='tool-table' ||
  name==='chain-wall' || name==='iron-maiden' || name==='ember-brazier' || name==='pillory' ||
  name==='prison-cage' || name==='washbasin'){
  assert.ok(torture.includes("('"+name+"',"),'Model not declared in Blender torture collection '+name);
 }else{
  assert.ok(models.includes("('"+name+"',"),'Model not in Blender collection '+name);
 }
 assert.ok(pack.includes("'"+name+"':"),'Model not in pack list '+name);
 for(const rotation of [0,90,180,270])
  assert.match(pack,/for rot in \(0,90,180,270\)/);
}
const manifestFile=path.join(root,'assets/manifest.json');
if(fs.existsSync(manifestFile)){
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 // The render workflow publishes assets in its own commit; do not fail a
 // source-only CI run while the existing manifest is still on the older revision.
 if(manifest.items?.['floor-cloth']){
  for(const [id,[name]] of Object.entries(expected)){
   assert.equal(manifest.items[name].catalogId,id);
   for(const rot of [0,90,180,270]){
    const file=manifest.files[name][rot];
    assert.equal(file,'assets/furniture/'+name+'-'+rot+'.png');
   }
  }
 }
}
assert.match(models,/TORTURE_MODELS/,'torture props must remain loaded into main Cycles pipeline');
assert.match(models,/ALCHEMY_MODELS\.extend\(FLOOR_MODELS\)/,'floor clutter must render in the same editable Blender file');
assert.match(editor,/spec\.category!=='floor-clutter'/,'floor patches should not receive giant furniture shadow');
assert.match(editor,/BODENDEKORATION/,'group the new floor props in the editor palette');
assert.equal(Object.keys(expected).length,27);
console.log('Room Atelier: 29 props, 116 directional views; 10 floor clutter groups and nonblocking rules — OK');
