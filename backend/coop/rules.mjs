import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const worldContext=vm.createContext({window:{},crypto:globalThis.crypto});
for(const file of ['strata','run','balance','items','enemies','brewing','expedition','world','enemy-sim']){
 const path=new URL('../../beta/dungeon-'+file+'.js',import.meta.url);
 vm.runInContext(readFileSync(path,'utf8'),worldContext,{filename:path.pathname});
}
export const {DungeonRun:run,DungeonBalance:balance,DungeonItems:items,DungeonEnemies:foes,
 DungeonWorld:geometry,DungeonBrewing:brewing,DungeonExpedition:expedition,DungeonEnemySim:enemySim}=worldContext.window;
export const defaultPack=run.validatePack(JSON.parse(readFileSync(new URL('../../questions/kvt3.json',import.meta.url),'utf8')));
export const {TILE,HERO_RADIUS}=geometry;
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const remaining=(value,dt)=>Math.max(0,(value||0)-dt);
export const round=(value,digits=10)=>Math.round(value*digits)/digits;
export const xpRequired=level=>60+level*38+level*level*5;
export const maxHP=p=>32+p.attributes.vigor*3;
export const normalAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
export const slotOf=id=>id.split('-').at(-1);
export const stats=['vigor','attunement','endurance','vitality','strength','dexterity','intelligence','faith','luck'];
const classes={
 guardian:['Wächter','rust','bulwark',{vigor:14,endurance:12,strength:12,vitality:12}],
 duelist:['Duellant','rapier','hunter',{dexterity:15,endurance:12}],
 scholar:['Gelehrter','staff','scholar',{intelligence:15,attunement:15}],
 pilgrim:['Pilger','blade','faith',{faith:15,vigor:11}],
 archer:['Pfadschütze','bow','dodge',{dexterity:15,endurance:13,vigor:11,strength:8}],
 shadow:['Schattenläufer','dagger','luck',{dexterity:15,luck:15}]
};
export const item=(kind,id,rarity='common',source='Koop')=>({kind,id,rarity,source});
export const pools={
 weapon:Object.keys(balance.weaponTable).map(id=>item('weapon',id)),
 ring:['hunter','bulwark','scholar','faith','luck','dodge','precision','brewer','merchant'].map(id=>item('ring',id)),
 armor:Object.keys(balance.armorTable).map(id=>item('armor',id))
};
export const cup=source=>item('cup','cup','rare',source);
export function makePlayer(seat,character,pack){
 const chosen=Object.hasOwn(classes,character?.classId)?character.classId:'guardian';
 const [className,weapon,ring,boosts]=classes[chosen];
 const attributes={...Object.fromEntries(stats.map(key=>[key,10])),...boosts};
 const color=(key,fallback)=>typeof character?.[key]==='string'&&/^#[a-f0-9]{6}$/i.test(character[key])?character[key]:fallback;
 const appearance={name:typeof character?.name==='string'?character.name.trim().slice(0,24)||'Wanderer':'Wanderer',
  classId:chosen,className,gender:character?.gender==='female'?'female':'male',
  color:color('color','#7652a9'),skin:color('skin','#d4a785'),hair:color('hair','#392b4e')};
 const armor=items.startingArmor(chosen);
 const inventory=[item('weapon',weapon),item('ring',ring),...Object.values(armor).map(id=>item('armor',id))];
 const p={seat,appearance,pack,attributes,inventory,equipment:{weapon,weaponRarity:'common',armor,armorRarities:{},rings:[ring,null],ringRarities:{}},
  xp:0,level:1,pendingLevels:0,gold:0,bones:0,rubies:0,kills:0,solved:{},questionCount:0,questionReview:{},activeBrew:null,
  combatRecord:{deaths:0,dealt:0,taken:0,crits:0,counters:0},playtime:0,revision:0,input:{seq:-1,x:0,y:0,aim:0},online:false};
 preparePlayer(p);
 return p;
}
export function preparePlayer(p){
 p.armorCooldowns??={};
 p.mods=brewing.bonuses(p.activeBrew);
 const {weapon,weaponRarity,armor,armorRarities,rings,ringRarities}=p.equipment;
 p.weapon=weapon?items.weapon(weapon,weaponRarity):null;
 const kg=(p.weapon?.kg??0)+Object.values(armor).reduce((sum,id)=>sum+(items.armorProfile(id)?.kg??0),0);
 p.load=items.loadout(kg,p.attributes.vitality);
 const mythicArmor=Object.keys(armor).filter(key=>armorRarities[key]==='mythic').length;
 const mythicRings=rings.filter((id,index)=>id&&ringRarities[index]==='mythic').length;
 p.speed=178*p.load.move*balance.armorMythicMove**mythicArmor*p.mods.speed;
 p.staminaMax=Math.round((39+p.attributes.endurance*2)*p.load.stamina);
 const base=items.defenseBonus(p.level,p.load);
 const resistance=Object.fromEntries(Object.keys(items.damage).map(key=>[key,base]));
 for(const [slot,id] of Object.entries(armor)){
  for(const [key,v] of Object.entries(items.armorProfile(id,armorRarities[slot])?.stats??{}))resistance[key]+=v;
 }
 for(const [key,v] of Object.entries(p.mods.resist))resistance[key]+=v;
 resistance.dark-=mythicRings*.12;
 p.resistance=Object.fromEntries(Object.entries(resistance).map(([key,v])=>[key,Math.min(.9,v)]));
 p.guard=(rings.includes('bulwark')?.88:1)*p.mods.guard;
 if(!p.weapon)return;
 const scaling=items.weaponScaling(p.weapon,p.attributes,weaponRarity);
 const fast=rings.includes('hunter')&&p.weapon.speed<.3?1.18:1;
 const arcane=rings.includes('scholar')&&scaling.some(s=>s.attribute==='intelligence')?1.22:1;
 p.damage=Math.round((p.weapon.base+scaling.reduce((sum,s)=>sum+s.bonus,0))*fast*arcane*(1+.20*mythicRings))*p.mods.damage;
 p.crit=items.critChance(p.attributes.dexterity,p.load,p.weapon.crit,rings.filter(id=>id==='precision').length*.08+p.mods.crit);
 p.impact=items.knockbackPower(p.weapon,p.attributes)+p.mods.impact;
}
export function equipped(p,it){
 const eq=p.equipment,r=items.rank(it);
 if(it.kind==='weapon')return eq.weapon===it.id&&eq.weaponRarity===r;
 if(it.kind==='armor')return eq.armor[slotOf(it.id)]===it.id&&(eq.armorRarities[slotOf(it.id)]??'common')===r;
 return it.kind==='ring'&&eq.rings.some((id,i)=>id===it.id&&(eq.ringRarities[i]??'common')===r);
}
export function unequip(p,it){
 const eq=p.equipment;
 if(it.kind==='weapon'){eq.weapon=null;eq.weaponRarity='common';}
 if(it.kind==='armor'){const key=slotOf(it.id);delete eq.armor[key];delete eq.armorRarities[key];}
 if(it.kind==='ring'){const i=eq.rings.findIndex((id,index)=>id===it.id&&(eq.ringRarities[index]??'common')===items.rank(it));if(i>=0){eq.rings[i]=null;delete eq.ringRarities[i];}}
}
export function equip(p,it,slot){
 const eq=p.equipment,rank=items.rank(it);
 if(it.kind==='weapon'&&Object.entries(items.requirements[it.id]??{}).every(([key,n])=>p.attributes[key]>=n)){
  eq.weapon=it.id;eq.weaponRarity=rank;return true;
 }
 if(it.kind==='armor'&&items.armorProfile(it.id)){eq.armor[slotOf(it.id)]=it.id;eq.armorRarities[slotOf(it.id)]=rank;return true;}
 if(it.kind==='ring'&&!equipped(p,it)){
  const i=slot===0||slot===1?slot:eq.rings[0]?1:0;
  eq.rings[i]=it.id;eq.ringRarities[i]=rank;return true;
 }
 return false;
}
export function selectLoot(rank,floor,random){
 const list=rank==='common'&&random()<.56?Object.keys(items.food).map(id=>item('food',id)):Object.values(pools).flat();
 const picked=list[Math.floor(random()*list.length)];
 return {...picked,rarity:picked.kind==='food'?'common':rank,source:'Gegnerbeute · Tiefe '+floor};
}
const normalize=value=>value.toLowerCase().replaceAll('ä','ae').replaceAll('ö','oe').replaceAll('ü','ue').replaceAll('ß','ss')
 .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function editDistance(a,b){
 const scores=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  let diagonal=scores[0];scores[0]=i;
  for(let j=1;j<=b.length;j++){
   const above=scores[j];scores[j]=Math.min(above+1,scores[j-1]+1,diagonal+(a[i-1]!==b[j-1]));diagonal=above;
  }
 }
 return scores[b.length];
}
export function correct(q,value){
 if(q.type==='multiple-choice')return Array.isArray(value)&&value.length===q.correctIndices.length&&q.correctIndices.every(i=>value.includes(i));
 if(q.type==='single-choice')return Number.isInteger(value)&&value===q.correctIndex;
 if(typeof value!=='string'||value.length>240)return false;
 const a=normalize(value);
 return Boolean(a)&&q.answers.some(text=>{
  const b=normalize(text),len=b.length,tolerance=len>=22?3:len>=10?2:len>=6?1:0;
  return a===b||Math.abs(a.length-len)<=tolerance&&editDistance(a,b)<=tolerance;
 });
}
