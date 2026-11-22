import {
 ACESFilmicToneMapping, AnimationMixer, DirectionalLight, Group, HemisphereLight,
 LoopOnce, OrthographicCamera, Scene, Vector3, WebGLRenderer
} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const renderSize=176;
const displaySize=110;
const field=3.23;
const elevation=Math.atan(1/Math.sqrt(2));
const frameRate=24;
const clamp=value=>Math.max(0,Math.min(1,value));

function light(scene,color,intensity,x,y,z){
 const lamp=new DirectionalLight(color,intensity);
 lamp.position.set(x,y,z);
 scene.add(lamp);
}

function visibleParts(clip,progress,armed){
 const visible=new Set();
 if(armed)visible.add('sword');
 if(clip.startsWith('eat')){
  if(progress>=.1&&progress<.86)visible.add('face');
  if(progress>=.24&&progress<.80)visible.add(progress<.53?'bread':'bite');
 }else if(clip.startsWith('drink')){
  if(progress>=.1&&progress<.93)visible.add('face');
  if(progress>=.24&&progress<.91)visible.add('cup');
 }
 return visible;
}

export async function loadRig(url,clips={}){
 const renderer=new WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 try{
  renderer.setSize(renderSize,renderSize,false);
  renderer.setClearColor(0,0);
  renderer.toneMapping=ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.13;
  const response=await fetch(url);
  if(!response.ok)throw new Error('Der 3D-Wächter konnte nicht geladen werden.');
  const bytes=await response.arrayBuffer();
  const signature=new Uint8Array(bytes,0,2);
  const compressed=signature[0]===0x1f&&signature[1]===0x8b;
  const model=compressed?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes;
  const gltf=await new GLTFLoader().parseAsync(model,'');
  if(gltf.animations.length!==1)throw new Error('Die Animationsspur des Wächters fehlt.');
  const ladderUp=clips['climb-up'],ladderDown=clips['climb-down'];
  // Keep compatibility with the old GLB until the Blender-derived asset
  // is deployed. Never add procedural rotation on top of a baked ladder pose.
  const bakedLadder=Boolean(ladderUp&&ladderDown&&
   gltf.animations[0].duration >=
   (ladderDown[0]+ladderDown[1]-1)/frameRate-.06);

  const scene=new Scene();
  const pivot=new Group();
  scene.add(pivot);
  pivot.add(gltf.scene);
  scene.add(new HemisphereLight(0xd0dcff,0x93737a,1.45));
  light(scene,0xffdfb7,3.4,-3,5,4);
  light(scene,0xb8ccff,1.9,3,4,-4);
  const camera=new OrthographicCamera(-field/2,field/2,field/2,-field/2,.1,30);
  camera.position.set(0,1.01+6*Math.sin(elevation),6*Math.cos(elevation));
  camera.lookAt(0,1.01,0);
  camera.updateMatrixWorld();
  const ground=displaySize*(.5-new Vector3().project(camera).y/2);
  const attachments=[];
  pivot.traverse(node=>{if(node.userData.guardian_part)attachments.push(node);});

  const mixer=new AnimationMixer(gltf.scene);
  const action=mixer.clipAction(gltf.animations[0]);
  action.setLoop(LoopOnce,1);
  action.clampWhenFinished=true;
  action.play();
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=renderSize;
  const context=canvas.getContext('2d');
  const animatedNodes=[...new Set(gltf.animations[0].tracks.map(track=>
  gltf.scene.getObjectByName(track.name.slice(0,track.name.lastIndexOf('.')))
 ).filter(Boolean))];
 const lightClip=clip=>clip==='down'||clip==='up';
 // Two independent 3D climb actions on the actual Blender armature.
 const climbBones=Object.fromEntries(['Hips','Chest','Head','Arm.L','Arm.R',
  'Forearm.L','Forearm.R','Glove.L','Glove.R','Thigh.L','Thigh.R',
  'Shin.L','Shin.R','Boot.L','Boot.R','Mantle']
  .map(name=>[name,gltf.scene.getObjectByName(name)]));
 const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
 const climbingPose=(clip,t)=>{
  const up=clip==='climb-up',phase=6*Math.PI*t+(up?0:Math.PI);
  const stride=ease(t/.16)*(1-ease((t-.85)/.15));
  const grip=ease(t/.095)*(1-ease((t-.91)/.09));
  const left=Math.sin(phase),right=-left;
  const rotate=(name,x=0,y=0,z=0)=>{
   const bone=climbBones[name];if(!bone)return;
   bone.rotation.x+=x;bone.rotation.y+=y;bone.rotation.z+=z;
  };
  rotate('Hips',-.07*grip,0,.035*left*stride);
  rotate('Chest',-.20*grip,.03*left*stride,.05*left*stride);
  rotate('Head',.10*grip);
  rotate('Arm.L',-1.3*grip-.33*left*stride,0,-.14*grip);
  rotate('Arm.R',-1.3*grip-.33*right*stride,0,.14*grip);
  rotate('Forearm.L',-.46*grip+.28*left*stride);
  rotate('Forearm.R',-.46*grip+.28*right*stride);
  rotate('Glove.L',-.12*grip);rotate('Glove.R',-.12*grip);
  rotate('Thigh.L',.23*grip-.47*left*stride);
  rotate('Thigh.R',.23*grip-.47*right*stride);
  rotate('Shin.L',-.32*grip-.26*right*stride);
  rotate('Shin.R',-.32*grip-.26*left*stride);
  rotate('Boot.L',.19*grip);rotate('Boot.R',.19*grip);
  rotate('Mantle',.1*Math.sin(phase+Math.PI/2)*stride);
  const lip=ease((t-.83)/.15);
  if(up){rotate('Arm.L',.56*lip);rotate('Arm.R',.56*lip);rotate('Chest',-.18*lip);}
  else{rotate('Hips',.12*lip);rotate('Thigh.L',-.1*lip);rotate('Thigh.R',-.1*lip);}
 };

 let yaw=null,previousTime=null,previousPose='',previousClip=null,transition=null;
 let lastDrawTime=-Infinity,lastArmed=null;
  return {
   canvas,displaySize,ground,
   render(clip,[start,count],progress,viewAngle,armed,time){
    const angle=Math.atan2(Math.cos(viewAngle),Math.sin(viewAngle)/Math.sin(elevation));
    // The previous guardian renderer did GPU skinned animation + synchronized
    // GPU->CPU framebuffer readback + a Phaser texture upload on EVERY tick.
    // Animate at up to 40 FPS while the PLAYER POSITION keeps moving at 60.
    // When hardware is under load, lower only the expensive pose sampling.
    // Never delay a new attack clip, gear state or significant turn.
    const measured=window.__mindDiagnostics?.fps||60;
    const interval=1/(measured<22?12:measured<32?18:measured<45?25:36);
    const urgent=clip!==previousClip||armed!==lastArmed||
     yaw===null||Math.abs(Math.atan2(Math.sin(angle-yaw),Math.cos(angle-yaw)))>
      (measured<32?.21:.12);
    if(!urgent&&time-lastDrawTime<interval)return false;
    lastDrawTime=time;lastArmed=armed;
    const dt=previousTime===null?0:Math.min(.1,Math.max(0,time-previousTime));
    previousTime=time;
    const difference=yaw===null?0:Math.atan2(Math.sin(angle-yaw),Math.cos(angle-yaw));
    yaw=yaw===null?angle:yaw+difference*(1-Math.exp(-dt*(lightClip(clip)?64:24)));
    if(previousClip!==null&&clip!==previousClip){
     transition={duration:lightClip(clip)?.045:.065,elapsed:0,from:animatedNodes.map(node=>({
      node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()
     }))};
    }
    previousClip=clip;
    const pose=clip+'|'+progress+'|'+yaw+'|'+armed;
    if(pose===previousPose&&!transition)return false;
    previousPose=pose;
    pivot.rotation.y=yaw;
    const visible=visibleParts(clip,progress,armed);
    for(const node of attachments)node.visible=visible.has(node.userData.guardian_part);
    action.paused=false;
    action.enabled=true;
    const fallbackLadder=!bakedLadder&&(clip==='climb-up'||clip==='climb-down');
    const [playingStart,playingCount]=fallbackLadder?
     (clips.idle??[0,4]):[start,count];
    mixer.setTime((playingStart+clamp(progress)*(playingCount-1))/frameRate);
    if(fallbackLadder)climbingPose(clip,clamp(progress));
    if(transition){
     transition.elapsed+=dt;
     const t=clamp(transition.elapsed/transition.duration),weight=t*t*(3-2*t);
     for(const {node,position,quaternion,scale} of transition.from){
      node.position.lerp(position,1-weight);
      node.quaternion.slerp(quaternion,1-weight);
      node.scale.lerp(scale,1-weight);
     }
     if(t===1)transition=null;
    }
    renderer.render(scene,camera);
    context.clearRect(0,0,renderSize,renderSize);
    context.drawImage(renderer.domElement,0,0);
    return true;
   },
   dispose(){
    action.stop();
    mixer.uncacheRoot(gltf.scene);
    renderer.dispose();
    renderer.forceContextLoss();
   }
  };
 }catch(error){
  renderer.dispose();
  renderer.forceContextLoss();
  throw error;
 }
}
