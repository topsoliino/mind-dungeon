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
  {id:'crossbow',range:315,windup:.86,recovery:.73,color:'#beac7d',speed:40},
  {id:'lion',range:160,windup:.55,recovery:.68,color:'#e9be7a',speed:110},
  {id:'lioness',range:170,windup:.43,recovery:.57,color:'#efd496',speed:123},
  {id:'bat-fire',range:195,windup:.85,recovery:.75,color:'#f3a269',speed:160},
  {id:'bat-lightning',range:240,windup:1.02,recovery:.92,color:'#e6d68d',speed:151}
 ];
 const depthFactor=depth=>1.5**Math.max(0,depth-1);
 const profiles=[
  {hp:140,balance:67,sight:.47}, // Anstürmer
  {hp:110,balance:44,sight:.59}, // Priester
  {hp:72,balance:36,sight:.38}, // Spinne
  {hp:100,balance:49,sight:.51}, // Skelett
  {hp:125,balance:58,sight:.65}, // Frostgeist
  {hp:135,balance:54,sight:.25}, // Zombie
  {hp:60,balance:24,sight:.34}, // Schlange
  {hp:90,balance:39,sight:.75}, // Bogen
  {hp:120,balance:46,sight:.68}, // Armbrust
  {hp:140,balance:60,sight:.58}, {hp:112,balance:47,sight:.60},
  {hp:31,balance:16,sight:.63},{hp:35,balance:18,sight:.67}
 ];
 function health(type,boss,depth){
  return Math.round((profiles[type].hp+(type>=BAT?14:50)*Math.max(0,depth-1))*(boss?1.5:1));
 }
 function eyeRange(type,boss,width,height,angle){
  const dx=Math.cos(angle)/Math.max(width,1),dy=Math.sin(angle)/Math.max(height,1);
  return Math.min(.75,profiles[type].sight+(boss?.07:0))/Math.hypot(dx,dy);
 }
 const balance=(type,boss)=>profiles[type].balance+(boss?14:0);
 function knockbackDistance(impact,stability){
  const difference=impact-stability;
  if(difference>=30)return 22;
  if(difference>0)return 9;
  if(difference>=-20)return 4;
  return 0;
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
 const PRIEST=1,ZOMBIE=5,SNAKE=6,ARCHER=7,CROSSBOW=8,LION=9,LIONESS=10,BAT=11,STORM_BAT=12;
 return {attacks,depthFactor,health,eyeRange,balance,knockbackDistance,resistances,turn,spriteFrame,PRIEST,ZOMBIE,SNAKE,ARCHER,CROSSBOW,LION,LIONESS,BAT,STORM_BAT};
})();
