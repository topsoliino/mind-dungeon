window.DungeonAuthority=(()=>{
 'use strict';
 const local=['localhost','127.0.0.1'].includes(location.hostname);
 const origin=window.MindDungeonCoopOrigin||(local?location.protocol+'//'+location.hostname+':8787':'');
 let warming=null,readyAt=0;
 const protocol=1;
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function warm(){
  if(!origin)return Promise.reject(new Error('Der Gameserver ist noch nicht eingerichtet.'));
  if(readyAt&&Date.now()-readyAt<45000)return Promise.resolve();
  if(warming)return warming;
  warming=(async()=>{
   const elapsed=Date.now()+95000;
   while(Date.now()<elapsed){
    try{
     const response=await fetch(origin+'/healthz',{cache:'no-store',signal:AbortSignal.timeout(14000)});
     const body=response.ok?await response.json():null;
     if(body?.ready===true&&body.service==='mind-dungeon-coop'&&body.protocol===protocol){readyAt=Date.now();return;}
    }catch{}
    if(Date.now()<elapsed)await delay(2000);
   }
   throw new Error('Der Gameserver ist gerade nicht erreichbar.');
  })().finally(()=>warming=null);
  return warming;
 }
 function connection({token,onLobby,onFrame,onStatus,onEnded}){
  let ws=null,authenticated=false,opening=null,closed=false,sequence=0,bound=null,retry=null,tries=0,authAt=0;
  const requests=new Map();
  let lastLobby=null;
  const encoded=(value)=>JSON.stringify(value);
  function send(message){
   if(!authenticated||ws?.readyState!==WebSocket.OPEN||ws.bufferedAmount>16000)return false;
   ws.send(encoded(message));return true;
  }
  function request(type,fields={},socket=ws){
   if(socket?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('Verbindung wird aufgebaut …'));
   const id=++sequence;
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{requests.delete(id);reject(new Error('Der Server antwortet gerade nicht.'));},14000);
    requests.set(id,{resolve,reject,timer,socket});
    socket.send(encoded({type,id,...fields}));
   });
  }
  function resetRequests(socket){
   for(const [id,entry] of requests)if(entry.socket===socket){
    requests.delete(id);clearTimeout(entry.timer);entry.reject(new Error('Die Verbindung wurde unterbrochen.'));
   }
  }
  function open(){
   if(closed)return Promise.reject(new Error('Verbindung wurde beendet.'));
   if(authenticated&&ws?.readyState===WebSocket.OPEN)return Promise.resolve();
   if(opening)return opening;
   opening=(async()=>{
    onStatus?.('Gameserver wird gestartet …');
    await warm();
    if(closed)throw new Error('Verbindung wurde beendet.');
    const url=new URL('/coop',origin);
    url.protocol=url.protocol==='https:'?'wss:':'ws:';
    const socket=ws=new WebSocket(url);
    await new Promise((resolve,reject)=>{
     const timeout=setTimeout(()=>{socket.close();reject(new Error('Verbindung zum Gameserver ist fehlgeschlagen.'));},9000);
     socket.onopen=()=>{clearTimeout(timeout);resolve();};
     socket.onerror=()=>{clearTimeout(timeout);reject(new Error('Verbindung zum Gameserver ist fehlgeschlagen.'));};
     socket.onclose=()=>{clearTimeout(timeout);reject(new Error('Verbindung zum Gameserver wurde geschlossen.'));};
    });
    socket.onmessage=event=>{
     let packet;try{packet=JSON.parse(event.data);}catch{return;}
     if(packet.type==='reply'){
      const entry=requests.get(packet.id);if(entry?.socket!==socket)return;
      requests.delete(packet.id);clearTimeout(entry.timer);
      if(packet.ok)entry.resolve(packet.data);else entry.reject(new Error(packet.message));
     }else if(packet.type==='lobby'){lastLobby=packet;onLobby?.(packet);}
     else if(packet.type==='frame')onFrame?.(packet);
     else if(packet.type==='ended'){bound=null;onEnded?.(packet.message);}
    };
    socket.onclose=event=>{
     if(ws!==socket)return;
     resetRequests(socket);ws=null;authenticated=false;readyAt=0;
     if(closed)return;
     if(event.code===4002){bound=null;onEnded?.('Die Lobby wurde in einem anderen Tab geöffnet.');return;}
     onStatus?.('Verbindung unterbrochen · verbinde erneut');
     scheduleRetry();
    };
    try{
     await request('auth',{token:await token()},socket);
     authenticated=true;authAt=Date.now();
     if(bound)await request('resume',{code:bound},socket);
     tries=0;onStatus?.('Verbunden');
    }catch(error){
     if(/nicht mehr verfügbar|gehört einem anderen Konto/.test(error.message)){bound=null;onEnded?.(error.message);}
     socket.close();throw error;
    }
   })().finally(()=>opening=null);
   return opening;
  }
  function scheduleRetry(){
   if(closed||!bound||retry)return;
   retry=setTimeout(()=>{
    retry=null;
    open().catch(()=>scheduleRetry());
   },Math.min(1500*2**Math.min(tries++,3),10000));
  }
  async function call(kind,fields={}){
   await open();
   if(Date.now()-authAt>240000){await request('auth',{token:await token()});authAt=Date.now();}
   const response=await request(kind,fields);
   if(['create','join','resume'].includes(kind)&&response?.code)bound=response.code;
   if(kind==='leave')bound=null;
   return response;
  }
  return {call,send,get lobby(){return lastLobby;},
   async resume(code){bound=code;try{await open();return lastLobby;}catch(error){scheduleRetry();throw error;}},
   stop(){closed=true;clearTimeout(retry);bound=null;const socket=ws;ws=null;if(socket){resetRequests(socket);socket.close();}}
  };
 }
 const motionKeys=['x','y','dir','walk','weaponSide','moving','back','attack','attackDuration','dash','lift','charge','pose','hp','max','stamina','maxStamina','combat','inv','bleed','webSlow','grabSlow','poison','dominant','ack','brewTime','damageQueue','fallProgress','fallHeading'];
 const decodeMotion=row=>row?Object.fromEntries(motionKeys.map((key,i)=>[key,row[i]])):null;
 function decodeEnemy(r){
  const [id,type,x,y,hp,max,size,boss,fireSnake,roomId,phase,moving,angle,facing,hit,emerge,windup,runAttack,runDuration,recover,b,l,target,dominant,veil]=r;
  const batMove=b?{age:b[0],duration:b[1]}:null;
  const lionMove=l?{kind:l[0],age:l[1],angle:l[2],windup:l[3],duration:l[4],last:l[5]?{time:l[5][0],angle:l[5][1]}:null}:null;
  return {id,type,x,y,hp,max,size,boss,fireSnake,roomId,phase,moving,angle,facing,hit,emerge,windup,runAttack,runDuration,recover,batMove,lionMove,
   dominant,veilPhase:veil?.[0],veilTime:veil?.[1],castLength:b?.[2],target:target?{x:target[0],y:target[1]}:null};
 }
 return {origin,warm,connection,decodeMotion,decodeEnemy};
})();
