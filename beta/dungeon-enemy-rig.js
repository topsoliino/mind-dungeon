// Real-time Blender enemy rigs rendered with the exact Guardian Three.js look.
// One shared WebGL context and one reusable, fully skinned 3D scene per kit:
// NEVER allocate a WebGL renderer for each enemy. Sprite atlases remain
// available only if WebGL or a particular rig export cannot be loaded.
import {
 ACESFilmicToneMapping, AnimationMixer, DirectionalLight, Group, HemisphereLight,
 LoopOnce, OrthographicCamera, Scene, Vector3, WebGLRenderer
} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareCreatureFur,updateCreatureFur} from './creature-fur.js';

// Maintain at least the Guardian's pixel density at the skeleton's larger
// on-screen size (208/132 ~= 176/110). No per-enemy WebGL contexts.
const RENDER_SIZE=208;
const ELEVATION=Math.atan(1/Math.sqrt(2));
const clamp=value=>Math.max(0,Math.min(1,value));
const TAU=Math.PI*2;
function light(scene,color,intensity,x,y,z){
 const lamp=new DirectionalLight(color,intensity);
 lamp.position.set(x,y,z);
 scene.add(lamp);
}
function makeStage(field,targetHeight){
 const scene=new Scene(),pivot=new Group();
 scene.add(pivot);
 // Deliberately IDENTICAL to beta/dungeon-guardian-rig.js:
 scene.add(new HemisphereLight(0xd0dcff,0x93737a,1.45));
 light(scene,0xffdfb7,3.4,-3,5,4);
 light(scene,0xb8ccff,1.9,3,4,-4);
 const camera=new OrthographicCamera(-field/2,field/2,field/2,-field/2,.1,30);
 camera.position.set(0,targetHeight+6*Math.sin(ELEVATION),6*Math.cos(ELEVATION));
 camera.lookAt(0,targetHeight,0);
 camera.updateMatrixWorld();
 const groundFraction=.5-new Vector3().project(camera).y/2;
 return {scene,pivot,camera,groundFraction};
}
async function glb(url){
 // Revalidate while Blender CI republishes the same GLB URLs.
 const response=await fetch(url,{cache:'no-cache'});
 if(!response.ok)throw Error('Enemy 3D GLB unavailable: '+url);
 const bytes=await response.arrayBuffer(),signature=new Uint8Array(bytes,0,2);
 const compressed=signature[0]===0x1f&&signature[1]===0x8b;
 const data=compressed?await new Response(
  new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
 ).arrayBuffer():bytes;
 const parsed=await new GLTFLoader().parseAsync(data,'');
 if(parsed.animations.length!==1)throw Error('Packed enemy animation missing: '+url);
 let skinned=0;
 parsed.scene.traverse(node=>{if(node.isSkinnedMesh)skinned++;});
 if(skinned<1)throw Error('Enemy export contains no live skinned meshes: '+url);
 return parsed;
}

// Older GLBs encoded sRGB artist-palette numbers as *linear* shader values,
// unlike the Guardian builder. Under identical lights this lifts the midtones,
// washing out the bone/fur-to-crease contrast. Once the Blender rebuild lands,
// the manifest flags properly decoded materials and this shim turns itself off.
function srgbToLinear(value){
 return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);
}
function prepareMaterials(root,settings){
 // Authoritative Blender-export contract; do NOT infer the color space from
 // how bright a particular bone/fur swatch is. Bright sRGB-encoded ivory was
 // falsely classified as a legacy GLB and darkened TWICE on every frame.
 const legacyPalette=settings.materialColorSpace!=='srgb-to-linear';
 const prepared=new Set();
 root.traverse(node=>{
  if(!node.isMesh)return;
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   if(!material||prepared.has(material))continue;
   prepared.add(material);
   if(legacyPalette&&material.color){
    const c=material.color;
    c.setRGB(srgbToLinear(c.r),srgbToLinear(c.g),srgbToLinear(c.b));
   }
   // The source meshes now have Guardian-like planar silhouettes and
   // baked weighted normals. Preserve authored facets and material values,
   // rather than applying an artificial global sharpening/contrast filter.
   // Enemy anatomy, cloth and weapons are solid, just like the Guardian.
   // Avoid accidental blend/depth sorting that makes them look translucent.
   material.opacity=1;
   material.transparent=false;
   material.alphaTest=0;
   material.depthWrite=true;
   if(material.metalness>=.25){
    material.roughness=Math.min(material.roughness,.57);
   }
   material.needsUpdate=true;
  }
 });
}

