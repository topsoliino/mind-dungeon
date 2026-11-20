window.DungeonHeroArt=(()=>{
 'use strict';
 const size=64,displaySize=74,origin=48/displaySize;
 const equipment=window.DungeonEquipmentArt,brush=window.DungeonArt.brush;
 const slots=['helmet','chest','legs','boots'];
 const pieces=new Map(window.DungeonItems.armorItems.map(item=>[item.id,item]));
 const ink='#221d28',leather='#664836',gold='#e4ba80';
 const tau=Math.PI*2,octant=Math.PI/4;
 const views={
  south:{spread:1,turn:0,back:false},
  southeast:{spread:.83,turn:.56,back:false},
  east:{spread:.49,turn:1,back:false},
  northeast:{spread:.78,turn:.59,back:true},
  north:{spread:1,turn:0,back:true}
 };
 const compass=['east','southeast','south','southeast','east','northeast','north','northeast'];
 const sequences={idle:2,walk:8,dash:5,attack:4,charge:1,recoil:3,vault:4,fall:3,eat:1,drink:1};
 const stride=[0,3,5,3,0,-3,-5,-3],rise=[0,1,2,1,0,1,2,1];
 const maxSheetFrames=192;
 const clamp=(n,max)=>Math.max(0,Math.min(max,n));
 const color=(value,fallback)=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value:fallback;
 function direction(angle){
  const i=Number.isFinite(angle)?(Math.round(angle/octant)%8+8)%8:2;
  return {view:compass[i],flip:i>=3&&i<=5};
 }
 function appearance(look,armor){
  const ids=slots.map(slot=>{
   const item=pieces.get(armor?.[slot]);
   return item?.slot===slot?item.id:'';
  });
  return [look?.gender==='female',color(look?.skin,'#d4a785'),color(look?.hair,'#392b4e'),
   color(look?.color,'#755666'),...ids];
 }
 function outfit([female,skin,hair,cloth,...ids]){
  const armor=Object.fromEntries(ids.flatMap((id,i)=>{
   const item=pieces.get(id);
   return item?[[slots[i],{set:item.set,...equipment.armorLook(item.set)}]]:[];
  }));
  return {female,skin,hair,cloth,armor};
 }
 function canvas(width=size,height=size){
  const bitmap=document.createElement('canvas');
  bitmap.width=width;bitmap.height=height;
  return bitmap;
 }
 function drawCharacter(draw,look,view,action,frame,stage,stepping){
  const {g,r,poly}=draw,{female,skin,hair,cloth,armor}=look,{spread,turn,back}=view;
  const paint=(points,tint)=>poly(points.map(([x,y])=>[Math.round(x),Math.round(y)]),tint);
  const dot=(x,y,w,h,tint)=>r(Math.round(x),Math.round(y),w,h,tint);
  const walking=action==='walk'||stepping,consume=action==='eat'||action==='drink';
  const roll=action==='dash',air=action==='fall'||action==='vault';
  const drive=walking?stride[frame]:roll?[3,5,-4,-5,1][frame]:air?[2,4,-4,-2][frame]:0;
  const bob=walking?rise[frame]:0;
  const dip=roll?[2,5,9,6,2][frame]:action==='recoil'?[3,1,0][frame]:0;
  const lift=action==='vault'?[0,3,4,1][frame]:action==='fall'?frame:0;
  const lean=action==='attack'?[-2,1,3,1][frame]:roll?4:action==='recoil'?-(3-frame):0;
  const sway=Math.round(drive*.3),hip=32+Math.round(lean*turn*.45);
  const chest=hip+Math.round(lean*turn*.65),head=chest+Math.round(turn*2);
  const torsoY=27-bob+dip-lift-(action==='idle'?frame:0);
  const headY=torsoY-17;
  const shoulder=(female?10:12)*spread,waist=(female?6:8)*spread;
  const chestArmor=armor.chest,legs=armor.legs,boots=armor.boots,helmet=armor.helmet;
  const clothShade='#332637',band=chestArmor?.colors[4]??gold;
  const badgeAt=(piece,x,y)=>equipment.badge(draw,piece.set,Math.round(x),Math.round(y),piece.colors[4]);

  if(!air){
   paint([[14,50],[48,50],[54,53],[49,57],[15,57],[10,54]],'#120e18a0');
   paint([[22,51],[44,51],[48,54],[44,56],[20,56],[17,54]],'#100b16a8');
  }
  if(chestArmor){
   const tail=chestArmor.shape==='cloth'?13:chestArmor.shape==='hide'?9:7;
   const drift=Math.round(-4*turn+sway)+(roll?-5:0);
   paint([[chest-shoulder,torsoY+3],[chest+shoulder,torsoY+3],[hip+9+drift,44+tail-bob],
    [hip+1+drift,46+tail-bob],[hip-11+drift,43+tail-bob]],ink);
   paint([[chest-shoulder+2,torsoY+4],[chest+shoulder-2,torsoY+4],[hip+7+drift,43+tail-bob],
    [hip+1+drift,44+tail-bob],[hip-9+drift,42+tail-bob]],cloth);
   paint([[chest-shoulder+3,torsoY+5],[hip-2,37],[hip-3+drift,43+tail-bob],
    [hip-8+drift,42+tail-bob]],'#17131b68');
   paint([[hip+3+drift,43+tail-bob],[hip+7+drift,42+tail-bob],[hip+5,38],
    [hip+1,38]],'#f0dfcc42');
  }

  const leg=(side,near)=>{
   const x=hip+side*6*spread;
   const travel=side*drive,footX=x+Math.round(turn*travel*.94);
   const stepY=Math.round((back?-1:1)*(1-turn*.9)*travel*.67);
   const footY=51+stepY+(view===views.east&&near?2:0)-lift-(side*drive>0&&walking?1:0);
   const start=torsoY+12;
   const legBase=legs?.colors[near?1:0]??(near?'#947050':'#6f543e');
   const kneeBase=legs?.colors[near?2:1]??'#a78661';
   const outer=legs?.shape==='plate'?5:4;
   paint([[x-outer,start],[x+outer,start],[footX+4,footY],[footX-4,footY]],ink);
   paint([[x-outer+1,start],[x+outer-1,start],[footX+3,footY-1],[footX-3,footY-1]],legBase);
   paint([[x-2,start+1],[x+1,start+1],[footX,footY-4],[footX-2,footY-3]],kneeBase);
   if(legs?.shape==='plate'){
    paint([[footX-3,footY-10],[footX+2,footY-10],[footX+3,footY-7],[footX,footY-5],[footX-3,footY-7]],kneeBase);
    dot(footX-2,footY-10,4,1,legs.colors[3]);
   }else if(legs)dot(footX-3,footY-7,5,1,legs.colors[4]);
   const toe=Math.round(turn*(boots?.shape==='cloth'?5:3));
   const cuff=boots?footY-(boots.shape==='plate'?5:3):footY-1;
   const boot=boots?.colors??['#4b3029','#805b42','#af8962','#c8a17b',gold];
   paint([[footX-4,cuff],[footX+3,cuff],[footX+3,footY],[footX+5+toe,footY+2],
    [footX+4+toe,footY+5],[footX-5,footY+5],[footX-5,footY+1]],ink);
   paint([[footX-3,cuff+1],[footX+2,cuff+1],[footX+2,footY+1],[footX+4+toe,footY+2],
    [footX+3+toe,footY+4],[footX-4,footY+4],[footX-4,footY+1]],boot[near?1:0]);
   dot(footX-2,cuff+1,4,1,boot[near?3:2]);
   if(boots){
    dot(footX-2,footY+2,5+toe,1,boot[2]);
    if(boots.shape==='hide')dot(footX,cuff+2,2,1,boot[4]);
    if(boots.shape==='cloth')dot(footX+2,footY+1,2,2,boot[4]);
   }
  };

  const arm=(side,near)=>{
   const armorShape=chestArmor?.shape;
   const pad=armorShape==='plate'?5:armorShape==='hide'?4:3;
   const ax=chest+side*(shoulder+1),ay=torsoY+(near?2:1);
   const swing=near?drive:-drive;
   const bend=action==='attack'?[-1,3,5,2][frame]:action==='charge'?-3:roll?-3:0;
   let hx=ax+side*2+turn*swing*.6+turn*bend,hy=ay+11+Math.round(swing*(1-turn)*.55)-Math.abs(bend*.65);
   if(near&&consume){
    hx=head+[6,8,5,8][stage]+(back?2:0);
    hy=headY+[25,17,13,19][stage];
   }
   paint([[ax-pad,ay],[ax+pad,ay-1],[hx+3,hy-2],[hx+4,hy+3],[hx-3,hy+4],[hx-4,hy]],ink);
   paint([[ax-pad+1,ay+1],[ax+pad-1,ay],[hx+2,hy-3],[hx+1,hy],[hx-2,hy],[hx-3,hy-1]],
    chestArmor?.colors[near?1:0]??cloth);
   if(chestArmor){
    paint([[ax-pad+1,ay],[ax-2,ay-2],[ax+pad-1,ay-1],[ax+pad,ay+3],[ax-pad+1,ay+4]],
     chestArmor.colors[near?2:1]);
    dot(ax-pad+2,ay,Math.max(2,pad*2-3),1,chestArmor.colors[near?3:2]);
    if(armorShape==='plate')dot(hx-2,hy-3,5,2,chestArmor.colors[2]);
   }
   dot(hx-2,hy,5,3,skin);
   dot(hx+1,hy+1,2,2,'#613d395e');
   if(near&&consume){
    if(action==='drink'){
     const top=hy-(stage===2?1:7);
     paint([[hx-5,top],[hx-2,top-2],[hx+2,top-1],[hx+3,top+5],[hx+1,top+7],[hx-5,top+5]],ink);
     paint([[hx-4,top+1],[hx+1,top+1],[hx+2,top+5],[hx-4,top+5]],'#9c6aa5');
     dot(hx-3,top+1,5,1,'#ded4bd');dot(hx-3,top+3,2,2,'#d5b5d5');
    }else{
     paint([[hx-7,hy-2],[hx-5,hy-7],[hx,hy-8],[hx+2,hy-5],[hx+1,hy]],'#845234');
     dot(hx-4,hy-6,4,2,'#e4b779');
     if(stage===2)dot(hx-7,hy+1,2,1,'#e1b76d');
    }
   }
  };

  const nearSide=view===views.south||view===views.north?1:-1;
  leg(-nearSide,false);leg(nearSide,true);
  arm(-nearSide,false);
  paint([[chest-shoulder,torsoY],[chest-4,torsoY-2],[chest+5,torsoY-2],[chest+shoulder,torsoY+1],
   [hip+waist+2,torsoY+12],[hip+waist,torsoY+15],[hip-waist,torsoY+15],[hip-waist-2,torsoY+12]],ink);
  paint([[chest-shoulder+2,torsoY+1],[chest-3,torsoY-1],[chest+5,torsoY-1],[chest+shoulder-1,torsoY+2],
   [hip+waist,torsoY+12],[hip-waist,torsoY+13]],chestArmor?.colors[1]??cloth);
  paint([[chest-shoulder+2,torsoY+1],[chest-2,torsoY+1],[hip-1,torsoY+11],[hip-waist,torsoY+12]],
   chestArmor?.colors[2]??'#cca7a55a');
  if(chestArmor){
   const torsoFront=chest+Math.round(turn*3);
   if(chestArmor.shape==='plate'){
    paint([[torsoFront-waist,torsoY+3],[torsoFront,torsoY+1],[torsoFront+waist,torsoY+3],
     [torsoFront+waist-1,torsoY+9],[torsoFront,torsoY+12],[torsoFront-waist+1,torsoY+8]],chestArmor.colors[2]);
    dot(torsoFront-waist+2,torsoY+4,Math.max(4,Math.round(waist*2-3)),1,chestArmor.colors[3]);
    dot(hip-waist,torsoY+10,Math.max(5,Math.round(waist*2)),1,chestArmor.colors[0]);
   }else{
    paint([[chest-shoulder,torsoY+1],[chest-shoulder+4,torsoY],[hip+waist,torsoY+10],[hip+waist-1,torsoY+12]],
     chestArmor.shape==='hide'?leather:chestArmor.colors[3]);
    dot(torsoFront-2,torsoY+8,3,2,band);
   }
   if(!back||turn===0)badgeAt(chestArmor,torsoFront,torsoY+7);
   else dot(chest-3,torsoY+5,3,2,band);
  }else if(female){
   paint([[chest-shoulder+2,torsoY+3],[chest,torsoY+6],[chest+shoulder-2,torsoY+3],
    [chest+shoulder-3,torsoY+6],[chest,torsoY+9],[chest-shoulder+3,torsoY+5]],clothShade);
  }else dot(chest-3,torsoY+3,6,1,clothShade);
  dot(hip-waist,torsoY+12,Math.round(waist*2),2,leather);
  dot(hip+turn*3-1,torsoY+12,3,2,band);
  dot(head-3,headY+13,6,6,skin);

  const profile=view===views.east,headWidth=profile?8:female?8:9;
  const faceX=head+Math.round(turn*4);
  if(female&&(!helmet||helmet.shape==='hide')){
   const tailX=head-5-turn*5+sway;
   paint([[head-7,headY+8],[head-3,headY+13],[tailX+4,headY+23],[tailX+1,headY+28],
    [tailX-4,headY+24],[tailX-4,headY+17]],ink);
   paint([[head-6,headY+9],[head-4,headY+14],[tailX+3,headY+22],[tailX+1,headY+26],
    [tailX-3,headY+23],[tailX-2,headY+16]],hair);
   dot(tailX-2,headY+22,4,1,gold);
  }
  const skull=[[head-headWidth,headY+4],[head-5,headY],[head+4,headY],[head+headWidth,headY+4],
   [head+headWidth,headY+11],[faceX+3,headY+16],[faceX-4,headY+16],[head-headWidth,headY+12]];
  paint(skull,ink);
  paint([[head-headWidth+1,headY+5],[head-4,headY+1],[head+4,headY+1],[head+headWidth-1,headY+5],
   [head+headWidth-1,headY+11],[faceX+2,headY+15],[faceX-3,headY+15],[head-headWidth+1,headY+11]],hair);
  if(!back){
   paint([[faceX-(profile?5:7),headY+7],[head+headWidth-1,headY+5],[head+headWidth,headY+10],
    [faceX+4,headY+14],[faceX+1,headY+16],[faceX-4,headY+14]],skin);
   if(!profile)dot(faceX-4,headY+9,2,2,ink);
   dot(faceX+(profile?0:3),headY+8,2,2,ink);
   dot(faceX,headY+13,3,1,'#81534c');
   if(profile)dot(head+headWidth-1,headY+10,3,2,skin);
   dot(head-5,headY+6,3,5,hair);
  }else{
   dot(head-4,headY+3,7,1,'#e9c8b64d');
   dot(head+headWidth-2,headY+9,2,4,hair);
   if(turn)dot(head+headWidth-1,headY+9,2,3,skin);
  }
  if(helmet){
   const [shade,base,mid,light,accent]=helmet.colors;
   const shapeX=profile?.69:.78;
   const crown=helmet.crown.map(([x,y])=>[head+(x-16)*shapeX,headY+(y-5)*.69-1]);
   paint(crown,ink);
   paint(crown.map(([x,y])=>[x+Math.sign(head-x),y+Math.sign(headY+7-y)]),base);
   paint([[head-7,headY+5],[head-4,headY],[head+2,headY],[head+6,headY+4],
    [head+2,headY+3],[head-4,headY+4],[head-6,headY+8]],mid);
   dot(head-3,headY+2,6,1,light);
   if(back){
    dot(head-6,headY+12,12,2,shade);dot(head-5,headY+12,9,1,mid);
    if(helmet.shape==='plate')dot(head,headY+4,1,7,light);
   }else{
    const left=profile?faceX-3:head-6,right=head+(profile?8:7);
    paint([[left,headY+6],[right-1,headY+6],[right,headY+8],[right-1,headY+11],
     [left+1,headY+11],[left,headY+9]],shade);
    dot(left+1,headY+7,Math.max(3,right-left-2),2,ink);
    if(helmet.shape==='plate'){
     dot(faceX-1,headY+11,2,4,mid);dot(faceX-1,headY+10,2,1,light);
    }else{
     dot(faceX-2,headY+9,Math.min(5,right-faceX+2),3,skin);
     dot(faceX+(profile?0:1),headY+9,2,1,ink);
    }
   }
   dot(head-4,headY+4,7,1,accent);
   if(helmet.set==='emberheart')dot(head-1,headY+5,2,1,'#fff1b6');
  }
  arm(nearSide,true);
 }
 function sheet(look,view,action,stage,stepping){
  const count=stepping?stride.length:sequences[action],bitmap=canvas(size*count),draw=brush(bitmap);
  for(let i=0;i<count;i++){
   draw.g.setTransform(1,0,0,1,i*size,0);
   draw.g.save();draw.g.beginPath();draw.g.rect(0,0,size,size);draw.g.clip();
   drawCharacter(draw,look,view,action,i,stage,stepping);
   draw.g.restore();
  }
  return {bitmap,count};
 }
 function bank(prefix){
  let previous=[],look,frames=0,lastKey='';
  const sheets=new Map();
  function get(character,armor,angle,action,time,stage=0,stepping=false,textures){
   const next=appearance(character,armor);
   if(next.some((value,i)=>value!==previous[i])){
    for(const row of sheets.values())if(textures?.exists(row.key))textures.remove(row.key);
    sheets.clear();frames=0;lastKey='';previous=next;look=outfit(next);
   }
   const {view,flip}=direction(angle);
   const key=[prefix,view,action,stage,Number(stepping)].join('-');
   let row=sheets.get(key);
   if(!row){
    row={key,...sheet(look,views[view],action,stage,stepping)};
    while(frames+row.count>maxSheetFrames){
     const oldest=sheets.values().next().value;
     if(textures?.exists(oldest.key))textures.remove(oldest.key);
     frames-=oldest.count;sheets.delete(oldest.key);
    }
    frames+=row.count;
   }
   if(lastKey!==key){sheets.delete(key);sheets.set(key,row);lastKey=key;}
   if(textures&&!textures.exists(key)){
    const texture=textures.addCanvas(key,row.bitmap);
    for(let i=0;i<row.count;i++)texture.add(i,0,i*size,0,size,size);
    texture.setFilter(1); // Phaser's nearest-neighbor texture filter.
   }
   const loop=stepping||action==='walk'||action==='idle';
   const index=loop?Math.floor(Math.max(0,time))%row.count:clamp(Math.floor(time*row.count),row.count-1);
   return {bitmap:row.bitmap,key,index,flip};
  }
  return {get};
 }
 function draw(ctx,frame,x,y,width,height){
  ctx.save();
  if(frame.flip){ctx.translate(x+width,y);ctx.scale(-1,1);x=0;y=0;}
  ctx.drawImage(frame.bitmap,frame.index*size,0,size,size,x,y,width,height);
  ctx.restore();
 }
 const walkFrame=walk=>Math.max(0,walk||0)*stride.length/tau;
 return {bank,draw,direction,walkFrame,size,displaySize,origin};
})();
