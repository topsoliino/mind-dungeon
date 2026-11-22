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
  const result=await page.evaluate(async()=>{
   const renderer=window.__mindEnemyRig;
   const iso={viewAngle:angle=>angle,toView:()=>({x:90,y:110})};
   const kinds=['sabre','bow','rat'],out={active:renderer.active,visuals:[]};
   const fog=window.GhostFogVisual?.create();
   if(!fog||fog.gpu)throw Error('Green ghost fog must draw without a competing WebGL context');
   fog.frame(1.0);
   const smokePixels=fog.canvas.getContext('2d').getImageData(0,0,96,96).data;
   let visibleSmoke=0;
   for(let i=3;i<smokePixels.length;i+=4)if(smokePixels[i]>18)visibleSmoke++;
   if(visibleSmoke<250)throw Error('Rolling orb poison cloud produced an empty texture');
   out.ghostFog={gpu:fog.gpu,visibleSmoke};
   // Binary asset verification only after the v5 source has been exported.
   // On source commits the previous GLB may legitimately still be deployed.
   const skeletonManifest=await (await fetch(
    'beta/art/skeleton/skeleton-live.json',{cache:'no-cache'})).json();
   if(skeletonManifest.sabre?.artStyle==='guardian-rebuilt-skeleton-v7'){
    out.specialClips=[];
    for(const [kind,names] of [['sabre',['combo','slash','overhead',
       'cartwheel-enter','cartwheel','cartwheel-exit',
       'cartwheel-enter-left','cartwheel-left','cartwheel-exit-left',
       'throw','combo-run']],
       ['bow',['double-shoot','flee','throw','shoot-run','double-shoot-run']]]){
     for(const clip of names){
      const enemy={x:100,y:100,size:1,facing:.12,phase:.2,moving:true};
      const hashes=[];
      for(const t of [.08,.43,.78]){
       const selection=renderer.draw(enemy,kind,{clip,t},iso);
       if(!selection)throw Error('Missing special live clip '+kind+':'+clip);
       const c=selection.image.getContext('2d');
       const pixels=c.getImageData(0,0,208,208).data;
       let solid=0,hash=0;
       for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>24){
        solid++;hash=((hash*31)^(pixels[i]+pixels[i+1]+pixels[i+2]+i))>>>0;
       }
       if(solid<60)throw Error('Empty special Blender clip '+kind+':'+clip);
       hashes.push(hash);
      }
      if(new Set(hashes).size<2)
       throw Error('Static special Blender animation '+kind+':'+clip);
      out.specialClips.push(kind+':'+clip);
     }
    }
   }
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
   // Separate contact sheet for the *actual bone animations*. Frame four is
   // an after-swing/recovery pose, not a static sprite or CSS effect.
   const actionSheet=document.createElement('canvas');
   actionSheet.width=tile*4;actionSheet.height=tile*3;
   const ag=actionSheet.getContext('2d');
   ag.fillStyle='#26303d';ag.fillRect(0,0,actionSheet.width,actionSheet.height);
   out.telegraphs=[];
   for(const [row,kind] of ['sabre','bow','rat'].entries()){
    const clip=kind==='sabre'?'strike':kind==='bow'?'shoot':'bite';
    const samples=kind==='sabre'?[.08,.39,.61,.89]:
     kind==='bow'?[.08,.47,.69,.92]:[.08,.27,.49,.85];
    const hashes=[];
    for(const [col,t] of samples.entries()){
     const enemy={x:100,y:100,size:1,facing:.20,
       skeleton:kind==='rat'?null:kind,moving:false};
     const result=renderer.draw(enemy,kind,{clip,t},iso);
     if(!result)throw Error('Missing action pose '+kind+' '+t);
     const m=checksum(result.image);
     if(m.alpha<100)throw Error('Empty action pose '+kind+' '+t);
     hashes.push(m.hash);
     const x=col*tile+3,y=row*tile+18;
     ag.drawImage(result.image,x,y,224,205);
     ag.fillStyle='#f5f2e8';ag.font='12px monospace';
     ag.fillText(kind+' '+clip+' '+(t*100).toFixed(0)+'%',x+7,y-3);
    }
    if(new Set(hashes).size<3)
     throw Error('Attack animation barely changes across anticipation/strike/recovery: '+kind);
    out.telegraphs.push({kind,clip,distinctFrames:new Set(hashes).size});
   }
   out.actionPreview=actionSheet.toDataURL('image/png');
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
  fs.writeFileSync('artifacts/enemy-attack-telegraphs.png',
   Buffer.from(result.actionPreview.split(',')[1],'base64'));
  delete result.preview;delete result.actionPreview;
  assert.equal(errors.length,0,'Game runtime JavaScript errors: '+errors.join('; '));
  console.log('Guardian-compatible live 3D enemy browser smoke:',JSON.stringify(result));
  console.log('All three animated GLB rigs render with genuine opaque pixels in Chromium WebGL.');
  // Separate REAL playtest (no debug-art) performance smoke. The visual audit
  // above intentionally forces every live GLB; it cannot verify that the
  // production game actually uses baked 32-facing models and GPU throttling.
  await page.close();
  const playtest=await browser.newPage({viewport:{width:1100,height:800}});
  const playErrors=[];
  playtest.on('pageerror',err=>playErrors.push(err.message));
  await playtest.goto(base+'?szene=gasse&modus=generator&seed=4148&profile-render=1&renderer=webgl',
   {waitUntil:'domcontentloaded',timeout:45000});
  await playtest.waitForFunction(()=>
   (window.__mindEnemyRig?.active?.length===2||
    window.__mindArtStatus?.skeleton==='Blender 3D Atlas')&&
   window.__mindDiagnostics?.engine==='Phaser 3'&&
   window.__mindDiagnostics?.isPlaying,null,{timeout:40000});
  const benchmark=await playtest.evaluate(async()=>{
   const rig=window.__mindEnemyRig||{
    active:[],stats:{gpuRenders:0,gpuCostMs:0,cacheHits:0,budgetSkips:0}};
   const initial=rig.stats.gpuRenders;
   const gameTimeStart=window.__mindDiagnostics.gameTime;
   const profile={};
   const wrap=(object,method,name)=>{
    if(!object||typeof object[method]!=='function')return;
    const original=object[method];
    profile[name]={calls:0,ms:0,max:0};
    object[method]=function(...args){
     const begin=performance.now();
     try{return original.apply(this,args);}
     finally{
      const duration=performance.now()-begin;
      const entry=profile[name];
      entry.calls++;entry.ms+=duration;entry.max=Math.max(entry.max,duration);
     }
    };
   };
   const game=window.__mindPhaserGame,scene=game?.scene?.scenes?.[0];
   wrap(window.__mindGuardianRig,'render','heroGLB');
   wrap(scene,'renderAlley','alley');
   wrap(scene,'update','sceneUpdate');
   wrap(scene,'renderFrame','sceneRenderFrame');
   wrap(game?.renderer,'render','phaserDraw');
   const samples=[],started=performance.now();
   await new Promise(resolve=>{
    let last=started;
    function tick(now){
     samples.push(now-last);last=now;
     if(now-started>=2200)resolve();
     else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
   });
   samples.sort((a,b)=>a-b);
   const elapsed=performance.now()-started;
   return {
    engine:window.__mindDiagnostics.engine,
    atlasRat:!rig.active.includes('rat'),
    skeletonAtlas:window.__mindArtStatus?.skeleton,
    enemyCount:window.__mindDiagnostics.enemyCount,
    simulation:window.__mindDiagnostics.simulationMs,
    gameSeconds:Math.round((window.__mindDiagnostics.gameTime-gameTimeStart)*100)/100,
    sampledFps:Math.round(samples.length*1000/elapsed),
    p95FrameMs:Math.round(samples[Math.floor(samples.length*.95)]||0),
    gpuRenders:rig.stats.gpuRenders-initial,
     rendererCosts:window.__mindAlleyProfile||{},
     enemyGpuCostMs:rig.stats.gpuCostMs||0,
    cacheHits:rig.stats.cacheHits,
    budgetSkips:rig.stats.budgetSkips,
    profile:Object.fromEntries(Object.entries(profile).map(([k,v])=>
     [k,{calls:v.calls,totalMs:Math.round(v.ms),
       avgMs:Math.round(v.ms/Math.max(1,v.calls)),maxMs:Math.round(v.max)}])),
    seconds:Math.round(elapsed)/1000
   };
  });
  console.log('PRODUCTION PLAYTEST FPS / FRAME COST:',JSON.stringify(benchmark));
  if(benchmark.skeletonAtlas==='Blender 3D Atlas')
   console.log('Original Blender skeletal atlas: zero GPU poses rendered during combat.');
  const phaserCanvas=await browser.newPage({viewport:{width:1100,height:800}});
  const candidateErrors=[];
  phaserCanvas.on('pageerror',err=>candidateErrors.push(err.message));
  await phaserCanvas.goto(base+'?szene=gasse&modus=generator&seed=4148&renderer=phaser-canvas',
   {waitUntil:'domcontentloaded',timeout:45000});
  await phaserCanvas.waitForFunction(()=>
   (window.__mindEnemyRig?.active?.length===2||
    window.__mindArtStatus?.skeleton==='Blender 3D Atlas')&&
   window.__mindDiagnostics?.engine==='Phaser 3'&&
   window.__mindDiagnostics?.isPlaying,null,{timeout:40000});
  const candidate=await phaserCanvas.evaluate(async()=>{
   const game=window.__mindPhaserGame,scene=game.scene.scenes[0],
    p={calls:0,total:0,max:0},original=scene.renderAlley;
   scene.renderAlley=function(...args){
    const now=performance.now();
    try{return original.apply(this,args);}
    finally{const dt=performance.now()-now;p.calls++;p.total+=dt;p.max=Math.max(p.max,dt);}
   };
   const start=performance.now(),startGame=window.__mindDiagnostics.gameTime,frames=[];
   await new Promise(done=>{
    let last=start;
    function tick(now){
     frames.push(now-last);last=now;
     if(now-start>2400)done();else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
   });
   frames.sort((a,b)=>a-b);
   const sec=(performance.now()-start)/1000;
   return {fps:Math.round(frames.length/sec),
    p95FrameMs:Math.round(frames[Math.floor(frames.length*.95)]||0),
    gameSeconds:window.__mindDiagnostics.gameTime-startGame,wallSeconds:sec,
    alleyAvgMs:p.total/Math.max(1,p.calls),alleyMaxMs:p.max,renderCalls:p.calls,
    phaserType:game.renderer.type,glbRenders:window.__mindEnemyRig?.stats?.gpuRenders||0};
  });
  console.log('PHASER CANVAS A/B COMBAT:',JSON.stringify({...candidate,errors:candidateErrors}));
  await phaserCanvas.close();
  assert.equal(benchmark.engine,'Phaser 3');
  assert(benchmark.atlasRat,
   'Normal playtest must use baked dense-fur rat, not live WebGL skinning');
  if(benchmark.skeletonAtlas==='Blender 3D Atlas'){
   assert.equal(benchmark.gpuRenders,0,
    'Original 3D skeleton atlas must not cause in-combat WebGL readbacks');
  }else assert(benchmark.gameSeconds>=benchmark.seconds*.70,
   'When FPS collapses, live GLB fallback must not run in slow motion');
  assert(benchmark.gpuRenders<=Math.ceil(benchmark.seconds*40)+2,
   'Enemy GPU render budget must remain capped, not scale with enemy count');
  assert.equal(playErrors.length,0,
   'Real production playtest errors: '+playErrors.join('; '));
  // Long playtest: verify automatic downgrading reacts to sustained slow
  // software WebGL WITHOUT changing gameplay or requiring a page reload.
  await playtest.waitForTimeout(5200);
  const adapted=await playtest.evaluate(async()=>{
   const before=performance.now(),frames=[];
   await new Promise(done=>{
    let previous=before;
    function tick(t){
     frames.push(t-previous);previous=t;
     if(t-before>1900)done();else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
   });
   frames.sort((a,b)=>a-b);
   return {engine:window.__mindDiagnostics.engine,
    quality:window.__mindDiagnostics.guardianQuality,
    simulation:window.__mindDiagnostics.simulationMs,
    renderScale:window.__mindDiagnostics.resolutionScale,
    fps:Math.round(frames.length*1000/(performance.now()-before)),
    p95FrameMs:Math.round(frames[Math.floor(frames.length*.95)]||0)};
  });
  console.log('ADAPTIVE PLAYTEST FPS / RENDERER:',JSON.stringify(adapted));
  if(benchmark.sampledFps<20)
   assert(adapted.engine==='Canvas-Ersatzrenderer'||adapted.renderScale<1,
    'Sustained slow GPUs must trigger adaptive software/quality rendering');
  // Real right-click navigation: click a reachable target on-screen and
  // ensure the character keeps walking instead of taking two short steps.
  const clickProbe=await playtest.evaluate(()=>window.__mindDiagnostics.probeRightClick());
  assert(clickProbe&&clickProbe.distance>65,
   'Could not select a reachable right-click waypoint on the generated floor');
  await playtest.mouse.click(clickProbe.screenX,clickProbe.screenY,{button:'right'});
  await playtest.waitForFunction(({start,distance})=>{
   const state=window.__mindDiagnostics?.navigation;
   if(!state)return false;
   return Math.hypot(state.x-start.x,state.y-start.y)>=Math.min(75,distance*.72);
  },clickProbe,{timeout:18000});
  const reached=await playtest.evaluate(()=>window.__mindDiagnostics.navigation);
  assert(Math.hypot(reached.x-clickProbe.start.x,reached.y-clickProbe.start.y)>48,
   'A right-click must cause sustained movement across the room');
  // Continue until the click target is ACTUALLY reached, not just halfway:
  // an intermediate waypoint or an unlucky blocked frame must not finish it.
  await playtest.waitForFunction(({goal})=>{
   const move=window.__mindDiagnostics?.navigation;
   return move&&!move.active&&Math.hypot(move.x-goal.x,move.y-goal.y)<10;
  },clickProbe,{timeout:20000});
  const finalPosition=await playtest.evaluate(()=>window.__mindDiagnostics.navigation);
  console.log('RIGHT-CLICK DESTINATION REACHED:',JSON.stringify({
   goal:clickProbe.goal,position:finalPosition
  }));
  assert.equal(
   await playtest.evaluate(()=>document.querySelector('#modalWrap')?.style.display),
   'none','Right-click must keep the game active, not open the title');
  console.log('RIGHT-CLICK NAVIGATION PATH:',JSON.stringify({clickProbe,reached}));
  await playtest.close();
  // Compare actual alternate renderer under identical software-GPU hardware.
  // This is a diagnostic, not an automatic recommendation or fake 60fps.
  const canvasPage=await browser.newPage({viewport:{width:1100,height:800}});
  await canvasPage.goto(base+'?szene=gasse&modus=generator&seed=4148',
   {waitUntil:'domcontentloaded',timeout:45000});
  await canvasPage.waitForFunction(()=>
   window.__mindGuardianRig&&
   window.__mindDiagnostics?.engine==='Canvas-Ersatzrenderer'&&
   window.__mindDiagnostics?.isPlaying,
   null,{timeout:40000});
  const canvasSample=await canvasPage.evaluate(async()=>{
   const times=[],start=performance.now();
   await new Promise(done=>{
    let last=start;
    function tick(now){
     times.push(now-last);last=now;
     if(now-start>2100)done();else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
   });
   times.sort((a,b)=>a-b);
   return {engine:window.__mindDiagnostics.engine,
    fps:Math.round(times.length*1000/(performance.now()-start)),
    p95FrameMs:Math.round(times[Math.floor(times.length*.95)]||0),
    enemyCount:window.__mindDiagnostics.enemyCount,
    simulation:window.__mindDiagnostics.simulationMs,
    renderScale:window.__mindDiagnostics.resolutionScale,
    guardian:window.__mindDiagnostics.guardianQuality};
  });
  console.log('FAST DEFAULT 30 FPS ACCEPTANCE:',JSON.stringify(canvasSample));
  assert(canvasSample.fps>=30,
   'Default real gameplay must deliver at least 30 FPS on software Chromium');
  assert(canvasSample.guardian==='BAKED BLENDER ATLAS'&&canvasSample.renderScale<=.73,
   'Fast mode must preload the authentic Blender atlas before combat');
  await canvasPage.close();

  // End-to-end acceptance test for the user's actual workflow:
  // from the real title, press "Neueste Beta starten", enter gameplay.
  // Prior tests only checked a new cache token and missed a title-screen LOOP.
  const latestPage=await browser.newPage({viewport:{width:1100,height:800}});
  const updateErrors=[];
  latestPage.on('pageerror',error=>updateErrors.push(error.message));
  await latestPage.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await latestPage.waitForFunction(()=>
   window.__mindBuildId&&
   document.querySelector('#md-version-panel #md-version-load')&&
   window.DungeonVersion?.latestURL,
   null,{timeout:45000});
  const before=await latestPage.evaluate(()=>({
   build:window.__mindBuildId,
   action:document.querySelector('#md-version-load')?.textContent,
   latest:window.DungeonVersion.latestURL().href
  }));
  assert.equal(before.build.length,12);
  assert(before.action.includes('Neueste Beta starten'));
  assert(new URL(before.latest).searchParams.get('szene')==='gasse');
  await latestPage.locator('#md-version-load').click();
  await latestPage.waitForFunction(()=>
   window.__mindFreshToken&&
   window.__mindBuildId&&
   window.__mindDiagnostics?.isPlaying===true&&
   location.search.includes('szene=gasse')&&
   window.__mindArtStatus,
   null,{timeout:60000});
  const after=await latestPage.evaluate(()=>({
   token:window.__mindFreshToken,build:window.__mindBuildId,
   playing:window.__mindDiagnostics.isPlaying,
   scene:new URLSearchParams(location.search).get('szene'),
   mode:new URLSearchParams(location.search).get('modus'),
   engine:window.__mindDiagnostics.engine,
   overlay:document.querySelector('#modalWrap')?.style.display,
   art:window.__mindArtStatus
  }));
  assert.equal(after.build,before.build,
   'Refreshing identical deployed game code must preserve build ID');
  assert(after.token,'Latest entrypoint must bypass stale cached assets');
  assert.equal(after.playing,true,'Update button MUST start an actual game');
  assert.equal(after.scene,'gasse');
  assert.equal(after.mode,'generator');
  assert(after.overlay==='none'||
   latestPage.url().includes('szene=gasse'),'Game cannot be trapped in the title overlay');
  assert.deepEqual(updateErrors,[],'Entering updated Beta must have no JavaScript errors');
  console.log('LATEST BETA BUTTON ENTERED ACTIVE ISOMETRIC PLAYTEST:',JSON.stringify({before,after}));
  await latestPage.close();
 }finally{await browser.close();}
};
run().catch(err=>{console.error(err);process.exitCode=1;});
