import {randomUUID} from 'node:crypto';
import {run,items,foes,brewing,expedition,pools,item,cup,TILE,gap,maxHP,preparePlayer,stats,xpRequired,equipped,equip,unequip,correct,selectLoot} from './rules.mjs';

const fail=message=>{throw new Error(message);};
const index=(list,i)=>Number.isInteger(i)&&i>=0?list[i]:undefined;
const heal=(p,n)=>{p.hp=Math.min(maxHP(p),p.hp+n);};
const personalFields=['inventory','equipment','attributes','xp','level','pendingLevels','gold','bones','rubies','kills','solved','questionCount','questionReview','questionSeen','opened','searched','altarUses','gateQuestions','boneClaims','rubyClaims','templeAttempts','trials','cupClaimed','shopSold','mythicSold','brewEffects','merchantMapFound','wellOffer','wellUsed','activeBrew','combatRecord','playtime','armorCooldowns','trialCharmActive','madnessUntil'];
export function personal(p){
 return {revision:p.revision,character:p.appearance,...Object.fromEntries(personalFields.map(key=>[key,p[key]]))};
}
export function actions(sim){
 const near=(p,site,limit=96)=>Boolean(site&&gap(p,site)<=limit&&!sim.floor.gateLineBlocked(p.x,p.y,site.x,site.y));
 const live=(p,site,limit)=>{if(!near(p,site,limit))fail('Du bist zu weit entfernt.');};
 const count=p=>p.inventory.length;
 const floorNumber=()=>sim.state.floor;
 function chestFoley(pos,gold=false){
  sim.sound('chest_latch',pos,{gain:.72,priority:2});
  sim.sound('chest_lid',pos,{gain:.78,priority:2,delay:.16});
  if(gold)sim.sound('loot_gold',pos,{gain:.64,delay:.34});
 }

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
 const brewStock=(p,vessel)=>brewing.stock(sim.state.dungeonSeed,floorNumber(),p.equipment.rings.includes('brewer'),run.random,run.shuffle,vessel);
 function brewVessel(p,requested){
  const id=requested??'cup';
  const i=p.inventory.findIndex(it=>it.kind==='cup'&&it.id===id);
  if(i<0||!['cup',brewing.goldenCup.id].includes(id))fail('Du hast diesen Becher nicht.');
  return {id,i};
 }
 function quiz(p,reason,i,vessel){
  if(p.quiz)fail('Ein Quiz läuft bereits.');
  const floor=sim.floor;
  let zone=i,options=p.pack.questions,exclude=[];
  if(reason==='access'){
   const site=floor.accessSite(p,i);
   if(!site||floor.accessState(site)!=='quiz')fail('Dieses Siegel ist nicht verfügbar.');
   if(sim.activePlayers().some(other=>other.quiz?.reason==='access'&&other.quiz.i===i))fail('Das Siegel wird bereits geprüft.');
   zone=0;
  }else if(reason==='gate'){
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
   vessel=brewVessel(p,vessel).id;
   const offer=brewStock(p,vessel).find(e=>e.id===i);
   if(!offer||p.brewEffects.length>=brewing.capacity(vessel)||p.brewEffects.some(e=>e.id===i))fail('Die Zutat ist nicht verfügbar.');
  }else if(reason==='trial'){
   if(!items.isTrial(p,i,floor.trialIndex)||p.opened.includes(i)||p.trials[i]&&p.trials[i]!=='started'||p.trial&&p.trial.index!==i)fail('Diese Prüftruhe wurde bereits geöffnet.');
   live(p,index(floor.chests,i),104);
   exclude=p.trial?.used??[];
  }else if(reason==='study'){
   options=options.filter(q=>q.id===i&&q.image);
  }else fail('Unbekanntes Quiz.');
  if(!options.length)fail('In diesem Fragenpaket gibt es keine passende Frage.');
  const topical=reason==='gate'||reason==='shrine'?(run.roomTopics(p.pack,floorNumber(),sim.seed)[zone]??[]).flatMap(group=>group.questions):[];
  const trialDeck=reason==='trial'?run.orderQuestions(options.filter(q=>!exclude.includes(q.id)),p,sim.seed):null;
  const source=reason==='study'?options[0]:trialDeck?trialDeck[0]:run.nextQuestion(options,topical,exclude,p,sim.seed);
  if(!source&&reason==='gate'){
   sim.state.gates[i]=true;
   return {notice:'Wissenstor geöffnet · keine fällige unbenutzte Lernkarte'};
  }
  if(!source)fail('Es sind gerade keine weiteren Fragen verfügbar.');
  if(reason==='trial'&&!p.trial){
   p.trial={index:i,deadline:sim.clock+40,correct:0,target:Math.min(3,trialDeck.length),used:[],passed:false};
   p.trials[i]='started';
  }
  const order=run.shuffleOptions(source),q=run.presentQuestion(source,order);
  p.quiz={id:randomUUID(),q,order,reason,i,vessel,answered:false};p.chargeStart=null;p.dash=0;
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
  (p.questionSeen??={})[q.id]=p.questionCount;
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
  if(reason==='access'){
   const site=[...sim.floor.links,...sim.floor.doors].find(candidate=>candidate.seal===i);
   const state=sim.floor.resolveAccess(site,ok);
   notice=state==='open'?'Prüfsiegel geöffnet':'Falsch · Zugang dauerhaft versiegelt';
  }
  if(reason==='shrine'){
   (p.altarQuestions[i]??=[]).push(q.id);p.altarUses[i]=(p.altarUses[i]??0)+1;
  }
  if(reason==='gate'&&ok){
   (p.gateQuestions[i]??=[]).push(q.id);
   const count=(sim.state.gateProgress[i]??0)+1;sim.state.gateProgress[i]=count;
   if(count>=Math.min(2,p.pack.questions.length)){
    sim.state.gates[i]=true;notice='Wissenstor geöffnet';
    const gate=sim.floor.gates.find(g=>g.id===i);
    if(gate)sim.sound('gate_stone_motion',{x:(gate.x+.5)*TILE,y:(gate.y+.5)*TILE},{gain:.68,priority:2});
   }else more=true;
  }
  if(reason==='brew'&&ok){
   const entry=brewStock(p,qz.vessel).find(e=>e.id===i);
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
  if(reason!=='study'&&reason!=='trial'&&reason!=='brew'&&reason!=='access'){
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
   p.gold+=48+floorNumber()*9;chestFoley(pos,true);
   sim.drop(pos,selectLoot(items.challengeRarity(floorNumber(),sim.random()),floorNumber(),sim.random),p.seat);
   sim.emit('notice',{message:'Prüftruhe bestanden'},p.seat);return;
  }
  const desk=sim.floor.rooms[trial.index];
  const places=[[2,2],[desk.w-3,3],[desk.w-3,desk.h-3]].map(([dx,dy])=>sim.floor.accessiblePoint((desk.x+dx+.5)*TILE,(desk.y+dy+.5)*TILE));
  places.forEach((place,i)=>{
   if(!sim.floor.canReachSpawn(place.x,place.y)||!sim.floor.valid(place.x,place.y,12,true)||sim.enemies.some(e=>gap(e,place)<23))return;
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
  const bones=orb.item.kind==='bones';
  if(!bones&&count(p)>=30)fail('Dein Inventar ist voll.');
  live(p,orb,68);
  if(bones)p.bones+=orb.item.bundle===3?3:1;
  else p.inventory.push(orb.item);
  sim.orbs.delete(id);
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
   if(it.kind==='trialCharm'){
    if(!items.markTrials(p,sim.floor.chests.length,floorNumber()<run.LAST_DEPTH))fail('Das Prüfsiegel kann gerade nicht eingesetzt werden.');
    p.inventory.splice(data.index,1);
    return {item:it,notice:'Alle übrigen Truhen im Lauf sind jetzt Prüftruhen.'};
   }
   if(p.consume||!['food','potion'].includes(it.kind)||it.kind==='food'&&p.hp>=maxHP(p))fail('Du kannst das gerade nicht verwenden.');
   p.inventory.splice(data.index,1);p.consume={item:it,start:sim.clock,end:sim.clock+(it.kind==='food'?.69:.82)};
  }
  preparePlayer(p);p.stamina=Math.min(p.stamina,p.staminaMax);
  return {item:it};
 }
 function interact(p,kind,i){
  const f=sim.floor;
  if(kind==='strata'){
   const link=f.nearestLink(p,i);
   if(!link||f.accessState(link)!=='open'||p.consume||p.vault||p.travelLock>0)fail('Dieser Übergang ist gerade nicht erreichbar.');
   sim.travel(p,link);
   return {link:link.kind};
  }
  if(kind==='merchant'){live(p,f.merchant);return {stock:stock(p)};}
  if(kind==='brewery'){live(p,f.lab);return {};}
  if(kind==='crypt-altar'){
   live(p,f.cryptAltar,86);
   if(!brewing.transmute(p.inventory))fail('Der Krypta-Altar braucht drei leere Becher.');
   sim.sound('world_well_reward',f.cryptAltar,{priority:2});
   return {item:brewing.goldenCup,notice:'Goldenen Becher erhalten'};
  }
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
   if(cabinet.gold)sim.sound('loot_gold',cabinet,{gain:.58});
   return {notice:cabinet.gold?'Schrank durchsucht · +'+cabinet.gold+' Gold':'Der Schrank ist leer'};
  }
  if(kind==='chest'){
   const chest=index(f.chests,i);live(p,chest,103);
   if(p.opened.includes(i)||items.isTrial(p,i,f.trialIndex))fail('Diese Truhe wurde bereits besucht.');
   p.opened.push(i);const gold=22+Math.floor(run.random(sim.state.dungeonSeed^(i*10631+31))()*15)+floorNumber()*4;
   p.gold+=gold;heal(p,12);chestFoley(chest,true);return {notice:'Truhe geöffnet · +'+gold+' Gold'};
  }
  fail('Hier gibt es nichts zu untersuchen.');
 }
 function dispatch(p,kind,data){
  if(p.quiz&&!['answer','review'].includes(kind))fail('Beende zuerst das Quiz.');
  let result;
  switch(kind){
   case 'interact':result=interact(p,data.kind,data.index);break;
   case 'quiz':result=quiz(p,data.reason,data.index,data.vessel);break;
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
    live(p,sim.floor.lab);const {id,i}=brewVessel(p,data.vessel);
    const available=brewStock(p,id),cap=brewing.capacity(id);
    if(!p.brewEffects.length||p.brewEffects.length>cap||p.brewEffects.some(e=>!available.some(o=>o.id===e.id)))fail('Dir fehlen passende Zutaten.');
    if(id===brewing.goldenCup.id&&p.brewEffects.length!==cap)fail('Der Goldene Becher braucht alle sechs Zutaten.');
    const bones=Number.isInteger(data.bones)?Math.max(0,Math.min(data.bones,p.bones,10)):0;
    const duration=brewing.duration(id,bones),brew=p.brewEffects,rarity=brew.reduce((a,e)=>items.rarity[e.rank].power>items.rarity[a].power?e.rank:a,'common');
    const potion={...item('potion',duration+'-'+brew.map(e=>e.id+'-'+e.rank).join('-'),rarity,'Brauerei'),brew,duration};
    p.inventory.splice(i,1,potion);p.bones-=bones;p.brewEffects=[];
    sim.sound('brew_pour',sim.floor.lab,{gain:.81,priority:2});result={item:potion};break;
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
