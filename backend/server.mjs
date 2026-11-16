import http from 'node:http';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,timingSafeEqual} from 'node:crypto';

const PORT=Number(process.env.PORT||8787);
const TOKEN=process.env.MIND_SAVE_TOKEN;
const ORIGIN=process.env.MIND_ALLOWED_ORIGIN||'https://topsoliino.github.io';
const DIRECTORY=process.env.MIND_SAVE_DIR||'./save-data';
if(!TOKEN||TOKEN.length<24)throw Error('MIND_SAVE_TOKEN mit mindestens 24 Zeichen erforderlich');
await mkdir(DIRECTORY,{recursive:true});
function respond(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload))}
function validToken(raw){const a=Buffer.from(raw||''),b=Buffer.from(TOKEN);return a.length===b.length&&timingSafeEqual(a,b)}
function validSlot(v){return /^[a-zA-Z0-9_-]{1,40}$/.test(v)}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;if(origin===ORIGIN){res.setHeader('Access-Control-Allow-Origin',ORIGIN);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,PUT,OPTIONS')}
 if(req.method==='OPTIONS')return respond(res,204,{});
 if(req.url==='/api/health'&&req.method==='GET')return respond(res,200,{ok:true,service:'mind-dungeon-save',version:1});
 if(origin&&origin!==ORIGIN)return respond(res,403,{error:'Ursprung nicht erlaubt'});
 if(!validToken((req.headers.authorization||'').replace(/^Bearer /,'')))return respond(res,401,{error:'Authentifizierung erforderlich'});
 const m=/^\/api\/saves\/([a-zA-Z0-9_-]+)$/.exec(req.url||'');if(!m||!validSlot(m[1]))return respond(res,404,{error:'Unbekannter Endpunkt'});
 const file=join(DIRECTORY,m[1]+'.json');
 try{
  if(req.method==='GET'){try{return respond(res,200,JSON.parse(await readFile(file,'utf8')))}catch(e){return respond(res,e.code==='ENOENT'?404:500,{error:e.code==='ENOENT'?'Kein Spielstand':'Lesefehler'})}}
  if(req.method==='PUT'){
   let chunks=[],bytes=0;for await(const part of req){bytes+=part.length;if(bytes>262144)return respond(res,413,{error:'Spielstand zu groß'});chunks.push(part)}
   let payload;try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return respond(res,400,{error:'Ungültiges JSON'})}
   if(payload?.schema!==1||typeof payload?.data!=='object'||Array.isArray(payload.data)||!payload.data)return respond(res,422,{error:'Ungültiges Spielstandformat'});
   const content=JSON.stringify({schema:1,data:payload.data,updatedAt:new Date().toISOString()});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,content,{mode:0o600});await rename(tmp,file);return respond(res,200,{ok:true});
  }
  return respond(res,405,{error:'Methode nicht erlaubt'});
 }catch(e){console.error(e);return respond(res,500,{error:'Serverfehler'})}
});
server.listen(PORT,()=>console.log('Spielstand-API läuft auf Port '+PORT));
