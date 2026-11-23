/**
 * Standalone, zero-dependency visual math regressions for Room Atelier.
 *
 * node beta/room-editor/tests/uv-mapping.test.js
 *
 * Verifies that the wall source is a REAL Diffuse map, never a perspective
 * preview, that one floor atlas covers the entire room without restarted
 * tile patterns, and neighboring wall segments use adjacent source pixels.
 * Does not mutate any main game files.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/tiles/manifest.json'),'utf8'));
const ctxWindow={};
const ctx={window:ctxWindow,console,
 Image:class Img{
  constructor(){this.naturalWidth=4096;this.naturalHeight=4096;}
  set src(url){
   this.url=url;
   if(url.includes('wall-atlas'))this.naturalHeight=768;
   if(this.onload)this.onload();
  }
 },
 fetch:async(url)=>url.includes('manifest.json')?{ok:true,json:async()=>manifest}:{ok:false}
};
vm.runInNewContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),ctx,{filename:'catalog.js'});
vm.runInNewContext(fs.readFileSync(path.join(root,'editor-art.js'),'utf8'),ctx,{filename:'editor-art.js'});
function recordingContext(){
 return {calls:[],matrices:[],
  save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},
  transform(...m){this.matrices.push(m)},
  drawImage(...a){this.calls.push(a)},
  fillRect(){},
 };
}
async function main(){
 // The loader awaits fetch+json and all six image onloads.
 for(let i=0;i<15;i++)await Promise.resolve();
 assert.equal(manifest.schema,'mind-dungeon-room-tiles/v6');
 assert.equal(manifest.textureMode,'uv-ready-polyhaven-diffuse');
 const floorStyles=Object.keys(ctxWindow.MindRoomKit.catalog.floors).sort();
 const wallStyles=Object.entries(ctxWindow.MindRoomKit.catalog.walls)
   .filter(([style,spec])=>spec.render==='photo-wall-map')
   .map(([style])=>style).sort();
 // A previous build accidentally exported the wall materials inside
 // floorVariants and left wallVariants empty; this caused ALL six UI images
 // to stay gray (0/3 floors, 0/3 walls). Test both category partitions.
 assert.deepEqual(Object.keys(manifest.floorVariants).sort(),floorStyles,
   'floorVariants must contain only the three floor styles');
 assert.deepEqual(Object.keys(manifest.wallVariants).sort(),wallStyles,
   'wallVariants must contain all three wall styles');
 assert.deepEqual(Object.keys(manifest.floorAtlases).sort(),floorStyles);
 assert.deepEqual(Object.keys(manifest.wallAtlases).sort(),wallStyles);
 const art=ctxWindow.MindRoomArt,status=art.status();
 assert.match(status.tiles,/^3\/3/);
 assert.match(status.wallPhotos,/^3\/3/);
 const geo=(x,y)=>({x:(x-y)*42,y:(x+y)*42/Math.sqrt(3)});
 for(const style of Object.keys(ctxWindow.MindRoomKit.catalog.floors)){
  const s=ctxWindow.MindRoomKit.catalog.floors[style];
  const info=manifest.assetInfo[style],atlas=manifest.atlasInfo[style];
  assert.ok(info.file.startsWith('floor-albedo-'));
  assert.equal(info.textureRole,'Diffuse/albedo, flat UV ready');
  assert.equal(s.worldWidth,info.worldWidth);
  assert.equal(atlas.worldWidth,30);
  for(const [w,h] of [[4,4],[7,5],[30,30]]){
   const c=recordingContext();
   assert.equal(art.drawRoomFloor(c,{floorStyle:style,width:w,height:h},geo),true);
   assert.equal(c.calls.length,1,'one atlas draw, not repeated tile blits');
   assert.deepEqual(c.calls[0].slice(-4),[(w-30)/2,(h-30)/2,30,30]);
   const basis=c.matrices[0];
   assert.ok(Math.abs(basis[0]-42)<.001);
   assert.ok(Math.abs(basis[2]+42)<.001);
  }
 }
 for(const style of Object.keys(ctxWindow.MindRoomKit.catalog.walls).filter(k=>ctxWindow.MindRoomKit.catalog.walls[k].render==='photo-wall-map')){
  const info=manifest.assetInfo[style],atlas=manifest.atlasInfo[style];
  assert.equal(info.textureRole,'Diffuse/albedo, flat UV ready');
  assert.equal(info.worldWidth,ctxWindow.MindRoomKit.catalog.walls[style].worldWidth);
  assert.equal(atlas.worldWidth,30);
  assert.equal(atlas.worldHeight,2);
  for(const [dx,dy] of [[42,24.25],[-42,24.25]]){
   const a=recordingContext(),b=recordingContext();
   for(const [pos,c] of [[5,a],[6,b]]){
    art.drawWallFace(c,style,{x:0,y:0},{x:dx,y:dy},
      {x:0,y:84},{x:dx,y:dy+84},pos,2);
   }
   assert.equal(a.calls.length,1);
   assert.equal(b.calls.length,1);
   assert.ok(Math.abs(a.calls[0][3]-(4096/30))<.001);
   assert.ok(Math.abs(b.calls[0][1]-a.calls[0][1]-4096/30)<.001,
     'neighbors must read exactly adjacent world ranges');
   assert.deepEqual(a.matrices[0].slice(0,4),[dx,dy,0,84],
     'wall height must be SCREEN VERTICAL, not aligned to the floor plane');
  }
 }
 console.log('Room Atelier UV mapping OK: 3 floors and 3 vertical walls, no runtime repeating tiles');
}
main().catch(error=>{console.error(error);process.exitCode=1});
