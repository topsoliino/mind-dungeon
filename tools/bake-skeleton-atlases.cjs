// Offline: bake all existing Guardian-derived skinned Blender skeleton clips
// into independent 32-direction WebP atlases in Chromium. No procedural model.
// Run after serving the repository root via python3 -m http.server 8765.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const output=path.join(root,'beta/art/skeleton');
const rigs=JSON.parse(fs.readFileSync(path.join(output,'skeleton-live.json'),'utf8'));
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',err=>console.error('BLENDER ATLAS PAGE ERROR:',err.message));
  await page.goto('http://127.0.0.1:8765/tools/bake-skeleton-atlases.html',
   {waitUntil:'load',timeout:45000});
  await page.waitForFunction(()=>typeof window.__mindBakeSkeletonAtlas==='function',
   null,{timeout:45000});
  const atlas={version:1,source:{},cell:112,views:32,
   groundFraction:{},clips:{}};
  for(const kind of ['sabre','bow']){
   atlas.source[kind]=rigs[kind].sourceBlendSha256;
   atlas.clips[kind]={};
   const clips=Object.keys(rigs[kind].clips);
   for(const clip of clips){
    const frames=clip==='idle'||clip==='run'?8:
     clip==='combo'||clip==='double-shoot'?12:10;
    const start=Date.now();
    const rendered=await page.evaluate(async args=>
     window.__mindBakeSkeletonAtlas(args.kind,args.clip,
      {cell:args.cell,views:32,frames:args.frames}),
     {kind,clip,cell:atlas.cell,frames});
    if(rendered.sourceBlendSha256!==rigs[kind].sourceBlendSha256||
       rendered.nonempty<30)
     throw Error('Stale/invisible original Blender source: '+kind+':'+clip);
    const bytes=Buffer.from(rendered.data.split(',')[1],'base64');
    if(bytes.length<1200||bytes.length>12_000_000)
     throw Error('Invalid WebP file '+kind+':'+clip);
    const name='atlas-'+kind+'-'+clip+'.webp';
    fs.writeFileSync(path.join(output,name),bytes);
    atlas.clips[kind][clip]=frames;
    atlas.groundFraction[kind]=rendered.groundFraction;
    console.log('Blender '+kind+'/'+clip+' -> '+bytes.length+
     ' bytes, 32x'+frames+' real 3D poses, '+(Date.now()-start)+'ms');
   }
  }
  await page.evaluate(()=>window.__mindCloseSkeletonBakers());
  fs.writeFileSync(path.join(output,'skeleton-atlas.json'),
   JSON.stringify(atlas,null,2)+'\n');
  console.log('Baked '+Object.values(atlas.clips)
   .reduce((n,clips)=>n+Object.keys(clips).length,0)+
   ' original Blender animation atlases.');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
