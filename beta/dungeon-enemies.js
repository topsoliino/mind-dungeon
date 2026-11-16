window.DungeonEnemies = (() => {
 'use strict';
 const attacks=[
  {id:'charge',range:220,windup:.68,recovery:.45,color:'#d9ac70',speed:56},
  {id:'rift',range:190,windup:.58,recovery:.38,color:'#c18add',speed:63},
  {id:'web',range:285,windup:.48,recovery:.48,color:'#e6d9c5',speed:80},
  {id:'reap',range:112,windup:.59,recovery:.44,color:'#e6ae8a',speed:52},
  {id:'frost',range:260,windup:.82,recovery:.62,color:'#9ce6ff',speed:45},
  {id:'grab',range:100,windup:.64,recovery:.50,color:'#b7a270',speed:46},
  {id:'bite',range:45,windup:.26,recovery:.36,color:'#d0b179',speed:117},
  {id:'bow',range:285,windup:.64,recovery:.54,color:'#e9d5a5',speed:48},
  {id:'crossbow',range:315,windup:.86,recovery:.73,color:'#beac7d',speed:40}
 ];
 const depthFactor=depth=>1.5**Math.max(0,depth-1);
 function health(type,boss,depth,variant){
  const heavy=type===0||type===5||type===8;
  const original=variant==='ambush'?85:type===6?29:type===2?87:heavy?132:108;
  const base=boss?Math.round(original*1.4)+(heavy?400:320):original+(heavy?240:200);
  return Math.round(base*depthFactor(depth));
 }
 function resistances(profile,depth){
  return Object.fromEntries(Object.entries(profile).map(([type,base])=>[
   type,base>0&&base<1?Math.min(.9,base*depthFactor(depth)):base
  ]));
 }
 function turn(angle,target,limit){
  const difference=Math.atan2(Math.sin(target-angle),Math.cos(target-angle));
  return angle+Math.max(-limit,Math.min(limit,difference));
 }
 // Sprite frames 0–3 walk, 4–7 anticipate, 8–11 attack, 12–15 recover.
 function spriteFrame(e){
  const a=attacks[e.type];
  if(e.runAttack>0)return 8+Math.min(3,Math.floor((1-e.runAttack/e.runDuration)*4));
  if(e.windup>0)return 4+Math.min(3,Math.floor((1-e.windup/a.windup)*4));
  if(e.recover>0)return 12+Math.min(3,Math.floor((1-e.recover/a.recovery)*4));
  return Math.floor(e.phase*(e.moving?11:3))%4;
 }
 const PRIEST=1,ZOMBIE=5,SNAKE=6,ARCHER=7,CROSSBOW=8;
 return {attacks,depthFactor,health,resistances,turn,spriteFrame,PRIEST,ZOMBIE,SNAKE,ARCHER,CROSSBOW};
})();
