// Geometry regression check for the isolated isometric alley.
// Run: node tools/check-alley-geometry.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../beta/alley-study-map.js'),'utf8'),{window});
const {art,logic}=window.AlleyStudyMap;
const [north,south]=[logic.walkable[0][1],logic.walkable[0][3]];
const gate=art.foreground.arch;
const within=([a,b,c,d],u,v)=>u>=a&&u<=c&&v>=b&&v<=d;
const inside=(u,v,r=.22)=>[[u+r,v],[u-r,v],[u,v+r],[u,v-r]].every(([x,y])=>
 logic.walkable.some(rect=>within(rect,x,y)))&&
 ![ [gate.area[0],gate.area[1],gate.area[2],gate.opening[0]],
    [gate.area[0],gate.opening[1],gate.area[2],gate.area[3]] ].some(rect=>
    within([rect[0]-r,rect[1]-r,rect[2]+r,rect[3]+r],u,v));
assert(south-north>=4,'Main road must remain wide enough for combat');
assert(gate.opening[0]>=gate.area[1]&&gate.opening[1]<=gate.area[3],'Arch opening must fit between piers');
assert(gate.opening[1]-gate.opening[0]>=2.6,'Arch clearance must match the wider road');
for(const house of art.standing){
 assert(house.height>=85,'Buildings must have the intended larger silhouette');
 if(house.door){
  assert(Math.abs(house.door[1]-house.area[3])<.001,'Door must be located on its facade');
  assert(house.door[0]>house.area[0]+.3&&house.door[0]<house.area[2]-.3,'Door must fit on facade');
 }
}
for(const [name,p] of Object.entries({spawn:logic.spawn,gateEntry:[8.2,4.9],gatePass:[8.9,4.9],gateExit:[9.4,4.9],archer:logic.encounter.archer,market:[6.2,7.55]}))
 assert(inside(...p),name+' must be reachable in map geometry');

const start=logic.spawn,finish=logic.encounter.archer,res=.1;
const id=(u,v)=>Math.round(u/res)+','+Math.round(v/res);
const queue=[start],seen=new Set([id(...start)]),dirs=[[1,0],[-1,0],[0,1],[0,-1]];
let connected=false;
for(let i=0;i<queue.length&&i<30000;i++){
 const [u,v]=queue[i];
 if(Math.hypot(u-finish[0],v-finish[1])<.22){connected=true;break;}
 for(const [du,dv] of dirs){
  const x=Math.round((u+du*res)/res)*res,y=Math.round((v+dv*res)/res)*res,key=id(x,y);
  if(!seen.has(key)&&inside(x,y)){seen.add(key);queue.push([x,y]);}
 }
}
assert(connected,'Hero must be able to navigate through the enlarged arch toward the encounter');
console.log('Isometric alley geometry: OK');
