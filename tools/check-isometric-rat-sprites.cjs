// Verify rat 3D directional atlas and attack/locomotion selection in the browser adapter.
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('beta/alley-rat.js','utf8');
const loaded=[];
let missing=null;
class ImageStub {
 constructor(){this.height=32*128;this.width=128*10;}
 async decode(){
  const clip=this.src.match(/rat\/([^/]+)\.webp/)[1];
  if(clip===missing)throw Error('Missing fixture');
  this.width=128*({idle:8,run:10,stalk:10,jump:12,bite:9,combo:14,
   dodge:10,'dodge-left':10,death:14})[clip];
  loaded.push(clip);
 }
}
const window={};
const warnings=[];
vm.runInNewContext(source,{window,Image:ImageStub,
 console:{warn:(...args)=>warnings.push(args.join(' '))}});
const rat=window.AlleyRat;
const iso={toView:(x,y)=>({x:x-y,y:(x+y)/2})};
const rules={RAT:13,attacks:Array.from({length:21},()=>({windup:.23,recovery:.36}))};
async function test(){
 await rat.load();
 assert.equal(loaded.length,9);
 const e={type:13,x:100,y:120,phase:.1,angle:0,moving:false,size:.86,hit:0,
  windup:0,runAttack:0,recover:0};
 assert.equal(rat.sprite(e,iso,rules).key,'rat-idle');
 assert.equal(rat.sprite(e,iso,rules).width,128*.86,'larger rat silhouette');
 e.moving=true;e.ratStalking=true;
 assert.equal(rat.sprite(e,iso,rules).key,'rat-stalk');
 e.ratStalking=false;
 assert.equal(rat.sprite(e,iso,rules).key,'rat-run');
 e.moving=false;e.windup=.23;
 assert.equal(rat.sprite(e,iso,rules).key,'rat-bite');
 e.ratAttackClip='combo';
 assert.equal(rat.sprite(e,iso,rules).key,'rat-combo');
 e.windup=0;e.runDuration=.68;e.runAttack=.40;
 assert(rat.sprite(e,iso,rules).sx>0);
 e.runAttack=0;e.recover=0;
 e.ratMotion={name:'jump',time:.21,duration:.43};
 assert.equal(rat.sprite(e,iso,rules).key,'rat-jump');
 e.ratMotion={name:'dodge-left',time:.16,duration:.32};
 assert.equal(rat.sprite(e,iso,rules).key,'rat-dodge-left');
 e.ratMotion=null;
 assert.equal(rat.sprite(e,iso,rules,0).key,'rat-death');
 assert.equal(rat.sprite(e,iso,rules,1.2).sx,13*128);
 assert(rat.sprite(e,iso,rules,2.55).alpha<.1);
 assert.equal(rat.sprite({...e,type:14},iso,rules),null);
 for(let i=0;i<8;i++){
  e.facing=i*Math.PI/4;
  assert.equal(rat.sprite(e,iso,rules).sy,((4-i*4+32)%32)*128);
 }
 e.facing=Math.PI/64;
 let pair=rat.sprites(e,iso,rules);
 assert.equal(pair.length,1,'rat must no longer render two translucent models');
 assert.equal(pair[0].alpha,1,'living rat should be fully opaque');
 const rooms=Array.from({length:10},(_,i)=>({id:i,kind:'raum',cells:[
  [i*6,1],[i*6+1,1],[i*6,2],[i*6+1,2]]}));
 const floor={spawn:{x:24,y:24},walkable:()=>true,routeTo:()=>({steps:[]})};
 const first=rat.encounters({rooms},floor);
 assert(first.length<=3&&first.length>0);
 assert(first.every(p=>Math.hypot(p.x-24,p.y-24)>=168));
 assert.equal(JSON.stringify(first),JSON.stringify(rat.encounters({rooms},floor)));
 missing='combo';loaded.length=0;
 await rat.load();
 assert.equal(loaded.length,8);
 assert(warnings.some(msg=>msg.includes('combo')));
 console.log('Rat browser adapter: 9 clips, 32 fully opaque facings, combat and procedural spawns OK');
}
test().catch(err=>{console.error(err);process.exitCode=1;});
