window.DungeonCoopMotion = (() => {
 'use strict';
 const cadence=50,idleCadence=360;
 const mix=(a,b,t)=>a+(b-a)*t;
 const turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
 const goodPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=4608&&p.y<=3500;
 const bounded=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
 const active=p=>p.moving||p.attack>0||p.dash>0||p.lift>0||p.charge>=0||p.pose>=0;

 function motionBuffer(delay,maxAhead){
  let points=[],last=null,offset=null,epoch=null;
  function clear(){points=[];last=null;offset=null;epoch=null;}
  function push(p,received,clock=received,stream='fallback'){
   if(!goodPoint(p)||!Number.isFinite(clock))return false;
   if(stream!==epoch){clear();epoch=stream;}
   if(last&&clock<=last.clock)return false;
   const elapsed=last?clock-last.clock:0;
   if(elapsed>1250||last&&Math.hypot(last.x-p.x,last.y-p.y)>Math.max(120,elapsed*.9+36)){
    points=[];last=null;offset=null;
   }
   const skew=received-clock;
   // Age is estimated with the least-delayed recent sample. Client clocks need not agree.
   offset=offset===null?skew:Math.min(skew,offset+elapsed*.002);
   last={...p,received,clock,time:clock+offset};
   points.push(last);
   if(points.length>30)points.shift();
   return true;
  }
  function sample(now){
   if(!last)return null;
   const time=now-delay;
   while(points.length>2&&points[1].time<=time)points.shift();
   const a=points[0],b=points[1];
   if(time<=a.time)return {...a};
   if(b&&time<b.time){
    const t=(time-a.time)/(b.time-a.time);
    return {...a,x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),dir:turn(a.dir,b.dir,t),walk:mix(a.walk,b.walk,t),
     lift:mix(a.lift,b.lift,t),attack:Math.min(a.attack,Math.max(0,a.attack-(time-a.time)/1000)),charge:a.charge<0||b.charge<0?a.charge:mix(a.charge,b.charge,t),
     moving:a.moving||b.moving&&Math.hypot(b.x-a.x,b.y-a.y)>1};
   }
   const age=Math.max(0,time-last.time),ahead=Math.min(maxAhead,age);
   const result={...last,attack:Math.max(0,last.attack-age/1000),dash:Math.max(0,last.dash-age/1000)};
   if(a!==last&&last.moving){
    const dt=last.clock-a.clock;
    if(dt>0){
     const dx=last.x-a.x,dy=last.y-a.y,limit=dt*(last.dash>0?.82:.42),scale=Math.min(1,limit/Math.max(1,Math.hypot(dx,dy)));
     result.x+=dx*scale*ahead/dt;result.y+=dy*scale*ahead/dt;
     result.walk+=Math.max(0,Math.min(.04,(last.walk-a.walk)/dt))*ahead;
    }
   }
   if(age>maxAhead+100)result.moving=false;
   return result;
  }
  return {push,sample,clear};
 }

 function realtime({room,config,getToken,onMotion,onSwing,onLoss}){
  const address=new URL(config.url);
  address.protocol=address.protocol==='https:'?'wss:':'ws:';
  address.pathname='/realtime/v1/websocket';
  address.search=new URLSearchParams({apikey:config.publishableKey,vsn:'1.0.0'});
  const topic='realtime:mind-dungeon-motion:'+room.code+':'+room.floor;
  const stream=crypto.randomUUID();
  let socket=null,joined=false,closed=false,retry=null,retries=0,serial=0,joinRef=null,heartbeatRef=null;
  let joinTimer=null,heartbeatTimer=null,usedToken=null,lastSent=-Infinity,lastState='';
  function send(event,payload={},target=topic,ref=String(++serial)){
   socket.send(JSON.stringify({topic:target,event,payload,ref,join_ref:target==='phoenix'?null:joinRef}));
   return ref;
  }
  function broadcast(event,payload){
   if(!joined||socket?.readyState!==1||socket.bufferedAmount>16384)return false;
   send('broadcast',{type:'broadcast',event,payload:{seat:room.seat,stream,...payload}});
   return true;
  }
  function connect(){
   if(closed)return;
   const token=getToken();
   if(!token){retry=setTimeout(connect,3000);return;}
   let ws;
   try{ws=new WebSocket(address);}catch{retry=setTimeout(connect,3000);return;}
   socket=ws;usedToken=token;
   joinTimer=setTimeout(()=>ws.close(),6000);
   ws.onopen=()=>{
    if(closed||socket!==ws)return;
    joinRef=String(++serial);
    send('phx_join',{config:{private:true,broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[]},access_token:usedToken},topic,joinRef);
   };
   ws.onmessage=message=>{
    if(closed||socket!==ws||typeof message.data!=='string'||message.data.length>3500)return;
    let packet;
    try{packet=JSON.parse(message.data);}catch{return;}
    if(packet.event==='phx_reply'){
     if(packet.ref===heartbeatRef){heartbeatRef=null;return;}
     if(packet.topic!==topic||packet.ref!==joinRef)return;
     if(packet.payload?.status!=='ok'){ws.close();return;}
     clearTimeout(joinTimer);joined=true;retries=0;lastSent=-Infinity;return;
    }
    if(packet.topic!==topic)return;
    if(packet.event==='phx_error'||packet.event==='phx_close'||packet.event==='system'&&packet.payload?.status==='error'){ws.close();return;}
    if(!joined||packet.event!=='broadcast')return;
    const {event,payload:p}=packet.payload??{};
    if(!p||p.seat!==3-room.seat||typeof p.stream!=='string'||p.stream.length!==36||!goodPoint(p))return;
    if(event==='swing'&&bounded(p.dir,-4,4)&&bounded(p.duration,.08,2.5)&&
       bounded(p.reach,1,1300)&&bounded(p.scale,.05,8)&&typeof p.id==='string'&&p.id.length===36&&typeof p.weapon==='string'&&p.weapon.length<16&&typeof p.type==='string'&&p.type.length<16)onSwing(p,performance.now());
    if(event==='motion'&&bounded(p.clock,0,1e10)&&bounded(p.dir,-4,4)&&bounded(p.walk,0,1e9)&&
       bounded(p.attack,0,2.5)&&bounded(p.attackDuration,.08,2.5)&&bounded(p.dash,0,1.5)&&bounded(p.lift,0,128)&&
       bounded(p.charge,-1,1)&&Number.isInteger(p.pose)&&bounded(p.pose,-1,17))onMotion(p,performance.now());
   };
   ws.onerror=()=>{if(socket===ws)ws.close();};
   ws.onclose=()=>{
    if(socket!==ws)return;
    clearTimeout(joinTimer);clearInterval(heartbeatTimer);heartbeatRef=null;
    socket=null;joined=false;onLoss();
    if(!closed)retry=setTimeout(connect,Math.min(12000,1000*2**Math.min(retries++,4)));
   };
   heartbeatTimer=setInterval(()=>{
    if(socket!==ws||ws.readyState!==1)return;
    const nextToken=getToken();
    if(!nextToken||heartbeatRef){ws.close();return;}
    if(joined&&nextToken!==usedToken){
     usedToken=nextToken;send('access_token',{access_token:usedToken});
    }
    heartbeatRef=send('heartbeat',{},'phoenix');
   },24000);
  }
  connect();
  return {
   motion(p,now=performance.now()){
    if(!joined)return;
    const state=JSON.stringify([p.x,p.y,p.dir,p.moving,p.back,p.pose,p.ready]);
    const changed=state!==lastState;
    if(now-lastSent<(active(p)||changed?cadence:idleCadence))return;
    if(broadcast('motion',{...p,clock:now})){lastSent=now;lastState=state;}
   },
   swing:p=>broadcast('swing',p),
   stop(){
    closed=true;joined=false;clearTimeout(retry);clearTimeout(joinTimer);clearInterval(heartbeatTimer);
    const ws=socket;socket=null;ws?.close();
   }
  };
 }
 return {motionBuffer,realtime};
})();
