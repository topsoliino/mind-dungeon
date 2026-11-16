window.DungeonBrewing = (() => {
 'use strict';
 const topics=[
  ['Konditionierung','Mowrer','Angstkreislauf'],
  ['Grundlagen','Methodenmatrix','Leitlinien'],
  ['Angststörungen','Expositionsplanung','Angstkreislauf'],
  ['Zwang'],
  ['PTBS','IRRT']
 ];
 const effects=[
  {label:'Eile',icon:'»',description:'55 % schneller laufen',color:'#e2bc61',speed:1.55},
  {label:'Weitschwung',icon:'↔',description:'40 % mehr Waffenreichweite',color:'#9bd0d0',reach:1.4},
  {label:'Sparflamme',icon:'♨',description:'30 % geringere Ausdauerkosten',color:'#e7965d',cost:.7},
  {label:'Steinhaut',icon:'⬡',description:'35 % Schadensreduktion',color:'#a2cf9b',guard:.65},
  {label:'Frostessenz',icon:'❄',description:'Waffe verursacht Frostschaden',color:'#91d6ff',element:'frost'}
 ];
 const seconds=42;
 function ingredients(questions,defaultPack,roomNames){
  const groups=defaultPack?topics.map((terms,i)=>({
   id:String(i),name:roomNames[i],questions:questions.filter(q=>terms.includes(q.topic))
  })):Array.from(new Set(questions.map(q=>q.topic))).map((name,i)=>({
   id:String(i),name,questions:questions.filter(q=>q.topic===name)
  }));
  return groups.map((group,i)=>({...group,effect:i%effects.length})).filter(group=>group.questions.length);
 }
 function bonuses(brew){
  const result={speed:1,reach:1,cost:1,guard:1,element:null};
  if(!brew||brew.remaining<=0)return result;
  for(const index of brew.effects){
   const effect=effects[index];if(!effect)continue;
   for(const field of ['speed','reach','cost','guard'])if(effect[field])result[field]=effect[field];
   if(effect.element)result.element=effect.element;
  }
  return result;
 }
 return {effects,seconds,ingredients,bonuses};
})();
