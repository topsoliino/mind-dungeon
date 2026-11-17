window.DungeonBrewing = (() => {
 'use strict';
 const effects=[
  {label:'Eile',icon:'»',description:'Lauftempo',color:'#d5a72f',speed:1.34},
  {label:'Weitschwung',icon:'↔',description:'Waffenreichweite',color:'#40a3a9',reach:1.27},
  {label:'Sparflamme',icon:'♨',description:'Geringere Ausdauerkosten',color:'#ce6e3d',cost:.76},
  {label:'Steinhaut',icon:'⬡',description:'Weniger erlittener Schaden',color:'#68a957',guard:.76},
  {label:'Frostessenz',icon:'❄',description:'Frostinfusion',color:'#468fd5',element:'frost'},
  {label:'Drachenatem',icon:'♨',description:'Feuerinfusion',color:'#d44e32',element:'fire'},
  {label:'Astraltinte',icon:'✧',description:'Magieinfusion',color:'#8157c4',element:'magic'},
  {label:'Sturmglas',icon:'ϟ',description:'Blitzinfusion',color:'#cfb53c',element:'lightning'},
  {label:'Kriegstrank',icon:'⚔',description:'Mehr Waffenschaden',color:'#b93749',damage:1.25},
  {label:'Falkenblick',icon:'✦',description:'Mehr Crit-Chance',color:'#c2884e',crit:.08},
  {label:'Tiefer Atem',icon:'≈',description:'Schnellere Ausdauerregeneration',color:'#4da489',regen:1.5},
  {label:'Lebensquell',icon:'♥',description:'Fortlaufende Heilung',color:'#c8597a',heal:.8},
  {label:'Eisenblut',icon:'⛨',description:'Physische Resistenz',color:'#8e8b9f',resist:{physical:.26}},
  {label:'Aschenmilch',icon:'♨',description:'Feuerresistenz',color:'#c77a43',resist:{fire:.34}},
  {label:'Erdung',icon:'ϟ',description:'Blitzresistenz',color:'#bbaa54',resist:{lightning:.42}},
  {label:'Mondsprung',icon:'☾',description:'Kürzere Dash-Abklingzeit',color:'#8d65be',dashCooldown:.71},
  {label:'Windtritt',icon:'↠',description:'Größere Dash-Distanz',color:'#509ec3',dashDistance:1.28},
  {label:'Wurzelhonig',icon:'✿',description:'Nahrung heilt stärker',color:'#d38a37',food:1.5},
  {label:'Bärenkraft',icon:'⚒',description:'Mehr Rückstoßkraft',color:'#b66446',impact:16},
  {label:'Natternsud',icon:'☣',description:'Giftresistenz',color:'#78a63c',resist:{poison:.56}}
 ];
 const seconds=42;
 const power={common:1,rare:1.35,epic:1.65,legendary:1.95,mythic:2.3};
 const infusions=new Set([4,5,6,7]);
 const ladder=(depth)=>depth<3?['common','rare','epic','legendary']:['common','rare','legendary','mythic'];
 function tier(roll,depth,ring){
  let rank=roll<.0065?(depth<3?'epic':'mythic'):roll<.024?'rare':'common';
  if(ring){const levels=ladder(depth);rank=levels[Math.min(levels.length-1,levels.indexOf(rank)+1)];}
  return rank;
 }
 function stock(seed,depth,ring,random,shuffle){
  const rng=random(seed^0x2d9408a1);
  // A selection can offer several supporting effects, but at most one infusion
  // so its temporary damage type is always unambiguous.
  const candidates=shuffle(effects.map((_,i)=>i),rng),selected=[];
  for(const id of candidates){
   if(infusions.has(id)&&selected.some(entry=>infusions.has(entry.id)))continue;
   selected.push({id,rank:tier(rng(),depth,ring)});
   if(selected.length===5)break;
  }
  return selected;
 }
 function entry(raw){
  if(Number.isInteger(raw))return Object.hasOwn(effects,raw)?{id:raw,rank:'common'}:null;
  return raw&&Object.hasOwn(effects,raw.id)&&Object.hasOwn(power,raw.rank)?{id:raw.id,rank:raw.rank}:null;
 }
 function entries(raw){return Array.isArray(raw)?raw.map(entry).filter(Boolean):[];}
 function bonuses(brew){
  const result={speed:1,reach:1,cost:1,guard:1,element:null,damage:1,crit:0,regen:1,heal:0,resist:{},
   dashCooldown:1,dashDistance:1,food:1,impact:0};
  if(!brew||brew.remaining<=0)return result;
  for(const {id,rank} of entries(brew.effects)){
   const effect=effects[id],scale=power[rank];
   for(const key of ['speed','reach','cost','guard','damage','regen','dashCooldown','dashDistance','food']){
    if(effect[key])result[key]*=Math.max(.26,1+(effect[key]-1)*scale);
   }
   for(const key of ['crit','heal','impact'])if(effect[key])result[key]+=effect[key]*scale;
   for(const [key,value] of Object.entries(effect.resist||{}))result.resist[key]=(result.resist[key]||0)+value*scale;
   if(effect.element){result.element=effect.element;result.damage*=1+.15*(scale-1);}
   if(rank==='mythic')result.guard*=1.15;
  }
  return result;
 }
 function mix(raw){
  const list=entries(raw);
  if(!list.length)return '#625040';
  const sum=[0,0,0];
  for(const {id} of list){
   const color=effects[id].color;
   for(let i=0;i<3;i++){
    const channel=parseInt(color.slice(1+2*i,3+2*i),16)/255;
    sum[i]+=channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
   }
  }
  const exposure=1/Math.max(1,Math.max(...sum)*1.04);
  return '#'+sum.map(value=>{
   const c=value*exposure,srgb=c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;
   return Math.round(srgb*255).toString(16).padStart(2,'0');
  }).join('');
 }
 return {effects,seconds,stock,entries,bonuses,mix};
})();