// One shared GPU context for all skeletal enemies and the carved 3D pot.
// The 24 angle/tumble views are generated once at startup, not during combat.
async function bakeGhostVessel(renderer,pixels){
 try{
  const result=await fetch('beta/art/props/ghost-vessel.glb?v=1');
  if(!result.ok)throw Error('3D ghost vessel HTTP '+result.status);
  const model=await new GLTFLoader().parseAsync(await result.arrayBuffer(),'');
  const stage=makeStage(1.82,.56);
  model.scene.rotation.x=-Math.PI/2; // authored in Z-up coordinates
  model.scene.position.y=-.54;stage.pivot.position.y=.54;
  stage.pivot.add(model.scene);
  const frames=[];
  for(let i=0;i<24;i++){
   const airborne=i>=16;
   stage.pivot.rotation.set(airborne?(i-16)*Math.PI/4:0,
    airborne?(i-16)*Math.PI/4:i*Math.PI/8,
    airborne?.19*Math.sin(i*1.6):0);
   renderer.render(stage.scene,stage.camera);
   const canvas=document.createElement('canvas');
   canvas.width=canvas.height=pixels;
   canvas.getContext('2d',{alpha:true}).drawImage(renderer.domElement,0,0);
   frames.push(canvas);
  }
  return frames;
 }catch(error){console.warn('Ghost vessel GLB fallback:',error);return [];}
}

