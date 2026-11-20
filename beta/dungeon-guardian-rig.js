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

export async function loadRig(url){
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
 let yaw=null,previousTime=null,previousPose='',previousClip=null,transition=null;
  return {
   canvas,displaySize,ground,
   render(clip,[start,count],progress,viewAngle,armed,time){
    const angle=Math.atan2(Math.cos(viewAngle),Math.sin(viewAngle)/Math.sin(elevation));
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
    mixer.setTime((start+clamp(progress)*(count-1))/frameRate);
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
   }
  };
 }catch(error){
  renderer.dispose();
  renderer.forceContextLoss();
  throw error;
 }
}
