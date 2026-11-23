/* Mind Dungeon Room Editor V1. No dependencies on the live generator. */
(function(root){
'use strict';
const TILE=48;
const artRoot='assets/';
const catalog={
 version:1,tileSize:TILE,projection:{stepX:42,stepY:42/Math.sqrt(3),footOffset:16},
 floors:{
  'dungeon-ashlar':{label:'Kerker · Quaderstein',base:'#494851',grout:'#222530',accent:'#7b7375',pattern:'ashlar'},
  'prison-slate':{label:'Gefängnis · Schiefer',base:'#505666',grout:'#222735',accent:'#84909a',pattern:'slate'},
  'worn-brick':{label:'Abgenutzter Ziegel',base:'#645351',grout:'#362a2b',accent:'#91706d',pattern:'brick'},
  'dark-cobbles':{label:'Feuchtes Kopfsteinpflaster',base:'#4c515b',grout:'#1c2530',accent:'#737981',pattern:'cobble'}
 },
 walls:{
  stone:{label:'Massive Gefängnismauer',height:2.0,solid:true,asset:'walls/stone'},
  bars:{label:'Geschmiedetes Zellen-Gitter',height:2.05,solid:true,asset:'walls/bars'},
  gate:{label:'Zellentür · Eisen',height:2.05,solid:true,door:true,asset:'walls/gate'},
  open:{label:'Offene Wand / Durchgang',height:0,solid:false,asset:null}
 },
 furniture:{
  'prison-table':{
   label:'Massiver Eichentisch',kind:'table',asset:artRoot+'furniture/table',
   footprint:{w:1.85,h:1.05},height:0.94,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:110,material:'dark aged oak + wrought iron',render:'blender-ortho-4'
  },
  'prison-chair':{
   label:'Gefängnisstuhl',kind:'chair',asset:artRoot+'furniture/chair',
   footprint:{w:.78,h:.79},height:1.28,
   destroyable:true,vaultable:true,blocksMovement:true,blocksProjectiles:false,
   maxHP:35,material:'aged oak + wrought iron',render:'blender-ortho-4'
  }
 }
};
const preset={
 schema:'mind-dungeon-room/v1',id:'prison-cell-01',
 name:'Gefängniszelle · Musterraum',width:7,height:5,
 floorStyle:'dungeon-ashlar',wallStyle:'stone',
 tiles:[],walls:[],furniture:[
  {id:'table-01',type:'prison-table',x:1.65,y:1.75,rot:0,destroyable:true,vaultable:false},
  {id:'chair-01',type:'prison-chair',x:4.25,y:2.65,rot:270,destroyable:true,vaultable:true}
 ],notes:'Ein abgeschlossener Zellenraum. Die Gitterfront liegt auf der Südseite. Ein Katalog für den prozeduralen Generator; keine Änderung am Dungeon.'
};
for(let x=0;x<preset.width;x++){
 for(let side of ['north','south']){
  const style=side==='south'?(x===3?'gate':'bars'):'stone';
  preset.walls.push({x,y:side==='south'?preset.height:0,edge:side,style});
 }
}
for(let y=0;y<preset.height;y++){
 preset.walls.push({x:0,y,edge:'west',style:'stone'});
 preset.walls.push({x:preset.width,y,edge:'east',style:'stone'});
}
root.MindRoomKit=Object.freeze({catalog,preset});
})(window);
