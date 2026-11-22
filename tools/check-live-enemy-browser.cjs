// Browser-level smoke: the real game must load the three live Blender enemy
// models through WebGL and draw genuine, continuously rotated 3D silhouettes.
// Run with a local web server: npm install --no-save playwright &&
// python3 -m http.server 8765 & node tools/check-live-enemy-browser.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const base=process.env.MIND_DUNGEON_URL||'http://127.0.0.1:8765/beta/';
const url=base+'?szene=gasse&modus=generator&seed=4148&debug-art=1';
const run=async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:800}});
  const errors=[],warnings=[],failed=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',msg=>{
   if(msg.type()==='error'||msg.type()==='warning')warnings.push(msg.text());
  });
  page.on('requestfailed',request=>failed.push({
   url:request.url(),reason:request.failure()?.errorText
  }));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  try{
   await page.waitForFunction(()=>window.__mindEnemyRig?.active?.length===3,
    null,{timeout:35000});
  }catch(error){
   const diagnostics=await page.evaluate(()=>({
    path:location.href,
    rigStatus:window.__mindEnemyRig?.active??null,
    gameEngine:window.__engine||null,
    pageTitle:document.title,
    loading:document.querySelector('#dungeon-loading')?.textContent?.slice(0,200)
   })).catch(e=>({evaluationError:e.message}));
   console.error('3D enemy load diagnostics:',
    JSON.stringify({diagnostics,errors,warnings:warnings.slice(-20),
     failed:failed.slice(-20)},null,2));
   throw error;
  }
  await page.waitForFunction(()=>window.__mindGuardianRig&&
   window.__mindGuardianAtlas?.clips?.idle,null,{timeout:35000});
  const result=await page.evaluate(()=>{
   const renderer=window.__mindEnemyRig;
   const iso={viewAngle:angle=>angle,toView:()=>({x:90,y:110})};
   const kinds=['sabre','bow','rat'],out={active:renderer.active,visuals:[]};
   const checksum=canvas=>{
    const ctx=canvas.getContext('2d');
    if(canvas.width!==208||canvas.height!==208)
     throw Error('Live enemy resolution should match Guardian pixel density');
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
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
   // A concrete visual contact sheet, not just a test that animations exist.
   // The first column is rendered by the *actual live Guardian*, so a bad
   // enemy art direction cannot hide behind successful GLB loader checks.
   const preview=document.createElement('canvas');
   const tile=230;preview.width=tile*4;preview.height=tile*2;
   const g=preview.getContext('2d');
   g.fillStyle='#26303d';g.fillRect(0,0,preview.width,preview.height);
   const hero=window.__mindGuardianRig;
   const clips=window.__mindGuardianAtlas.clips;
   out.meter={};
   const metrics=canvas=>{
    const p=canvas.getContext('2d').getImageData(
     0,0,canvas.width,canvas.height).data,values=[];
    for(let i=0;i<p.length;i+=4)if(p[i+3]>=220)
     values.push(Math.round(.2126*p[i]+.7152*p[i+1]+.0722*p[i+2]));
    values.sort((a,b)=>a-b);
    const pct=t=>values[Math.min(values.length-1,Math.floor(t*(values.length-1)))]||0;
    return {solidPixels:values.length,shadow:pct(.10),highlight:pct(.90),
     contrast:pct(.90)-pct(.10)};
   };
   for(const [row,view] of [0,Math.PI*.65].entries()){
    hero.render('idle',clips.idle,.35,view,true,performance.now()/1000+row*.05);
    const draw=(canvas,col,label)=>{
     const x=col*tile+3,y=row*tile+19;
     g.drawImage(canvas,x,y,224,205);
     g.fillStyle='#f5f2e8';g.font='12px monospace';
     g.fillText(label,x+7,y-4);
     out.meter[label]=metrics(canvas);
    };
    draw(hero.canvas,0,'guardian-'+row);
    for(const [i,kind] of ['sabre','bow','rat'].entries()){
     const enemy={x:100,y:100,size:1,facing:view,phase:.2,moving:false};
     const rig=renderer.draw(enemy,kind,{clip:'idle',t:.3},iso);
     if(!rig)throw Error('Missing comparison image: '+kind);
     draw(rig.image,i+1,kind+'-'+row);
    }
   }
   out.preview=preview.toDataURL('image/png');
   out.artStatus=window.__mindArtStatus;
   return out;
  });
  assert.equal(result.visuals.length,3);
  assert.equal(result.artStatus?.guardian,'3D LIVE');
  assert.equal(result.artStatus?.skeleton,'3D LIVE');
  assert.equal(result.artStatus?.rat,'3D LIVE');
  for(const [name,meter] of Object.entries(result.meter)){
   assert(meter.solidPixels>100&&meter.contrast>=25,
    'Unrendered or completely flat character '+name+': '+JSON.stringify(meter));
  }
  fs.mkdirSync('artifacts',{recursive:true});
  fs.writeFileSync('artifacts/guardian-style-audit.png',
   Buffer.from(result.preview.split(',')[1],'base64'));
  delete result.preview;
  assert.equal(errors.length,0,'Game runtime JavaScript errors: '+errors.join('; '));
  console.log('Guardian-compatible live 3D enemy browser smoke:',JSON.stringify(result));
  console.log('All three animated GLB rigs render with genuine opaque pixels in Chromium WebGL.');
 }finally{await browser.close();}
};
run().catch(err=>{console.error(err);process.exitCode=1;});
