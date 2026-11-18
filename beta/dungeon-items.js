window.DungeonItems = (() => {
 'use strict';
 const balance=window.DungeonBalance;
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
 const foodSeconds=1.5,damageDelay=1;
 const foodPower=(item,multiplier)=>Math.round((food[item.id]?.heal??0)*multiplier);
 function foodNeeded(actor,max,queue,multiplier){
  return Math.max(0,max-actor.hp+(actor.damageQueue??[]).reduce((sum,hit)=>sum+hit.amount,0)-
   queue.reduce((sum,item)=>sum+(item.kind==='food'?foodPower(item,multiplier):0),0));
 }
 function chooseFood(inventory,missing,multiplier){
  const choices=inventory.filter(it=>it.kind==='food'&&Object.hasOwn(food,it.id)).sort((a,b)=>foodPower(a,multiplier)-foodPower(b,multiplier));
  return choices.find(it=>foodPower(it,multiplier)>=missing)??choices.at(-1);
 }
 function eatMeal(actor,max,item,multiplier){
  const power=foodPower(item,multiplier),healed=Math.min(Math.max(0,max-actor.hp),power);
  actor.hp+=healed;
  let spare=power-healed;
  for(const hit of actor.damageQueue??[]){
   const saved=Math.min(hit.amount,spare);
   hit.amount-=saved;spare-=saved;
   if(spare<=0)break;
  }
  return {healed,buffered:power-healed-spare};
 }
 function queueDamage(actor,hit,origin){
  (actor.damageQueue??=[]).push({amount:hit.total,type:hit.type,remaining:damageDelay,origin});
 }
 function rememberHit(actor,hit,amount){
  if(amount<=0)return null;
  const entry={source:hit.origin?.source??'Umgebung',action:hit.origin?.action??(damage[hit.type]?.label??'Treffer'),type:hit.type,amount};
  const history=actor.damageHistory??=[];
  history.push(entry);
  if(history.length>5)history.shift();
  return entry;
 }
 function deathReport(floor,layer,questions,actor,next,cause,finalHit){
  const history=[...(actor.damageHistory??[])];
  const fatal=cause==='fall'?{source:finalHit?.source??'Umgebung',action:'Sturz in den Abgrund',fall:true}:finalHit??history.at(-1);
  if(cause==='fall')history.push(fatal);
  const losses=Object.fromEntries(['gold','bones','rubies','xp'].map(key=>[key,Math.max(0,(actor[key]??0)-(next[key]??0))]));
  const learning={total:questions.length,solved:0,ready:0,later:0,retired:0,answered:actor.questionCount??0};
  for(const q of questions){
   if(actor.solved?.[q.id]>0)learning.solved++;
   const review=actor.questionReview?.[q.id];
   if(review?.color==='green')learning.retired++;
   else if((review?.due??0)>learning.answered)learning.later++;
   else learning.ready++;
  }
  return {floor,layer,history:history.slice(-5),fatal,losses,learning};
 }
 function takeDueDamage(actor,dt){
  const queue=actor.damageQueue;
  if(!queue?.length)return [];
  for(const hit of queue)hit.remaining-=dt;
  const next=queue.findIndex(hit=>hit.remaining>1e-7);
  return queue.splice(0,next<0?queue.length:next);
 }
 const requirements={
  rapier:{dexterity:11},hammer:{strength:12},staff:{intelligence:11},bow:{dexterity:11},
  blade:{faith:11},dagger:{dexterity:11},greatsword:{strength:13,endurance:11}
 };
 const kinds={weapon:'Waffen',ring:'Ringe',armor:'Rüstung'};
 const merchantRing={id:'merchant',name:'Händlerring',desc:'Ausgerüstet zeigt der Händler je eine zusätzliche Waffe, einen Ring und ein Rüstungsteil.',bonus:'merchant'};
 const heightRing={id:'height',name:'Ring der Höhe',desc:'Fängt dich beim Laufen und Ausweichen am Abgrund ab. Rückstoß kann dich über die Kante stoßen.',bonus:'height'};
 const madnessRing={id:'madness',name:'Ring des Wahns',desc:'Blutverlust im Umkreis von 220 erhöht deine Angriffskraft für 20 Sekunden um 20 %.',bonus:'madness'};
 const trialCharm={kind:'trialCharm',id:'sewer-trials',rarity:'rare',source:'Kanalisation'};
 function markTrials(actor,total,hasLaterDepth){
  if(actor.trialCharmActive)return false;
  const unopened=Array.from({length:total},(_,i)=>i).some(i=>!actor.opened.includes(i)&&!actor.trials[i]);
  if(!unopened&&!hasLaterDepth)return false;
  actor.trialCharmActive=true;
  return true;
 }
 const isTrial=(actor,index,fixed)=>index===fixed||actor.trialCharmActive===true&&!actor.opened.includes(index);
 const challengeRarity=(depth,roll)=>roll<(depth>=3?.12:.04)?'legendary':roll<.34?'epic':'rare';
 const madnessBonus=(actor,rings)=>rings.includes('madness')&&(actor.madnessUntil??0)>actor.playtime?1.20:1;
 const precisionRing={id:'precision',name:'Ring der Präzision',desc:'+8 Prozentpunkte Würfel-Crit-Chance.',bonus:'critical'};
 const breweryRing={id:'brewer',name:'Ring des Sudmeisters',desc:'Hebt die Seltenheit aller fünf Brauangebote um eine zulässige Stufe an.',bonus:'brewery'};
 const weapon=(id,rank='common')=>balance.weaponTable[id]?.[rank]||balance.weaponTable.rust.common;
 const armorProfile=(id,rank='common')=>balance.armorTable[id]?.[rank];
 const armorParts={helmet:'Helm',chest:'Harnisch',legs:'Hose',boots:'Stiefel'};
 const armorSets={
  wanderer:{name:'Wanderer',color:'#7b8896'},scholar:{name:'Gelehrten',color:'#7c6eb5'},
  hunter:{name:'Jäger',color:'#648477'},knight:{name:'Ritter',color:'#9caab9'},
  shadow:{name:'Schatten',color:'#5c4d7f'},pathfinder:{name:'Pfadschützen',color:'#44636b'},
  bastion:{name:'Bollwerk',color:'#a89775'},emberheart:{name:'Glutherz',color:'#91494b'},
  windstep:{name:'Windläufer',color:'#528398'}
 };
 const armorItems=Object.entries(armorSets).flatMap(([set,{name,color}])=>Object.entries(armorParts).map(([slot,label])=>{
  const id=set+'-'+slot;
  return {id,kind:'armor',slot,set,kg:armorProfile(id).kg,name:name+'-'+label,color};
 }));
 const classArmorSets={guardian:'knight',duelist:'wanderer',scholar:'scholar',pilgrim:'hunter',archer:'pathfinder'};
 function startingArmor(classId){
  return Object.fromEntries(armorItems.filter(piece=>piece.set===classArmorSets[classId]).map(piece=>[piece.slot,piece.id]));
 }
 function armorPerks(armor){
  const perks={};
  for(const id of Object.values(armor??{})){
   const effect=armorProfile(id)?.effect;
   if(effect)perks[effect.key]=(perks[effect.key]??0)+effect.value;
  }
  return perks;
 }
 const arrowRange=(weapon,armor)=>weapon.projectile==='arrow'?1+(armorPerks(armor).arrowReach??0):1;
 function meleeHit(weapon,dx,dy,aim,reach,size=1){
  const forward=dx*Math.cos(aim)+dy*Math.sin(aim);
  if(weapon.thrust)return forward>0&&forward<reach+(size-1)*10&&
   Math.abs(dy*Math.cos(aim)-dx*Math.sin(aim))<weapon.thrust+6*size;
  const distance=Math.hypot(dx,dy);
  return distance<reach+(size-1)*10&&(!distance||forward>distance*weapon.sweep);
 }
 const dashCooldown=armor=>1-(armorPerks(armor).dashCooldown??0);
 const healThreshold=.20,healTarget=.40;
 function armorCooldown(actor,key){
  return Math.max(0,(actor.armorCooldowns?.[key]??0)-actor.playtime);
 }
 function startArmorCooldown(actor,key,seconds){
  (actor.armorCooldowns??={})[key]=actor.playtime+seconds;
 }
 function recoverWithArmor(actor,armor,hp,max){
  if(hp<=0||hp>max*healThreshold||armorCooldown(actor,'heal')>0)return hp;
  const {heal,healBoost=0}=armorPerks(armor);
  if(!heal)return hp;
  startArmorCooldown(actor,'heal',heal-healBoost);
  return max*healTarget;
 }
 function blockArmorHit(actor,armor,status){
  if(!status&&armorCooldown(actor,'block')===0){
   const {block,blockBoost=0}=armorPerks(armor);
   if(block){
    startArmorCooldown(actor,'block',block-blockBoost);
    return true;
   }
  }
  return false;
 }
 function resolveArmorDamage(actor,armor,hp,max,damage){
  const taken=Math.min(hp,damage),damaged=hp-taken;
  const recovered=recoverWithArmor(actor,armor,damaged,max);
  return {hp:recovered,taken,proc:recovered>damaged?'heal':null};
 }
 function armorEffectText(id){
  const effect=armorProfile(id)?.effect;
  if(!effect)return '';
  const {key,value}=effect,seconds=value+' s',percent=Math.round(value*100)+' %';
  switch(key){
   case 'arrowReach':return '+'+percent+' Pfeilreichweite.';
   case 'block':return 'Blockt einen direkten Treffer vollständig. Lädt sich in '+seconds+' wieder auf.';
   case 'blockBoost':return 'Verkürzt die Abklingzeit des Bollwerk-Harnischs um '+seconds+'.';
   case 'heal':return 'Hebt deine verbleibenden LP bei höchstens 20 % Leben auf 40 %. Lädt sich in '+seconds+' wieder auf.';
   case 'healBoost':return 'Verkürzt die Abklingzeit des Glutherz-Harnischs um '+seconds+'.';
   case 'dashCooldown':return '−'+percent+' Abklingzeit beim Ausweichen.';
  }
 }
 const weaponCrit=(id,rank)=>weapon(id,rank).crit;
 function critChance(dexterity,load,weaponBonus,gearBonus){
  return Math.min(1,.05+Math.floor(Math.max(0,dexterity)/2)*.01+(load.ratio<.5?.05:0)+weaponBonus+gearBonus);
 }
 const weaponWeight=w=>weapon(w.id).kg;
 const loads=[
  {name:'Leicht',move:1,dashSpeed:3.1,dashTime:.22,stamina:1},
  {name:'Mittel',move:.91,dashSpeed:2.55,dashTime:.22,stamina:.88},
  {name:'Schwer',move:.79,dashSpeed:2.45,dashTime:.145,stamina:.72}
 ];
 function loadout(kg,burden){
  const max=balance.capacity(burden),ratio=kg/max;
  return {...loads[ratio>=1?2:ratio>=.5?1:0],kg,max,ratio,resist:Math.floor(kg/2)*.005};
 }
 const defenseBonus=(level,load)=>Math.max(0,level-1)*.005+load.resist;
 function upgradeRank(item){
  const ranks=Object.keys(rarity);
  return ranks[ranks.indexOf(rank(item))+1]||null;
 }
 const gradeRates={S:[2,1],A:[1,1],B:[1,2],C:[1,3],D:[1,4],E:[1,5]};
 function weaponScaling(w,attributes,rank='common'){
  return Object.entries(weapon(w.id,rank).grades).map(([attribute,grade])=>{
   const [points,step]=gradeRates[grade],level=Math.max(0,Math.floor(attributes[attribute]||0));
   const bonus=Math.floor(level/step)*points;
   return {attribute,grade,points,step,bonus,nextGain:Math.floor((level+1)/step)*points-bonus};
  });
 }
 function knockbackPower(w,attributes){
  return weapon(w.id).impact+balance.knockbackBase(attributes.vitality)+Math.floor((attributes.strength||0)/2);
 }
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
  {poison:1,dark:.30,fire:-.40},
  {physical:.12,fire:-.25,bleed:-.1},{physical:.06,frost:-.22,bleed:-.1},
  {fire:.45,frost:-.35},{lightning:.45,fire:-.30},
  {fire:-.22,bleed:-.12},{lightning:.48,frost:-.16},
  {physical:.08,frost:-.15},{frost:.65,fire:-.40},{frost:.60,fire:-.34},
  {dark:.32,poison:.65,fire:-.23},{dark:.38,poison:.65,fire:-.25}
 ];
 const foeAttack=[
  {physical:1},{physical:.35,fire:.65},{physical:.75,dark:.25},
  {physical:.4,magic:.6},{frost:.75,dark:.25},{physical:.75,dark:.25},{physical:1},{physical:1},{physical:.85,dark:.15},
  {physical:1},{physical:1},{physical:1},{physical:1},{lightning:1},{physical:1},{frost:1},{frost:1}
 ];
 const cryptScythes=[
  {id:'farm-scythe',name:'Bauernsense',desc:'Eine einfache Feldsense mit breiter Schneide. Baut Blutung auf.'},
  {id:'dark-scythe',name:'Dunkelsense',desc:'Schattenstahl aus der Krypta. Verursacht vor allem Dunkelschaden.'},
  {id:'great-scythe',name:'Großsense',desc:'Eine schwere Sense mit weitem Schwung und starkem Rückstoß.'}
 ];
 function cryptDrop(enemy,random,depth){
  if(!enemy.id?.startsWith('crypt-'))return null;
  const roll=random();
  if(roll>=.26)return null;
  const id=cryptScythes[roll<.13?0:roll<.19?1:2].id;
  const rarity=id==='farm-scythe'?'common':enemyRarity(random(),depth)??'common';
  return {kind:'weapon',id,rarity:id==='dark-scythe'&&rarity==='common'?'rare':rarity,source:'Krypta'};
 }
 function rank(item){return rarity[item?.rarity]?item.rarity:'common';}
 function key(item){return [item.kind,item.id,rank(item)].join('/');}
 function enemyRarity(roll,depth,sewer=false){
  if(sewer){
   if(roll<.10)return 'common';
   if(roll<.29)return 'rare';
   if(roll<.33)return 'epic';
   if(roll<.342)return 'legendary';
   if(roll<.348&&depth>=3)return 'mythic';
   return null;
  }
  if(roll<.13)return 'common';
  if(roll<.165)return 'rare';
  if(roll<.178)return depth>=3?'mythic':'epic';
  if(roll<.18)return 'legendary';
  return null;
 }
 const affinity=(piece,itemRank)=>armorProfile(piece?.id,itemRank)?.stats||{};
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
  const base={weapon:38,ring:32,armor:28,food:7,cup:5,potion:17}[item.kind]+Math.max(0,depth-1)*5;
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
  const offers=[...picks.map(row=>row[0]),...picks.map(row=>row[1])];
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  if(depth>=2&&offers.length&&state%100<38){
   const index=(state>>>8)%Math.min(3,offers.length),stock=offers[index].stock;
   const epic={...offers[index],rarity:'epic'};
   if((state>>>16)%100<55){
    offers[index]={kind:'cup',id:'cup',rarity:'rare',price:14,currency:'gold',source:'Händler',stock,bundle:3};
   }else{
    offers[index]={...epic,price:price(epic,depth)};
   }
  }
  return offers;
 }
 return {damage,rarity,cryptScythes,cryptDrop,weaponScaling,knockbackPower,food,foodSeconds,foodNeeded,chooseFood,eatMeal,queueDamage,rememberHit,deathReport,takeDueDamage,requirements,kinds,merchantRing,heightRing,madnessRing,trialCharm,markTrials,isTrial,challengeRarity,madnessBonus,precisionRing,breweryRing,weaponCrit,critChance,weapon,armorProfile,foes,foeAttack,rank,key,upgradeRank,weaponWeight,armorSets,armorParts,armorItems,classArmorSets,startingArmor,armorPerks,arrowRange,meleeHit,dashCooldown,armorCooldown,recoverWithArmor,blockArmorHit,resolveArmorDamage,armorEffectText,loadout,defenseBonus,enemyRarity,affinity,hit,rememberDamage,price,shop};
})();
