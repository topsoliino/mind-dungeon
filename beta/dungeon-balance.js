/* Item budgets. A stage adds purchases to the preceding stage, then spends the remainder on base damage or protection. */
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
  hammer:{kg:22,reach:81,grades:{strength:'C',vitality:'E'},rare:{elements:{lightning:10}},epic:{grades:{strength:'B'}},legendary:{grades:{strength:'A'}}},
  staff:{kg:7,reach:116,primary:'magic',grades:{intelligence:'D',attunement:'E'},elements:{dark:20},rare:{grades:{intelligence:'C'}},epic:{elements:{dark:30},crit:1},legendary:{grades:{intelligence:'B'},crit:3}},
  blade:{kg:11,reach:100,grades:{faith:'C',dexterity:'E'},elements:{fire:20},rare:{grades:{faith:'B'}},epic:{elements:{fire:30},crit:2},legendary:{grades:{faith:'A',dexterity:'D'}}},
  dagger:{kg:3,reach:67,grades:{dexterity:'D',luck:'E'},elements:{dark:10},status:'poison',rare:{grades:{luck:'D'},elements:{dark:20}},epic:{grades:{dexterity:'C'},statusLevel:2},legendary:{grades:{dexterity:'B'},crit:1,critDamage:1}},
  greatsword:{kg:28,reach:113,grades:{strength:'C',endurance:'E'},rare:{grades:{strength:'B'}},epic:{elements:{frost:10}},legendary:{grades:{strength:'A'},crit:1,critDamage:1}}
 };
 const armorSets={
  wanderer:{kg:20,affinities:{physical:14,magic:-10}},
  scholar:{kg:12,affinities:{magic:30,lightning:13,physical:-15}},
  hunter:{kg:31,affinities:{poison:36,bleed:18,fire:-18}},
  knight:{kg:51,affinities:{physical:28,fire:22,lightning:-28}},
  shadow:{kg:62,affinities:{dark:40,frost:21,magic:-24}}
 };
 const armorSlots={helmet:{share:1,maxKg:10},chest:{share:3,maxKg:27},legs:{share:2,maxKg:18},boots:{share:1,maxKg:10}};
 const armorCrits={'hunter-helmet':2,'hunter-boots':1,'wanderer-legs':1,'shadow-helmet':3,'shadow-boots':2};
 const weaponMythicDash=1.2,armorMythicMove=.97;
 const chargeSeconds=.56,counterSeconds=.46;
 function assert(condition,id,detail){
  if(!condition)throw new Error(id+' · '+detail);
 }
 function buildWeapon(id,rank,spec){
  assert(ranks.includes(rank),id,'unknown rarity');
  const {kg,reach}=spec,primary=spec.primary||'physical',grades={...(spec.grades||{})},elements={...(spec.elements||{})};
  let status=spec.status||null,statusLevel=status?1:0,crit=0,critDamage=0;
  assert(kg>=3&&kg<=30&&reach>=65&&reach<=130,id,'weight or reach outside bounds');
  assert(Object.keys(grades).length<=4&&Object.values(grades).every(grade=>gradeOrder.includes(grade)),id,'invalid scaling');
  assert(damageTypes.includes(primary),id,'unknown primary damage type');
  const kgCost=Math.ceil((30-kg)/5),reachCost=Math.ceil((reach-65)/12);
  const primaryCost=primary==='physical'?0:5;
  const summarize=()=>{
   const scaling=Object.values(grades).reduce((sum,grade)=>sum+scalingCost[grade],0);
   const elemental=primaryCost+Object.values(elements).reduce((sum,pct)=>sum+2+pct/10,0);
   const ailment=status?5+2*(statusLevel-1):0;
   return {weight:kgCost,reach:reachCost,scaling,elemental,status:ailment,crit:(crit+critDamage)*2};
  };
  const baseFor=budget=>budget-Object.values(summarize()).reduce((sum,n)=>sum+n,0);
  const shares=()=>({[primary]:100-Object.values(elements).reduce((sum,pct)=>sum+pct,0),...elements});
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
  assert(!Object.hasOwn(elements,primary)&&distribution[primary]>=10&&Object.entries(elements)
   .every(([type,pct])=>damageTypes.includes(type)&&pct>0&&pct%10===0),id,'invalid damage distribution');
  assert(Number.isInteger(crit)&&crit>=0&&Number.isInteger(critDamage)&&critDamage>=0&&Number.isInteger(statusLevel)&&(!status||['bleed','poison'].includes(status)),id,'invalid critical or status upgrade');
  assert(base>=0&&Number.isInteger(base),id,'budget exceeded');
  const split=Object.fromEntries(Object.entries(distribution).map(([type,pct])=>[type,pct/100]));
  const speed=Number((.16+kg*.014+(reach-65)*.0018).toFixed(2));
  const stamina=Math.round(5+.75*kg+.14*(reach-65));
  return {id,rank,kg,reach,speed,stamina,base,grades,split,status,statusLevel,crit:crit/100,critFactor:2+critDamage/10,
   impact:Math.round(kg*1.35+4),malus:rank==='mythic',cost:{...summarize(),base},budget:budgets[rank]};
 }
 function buildArmor(set,slot,rank){
  const {kg:totalKg,affinities}=armorSets[set],{share,maxKg}=armorSlots[slot];
  const kg=Math.round(totalKg*share/7*2)/2,id=set+'-'+slot;
  const step=Math.min(3,ranks.indexOf(rank));
  const base=Object.fromEntries(Object.entries(affinities).map(([type,pct])=>[type,Math.round(pct*share/7)]));
  const stats=Object.fromEntries(Object.entries(base).map(([type,pct])=>[type,(pct>0?pct+step*2:Math.min(-1,pct+step))/100]));
  const weight=Math.ceil((maxKg-kg)*1.4),crit=(armorCrits[id]||0)+(armorCrits[id]&&step>=2?1:0);
  const scaling=Object.values(base).reduce((n,pct)=>n+(pct>0?pct+step*2:Math.min(step,-pct-1)),0);
  const reserve=budgets[rank]-weight-scaling-crit*2;
  assert(reserve>=0,id,'armor budget exceeded');
  return {id,rank,kg,stats,crit:crit/100,defense:reserve*.16,malus:rank==='mythic',cost:{weight,affinities:scaling,crit:crit*2,protection:reserve},budget:budgets[rank]};
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
  chargeSeconds,counterSeconds,weaponMythicDash,armorMythicMove};
})(typeof window==='object'?window:globalThis);
