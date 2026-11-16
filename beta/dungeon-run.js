window.DungeonRun = (() => {
 'use strict';
 const LAST_DEPTH=5, DEFAULT_PACK='kvt3-konfrontationsverfahren';
 const W=56,H=36;
 const sizes=[[11,9],[12,9],[14,10],[12,11],[14,11]];
 const gateStyles=[
  ['conditioning','Konditionierung','#8ce6c9'],['exposure','Exposition','#edb3ff'],
  ['ritual','Reaktionsverhinderung','#f4b66d'],['memory','Erinnerung','#80b7ff'],
  ['echo','Integration','#ff8fa9']
 ];
 function random(seed){
  let x=seed|0;
  return ()=>{x=(Math.imul(x,1664525)+1013904223)|0;return (x>>>0)/4294967296;};
 }
 function shuffle(list,rand){
  for(let i=list.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  return list;
 }
 function nextSeed(seed){return (Math.imul(seed,1664525)+1013904223)>>>0;}
 function freshSeed(){return crypto.getRandomValues(new Uint32Array(1))[0];}
 function generate(seed){
  const rng=random(seed);
  const cells=Array.from({length:6},(_,i)=>({col:i%3,row:i/3|0}));
  const adjacent=(a,b)=>Math.abs(a.col-b.col)+Math.abs(a.row-b.row)===1;
  // Removing a corner leaves a connected set of five cells. The randomized
  // spanning tree leaves every room reachable through exactly one entry seal.
  cells.splice([0,2,3,5][Math.floor(rng()*4)],1);
  shuffle(cells,rng);
  const rooms=cells.map(({col,row},i)=>{
   const [w,h]=sizes[i],cx=9+col*18,cy=9+row*17;
   return {x:cx-(w>>1),y:cy-(h>>1),w,h,cx,cy,i};
  });
  const map=Array.from({length:H},()=>Array(W).fill(1));
  const regions=Array.from({length:H},()=>Array(W).fill(-1));
  const carve=({x,y,w,h},id)=>{
   for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){map[j][i]=0;regions[j][i]=id;}
  };
  for(const room of rooms)carve(room,room.i);
  const visited=new Set([0]),corridors=[],gates=[];
  while(visited.size<rooms.length){
   const candidates=[];
   for(const from of visited)for(const to of rooms.keys()){
    if(!visited.has(to)&&adjacent(cells[from],cells[to]))candidates.push([from,to]);
   }
   const [from,to]=candidates[Math.floor(rng()*candidates.length)],a=rooms[from],b=rooms[to];
   const vertical=a.cy===b.cy;
   const [first,last]=[a,b].sort((p,q)=>vertical?p.x-q.x:p.y-q.y);
   const corridor=vertical
    ? {x:first.x+first.w,y:first.cy-1,w:last.x-first.x-first.w,h:3}
    : {x:first.cx-1,y:first.y+first.h,w:3,h:last.y-first.y-first.h};
   const id=rooms.length+corridors.length;
   const [gateId,name,color]=gateStyles[to];
   const x=vertical?corridor.x+Math.floor(corridor.w/2):a.cx;
   const y=vertical?a.cy:corridor.y+Math.floor(corridor.h/2);
   carve(corridor,id);
   corridors.push({...corridor,id,from,to});
   gates.push({id:gateId,x,y,vertical,from,to,name,color});
   visited.add(to);
  }
  return {rooms,corridors,map,regions,gates};
 }
 function differentLayoutSeed(seed,rooms,gates){
  const signature=(r,g)=>r.map(p=>p.x+':'+p.y).join('|')+'/'+g.map(p=>p.from+':'+p.to).sort().join('|');
  const old=signature(rooms,gates);
  let candidate=seed;
  for(let attempt=0;attempt<24;attempt++){
   candidate=nextSeed(candidate);
   const layout=generate(candidate);
   if(signature(layout.rooms,layout.gates)!==old)return candidate;
  }
  return freshSeed();
 }
 const nonempty=v=>typeof v==='string'&&v.trim().length>0;
 function validatePack(raw){
  if(!Array.isArray(raw?.questions)||!raw.questions.length)throw Error('Keine Fragen im Paket gefunden.');
  const ids=new Set();
  const questions=raw.questions.map((q,i)=>{
   if(!nonempty(q?.id)||q.id.trim() in Object.prototype||ids.has(q.id.trim())||!nonempty(q.prompt)||typeof q.explanation!=='string'){
    throw Error('Frage '+(i+1)+' braucht eine eindeutige ID, einen Fragetext und eine Erklärung.');
   }
   const id=q.id.trim();ids.add(id);
   const question={id,topic:nonempty(q.topic)?q.topic.trim():'Allgemein',prompt:q.prompt,explanation:q.explanation,
    difficulty:Number.isFinite(q.difficulty)?Math.max(1,Math.min(5,Math.round(q.difficulty))):1,type:q.type,
    source:{document:nonempty(q.source?.document)?q.source.document:'Fragenpaket',
     page:typeof q.source?.page==='string'||Number.isFinite(q.source?.page)?q.source.page:'–'}};
   if(q.type==='single-choice'&&Array.isArray(q.choices)&&q.choices.length>=2&&q.choices.every(nonempty)
      &&Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<q.choices.length){
    return {...question,choices:q.choices,correctIndex:q.correctIndex};
   }
   if(q.type==='free-text'&&Array.isArray(q.answers)&&q.answers.length&&q.answers.every(nonempty)){
    return {...question,answers:q.answers};
   }
   throw Error('Frage '+(i+1)+' hat ungültige Antwortoptionen.');
  });
  // A title may change with a revision. The pack ID keeps its trophy and run.
  const fingerprint=questions.map(q=>q.id+'\n'+q.prompt).sort().join('\n');
  let hash=2166136261;
  for(let i=0;i<fingerprint.length;i++)hash=Math.imul(hash^fingerprint.charCodeAt(i),16777619);
  const packId=nonempty(raw.packId)?raw.packId.trim():'import-'+(hash>>>0).toString(36);
  return {schemaVersion:1,packId,title:nonempty(raw.title)?raw.title.trim():'Importierter Fragenpool',questions};
 }
 function floorState(seed,depth){
  return {dungeonSeed:seed,floor:depth,x:null,y:null,gates:{},gateProgress:{},gateQuestions:{},opened:[],
   defeated:[],explored:[0],portal:null,merchantMapFound:false};
 }
 function freshRun(seed){
  return {...floorState(seed,1),solved:{},questionReview:{},questionCount:0,completed:false,floorVersion:1};
 }
 const runFields=[...Object.keys(freshRun(0))];
 function snapshot(save){
  return Object.fromEntries(runFields.map(key=>[key,save[key]]));
 }
 return {LAST_DEPTH,DEFAULT_PACK,W,H,generate,random,shuffle,freshSeed,nextSeed,differentLayoutSeed,validatePack,floorState,freshRun,snapshot};
})();
