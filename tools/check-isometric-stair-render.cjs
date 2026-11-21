// node tools/check-isometric-stair-render.cjs
// Headless structural rendering test: all eight staircase families, Phaser layer
// visibility, Canvas draw path, real navigation and two-story transition frames.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),noop=()=>{};
const read=name=>fs.readFileSync(path.join(__dirname,'../beta',name),'utf8');
const files=['alley-study-map.js','alley-generator.js','alley-stair-geometry.js',
 'alley-vertical.js','alley-route.js','alley-architecture.js',
 'alley-study.js','dungeon-isometric.js'];
function fakeContext(){
 return new Proxy({
  globalAlpha:1,
  createLinearGradient:()=>({addColorStop:noop}),
  createRadialGradient:()=>({addColorStop:noop}),
  measureText:()=>({width:8})
 },{get:(target,name)=>name in target?target[name]:noop,
    set:(target,name,value)=>{target[name]=value;return true;}});
}
const document={
 currentScript:{src:'https://example.org/beta/alley-architecture.js'},
 createElement(name){
  assert.equal(name,'canvas');
  return {width:0,height:0,getContext:fakeContext};
 }
};
class Image{set src(v){this._src=v;}}
function build(seed){
 const window={location:{search:'?szene=gasse&modus=generator&seed='+seed},
  DungeonWorld:{TILE:48,HERO_RADIUS:14}};
 const context=vm.createContext({window,document,URL,URLSearchParams,Image});
 for(const f of files)vm.runInContext(read(f),context,{filename:f});
 return {window,iso:window.DungeonIsometric.create(),scene:window.AlleyStudy.create()};
}
const expected=['straight-narrow','straight-wide','grand','quarter',
 'switchback','spiral-tight','spiral-wide','curved'];
for(let seed=0;seed<expected.length;seed++){
 const {window,iso,scene:art}=build(seed),v=window.AlleyVertical;
 assert.equal(v.plan.kind,expected[seed],
  'seed '+seed+' should exercise a different geometrical stair style');
 const layers=art.verticalLayers();
 assert.equal(layers.length,4);
 assert.equal(JSON.stringify(layers.map(x=>x.level)),JSON.stringify([1,0,0,1]));
 assert(layers.every(o=>o.image.canvas.width>10&&o.image.canvas.height>10));
 assert(layers.every(o=>o.image.canvas.width<1600&&o.image.canvas.height<1600));
 const fakeScene={textures:{addCanvas:()=>({refresh:noop})},
  add:{image:(x,y,key)=>({x,y,key,visible:true,alpha:1,
   setOrigin(){return this;},setDepth(v){this.depth=v;return this;},
   setAlpha(v){this.alpha=v;return this;},
   setVisible(v){this.visible=v;return this;}})}};
 const hero=iso.spawn,all=iso.addLayers(fakeScene,hero),overlays=art.overlayLayers().length;
 const last=all.slice(all.length-overlays-4,all.length-overlays);
 assert.equal(last.length,4);
 function view(floor,transition=null){
  v.state.floor=floor;v.state.transition=transition;
  iso.refreshLayers(all,hero,false);
  return last.map(o=>({visible:o.visible,alpha:o.alpha,depth:o.depth}));
 }
 const lower=view(0),upper=view(1),
  ascent=view(0,{up:true,age:3.65,duration:4}),
  descent=view(1,{up:false,age:1.1,duration:4});
 assert.equal(JSON.stringify(lower.map(o=>o.visible)),JSON.stringify([false,true,true,false]),
  'upper stairs/floor/ornaments must not leak into the first story');
 assert.equal(JSON.stringify(upper.map(o=>o.visible)),JSON.stringify([true,true,true,true]));
 assert(ascent[0].visible&&ascent[0].alpha>0&&ascent[0].alpha<1);
 assert(!descent[0].visible&&!descent[3].visible);
 assert.equal(lower[1].depth,upper[1].depth,
  'lower staircase foot position must establish a stable depth order');
 // Show/hide the top layer according to the PHYSICAL progress of the stair
 // rider, never from the separate ladder cutscene timer.
 v.state.transition=null;
 v.state.floor=0;
 v.state.stairRide={s:v.stairLength*.72,auto:true,dir:1,up:true,lateral:0};
 const beforeCrest=view(0);
 assert(!beforeCrest[0].visible);
 v.state.stairRide.s=v.stairLength*.92;
 const atCrest=view(0);
 assert(atCrest[0].visible&&atCrest[0].alpha>0&&atCrest[0].alpha<1);
 v.state.stairRide=null;
 for(const step of v.plan.steps){
  const projected=window.DungeonIsometric.toView(
   step.center.x*48,step.center.y*48,step.z);
  assert(v.pickStair(projected,window.DungeonIsometric),
   'isometric right-click hit-test should resolve visible treads');
 }
 v.state.floor=0;v.state.transition=null;v.state.z=0;
 const feet=p=>({x:p.x*48,y:p.y*48});
 assert(iso.walkable(...Object.values(feet(v.plan.bottom))));
 assert(iso.routeTo(iso.spawn,feet(v.plan.bottom)),
  'real right-click router must reach the lower flight');
 assert(iso.routeTo(iso.spawn,feet(v.ladder.bottom)),
  'real right-click router must reach the wall ladder');
 v.state.floor=1;v.state.z=v.height;
 assert(iso.routeTo(feet(v.plan.top),feet(v.ladder.top)),
  'upper-story stairs and ladder must be connected by actual pathfinding');
}
console.log('Eight 3D stair styles render, keep immutable depth, hide upper floor downstairs, and have full two-way reachability.');
