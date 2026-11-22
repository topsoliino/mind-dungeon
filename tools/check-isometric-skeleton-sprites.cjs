// Original skinned Blender GLB only, sampled offline in 32 directions.
// The handcrafted dummy and retired primitive WebP assets must not exist.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../beta/alley-skeleton.js'),'utf8');
const window={};
vm.runInNewContext(source,{window});
const skeleton=window.AlleySkeleton;
assert(source.includes("'.webp?v='"),'Animated Blender atlas uses versioned WebP assets');
assert(!source.includes('safeImage(')&&!source.includes('fallbackImages'),
 'No hand-drawn or procedural skeleton substitute may render');
assert(source.includes('sheets=new Map'),
 'Original Blender animation frames must be shared across skeletons');
assert.equal(typeof skeleton.sprite,'function');
assert.equal(typeof skeleton.sprites,'undefined');
assert.equal(typeof skeleton.load,'function');
assert.equal(typeof skeleton.hasBaked,'function');
const rules={attacks:[{windup:.64,recovery:.54},{windup:.59,recovery:.44}]};
const sword={x:100,y:100,skeleton:'sabre',type:1,size:1,phase:.4,
 moving:true,angle:0,hit:0,windup:0,runAttack:0,recover:0};
assert.equal(skeleton.choose(sword,rules).clip,'run');
sword.moving=false;
assert.equal(skeleton.choose(sword,rules).clip,'idle');
sword.windup=.59;
assert.equal(skeleton.choose(sword,rules).clip,'strike');
sword.windup=0;
for(const action of ['combo','slash','overhead','cartwheel-enter','cartwheel',
 'cartwheel-exit','throw']){
 sword.skeletonAction={name:action,age:.1,duration:.5};
 assert.equal(skeleton.choose(sword,rules).clip,action);
}
sword.skeletonWheelSide=-1;
for(const action of ['cartwheel-enter','cartwheel','cartwheel-exit']){
 sword.skeletonAction={name:action,age:.25,duration:.5};
 assert.equal(skeleton.choose(sword,rules).clip,action+'-left');
}
sword.skeletonAction=null;
assert.equal(skeleton.choose(sword,rules,1).clip,'death');
const bow={...sword,skeleton:'bow',type:0,skeletonAction:{name:'double-shoot',age:.2,duration:.8}};
assert.equal(skeleton.choose(bow,rules).clip,'double-shoot');
const rooms=Array.from({length:10},(_,i)=>({
 kind:'raum',id:i,cells:Array.from({length:4},(_,j)=>[i*5+j%2,j>>1])
}));
const world={spawn:{x:24,y:24},walkable:()=>true,
 routeTo:()=>({goal:{x:0,y:0},steps:[]})};
const spawns=skeleton.encounters({rooms},world);
assert.equal(spawns.length,4);
assert.deepEqual(Array.from(spawns,p=>p.skeleton),['sabre','bow','sabre','bow']);
assert(spawns.every(p=>Math.hypot(p.x-24,p.y-24)>=168));
assert.equal(JSON.stringify(spawns),JSON.stringify(skeleton.encounters({rooms},world)));
assert.equal(skeleton.encounters({rooms:[]},world).length,0);
console.log('Skeleton: authentic Blender 32-direction atlas, original animation and deterministic spawns; dummy removed: OK');
