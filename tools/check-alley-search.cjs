// Sight loss, physical search paths, reacquisition and return to post.
const assert=require('node:assert/strict');
global.window={};
require('../beta/alley-enemy-pursuit.js');
const vertical={state:{floor:0},connectors:[]};
let visible=true,now=0;
const ai=window.AlleyEnemyPursuit.create(vertical,{
 clearLineOnFloor:()=>visible,routeToFloor:(_,p)=>({steps:[p]})
});
const e={x:0,y:0,hp:1,skeleton:'sabre'},hero={x:48,y:0};
const mover=(actor,dx,dy)=>{actor.x+=dx;actor.y+=dy;};
const tick=()=>ai.update(e,hero,.05,now+=.05,mover,90);
tick();visible=false;hero.x=1000;
const searched=new Set();
for(let i=0;i<600;i++){
 tick();
 if(e.alleyMode==='search'&&e.alleySearch?.targets.length){
  const t=e.alleySearch.targets[0];
  if(Math.hypot(e.x-t.x,e.y-t.y)<12)searched.add(t.x+','+t.y);
 }
}
assert(searched.size>=2);
assert.equal(e.alleyMode,'guard');
assert(Math.hypot(e.x,e.y)<24);
hero.x=e.x+10;visible=true;tick();visible=false;tick();visible=true;tick();
assert.equal(e.alleyMode,'chase');assert.equal(e.alleySearch,null);
console.log('Sight loss, multiple physical search routes, return and reacquisition passed.');
