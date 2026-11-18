/* Item budgets. A stage adds purchases to the preceding stage, then spends the remainder on weapon damage or armor affinities. */
(function(root){
 'use strict';
 const budgets={common:50,rare:60,epic:70,legendary:80,mythic:80};
 const gradeOrder=['E','D','C','B','A','S'];
 const scalingCost={E:5,D:10,C:15,B:20,A:25,S:30};
 const ranks=Object.keys(budgets);
 const upgrades=['rare','epic','legendary'];
 const damageTypes=['physical','fire','magic','frost','dark','lightning'];
 const weapons={
  rust:{kg:8,reach:86,grades:{strength:'E',dexterity:'E'},rare:{grades:{strength:'D'}},epic:{crit:2},legendary:{grades:{dexterity:'D'},crit:3}},
  rapier:{kg:5,reach:104,grades:{dexterity:'C',luck:'E'},status:'bleed',rare:{grades:{dexterity:'B'}},epic:{statusLevel:2,crit:2},legendary:{grades:{dexterity:'A'},crit:3,critDamage:1}},
  hammer:{kg:22,reach:81,grades:{strength:'C',vitality:'E'},rare:{elements:{lightning:1}},epic:{grades:{strength:'B'}},legendary:{grades:{strength:'A'}}},
  staff:{kg:7,reach:325,projectile:'arcane',primary:'magic',grades:{intelligence:'D',attunement:'E'},elements:{dark:1},rare:{grades:{intelligence:'C'}},epic:{crit:1,reserve:5},legendary:{extra:{dark:1},reserve:0}},
  bow:{kg:6,reach:380,projectile:'arrow',grades:{dexterity:'C',endurance:'E'},rare:{grades:{dexterity:'B'}},epic:{crit:2},legendary:{grades:{dexterity:'A'},crit:3,critDamage:1}},
  blade:{kg:11,reach:100,grades:{faith:'C',dexterity:'E'},elements:{fire:1},rare:{grades:{faith:'B'}},epic:{crit:2},legendary:{grades:{faith:'A',dexterity:'D'}}},
  dagger:{kg:3,reach:67,grades:{dexterity:'D',luck:'E'},elements:{dark:1},status:'poison',rare:{grades:{luck:'D'}},epic:{grades:{dexterity:'C'},statusLevel:2},legendary:{grades:{dexterity:'B'},crit:1,critDamage:1}},
  greatsword:{kg:28,reach:113,grades:{strength:'C',endurance:'E'},rare:{grades:{strength:'B'}},epic:{reserve:5},legendary:{extra:{frost:1},reserve:0}}
 };
 const armorSets={
  wanderer:{kg:20,affinities:{physical:14,magic:-10}},
  scholar:{kg:12,affinities:{magic:30,lightning:13,physical:-15}},
  hunter:{kg:31,affinities:{poison:36,bleed:18,fire:-18}},
  knight:{kg:51,affinities:{physical:28,fire:22,lightning:-28}},
  shadow:{kg:62,affinities:{dark:40,frost:21,magic:-24}}
 };
 const armorSlots={helmet:{share:1,maxKg:10},chest:{share:3,maxKg:27},legs:{share:2,maxKg:18},boots:{share:1,maxKg:10}};
 const weaponMythicDash=1.2,armorMythicMove=.97;
 const chargeSeconds=.56,counterSeconds=.46,damageStarCost=15;
 function assert(condition,id,detail){
  if(!condition)throw new Error(id+' · '+detail);
 }
 function buildWeapon(id,rank,spec){
  assert(ranks.includes(rank),id,'unknown rarity');
  const {kg,reach,projectile}=spec,primary=spec.primary||'physical',grades={...(spec.grades||{})},elements={...(spec.elements||{})},extra={};
  let status=spec.status||null,statusLevel=status?1:0,crit=0,critDamage=0,reserve=spec.reserve??0;
  assert(kg>=3&&kg<=30&&reach>=65&&reach<=(projectile?420:130),id,'weight or reach outside bounds');
  assert(Object.keys(grades).length<=4&&Object.values(grades).every(grade=>gradeOrder.includes(grade)),id,'invalid scaling');
  assert(damageTypes.includes(primary),id,'unknown primary damage type');
  const kgCost=Math.ceil((30-kg)/5),reachCost=Math.ceil((reach-65)/(projectile?34:12));
  const primaryCost=primary==='physical'?0:5;
  const starCount=allocation=>Object.values(allocation).reduce((sum,n)=>sum+n,0);
  const summarize=()=>{
   const scaling=Object.values(grades).reduce((sum,grade)=>sum+scalingCost[grade],0);
   const elemental=primaryCost+Object.values(elements).reduce((sum,stars)=>sum+2+stars,0);
   const ailment=status?5+2*(statusLevel-1):0;
   return {weight:kgCost,reach:reachCost,scaling,elemental,extra:starCount(extra)*damageStarCost,status:ailment,crit:(crit+critDamage)*2,reserve};
  };
  const baseFor=budget=>budget-Object.values(summarize()).reduce((sum,n)=>sum+n,0);
  const shares=()=>{
   const normal={[primary]:5-starCount(elements),...elements};
   return Object.fromEntries([...new Set([...Object.keys(normal),...Object.keys(extra)])].map(type=>
    [type,(normal[type]||0)+(extra[type]||0)]));
  };
  let base=baseFor(budgets.common);
  assert(base>=0&&Number.isInteger(base),id,'common budget exceeded');
  const target=rank==='mythic'?'legendary':rank;
  for(const upgrade of upgrades.slice(0,ranks.indexOf(target))){
   const stage=spec[upgrade]||{},previousShares=shares();
   for(const [key,value] of Object.entries(stage.grades||{})){
    assert(Object.hasOwn(grades,key)&&gradeOrder.indexOf(value)>=gradeOrder.indexOf(grades[key]),id,'scaling regression at '+upgrade);
    grades[key]=value;
   }
   for(const [type,pct] of Object.entries(stage.elements||{})){
    assert(pct>=(elements[type]||0),id,'element share fell at '+upgrade);
    elements[type]=pct;
   }
   for(const [type,stars] of Object.entries(stage.extra||{})){
    assert(stars>=(extra[type]||0),id,'extra damage star removed at '+upgrade);
    extra[type]=stars;
   }
   reserve=stage.reserve??reserve;
   if(stage.status){
    assert(!status||stage.status===status,id,'switched status at '+upgrade);
    status=stage.status;
    statusLevel=Math.max(1,statusLevel);
   }
   assert(stage.statusLevel===undefined||status&&stage.statusLevel>=statusLevel,id,'status power fell at '+upgrade);
   assert(stage.crit===undefined||stage.crit>=crit,id,'crit chance fell at '+upgrade);
   assert(stage.critDamage===undefined||stage.critDamage>=critDamage,id,'critical damage fell at '+upgrade);
   statusLevel=stage.statusLevel??statusLevel;crit=stage.crit??crit;critDamage=stage.critDamage??critDamage;
   const previous=base;base=baseFor(budgets[upgrade]);
   assert(base>=previous,id,'base damage fell at '+upgrade);
   const currentShares=shares();
   assert(Object.entries(previousShares).every(([type,pct])=>base*currentShares[type]>=previous*pct),id,'damage type weakened at '+upgrade);
  }
  const distribution=shares();
  const validStars=allocation=>Object.entries(allocation).every(([type,stars])=>damageTypes.includes(type)&&Number.isInteger(stars)&&stars>0);
  assert(!Object.hasOwn(elements,primary)&&starCount(elements)<5&&starCount(extra)<=5&&validStars(elements)&&validStars(extra),id,'invalid damage distribution');
  assert(Number.isInteger(reserve)&&reserve>=0,id,'invalid reserve');
  assert(Number.isInteger(crit)&&crit>=0&&Number.isInteger(critDamage)&&critDamage>=0&&Number.isInteger(statusLevel)&&(!status||['bleed','poison'].includes(status)),id,'invalid critical or status upgrade');
  assert(base>=0&&Number.isInteger(base),id,'budget exceeded');
  const split=Object.fromEntries(Object.entries(distribution).map(([type,stars])=>[type,stars/5]));
  const rangeCost=projectile?(reach-65)*.26:reach-65;
  const speed=Number((.16+kg*.014+rangeCost*.0018).toFixed(2));
  const stamina=Math.round(5+.75*kg+.14*rangeCost);
  return {id,rank,kg,reach,projectile,speed,stamina,base,grades,split,stars:distribution,extraStars:{...extra},status,statusLevel,crit:crit/100,critFactor:2+critDamage/10,
   impact:Math.round(kg*1.35+4),malus:rank==='mythic',cost:{...summarize(),base},budget:budgets[rank]};
 }
 function buildArmor(set,slot,rank){
  const {kg:totalKg,affinities}=armorSets[set],{share,maxKg}=armorSlots[slot];
  const kg=Math.round(totalKg*share/7*2)/2,id=set+'-'+slot;
  const step=Math.min(3,ranks.indexOf(rank));
  const base=Object.fromEntries(Object.entries(affinities).map(([type,pct])=>[type,Math.round(pct*share/7)]));
  const stats={},positive=Object.entries(affinities).filter(([,pct])=>pct>0);
  const weight=Math.ceil((maxKg-kg)*1.4);
  let recovery=0;
  for(const [type,pct] of Object.entries(base)){
   if(pct>=0)continue;
   const relief=Math.min(step,Math.max(0,-pct-1));
   stats[type]=(pct+relief)/100;recovery+=relief;
  }
  const affinityBudget=budgets[rank]-weight-recovery;
  assert(affinityBudget>=0,id,'armor budget exceeded');
  let left=affinityBudget;
  const totalWeight=positive.reduce((sum,[,points])=>sum+points,0);
  for(const [i,[type,points]] of positive.entries()){
   const allocated=i===positive.length-1?left:Math.floor(affinityBudget*points/totalWeight);
   left-=allocated;stats[type]=allocated*.5/100;
  }
  return {id,rank,kg,stats,malus:rank==='mythic',cost:{weight,affinities:affinityBudget,recovery},budget:budgets[rank]};
 }
 const weaponTable=Object.fromEntries(Object.entries(weapons).map(([id,spec])=>[id,Object.fromEntries(ranks.map(rank=>[rank,buildWeapon(id,rank,spec)]))]));
 const armorTable=Object.fromEntries(Object.keys(armorSets).flatMap(set=>Object.keys(armorSlots).map(slot=>
  [set+'-'+slot,Object.fromEntries(ranks.map(rank=>[rank,buildArmor(set,slot,rank)]))]
 )));
 function hitMultiplier(charged,counter,rolled,critFactor=2){
  if(counter)return charged?4:2;
  return (charged?1.5:1)*(rolled?critFactor:1);
 }
 const capacity=burden=>40+2*Math.max(0,burden);
 const knockbackBase=burden=>3*Math.max(0,burden);
 root.DungeonBalance={budgets,ranks,scalingCost,weaponTable,armorTable,capacity,knockbackBase,buildWeapon,hitMultiplier,
  chargeSeconds,counterSeconds,damageStarCost,weaponMythicDash,armorMythicMove};
})(typeof window==='object'?window:globalThis);
