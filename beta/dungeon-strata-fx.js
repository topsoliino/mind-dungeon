window.DungeonStrataFx=(()=>{
 'use strict';
 const bank=.075,corner=.2,noBanks=[0,0,0,0];
 const isSewer=type=>type?.startsWith('sewer-');
 const isPool=type=>type==='sewer-pool'||type==='boss-water';
 function shoreline(terrain,x,y){
  return [[x-1,y],[x,y-1],[x+1,y],[x,y+1]].map(([col,row])=>Number(!isSewer(terrain[row]?.[col])));
 }
 function shorePath(ctx,x,y,size,edges,begin=true){
  const [left,top,right,bottom]=edges;
  const radius=corner*size,inset=bank*size;
  if(begin)ctx.beginPath();
  ctx.roundRect(x+left*inset,y+top*inset,size-(left+right)*inset,size-(top+bottom)*inset,
   [left*top*radius,right*top*radius,right*bottom*radius,left*bottom*radius]);
 }
 // Repeatable water frames are uploaded once and placed at world coordinates.
 // Bridges and temples do not need the interactive sewer ripple surface.
 function riverAnimation(tileSize){
  const tiles=6,pixels=tileSize/2,size=pixels*tiles,count=12,cycle=Math.PI*2;
  const make=vertical=>Array.from({length:count},(_,i)=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
   const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),pace=i/count*cycle;
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(vertical?y:x)/size*cycle,v=(vertical?x:y)/size*cycle;
    const caustic=Math.max(0,Math.sin(u*6-pace+Math.sin(v*4)*1.7)*.86+Math.sin(v*7-u*2+pace)*.72-.73);
    const index=(y*size+x)*4;
    image.data[index]=77;image.data[index+1]=153;image.data[index+2]=160;
    image.data[index+3]=12+Math.round(caustic*61);
   }
   ctx.putImageData(image,0,0);return canvas;
  });
  return {tiles,pixels,count,frames:[make(false),make(true)]};
 }
 const vertex=`
 attribute vec3 aWorld;attribute vec2 aLocal;attribute vec4 aEdges;
 uniform vec4 uView;
 varying vec2 vWorld,vLocal;varying float vType;varying vec4 vEdges;
 void main(){
  vec2 p=(aWorld.xy-uView.xy)/uView.zw;
  gl_Position=vec4(p.x*2.0-1.0,1.0-p.y*2.0,0.0,1.0);
  vWorld=aWorld.xy;vLocal=aLocal;vType=aWorld.z;vEdges=aEdges;
 }`;
 const fragment=`
 precision highp float;
 uniform float uTime;
 uniform vec3 uRipples[8];
 varying vec2 vWorld,vLocal;varying float vType;varying vec4 vEdges;
 float shorelineAlpha(){
  vec2 side=vec2(vLocal.x<.5?vEdges.x:vEdges.z,vLocal.y<.5?vEdges.y:vEdges.w);
  vec2 inside=mix(vec2(1.0),min(vLocal,1.0-vLocal)-${bank},side);
  float radius=side.x*side.y*${corner};
  vec2 q=radius-inside;
  float dist=length(max(q,0.0))+min(max(q.x,q.y),0.0)-radius;
  return 1.0-smoothstep(-.012,.008,dist);
 }
 void main(){
  if(vType>2.5&&vType<3.5){
   float d=length(vLocal*2.0-1.0);
   float flicker=.91+.09*sin(uTime*9.0+vWorld.x*.02)*cos(uTime*6.0+vWorld.y*.02);
   gl_FragColor=vec4(.97,.65,.29,pow(max(0.0,1.0-d),2.8)*.31*flicker);
   return;
  }
  bool deep=vType>3.5;
  vec2 p=mod(vWorld,1536.0);
  float flow=vType<.5?0.0:uTime*(deep?20.0:28.0);
  vec2 uv=(vType>4.5||(vType>1.5&&vType<2.5))?p.yx:p.xy;
  float wave=sin((uv.x-flow)*.14+sin(uv.y*.11+uTime*.6)*1.8);
  float crossWave=sin(uv.y*.21-uv.x*.07+uTime*.8);
  float caustic=smoothstep(.92,1.66,wave*.87+crossWave*.72);
  float ring=0.0;
  if(flow==0.0)for(int i=0;i<8;i++){
   vec3 splash=uRipples[i];
   float age=splash.z;
   float distanceFromRing=length(vWorld-splash.xy)-age*78.0;
   if(age>=0.0&&age<.78){
    ring+=exp(-abs(distanceFromRing)*.47)*max(0.0,1.0-age/.78);
   }
  }
  vec3 color=mix(vec3(.38,.78,.72),vec3(.27,.60,.63),float(deep));
  float mask=deep||dot(vEdges,vec4(1.0))<.5?1.0:shorelineAlpha();
  gl_FragColor=vec4(color+ring*.21,mask*(.07+caustic*(deep?.17:.25)+.43*min(1.0,ring)));
 }`;
 function create(){
  const canvas=document.createElement('canvas');
  const gpu=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  let gl=null,program,buffer,position,local,edges,view,time,ripples;
  try{
   gl=gpu.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false});
   if(gl){
    const compile=(kind,source)=>{
     const shader=gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);
     if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
     return shader;
    };
    program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    buffer=gl.createBuffer();
    position=gl.getAttribLocation(program,'aWorld');local=gl.getAttribLocation(program,'aLocal');
    edges=gl.getAttribLocation(program,'aEdges');
    view=gl.getUniformLocation(program,'uView');time=gl.getUniformLocation(program,'uTime');
    ripples=gl.getUniformLocation(program,'uRipples[0]');
   }
  }catch{gl=null;}
  const steps=[],last=new Map();
  function collect(actor,key,t,waterAt){
   if(!actor||!isPool(waterAt(actor.x,actor.y))){last.delete(key);return;}
   const before=last.get(key);
   if(!before||Math.hypot(actor.x-before.x,actor.y-before.y)>17){
    const step={x:actor.x,y:actor.y,t};
    last.set(key,step);steps.push(step);
    if(steps.length>8)steps.shift();
   }
  }
  function render(x,y,w,h,t,tiles,lights,tileSize){
   const width=Math.max(1,Math.ceil(w/2)),height=Math.max(1,Math.ceil(h/2));
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);
   // Arena water covers carpet only after the roof opens. Sewer water already
   // has a painted base in the permanent world tiles.
   ctx.setTransform(width/w,0,0,height/h,-x*width/w,-y*height/h);
   ctx.fillStyle='#25424be6';ctx.beginPath();
   for(const tile of tiles)if(tile.type==='boss-water'){
    shorePath(ctx,tile.x*tileSize,tile.y*tileSize,tileSize,tile.edges,false);
   }
   ctx.fill();
   if(gl&&!gl.isContextLost()){
    if(gpu.width!==width||gpu.height!==height){gpu.width=width;gpu.height=height;}
    gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const vertices=[];
    function quad(px,py,size,type,banks=noBanks){
     for(const [u,v] of [[0,0],[1,0],[0,1],[0,1],[1,0],[1,1]])vertices.push(px+u*size,py+v*size,type,u,v,...banks);
    }
    for(const tile of tiles)quad(tile.x*tileSize,tile.y*tileSize,tileSize,
     isPool(tile.type)?0:tile.edges?tile.vertical?2:1:tile.vertical?5:4,tile.edges);
    for(const light of lights)quad(light.x-light.radius,light.y-light.radius,light.radius*2,3);
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,36,0);
    gl.enableVertexAttribArray(local);gl.vertexAttribPointer(local,2,gl.FLOAT,false,36,12);
    gl.enableVertexAttribArray(edges);gl.vertexAttribPointer(edges,4,gl.FLOAT,false,36,20);
    gl.uniform4f(view,x,y,w,h);gl.uniform1f(time,t%1024);
    const data=new Float32Array(24).fill(-1);
    steps.forEach((p,i)=>data.set([p.x,p.y,t-p.t],i*3));
    gl.uniform3fv(ripples,data);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES,0,vertices.length/9);
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(gpu,0,0);
   }else{
    ctx.setTransform(width/w,0,0,height/h,-x*width/w,-y*height/h);
    for(const tile of tiles){
     const tx=tile.x*tileSize,ty=tile.y*tileSize;
     ctx.save();shorePath(ctx,tx,ty,tileSize,tile.edges??noBanks);ctx.clip();
     ctx.strokeStyle=tile.edges?'#90cfbd':'#73a5aa';ctx.lineWidth=2;
     if(isPool(tile.type)){
      for(const step of steps){
       const age=t-step.t;
       if(age>=.78)continue;
       ctx.globalAlpha=.55*(1-age/.78);ctx.beginPath();ctx.arc(step.x,step.y,age*78,0,Math.PI*2);ctx.stroke();
      }
     }
     ctx.globalAlpha=tile.edges?.30:.22;ctx.beginPath();
     for(let i=0;i<4;i++){
      const z=(t*(isPool(tile.type)?5:tile.edges?28:20)+i*15+tile.x*5+tile.y*13)%tileSize,o=6+i*11;
      if(tile.vertical){ctx.moveTo(tx+o,ty+z);ctx.lineTo(tx+o,ty+z+16);}
      else{ctx.moveTo(tx+z,ty+o);ctx.lineTo(tx+z+16,ty+o);}
     }
     ctx.stroke();
     ctx.restore();
    }
    for(const light of lights){
     const g=ctx.createRadialGradient(light.x,light.y,0,light.x,light.y,light.radius);
     g.addColorStop(0,'rgba(248,169,74,'+(.22+.03*Math.sin(t*8+light.x))+')');
     g.addColorStop(1,'rgba(248,169,74,0)');ctx.fillStyle=g;
     ctx.fillRect(light.x-light.radius,light.y-light.radius,2*light.radius,2*light.radius);
    }
   }
   return canvas;
  }
  return {canvas,collect,render,get shader(){return Boolean(gl&&!gl.isContextLost());}};
 }
 return {create,isSewer,shoreline,shorePath,riverAnimation};
})();
