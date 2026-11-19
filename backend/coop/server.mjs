import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {run,defaultPack} from './rules.mjs';
import {personal} from './actions.mjs';
import {checkpointConflict,checkpointStore} from './checkpoints.mjs';
import {getFloor,startParty,syncDifficulty,advanceParty,partyMetadata,partyState,restoreParty} from './party.mjs';
import {createProjection} from './network.mjs';

const config=JSON.parse(readFileSync(new URL('../../supabase/public-config.json',import.meta.url),'utf8'));
const allowedDefault='https://topsoliino.github.io';
const protocol=1,codePattern=/^[A-F0-9]{8}$/;
const STEP=1/30;
const frameEvery=2;
const sessionTTL=30*60*1000;
const checkpointInterval=10000;
const isToken=value=>typeof value==='string'&&value.length<=4096&&/^[\w-]+\.[\w-]+\.[\w-]+$/.test(value);
export function supabaseAuth({url=config.url,publishableKey=config.publishableKey,fetcher=fetch}={}){
 async function read(path,token){
  const response=await fetcher(url+path,{headers:{apikey:publishableKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error(response.status===401||response.status===403?'Bitte melde dich erneut an.':'Die Anmeldung oder das Fragenpaket ist gerade nicht erreichbar.');
  return response.json();
 }
 return {
  async verify(token){
   if(!isToken(token))throw new Error('Bitte melde dich zuerst an.');
   const user=await read('/auth/v1/user',token);
   const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
   if(!user.id||claims.sub!==user.id||claims.role!=='authenticated'||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now())throw new Error('Bitte melde dich erneut an.');
   return {id:user.id,expires:claims.exp*1000};
  },
  async pack(id,token){
   if(id===run.DEFAULT_PACK)return defaultPack;
   if(typeof id!=='string'||!id||id.length>200)throw new Error('Ungültiges Fragenpaket.');
   const query=new URLSearchParams({select:'data',pack_id:'eq.'+id,limit:'1'});
   const rows=await read('/rest/v1/question_packs?'+query,token);
   const raw=rows[0]?.data;
   if(!raw||JSON.stringify(raw).length>2_500_000)throw new Error('Dieses Fragenpaket ist in deinem Konto nicht verfügbar.');
   const result=run.validatePack(raw);
   if(result.packId!==id)throw new Error('Ungültiges Fragenpaket.');
   return result;
  }
 };
}
export function createCoopServer({auth=supabaseAuth(),origins=[allowedDefault],maxRooms=12,logger=console,store=null}={}){
 const rooms=new Map(),connections=new Map(),pendingByAddress=new Map();
 const wsServer=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
 let draining=false,shutdownPromise,sentBytes=0,lifetimeFrames=0;
 function send(ws,data){
  if(ws?.readyState!==WebSocket.OPEN||ws.bufferedAmount>80_000)return false;
  const raw=JSON.stringify(data);ws.send(raw);sentBytes+=Buffer.byteLength(raw);return true;
 }
 const http=createServer((req,res)=>{
  const origin=req.headers.origin;
  if(origin&&origins.includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='GET'&&req.url==='/healthz'){
   res.writeHead(draining?503:200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end(JSON.stringify({service:'mind-dungeon-coop',protocol,ready:!draining,checkpoints:Boolean(store)}));return;
  }
  res.writeHead(404);res.end();
 });
 http.on('upgrade',(req,socket,head)=>{
  const address=req.socket.remoteAddress??'unknown';
  if(draining||req.url!=='/coop'||!origins.includes(req.headers.origin)||connections.size>=64||(pendingByAddress.get(address)??0)>=12){
   socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
  }
  wsServer.handleUpgrade(req,socket,head,ws=>wsServer.emit('connection',ws,address));
 });
 function lobbyPacket(room,seat){
  const members=[...room.members.values()];
  const member=members.find(m=>m.seat===seat),peer=members.find(m=>m!==member);
  const sim=getFloor(room,member);
  return {type:'lobby',code:room.code,seat,mode:room.mode,
   ready:members.length===2&&members.every(m=>m.ws?.readyState===WebSocket.OPEN),
   started:Boolean(sim&&(!store||room.revision>0)),floor:member.floor??1,seed:sim?.state.dungeonSeed??room.seed,runSeed:room.seed,layoutRevision:sim?.state.layoutRevision,
   peerOnline:peer?.ws?.readyState===WebSocket.OPEN,peerFloor:peer?.floor??null,checkpoints:Boolean(store)};
 }
 function broadcastLobby(room){
  for(const member of room.members.values())send(member.ws,lobbyPacket(room,member.seat));
 }
 function mark(room){if(store)room.generation=(room.generation??0)+1;}
 function flush(room){
  if(!store||!room.floors||room.stale||!((room.generation??0)>(room.savedGeneration??0)))return Promise.resolve();
  if(room.writing)return room.writing;
  const pending=room.pendingWrite??={
   id:randomUUID(),expected:room.revision??0,generation:room.generation,
   meta:room.revision?null:partyMetadata(room),state:JSON.parse(JSON.stringify(partyState(room)))
  };
  room.writing=store.save(room.code,pending).then(revision=>{
   if(revision===checkpointConflict){
    room.stale=true;
    if(rooms.get(room.code)===room)rooms.delete(room.code);
    for(const m of room.members.values())m.ws?.close(1012,'Spielstand wird neu geladen');
    throw new Error('Die Lobby wird aus dem aktuellen Spielstand neu geladen.');
   }
   if(!Number.isSafeInteger(revision)||revision<=0)throw new Error('Der Koop-Spielstand konnte gerade nicht gespeichert werden.');
   room.revision=revision;room.savedGeneration=pending.generation;room.pendingWrite=null;
   if(!pending.expected)broadcastLobby(room);
  }).finally(()=>{room.writing=null;});
  return room.writing;
 }
 async function persist(room){
  if(!store||!room.floors)return;
  const target=room.generation??0;
  while(!room.stale&&(room.savedGeneration??0)<target)await flush(room);
 }
 function persistSoon(room){
  persist(room).catch(error=>logger.error('Koop-Spielstand '+room.code+': '+error.message));
 }
 function detach(connection){
  const {room,member}=connection;
  if(!room||!member||member.ws!==connection.ws)return;
  member.ws=null;
  const sim=getFloor(room,member);
  if(sim){
   member.awayAt=sim.clock;sim.setOnline(member.player,false);syncDifficulty(room,member);
   if(!draining){mark(room);persistSoon(room);}
  }
  room.seen=Date.now();broadcastLobby(room);
 }
 function attach(connection,room,member){
  if(connection.room&&connection.room!==room)throw new Error('Verlasse zuerst deine bisherige Lobby.');
  const old=member.ws;
  if(old===connection.ws)return;
  member.ws=connection.ws;member.project=createProjection();member.force=true;connection.room=room;connection.member=member;
  const sim=getFloor(room,member);
  if(sim){
   sim.setOnline(member.player,true,member.awayAt);member.awayAt=null;
   syncDifficulty(room,member);mark(room);
  }
  if(old)old.close(4002,'Die Lobby wurde in einem anderen Tab geöffnet.');
  room.seen=Date.now();
 }
 async function findParty(code,player){
  if(rooms.has(code))return rooms.get(code);
  const saved=await store?.load(code,player);
  if(!saved)return null;
  if(rooms.has(code))return rooms.get(code);
  if(rooms.size>=maxRooms){
   const idle=[...rooms.values()].find(room=>!room.writing&&
    (room.generation??0)===(room.savedGeneration??0)&&[...room.members.values()].every(m=>!m.ws));
   if(!idle)throw new Error('Der Gameserver ist gerade ausgelastet.');
   rooms.delete(idle.code);
  }
  const room=restoreParty(code,saved);
  rooms.set(code,room);
  return room;
 }
 async function execute(c,message){
  const {type}=message;
  if(type==='auth'){
   const viewer=await auth.verify(message.token);
   if(c.user&&c.user.id!==viewer.id)throw new Error('Die Identität kann innerhalb einer Verbindung nicht wechseln.');
   c.user=viewer;c.token=message.token;return {authenticated:true,protocol};
  }
  if(!c.user||c.user.expires<=Date.now())throw new Error('Bitte melde dich erneut an.');
  if(type==='list')return {parties:await store?.list(c.user.id)??[]};
  const deckOrder=Array.isArray(message.deckOrder)?[...new Set(message.deckOrder.filter(id=>typeof id==='string'&&id.length<=128))].slice(0,100):[];
  if(type==='create'){
   if(c.room)throw new Error('Verlasse zuerst deine bisherige Lobby.');
   if(rooms.size>=maxRooms)throw new Error('Der Gameserver ist gerade ausgelastet.');
   const pack=await auth.pack(message.pack,c.token);
   if(c.ws.readyState!==WebSocket.OPEN)return {};
   if(rooms.size>=maxRooms)throw new Error('Der Gameserver ist gerade ausgelastet.');
   let code;do{code=randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(code));
   const member={seat:1,id:c.user.id,pack,character:message.character,deckOrder};
   const room={code,seed:run.freshSeed(),mode:message.mode==='own'?'own':'same',members:new Map([[c.user.id,member]]),seen:Date.now()};
   rooms.set(code,room);attach(c,room,member);broadcastLobby(room);return lobbyPacket(room,1);
  }
  if(type==='join'||type==='resume'){
   if(typeof message.code!=='string'||!codePattern.test(message.code))throw new Error('Ungültiger Lobbycode.');
   const room=await findParty(message.code,c.user.id);
   if(c.ws.readyState!==WebSocket.OPEN||draining)return {};
   if(!room)throw new Error('Diese Lobby ist nicht mehr verfügbar.');
   let member=room.members.get(c.user.id);
   if(!member){
    if(type==='resume'||room.floors||room.members.size>=2)throw new Error('Diese Lobby ist voll oder gehört einem anderen Konto.');
    const pack=room.mode==='same'?room.members.values().next().value.pack:await auth.pack(message.pack,c.token);
    if(c.ws.readyState!==WebSocket.OPEN)return {};
    if(!rooms.has(room.code)||room.members.size>=2)throw new Error('Diese Lobby ist voll oder wurde geschlossen.');
    member={seat:2,id:c.user.id,pack,character:message.character,deckOrder};room.members.set(c.user.id,member);
   }
   attach(c,room,member);broadcastLobby(room);
   return {...lobbyPacket(room,member.seat),pack:member.pack.packId};
  }
  const {room,member}=c;
  if(!room||member?.ws!==c.ws)throw new Error('Diese Verbindung gehört zu keiner Lobby.');
  if(type==='start'){
   if(member.seat!==1||room.members.size!==2||[...room.members.values()].some(m=>!m.ws))throw new Error('Beide Spieler müssen verbunden sein.');
   if(!room.floors){startParty(room);mark(room);}
   await persist(room);
   broadcastLobby(room);return lobbyPacket(room,member.seat);
  }
  if(type==='leave'){
   if(room.floors){
    detach(c);c.room=c.member=null;await persist(room);return {};
   }
   if(member.seat===2){room.members.delete(member.id);c.room=c.member=null;broadcastLobby(room);return {};}
   rooms.delete(room.code);
   for(const m of room.members.values()){
    const other=connections.get(m.ws);if(other)other.room=other.member=null;
    send(m.ws,{type:'ended',message:'Die Koop-Lobby wurde beendet.'});
   }
   return {};
  }
  if(type==='deck')return {pack:member.pack.packId,data:member.pack.packId===run.DEFAULT_PACK?null:member.pack};
  const sim=getFloor(room,member),p=member.player;
  if(!sim||store&&!room.revision)throw new Error('Die Partie wurde noch nicht gestartet.');
  if(message.floor!==sim.state.floor)throw new Error('Die Ebene wurde gewechselt.');
  if(type==='charge'){sim.charge(p,message.aim,Boolean(message.vault));return {};}
  if(type==='cancel'){p.chargeStart=null;return {};}
  if(type==='attack'){sim.attack(p,message.aim);return {};}
  if(type==='action'){
   const result=sim.actions.dispatch(p,message.action,message.data??{});
   if(result.advance)advanceParty(room,member);
   mark(room);
   if(result.advance){broadcastLobby(room);await persist(room);}
   else if(message.action!=='interact'||result.item||result.notice||result.victory)persistSoon(room);
   return {...result,personal:personal(p)};
  }
  throw new Error('Unbekannte Anfrage.');
 }
 wsServer.on('connection',(ws,address)=>{
  const c={ws,address,alive:true,window:Date.now(),count:0,chain:Promise.resolve(),queued:0};
  connections.set(ws,c);pendingByAddress.set(address,(pendingByAddress.get(address)??0)+1);
  const deadline=setTimeout(()=>{if(!c.user)ws.close(4001,'Anmeldung erforderlich');},12000);
  ws.on('pong',()=>{c.alive=true;});
  ws.on('error',()=>{});
  ws.on('close',()=>{
   clearTimeout(deadline);detach(c);connections.delete(ws);
   const n=(pendingByAddress.get(address)??1)-1;if(n)pendingByAddress.set(address,n);else pendingByAddress.delete(address);
  });
  ws.on('message',(buffer,binary)=>{
   if(draining)return;
   if(binary)return ws.close(1003,'Nur JSON');
   const now=Date.now();
   if(now-c.window>1000){c.window=now;c.count=0;}
   if(++c.count>85)return ws.close(1008,'Zu viele Nachrichten');
   let data;try{data=JSON.parse(buffer.toString());}catch{return;}
   if(!data||typeof data.type!=='string'||Array.isArray(data))return;
   if(data.type==='input'){
    const sim=getFloor(c.room,c.member);
    if(c.user?.expires>now&&sim&&c.member?.ws===ws&&data.floor===c.member.floor)sim.control(c.member.player,data);
    return;
   }
   if(++c.queued>12)return ws.close(1008,'Zu viele offene Anfragen');
   const id=Number.isSafeInteger(data.id)?data.id:null;
   c.chain=c.chain.then(async()=>{
    if(ws.readyState!==WebSocket.OPEN||draining)return;
    const reply=await execute(c,data);
    if(id!==null)send(ws,{type:'reply',id,ok:true,data:reply});
   }).catch(error=>{if(id!==null)send(ws,{type:'reply',id,ok:false,message:error.message});})
     .finally(()=>{c.queued--;});
  });
 });
 let prior=performance.now(),backlog=0;
 const simulationTimer=setInterval(()=>{
  const now=performance.now();backlog=Math.min(backlog+(now-prior)/1000,.15);prior=now;
  for(;backlog>=STEP;backlog-=STEP){
   for(const room of rooms.values()){
    if(!room.floors||store&&!room.revision)continue;
    try{
     for(const sim of room.floors.values()){
      if(!sim.activePlayers().length)continue;
      sim.step(STEP);mark(room);
      if(sim.tickId%frameEvery!==0)continue;
      for(const member of room.members.values()){
       const ws=member.ws;
       if(member.floor!==sim.state.floor||ws?.readyState!==WebSocket.OPEN||ws.bufferedAmount>80_000)continue;
       if(send(ws,member.project(sim,member.player,member.force))){member.force=false;lifetimeFrames++;}
      }
     }
    }catch(error){
     logger.error('Spielsimulation fehlgeschlagen',error);
     rooms.delete(room.code);room.stale=true;
     for(const member of room.members.values())member.ws?.close(1012,'Partie wird aus dem letzten Spielstand geladen');
    }
   }
  }
 },16);
 const checkpoints=setInterval(()=>{
  for(const room of rooms.values())if(room.floors)persistSoon(room);
 },checkpointInterval);
 const maintenance=setInterval(()=>{
  const now=Date.now();
  for(const [ws,c] of connections){
   if(!c.alive){ws.terminate();continue;}
   if(c.user&&c.user.expires<=now){ws.close(4001,'Sitzung abgelaufen');continue;}
   c.alive=false;ws.ping();
  }
  for(const room of rooms.values()){
   const saved=(room.savedGeneration??0)===(room.generation??0);
   if(saved&&[...room.members.values()].every(m=>!m.ws)&&now-room.seen>sessionTTL)rooms.delete(room.code);
  }
 },20000);
 function shutdown(){
  if(shutdownPromise)return shutdownPromise;
  draining=true;clearInterval(simulationTimer);clearInterval(maintenance);clearInterval(checkpoints);
  shutdownPromise=(async()=>{
   const closed=new Promise(resolve=>http.close(resolve));
   await Promise.allSettled([...rooms.values()].map(room=>persist(room)));
   for(const ws of connections.keys())ws.close(1012,'Gameserver startet neu');
   await closed;
  })();
  return shutdownPromise;
 }
 return {http,shutdown,usage:()=>({sentBytes,frames:lifetimeFrames,rooms:rooms.size})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const origins=(process.env.MIND_ALLOWED_ORIGINS||allowedDefault).split(',').map(s=>s.trim()).filter(Boolean);
 const store=checkpointStore({token:process.env.MIND_COOP_STORAGE_TOKEN});
 if(process.env.RENDER==='true'&&!store)throw new Error('MIND_COOP_STORAGE_TOKEN fehlt');
 if(store&&!await store.ready())throw new Error('Koop-Speicher ist nicht bereit');
 const service=createCoopServer({origins,store});
 service.http.listen(Number(process.env.PORT||8787),'0.0.0.0',()=>console.log('Mind Dungeon Koop bereit'));
 process.once('SIGTERM',service.shutdown);process.once('SIGINT',service.shutdown);
}
