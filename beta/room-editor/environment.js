/* Room Atelier ambient life and shared procedural flame shader. No main-game imports. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),TAU=Math.PI*2;
const hash=s=>{let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619);}return (h>>>0)/4294967296;};
const fract=x=>x-Math.floor(x);
function lightPoints(o,s){
 const rad=o.rot*Math.PI/180,c=Math.cos(rad),n=Math.sin(rad);
 // Blender rig Z=90-rot, camera swaps Blender X/Y into editor Y/X.
 return (s.lights||[]).map(([x,y,z,size,radius])=>({x:o.x+x*c+y*n,y:o.y+x*n-y*c,z,size,radius,phase:hash(o.id+':'+x+':'+y)*TAU}));
}
let shader=null,shaderFailed=false,last=-1;
function shaderFrame(t){
 if(shaderFailed)return null;
 try{
  if(!shader){
   const canvas=document.createElement('canvas');canvas.width=96;canvas.height=128;
   const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
   if(!gl)throw Error('WebGL unavailable');
   const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
   const vs=compile(gl.VERTEX_SHADER,'attribute vec2 p; varying vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}');
   const fs=compile(gl.FRAGMENT_SHADER,`precision mediump float;
varying vec2 uv;uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
void main(){float y=uv.y;float bend=(noise(vec2(y*4.,t*3.))-0.5)*.32*y;
float x=abs(uv.x-.5-bend);float w=.29*pow(max(0.,1.-y),.72)*smoothstep(0.,.08,y);
float flick=noise(vec2(uv.x*9.,y*7.-t*5.))*.10+noise(vec2(uv.x*22.,y*19.-t*8.))*.035;
float a=smoothstep(0.,.052,w-x+flick-.065)*smoothstep(0.,.035,y)*(1.-smoothstep(.76,.99,y+flick));
float core=smoothstep(.08,.0,x)* (1.-smoothstep(.32,.75,y));
vec3 col=mix(vec3(.72,.085,.008),vec3(1.,.48,.045),clamp((w-x)*6.+.35,0.,1.));col=mix(col,vec3(1.,.91,.62),core);
gl_FragColor=vec4(col,a);}`);
   const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
   shader={canvas,gl,time:gl.getUniformLocation(program,'t')};
  }
  const frame=Math.floor(t*24);
  if(frame!==last){last=frame;const {gl,time}=shader;gl.viewport(0,0,96,128);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform1f(time,t%1000);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
  return shader.canvas;
 }catch(e){shaderFailed=true;return null;}
}
function drawFlame(ctx,p,size,phase,t,zoom){
 const f=.93+.09*Math.sin(t*12+phase)+.04*Math.sin(t*27+phase),h=size*42*zoom*f,w=h*.65;
 const flame=shaderFrame(t);ctx.save();
 if(flame){ctx.drawImage(flame,p.x-w*.5,p.y-h,w,h);}
 else{
  const bend=Math.sin(t*9+phase)*w*.11;
  const grad=ctx.createLinearGradient(p.x,p.y,p.x,p.y-h);grad.addColorStop(0,'#fff0a5');grad.addColorStop(.42,'#ffad38');grad.addColorStop(1,'#b72c08');
  ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(p.x,p.y-h);ctx.bezierCurveTo(p.x+w*.6+bend,p.y-h*.52,p.x+w*.48,p.y,p.x,p.y);ctx.bezierCurveTo(p.x-w*.5,p.y,p.x-w*.31+bend,p.y-h*.57,p.x,p.y-h);ctx.fill();
 }
 ctx.restore();
}
function drawGlow(ctx,points,project,t,zoom){
 ctx.save();ctx.globalCompositeOperation='screen';
 for(const l of points){const p=project(l.x,l.y,l.z*.35),r=l.radius*42*zoom,alpha=.12+.035*Math.sin(t*9+l.phase)+.018*Math.sin(t*19+l.phase);const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
  g.addColorStop(0,'rgba(255,154,56,'+alpha+')');g.addColorStop(.35,'rgba(220,97,24,'+alpha*.65+')');g.addColorStop(1,'rgba(160,65,12,0)');
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,.62);ctx.translate(-p.x,-p.y);ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);ctx.restore();
 }
 ctx.restore();
}
function edgeBlocked(room,cat,x,y,nx,ny){
 return (room.walls||[]).some(w=>cat.walls[w.style]?.solid&&((x!==nx&&['west','east'].includes(w.edge)&&w.x===Math.max(x,nx)&&w.y===y)||(y!==ny&&['north','south'].includes(w.edge)&&w.y===Math.max(y,ny)&&w.x===x)));
}
function free(room,cat,shape,placement,x,y,z=0){
 if(!shape.has(room,Math.floor(x),Math.floor(y)))return false;
 return !(room.furniture||[]).some(o=>{const s=cat.furniture[o.type];if(!s||!o.blocksMovement&&!s.surface)return false;const b=placement.bounds(o,cat);return b&&x>b.left-.035&&x<b.right+.035&&y>b.top-.035&&y<b.bottom+.035;});
}
function route(room,cat,shape,placement,o){
 const x=Math.floor(o.x),y=Math.floor(o.y),start={x,y};
 if(!free(room,cat,shape,placement,x+.5,y+.5))return [];
 const seen=new Set([x+','+y]),queue=[start],parents=new Map();
 const dirs=[[1,0],[0,1],[-1,0],[0,-1]];
 const edgeScore=c=>dirs.filter(([dx,dy])=>!shape.has(room,c.x+dx,c.y+dy)||edgeBlocked(room,cat,c.x,c.y,c.x+dx,c.y+dy)).length;
 for(let i=0;i<queue.length&&i<100;i++){const c=queue[i];for(const [dx,dy] of dirs){const nx=c.x+dx,ny=c.y+dy,k=nx+','+ny;if(seen.has(k)||edgeBlocked(room,cat,c.x,c.y,nx,ny)||!free(room,cat,shape,placement,nx+.5,ny+.5))continue;
  let clear=true;for(let f=.2;f<1;f+=.2)if(!free(room,cat,shape,placement,c.x+.5+dx*f,c.y+.5+dy*f)){clear=false;break;}if(!clear)continue;
  seen.add(k);parents.set(k,c);queue.push({x:nx,y:ny,depth:(c.depth||0)+1});
 }}
 const ends=queue.filter(c=>(c.depth||0)>=2&&c.depth<=9).sort((a,b)=>(b.depth+edgeScore(b)*1.3)-(a.depth+edgeScore(a)*1.3));
 let end=ends[0]||queue[queue.length-1],path=[];
 while(end){path.push({x:end.x+.5,y:end.y+.5});end=parents.get(end.x+','+end.y);}
 return path.reverse();
}
function insects(room,cat,shape,placement,o,t,ctx,project,zoom,path){
 const s=cat.furniture[o.type],phase=hash(o.id);
 const roach=s.ambient==='roach',count=roach?9:7;
 ctx.save();
 for(let i=0;i<count;i++){
  let x,y,z=0,angle=0;
  if(roach){
   if(!path||path.length<2)continue;
   const total=path.length-1,u=fract(t*.36/(2*total)+i/count+phase)*2*total,d=u<=total?u:2*total-u;
   const k=Math.min(total-1,Math.floor(d)),f=d-k,a=path[k],b=path[k+1];
   x=a.x+(b.x-a.x)*f;y=a.y+(b.y-a.y)*f;angle=Math.atan2(b.y-a.y,b.x-a.x)+(u>total?Math.PI:0);
  }else{
   const a=t*(.6+i*.035)+i*2.399+phase*TAU,r=.35+.22*Math.sin(t*.65+i);
   x=o.x+Math.cos(a)*r;y=o.y+Math.sin(a*1.17)*r;z=.34+.16*Math.sin(t*2+i);
   if(edgeBlocked(room,cat,Math.floor(o.x),Math.floor(o.y),Math.floor(x),Math.floor(y)))continue;
  }
  if(!free(room,cat,shape,placement,x,y,z))continue;
  const p=project(x,y,z),q=project(x+Math.cos(angle)*.1,y+Math.sin(angle)*.1,z),scale=Math.max(.65,zoom);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(q.y-p.y,q.x-p.x));
  if(roach){ctx.strokeStyle='#211a13';ctx.lineWidth=.65*scale;for(let leg=-1;leg<=1;leg++)for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(leg*scale,0);ctx.lineTo((leg+.42*Math.sin(t*25+i))*scale,side*2.1*scale);ctx.stroke();}
   ctx.fillStyle='#38291e';ctx.beginPath();ctx.ellipse(0,0,2.6*scale,1.2*scale,0,0,TAU);ctx.fill();ctx.strokeStyle='#86613b';ctx.beginPath();ctx.moveTo(-1.9*scale,0);ctx.lineTo(1.8*scale,0);ctx.stroke();}
  else{ctx.fillStyle='#b2b8a98a';ctx.beginPath();ctx.ellipse(0,-1.15*scale,1.5*scale,.55*scale,Math.sin(t*45+i),0,TAU);ctx.ellipse(0,1.15*scale,1.5*scale,.55*scale,-Math.sin(t*45+i),0,TAU);ctx.fill();ctx.fillStyle='#201f1c';ctx.beginPath();ctx.ellipse(0,0,1.5*scale,.8*scale,0,0,TAU);ctx.fill();}
  ctx.restore();
 }
 ctx.restore();
}
const api=Object.freeze({lightPoints,drawFlame,drawGlow,route,insects,free});
root.MindRoomEnvironment=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:{});
