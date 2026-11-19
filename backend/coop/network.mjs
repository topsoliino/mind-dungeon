import {round,gap,maxHP,fallSeconds} from './rules.mjs';
import {personal} from './actions.mjs';

const q=n=>round(n||0,100);
const enemyNumbers=e=>[e.id,e.type,round(e.x),round(e.y),e.hp,e.max,q(e.size),e.boss?1:0,e.fireSnake?1:0,e.roomId,
 q(e.phase),e.moving?1:0,q(e.angle),q(e.facing),q(e.hit),q(e.emerge),q(e.windup),q(e.runAttack),q(e.runDuration),q(e.recover),
 e.batMove?[q(e.batMove.age),q(e.batMove.duration),q(e.castLength)]:null,
 e.lionMove?[e.lionMove.kind,q(e.lionMove.age),q(e.lionMove.angle),q(e.lionMove.windup),q(e.lionMove.duration),
  e.lionMove.last?[q(e.lionMove.last.time),q(e.lionMove.last.angle)]:null]:null,
 e.target?[round(e.target.x),round(e.target.y)]:null,e.dominant??null,e.veilPhase?[e.veilPhase,q(e.veilTime)]:null,
 e.bossRole?[e.bossRole,e.scientist??null,Boolean(e.warded),Boolean(e.enlarged),Boolean(e.spin),e.bossPose??null]:null,
 ...(e.fall?[[q(1-e.fall.remaining/fallSeconds),q(e.fall.heading)]]:e.dogMove?[null]:[]),
 ...(e.dogMove?[[q(e.dogMove.lift)]]:[])];
const currentRegion=(p,e)=>gap(p,e)<900;
function motion(p,clock){
 const t=p.vault?Math.min(1,(clock-p.vault.start)/.46):null;
 const consumed=p.consume&&Math.max(0,(clock-p.consume.start)/(p.consume.end-p.consume.start));
 const pose=t!==null?p.back?13+Math.floor(t*4):t<.45?1:2:p.consume?(p.consume.item.kind==='food'?3:7)+(consumed<.16?0:consumed<.35?1:consumed<.79?2:3):-1;
 return [round(p.x),round(p.y),q(p.dir),q(p.walk),p.weaponSide,Number(p.moving),Number(p.back),q(p.attack),q(p.attackDuration),q(p.dash),
  t===null?0:round(Math.sin(Math.PI*t)*29),p.chargeStart===null?-1:q(Math.min(1,(clock-p.chargeStart)/.58)),pose,
  round(p.hp),maxHP(p),round(p.stamina),p.staminaMax,q(p.combat),q(p.inv),round(p.bleed),q(p.webSlow),q(p.grabSlow),p.poison?1:0,
  p.dominant??null,p.input.seq,q(p.activeBrew?.remaining),
  (p.damageQueue??[]).filter(hit=>hit.amount>0).map(hit=>({amount:hit.amount,type:hit.type,remaining:q(hit.remaining)})),
  p.fall?q(1-p.fall.remaining/fallSeconds):-1,p.fall?.heading??0,...(p.wallRecoil?[q(p.wallRecoil),q(p.recoilAngle)]:[])];
}
export function createProjection(){
 let floor=0,revision=-1,event=0,peerRevision=-1,peerQuiz='',effects='',staticState='',lootKey='';
 const enemies=new Map();
 return (sim,p,force=false)=>{
  if(floor!==sim.state.floor){force=true;floor=sim.state.floor;enemies.clear();event=sim.eventId;}
  const base={type:'frame',...(force?{reset:true,yourQuiz:sim.actions.publicQuiz(p)}:{}),floor,seed:sim.state.dungeonSeed,layoutRevision:sim.state.layoutRevision,clock:q(sim.clock),remaining:sim.enemies.length,you:motion(p,sim.clock)};
  const peer=sim.players.find(o=>o!==p);
  base.peer=peer?.online?motion(peer,sim.clock):null;
  if(peer&&peer.online&&(force||peerRevision!==peer.revision)){
   peerRevision=peer.revision;const {appearance,equipment,altarUses}=peer;
   base.peerMeta={appearance,armor:equipment.armor,weapon:equipment.weapon,altar:altarUses};
  }
  const question=peer?.online&&peer.quiz?{
   key:peer.quiz.id,z:peer.quiz.i,reason:peer.quiz.reason,prompt:peer.quiz.q.prompt,
   options:peer.quiz.q.choices??[],selected:[],count:peer.quiz.q.correctIndices?.length??null,
   image:typeof peer.quiz.q.image?.src==='string'&&peer.quiz.q.image.src.length<32000?peer.quiz.q.image:null,alt:peer.quiz.q.image?.alt,
   feedback:peer.quiz.answered?{status:peer.quiz.notice,text:peer.quiz.q.explanation}:null
  }:null;
  const questionKey=question?question.key+Boolean(question.feedback):'';
  if(force||peerQuiz!==questionKey){base.quiz=question;peerQuiz=questionKey;}
  if(force||revision!==p.revision){revision=p.revision;base.personal=personal(p);}
  const visible=sim.floor.inSanctuary(p.x,p.y)?[]:sim.enemies.filter(e=>currentRegion(p,e)),next=new Set();
  const changed=[],removed=[];
  for(const e of visible){
   const row=enemyNumbers(e);next.add(row[0]);
   const signature=JSON.stringify(row);
   if(force||enemies.get(row[0])!==signature){enemies.set(row[0],signature);changed.push(row);}
  }
  for(const id of enemies.keys())if(!next.has(id)){enemies.delete(id);removed.push(id);}
  if(force||changed.length)base.enemies=changed;
  if(removed.length)base.removed=removed;
  const scene={explored:[...sim.explored],gates:sim.state.gates,doors:sim.state.doors??{},furnitureDamage:sim.state.furnitureDamage??{},access:sim.state.access??{},portal:sim.portal,completed:sim.completed,keyring:sim.keyring,openedCaches:sim.state.openedCaches,gateProgress:sim.state.gateProgress,bossBattle:sim.state.bossBattle??null};
  const sceneKey=JSON.stringify(scene);
  if(force||sceneKey!==staticState){staticState=sceneKey;Object.assign(base,scene);}
  const loot=[...sim.orbs.values()].filter(o=>(!o.seat||o.seat===p.seat)&&currentRegion(p,o));
  const nextLoot=loot.map(o=>o.id).join(',');
  if(force||lootKey!==nextLoot){lootKey=nextLoot;base.loot=loot;}
  const state=Object.fromEntries(Object.entries(sim.effects).map(([kind,rows])=>[kind,rows.filter(o=>
   o.approach>0&&o.type==='trap'?o.laneRegion===p.region:currentRegion(p,o)).slice(0,24)]));
  state.plates=sim.floor.pressurePlates.map(o=>o.pressed||o.timer>0);
  const fx=JSON.stringify(state,(key,v)=>typeof v==='number'?round(v,100):v);
  if(force||fx!==effects){effects=fx;base.effects=JSON.parse(fx);}
  const events=sim.events.filter(e=>e.seq>event&&(!e.to||e.to===p.seat)&&(force?e.kind==='notice':true)&&
   (!Number.isFinite(e.x)||gap(e,p)<980));
  event=sim.eventId;
  if(events.length)base.events=events;
  return base;
 };
}
