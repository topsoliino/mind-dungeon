// Real-time Blender enemy rigs rendered with the exact Guardian Three.js look.
// One shared WebGL context and one reusable, fully skinned 3D scene per kit:
// NEVER allocate a WebGL renderer for each enemy. Sprite atlases remain
// available only if WebGL or a particular rig export cannot be loaded.
import {
 ACESFilmicToneMapping, AnimationMixer, DirectionalLight, Group, HemisphereLight,
 LoopOnce, OrthographicCamera, Scene, Vector3, WebGLRenderer
} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

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
function hasLegacyPalette(root,settings){
 // A render workflow may publish the manifest before freshly rebuilt .blend
 // sources finish. Detect the actual GLB material values, not only metadata.
 // The two stable palette probes differ by >2x in linear RGB.
 const isRat=settings.field<3;
 const name=isRat?'Warm dark umber fur':'Weathered ivory';
 let red=null;
 root.traverse(node=>{
  if(!node.isMesh)return;
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   if(red===null&&material?.name?.startsWith(name)&&material.color){
    red=material.color.r;
   }
  }
 });
 return red===null?settings.materialColorSpace!=='srgb-to-linear':
  red>(isRat?.14:.43);
}
function prepareMaterials(root,settings){
 const legacyPalette=hasLegacyPalette(root,settings);
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

export async function loadEnemyRigs(){
 const renderer=new WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(RENDER_SIZE,RENDER_SIZE,false);
 renderer.setPixelRatio(1);
 renderer.setClearColor(0,0);
 renderer.toneMapping=ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.13;
 const versions={sabre:4,bow:4,rat:4};
 const files=[
  ['sabre','beta/art/skeleton/skeleton-sabre-rig.glb.gz',
   'beta/art/skeleton/skeleton-live.json','sabre'],
  ['bow','beta/art/skeleton/skeleton-bow-rig.glb.gz',
   'beta/art/skeleton/skeleton-live.json','bow'],
  ['rat','beta/art/rat/rat-live-rig.glb.gz',
   'beta/art/rat/rat-live.json',null],
 ];
 const stages=new Map();
 await Promise.all(files.map(async ([id,url,manifest,variant])=>{
  try{
   const [model,response]=await Promise.all([
    glb(url+'?v='+versions[id]),fetch(manifest+'?v='+versions[id],{cache:'no-cache'})
   ]);
   if(!response.ok)throw Error('Enemy animation manifest unavailable');
   const json=await response.json(),settings=variant?json[variant]:json;
   if(!settings?.clips||!settings.fps||
      !Object.keys(settings.clips).includes('idle'))
    throw Error('Invalid enemy rig manifest: '+id);
   const stage=makeStage(settings.field,settings.targetHeight);
   prepareMaterials(model.scene,settings);
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
 const canvases=new WeakMap();
 let nextId=0;
 function draw(enemy,type,selection,iso,deathAge=null){
  const stage=stages.get(type);
  if(!stage||!selection)return null;
  let state=canvases.get(enemy);
  if(!state){
   const canvas=document.createElement('canvas');
   canvas.width=canvas.height=RENDER_SIZE;
   state={id:++nextId,canvas,context:canvas.getContext('2d'),
    last:null,lastYaw:null};
   canvases.set(enemy,state);
  }
  const {clips,fps,displaySize}=stage.settings;
  const spec=clips[selection.clip]||clips.idle;
  if(!spec)return null;
  const [start,count]=spec;
  const t=clamp(selection.t);
  const heading=Number.isFinite(enemy.facing)?enemy.facing:
   Number.isFinite(enemy.angle)?enemy.angle:0;
  const view=iso.viewAngle(heading);
  // Exactly the Guardian's world-to-model yaw correction.
  const yaw=Math.atan2(Math.cos(view),Math.sin(view)/Math.sin(ELEVATION));
  const sample=(start+t*(count-1))/fps;
  const signature=type+'|'+selection.clip+'|'+Math.round(sample*120)+
   '|'+Math.round(yaw*300);
  const changed=state.last!==signature;
  if(changed){
   state.last=signature;
   // Reuse a single GLB model per weapon/species, but sample its continuous
   // rig animation independently into every enemy's own persistent canvas.
   stage.pivot.rotation.y=yaw;
   stage.action.paused=false;stage.action.enabled=true;
   stage.mixer.setTime(sample);
   renderer.render(stage.scene,stage.camera);
   state.context.clearRect(0,0,RENDER_SIZE,RENDER_SIZE);
   state.context.drawImage(renderer.domElement,0,0);
  }
  const p=iso.toView(enemy.x,enemy.y,enemy.alleyZ||0);
  const size=displaySize*(enemy.size||1);
  const alpha=deathAge===null?1:clamp((2.6-deathAge)/.55);
  return {image:state.canvas,key:'alley-live-enemy-'+state.id,
   x:p.x-size/2,y:p.y-size*stage.groundFraction,
   width:size,height:size,originX:0,originY:0,
   depth:(enemy.alleyFloor===1||enemy.alleyClimb?7000:0)+p.y,
   alpha,live:changed};
 }
 return {draw,has:kind=>stages.has(kind),active:[...stages.keys()],
  dispose(){for(const stage of stages.values())stage.mixer.stopAllAction();
   renderer.dispose();renderer.forceContextLoss();}};
}
