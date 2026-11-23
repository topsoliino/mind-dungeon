/* Mind Dungeon Room Editor V1. No dependencies on the live generator. */
(function(root){
'use strict';
const TILE=48;
const artRoot='assets/';
const catalog={
 version:1,tileSize:TILE,projection:{stepX:42,stepY:42/Math.sqrt(3),footOffset:16},
 floors:{
  // Identifiers stay backward-compatible with existing exported room JSON.
  // Every photo uses its Poly Haven real-world coverage (1 grid ~ 1 metre).
  'dungeon-ashlar':{
   label:'Dark Rock 02 · dunkler Fels',base:'#343337',grout:'#242326',
   accent:'#62616a',pattern:'photo-raw',worldWidth:2.0,
   asset:artRoot+'tiles/floor-albedo-01.jpg',
   polyhaven:'dark_rock_02',
   source:'Poly Haven CC0 · 2 m Materialhöhe, korrektes UV-Diffuse'
  },
  'dungeon-coast-rocks':{
   label:'Coast Sand Rocks 02 · feuchter Naturfels',base:'#48463e',grout:'#2c302a',
   accent:'#777664',pattern:'photo-raw',worldWidth:15.0,
   asset:artRoot+'tiles/floor-albedo-02.jpg',
   polyhaven:'coast_sand_rocks_02',
   source:'Poly Haven CC0 · 15 m reale Materialbreite, echtes UV-Diffuse'
  },
  'dungeon-cut-stone':{
   label:'Cobblestone Floor 09 · altes Steinpflaster',base:'#525052',grout:'#303032',
   accent:'#848084',pattern:'photo-raw',worldWidth:2.2,
   asset:artRoot+'tiles/floor-albedo-03.jpg',
   polyhaven:'cobblestone_floor_09',
   source:'Poly Haven CC0 · 2,2 m reale Materialbreite, echtes UV-Diffuse'
  },
  'dungeon-mossy-cobbles':{
   label:'Cobblestone Floor 04 · nasses Moospflaster',base:'#3d413c',grout:'#242922',
   accent:'#67745d',pattern:'photo-raw',worldWidth:1.5,
   asset:artRoot+'tiles/floor-albedo-04.jpg',
   polyhaven:'cobblestone_floor_04',
   source:'Poly Haven CC0 · 1,5 m Originalbreite · feuchtes, vermoostes Pflaster'
  },
  'dungeon-ruined-cobbles':{
   label:'Cobblestone Floor 03 · beschädigte Pflastersteine',base:'#48463f',grout:'#292e29',
   accent:'#776b55',pattern:'photo-raw',worldWidth:2.4,
   asset:artRoot+'tiles/floor-albedo-05.jpg',
   polyhaven:'cobblestone_floor_03',
   source:'Poly Haven CC0 · 2,4 m Originalbreite · Moos, Schlamm und Spalten'
  },
  'dungeon-aged-paving':{
   label:'Stone Floor · verwittertes Steinpflaster',base:'#52483e',grout:'#2f2926',
   accent:'#7b7164',pattern:'photo-raw',worldWidth:1.8,
   asset:artRoot+'tiles/floor-albedo-06.jpg',
   polyhaven:'stone_floor',
   source:'Poly Haven CC0 · 1,8 m Originalbreite · altes, abgetretenes Steinpflaster'
  },
  'dungeon-rustic-slate':{
   label:'Slate Floor 02 · alte Schieferplatten',base:'#524546',grout:'#2d292a',
   accent:'#8b6a68',pattern:'photo-raw',worldWidth:2.0,
   asset:artRoot+'tiles/floor-albedo-07.jpg',
   polyhaven:'slate_floor_02',
   source:'Poly Haven CC0 · 2 m Originalbreite · abgenutzte Schieferplatten'
  },
  'dungeon-wet-mud':{
   label:'Brown Mud 03 · nasser Kerkerlehm',base:'#46362a',grout:'#2d261f',
   accent:'#755b45',pattern:'photo-raw',worldWidth:1.3,
   asset:artRoot+'tiles/floor-albedo-08.jpg',
   polyhaven:'brown_mud_03',
   source:'Poly Haven CC0 · 1,3 m Originalbreite · nasser Erd- und Lehmboden'
  }
 },
 walls:{
  stone:{
   label:'Rock Wall 17 · feuchter Bruchstein',height:2,solid:true,
   worldWidth:1.8,asset:artRoot+'tiles/wall-albedo-01.jpg',
   polyhaven:'rock_wall_17',render:'photo-wall-map'
  },
  'stone-cut':{
   label:'Rock Wall 16 · verwitterte Quader',height:2,solid:true,
   worldWidth:2.0,asset:artRoot+'tiles/wall-albedo-02.jpg',
   polyhaven:'rock_wall_16',render:'photo-wall-map'
  },
  'stone-old':{
   label:'Old Stone Wall · alte Steinmauer',height:2,solid:true,
   worldWidth:2.0,asset:artRoot+'tiles/wall-albedo-03.jpg',
   polyhaven:'old_stone_wall',render:'photo-wall-map'
  },
  'stone-rough-12':{
   label:'Rock Wall 12 · zerklüfteter Bruchstein',height:2,solid:true,
   worldWidth:1.6,asset:artRoot+'tiles/wall-albedo-04.jpg',
   polyhaven:'rock_wall_12',render:'photo-wall-map'
  },
  'stone-rough-13':{
   label:'Rock Wall 13 · alte verwitterte Quader',height:2,solid:true,
   worldWidth:2.0,asset:artRoot+'tiles/wall-albedo-05.jpg',
   polyhaven:'rock_wall_13',render:'photo-wall-map'
  },
  'stone-rough-14':{
   label:'Rock Wall 14 · dunkler grober Bruchstein',height:2,solid:true,
   worldWidth:1.8,asset:artRoot+'tiles/wall-albedo-06.jpg',
   polyhaven:'rock_wall_14',render:'photo-wall-map'
  },
  'stone-rough-15':{
   label:'Rock Wall 15 · raues Felsmauerwerk',height:2,solid:true,
   worldWidth:1.9,asset:artRoot+'tiles/wall-albedo-07.jpg',
   polyhaven:'rock_wall_15',render:'photo-wall-map'
  },
  'stone-castle-slates':{
   label:'Castle Wall Slates · geschichtete Burgsteine',height:2,solid:true,
   worldWidth:2.5,asset:artRoot+'tiles/wall-albedo-08.jpg',
   polyhaven:'castle_wall_slates',render:'photo-wall-map'
  },
  'stone-castle-aged':{
   label:'Castle Wall Variation · alte Burgquader',height:2,solid:true,
   worldWidth:2.0,asset:artRoot+'tiles/wall-albedo-09.jpg',
   polyhaven:'castle_wall_varriation',render:'photo-wall-map'
  },
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
