// Loaded ONLY from beta/latest.html, ahead of all game assets.
// Applies a unique fetch/image revision to same-origin beta resources.
// It does not touch external CDN, cloud saves, POST, data: or blob: URLs.
(function(){
 'use strict';
 const token=new URL(document.currentScript.src).searchParams.get('fresh');
 if(!token)return;
 window.__mindFreshToken=token;
 const prefix=new URL('./',location.href).pathname;
 function fresh(input){
  if(typeof input!=='string'&&!(input instanceof URL))return input;
  const raw=String(input);
  try{
   const url=new URL(raw,document.baseURI);
   if(url.origin!==location.origin||!url.pathname.startsWith(prefix))return input;
   if(url.searchParams.get('__fresh')===token)return input;
   url.searchParams.set('__fresh',token);
   return url.href;
  }catch{return input;}
 }
 const original=window.fetch.bind(window);
 window.fetch=function(input,init){
  const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if(method!=='GET')return original(input,init);
  if(input instanceof Request){
   const url=fresh(input.url);
   return original(url===input.url?input:new Request(url,input),init);
  }
  return original(fresh(input),init);
 };
 const originalImage=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
 if(originalImage?.get&&originalImage?.set&&originalImage.configurable){
  Object.defineProperty(HTMLImageElement.prototype,'src',{
   enumerable:originalImage.enumerable,configurable:true,
   get:originalImage.get,
   set(value){return originalImage.set.call(this,fresh(value));}
  });
 }
})();
