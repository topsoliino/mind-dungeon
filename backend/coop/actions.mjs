import {randomUUID} from 'node:crypto';
import {run,items,foes,brewing,expedition,pools,item,cup,TILE,gap,maxHP,preparePlayer,stats,xpRequired,equipped,equip,unequip,correct,selectLoot} from './rules.mjs';

const fail=message=>{throw new Error(message);};
const index=(list,i)=>Number.isInteger(i)&&i>=0?list[i]:undefined;
const heal=(p,n)=>{p.hp=Math.min(maxHP(p),p.hp+n);};
const personalFields=['inventory','equipment','attributes','xp','level','pendingLevels','gold','bones','rubies','kills','solved','questionCount','questionReview','opened','searched','altarUses','gateQuestions','boneClaims','rubyClaims','templeAttempts','trials','cupClaimed','shopSold','mythicSold','brewEffects','merchantMapFound','wellOffer','wellUsed','activeBrew','combatRecord','playtime'];
export function personal(p){
 return {revision:p.revision,character:p.appearance,...Object.fromEntries(personalFields.map(key=>[key,p[key]]))};
}
export function actions(sim){
 const near=(p,site,limit=96)=>Boolean(site&&gap(p,site)<=limit&&!sim.floor.gateLineBlocked(p.x,p.y,site.x,site.y));
 const live=(p,site,limit)=>{if(!near(p,site,limit))fail('Du bist zu weit entfernt.');};
 const count=p=>p.inventory.length;
 const floorNumber=()=>sim.state.floor;

 function portal(p){
  live(p,sim.portal,76);
  if(sim.enemies.length)fail('Auf dieser Tiefe leben noch Gegner.');
  if(sim.completed)return {victory:true};
  if(sim.activePlayers().some(actor=>actor.quiz))fail('Warte, bis die andere Person ihre Frage abgeschlossen hat.');
  return {advance:true};
 }
 function stock(p){
  const floor=floorNumber(), offers=expedition.stock(pools,sim.seed,floor,run.shuffle,run.random);
  return {gold:items.shop(sim.state.dungeonSeed,floor,pools).slice(0,p.equipment.rings.includes('merchant')?6:3),...offers};
 }
 function quiz(p,reason,i){
  if(p.quiz)fail('Ein Quiz läuft bereits.');
  const floor=sim.floor;
  let zone=i,options=p.pack.questions,exclude=[];
  if(reason==='gate'){
   const g=floor.gates.find(g=>g.id===i);
   if(!g||sim.state.gates[i])fail('Das Tor ist bereits offen.');
   const shift=g.vertical?(floor.rooms[g.from].cx<g.x?-1:1):(floor.rooms[g.from].cy<g.y?-1:1);
   const approach={x:(g.x+.5+(g.vertical?shift:0))*TILE,y:(g.y+.5+(g.vertical?0:shift))*TILE};
   if(!near(p,approach,108)&&!(p.region===g.corridorId&&gap(p,{x:(g.x+.5)*TILE,y:(g.y+.5)*TILE})<110))fail('Du bist zu weit vom Tor entfernt.');
   zone=g.from;exclude=p.gateQuestions[i]??[];
  }else if(reason==='shrine'){
   live(p,index(floor.shrines,i),103);
   if((p.altarUses[i]??0)>=2)fail('Am Altar wurden bereits zwei Fragen beantwortet.');
   exclude=p.altarQuestions[i]??[];
  }else if(reason==='temple'){
   live(p,index(floor.templeShrines,i),90);
   if(p.rubyClaims[i]||p.templeAttempts[i]?.failed)fail('Dieser Schrein wurde bereits besucht.');
   options=options.filter(q=>q.difficulty===3);exclude=p.templeAttempts[i]?.used??[];
  }else if(reason==='brew'){
   live(p,floor.lab,95);
   const offer=brewing.stock(sim.state.dungeonSeed,floorNumber(),p.equipment.rings.includes('brewer'),run.random,run.shuffle).find(e=>e.id===i);
   if(!offer||p.brewEffects.length>=3||p.brewEffects.some(e=>e.id===i)||!p.inventory.some(it=>it.kind==='cup'))fail('Die Zutat ist nicht verfügbar.');
  }else if(reason==='trial'){
   if(i!==floor.trialIndex||p.opened.includes(i)||p.trials[i]&&p.trials[i]!=='started')fail('Diese Prüftruhe wurde bereits geöffnet.');
   live(p,index(floor.chests,i),104);
   p.trial??={index:i,deadline:sim.clock+40,correct:0,target:Math.min(3,options.length),used:[],passed:false};
   p.trials[i]='started';exclude=p.trial.used;
  }else if(reason==='study'){
   options=options.filter(q=>q.id===i&&q.image);
  }else fail('Unbekanntes Quiz.');
  if(!options.length)fail('In diesem Fragenpaket gibt es keine passende Frage.');
  const due=q=>(p.questionReview[q.id]?.due??-1)<=p.questionCount;
  const topical=(run.roomTopics(p.pack,floorNumber())[zone]??[]).flatMap(group=>group.questions);
  const local=(reason==='gate'||reason==='shrine')&&topical.length?topical:options;
  let eligible=local.filter(q=>!exclude.includes(q.id)&&due(q));
  if(!eligible.length&&reason!=='shrine')eligible=options.filter(q=>!exclude.includes(q.id));
  if(!eligible.length&&(reason==='gate'||reason==='shrine'&&local.every(q=>exclude.includes(q.id))))eligible=local.filter(due);
  if(!eligible.length&&reason==='gate')eligible=options;
  if(!eligible.length)fail('Es sind gerade keine weiteren Fragen verfügbar.');
  eligible.sort((a,b)=>(p.solved[a.id]??0)-(p.solved[b.id]??0));
  const q=eligible[Math.floor(sim.random()*Math.min(3,eligible.length))];
  p.quiz={id:randomUUID(),q,reason,i,answered:false};p.chargeStart=null;p.dash=0;
  return publicQuiz(p);
 }
 function publicQuiz(p){
  if(!p.quiz)return null;
  const {id,q,reason,i}=p.quiz,{answers,correctIndex,correctIndices,explanation,...visible}=q;
  const trial=p.trial&&{correct:p.trial.correct,target:p.trial.target,seconds:Math.max(0,p.trial.deadline-sim.clock)};
  const result=p.quiz.answered?{ok:p.quiz.ok,notice:p.quiz.notice,choice:p.quiz.choice,explanation,correctIndices:correctIndices??[correctIndex].filter(Number.isInteger)}:null;
  return {question:{...visible,count:correctIndices?.length??1},quiz:id,reason,i,trial,result};
 }
 function xp(p,q,ok){
  p.questionCount++;
  if(ok){
   p.solved[q.id]=(p.solved[q.id]??0)+1;p.xp+=p.solved[q.id]>1?5:15+(q.difficulty||1)*5;
   while(p.xp>=xpRequired(p.level)){p.xp-=xpRequired(p.level);p.level++;p.pendingLevels++;heal(p,22);}
   preparePlayer(p);
  }else if(p.questionReview[q.id]?.color!=='green')p.questionReview[q.id]={color:'red',due:p.questionCount+5};
 }
 function answer(p,data){
  const qz=p.quiz;
  if(!qz||qz.id!==data.quiz||qz.answered)fail('Diese Frage ist nicht mehr offen.');
  const {q,reason,i}=qz;const ok=correct(q,data.choice);
  qz.answered=true;xp(p,q,ok);
  let more=false,notice=ok?'Richtig · +Erfahrung':'Nicht ganz';
  if(reason==='shrine'){
   (p.altarQuestions[i]??=[]).push(q.id);p.altarUses[i]=(p.altarUses[i]??0)+1;
  }
  if(reason==='gate'&&ok){
   (p.gateQuestions[i]??=[]).push(q.id);
   const count=(sim.state.gateProgress[i]??0)+1;sim.state.gateProgress[i]=count;
   if(count>=Math.min(2,p.pack.questions.length)){sim.state.gates[i]=true;notice='Wissenstor geöffnet';}else more=true;
  }
  if(reason==='brew'&&ok){
   const entry=brewing.stock(sim.state.dungeonSeed,floorNumber(),p.equipment.rings.includes('brewer'),run.random,run.shuffle).find(e=>e.id===i);
   if(entry)p.brewEffects.push(entry);
  }
  if(reason==='temple'){
   const attempt=p.templeAttempts[i]??={correct:0,used:[],failed:false};
   attempt.used.push(q.id);
   if(!ok)attempt.failed=true;
   else if(++attempt.correct>=2){p.rubyClaims[i]=true;p.rubies++;notice='+1 Rubin';}else more=true;
  }
  if(reason==='trial'&&p.trial){
   p.trial.used.push(q.id);
   if(ok)p.trial.correct++;
   p.trial.passed=p.trial.correct>=p.trial.target;
   notice=(ok?'Richtig':'Falsch')+' · '+p.trial.correct+'/'+p.trial.target+' richtig';
   more=!p.trial.passed;
  }
  if(reason!=='study'&&reason!=='trial'&&reason!=='brew'){
   if(ok)heal(p,18);
   else p.hp=Math.max(1,p.hp-8);
  }
  qz.more=more;qz.notice=notice;qz.ok=ok;qz.choice=data.choice;
  return {ok,notice,explanation:q.explanation,correctIndices:q.correctIndices??[q.correctIndex].filter(Number.isInteger)};
 }
 function finishTrial(p,passed){
  const trial=p.trial;if(!trial)return;
  p.trial=null;p.quiz=null;p.opened.push(trial.index);p.trials[trial.index]=passed?'won':'failed';p.revision++;
  const pos=sim.floor.chests[trial.index];
  if(passed){
   p.gold+=48+floorNumber()*9;
   sim.drop(pos,selectLoot(floorNumber()>=3?'legendary':'rare',floorNumber(),sim.random),p.seat);
   sim.emit('notice',{message:'Prüftruhe bestanden'},p.seat);return;
  }
  const desk=sim.floor.rooms[trial.index];
  const places=[[2,2],[desk.w-3,3],[desk.w-3,desk.h-3]].map(([dx,dy])=>sim.floor.accessiblePoint((desk.x+dx+.5)*TILE,(desk.y+dy+.5)*TILE));
  places.forEach((place,i)=>{
   if(!sim.floor.valid(place.x,place.y,12,true)||sim.enemies.some(e=>gap(e,place)<23))return;
   const type=[foes.ZOMBIE,2,3][i],max=sim.enemyHealth(type,false);
   sim.enemies.push({...place,id:'ambush-'+p.seat+'-'+trial.index+'-'+i,type,roomId:trial.index,hp:max,max,size:.93,phase:i,hit:0,attack:1.4+i*.45,windup:0,angle:0});
  });
  sim.emit('notice',{message:'Prüftruhe fehlgeschlagen · Hinterhalt!'},p.seat);
 }
 function review(p,{quiz:id,color,skip}){
  const qz=p.quiz;
  if(!qz||qz.id!==id)fail('Diese Frage ist nicht mehr offen.');
  const {reason,i,q,answered,more}=qz;p.quiz=null;
  if(answered&&['red','yellow','green'].includes(color))p.questionReview[q.id]={color,due:color==='green'?Number.MAX_SAFE_INTEGER:p.questionCount+(color==='red'?5:10)};
  if(reason==='trial'){
   if(skip||!answered){finishTrial(p,false);return {};}
   if(p.trial?.passed){finishTrial(p,true);return {};}
   if(p.pack.questions.length-(p.trial?.used.length??0)<(p.trial?.target??0)-(p.trial?.correct??0)){finishTrial(p,false);return {};}
  }
  if(answered&&more&&!skip){try{return quiz(p,reason,i);}catch(error){if(reason==='trial')finishTrial(p,false);return {notice:error.message};}}
  return {};
 }
 function take(p,id){
  const orb=sim.orbs.get(id);
  if(!orb||orb.seat&&orb.seat!==p.seat)fail('Der Seelenball ist nicht mehr verfügbar.');
  if(count(p)>=30)fail('Dein Inventar ist voll.');
  live(p,orb,68);p.inventory.push(orb.item);sim.orbs.delete(id);
  return {item:orb.item};
 }
 function inventory(p,kind,data){
  const it=index(p.inventory,data.index);
  if(!it||items.key(it)!==data.key)fail('Das Inventar wurde aktualisiert. Wähle den Gegenstand erneut.');
  if(kind==='equip'&&!equip(p,it,data.slot))fail('Dieser Gegenstand kann hier nicht ausgerüstet werden.');
  if(kind==='unequip'){
   if(!equipped(p,it))fail('Der Gegenstand ist nicht ausgerüstet.');
   unequip(p,it);
  }
  if(kind==='drop'){
   if(!sim.drop(p,it))fail('Hier liegt bereits zu viel Beute.');
   p.inventory.splice(data.index,1);if(equipped(p,it)){unequip(p,it);if(it.kind==='weapon'){
    const replacement=p.inventory.find(other=>other.kind==='weapon'&&Object.entries(items.requirements[other.id]??{}).every(([key,n])=>p.attributes[key]>=n));
    if(replacement)equip(p,replacement);
   }}
  }
  if(kind==='consume'){
   if(p.consume||!['food','potion'].includes(it.kind)||it.kind==='food'&&p.hp>=maxHP(p))fail('Du kannst das gerade nicht verwenden.');
   p.inventory.splice(data.index,1);p.consume={item:it,start:sim.clock,end:sim.clock+(it.kind==='food'?.69:.82)};
  }
  preparePlayer(p);p.stamina=Math.min(p.stamina,p.staminaMax);
  return {item:it};
 }
 function interact(p,kind,i){
  const f=sim.floor;
  if(kind==='merchant'){live(p,f.merchant);return {stock:stock(p)};}
  if(kind==='brewery'){live(p,f.lab);return {};}
  if(kind==='well'){live(p,f.wellUse);return {};}
  if(kind==='portal')return portal(p);
  if(kind==='soul')return take(p,i);
  if(kind==='cup'){
   live(p,f.cupPoint,69);
   if(p.cupClaimed||count(p)>=30)fail('Der Becher ist nicht verfügbar.');
   p.cupClaimed=true;p.inventory.push(cup('Ruheraum'));return {notice:'Leerer Becher aufgenommen'};
  }
  if(kind==='bones'){
   const pile=index(f.bonePiles,i);live(p,pile,72);
   if(p.boneClaims[pile.id])fail('Bereits aufgesammelt.');
   p.boneClaims[pile.id]=true;p.bones++;return {notice:'+1 Knochen'};
  }
  if(kind==='map'){live(p,f.mapPickup);p.merchantMapFound=true;return {};}
  if(kind==='cabinet'){
   const cabinet=index(f.cabinets,i);live(p,cabinet,82);
   if(p.searched.includes(i))fail('Dieser Schrank wurde bereits durchsucht.');
   p.searched.push(i);p.gold+=cabinet.gold;
   return {notice:cabinet.gold?'Schrank durchsucht · +'+cabinet.gold+' Gold':'Der Schrank ist leer'};
  }
  if(kind==='chest'){
   live(p,index(f.chests,i),103);
   if(p.opened.includes(i)||i===f.trialIndex)fail('Diese Truhe wurde bereits besucht.');
   p.opened.push(i);const gold=22+Math.floor(run.random(sim.state.dungeonSeed^(i*10631+31))()*15)+floorNumber()*4;
   p.gold+=gold;heal(p,12);return {notice:'Truhe geöffnet · +'+gold+' Gold'};
  }
  fail('Hier gibt es nichts zu untersuchen.');
 }
 function dispatch(p,kind,data){
  if(p.quiz&&!['answer','review'].includes(kind))fail('Beende zuerst das Quiz.');
  let result;
  switch(kind){
   case 'interact':result=interact(p,data.kind,data.index);break;
   case 'quiz':result=quiz(p,data.reason,data.index);break;
   case 'answer':result=answer(p,data);break;
   case 'review':result=review(p,data);break;
   case 'equip':case 'unequip':case 'consume':case 'drop':result=inventory(p,kind,data);break;
   case 'level':{
    if(!p.pendingLevels||!stats.includes(data.attribute))fail('Kein freier Attributpunkt verfügbar.');
    p.pendingLevels--;p.attributes[data.attribute]++;if(data.attribute==='vigor')heal(p,3);preparePlayer(p);result={};break;
   }
   case 'buy':{
    live(p,sim.floor.merchant);const offer=Object.values(stock(p)).flat().find(row=>row.stock===data.stock);
    const currency=offer?.currency??'gold',sold=currency==='rubies'?p.mythicSold:p.shopSold;
    if(!offer||p[currency]<offer.price||sold.includes(offer.stock)||count(p)+(offer.bundle||1)>30)fail('Dieses Angebot ist nicht verfügbar.');
    for(let n=0;n<(offer.bundle||1);n++)p.inventory.push(item(offer.kind,offer.id,offer.rarity,offer.source));
    p[currency]-=offer.price;sold.push(offer.stock);result={stock:stock(p)};break;
   }
   case 'sell':{
    live(p,sim.floor.merchant);const it=index(p.inventory,data.index);
    if(!it||items.key(it)!==data.key||equipped(p,it))fail('Dieser Gegenstand kann nicht verkauft werden.');
    p.inventory.splice(data.index,1);p.gold+=Math.max(1,Math.floor(items.price(it,1)*(p.equipment.rings.includes('luck')?.55:.4)));result={stock:stock(p)};break;
   }
   case 'brew':{
    live(p,sim.floor.lab);const i=p.inventory.findIndex(o=>o.kind==='cup');
    if(i<0||!p.brewEffects.length)fail('Dir fehlen Zutaten oder ein Becher.');
    const bones=Number.isInteger(data.bones)?Math.max(0,Math.min(data.bones,p.bones,10)):0;
    const duration=brewing.seconds+bones*60,brew=p.brewEffects,rarity=brew.reduce((a,e)=>items.rarity[e.rank].power>items.rarity[a].power?e.rank:a,'common');
    const potion={...item('potion',duration+'-'+brew.map(e=>e.id+'-'+e.rank).join('-'),rarity,'Brauerei'),brew,duration};
    p.inventory.splice(i,1,potion);p.bones-=bones;p.brewEffects=[];result={item:potion};break;
   }
   case 'well':{
    live(p,sim.floor.wellUse);const it=index(p.inventory,data.index);
    if(!it||items.key(it)!==data.key||!['weapon','armor'].includes(it.kind)||equipped(p,it)||p.wellOffer||floorNumber()>=run.LAST_DEPTH||!items.upgradeRank(it))fail('Diese Gabe ist nicht möglich.');
    p.wellOffer={...it,rarity:items.upgradeRank(it),source:'Magischer Brunnen'};p.inventory.splice(data.index,1);result={notice:'Der Brunnen nimmt deine Gabe an.'};break;
   }
   default:fail('Unbekannte Aktion.');
  }
  p.revision++;return result;
 }
 return {dispatch,finishTrial,publicQuiz};
}
