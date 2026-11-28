import {
 ACESFilmicToneMapping, AnimationMixer, BoxGeometry, Mesh, MeshStandardMaterial, DirectionalLight, Group, HemisphereLight,
 LoopOnce, OrthographicCamera, Scene, Vector3, WebGLRenderer
} from './vendor/guardian-three/three.js';
import {GLTFLoader} from './vendor/guardian-three/GLTFLoader.js';

import {createCanvasRenderer} from './guardian-canvas.js';

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
 if(armed)visible.add(armed==='hammer'?'hammer':'sword');
 if(clip.startsWith('eat')){
  if(progress>=.1&&progress<.86)visible.add('face');
  if(progress>=.24&&progress<.80)visible.add(progress<.53?'bread':'bite');
 }else if(clip.startsWith('drink')){
  if(progress>=.1&&progress<.93)visible.add('face');
  if(progress>=.24&&progress<.91)visible.add('cup');
 }else if(clip==='pickup'||clip==='pickup-crouched'){
  // The real Blender export contains this carried loot mesh.
  if(progress>=.46&&progress<.84)visible.add('ruby');
 }
 return visible;
}

export async function loadRig(url,clips={}){
 let renderer;
 try{
  renderer=new WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 }catch{
  renderer=createCanvasRenderer(renderSize);
 }
 try{
  renderer.setSize?.(renderSize,renderSize,false);
  renderer.setClearColor?.(0,0);
  renderer.toneMapping=ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.13;
  const response=await fetch(url);
  if(!response.ok)throw new Error('Der 3D-Wächter konnte nicht geladen werden.');
  const bytes=await response.arrayBuffer();
  const signature=new Uint8Array(bytes,0,2);
  const compressed=signature[0]===0x1f&&signature[1]===0x8b;
  let model=bytes;
  if(compressed){
   if(typeof DecompressionStream==='function'){
    model=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
   }else{
    const {gunzipSync}=await import('./vendor/guardian-three/fflate.js');
    model=gunzipSync(new Uint8Array(bytes)).buffer;
   }
  }
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

  let hammerRequest;
  function prepareHammer(){
   if(!hammerRequest)hammerRequest=new GLTFLoader().loadAsync(new URL('art/player-study/guardian-hammer.glb',import.meta.url).href).then(asset=>{
    const grip=gltf.scene.getObjectByName('HammerR'),source=asset.scene.getObjectByName('HammerR');
    if(!grip||!source)throw Error('Hammergriff fehlt');
    for(const mesh of [...source.children]){
     mesh.visible=false;mesh.userData.guardian_part='hammer';grip.add(mesh);attachments.push(mesh);
    }
    previousPose='';
   }).catch(error=>{hammerRequest=null;console.warn(error);});
   return hammerRequest;
  }
  const book=new Group(),pages=new MeshStandardMaterial({color:0xf1dfaa,roughness:.9}),
   leather=new MeshStandardMaterial({color:0x673b27,roughness:.77}),
   ink=new MeshStandardMaterial({color:0x68533b,roughness:1});
  for(const side of [-1,1]){
   const leaf=new Group();leaf.rotation.z=side*.15;book.add(leaf);
   for(const [w,h,d,y,material] of [[.17,.016,.25,0,leather],[.156,.023,.234,.018,pages]]){
    const sheet=new Mesh(new BoxGeometry(w,h,d),material);
    sheet.position.set(side*.08,y,0);leaf.add(sheet);
   }
   const lineGeometry=new BoxGeometry(.097,.002,.006);
   for(let i=0;i<5;i++){
    const line=new Mesh(lineGeometry,ink);line.position.set(side*.08,.031,i*.033-.068);leaf.add(line);
   }
  }
  book.rotation.x=.30;book.visible=false;pivot.add(book);
  const hands=[],handPoint=new Vector3(),otherHand=new Vector3();
  gltf.scene.traverse(node=>{if(node.isBone&&/^glove[lr]$/i.test(node.name.replace(/[._-]/g,'')))hands.push(node);});
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

 // Shape the exported weapon arcs around their recorded contact frame.
 // Each beat travels from the pelvis to the shoulder and finally the wrist.
 const joints=new Map(animatedNodes.map(node=>[node.name.replace(/[._-]/g,''),node]));
 const original=new Map();
 function saveJoint(node){
  let pose=original.get(node);
  if(!pose){pose={position:node.position.clone(),rotation:node.quaternion.clone(),dirty:false};original.set(node,pose);}
  if(!pose.dirty){pose.position.copy(node.position);pose.rotation.copy(node.quaternion);pose.dirty=true;}
 }
 function restoreJoints(){
  for(const [node,pose] of original)if(pose.dirty){
   node.position.copy(pose.position);node.quaternion.copy(pose.rotation);pose.dirty=false;
  }
 }
 function turn(name,x,y,z){
  const node=joints.get(name);if(!node)return;
  saveJoint(node);node.rotateX(x);node.rotateY(y);node.rotateZ(z);
 }
 function arch(time,start,peak,end){
  if(time<=start||time>=end)return 0;
  return time<peak?ease((time-start)/(peak-start)):1-ease((time-peak)/(end-peak));
 }
 function attackPose(clip,t,hammer){
  const heavy=clip==='heavy-sword'||clip==='heavy-hammer';
  if(!heavy&&!lightClip(clip))return;
  const hit=heavy?(hammer?7/21:.28):(clip==='up'?.43:.51);
  const side=clip==='up'?-1:1;
  const coil=arch(t,0,hit*.49,hit);
  const lift=arch(t,0,hit*.72,hit);
  const wrist=arch(t,hit*.12,hit*.82,hit);
  const follow=arch(t,hit,hit+(1-hit)*(hammer?.25:.14),1);
  const trail=arch(t,hit,hit+(1-hit)*(hammer?.38:.25),1);
  const recoil=arch(t,hit+(1-hit)*.42,hit+(1-hit)*.72,1);
  const twist=heavy?(hammer?.19:.32):(hammer?.48:.38);
  turn('Hips',-.08*coil+.09*follow,side*twist*(-coil+.64*follow),side*.06*(coil-follow));
  turn('Chest',(heavy?-.28:-.11)*lift+(heavy?.31:.10)*follow,side*twist*(-lift+.85*follow),side*(heavy?.09:.18)*(lift-follow));
  turn('Head',.12*lift-.16*follow,side*.12*(coil-follow),0);
  turn('ArmR',(heavy?-.38:-.13)*lift+.15*follow,side*.14*(lift-follow),side*(heavy?.10:.27)*(lift-trail));
  turn('ForearmR',-(hammer?.32:.20)*wrist+.12*trail,0,side*.11*(wrist-trail));
  turn('GloveR',(hammer?.25:.14)*wrist-(hammer?.29:.18)*trail+.08*recoil,side*.09*(trail-wrist),0);
  turn('ArmL',-.16*lift+.12*follow,-side*.13*coil,-.13*lift+.10*trail);
  turn('Mantle',-.14*lift+.25*trail-.08*recoil,side*.13*trail,0);
 }
 // Sample just the leg tracks from the gait. The combat clip continues
 // driving the weapon, hands and upper body even during a held charge.
 const legTracks=[];
 for(const track of gltf.animations[0].tracks){
  const dot=track.name.lastIndexOf('.'),node=joints.get(track.name.slice(0,dot).replace(/[._-]/g,''));
  const property=track.name.slice(dot+1);
  if(node&&/^(Thigh|Shin|Boot)[LR]$/.test(node.name.replace(/[._-]/g,''))&&
     (property==='position'||property==='quaternion')){
   legTracks.push({node,property,sampler:track.createInterpolant()});
  }
 }
 function movingLegs(gait,facing){
  const cycle=clips[gait.clip];if(!cycle)return;
  const gaitYaw=Math.atan2(Math.cos(gait.angle),Math.sin(gait.angle)/Math.sin(elevation));
  let delta=Math.atan2(Math.sin(gaitYaw-facing),Math.cos(gaitYaw-facing));
  const backwards=Math.abs(delta)>Math.PI*.55;
  if(backwards)delta-=Math.sign(delta)*Math.PI;
  const time=(cycle[0]+(backwards?1-gait.phase:gait.phase)*(cycle[1]-1))/frameRate;
  for(const {node,property,sampler} of legTracks){
   saveJoint(node);node[property].fromArray(sampler.evaluate(time));
  }
  const steer=Math.max(-.64,Math.min(.64,delta));
  turn('Hips',0,steer,0);turn('Chest',0,-steer,0);
 }
 let yaw=null,previousTime=null,previousPose='',previousClip=null,transition=null;
 let lastDrawTime=-Infinity,lastArmed=null;
  return {
   canvas,displaySize,ground,prepareHammer,
   get backend(){return renderer.isWebGLRenderer?'WebGL':'Canvas 2D';},
   render(clip,[start,count],progress,viewAngle,armed,time,gait=null){
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
    const pose=clip+'|'+progress+'|'+yaw+'|'+armed+'|'+(gait?gait.phase+'|'+gait.angle:'');
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
    restoreJoints();
    mixer.setTime((playingStart+clamp(progress)*(playingCount-1))/frameRate);
    attackPose(clip,clamp(progress),armed==='hammer');
    if(gait&&(lightClip(clip)||clip.startsWith('heavy-')||clip.startsWith('charge-')))movingLegs(gait,yaw);
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
    book.visible=clip==='knowledge'&&progress>.18;
    if(book.visible){
     if(hands.length===2){
      hands[0].getWorldPosition(handPoint);hands[1].getWorldPosition(otherHand);
      book.position.copy(pivot.worldToLocal(handPoint.lerp(otherHand,.5)));
      book.position.y+=.055;
     }else book.position.set(0,1.14,.31);
    }
    if(renderer.isWebGLRenderer && renderer.getContext().isContextLost()){
     renderer.dispose();
     renderer=createCanvasRenderer(renderSize);
    }
    renderer.render(scene,camera);
    context.clearRect(0,0,renderSize,renderSize);
    context.drawImage(renderer.domElement,0,0);
    return true;
   },
   dispose(){
    action.stop();
    mixer.uncacheRoot(gltf.scene);
    renderer.dispose?.();
    renderer.forceContextLoss?.();
   }
  };
 }catch(error){
  renderer.dispose?.();
  renderer.forceContextLoss?.();
  throw error;
 }
}

