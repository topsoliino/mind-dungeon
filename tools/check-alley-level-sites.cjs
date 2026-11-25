const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const scripts='rocky-coast-prison alley-study-map alley-generator alley-stair-geometry alley-stair-navigation alley-stair-controller alley-vertical alley-progression alley-level-sites'.split(' ').map(n=>new vm.Script(fs.readFileSync(require('node:path').join(__dirname,'../beta',n+'.js'),'utf8'),{filename:n}));
for(let seed=4147;seed<4157;seed++)for(let level=1;level<=4;level++){
 const url=new URL('https://game/beta/?szene=gasse&modus=generator&region=rocky-coast&run='+seed+'&level='+level);
 const env={URL,URLSearchParams,location:url};env.window=env;vm.createContext(env);
 for(const s of scripts)s.runInContext(env);
 const g=env.AlleyGenerator,plan=g.levelSites,v=env.AlleyVertical,p=env.RockyCoastPrison;
 assert.equal(plan.progression.ok,true);assert.equal(plan.progression.hasMechanisms,false);
 assert.equal(g.rooms.filter(r=>r.kind==='raum').length,15);
 for(const [kind,count] of Object.entries({altar:10,chest:5,door:2,brew:1,merchant:1}))assert.equal(plan.sites.filter(s=>s.kind===kind).length,count);
 for(const s of plan.sites){
  if(s.kind==='chest')assert([0,1,2,3].includes(s.turn));
  if(s.kind==='door')assert([2,3,4,5,6].includes(s.half*2));
  for(const link of [...v.connectorsAt(s.floor),...(s.floor?v.connectorsAt(s.floor-1):[])])assert.notEqual(s.room,link.roomId);
 p.atStorey(s.floor+1,()=>{assert.equal(g.blocked(s.x/48,s.y/48,.25),['door','chest','altar'].includes(s.kind));if(s.kind==='door'){
   assert.equal(plan.strike(s,100),undefined);
   plan.unlock(s);assert(g.blocked(s.x/48,s.y/48,.25));assert.equal(plan.strike(s,100),220);
   assert.equal(plan.strike(s,220),0);assert(!g.blocked(s.x/48,s.y/48,.25));}});
 }
 console.log(seed,level,'ok');
}
