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
 // A single lightweight, translucent smoke texture, updated only 9 Hz.
 // Do not allocate a fourth WebGL context (Phaser, Guardian and enemy GLBs
 // already contend for GPU contexts, especially on mobile Safari).
 let lastFrame=-1;
 function frame(time){
  const stamp=Math.floor(time*9);
  if(lastFrame===stamp)return false;
  lastFrame=stamp;
  ctx.clearRect(0,0,96,96);
  const haze=ctx.createRadialGradient(48,48,2,48,48,47);
  haze.addColorStop(0,'rgba(163,232,83,.89)');
  haze.addColorStop(.34,'rgba(127,201,70,.70)');
  haze.addColorStop(.69,'rgba(93,151,62,.32)');
  haze.addColorStop(1,'rgba(42,88,36,0)');
  ctx.fillStyle=haze;ctx.fillRect(0,0,96,96);
  ctx.save();
  ctx.globalCompositeOperation='screen';
  for(let i=0;i<6;i++){
   const angle=i*Math.PI/3+time*(i%2?.18:-.15);
   const distance=10+8*Math.sin(time*.69+i*2.6);
   const x=48+Math.cos(angle)*distance,y=48+Math.sin(angle)*distance*.63;
   const w=14+4*Math.sin(time*.8+i*1.4);
   const puff=ctx.createRadialGradient(x,y,0,x,y,w);
   puff.addColorStop(0,'rgba(185,246,107,.21)');
   puff.addColorStop(1,'rgba(71,146,46,0)');
   ctx.fillStyle=puff;ctx.fillRect(x-w,y-w,w*2,w*2);
  }
  ctx.restore();
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
  set3DFrames,modelIndex,drawVessel,frame,cells,draw,gpu:false};
}
root.GhostFogVisual={create};
})(typeof window==='undefined'?globalThis:window);
