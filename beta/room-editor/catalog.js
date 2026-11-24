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
  // Keep the original bars ID for existing saved rooms and presets.
  bars:{label:'Geschmiedetes Zellen-Gitter · klassisch',height:2.05,solid:true,
   render:'blender-bars',variant:'full',
   asset:'assets/walls/prison-grille-full-front.png',
   cameraOrthoScale:2.5,worldWidth:1,material:'pitted forged black iron + rust'},
  'bars-full':{
   label:'Gefängnisgitter · volle Wandhöhe (2 m)',height:2,solid:true,
   render:'blender-bars',variant:'full',asset:'assets/walls/prison-grille-full-front.png',
   cameraOrthoScale:2.5,worldWidth:1,material:'pitted forged black iron + rust'
  },
  'bars-half':{
   label:'Gefängnisgitter · halbe Wandhöhe (1 m)',height:1,solid:true,
   render:'blender-bars',variant:'half',asset:'assets/walls/prison-grille-half-front.png',
   cameraOrthoScale:1.5,worldWidth:1,material:'pitted forged black iron + rust'
  },
  gate:{label:'Zellentür · Eisen',height:2.05,solid:true,door:true,
   render:'metal-bars',asset:'walls/gate'},
  open:{label:'Offene Wand / Durchgang',height:0,solid:false,asset:null}
 },
 furniture:{
  'prison-table':{
   label:'Massiver Eichentisch',kind:'table',asset:artRoot+'furniture/table',
   footprint:{w:1.41,h:.80},height:.95,bodyHeight:.75,lights:[[0.2432,-0.1216,0.91732,0.22,0.95],[0.38,0.0608,0.86412,0.19,0.85],[0.1292,0.10640000000000001,0.84132,0.18,0.8]],
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:110,material:'dark aged oak + wrought iron',render:'blender-ortho-4'
  },
  'prison-chair':{
   label:'Gefängnisstuhl',kind:'chair',asset:artRoot+'furniture/chair',
   footprint:{w:.56,h:.57},height:.97,
   destroyable:true,vaultable:true,blocksMovement:true,blocksProjectiles:false,
   maxHP:35,material:'aged oak + wrought iron',render:'blender-ortho-4'
  },
  'alchemy-work-table':{
   label:'Alchemisten-Werktisch',kind:'table',asset:artRoot+'furniture/work-table',extension:'png',editorSpriteScale:.5,
   footprint:{w:.913,h:.517},height:.913,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:115,material:'weathered oak + wrought iron',render:'blender-ortho-4'
  },
  'alchemy-brew-table':{
   label:'Brautisch · großer Kessel',kind:'table',asset:artRoot+'furniture/brew-table-small',extension:'png',editorSpriteScale:.5,
   footprint:{w:.871,h:.494},height:1.001,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:120,material:'oak + hammered copper + glass',render:'blender-ortho-4',interaction:'brew'
  },
  'alchemy-highback-chair':{
   label:'Hochlehnstuhl · Alchemie',kind:'chair',asset:artRoot+'furniture/chair-highback',extension:'png',editorSpriteScale:.5,
   footprint:{w:.36,h:.36},height:.81,
   destroyable:true,vaultable:true,blocksMovement:true,blocksProjectiles:false,
   maxHP:45,material:'aged oak + linen + iron',render:'blender-ortho-4'
  },
  'alchemy-armchair':{
   label:'Armstuhl · Alchemie',kind:'chair',asset:artRoot+'furniture/chair-arm',extension:'png',editorSpriteScale:.5,
   footprint:{w:.41,h:.40},height:.76,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:false,
   maxHP:55,material:'aged oak + brass + linen',render:'blender-ortho-4'
  },
  'dungeon-weapon-rack':{
   label:'Waffenständer · Schmiedeeisen',kind:'rack',asset:artRoot+'furniture/weapon-rack',extension:'png',editorSpriteScale:.5,
   footprint:{w:.82,h:.43},height:.98,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:95,material:'blackened oak + steel swords + forged iron',render:'blender-ortho-4'
  },
  'dungeon-bookshelf':{
   label:'Bücherregal · Verbotene Bibliothek',kind:'shelf',asset:artRoot+'furniture/bookshelf',extension:'png',editorSpriteScale:.5,
   footprint:{w:.75,h:.37},height:1.18,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:110,material:'aged oak + leather books + iron bindings',render:'blender-ortho-4'
  },
  'dungeon-torture-bench':{
   label:'Folterbank · Kerker',kind:'bench',asset:artRoot+'furniture/torture-bench',extension:'png',editorSpriteScale:.5,
   footprint:{w:1.04,h:.58},height:.51,
   destroyable:true,vaultable:true,blocksMovement:true,blocksProjectiles:true,
   maxHP:150,material:'stained oak + leather restraints + iron winch',render:'blender-ortho-4'
  },
  'torture-iron-cage':{
   label:'Eiserner Hängekäfig',kind:'cage',asset:artRoot+'furniture/iron-cage',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.79,h:0.55},height:1.2,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:140,material:'rusty wrought iron + heavy medieval oak',render:'blender-ortho-4'
  },
  'torture-interrogation-chair':{
   label:'Verhörstuhl',kind:'chair',asset:artRoot+'furniture/interrogation-chair',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.44,h:0.43},height:0.91,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:95,material:'heavy black oak + iron + leather',render:'blender-ortho-4'
  },
  'torture-tool-table':{
   label:'Folterwerkzeug-Tisch',kind:'table',asset:artRoot+'furniture/tool-table',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.76,h:0.45},height:0.76,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:100,material:'aged oak + blacksmith forged implements',render:'blender-ortho-4'
  },
  'torture-chain-wall':{
   label:'Kettenwand · modular',kind:'wall-prop',asset:artRoot+'furniture/chain-wall',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.78,h:0.28},height:1.05,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:160,material:'damp ashlar + forged chains',render:'blender-ortho-4'
  },
  'torture-iron-maiden':{
   label:'Eiserne Jungfrau · geschlossen',kind:'cabinet',asset:artRoot+'furniture/iron-maiden',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.55,h:0.38},height:1.28,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:180,material:'oxidised iron + gothic cast metal',render:'blender-ortho-4'
  },
  'torture-ember-brazier':{
   label:'Glutbecken · Kohle',kind:'brazier',asset:artRoot+'furniture/ember-brazier',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.48,h:0.48},height:0.62,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:75,material:'forged iron + charcoal embers',render:'blender-ortho-4'
  },
  'torture-pillory':{
   label:'Pranger · Eiche',kind:'stocks',asset:artRoot+'furniture/pillory',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.82,h:0.43},height:0.95,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:90,material:'weathered oak + iron stocks',render:'blender-ortho-4'
  },
  'torture-wheel':{
   label:'Folterrad · Holz',kind:'wheel',asset:artRoot+'furniture/torture-wheel',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.82,h:0.5},height:1.08,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:115,material:'antique spoked oak + iron rim',render:'blender-ortho-4'
  },
  'torture-prison-cage':{
   label:'Gefangenenkäfig · Transport',kind:'cage',asset:artRoot+'furniture/prison-cage',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.65,h:0.57},height:0.65,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:110,material:'low rectangular iron cage + oak sled',render:'blender-ortho-4'
  },
  'torture-washbasin':{
   label:'Kerker-Waschbecken',kind:'basin',asset:artRoot+'furniture/washbasin',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.78,h:0.47},height:0.48,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:120,material:'damp granite + oak bucket + iron rings',render:'blender-ortho-4'
  },
  'floor-rubble':{
   label:'Broken Stone Rubble',kind:'clutter',category:'floor-clutter',asset:artRoot+'furniture/floor-rubble',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.75,h:0.51},height:0.15,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:false,
   maxHP:60,material:'fractured limestone, mortar rubble',render:'blender-ortho-4'
  },
  'floor-bones':{
   label:'Discarded Bones & Skulls',kind:'clutter',category:'floor-clutter',asset:artRoot+'furniture/floor-bones',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.76,h:0.47},height:0.13,
   destroyable:false,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:0,material:'ancient bone, weathered teeth',render:'blender-ortho-4'
  },
  'floor-rug':{
   label:'Torn Carpets & Rugs',kind:'clutter',category:'floor-clutter',asset:artRoot+'furniture/floor-rug',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.82,h:0.52},height:0.05,
   destroyable:false,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:0,material:'tattered woven burgundy wool',render:'blender-ortho-4'
  },
  'floor-chains':{
   label:'Abandoned Chains & Shackles',kind:'clutter',category:'floor-clutter',asset:artRoot+'furniture/floor-chains',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.82,h:0.5},height:0.06,
   destroyable:false,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:0,material:'rusted iron and hand-forged links',render:'blender-ortho-4'
  },
  'floor-wood':{
   label:'Rotten Wooden Debris',kind:'clutter',category:'floor-clutter',asset:artRoot+'furniture/floor-wood',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.86,h:0.5},height:0.16,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:false,
   maxHP:45,material:'broken moldy dark oak boards',render:'blender-ortho-4'
  },
  'floor-moss':{
   label:'Moss, Roots & Fungi',kind:'clutter',category:'floor-clutter',asset:artRoot+'furniture/floor-moss',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.7,h:0.46},height:0.1,
   destroyable:false,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:0,material:'wet moss, tree roots, mushrooms',render:'blender-ortho-4'
  },
  'floor-scrolls':{
   label:'Old Scrolls & Torn Books',kind:'clutter',category:'floor-clutter',asset:artRoot+'furniture/floor-scrolls',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.67,h:0.44},height:0.09,
   destroyable:false,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:0,material:'aged parchment, leather books',render:'blender-ortho-4'
  },
  'floor-puddles':{
   label:'Puddles & Damp Patches',kind:'clutter',category:'floor-clutter',asset:artRoot+'furniture/floor-puddles',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.77,h:0.55},height:0.03,
   destroyable:false,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:0,material:'reflective dark damp stone',render:'blender-ortho-4'
  },
  'floor-pottery':{
   label:'Broken Pottery & Bottles',kind:'clutter',category:'floor-clutter',asset:artRoot+'furniture/floor-pottery',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.73,h:0.46},height:0.17,
   destroyable:false,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:0,material:'fired earthenware, fractured green glass',render:'blender-ortho-4'
  },
  'floor-cloth':{
   label:'Dusty Cloth & Burlap Sacks',kind:'clutter',category:'floor-clutter',asset:artRoot+'furniture/floor-cloth',extension:'png',editorSpriteScale:.5,
   footprint:{w:0.71,h:0.52},height:0.12,
   destroyable:false,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:0,material:'degraded linen, dusty burlap',render:'blender-ortho-4'
  },
  'wall-stone-pilaster':{
   label:'W1 · Hervortretender Steinpfeiler',kind:'architectural-wall',category:'wall-architecture',
   asset:artRoot+'furniture/wall-stone-pilaster',extension:'png',editorSpriteScale:1.0,
   footprint:{w:0.98,h:0.6},height:2,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:180,material:'damp carved ashlar stone',render:'blender-ortho-4',
   wallMounted:true
  },
  'wall-freestanding-column':{
   label:'Freistehende Wandsäule',kind:'architectural-wall',category:'wall-architecture',
   asset:artRoot+'furniture/wall-freestanding-column',extension:'png',editorSpriteScale:1.0,
   footprint:{w:0.66,h:0.66},height:2,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:180,material:'weathered gothic limestone',render:'blender-ortho-4',
   wallMounted:true
  },
  'wall-wood-pillar':{
   label:'Hölzerner Stützpfeiler',kind:'architectural-wall',category:'wall-architecture',
   asset:artRoot+'furniture/wall-wood-pillar',extension:'png',editorSpriteScale:1.0,
   footprint:{w:0.69,h:0.56},height:2,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:110,material:'heavy aged oak + forged iron',render:'blender-ortho-4',
   wallMounted:true
  },
  'wall-wood-ledge':{
   label:'Hölzerner Wandvorsprung',kind:'architectural-wall',category:'wall-architecture',
   asset:artRoot+'furniture/wall-wood-ledge',extension:'png',editorSpriteScale:1.0,
   footprint:{w:1.1,h:0.91},height:1.4,
   destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:85,material:'oak beams + wrought brackets',render:'blender-ortho-4',
   wallMounted:true,
   surface:{elevation:1.33,access:'vault',type:'elevated',frontSteps:false}
  },
  'wall-stone-cornice':{
   label:'Steinernes Wandgesims',kind:'architectural-wall',category:'wall-architecture',
   asset:artRoot+'furniture/wall-stone-cornice',extension:'png',editorSpriteScale:1.0,
   footprint:{w:1.2,h:0.49},height:2,
   destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:120,material:'carved gothic masonry',render:'blender-ortho-4',
   wallMounted:true
  },
  'wall-statue-knight':{
   label:'Wandstatue I · Steinritter',kind:'architectural-wall',category:'wall-architecture',
   asset:artRoot+'furniture/wall-statue-knight',extension:'png',editorSpriteScale:1.0,
   footprint:{w:0.94,h:0.65},height:1.95,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:135,material:'carved knight statue + masonry',render:'blender-ortho-4',
   wallMounted:true
  },
  'wall-statue-gargoyle':{
   label:'Wandstatue II · Gargoyle',kind:'architectural-wall',category:'wall-architecture',
   asset:artRoot+'furniture/wall-statue-gargoyle',extension:'png',editorSpriteScale:1.0,
   footprint:{w:0.98,h:0.8},height:1.98,
   destroyable:true,vaultable:false,blocksMovement:true,blocksProjectiles:true,
   maxHP:145,material:'ancient gothic gargoyle stone',render:'blender-ortho-4',
   wallMounted:true
  },
  'wall-broken-masonry':{
   label:'Herausgebrochener Mauerabschnitt',kind:'architectural-wall',category:'wall-architecture',
   asset:artRoot+'furniture/wall-broken-masonry',extension:'png',editorSpriteScale:1.0,
   footprint:{w:1.18,h:0.46},height:2,
   destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:140,material:'broken limestone + exposed masonry',render:'blender-ortho-4',
   wallMounted:true
  },
  'light-torch-iron':{label:"Wandfackel · geschmiedete Platte",kind:"light",category:'lighting',asset:artRoot+'furniture/light-torch-iron',extension:'png',editorSpriteScale:1,wallMounted:true,lights:[[0,0.15,1.57,0.6,2.6]],footprint:{w:0.25,h:0.34},height:1.62,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'light-torch-ring':{label:"Wandfackel · Eisenring",kind:"light",category:'lighting',asset:artRoot+'furniture/light-torch-ring',extension:'png',editorSpriteScale:1,wallMounted:true,lights:[[0,0.15,1.57,0.67,2.8]],footprint:{w:0.3,h:0.36},height:1.62,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'light-torch-gothic':{label:"Wandfackel · gotische Konsole",kind:"light",category:'lighting',asset:artRoot+'furniture/light-torch-gothic',extension:'png',editorSpriteScale:1,wallMounted:true,lights:[[0,0.15,1.57,0.74,3]],footprint:{w:0.3,h:0.38},height:1.62,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'light-candle-single':{label:"Kerze · alter Wachsstumpf",kind:"light",category:'lighting',asset:artRoot+'furniture/light-candle-single',extension:'png',editorSpriteScale:1,lights:[[0,0,0.29,0.22,0.95]],footprint:{w:0.23,h:0.23},height:0.29,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'light-candle-cluster':{label:"Kerzen · drei Wachsstümpfe",kind:"light",category:'lighting',asset:artRoot+'furniture/light-candle-cluster',extension:'png',editorSpriteScale:1,lights:[[-0.09,0.045,0.257,0.21,0.95],[0.09,0.04,0.167,0.19,0.85],[0,-0.08,0.337,0.24,1.05]],footprint:{w:0.34,h:0.3},height:0.34,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'light-candle-candelabra':{label:"Kerzen · eiserner Kandelaber",kind:"light",category:'lighting',asset:artRoot+'furniture/light-candle-candelabra',extension:'png',editorSpriteScale:1,lights:[[-0.19,0,0.595,0.21,1],[0,0,0.755,0.24,1.1],[0.19,0,0.595,0.21,1]],footprint:{w:0.52,h:0.28},height:0.76,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'deco-fungi-grey':{label:"Pilze · schiefergraue Gruppe",kind:"clutter",category:'floor-clutter',asset:artRoot+'furniture/deco-fungi-grey',extension:'png',editorSpriteScale:1,footprint:{w:0.6,h:0.54},height:0.16,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'deco-fungi-brown':{label:"Pilze · braune Großgruppe",kind:"clutter",category:'floor-clutter',asset:artRoot+'furniture/deco-fungi-brown',extension:'png',editorSpriteScale:1,footprint:{w:0.66,h:0.6},height:0.27,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'deco-fungi-white':{label:"Pilze · blasse Elfenbeinkappen",kind:"clutter",category:'floor-clutter',asset:artRoot+'furniture/deco-fungi-white',extension:'png',editorSpriteScale:1,footprint:{w:0.6,h:0.54},height:0.16,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'deco-fungi-ochre':{label:"Pilze · ockerfarbene Gruppe",kind:"clutter",category:'floor-clutter',asset:artRoot+'furniture/deco-fungi-ochre',extension:'png',editorSpriteScale:1,footprint:{w:0.6,h:0.54},height:0.16,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'deco-moss-wet':{label:"Moos · feuchter Wandfuß",kind:"clutter",category:'floor-clutter',asset:artRoot+'furniture/deco-moss-wet',extension:'png',editorSpriteScale:1,footprint:{w:0.72,h:0.56},height:0.06,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'deco-moss-thick':{label:"Moos · dichte Polster",kind:"clutter",category:'floor-clutter',asset:artRoot+'furniture/deco-moss-thick',extension:'png',editorSpriteScale:1,footprint:{w:0.74,h:0.58},height:0.07,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'deco-moss-yellow':{label:"Moos · kleine gelbe Wildblüten",kind:"clutter",category:'floor-clutter',asset:artRoot+'furniture/deco-moss-yellow',extension:'png',editorSpriteScale:1,footprint:{w:0.74,h:0.58},height:0.2,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'deco-moss-white':{label:"Moos · kleine weiße Wildblüten",kind:"clutter",category:'floor-clutter',asset:artRoot+'furniture/deco-moss-white',extension:'png',editorSpriteScale:1,footprint:{w:0.74,h:0.58},height:0.2,destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:30,material:'weathered crypt environment',render:'blender-ortho-4'},
  'ambient-roaches':{label:"Schabenstraße",kind:"ambient",category:'ambient-life',asset:artRoot+'furniture/ambient-roaches',extension:'png',editorSpriteScale:1,ambient:"roach",footprint:{w:0.28,h:0.28},height:0.05,destroyable:false,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:1,material:'weathered crypt environment',render:'procedural-ambient'},
  'ambient-flies':{label:"Fliegenschwarm",kind:"ambient",category:'ambient-life',asset:artRoot+'furniture/ambient-flies',extension:'png',editorSpriteScale:1,ambient:"fly",footprint:{w:0.28,h:0.28},height:0.55,destroyable:false,vaultable:false,blocksMovement:false,blocksProjectiles:false,maxHP:1,material:'weathered crypt environment',render:'procedural-ambient'},
  'arch-stone-dais':{
   label:'Erhöhtes Steinpodest',kind:'platform',category:'architectural-floor',
   asset:artRoot+'furniture/arch-stone-dais',extension:'png',editorSpriteScale:1.0,
   footprint:{w:1.8,h:1.85},height:0.55,
   destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:170,material:'elevated medieval dungeon architecture',render:'blender-ortho-4',
   surface:{elevation:0.55,access:'steps',type:'elevated',frontSteps:true}
  },
  'arch-sunken-floor':{
   label:'Abgesenkter Bodenbereich',kind:'platform',category:'architectural-floor',
   asset:artRoot+'furniture/arch-sunken-floor',extension:'png',editorSpriteScale:1.0,
   footprint:{w:1.84,h:1.72},height:-0.55,
   destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:190,material:'sunken medieval dungeon architecture',render:'blender-ortho-4',
   surface:{elevation:-0.55,access:'steps',type:'sunken',frontSteps:true}
  },
  'arch-raised-walkway':{
   label:'Erhöhter Holzsteg',kind:'platform',category:'architectural-floor',
   asset:artRoot+'furniture/arch-raised-walkway',extension:'png',editorSpriteScale:1.0,
   footprint:{w:2.16,h:1.5},height:0.74,
   destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:105,material:'elevated medieval dungeon architecture',render:'blender-ortho-4',
   surface:{elevation:0.74,access:'steps',type:'elevated',frontSteps:true}
  },
  'arch-wood-stage':{
   label:'Kleine Holzbühne',kind:'platform',category:'architectural-floor',
   asset:artRoot+'furniture/arch-wood-stage',extension:'png',editorSpriteScale:1.0,
   footprint:{w:1.76,h:1.72},height:0.55,
   destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:95,material:'elevated medieval dungeon architecture',render:'blender-ortho-4',
   surface:{elevation:0.55,access:'steps',type:'elevated',frontSteps:true}
  },
  'arch-broken-stone-slab':{
   label:'Zerbrochene Bodenplatte',kind:'platform',category:'architectural-floor',
   asset:artRoot+'furniture/arch-broken-stone-slab',extension:'png',editorSpriteScale:1.0,
   footprint:{w:1.73,h:1.45},height:0.32,
   destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:140,material:'ramp medieval dungeon architecture',render:'blender-ortho-4',
   surface:{elevation:0.22,access:'ramp',type:'ramp',frontSteps:true}
  },
  'arch-collapsed-floor':{
   label:'Eingestürzter Zwischenboden',kind:'platform',category:'architectural-floor',
   asset:artRoot+'furniture/arch-collapsed-floor',extension:'png',editorSpriteScale:1.0,
   footprint:{w:1.75,h:1.55},height:-0.5,
   destroyable:true,vaultable:false,blocksMovement:false,blocksProjectiles:false,
   maxHP:100,material:'collapsed medieval dungeon architecture',render:'blender-ortho-4',
   surface:{elevation:0,access:'partial',type:'collapsed',frontSteps:true}
  }

 }
};
const preset={
 schema:'mind-dungeon-room/v1',id:'prison-cell-01',
 name:'Gefängniszelle · Musterraum',width:7,height:5,
 floorStyle:'dungeon-ashlar',wallStyle:'stone',
 tiles:[],walls:[],portals:[{side:'south',offset:3,width:1},{side:'east',offset:2,width:1}],furniture:[
  {id:'table-01',type:'prison-table',x:1.65,y:1.75,rot:0,destroyable:true,vaultable:false},
  {id:'chair-01',type:'prison-chair',x:4.25,y:2.65,rot:270,destroyable:true,vaultable:true}
 ],notes:'Offene isometrische Gefängniszelle: in dieser Vorlage nur Nord- und Westwände; weitere Außenwände werden lediglich visuell ausgeblendet. Rückseitig eine eiserne Zellentür. Keine Änderung am bestehenden Dungeon.'
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
