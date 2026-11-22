// Mind Dungeon update panel. The code ID is derived from the actual loaded
// game script, not a hard-coded version number that can silently go stale.
(function(root){
 'use strict';
 const mdBase=()=>new URL('beta/',document.baseURI);
 const safeHash=source=>{
  // beta/latest.html adds a unique resource query inside the loaded game
  // script. Ignore ONLY that injected token when comparing source versions.
  const text=String(source).replace(/&__fresh=[a-z0-9]+/g,'');
  let h=2166136261>>>0,g=0x9e3779b9>>>0;
  for(let i=0;i<text.length;i++){
   const c=text.charCodeAt(i);
   h=Math.imul(h^c,16777619)>>>0;
   g=Math.imul(g+c+(g<<6)+(g>>>2),0x85ebca6b)>>>0;
  }
  return h.toString(16).padStart(8,'0')+g.toString(16).padStart(8,'0').slice(0,4);
 };
 let activeSource='',activeId='unbekannt';
 function registerSource(source){
  activeSource=String(source||'');
  activeId=activeSource?safeHash(activeSource):'unbekannt';
  root.__mindBuildId=activeId;
 }
 function versionInfo(){
  return 'Beta v0.8 · Build '+activeId;
 }
 // Deliberately inspect the FINAL embedded game script, not the 30+ small
 // helper scripts, so a cached browser page can be compared with Pages.
 function gameScript(html){
  const start=html.lastIndexOf('<script>');
  const end=start<0?-1:html.indexOf('</script>',start);
  const source=start<0||end<0?'':html.slice(start+8,end);
  if(!source.includes('function mdTitle()'))throw Error('Spielversion nicht lesbar');
  return source;
 }
 function panel(){
  return '<section class="md-version-panel" id="md-version-panel" aria-label="Spielversion und Updates">'+
   '<div class="md-version-label">AKTUELLE TESTVERSION <span id="md-version-local">Build wird erkannt …</span></div>'+
   '<p class="md-version-status" role="status" id="md-version-status">Online-Stand wird geprüft …</p>'+
   '<div class="md-version-actions">'+
   '<button type="button" id="md-version-check">Updates prüfen</button>'+
   '<button type="button" class="primary" id="md-version-load">↻ Neueste Beta laden</button></div>'+
   '<small>Neueste Spielskripte, Skelette und Animationen frisch laden; Spielstände bleiben erhalten.</small>'+
   '</section>';
 }
 function latestURL(){
  const target=new URL('beta/latest.html',document.baseURI);
  const query=new URLSearchParams(location.search);
  // Keep requested world/seed/render mode. Never forward OAuth fragments,
  // auth tokens, or unrelated tracking parameters to the game.
  for(const key of ['szene','modus','seed','boss-test','renderer','debug-art','enemy3d']){
   if(query.has(key))target.searchParams.set(key,query.get(key));
  }
  return target;
 }
 function loadLatest(beforeNavigate){
  if(beforeNavigate&&beforeNavigate()===false)return;
  location.assign(latestURL().href);
 }
 async function check(panelRoot){
  const status=panelRoot?.querySelector('#md-version-status');
  const local=panelRoot?.querySelector('#md-version-local');
  const button=panelRoot?.querySelector('#md-version-check');
  if(local)local.textContent='Build '+activeId;
  if(!status)return;
  status.textContent='Prüfe den veröffentlichten Spielcode …';
  if(button)button.disabled=true;
  try{
   const url=new URL('beta/index.html',document.baseURI);
   url.searchParams.set('__md_version_check',String(Date.now()));
   const response=await fetch(url,{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const serverId=safeHash(gameScript(await response.text()));
   if(!status.isConnected)return;
   const prefix=activeId===serverId?
    'Spielcode aktuell':'Update gefunden';
   status.textContent=prefix+' · Browser '+activeId+' · Online '+serverId;
   status.dataset.state=activeId===serverId?'current':'update';
   // Artwork may be newer even if this HTML has not changed. Display the
   // authoritative Blender asset manifest from the live deployed site.
   const manifest=new URL('beta/art/skeleton/skeleton-live.json',document.baseURI);
   manifest.searchParams.set('__md_version_check',String(Date.now()));
   const assetResponse=await fetch(manifest,{cache:'no-store'});
   if(assetResponse.ok&&status.isConnected){
    const art=await assetResponse.json();
    const artBuild=String(art?.sabre?.artStyle||'').match(/v\d+$/)?.[0];
    if(artBuild)status.textContent+=' · Skelette: '+artBuild;
   }
  }catch(error){
   if(status.isConnected){
    status.textContent='Online-Stand gerade nicht prüfbar. „Neueste Beta laden“ versucht es erneut.';
    status.dataset.state='error';
   }
  }finally{if(button?.isConnected)button.disabled=false;}
 }
 function attach(onBeforeNavigate){
  const section=document.querySelector('#md-version-panel');
  if(!section)return;
  const button=section.querySelector('#md-version-load');
  const checkButton=section.querySelector('#md-version-check');
  if(button)button.onclick=()=>loadLatest(onBeforeNavigate);
  if(checkButton)checkButton.onclick=()=>void check(section);
  void check(section);
 }
 root.DungeonVersion={registerSource,versionInfo,panel,attach,loadLatest,latestURL,safeHash,gameScript};
})(window);
