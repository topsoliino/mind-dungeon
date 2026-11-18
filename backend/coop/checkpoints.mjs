import {readFileSync} from 'node:fs';

const config=JSON.parse(readFileSync(new URL('../../supabase/public-config.json',import.meta.url),'utf8'));
export const checkpointConflict=Symbol('checkpoint conflict');

export function checkpointStore({token,url=config.url,key=config.publishableKey,fetcher=fetch}={}){
 if(!token)return null;
 async function call(action,fields={},signal=AbortSignal.timeout(6500)){
  let response;
  try{
   response=await fetcher(url+'/rest/v1/rpc/mind_coop_checkpoint',{
    method:'POST',signal,headers:{apikey:key,'Content-Type':'application/json','X-Mind-Coop-Storage-Token':token},
    body:JSON.stringify({p_action:action,...fields})
   });
  }catch{throw new Error('Der Koop-Spielstand ist gerade nicht erreichbar.');}
  if(!response.ok)throw new Error('Der Koop-Spielstand ist gerade nicht erreichbar (HTTP '+response.status+').');
  return response.json();
 }
 return {
  list:player=>call('list',{p_player:player}),
  load:(code,player)=>call('load',{p_code:code,p_player:player}),
  async save(code,write){
   const result=await call('save',{p_code:code,p_expected:write.expected,p_write:write.id,p_meta:write.meta,p_state:write.state});
   return result?.conflict?checkpointConflict:result?.revision;
  },
  ready:async()=>await call('ready')===true
 };
}
