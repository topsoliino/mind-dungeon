// One shared GPU fog shader for every ghost vessel; physical density comes
// from SoulVessels diffusion, not the fragment shader. WebGL optional.
(function(root){
'use strict';
const SIZE=15,CELL=18;
function create(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
 const result=document.createElement('canvas');result.width=result.height=96;
 const ctx=result.getContext('2d');
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
  const stamp=Math.floor(time*13);
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
 function cells(stones,visible,view,limit=170){
  const result=[];
  for(const v of stones??[]){
   if(!v.landed)continue;
   for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const density=v.cells[y*SIZE+x]??0;
    if(density<.11)continue;
    const px=v.x+(x-7)*CELL,py=v.y+(y-7)*CELL;
    if(!visible(px,py))continue;
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
 function draw(ctx,stones,visible,view,time){
  frame(time);
  for(const v of stones??[]){
   if(!visible(v.x,v.y))continue;
   const p=view(v.x,v.y,v.z);
   ctx.save();ctx.translate(p.x,p.y);
   ctx.fillStyle='#3f4654';ctx.strokeStyle='#9ca0a7';ctx.lineWidth=2;
   ctx.beginPath();ctx.ellipse(0,-5,9,17,.24,0,Math.PI*2);
   ctx.fill();ctx.stroke();ctx.restore();
  }
  const fields=cells(stones,visible,view,170);
  for(const f of fields){
   ctx.globalAlpha=f.alpha;
   ctx.drawImage(result,f.x-f.size/2,f.y-f.size/2,f.size,f.size);
  }
  ctx.globalAlpha=1;
 }
 return {canvas:result,frame,cells,draw};
}
root.GhostFogVisual={create};
})(typeof window==='undefined'?globalThis:window);
