// Upper-floor clicks must not be stolen by overlapping stair sprites.
// Physical stair exits must not teleport to the portal's hidden centreline.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),noop=()=>{};
const read=name=>fs.readFileSync(path.join(__dirname,'../beta',name),'utf8');
const geometry=['alley-study-map.js','alley-generator.js','alley-stair-geometry.js',
 'alley-stair-navigation.js','alley-stair-controller.js','alley-vertical.js'];
const sceneFiles=[...geometry,'alley-route.js','alley-architecture.js',
 'alley-study.js','dungeon-isometric.js'];
const html=read('index.html');
const context=()=>new Proxy({
 createLinearGradient:()=>({addColorStop:noop}),
 createRadialGradient:()=>({addColorStop:noop}),
 measureText:()=>({width:8})
},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
const document={currentScript:{src:'https://example.org/beta/alley-architecture.js'},
 createElement:()=>({width:0,height:0,getContext:context})};
class Image {set src(v){this._src=v;}}
const a=html.indexOf('function alleyClickScreen(){'),
 b=html.indexOf('function approachAlleyVertical(){',a);
assert(a>=0&&b>a);
const selection=html.slice(a,b);
assert(selection.includes('function alleyUpperFloorTarget(screen)'));
assert(html.includes("tell('Dort ist im Obergeschoss kein begehbarer Boden.')"));
const ui=new Function('alleyVertical','alley','iso','renderedView','cam',
 'cw','ch','mouse','alleySneaking','frame','tell','player',
 'finishAlleyApproach','actorRadius',
 'rockyPrison',
 'let alleyRoute=null,alleyMove=null,alleyMarker=null,alleyQueuedLight=null,'+
 'alleyStairFloorGoal=null;\n'+selection+'\n'+
 'return {approachClickStairs,alleyUpperFloorTarget,alleyClickScreen,'+
 'get pending(){return alleyVertical.state.pending;}};');
function make(seed,graphics=false){
 const w={location:{search:'?szene=gasse&modus=generator&seed='+seed},
  DungeonWorld:{TILE:48,HERO_RADIUS:14}};
 const scope=vm.createContext({window:w,URL,URLSearchParams,Image,document});
 for(const mod of graphics?sceneFiles:geometry)
  vm.runInContext(read(mod),scope,{filename:mod});
 return w;
}
let overlap=0;
for(let seed=0;seed<16;seed++){
 const w=make(seed,true),v=w.AlleyVertical,iso=w.DungeonIsometric,alley=iso.create();
 const hero={x:v.ladder.top.x*48,y:v.ladder.top.y*48,dir:0};
 v.state.floor=1;v.state.z=v.height;
 const mouse={x:0,y:0};
 const cursor=ui(v,alley,iso,{x:0,y:0,zoom:1},{x:0,y:0},0,0,
  mouse,false,10,noop,hero,noop,()=>14);
 for(const place of [v.ladder.top,v.plan.top]){
  const screen=iso.toView(place.x*48,place.y*48,v.height);
  mouse.x=screen.x;mouse.y=screen.y;
  const target=cursor.alleyUpperFloorTarget(screen);
  assert(target,'upper floor must remain clickable for seed '+seed);
  assert(Math.hypot(target.x-place.x*48,target.y-place.y*48)<.001);
  assert.equal(cursor.approachClickStairs(),false,
   'a normal upper-floor click cannot initiate stair descent');
  assert.equal(cursor.pending,null);
  if(v.pickStair(screen,iso))overlap++;
 }
 assert(alley.routeTo(hero,{x:v.plan.top.x*48,y:v.plan.top.y*48}));
 mouse.x=999999;mouse.y=999999;
 assert.equal(cursor.alleyUpperFloorTarget(cursor.alleyClickScreen()),null);
 assert.equal(cursor.approachClickStairs(),false);
 v.state.floor=0;v.state.z=0;
 // Ground-floor beacon test must begin at a real ground-floor position.
 hero.x=alley.spawn.x;hero.y=alley.spawn.y;
 const beacon=iso.toView(v.plan.top.x*48,v.plan.top.y*48,v.height);
 mouse.x=beacon.x;mouse.y=beacon.y;
 assert(cursor.approachClickStairs(),'ground beacon must remain clickable');
 assert(v.state.pending?.connector.kind==='stairs');
}
assert(overlap>0,'must verify overlapping projected floor and stair');
console.log('16 upper floors: floor-first click intent, '+overlap+
 ' overlaps, invalid click rejection and explicit ground beacon OK');

const kinds=new Set(),walls=new Set();
for(let seed=0;seed<200;seed++){
 const v=make(seed).AlleyVertical;
 kinds.add(v.plan.kind);walls.add(v.ladder.wall);
 for(const up of [true,false]){
  v.state.floor=up?0:1;v.state.stairRide=null;
  const start=up?v.plan.bottom:v.plan.top,goal=up?v.plan.top:v.plan.bottom;
  const hero={x:start.x*48,y:start.y*48,dir:0};
  assert(v.boardStairs(hero,up,{point:goal,part:goal}));
  let completed=false;
  for(let i=0;i<1500&&v.state.stairRide;i++){
   const before={x:hero.x,y:hero.y};
   const step=v.advanceStairs(hero,1/60,180);
   if(step?.completed){
    assert.equal(v.state.floor,up?1:0);
    assert(Math.hypot(hero.x-before.x,hero.y-before.y)<3.5,
     'portal teleport on seed '+seed);
    const p={x:hero.x/48,y:hero.y/48};
    assert(up?v.insideTop(p.x,p.y,.29):!v.blocksGround(p.x,p.y,.29,false));
    completed=true;break;
   }
  }
  assert(completed,'two-way stair exit must finish seed '+seed);
 }
}
assert(kinds.size>=8,'At least eight architectural stair families across 200 seeds: '+[...kinds].join(', '));
assert.equal(walls.size,4);
console.log('200 seeds, '+kinds.size+' naturally occurring stair types, 4 ladder orientations: 400 two-way exits without teleport OK');
