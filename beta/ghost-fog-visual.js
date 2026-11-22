// One shared GPU fog shader for every ghost vessel; physical density comes
// from SoulVessels diffusion, not the fragment shader. WebGL optional.
(function(root){
'use strict';
const SIZE=15,CELL=18;
// The runtime sprite is rendered from the actual Blender prop when its asset
// has been published. The procedural preview is deliberately kept visible
// on slow networks and when the art CDN is unavailable.
// Compact, hand-sized orb — not a jar/silo. The dark seam rotates with
// physical distance travelled and therefore visualizes rolling velocity.
function createPot(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=48;
 const c=canvas.getContext('2d');
 c.fillStyle='#080e12a0';c.beginPath();c.ellipse(24,39,12,3.5,0,0,Math.PI*2);c.fill();
 const body=c.createRadialGradient(18,13,2,25,25,18);
 body.addColorStop(0,'#e8f4e3');body.addColorStop(.22,'#afc9c2');
 body.addColorStop(.55,'#547c74');body.addColorStop(.85,'#283d43');
 body.addColorStop(1,'#101a24');
 c.fillStyle=body;c.strokeStyle='#18252c';c.lineWidth=1.6;
 c.beginPath();c.arc(24,23,15,0,Math.PI*2);c.fill();c.stroke();
 c.strokeStyle='#91ffac';c.shadowColor='#79e982';c.shadowBlur=5;
 c.lineWidth=2;c.beginPath();c.moveTo(16,17);c.lineTo(22,22);c.lineTo(19,28);
 c.moveTo(22,22);c.lineTo(30,17);c.lineTo(33,23);c.stroke();
 c.shadowBlur=0;
 c.fillStyle='#edfff7b8';c.beginPath();c.ellipse(18,15,4,2.2,-.6,0,Math.PI*2);c.fill();
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
  // Keep spherical gameplay artwork even if a legacy 3D jar is loaded.
  return false;
 }
 function modelIndex(v){
  if(!modelFrames.length)return -1;
  if(!v.landed)return 16+((Math.floor(v.age*12+(v.seed||0))%8+8)%8);
  return ((Math.floor(v.seed||0)%16+16)%16);
 }
 function vesselImage(v){const index=modelIndex(v);return index<0?vessel:modelFrames[index];}
 function drawVessel(ctx,v,view){
  const p=view(v.x,v.y,v.z),image=vesselImage(v);
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate((v.spin||0)% (Math.PI*2));
  ctx.drawImage(image,-13,-13,26,26);
  ctx.restore();
 }
 // The previous Blender jar was intentionally retired: no large 3D props.
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
    'float edge=1.-smoothstep(.35,.98,r+(.5-swirl)*.36);'+
    'float a=clamp(edge*(.48+turbulence*.45),0.,.86);'+
    'vec3 color=mix(vec3(.16,.34,.16),vec3(.58,.89,.35),swirl*.85);'+
    'gl_FragColor=vec4(color,a);}'));
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
   grad.addColorStop(0,'rgba(172,239,87,.82)');
   grad.addColorStop(.55,'rgba(101,172,67,.48)');
   grad.addColorStop(1,'rgba(47,83,40,0)');
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
    if(density<.065)continue;
    const px=(v.cloudX??v.x)+(x-7)*CELL,py=(v.cloudY??v.y)+(y-7)*CELL;
    if(!visible(px,py,v.alleyFloor))continue;
    const pos=view(px,py,v.alleyFloor*132+9);
    result.push({x:pos.x,y:pos.y,alpha:Math.min(.88,.20+density*.60),
     floor:v.alleyFloor,depth:pos.y+.1,size:43+Math.min(27,density*18)});
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
