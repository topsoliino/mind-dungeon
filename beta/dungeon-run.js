window.DungeonRun = (() => {
 'use strict';
 const LAST_DEPTH=5, DEFAULT_PACK='kvt3-konfrontationsverfahren';
 const W=56,H=64,REST_ID=15;
 // Shape offsets from a room corner, reflected independently on each axis.
 const partitionPlans=[
  [[0,0],[1,0],[2,0]],
  [[0,0],[1,0],[2,0],[2,1]],
  [[0,0],[1,0],[2,0],[3,0]],
  [[0,0],[1,0],[1,1],[1,2]]
 ];
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
 function generate(seed,varied=true,revision=4){
  const rng=random(seed);
  const cells=Array.from({length:6},(_,i)=>({col:i%3,row:i/3|0}));
  const adjacent=(a,b)=>Math.abs(a.col-b.col)+Math.abs(a.row-b.row)===1;
  // Removing a corner leaves a connected set of five cells. The randomized
  // spanning tree leaves every room reachable through exactly one entry seal.
  cells.splice([0,2,3,5][Math.floor(rng()*4)],1);
  shuffle(cells,rng);
  const hasRest=revision>=3, offset=hasRest?13:0;
  if(hasRest&&cells[0].row!==0){
   const top=cells.findIndex(cell=>cell.row===0);
   [cells[0],cells[top]]=[cells[top],cells[0]];
  }
  const rooms=cells.map(({col,row},i)=>{
   const [w,h]=sizes[i],cx=9+col*18,cy=9+row*17+offset;
   return {x:cx-(w>>1),y:cy-(h>>1),w,h,cx,cy,i};
  });
  if(varied){
   const shape=random(seed^0x4caeb671);
   for(const room of rooms){
    const centerX=room.cx,centerY=room.cy;
    room.w+=Math.floor(shape()*3);room.h+=Math.floor(shape()*3);
    room.x=centerX-(room.w>>1);room.y=centerY-(room.h>>1);
   }
  }
  const height=hasRest?H:52;
  const map=Array.from({length:height},()=>Array(W).fill(1));
  const terrain=Array.from({length:height},()=>Array(W).fill(null));
  const style=random(seed^0x9a19ac27);
  const regions=Array.from({length:height},()=>Array(W).fill(-1));
  const carve=({x,y,w,h},id)=>{
   for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){map[j][i]=0;regions[j][i]=id;}
  };
  for(const room of rooms){
   carve(room,room.i);
   if(revision<2)continue;
   // Chamfer opposing corners while leaving all four possible doorways free.
   const corners=style()<.5?[[-1,-1],[1,1]]:[[1,-1],[-1,1]];
   for(const [sx,sy] of corners){
    const x=sx<0?room.x:room.x+room.w-1,y=sy<0?room.y:room.y+room.h-1;
    for(const [a,b] of [[x,y],[x-sx,y],[x,y-sy]]){map[b][a]=1;regions[b][a]=-1;}
   }
   if(room.i>0){
    const right=style()<.5,x=right?room.x+room.w-3:room.x+2;
    const top=style()<.5,y=top?room.y+2:room.y+room.h-3;
    if(revision<4){
     for(let i=0;i<2;i++){map[y][x+(right?-i:i)]=1;terrain[y][x+(right?-i:i)]='partition';}
    }else{
     const plan=partitionPlans[Math.floor(style()*partitionPlans.length)];
     for(const [dx,dy] of plan){
      const px=x+(right?-dx:dx),py=y+(top?dy:-dy);
      map[py][px]=1;terrain[py][px]='partition';
     }
    }
   }
  }
  const visited=new Set([0]),corridors=[],gates=[];
  while(visited.size<rooms.length){
   const candidates=[];
   for(const from of visited)for(const to of rooms.keys()){
    if(!visited.has(to)&&adjacent(cells[from],cells[to]))candidates.push([from,to]);
   }
   const [from,to]=candidates[Math.floor(rng()*candidates.length)],a=rooms[from],b=rooms[to];
   const vertical=a.cy===b.cy;
   const [first,last]=[a,b].sort((p,q)=>vertical?p.x-q.x:p.y-q.y);
   const step=corridors.length;
   const breadth=revision<2?3:step===0?3:step===1?2:step===2?5:3;
   const lane=Math.floor(breadth/2);
   const corridor=vertical
    ? {x:first.x+first.w,y:first.cy-lane,w:last.x-first.x-first.w,h:breadth}
    : {x:first.cx-lane,y:first.y+first.h,w:breadth,h:last.y-first.y-first.h};
   const id=rooms.length+corridors.length;
   const [gateId,name,color]=gateStyles[to];
   const x=vertical?corridor.x+Math.floor(corridor.w/2):a.cx;
   const y=vertical?a.cy:corridor.y+Math.floor(corridor.h/2);
   carve(corridor,id);
   corridors.push({...corridor,id,from,to,vertical});
   if(revision<2||step===0||step===3&&style()<.45)gates.push({id:gateId,x,y,vertical,from,to,name,color,corridorId:id});
   visited.add(to);
  }
  const climate=random(seed^0x832a79f1);
  const court=climate()<.5,rain=climate()<.5;
  const annexes=shuffle([
   {name:'Vorratskammer',key:'pantry',w:7,h:6,theme:3},
   {name:'Brauerei',key:'brewery',w:9,h:7,theme:1},
   ...(court?[{name:'Hof',key:'court',w:13,h:8,theme:5,rain}]:[])
  ],climate).map((annex,col)=>{
   const parent=rooms.filter(room=>room.cx===9+col*18).sort((a,b)=>b.cy-a.cy)[0];
   const x=parent.cx-(annex.w>>1),y=41+offset,id=9+col*2;
   const support={...annex,x,y,id,cx:parent.cx,cy:y+(annex.h>>1)};
   const start=parent.y+parent.h;
   carve({x:parent.cx-1,y:start,w:3,h:y-start},id+1);
   carve(support,id);
   return {...support,passage:{id:id+1,x:parent.cx-1,y:start,w:3,h:y-start,from:parent.i,vertical:false}};
  });
  if(revision>=2){
   const crossings=shuffle(corridors.filter(c=>!gates.some(g=>g.corridorId===c.id)),style);
   for(const [i,c] of crossings.slice(0,style()<.58?2:1).entries()){
    const water=i===1, span=c.vertical?c.w:c.h;
    for(let distance=0;distance<span;distance++){
     for(let lane=-3;lane<(c.vertical?c.h:c.w)+3;lane++){
      const x=c.x+(c.vertical?distance:lane),y=c.y+(c.vertical?lane:distance);
      if(map[y]?.[x]===undefined)continue;
      if(regions[y][x]===c.id)terrain[y][x]=c.vertical?'bridge-x':'bridge-y';
      else if(map[y][x]===1&&!terrain[y][x]){terrain[y][x]=water?'river':'abyss';regions[y][x]=c.id;}
     }
    }
   }
  }
  let rest=null;
  if(hasRest){
   const anchor=rooms[0], y=2,w=11,h=8,cx=anchor.cx;
   const passage={id:REST_ID+1,x:cx-1,y:y+h,w:3,h:anchor.y-y-h,from:0,vertical:false};
   rest={name:'Ruheraum',key:'rest',id:REST_ID,x:cx-(w>>1),y,w,h,cx,cy:y+4,theme:3,passage};
   carve(rest,rest.id);carve(passage,passage.id);annexes.push(rest);
  }
  return {rooms,corridors,map,regions,gates,annexes,terrain,rest};

 }
 function differentLayoutSeed(seed,rooms,gates){
  const signature=(r,g)=>r.map(p=>[p.x,p.y,p.w,p.h].join(':')).join('|')+'/'+g.map(p=>p.from+':'+p.to).sort().join('|');
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
 function packTopics(raw){
  const groups=new Map();
  for(const category of raw.categories??[]){
   if(!nonempty(category?.id)||!nonempty(category.title)||groups.has(category.id)||!Array.isArray(category.subcategories))
    throw Error('Jede Kategorie braucht eine eindeutige ID, einen Titel und Unterkategorien.');
   const children=new Map();
   for(const sub of category.subcategories){
    if(!nonempty(sub?.id)||!nonempty(sub.title)||children.has(sub.id))
     throw Error('Unterkategorien brauchen eine eindeutige ID und einen Titel.');
    children.set(sub.id,{id:sub.id,title:sub.title.trim()});
   }
   groups.set(category.id,{id:category.id,title:category.title.trim(),subcategories:[...children.values()]});
  }
  return groups;
 }
 function figure(raw){
  if(raw==null)return undefined;
  const {src,alt,caption}=raw;
  const asset=typeof src==='string'&&/^questions\/figures\/[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(src);
  const embedded=typeof src==='string'&&src.length<350000&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src);
  if((!asset&&!embedded)||!nonempty(alt))throw Error('Ein Fragenbild braucht einen gültigen Bildpfad oder eingebettete Bilddaten und einen Alternativtext.');
  return {src,alt,caption:nonempty(caption)?caption.trim():undefined};
 }
 function validatePack(raw){
  if(!Array.isArray(raw?.questions)||!raw.questions.length)throw Error('Keine Fragen im Paket gefunden.');
  if(raw.categories!=null&&!Array.isArray(raw.categories))throw Error('Kategorien müssen eine Liste sein.');
  const groups=packTopics(raw),structured=groups.size>0;
  const ids=new Set();
  const questions=raw.questions.map((q,i)=>{
   if(!nonempty(q?.id)||q.id.trim() in Object.prototype||ids.has(q.id.trim())||!nonempty(q.prompt)||typeof q.explanation!=='string'){
    throw Error('Frage '+(i+1)+' braucht eine eindeutige ID, einen Fragetext und eine Erklärung.');
   }
   const id=q.id.trim();ids.add(id);
   const legacyTopic=nonempty(q.topic)?q.topic.trim():'Allgemein';
   const categoryId=structured?q.categoryId:legacyTopic;
   const subcategoryId=structured?q.subcategoryId:legacyTopic;
   if(!structured&&!groups.has(categoryId))
    groups.set(categoryId,{id:categoryId,title:legacyTopic,subcategories:[{id:subcategoryId,title:legacyTopic}]});
   const category=groups.get(categoryId),sub=category?.subcategories.find(entry=>entry.id===subcategoryId);
   if(!sub)throw Error('Frage '+(i+1)+' verweist auf eine unbekannte Unterkategorie.');
   const question={id,categoryId,subcategoryId,topic:sub.title,prompt:q.prompt,explanation:q.explanation,image:figure(q.image),
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
  return {schemaVersion:2,categories:[...groups.values()],packId,title:nonempty(raw.title)?raw.title.trim():'Importierter Fragenpool',questions};
 }
 function roomTopics(pack,depth){
  if(!pack)return Array.from({length:sizes.length},()=>[]);
  const byCategory=new Map();
  for(const question of pack.questions){
   if(!byCategory.has(question.categoryId))byCategory.set(question.categoryId,[]);
   byCategory.get(question.categoryId).push(question);
  }
  const groups=pack.categories.flatMap(category=>{
   const questions=byCategory.get(category.id);
   if(!questions?.length)return [];
   const children=category.subcategories.filter(sub=>questions.some(q=>q.subcategoryId===sub.id));
   return [{...category,subcategories:children,questions}];
  });
  if(!groups.length)return Array.from({length:sizes.length},()=>[]);
  const start=(depth-1)*(groups.length>sizes.length?sizes.length:1);
  return Array.from({length:sizes.length},(_,i)=>{
   const first=start+i;
   const indexes=[first%groups.length];
   for(let index=first+sizes.length*LAST_DEPTH;index<groups.length;index+=sizes.length*LAST_DEPTH)indexes.push(index);
   return indexes.map(index=>{
    const group=groups[index], sub=group.subcategories[(depth-1+Math.floor(i/groups.length))%group.subcategories.length];
    return {...group,activeSubcategory:sub,questions:group.questions.filter(q=>q.subcategoryId===sub.id)};
   });
  });
 }
 function floorState(seed,depth){
  return {dungeonSeed:seed,floor:depth,x:null,y:null,gates:{},gateProgress:{},gateQuestions:{},opened:[],
   defeated:[],explored:[REST_ID],portal:null,merchantMapFound:false,souls:[],shopSold:[],searched:[],trialIndex:null,trials:{},ambushes:[],variedRooms:true,stockedRooms:false,serpents:[],altarUses:{},altarQuestions:{},layoutRevision:4,wellOffer:null,brewIngredients:[],activeBrew:null,brewEffects:[]};
 }
 function freshRun(seed){
  return {...floorState(seed,1),solved:{},questionReview:{},questionCount:0,completed:false,floorVersion:1,depthSeeds:{}};
 }
 const runFields=[...Object.keys(freshRun(0))];
 function snapshot(save){
  return Object.fromEntries(runFields.map(key=>[key,save[key]]));
 }
 return {LAST_DEPTH,DEFAULT_PACK,W,H,generate,random,shuffle,freshSeed,nextSeed,differentLayoutSeed,validatePack,roomTopics,floorState,freshRun,snapshot};
})();
