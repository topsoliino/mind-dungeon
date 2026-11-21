// Browser-level verification using an emulated phone and the real Phaser/Canvas
// game. Run against a local HTTP server, not a file:// URL.
// npm install --no-save playwright && npx playwright install chromium
// python3 -m http.server 8765 & node tools/check-isometric-mobile-browser.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.MIND_DUNGEON_URL||'http://127.0.0.1:8765/beta/';
const url=base+'?szene=gasse&modus=generator&seed=4147&treppe=switchback&touch=1';
async function run(){
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({
   viewport:{width:390,height:844},deviceScaleFactor:1,
   isMobile:true,hasTouch:true
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.body.classList.contains('mobile-playing')&&
   document.querySelector('#mobile-stick')?.getBoundingClientRect().width>100,
   {timeout:90000});
  await page.waitForTimeout(1000);
  for(const selector of ['#mobile-stick','#attack','#mobileRoll','#mobileInteract','#mobileNav','#mobileSneak']){
   assert(await page.locator(selector).isVisible(),selector+' should be visible during play');
  }
  assert.equal(await page.locator('#dpad').isVisible(),false);
  assert.equal(await page.locator('#iso-gen-body').isVisible(),false,'generator map must start closed on phones');
  assert(await page.locator('#iso-gen-toggle').isVisible(),'small map launcher must remain available');
  await page.locator('#iso-gen-toggle').click();
  assert(await page.locator('#iso-gen-body').isVisible(),'mobile map can be opened on demand');
  await page.locator('#iso-gen-toggle').click();
  assert.equal(await page.locator('#iso-gen-body').isVisible(),false,'map closes before gameplay');
  const rect=await page.locator('#mobile-stick').boundingBox();
  assert(rect.x>=0&&rect.x+rect.width<390,'movement thumb stays on screen');
  const attack=await page.locator('#attack').boundingBox();
  assert(attack.x>=0&&attack.x+attack.width<=390,'attack button fits phone width');
  await page.evaluate(()=>{
   window.__touchDebug=[];
   for(const kind of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])
    document.querySelector('#mobile-stick').addEventListener(kind,e=>
     window.__touchDebug.push([kind,e.pointerId,e.pointerType,e.clientX,e.clientY]),{capture:true});
  });
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width*.82,rect.y+rect.height/2,{steps:3});
  const offset=await page.locator('#mobile-stick-thumb').evaluate(e=>e.style.transform);
  const debug=await page.evaluate(()=>window.__touchDebug);
  console.log('Joystick browser debug:',JSON.stringify({rect,offset,debug}));
  await page.screenshot({path:'mobile-isometric-preview.png'});
  assert(offset.includes('translate(')&&offset!=='translate(-50%,-50%)','stick follows a finger');
  await page.mouse.up();
  assert.equal((await page.locator('#mobile-stick-thumb').evaluate(e=>e.style.transform)).replace(/\s+/g,''),'translate(-50%,-50%)');
  await page.locator('#attack').click();
  await page.locator('#mobileRoll').click();
  await page.locator('#mobileSneak').click();
  assert.equal(await page.locator('#mobileSneak').getAttribute('aria-pressed'),'true');
  await page.locator('#mobileSneak').click();
  assert.equal(await page.locator('#mobileSneak').getAttribute('aria-pressed'),'false');
  await page.locator('#mobileNav').click();
  assert.equal(await page.locator('#mobile-stick').isVisible(),false,'controls should hide in menus');
  assert(await page.locator('#nav-close').isVisible());
  await page.locator('#nav-close').click();
  assert(await page.locator('#mobile-stick').isVisible(),'controls return after menu');
  await page.screenshot({path:'mobile-isometric-preview.png'});
  assert.equal(errors.length,0,'game threw browser errors: '+errors.join('; '));
  console.log('Mobile browser UI/controls/interaction/menu smoke OK',url);
  console.log('Screenshot mobile-isometric-preview.png');
  await page.close();
 }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
