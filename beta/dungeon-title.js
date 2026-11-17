window.DungeonTitle = (() => {
 'use strict';

 const artwork = new URL('assets/shadowbound-title.webp', document.currentScript.src).href;
 const vertex = `
  attribute vec2 position;
  varying vec2 uv;
  void main() {
   uv = position * .5 + .5;
   gl_Position = vec4(position, 0., 1.);
  }
 `;
 const fragment = `
  precision mediump float;
  uniform sampler2D artwork;
  uniform vec2 scale;
  uniform vec2 crop;
  uniform vec2 texel;
  varying vec2 uv;

  vec3 emission(vec2 point) {
   vec3 c = texture2D(artwork, point).rgb;
   float warm = smoothstep(.10, .39, c.r - c.b)
    * smoothstep(.51, .85, c.r) * smoothstep(.22, .43, c.g);
   float violet = smoothstep(.07, .31, c.b - c.g)
    * smoothstep(.44, .75, c.b) * smoothstep(.35, .68, c.r);
   return warm * vec3(1., .41, .13) + violet * vec3(.64, .28, 1.);
  }

  void main() {
   vec2 p = vec2(uv.x, 1. - uv.y) * scale + crop;
   vec3 light = emission(p) * .08;
   for (int i = 0; i < 8; ++i) {
    float angle = float(i) * .785398;
    vec2 ray = vec2(cos(angle), sin(angle)) * texel;
    light += emission(p + ray * 9.) * .064;
    light += emission(p + ray * 22.) * .038;
    light += emission(p + ray * 37.) * .016;
   }
   gl_FragColor = vec4(light * .39, 1.);
  }
 `;

 function mount(canvas) {
  const gl = canvas.getContext('webgl', {alpha:false,antialias:false,depth:false,stencil:false});
  if(!gl)return null;
  const program=gl.createProgram();
  const shaders=[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]].map(([type,source])=>{
   const shader=gl.createShader(type);
   gl.shaderSource(shader,source);
   gl.compileShader(shader);
   gl.attachShader(program,shader);
   return shader;
  });
  gl.linkProgram(program);
  shaders.forEach(shader=>gl.deleteShader(shader));
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
   gl.deleteProgram(program);
   return null;
  }

  gl.useProgram(program);
  const mesh=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const scale=gl.getUniformLocation(program,'scale');
  const crop=gl.getUniformLocation(program,'crop');
  const texel=gl.getUniformLocation(program,'texel');
  const texture=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);

  const scene=canvas.parentElement;
  const mobile=matchMedia('(max-width: 650px)');
  const image=new Image();
  let loaded=false;
  function draw() {
   const width=scene.clientWidth,height=scene.clientHeight;
   if(!loaded||!width||!height||gl.isContextLost())return;
   const renderScale=Math.min(.75,960/Math.max(width,height));
   canvas.width=Math.max(1,Math.round(width*renderScale));
   canvas.height=Math.max(1,Math.round(height*renderScale));
   const cover=Math.max(width/image.naturalWidth,height/image.naturalHeight);
   const u=width/(image.naturalWidth*cover),v=height/(image.naturalHeight*cover);
   gl.viewport(0,0,canvas.width,canvas.height);
   gl.uniform2f(scale,u,v);
   gl.uniform2f(crop,(1-u)*(mobile.matches?.68:.60),(1-v)*.5);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   canvas.hidden=false;
  }

  const observer=new ResizeObserver(draw);
  image.onload=()=>{
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
   gl.uniform2f(texel,1/image.naturalWidth,1/image.naturalHeight);
   loaded=true;
   draw();
   observer.observe(scene);
  };
  image.src=artwork;
  return ()=>{
   observer.disconnect();
   image.onload=null;
   gl.deleteTexture(texture);
   gl.deleteBuffer(mesh);
   gl.deleteProgram(program);
  };
 }
 return {mount};
})();
