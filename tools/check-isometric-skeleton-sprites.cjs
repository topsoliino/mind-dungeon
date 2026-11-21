// Regressions for the actual Blender-sprite adapter, loading, facing and spawns.
// Run: node tools/check-isometric-skeleton-sprites.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../beta/alley-skeleton.js'),'utf8');
const loaded=[];
let missing=null;
class ImageStub {
 constructor(){this.width=576;this.height=768;}
 async decode(){
  const key=this.src.match(/skeleton\/([^/]+)\.webp/)[1];
  if(key===missing)throw Error('Missing image fixture');
  this.width=key.endsWith('idle')?576:960;
  loaded.push(key);
 }
}
const window={};
const warn=[];
vm.runInNewContext(source,{window,Image:ImageStub,console:{warn:(...args)=>warn.push(args.join(' '))}});
const skeleton=window.AlleySkeleton;
const iso={toView:(x,y)=>({x:x-y,y:(x+y)*.5})};
const rules={attacks:[{windup:.64,recovery:.54},{windup:.59,recovery:.44}]};
async function run(){
 await skeleton.load();
 assert.equal(loaded.length,8,'both loadouts need four animated Blender atlases');
 const sword={x:100,y:100,skeleton:'sabre',type:1,size:1,phase:.4,moving:false,angle:0,hit:0,windup:0,runAttack:0,recover:0};
 let sprite=skeleton.sprite(sword,iso,rules);
 assert.equal(sprite.key,'skeleton-sabre-idle');
 assert.equal(sprite.frame,'1-1');
 assert.equal(sprite.w,96);
 assert.equal(sprite.h,96);
 assert.equal(sprite.sx,96);
 assert.equal(sprite.sy,96);
 sword.windup=.59;
 sprite=skeleton.sprite(sword,iso,rules);
 assert.equal(sprite.key,'skeleton-sabre-strike');
 assert.equal(sprite.frame,'1-0');
 sword.windup=0;sword.runDuration=.36;sword.runAttack=.36;
 sprite=skeleton.sprite(sword,iso,rules);
 assert.equal(sprite.key,'skeleton-sabre-strike');
 sword.runAttack=0;sword.recover=.44;
 sprite=skeleton.sprite(sword,iso,rules);
 assert.equal(sprite.key,'skeleton-sabre-strike');
 for(let i=0;i<8;i++){
  sword.facing=i*Math.PI/4;
  assert.equal(skeleton.sprite(sword,iso,rules).sy,((1-i+8)%8)*96);
 }
 const archer={...sword,skeleton:'bow',type:0,windup:0,runAttack:0,recover:0,moving:true};
 sprite=skeleton.sprite(archer,iso,rules);
 assert.equal(sprite.key,'skeleton-bow-run');
 archer.moving=false;archer.windup=.64;
 assert.equal(skeleton.sprite(archer,iso,rules).key,'skeleton-bow-shoot');
 assert.equal(skeleton.sprite(sword,iso,rules,0).key,'skeleton-sabre-death');
 assert.equal(skeleton.sprite(sword,iso,rules,.90).sx,9*96,'corpse holds final baked collapse');
 assert(skeleton.sprite(sword,iso,rules,2.5).alpha<.21,'corpse fades once collapsed');
 const rooms=Array.from({length:10},(_,i)=>({
  kind:'raum',id:i,cells:Array.from({length:4},(_,j)=>[i*5+j%2,j>>1])
 }));
 const world={
  spawn:{x:24,y:24},walkable:()=>true,routeTo:()=>({goal:{x:0,y:0},steps:[]})
 };
 const spawns=skeleton.encounters({rooms},world);
 assert.equal(spawns.length,4,'ten-room generator should have up to four encounters');
 assert.deepEqual(spawns.map(p=>p.skeleton),['sabre','bow','sabre','bow']);
 assert(spawns.every(p=>Math.hypot(p.x-24,p.y-24)>=168));
 assert.equal(JSON.stringify(spawns),JSON.stringify(skeleton.encounters({rooms},world)),'deterministic seeds');
 assert.equal(skeleton.encounters({rooms:[]},world).length,0);
 // One bad asset should not prevent the other seven from displaying.
 missing='bow-shoot';loaded.length=0;
 await skeleton.load();
 assert.equal(loaded.length,7);
 assert(warn.some(message=>message.includes('bow-shoot')));
 console.log('Skeleton: 8 Blender atlases, attack timing, 8 facings, death frames, sparse room spawns and fallback OK');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