export async function loadEnemyRigs({only=null}={}){
 // Only cinematic art inspection uses full 208px live rendering for rats.
 // Gameplay uses the Blender-baked dense-fur rat atlases and reserves live
 // skinned 3D work for the specialized skeleton attack telegraphs.
 const preview=new URLSearchParams(location.search).get('debug-art')==='1'||
  new URLSearchParams(location.search).get('enemy3d')==='1';
 const pixels=preview?RENDER_SIZE:128;
 const renderer=new WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});
 renderer.setSize(pixels,pixels,false);
 renderer.setPixelRatio(1);
 renderer.setClearColor(0,0);
 renderer.toneMapping=ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.13;
 const versions={sabre:11,bow:11,rat:9};
 const files=[
  ['sabre','beta/art/skeleton/skeleton-sabre-rig.glb.gz',
   'beta/art/skeleton/skeleton-live.json','sabre'],
  ['bow','beta/art/skeleton/skeleton-bow-rig.glb.gz',
   'beta/art/skeleton/skeleton-live.json','bow'],
  ['rat','beta/art/rat/rat-live-rig.glb.gz',
   'beta/art/rat/rat-live.json',null],
 ];
 const stages=new Map();
 await Promise.all(files.filter(([id])=>!only||only.includes(id))
  .map(async ([id,url,manifest,variant])=>{
  try{
   const response=await fetch(manifest+'?v='+versions[id],{cache:'no-cache'});
   if(!response.ok)throw Error('Enemy animation manifest unavailable');
   const json=await response.json(),settings=variant?json[variant]:json;
   if(!settings?.clips||!settings.fps||
      !Object.keys(settings.clips).includes('idle'))
    throw Error('Invalid enemy rig manifest: '+id);
   // The manifest carries a SHA-256 of the exact authored Blender source.
   // Using it in the GLB URL prevents stale CDN and Safari caches from
   // mixing the old low-contrast mesh with the newly graded materials.
   const revision=settings.sourceBlendSha256?.slice(0,16)||versions[id];
   const model=await glb(url+'?v='+revision);
   const stage=makeStage(settings.field,settings.targetHeight);
   prepareMaterials(model.scene,settings);
   stage.fur=prepareCreatureFur(model.scene);
   stage.pivot.add(model.scene);
   stage.mixer=new AnimationMixer(model.scene);
   stage.action=stage.mixer.clipAction(model.animations[0]);
   stage.action.setLoop(LoopOnce,1);
   stage.action.clampWhenFinished=true;
   stage.action.play();
   stage.settings=settings;
   stage.model=model.scene;
   stage.pivot.visible=true;
   stages.set(id,stage);
  }catch(error){
   // A single bad export must not disable the dungeon or the other models.
   console.warn('Mind Dungeon: live enemy rig failed, using sprite fallback:',id,error);
  }
 }));
 if(!stages.size){
  renderer.dispose();renderer.forceContextLoss();
  throw Error('No live enemy rig could be loaded.');
 }
 // A single renderer.render() -> readback -> canvas upload can cost many ms.
 // The previous implementation repeated it PER RAT/SKELETON PER FRAME,
 // tanking FPS even when most enemies shared the same locomotion cycle.
 // Cache quantized *actual 3D Blender poses* across every instance.
 const frames=new Map(),MAX_FRAMES=176;
 // Pre-bake one real GLB reference pose per kit at loading time.
 for(const stage of stages.values()){
  const [start]=stage.settings.clips.idle;
  stage.pivot.rotation.y=0;
  stage.mixer.setTime(start/stage.settings.fps);
  renderer.render(stage.scene,stage.camera);
  const snapshot=document.createElement('canvas');
  snapshot.width=snapshot.height=pixels;
  snapshot.getContext('2d').drawImage(renderer.domElement,0,0);
  stage.idleImage=snapshot;
 }
 const ghostProps=await bakeGhostVessel(renderer,pixels);
 const canvases=new WeakMap();
 const stats={gpuRenders:0,cacheHits:0,budgetSkips:0,frames:0,gpuCostMs:0};
 let renderedThisFrame=0,lastGpuTime=-1e6,targetFps=60,gpuCostMs=6;
 const poseKey=signature=>'alley-live-enemy-'+signature;
 const neutralKey=kind=>'alley-live-enemy-'+kind+'-neutral';
 function beginFrame(fps=60){
  renderedThisFrame=0;
  stats.frames++;
  if(Number.isFinite(fps)&&fps>0)targetFps=fps;
 }
 function remember(signature,canvas){
  frames.delete(signature);
  frames.set(signature,canvas);
  if(frames.size>MAX_FRAMES)frames.delete(frames.keys().next().value);
 }
 function cachedTextureKeys(){
  return [...frames.keys()].map(poseKey)
   .concat([...stages.keys()].map(neutralKey));
 }
 function draw(enemy,type,selection,iso,deathAge=null){
  const stage=stages.get(type);
  if(!stage||!selection)return null;
  let state=canvases.get(enemy);
  if(!state){
   state={last:null,lastKey:neutralKey(type),lastImage:stage.idleImage};
   canvases.set(enemy,state);
  }
  const {clips,fps,displaySize}=stage.settings;
  const spec=clips[selection.clip]||
   (type==='rat'?clips.run:type==='bow'?clips.shoot:clips.strike)||clips.idle;
  if(!spec)return null;
  const [start,count]=spec,t=clamp(selection.t);
  const heading=Number.isFinite(enemy.facing)?enemy.facing:
   Number.isFinite(enemy.angle)?enemy.angle:0;
  const view=iso.viewAngle(heading);
  const yaw=Math.atan2(Math.cos(view),Math.sin(view)/Math.sin(ELEVATION));
  // Both attack telegraphs and 32 independent world-facing directions
  // retain their full Blender samples. Reduce only idle/run under GPU load.
  const gait=selection.clip==='run'||selection.clip==='idle';
  const steps=!preview&&gait&&targetFps<45?7:12;
  const poseStep=preview?Math.round(t*120):Math.round(t*steps);
  const viewStep=preview?Math.round(yaw*300):Math.round(yaw/TAU*32);
  const sample=(start+(preview?t:poseStep/steps)*(count-1))/fps;
  const facing=preview?yaw:viewStep*TAU/32;
  const signature=type+'|'+selection.clip+'|'+steps+'|'+poseStep+'|'+viewStep;
  if(state.last!==signature){
   const cached=frames.get(signature);
   if(cached){
    stats.cacheHits++;
    frames.delete(signature);frames.set(signature,cached);
    state.last=signature;state.lastKey=poseKey(signature);
    state.lastImage=cached;
   }else{
    const now=performance.now();
    // Budget by ACTUAL cost of GPU->CPU readback, not a fixed extremely
    // slow 100-410ms timer that froze skeleton attack animations.
    const safeBudget=targetFps<23?3.5:targetFps<35?5:targetFps<47?6.5:9;
    const delay=Math.min(260,Math.max(26,gpuCostMs*1000/safeBudget));
    if(!preview&&(renderedThisFrame>=1||now-lastGpuTime<delay)){
     stats.budgetSkips++;
    }else{
     renderedThisFrame++;
     const started=performance.now();
     if(stage.fur.length)updateCreatureFur(stage.fur,enemy,selection,state);
     stage.pivot.rotation.y=facing;
     stage.action.paused=false;stage.action.enabled=true;
     stage.mixer.setTime(sample);
     renderer.render(stage.scene,stage.camera);
     const image=document.createElement('canvas');
     image.width=image.height=pixels;
     image.getContext('2d').drawImage(renderer.domElement,0,0);
     const cost=performance.now()-started;
     gpuCostMs=gpuCostMs*.84+Math.min(70,cost)*.16;
     stats.gpuCostMs=Math.round(gpuCostMs*10)/10;
     lastGpuTime=performance.now();
     stats.gpuRenders++;
     remember(signature,image);
     state.last=signature;state.lastKey=poseKey(signature);
     state.lastImage=image;
    }
   }
  }
  const p=iso.toView(enemy.x,enemy.y,enemy.alleyZ||0);
  const feet=iso.toView(enemy.x,enemy.y,0).y;
  const size=displaySize*(enemy.size||1);
  const alpha=deathAge===null?1:clamp((2.6-deathAge)/.55);
  // Immutable, shared 3D snapshot: Phaser uploads a given Blender pose ONCE
  // for all skeletons, instead of re-uploading per-enemy canvases in combat.
  return {image:state.lastImage,key:state.lastKey,
   x:p.x-size/2,y:p.y-size*stage.groundFraction,
   width:size,height:size,originX:0,originY:0,
   depth:(enemy.alleyFloor===1||enemy.alleyClimb?7000:0)+feet,
   alpha,live:false};
 }
 return {draw,beginFrame,stats,ghostProps,cachedTextureKeys,has:kind=>stages.has(kind),
  active:[...stages.keys()],
  dispose(){for(const stage of stages.values())stage.mixer.stopAllAction();
   frames.clear();renderer.dispose();renderer.forceContextLoss();}};
}
