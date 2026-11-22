// Shared lightweight creature-fur secondary motion for Blender GLB skins.
// Opaque solid strand geometry + per-vertex root/tip mask (TEXCOORD_0.x).
// Springs are stateful PER ACTOR; the shader/material/renderer is shared.
import {DoubleSide, Vector2} from 'three';

const FUR_PREFIX='Creature fur |';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const tau=Math.PI*2;

// Works with any creature using the grooming helper tools/creature_fur.py.
export function prepareCreatureFur(root){
 const materials=[],seen=new Set();
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(!material||!material.name.startsWith(FUR_PREFIX)||seen.has(material))continue;
   seen.add(material);
   material.transparent=false;
   material.opacity=1;
   material.alphaTest=0;
   material.depthWrite=true;
   material.side=DoubleSide;
   // The hair's UVs describe stiffness rather than a color/alpha texture.
   // Three needs USE_UV even when the groom is deliberately texture-free.
   material.defines={...material.defines,USE_UV:''};
   const uniforms={time:{value:0},force:{value:new Vector2(0,0)}};
   material.onBeforeCompile=shader=>{
    shader.uniforms.uCreatureFurTime=uniforms.time;
    shader.uniforms.uCreatureFurForce=uniforms.force;
    shader.vertexShader=
     'uniform float uCreatureFurTime;\nuniform vec2 uCreatureFurForce;\n'+
     shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace(
     '#include <begin_vertex>',
     '#include <begin_vertex>\n'+
     'float hairTip = clamp(uv.x, 0.0, 1.0);\n'+
     'float hairFlex = hairTip * hairTip;\n'+
     'vec2 hairNoise=vec2(\n'+
     ' sin(uCreatureFurTime*9.7+position.x*31.0+position.y*22.0),\n'+
     ' cos(uCreatureFurTime*7.1+position.y*39.0-position.z*18.0));\n'+
     'transformed.xy += hairFlex*(uCreatureFurForce*.026+hairNoise*.0042);\n'+
     'transformed.z += hairFlex*hairNoise.y*.0016;'
    );
   };
   material.customProgramCacheKey=()=> 'creature-fur-spring-v1';
   material.needsUpdate=true;
   materials.push(uniforms);
  }
 });
 return materials;
}

export function updateCreatureFur(materials,actor,selection,state){
 if(!materials.length)return;
 const phase=Number.isFinite(actor.phase)?actor.phase:0;
 let spring=state.furMotion;
 if(!spring){
  spring={phase,x:0,y:0,vx:0,vy:0};
  state.furMotion=spring;
 }
 const dt=clamp(phase-spring.phase,0,1/20);
 spring.phase=phase;
 const facing=Number.isFinite(actor.angle)?actor.angle:actor.facing??0;
 const motion=Number.isFinite(actor.ratMoveAngle)?actor.ratMoveAngle:
  Number.isFinite(actor.facing)?actor.facing:facing;
 const delta=Math.atan2(Math.sin(motion-facing),Math.cos(motion-facing));
 const active=actor.moving?1:0;
 // Hair bends opposite travel. Lateral momentum remains when the feet stop.
 const tx=-Math.sin(delta)*active;
 const ty=-Math.cos(delta)*active;
 const step=dt||0;
 for(const axis of ['x','y']){
  const velocityKey=axis==='x'?'vx':'vy';
  const target=axis==='x'?tx:ty;
  spring[velocityKey]+=(target-spring[axis])*45*step;
  spring[velocityKey]*=Math.exp(-11*step);
  spring[axis]=clamp(spring[axis]+spring[velocityKey]*step,-1.3,1.3);
 }
 // Gentle ambient breathing remains even when fully stationary.
 for(const item of materials){
  item.time.value=phase+tau*(Number.isFinite(actor.x)?actor.x*.0003:0);
  item.force.value.set(spring.x,spring.y);
 }
}
