window.DungeonLoading = (() => {
 'use strict';
 const files = new URL('assets/', document.currentScript.src);
 const overlay = document.querySelector('#dungeon-loading');
 const stage = overlay.querySelector('[data-stage]');
 const hint = overlay.querySelector('[data-tip]');
 const saveKey = 'mind-dungeon-shadowbound-beta-v08';
 const artKey = saveKey+'-loading-art';
 const artworks = ['jungle','cemetery'];
 const tips = [
  'Du bist während eines Dashes unverwundbar. Sobald er endet, kannst du wieder getroffen werden.',
  'Warte den Angriff eines Gegners ab. Ein aufgeladener Konter in seiner Erholungsphase verursacht vierfachen Schaden.',
  'Vorgemerkte Mahlzeiten isst du nach dem Schließen des Inventars. Mit Q verwendest du den aktiven Schnellplatz.',
  'Im Ruheraum erklärt das Lesepult rechts vom Feuer die Attribute. Sprich es mit E an.',
  'Mit steigender Traglast wird dein Dash langsamer oder kürzer. Dein eigenes Limit siehst du im Charakterstatus.',
  'Bei Regen verursachen Flammen im Freien weniger Schaden. Blitz und Frost behalten ihre Wirkung.',
  'Am Wissensaltar kannst du zwei Fragen beantworten. Richtige Antworten bringen Erfahrungspunkte.',
  'Mit Umschalt + Q wechselst du den Schnellplatz. Tränke und Nahrung kannst du mit Q verwenden.'
 ];
 let art = artworks[Math.floor(Math.random()*artworks.length)],resume = false, muted = false;
 try {
  resume = sessionStorage.getItem(saveKey+'-resume') === '1';
  const chosen = sessionStorage.getItem(artKey);
  if (artworks.includes(chosen)) art = chosen;
  sessionStorage.removeItem(artKey);
  const settings = JSON.parse(localStorage.getItem(saveKey+'-settings') || '{}');
  muted = (settings?.musicVolume ?? settings?.soundVolume) === 0;
 } catch {}
 function show(theme, label) {
  overlay.style.setProperty('--loading-art', 'url("'+new URL('loading-'+theme+'.webp',files)+'")');
  stage.textContent = label;
  hint.textContent = tips[Math.floor(Math.random()*tips.length)];
  overlay.hidden = false;
 }
 show(art, resume?'Dungeon wird vorbereitet':'Mind Dungeon wird geladen');
 const title = new Image();
 const titleReady = !resume ? new Promise(resolve => {
  title.onerror = resolve;
  title.onload = () => Promise.resolve(title.decode?.()).catch(() => {}).then(resolve);
  title.src = new URL('shadowbound-title.webp',files);
 }) : Promise.resolve();
 let titleMusic = Promise.resolve();
 function prepareTitle(audio) {
  if(!resume&&!muted)titleMusic=audio?.prepareMusic('title')??titleMusic;
 }
 async function ready(finish,gameReady) {
  stage.textContent=resume?'Dungeon wird vorbereitet':'Titelbild und Musik werden vorbereitet';
  let deadline;
  await Promise.race([Promise.allSettled([titleReady,titleMusic,gameReady]),new Promise(resolve=>{deadline=setTimeout(resolve,9500);})]);
  clearTimeout(deadline);
  requestAnimationFrame(()=>{
   finish();
   overlay.hidden=true;
  });
 }
 function transition(depth) {
  const theme=artworks[(depth+1)%artworks.length];
  try {sessionStorage.setItem(artKey,theme);} catch {}
  show(theme,'Tiefe '+depth+' wird vorbereitet');
 }
 return {ready,prepareTitle,transition};
})();
