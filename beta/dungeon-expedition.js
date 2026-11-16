window.DungeonExpedition = (() => {
 'use strict';
 function firstSlot(slots,key){
  return [key,...slots.filter(value=>value&&value!==key),null,null,null].slice(0,4);
 }
 const currency={gold:{label:'Gold',icon:'◈'},bones:{label:'Knochen',icon:'♙'},rubies:{label:'Rubine',icon:'◆'}};
 function stock(pools,seed,depth,shuffle,random){
  function choose(key,count,price,rarity,source){
   const rng=random(seed^(key==='rubies'?0x56d231a9:Math.imul(depth,0x193ea021)));
   return Object.entries(pools).flatMap(([kind,list])=>shuffle(list.filter(it=>it.id!=='merchant').sort((a,b)=>a.id.localeCompare(b.id)),rng).slice(0,count).map((entry,i)=>({
    ...entry,rarity,price,currency:key,source,stock:key+'-'+kind+'-'+i
   })));
  }
  return {
   bones:depth>=3?choose('bones',1,2,'rare','Knochenhandel'):[],
   rubies:depth>=4?choose('rubies',2,1,'mythic','Rubinhandel'):[]
  };
 }
 function waterTiles(terrain,regions){
  const cells=[];
  const water=new Set(['river','clear-river','waterfall']);
  for(let y=0;y<terrain.length;y++)for(let x=0;x<terrain[y].length;x++){
   const type=terrain[y][x];if(!water.has(type))continue;
   const id=regions[y][x];
   const vertical=type!=='river'||(water.has(terrain[y-1]?.[x])||water.has(terrain[y+1]?.[x]));
   cells.push({x,y,type,id,vertical});
  }
  return cells;
 }
 return {firstSlot,currency,stock,waterTiles};
})();