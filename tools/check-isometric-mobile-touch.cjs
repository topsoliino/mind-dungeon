// Verify analog multi-touch, reset and the actual isometric mobile wiring.
// Run: node tools/check-isometric-mobile-touch.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const events=new Map(),captured=new Set(),classes=new Set();
const surface={
 getBoundingClientRect:()=>({left:0,top:0,width:140,height:140}),
 addEventListener:(type,cb)=>events.set(type,cb),
 setPointerCapture:id=>captured.add(id),
 releasePointerCapture:id=>captured.delete(id),
 hasPointerCapture:id=>captured.has(id),
 classList:{add:key=>classes.add(key),remove:key=>classes.delete(key)}
};
const thumb={style:{transform:''}};
const window={};vm.runInNewContext(source('beta/dungeon-touch.js'),{window});
let enabled=true;
const stick=window.DungeonTouch.create({surface,thumb,enabled:()=>enabled});
function pointer(id,x,y){
 let prevented=false,stopped=false;
 return {pointerId:id,clientX:x,clientY:y,
  preventDefault(){prevented=true;},stopPropagation(){stopped=true;},
  get handled(){return prevented&&stopped}};
}
assert.deepEqual({...stick.read()},{x:0,y:0});
events.get('pointerdown')(pointer(3,70,70));
assert(captured.has(3));
assert(classes.has('active'));
assert.deepEqual({...stick.read()},{x:0,y:0},'touch-center deadzone');
events.get('pointermove')(pointer(3,115,70));
assert(stick.read().x>.9 && Math.abs(stick.read().y)<.001,'horizontal stick motion');
events.get('pointerdown')(pointer(4,70,26));
assert(stick.read().x>.9,'another thumb must not override current stick');
events.get('pointerup')(pointer(4,70,26));
assert(captured.has(3),'another thumb must not release current stick');
events.get('pointermove')(pointer(3,70,25));
assert(stick.read().y<-.9 && Math.abs(stick.read().x)<.001,'up motion');
events.get('pointerup')(pointer(3,70,25));
assert.deepEqual({...stick.read()},{x:0,y:0});
assert(!captured.size&&!classes.size);
assert.equal(thumb.style.transform,'translate(-50%,-50%)');
enabled=false;
events.get('pointerdown')(pointer(5,120,70));
assert.deepEqual({...stick.read()},{x:0,y:0},'paused joystick cannot start');
enabled=true;
events.get('pointerdown')(pointer(5,120,70));
events.get('lostpointercapture')(pointer(5,120,70));
assert.deepEqual({...stick.read()},{x:0,y:0},'lost capture must stop movement');
events.get('pointerdown')(pointer(6,70,120));
stick.reset();
assert.deepEqual({...stick.read()},{x:0,y:0},'pause/blur reset');
const html=source('beta/index.html');
for(const marker of [
 'beta/dungeon-touch.js?v=1',
 'mobile-stick',
 'mobileRoll',
 'mobileSneak',
 'mobileAttackTarget',
 'requestAlleyLight(mobileAttackTarget())',
 'body.mobile-iso.mobile-playing #mobile',
 "e.pointerType==='touch'&&e.button===0",
 "if(alley)document.body.classList.add('mobile-playing')",
 "touch.reset();",
 "const stick=touch.read();",
 "const intensity=Math.min(1,Math.hypot(x,y));",
 "enemyRig?.draw(e,e.skeleton,skeletonArt.choose(e,enemyRules),iso)",
]){
 assert(html.includes(marker),'missing active mobile wiring: '+marker);
}
const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
 .map(m=>m[1]).filter(x=>x.length>10000);
assert(inline.length>0);
new Function(inline.at(-1));
console.log('Mobile: two-thumb pointer capture, stick deadzone, directional movement, pause cleanup, 6 actions and tap-to-move wiring OK');
