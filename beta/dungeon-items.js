window.DungeonItems = (() => {
 'use strict';
 const damage={
  physical:{label:'Physisch',icon:'⚔',color:'#ead9b8'},
  fire:{label:'Feuer',icon:'♨',color:'#ff914b'},
  magic:{label:'Magie',icon:'✧',color:'#bc9cff'},
  frost:{label:'Frost',icon:'❄',color:'#8ce4f4'},
  dark:{label:'Dunkel',icon:'☾',color:'#cb86c8'},
  lightning:{label:'Blitz',icon:'ϟ',color:'#ffe47c'},
  poison:{label:'Gift',icon:'☣',color:'#9ed276'},
  bleed:{label:'Blutung',icon:'◆',color:'#f17980'}
 };
 const rarity={
  common:{label:'Gewöhnlich',color:'#eee4cf',power:1,value:1},
  rare:{label:'Selten',color:'#77b7ff',power:1.15,value:1.4},
  epic:{label:'Episch',color:'#c48aff',power:1.27,value:1.8},
  legendary:{label:'Legendär',color:'#ffab59',power:1.39,value:2.4},
  mythic:{label:'Mythisch',color:'#ff6769',power:1.58,value:3}
 };
 const food={
  glucose:{name:'Traubenzucker',heal:9},
  banana:{name:'Banane',heal:15},
  bread:{name:'Brot',heal:23},
  chicken:{name:'Hühnchen',heal:34}
 };
 const requirements={
  rapier:{dexterity:12},hammer:{strength:14,vitality:12},staff:{intelligence:13},
  blade:{faith:13},dagger:{dexterity:11,luck:10},greatsword:{strength:15,endurance:13}
 };
 const kinds={weapon:'Waffen',ring:'Ringe',armor:'Rüstung'};
 const merchantRing={id:'merchant',name:'Händlerring',desc:'Ausgerüstet zeigt der Händler je eine zusätzliche Waffe, einen Ring und ein Rüstungsteil.',bonus:'merchant'};
 const weapons={
  rust:{split:{physical:1}},rapier:{split:{physical:1},status:'bleed'},
  hammer:{split:{physical:.7,lightning:.3}},staff:{split:{magic:.65,frost:.35}},
  blade:{split:{physical:.65,fire:.35}},dagger:{split:{physical:.5,dark:.5},status:'poison'},
  greatsword:{split:{physical:.7,frost:.3}}
 };
 const weaponWeights={rust:8,rapier:5,hammer:20,staff:7,blade:11,dagger:3,greatsword:26};
 const armorWeights={wanderer:20,scholar:12,hunter:31,knight:51,shadow:62};
 const weaponWeight=weapon=>Number.isFinite(weapon.kg)&&weapon.kg>0?weapon.kg:weaponWeights[weapon.id]??8;
 const armorWeight=(set,part)=>Math.round(armorWeights[set]*part/7*2)/2;
 const loads=[
  {name:'Leicht',move:1,dashSpeed:3.1,dashTime:.22,stamina:1},
  {name:'Mittel',move:.91,dashSpeed:2.55,dashTime:.22,stamina:.88},
  {name:'Schwer',move:.79,dashSpeed:2.45,dashTime:.145,stamina:.72}
 ];
 function loadout(kg){
  return {...loads[kg>=70?2:kg>=50?1:0],kg,resist:Math.floor(kg/2)*.005};
 }
 const defenseBonus=(level,load)=>Math.max(0,level-1)*.005+load.resist;
 function upgradeRank(item){
  const ranks=Object.keys(rarity);
  return ranks[ranks.indexOf(rank(item))+1]||null;
 }
 const scaling={
  rust:{strength:'E',dexterity:'E'},rapier:{dexterity:'C',luck:'E'},
  hammer:{strength:'B',vitality:'D'},staff:{intelligence:'A',attunement:'D'},
  blade:{faith:'A',dexterity:'D',luck:'E'},dagger:{dexterity:'D',luck:'C'},
  greatsword:{strength:'S',endurance:'C',vitality:'D',dexterity:'E'}
 };
 const gradePoints={E:1,D:2,C:3,B:4,A:5,S:6};
 function weaponScaling(weapon,attributes){
  const grades=scaling[weapon.id]||{strength:'E',dexterity:'E'};
  return Object.entries(grades).map(([attribute,grade])=>({
   attribute,grade,points:gradePoints[grade],bonus:Math.max(0,attributes[attribute]||0)*gradePoints[grade]
  }));
 }
 const armor={
  wanderer:{physical:.14,magic:-.10},scholar:{magic:.30,lightning:.13,physical:-.15},
  hunter:{poison:.36,bleed:.18,fire:-.18},knight:{physical:.28,fire:.22,lightning:-.28},
  shadow:{dark:.40,frost:.21,magic:-.24}
 };
 // Positive affinity reduces incoming damage. 1 represents immunity.
 const foes=[
  {physical:.30,fire:-.35,poison:1,lightning:-.18},
  {fire:.55,dark:.25,frost:-.40},
  {poison:1,fire:-.45,bleed:.20},
  {bleed:1,poison:1,magic:.20,lightning:-.40},
  {frost:1,dark:.32,fire:-.32,magic:-.23},
  {poison:1,dark:.30,fire:-.40},
  {poison:1,frost:-.25},
  {bleed:1,poison:1,magic:.20,lightning:-.40},
  {poison:1,dark:.30,fire:-.40}
 ];
 const foeAttack=[
  {physical:1},{physical:.35,fire:.65},{physical:.75,dark:.25},
  {physical:.4,magic:.6},{frost:.75,dark:.25},{physical:.75,dark:.25},{physical:1},{physical:1},{physical:.85,dark:.15}
 ];
 function rank(item){return rarity[item?.rarity]?item.rarity:'common';}
 function key(item){return [item.kind,item.id,rank(item)].join('/');}
 function enemyRarity(roll,depth){
  if(roll<.13)return 'common';
  if(roll<.165)return 'rare';
  if(roll<.178)return depth>=3?'mythic':'epic';
  if(roll<.18)return 'legendary';
  return null;
 }
 const weapon=id=>weapons[id]||weapons.rust;
 function affinity(piece,itemRank){
  if(!piece)return {};
  const multiplier=piece.weight*rarity[itemRank].power/7;
  return Object.fromEntries(Object.entries(armor[piece.set]||{}).map(([type,value])=>[type,value*multiplier]));
 }
 function hit(amount,split,resistance){
  const parts=Object.entries(split).map(([type,share])=>({
   type,value:amount*share*Math.max(0,1-(resistance[type]||0))
  }));
  const dominant=parts.reduce((best,part)=>part.value>best.value?part:best,parts[0]);
  return {type:dominant.type,total:Math.round(parts.reduce((n,p)=>n+p.value,0)),parts};
 }
 function rememberDamage(actor,hit){
  actor.damageTypes??={};
  for(const {type,value} of hit.parts)actor.damageTypes[type]=(actor.damageTypes[type]||0)+value;
  actor.dominant=Object.keys(actor.damageTypes).reduce((best,type)=>actor.damageTypes[type]>actor.damageTypes[best]?type:best,hit.type);
 }
 function price(item,depth){
  const base={weapon:38,ring:32,armor:28,food:7}[item.kind]+Math.max(0,depth-1)*5;
  return Math.round(base*rarity[rank(item)].value);
 }
 function shop(seed,depth,pools){
  const picks=[];
  let state=seed^0x597b11a9;
  for(const kind of Object.keys(kinds)){
   const pool=pools[kind].filter(item=>item.id!=='merchant');
   if(!pool.length)continue;
   state=(Math.imul(state,1664525)+1013904223)>>>0;
   const first=state%pool.length;
   state=(Math.imul(state,1664525)+1013904223)>>>0;
   const second=(first+1+state%Math.max(1,pool.length-1))%pool.length;
   picks.push([pool[first],pool[second]].map((item,i)=>{
    const stock=i===0?(depth>=3?'rare':'common'):depth>=3?'legendary':'rare';
    const variant={...item,rarity:stock,source:'Händler'};
    return {...variant,price:price(variant,depth),stock:kind+'-'+i};
   }));
  }
  return [...picks.map(row=>row[0]),...picks.map(row=>row[1])];
 }
 return {damage,rarity,weaponScaling,food,requirements,kinds,merchantRing,weapon,armor,foes,foeAttack,rank,key,upgradeRank,weaponWeight,armorWeight,loadout,defenseBonus,enemyRarity,affinity,hit,rememberDamage,price,shop};
})();
