// Fast, dependency-free regression for the public update flow.
// Run from repo root: node tools/check-beta-version.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const html=read('beta/index.html');
const root=read('index.html');
const latest=read('beta/latest.html');
const version=read('beta/dungeon-version.js');
const fresh=read('beta/dungeon-fresh-assets.js');
assert(root.includes('id="md-play-latest"'));
assert(root.includes("new URL('beta/latest.html',location.href)"));
assert(html.includes('beta/dungeon-version.js?v=1'));
assert(html.includes("DungeonVersion?.registerSource(document.currentScript?.textContent||'')"));
assert(html.includes('window.DungeonVersion.panel()'));
assert.equal((html.match(/window.DungeonVersion.attach\(/g)||[]).length,4,
 'Update control must work on regular title, alley title, boss title and pause screen');
assert(latest.includes("fetch(url,{cache:'no-store'})"));
assert(latest.includes("playURL.searchParams.set('szene','gasse')"));
assert(latest.includes("history.replaceState(history.state,'',playURL.href)"));
assert(version.includes('Neueste Beta starten'));
assert(latest.includes('beta/dungeon-fresh-assets.js?fresh='));
assert(latest.includes('document.open()')&&latest.includes('document.write(html)'));
assert(fresh.includes('HTMLImageElement.prototype')&&fresh.includes('window.fetch=function'));
const context={window:{},document:{baseURI:'https://example.org/mind-dungeon/'},location:{
 search:'?szene=gasse&seed=4148&tracking=private',href:'https://example.org/mind-dungeon/beta/'
},URL,URLSearchParams,Date,console};
vm.runInNewContext(version,context);
const u=context.window.DungeonVersion;
const source=u.gameScript(html);
assert(source.includes('function mdTitle()'));
assert.equal(u.safeHash(source),u.safeHash(source));
const url=u.latestURL();
assert.equal(url.pathname,'/mind-dungeon/beta/latest.html');
assert.equal(url.searchParams.get('szene'),'gasse');
assert.equal(url.searchParams.get('seed'),'4148');
assert(!url.searchParams.has('tracking'));
context.location.search='';
const defaultPlay=u.latestURL();
assert.equal(defaultPlay.searchParams.get('szene'),'gasse');
assert.equal(defaultPlay.searchParams.get('modus'),'generator');
u.registerSource(source);
assert.equal(context.window.__mindBuildId.length,12);
assert.notEqual(u.safeHash(source),u.safeHash(source+'updated'));
assert.equal(u.safeHash(source),u.safeHash(source.replace(
 "dungeon-enemy-rig.js?v=17","dungeon-enemy-rig.js?v=17&__fresh=abc123"
)));
(async()=>{
 let written='',option;
 const bootCode=latest.slice(latest.indexOf('<script>')+8,latest.lastIndexOf('</script>'));
 const result=vm.runInNewContext(bootCode,{
  document:{
   getElementById:()=>({textContent:''}),
   open(){},write(value){written=value;},close(){}
  },
  fetch:async (url,opts)=>{option=opts;assert(String(url).includes('__md_latest='));return{
   ok:true,text:async()=>html
  }},
  location:{href:'https://example.org/mind-dungeon/beta/latest.html'},
  history:{state:null,replaceState(_state,_title,url){
   assert(String(url).includes('szene=gasse'));
   assert(String(url).includes('modus=generator'));
  }},
  URL,Date,console
 });
 await result;
 assert.equal(option.cache,'no-store');
 assert(written.includes('beta/dungeon-fresh-assets.js?fresh='));
 assert(written.includes('beta/dungeon-version.js?v=1&__fresh='));
 assert(/beta\/dungeon-guardian\.js\?v=\d+&__fresh=/.test(written));
 assert(written.includes('function mdTitle()'));
 // Test the injected fetch and image bypass against same-origin beta only.
 const scriptUrl='https://example.org/mind-dungeon/beta/dungeon-fresh-assets.js?fresh=xyz';
 let seen=[];
 class MockImage {}
 let imgSrc='';
 Object.defineProperty(MockImage.prototype,'src',{
  configurable:true,
  get(){return imgSrc},
  set(v){imgSrc=v}
 });
 class MockRequest{constructor(url,request){this.url=url;this.method=request?.method||'GET';}}
 const fetchContext={
  document:{currentScript:{src:scriptUrl},baseURI:'https://example.org/mind-dungeon/'},
  location:{href:'https://example.org/mind-dungeon/beta/latest.html',
   origin:'https://example.org'},
  window:{fetch:(value,init)=>{seen.push({value,init});return Promise.resolve({ok:true})}},
  URL,Request:MockRequest,HTMLImageElement:MockImage
 };
 vm.runInNewContext(fresh,fetchContext);
 await fetchContext.window.fetch('beta/art/skeleton/skeleton-live.json?v=11');
 assert(String(seen.at(-1).value).includes('__fresh=xyz'));
 await fetchContext.window.fetch('https://cdn.example.net/three.js');
 assert.equal(seen.at(-1).value,'https://cdn.example.net/three.js');
 await fetchContext.window.fetch('beta/save',{method:'POST'});
 assert.equal(seen.at(-1).value,'beta/save');
 const img=new MockImage();
 img.src='beta/art/skeleton/sabre-run.webp?v=9';
 assert(img.src.includes('__fresh=xyz'));
 console.log('Latest beta update button, source-build identity, no-store HTML and asset cache bypass: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
