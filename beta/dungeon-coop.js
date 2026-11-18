window.DungeonCoop = (() => {
 'use strict';
 const sessionKey='mind-dungeon-coop-v1';
 const read=account=>{
  try {
   const room=JSON.parse(sessionStorage.getItem(sessionKey)||'null');
   return account&&room?.account===account&&/^[A-F0-9]{8}$/.test(room.code)&&[1,2].includes(room.seat)?room:null;
  }catch{return null;}
 };
 const remember=(room,account)=>sessionStorage.setItem(sessionKey,JSON.stringify({...room,account}));
 const forget=()=>sessionStorage.removeItem(sessionKey);
 const key=room=>sessionKey+'-'+room.code+'-'+room.seat;
 const token=()=>crypto.randomUUID();
 function pipe({room,call,readState,onPacket,onEvent,onError,cursor=0,events=[],pairs=[],onProgress=()=>{}}){
  let busy=false,closed=false;
  const send=(kind,data)=>events.push({kind,...data,token:token()});
  const pair=drops=>pairs.push(drops);
  async function sync(){
   if(busy||closed)return;
   busy=true;
   const sent=events.slice(0,45),sentPairs=pairs.slice(0,40);
   try{
    const packet=await call('sync',room.code,{floor:room.floor,state:readState(),cursor,events:sent,pairs:sentPairs});
    if(closed)return;
    events.splice(0,sent.length);pairs.splice(0,sentPairs.length);
    if(onPacket(packet)===false)return;
    for(const event of packet.events??[]){
     if(event.seq<=cursor)continue;
     onEvent(event);
     cursor=event.seq;
    }
    onProgress({cursor,events,pairs});
   }catch(error){if(!closed)onError(error);}
   finally{busy=false;}
  }
  const timer=setInterval(sync,230);
  return {send,pair,sync,stop(){closed=true;clearInterval(timer);},get progress(){return {cursor,events,pairs};}};
 }
 return {read,remember,forget,key,token,pipe};
})();
