// Regressions for the two real launch crashes from November 22, 2026.
// Run: node tools/check-alley-runtime.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('beta/index.html','utf8');
const rig=fs.readFileSync('beta/dungeon-enemy-rig.js','utf8');
const fog=fs.readFileSync('beta/ghost-fog-visual.js','utf8');
const manifest=JSON.parse(fs.readFileSync('beta/art/props/ghost-vessel-art.json','utf8'));

// Parse the method body without mocking the giant game or downloading GLBs.
// Its tests actually EXECUTE the same ghost rendering method in a tiny Phaser
// sprite-pool stand-in, rather than merely searching for the name.
function method(source,signature){
 const start=source.indexOf(signature);
 assert(start>=0,'Expected method missing: '+signature);
 const brace=source.indexOf('{',start);
 let depth=0;
 for(let i=brace;i<source.length;i++){
  if(source[i]==='{')depth++;
  else if(source[i]==='}'&&!--depth)return source.slice(start,i+1);
 }
 throw Error('Unclosed method: '+signature);
}
const sceneSource=html.slice(html.indexOf('class DungeonScene extends'),
 html.indexOf('  activateView(){',html.indexOf('class DungeonScene extends')));
const poolInit=sceneSource.indexOf('this.ghostFogSprites=[];');
const earlyAlley=sceneSource.indexOf('if(alley){');
assert(poolInit>=0&&earlyAlley>=0&&poolInit<earlyAlley,
 'Phaser effect pools must be initialized BEFORE the alley create() early return');
const renderMethod=method(html,'renderGhostVisuals(isometric=false){');
const stones=[];
const visual={frame:()=>true,cells:()=>[{x:18,y:23,depth:20,alpha:.5,size:45}],
 vesselRevision:0,modelRevision:0,modelFrames:[],modelIndex:()=>-1};
const iso={toView:(x,y,z)=>({x,y:y-z})};
const makeRenderer=new Function('ghostFog','soulVessels','combatClock','iso',
 'H','TILE','regionVisibleAt','return function '+renderMethod);
const render=makeRenderer(visual,stones,0,iso,50,48,()=>true);
const sprites=[];
function image(){
 const sprite={visible:true,
  setVisible(value){this.visible=value;return this;},
  setPosition(){return this;},setDepth(){return this;},
  setDisplaySize(){return this;},setAlpha(){return this;},
  setOrigin(){return this;},setTexture(key){this.texture={key};return this;}};
 sprites.push(sprite);return sprite;
}
const phaser={ghostFogSprites:[],ghostVesselSprites:[],vesselArtRevision:-1,
 add:{image},textures:{exists:()=>true,addCanvas:()=>({refresh(){}}),get:()=>({refresh(){}})}};
render.call(phaser,true); // No smoke yet: MUST NOT crash when walking.
assert.equal(sprites.length,0,'Empty dungeon should allocate no ghost sprites');
stones.push({x:42,y:64,z:7,alleyFloor:0});
render.call(phaser,true);
assert.equal(phaser.ghostFogSprites.length,1);
assert.equal(phaser.ghostVesselSprites.length,1);
stones.length=0;render.call(phaser,true);
assert(sprites.every(sprite=>sprite.visible===false),
 'Despawning vessels should hide previously allocated sprite pools');

// Execute the real enemy draw() using an existing neutral GLB snapshot, so
// the previously undefined "feet" depth error is exercised at runtime.
const drawMethod=method(rig,'function draw(enemy,type,selection,iso,deathAge=null){');
const enemy={x:105,y:150,alleyFloor:0,size:1,facing:0};
const states=new WeakMap();
states.set(enemy,{id:1,last:'sabre|idle|12|0|8',
 lastKey:'alley-live-enemy-sabre|idle|12|0|8',lastImage:{}});
const draw=new Function('stages','canvases','clamp','TAU','ELEVATION',
 'preview','targetFps','pixels','frames','return '+drawMethod)(
 new Map([['sabre',{settings:{clips:{idle:[0,25]},fps:24,displaySize:116},
 groundFraction:.71}]]),states,x=>Math.max(0,Math.min(1,x)),
 Math.PI*2,Math.atan(1/Math.sqrt(2)),false,60,128,new Map());
const item=draw(enemy,'sabre',{clip:'idle',t:0},
 {viewAngle:a=>a,toView:(x,y,z)=>({x,y:y-z})});
assert.equal(item.depth,150,'Enemy depth must resolve from its actual feet');

assert(fog.includes('createPot()')&&fog.includes('canvas.width=canvas.height=48'),
 'The retired giant jar must render as a compact spherical orb');
assert(!manifest.spriteReady||fs.existsSync('beta/art/props/ghost-vessel.png'),
 'Do not claim a Blender sprite is published before PNG exists');
assert(html.includes('refreshLayers(this.alleyLayers,player,save.opened.includes(0),'),
 'Isometric camera-layer culling must be integrated');
assert(rig.includes('stage.idleImage'),'Enemy spawn requires a cached Blender pose');
assert(rig.includes('cachedTextureKeys')&&rig.includes('live:false'),
 'Skeleton 3D frames must be shared immutable Phaser textures');
assert(rig.includes('const ghostProps=[]'),
 'Spherical ghost vessels must not pre-bake a giant pot into 24 GPU textures');
console.log('Phaser movement crash, Canvas enemy depth, ghost pool lifecycle and GPU culling: OK');
