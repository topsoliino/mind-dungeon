// Etappe 4a: deterministic route and gameplay source regression.
// Run from repository root: node tools/check-isometric-stage4.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {join}=require('node:path');
const source=file=>fs.readFileSync(join(__dirname,'..',file),'utf8');
const window={};
vm.runInNewContext(source('beta/alley-study-map.js'),{window});
vm.runInNewContext(source('beta/alley-route.js'),{window});
const {art,logic}=window.AlleyStudyMap,route=window.AlleyRoute;
const arch=art.foreground.arch;
const solids=[
 [arch.area[0],arch.area[1],arch.area[2],arch.opening[0]],
 [arch.area[0],arch.opening[1],arch.area[2],arch.area[3]]
];
const contains=([u,v,r,b],x,y)=>x>=u&&x<=r&&y>=v&&y<=b;
function openGround(u,v,r=.29){
 return [[u+r,v],[u-r,v],[u,v+r],[u,v-r]].every(([x,y])=>
  logic.walkable.some(area=>contains(area,x,y)))&&
  !solids.some(([a,b,c,d])=>contains([a-r,b-r,c+r,d+r],u,v))&&!route.blocked(u,v,r);
}
function connected(from,to){
 const unit=.13,lookup=(u,v)=>Math.round(u/unit)+','+Math.round(v/unit);
 const visited=new Set([lookup(...from)]),steps=[from];
 for(let i=0;i<steps.length&&i<30000;i++){
  const [u,v]=steps[i];
  if(Math.hypot(u-to[0],v-to[1])<.28)return true;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=Math.round((u+dx*unit)/unit)*unit,y=Math.round((v+dy*unit)/unit)*unit,key=lookup(x,y);
   if(!visited.has(key)&&openGround(x,y)){visited.add(key);steps.push([x,y]);}
  }
 }
 return false;
}
const spawn=logic.spawn,nearArchive=[16.4,3.45],beforeSeal=[19.8,2.92],inLab=[23.1,2.7];
assert(connected(spawn,nearArchive),'Start to archive must remain passable');
assert(connected(nearArchive,beforeSeal),'Archive to lab seal must remain passable');
assert(!connected(beforeSeal,inLab),'Lab must be inaccessible before knowledge trial');
route.unlock();
assert(connected(beforeSeal,inLab),'Lab must be accessible after knowledge trial');
assert(connected(inLab,[25,3.1]),'Lab objective must remain reachable');
assert.equal(route.areaAt(25,4),'Behavioristen-Labor');
assert.equal(route.walls.length,7);
assert(logic.encounter.lab.length>=2);
assert(logic.stations.knowledge&&logic.stations.lab);
const html=source('beta/index.html');
for(const file of ['beta/alley-route.js?v=2','beta/alley-study.js?v=10','beta/dungeon-isometric.js?v=13'])
 assert(html.includes('src="'+file+'"'),file+' must be loaded in the test build');
assert(html.includes("reason==='iso-archive'"),'Knowledge question must be wired into answers');
assert(html.includes("const questionsReady=loadQuestions();"),'The real question pack must be loaded');
assert(html.includes("Etappe 4a geschafft"),'Lab completion must be present');
console.log('Isometric stage 4a route, access gate, encounter and mission regression: OK');
