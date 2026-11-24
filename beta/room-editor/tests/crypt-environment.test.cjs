'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const win={},root=path.resolve(__dirname,'..');vm.runInNewContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),{window:win});
const cat=win.MindRoomKit.catalog,arch=require('../architecture.js'),shape=require('../shape.js'),placement=require('../placement.js'),env=require('../environment.js');
const room={width:8,height:7,walls:[{x:2,y:0,edge:'north',style:'stone'},{x:0,y:2,edge:'west',style:'stone'}],furniture:[]};
assert.equal(Object.keys(cat.furniture).length,59);
assert.equal(cat.furniture['prison-table'].lights.length,3);
assert.ok(cat.furniture['prison-table'].footprint.w<1.85);
assert.ok(cat.furniture['prison-chair'].footprint.w<.78);
for(const [id,spec] of Object.entries(cat.furniture).filter(([id,s])=>s.category==='lighting')){
 assert.ok(spec.lights.length);
 if(spec.wallMounted)for(const [x,y,rot] of [[2.5,.1,180],[.1,2.5,90]]){
  const o=arch.attach(id,room,cat,x,y,'test');assert.equal(o.rot,rot);assert.ok(arch.validMount(o,room,cat));
  assert.ok(env.lightPoints(o,spec).every(l=>l.x>=0&&l.y>=0));
 }
}
const rot=(x,y,a)=>{const t=a*Math.PI/180;return{x:4+x*Math.cos(t)-y*Math.sin(t),y:4+x*Math.sin(t)+y*Math.cos(t)}};
for(const [id,spec] of Object.entries(cat.furniture).filter(([id,s])=>s.category==='architectural-floor'))for(const angle of [0,90,180,270]){
 const r={...room,furniture:[{id,type:id,x:4,y:4,rot:angle}]},get=(x,y)=>{const q=rot(x,y,angle);return arch.surfaceAt(r,cat,q.x,q.y,placement);};
 const h=spec.footprint.h,w=spec.footprint.w;
 if(spec.surface.access==='steps'){
  assert.ok(Math.abs(get(0,0).height-spec.surface.elevation)<1e-7);
  assert.ok(Math.abs(get(0,h*.45).height)<1e-7);
  assert.ok(Math.abs(get(0,h*.25).height-spec.surface.elevation*2/3)<1e-7);
  assert.ok(arch.transition(r,cat,placement,rot(0,h*.31,angle),rot(0,h*.29,angle)).allowed);
  if(spec.surface.type==='elevated')assert.equal(arch.transition(r,cat,placement,rot(w*.5+.02,0,angle),rot(w*.5-.02,0,angle)).allowed,false);
 }else if(spec.surface.type==='collapsed'){assert.equal(get(0,0).blocked,true);assert.equal(get(w*.4,0).blocked,false);}
 else assert.ok(get(0,-h*.4).height>get(0,h*.4).height);
}
const o={id:'roach',type:'ambient-roaches',x:1.5,y:1.5,rot:0},r={...room,furniture:[o,{id:'table',type:'prison-table',x:3.5,y:2.5,rot:0,blocksMovement:true}],walls:[...room.walls,{x:2,y:1,edge:'west',style:'stone'}]};
const route=env.route(r,cat,shape,placement,o);assert.ok(route.length>2);assert.ok(route.every(p=>env.free(r,cat,shape,placement,p.x,p.y)));
console.log('Crypt environment: wall lights, 4-way floor geometry and ambient routes OK');
