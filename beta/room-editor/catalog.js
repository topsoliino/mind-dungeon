/* Mind Dungeon Room Editor V1. No dependencies on the live generator. */
(function(root){
'use strict';
const TILE=48;
const artRoot='assets/';
const catalog={
 version:1,tileSize:TILE,projection:{stepX:42,stepY:42/Math.sqrt(3),footOffset:16},
 floors:{
  // One authored stone material only. Old room files use aliases,
  // normalized at import, instead of loading contradictory flat styles.
  'dungeon-ashlar':{
   label:'Kerker · hochauflösender Quaderstein',base:'#505460',grout:'#22242b',
   accent:'#a9a3a1',pattern:'blender-ashlar',
   asset:artRoot+'tiles/floor-prison-01.webp',
   source:'Blender Cycles · 512 × 512'
  }
 },
 walls:{
  stone:{label:'Kerker · 3D-Quadersteinmauer',height:2,solid:true,
   asset:artRoot+'tiles/wall-prison',
   render:'blender-cycles-512'},
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
 ],notes:'Offene isometrische Gefängniszelle: nur die beiden Rückwände Nord und West; niemals eine kameraseitige Süd- oder Ostwand. Rückseitig eine eiserne Zellentür. Keine Änderung am bestehenden Dungeon.'
};
for(let x=0;x<preset.width;x++){
 preset.walls.push({x,y:0,edge:'north',
  style:x===3?'gate':x===2||x===4?'bars':'stone'});
}
for(let y=0;y<preset.height;y++){
 preset.walls.push({x:0,y,edge:'west',style:'stone'});
}
root.MindRoomKit=Object.freeze({catalog,preset});
})(window);
