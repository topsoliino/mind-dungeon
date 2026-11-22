// One shared GPU fog shader for every ghost vessel; physical density comes
// from SoulVessels diffusion, not the fragment shader. WebGL optional.
(function(root){
'use strict';
const SIZE=15,CELL=18;
// The runtime sprite is rendered from the actual Blender prop when its asset
// has been published. The procedural preview is deliberately kept visible
// on slow networks and when the art CDN is unavailable.
function createPot(){
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=96;
 const c=canvas.getContext('2d');
 c.shadowColor='#111521';c.shadowBlur=8;c.shadowOffsetY=5;
 c.fillStyle='#292f3b';c.beginPath();c.ellipse(32,83,15,5,0,0,Math.PI*2);c.fill();
 c.shadowBlur=0;c.shadowOffsetY=0;
 const body=c.createLinearGradient(15,0,50,0);
 body.addColorStop(0,'#20252d');body.addColorStop(.19,'#697582');body.addColorStop(.5,'#a4afb7');
 body.addColorStop(.73,'#5f6a77');body.addColorStop(1,'#252b36');
 c.fillStyle=body;c.strokeStyle='#171e29';c.lineWidth=2;
 c.beginPath();c.moveTo(24,20);c.bezierCurveTo(22,31,15,37,17,57);
 c.bezierCurveTo(17,79,25,82,32,83);c.bezierCurveTo(45,82,49,73,47,55);
 c.bezierCurveTo(49,37,42,29,40,20);c.closePath();c.fill();c.stroke();
 c.fillStyle='#343b49';c.fillRect(23,14,18,8);
 c.strokeStyle='#b9c5ce';c.lineWidth=2;c.beginPath();c.ellipse(32,16,11,4,0,0,Math.PI*2);c.stroke();
 c.strokeStyle='#3c4858';c.lineWidth=3;c.beginPath();c.ellipse(32,52,15,10,0,0,Math.PI*2);c.stroke();
 c.strokeStyle='#a6bdc0';c.lineWidth=1.4;c.beginPath();c.moveTo(29,47);c.lineTo(33,56);c.lineTo(38,46);c.stroke();
 c.fillStyle='#b6d2c8';c.beginPath();c.ellipse(32,15,7,2,0,0,Math.PI*2);c.fill();
 return canvas;
}
function create(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
 const result=document.createElement('canvas');result.width=result.height=96;
 const ctx=result.getContext('2d');
 const vessel=createPot();let vesselRevision=0,modelRevision=0;
 let modelFrames=[];
 function set3DFrames(frames){
  if(!Array.isArray(frames)||frames.length!==24)return false;
  modelFrames=frames;modelRevision++;
  const context=vessel.getContext('2d');
  context.clearRect(0,0,vessel.width,vessel.height);
  context.drawImage(frames[0],0,0,vessel.width,vessel.height);
  vesselRevision++;
  return true;
 }
 function modelIndex(v){
  if(!modelFrames.length)return -1;
  if(!v.landed)return 16+((Math.floor(v.age*12+(v.seed||0))%8+8)%8);
  return ((Math.floor(v.seed||0)%16+16)%16);
 }
 function vesselImage(v){const index=modelIndex(v);return index<0?vessel:modelFrames[index];}
 function drawVessel(ctx,v,view){
  const p=view(v.x,v.y,v.z),image=vesselImage(v);
  if(modelFrames.length)ctx.drawImage(image,p.x-45,p.y-73,90,90);
  else ctx.drawImage(image,p.x-26,p.y-67,52,78);
 }
 const asset=new Image();
 asset.onload=()=>{
  const c=vessel.getContext('2d');c.clearRect(0,0,64,96);
  c.drawImage(asset,0,0,64,96);vesselRevision++;
 };
 // A missing in-progress Blender render must NOT trigger a 404 on every
 // startup. Load it only after the build pipeline publishes its manifest.
 fetch('beta/art/props/ghost-vessel-art.json?v=1',{cache:'no-store'})
  .then(response=>response.ok?response.json():null)
  .then(config=>{
   if(config?.spriteReady)asset.src='beta/art/props/ghost-vessel.png?v='+(config.version||1);
  }).catch(()=>{});
 let gl=null,program=null,uniformT=null,position=null,lastFrame=-1;
 try{
  gl=canvas.getContext('webgl',{alpha:true,preserveDrawingBuffer:true,
   premultipliedAlpha:false,antialias:false,depth:false});
  if(gl){
   const make=(type,source)=>{
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
    return s;
   };
   program=gl.createProgram();
   gl.attachShader(program,make(gl.VERTEX_SHADER,
    'attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=(aPosition+1.0)*.5;gl_Position=vec4(aPosition,0.,1.);}'));
   gl.attachShader(program,make(gl.FRAGMENT_SHADER,
    'precision mediump float;varying vec2 vUv;uniform float uTime;'+
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'+
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);'+
    'return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),'+
    'mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}'+
    'float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.11)*.17;}'+
    'void main(){vec2 p=vUv*2.-1.;float r=length(p);'+
    'float swirl=fbm(p*3.7+vec2(uTime*.21,-uTime*.14));'+
    'vec2 flow=vec2(fbm(p*2.6+uTime*.17),fbm(p*2.6-uTime*.13));'+
    'float turbulence=fbm(p*5.2+flow*.9+vec2(uTime*.34,-uTime*.26));'+
    'float edge=1.-smoothstep(.35,.97,r+(.5-swirl)*.40);'+
    'float a=clamp(edge*(.28+turbulence*.42),0.,.76);'+
    'vec3 color=mix(vec3(.32,.35,.42),vec3(.69,.70,.77),swirl*.8);'+
    'gl_FragColor=vec4(color*a,a);}'));
   gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
   gl.useProgram(program);
   uniformT=gl.getUniformLocation(program,'uTime');
   position=gl.getAttribLocation(program,'aPosition');
   const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   gl.viewport(0,0,96,96);
   gl.clearColor(0,0,0,0);
  }
 }catch(error){console.warn('Soul fog shader fallback:',error);gl=null;}
 function frame(time){
  const stamp=Math.floor(time*9);
  if(lastFrame===stamp)return false;
  lastFrame=stamp;
  ctx.clearRect(0,0,96,96);
  if(gl){
   gl.clear(gl.COLOR_BUFFER_BIT);
   gl.uniform1f(uniformT,time);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   ctx.drawImage(canvas,0,0);
  }else{
   const grad=ctx.createRadialGradient(48,48,4,48,48,46);
   grad.addColorStop(0,'rgba(160,169,188,.64)');
   grad.addColorStop(.55,'rgba(121,130,150,.32)');
   grad.addColorStop(1,'rgba(80,88,108,0)');
   ctx.fillStyle=grad;ctx.fillRect(0,0,96,96);
  }
  return true;
 }
 function cells(stones,visible,view,limit=90){
  const result=[];
  for(const v of stones??[]){
   if(!v.landed)continue;
   for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const density=v.cells[y*SIZE+x]??0;
    if(density<.11)continue;
    const px=v.x+(x-7)*CELL,py=v.y+(y-7)*CELL;
    if(!visible(px,py,v.alleyFloor))continue;
    const pos=view(px,py,v.alleyFloor*132);
    result.push({x:pos.x,y:pos.y,alpha:Math.min(.78,density*.76),depth:pos.y+1,
     size:38+Math.min(18,density*14)});
   }
  }
  if(result.length>limit){
   result.sort((a,b)=>b.alpha-a.alpha);result.length=limit;
  }
  return result;
 }
 function draw(ctx,stones,visible,view,time,drawPots=true){
  frame(time);
  if(drawPots)for(const v of stones??[]){
   if(!visible(v.x,v.y,v.alleyFloor))continue;
   drawVessel(ctx,v,view);
  }
  const fields=cells(stones,visible,view,90);
  for(const f of fields){
   ctx.globalAlpha=f.alpha;
   ctx.drawImage(result,f.x-f.size/2,f.y-f.size/2,f.size,f.size);
  }
  ctx.globalAlpha=1;
 }
 return {canvas:result,vessel,get vesselRevision(){return vesselRevision;},
  get modelRevision(){return modelRevision;},get modelFrames(){return modelFrames;},
  set3DFrames,modelIndex,drawVessel,frame,cells,draw,gpu:Boolean(gl)};
}
root.GhostFogVisual={create};
})(typeof window==='undefined'?globalThis:window);
