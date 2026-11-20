// Repro: node tools/check-isometric-occlusion.cjs
// Runs geometry, painter order and transparency checks without a browser or GPU.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..','beta',p),'utf8');
const modules=['alley-study-map.js','alley-generator.js','alley-route.js',
 'alley-architecture.js','alley-study.js'];
const noop=()=>{};
function fakeContext(){
 return new Proxy({
  createLinearGradient:()=>({addColorStop:noop}),
  createRadialGradient:()=>({addColorStop:noop}),
  measureText:()=>({width:10})
 },{get:(t,p)=>p in t?t[p]:noop,set(t,p,v){t[p]=v;return true;}});
}
const document={
 currentScript:{src:'https://example.org/beta/alley-architecture.js'},
 createElement(type){
  assert.equal(type,'canvas');
  return {width:0,height:0,getContext:fakeContext};
 }
};
class Image {set src(v){this._src=v;}}
function environment(seed){
 const window={location:{search:'?szene=gasse&modus=generator&seed='+seed}};
 const env=vm.createContext({window,document,Image,URL,URLSearchParams,Math});
 for(const file of modules)vm.runInContext(read(file),env,{filename:file});
 return {generator:window.AlleyGenerator,art:window.AlleyStudy,scene:window.AlleyStudy.create()};
}
let withTransparency=0,multipleWalls=0,constantDepth=0,behindOpaque=0;
for(const seed of [4147,18,82]){
 const {generator,art,scene}=environment(seed);
 assert(generator.walls.every(w=>w.height===96),'every wall has same cut plane');
 const [a,b]=[scene.structures(500,500),scene.structures(1400,900)];
 assert.equal(a.length,b.length);
 assert(a.every((layer,i)=>layer.depth===b[i].depth),
  'architecture depth cannot depend on actor position');
 constantDepth+=a.length;
 assert(art.width>=2400&&art.height>=1500,'expanded room canvas must fit entire layout');
 const ground=scene.groundLayers(),overlay=scene.overlayLayers();
 assert(ground.length>4,'GPU floor tiles must be split into chunks');
 assert(ground.every(l=>l.canvas.width<=1536&&l.canvas.height<=1536));
 assert(overlay.every(l=>l.canvas.width<=1536&&l.canvas.height<=1536));
 for(const room of generator.rooms.slice(1))for(const [u,v] of room.cells){
  const [x,y]=art.project(u+.5,v+.5),heroY=y-art.footOffset;
  const structures=scene.structures(x,heroY),faded=structures.filter(s=>s.alpha<.99);
  if(faded.length)withTransparency++;
  if(faded.length>=2)multipleWalls++;
  assert(structures.every(s=>s.alpha===1||s.alpha===.24),
   'occlusion opacity is a predictable constant, never an invalid value');
  behindOpaque+=structures.filter(s=>s.depth<=heroY-2&&s.alpha===1).length;
 }
}
assert(withTransparency>50,'foreground wall fade should actually occur');
assert(multipleWalls>20,'several wall panels must be able to fade at once');
assert(behindOpaque>100,'rear structures should stay opaque');
console.log('Wall depth static on '+constantDepth+' layer samples; '+withTransparency+
 ' actor positions with occlusion and '+multipleWalls+' simultaneous multi-wall fades.');
