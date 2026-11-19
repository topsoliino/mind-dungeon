window.DungeonController=(()=>{
 'use strict';
 const buttonIndex={a:0,b:1,x:2,y:3,rb:5,view:8,menu:9,lock:11,up:12,down:13,left:14,right:15};
 const directions=['up','down','left','right'];
 const deadzone=.22;
 function stick(axes,i){
  const x=axes[i]||0,y=axes[i+1]||0,length=Math.hypot(x,y);
  if(length<=deadzone)return {x:0,y:0};
  const scale=(Math.min(length,1)-deadzone)/((1-deadzone)*length);
  return {x:x*scale,y:y*scale};
 }
 function connectedPads(){
  try{return navigator.getGamepads?.()??[];}catch{return [];}
 }
 function create(getPads=connectedPads){
  let index=null,previous=new Set(),menuDirection=null,repeatAt=0;
  function reset(){index=null;previous=new Set();menuDirection=null;repeatAt=0;}
  function read(){
   const pads=Array.from(getPads());
   const supported=pad=>pad?.connected&&pad.mapping==='standard';
   const current=pads.find(pad=>pad?.index===index&&supported(pad));
   const pad=current??pads.find(supported);
   if(!pad){reset();return null;}
   const held=new Set(Object.keys(buttonIndex).filter(key=>pad.buttons[buttonIndex[key]]?.pressed));
   const pressed=new Set(current?[...held].filter(key=>!previous.has(key)):[]);
   const released=new Set(current?[...previous].filter(key=>!held.has(key)):[]);
   index=pad.index;previous=held;
   return {held,pressed,released,movement:stick(pad.axes,0),aim:stick(pad.axes,2),changed:!current};
  }
  function menuStep(state,now){
   const {x,y}=state.movement;
   const analog=Math.max(Math.abs(x),Math.abs(y))<.47?null:
    Math.abs(x)>Math.abs(y)?(x<0?'left':'right'):(y<0?'up':'down');
   const next=directions.find(key=>state.held.has(key))??analog;
   if(!next){menuDirection=null;return null;}
   if(next!==menuDirection){menuDirection=next;repeatAt=now+330;return next;}
   if(now<repeatAt)return null;
   repeatAt=now+125;return next;
  }
  return {read,reset,menuStep};
 }
 return {create};
})();
