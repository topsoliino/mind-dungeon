// Browser-level smoke: the real game must load the three live Blender enemy
// models through WebGL and draw genuine, continuously rotated 3D silhouettes.
// Run with a local web server: npm install --no-save playwright &&
// python3 -m http.server 8765 & node tools/check-live-enemy-browser.cjs
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.MIND_DUNGEON_URL||'http://127.0.0.1:8765/beta/';
const url=base+'?szene=gasse&modus=generator&seed=4148&live-rigs=1';
const run=async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:800}});
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.__mindEnemyRig?.active?.length===3,
   null,{timeout:90000});
  const result=await page.evaluate(()=>{
   const renderer=window.__mindEnemyRig;
   const iso={viewAngle:angle=>angle,toView:()=>({x:90,y:110})};
   const kinds=['sabre','bow','rat'],out={active:renderer.active,visuals:[]};
   const checksum=canvas=>{
    const ctx=canvas.getContext('2d'),pixels=ctx.getImageData(0,0,176,176).data;
    let alpha=0,hash=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>20){
     alpha++;hash=((hash*33)^(pixels[i]*3+pixels[i+1]*5+
      pixels[i+2]*7+pixels[i+3]+(i>>2)))>>>0;
    }
    return {alpha,hash};
   };
   for(const kind of kinds){
    const enemy={
     x:100,y:100,size:1,skeleton:kind==='rat'?null:kind,
     facing:0,phase:.24,moving:true,alleyFloor:0
    };
    const first=renderer.draw(enemy,kind,{clip:'idle',t:.3},iso);
    if(!first)throw Error('Could not render live Blender rig: '+kind);
    const a=checksum(first.image);
    enemy.facing=Math.PI*1.25;
    const second=renderer.draw(enemy,kind,{clip:'run',t:.55},iso);
    const b=checksum(second.image);
    if(a.alpha<80||b.alpha<80||a.hash===b.hash)
     throw Error('Empty or static 3D frames for '+kind+': '+JSON.stringify({a,b}));
    const death=renderer.draw(enemy,kind,{clip:'death',t:.65},iso,1);
    const c=checksum(death.image);
    if(c.alpha<20)throw Error('Missing Blender rig death pose: '+kind);
    out.visuals.push({kind,idlePixels:a.alpha,walkingPixels:b.alpha,
     corpsePixels:c.alpha,yawChangesFrame:a.hash!==b.hash});
   }
   return out;
  });
  assert.equal(result.visuals.length,3);
  assert.equal(errors.length,0,'Game runtime JavaScript errors: '+errors.join('; '));
  console.log('Guardian-compatible live 3D enemy browser smoke:',JSON.stringify(result));
  console.log('All three animated GLB rigs render with genuine opaque pixels in Chromium WebGL.');
 }finally{await browser.close();}
};
run().catch(err=>{console.error(err);process.exitCode=1;});
