(() => {
 'use strict';

 const themes={
  plaster:{front:['#ad8167','#755653'],side:['#6f545b','#4c3d4d'],roof:['#694151','#4f3449'],wood:'#4e353a',trim:'#c5a27b',shutter:'#46616a'},
  timber:{front:['#978777','#675750'],side:['#695d62','#443d50'],roof:['#504d63','#3a374d'],wood:'#413039',trim:'#b09d87',shutter:'#43565b'},
  stone:{front:['#858599','#555368'],side:['#5e6079','#3a3c53'],roof:['#475b68','#374050'],wood:'#3b3645',trim:'#a9a2a4',shutter:'#535568'},
  teal:{front:['#738881','#465b61'],side:['#526469','#353e50'],roof:['#664753','#443645'],wood:'#3d333f',trim:'#a7aa89',shutter:'#5d443e'}
 };
 const stoneColors=['#5c576c','#6c6676','#756b78','#615e72','#6d6473','#5a586c'];
 const range=(n,visit)=>{for(let i=0;i<n;i++)visit(i);};
 const atlas=new Image();
 const readyListeners=[];
 let atlasReady=false;
 atlas.onload=()=>{
  atlasReady=true;
  for(const listener of readyListeners)listener();
  readyListeners.length=0;
 };
 atlas.src=new URL('./art/alley/alley-materials.webp?v=1',document.currentScript.src).href;

 function material(ctx,index,w,h,opacity=1){
  if(!atlasReady)return false;
  ctx.save();
  ctx.globalAlpha*=opacity;
  ctx.drawImage(atlas,index%2*512,Math.floor(index/2)*512,512,512,0,0,w,h);
  ctx.restore();
  return true;
 }

 function create({project,polygon,line}){
  const point=(u,v,z)=>project(u,v,z);
  function plane(ctx,tl,tr,bl,width,height,draw){
   ctx.save();
   ctx.transform((tr[0]-tl[0])/width,(tr[1]-tl[1])/width,
    (bl[0]-tl[0])/height,(bl[1]-tl[1])/height,tl[0],tl[1]);
   draw(width,height);
   ctx.restore();
  }
  function color(ctx,fill,x,y,w,h){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);}
  function shade(ctx,x,y,w,h,top,bottom){
   const gradient=ctx.createLinearGradient(0,y,0,y+h);
   gradient.addColorStop(0,top);gradient.addColorStop(1,bottom);
   color(ctx,gradient,x,y,w,h);
  }
  function randomFor(seed){
   return ()=>{
    seed=(Math.imul(1664525,seed)+1013904223)>>>0;
    return seed/4294967296;
   };
  }
  function patina(ctx,w,h,seed){
   const random=randomFor(seed);
   ctx.save();
   ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
   range(Math.ceil(w*h/70),()=>{
    const x=random()*w,y=random()*h,r=random();
    if(r<.14){
     const tint=ctx.createRadialGradient(x,y,0,x,y,8+r*70);
     tint.addColorStop(0,'#31283a49');tint.addColorStop(1,'#31283a00');
     color(ctx,tint,x-18,y-18,36,36);
    }else{
     color(ctx,r>.58?'#f6d5a323':'#291d2c37',x,y,1+random()*3,.55+random());
    }
   });
   ctx.restore();
  }
  function masonry(ctx,w,h,seed,blockWidth=22,blockHeight=10){
   const random=randomFor(seed);
   for(let row=0,y=0;y<h;y+=blockHeight,row++){
    const actualHeight=Math.min(blockHeight,h-y);
    for(let x=(row%2)*blockWidth*.52-blockWidth;x<w;x+=blockWidth){
     const left=Math.max(0,x),right=Math.min(w,x+blockWidth);
     if(right-left<2)continue;
     const fill=stoneColors[Math.floor(random()*stoneColors.length)];
     polygon(ctx,[[left,y+2],[left+2,y+.5],[right-2,y+.5],[right,y+2],
      [right,y+actualHeight-1],[left,y+actualHeight-1]],fill);
     color(ctx,'#d5bcd03b',left+2,y+1,right-left-3,1);
     if(right-left>9&&random()>.62)line(ctx,[[left+4,y+5],[left+8,y+4],[left+13,y+5]],'#b0a5b134');
    }
   }
  }
  function wood(ctx,x,y,w,h,tone,grain=4){
   shade(ctx,x,y,w,h,tone,'#362733');
   for(let dx=2;dx<w;dx+=grain){
    color(ctx,'#281d2a73',x+dx,y,1,h);
    if(dx+1<w)color(ctx,'#e1b38425',x+dx+1,y,.8,h);
   }
  }
  function archTop(ctx,x,y,w,h){
   const cap=Math.min(w/2,h*.4);
   ctx.beginPath();
   ctx.moveTo(x,y+h);ctx.lineTo(x,y+cap);
   ctx.quadraticCurveTo(x,y,x+w/2,y);
   ctx.quadraticCurveTo(x+w,y,x+w,y+cap);
   ctx.lineTo(x+w,y+h);ctx.closePath();
  }
  function windowBay(ctx,x,y,w,h,theme,lit,shutters){
   color(ctx,'#29243382',x-2,y-2,w+4,h+5);
   color(ctx,theme.trim,x-1,y-1,w+2,h+2);
   shade(ctx,x,y,w,h,lit?'#c38b57':'#3e4153',lit?'#674256':'#202531');
   if(shutters){
    wood(ctx,x-5,y,4,h,theme.shutter,2);
    wood(ctx,x+w+1,y,4,h,theme.shutter,2);
   }
   color(ctx,'#3b2b36',x+w/2-.65,y,1.3,h);
   color(ctx,'#3b2b36',x,y+h*.54,w,1.15);
   color(ctx,'#d1b192',x-3,y+h,w+6,1.6);
   color(ctx,'#362b3a',x-3,y+h+1.6,w+6,2.1);
  }
  function doorway(ctx,x,h,t,gateWidth){
   // Doors must read as full-height entrances beside the guardian, not tiny wall ornaments.
   // Keep the base flush with the ground; only the upper opening changes with building height.
   const w=gateWidth,doorHeight=Math.min(79,Math.max(64,h*.62)),y=h-doorHeight;
   archTop(ctx,x-w/2-4,y-4,w+8,doorHeight+4);ctx.fillStyle='#342735';ctx.fill();
   archTop(ctx,x-w/2-2,y-2,w+4,doorHeight+2);
   ctx.strokeStyle=t.trim;ctx.lineWidth=2;ctx.stroke();
   ctx.save();
   archTop(ctx,x-w/2,y,w,doorHeight);ctx.clip();
   wood(ctx,x-w/2,y,w,doorHeight,t.shutter,4);
   color(ctx,'#352a36',x-w/2,y+doorHeight*.35,w,2.3);
   color(ctx,'#352a36',x-w/2,y+doorHeight*.7,w,2.3);
   color(ctx,'#c9a87990',x-w/2+3,y+5,1.3,doorHeight-10);
   color(ctx,'#d5a86b',x+w*.22,y+doorHeight*.58,2.5,3.6);
   ctx.restore();
   color(ctx,'#352c39',x-w/2-5,h-3,w+10,3);
   color(ctx,t.trim,x-w/2-5,h-4,w+10,1.4);
  }
  function lamp(ctx,x,y,warm){
   const halo=ctx.createRadialGradient(x,y,1,x,y,27);
   halo.addColorStop(0,warm?'#ffc078a8':'#d39aaa60');
   halo.addColorStop(.33,warm?'#ef985c62':'#bf8cbd44');
   halo.addColorStop(1,'#aa776100');
   color(ctx,halo,x-27,y-27,54,54);
   line(ctx,[[x+7,y-12],[x+7,y-16],[x,y-16],[x,y-10]],'#302736',1.7);
   polygon(ctx,[[x-5,y-6],[x,y-11],[x+5,y-6],[x+4,y+6],[x-4,y+6]],'#352735');
   polygon(ctx,[[x-3,y-6],[x+3,y-6],[x+2.4,y+4],[x-2.4,y+4]],warm?'#ffc583':'#dbb6ce');
   color(ctx,'#ffedd1',x-.7,y-4,1.4,6);
   line(ctx,[[x-4,y],[x+4,y],[x+3,y+6],[x-3,y+6],[x-4,y]],'#653f45',.85);
  }
  function wall(ctx,w,h,t,style,side,seed,doorX,lantern){
   ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
   const [top,bottom]=side?t.side:t.front;
   shade(ctx,0,0,w,h,top,bottom);
   material(ctx,style==='stone'?1:style==='teal'?3:0,w,h,.62);
   if(style==='stone'){
    if(!atlasReady)masonry(ctx,w,h,seed);
    shade(ctx,0,0,w,h,side?'#2b294737':'#dbb5a819',side?'#1b223690':'#211f3459');
   }else{
    if(!atlasReady)patina(ctx,w,h,seed);
    color(ctx,'#413345',0,h-11,w,11);
    ctx.save();ctx.translate(0,h-10);masonry(ctx,w,10,seed,18,6);ctx.restore();
    if(style==='timber'){
     for(let x=4;x<w;x+=Math.min(w-8,32)){
      color(ctx,t.wood,x,0,3.5,h-10);
      line(ctx,[[x+3,24],[Math.min(w,x+27),5]],t.wood,2.8);
     }
    }else{
     for(let y=0;y<h-15;y+=8){
      const half=(y/8%2)*2.5;
      color(ctx,'#d4ad8f4c',0,y,6+half,5.3);
      color(ctx,'#3c2c3a5e',w-7-half,y,7+half,6);
     }
    }
   }
   color(ctx,'#332a39ad',0,0,w,4.7);
   color(ctx,style==='timber'?t.wood:'#46394ba5',0,h*.50,w,2);
   color(ctx,'#d0aa893d',0,h*.50-1,w,1);
   const bays=Math.max(1,Math.round(w/(side?39:33)));
   const bayWidth=w/bays,doorWidth=Math.min(38,w*.57);
   for(let bay=0;bay<bays;bay++){
    const center=(bay+.5)*bayWidth;
    // Don't let a window (or its shutter) intersect the larger entrance.
    if(doorX!==null&&Math.abs(center-doorX)<doorWidth/2+9)continue;
    windowBay(ctx,center-6,h*.18,12,Math.max(15,h*.20),t,(bay+seed)%3===0,style!=='stone'&&bayWidth>25);
   }
   if(doorX!==null)doorway(ctx,doorX,h,t,doorWidth);
   if(lantern)lamp(ctx,lantern.x,h-lantern.height,lantern.warm);
   ctx.restore();
  }
  function roofSlates(ctx,w,h,t,shadow,seed){
   ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
   shade(ctx,0,0,w,h,t.roof[0],t.roof[1]);
   material(ctx,2,w,h,.84);
   const random=randomFor(seed);
   const count=Math.max(3,Math.round(h/8)),dy=h/count,dx=11;
   for(let row=0;!atlasReady&&row<count;row++){
    const y=row*dy;
    for(let x=(row%2)*dx/2-dx;x<w;x+=dx){
     const fill=random()>.5?'#e3beb52b':'#17182a2e';
     polygon(ctx,[[x,y],[x+dx-1,y],[x+dx-1,y+dy-2],[x+dx-3,y+dy-.7],
      [x+1,y+dy-.7],[x,y+dy-2]],fill);
     line(ctx,[[x+1,y+dy-1],[x+dx-3,y+dy-1]],'#212036b3',.75);
    }
   }
   if(shadow)color(ctx,'#26274057',0,0,w,h);
   ctx.restore();
  }
  function building(ctx,{area,height:h,roof,door,style='plaster',lantern}){
   const [u,v,r,b]=area,m=(v+b)/2,t=themes[style],seed=Math.round(u*57+v*13);
   const sideTop=point(r,v,h),corner=point(r,b,h),frontTop=point(u,b,h);
   const sideWidth=(b-v)*42,frontWidth=(r-u)*42;
   plane(ctx,sideTop,corner,point(r,v,0),sideWidth,h,
    (w,height)=>wall(ctx,w,height,t,style,true,seed,null,null));
   plane(ctx,frontTop,corner,point(u,b,0),frontWidth,h,
    (w,height)=>wall(ctx,w,height,t,style,false,seed,door?(door[0]-u)*42:null,
     lantern?{x:(lantern.at[0]-u)*42,height:lantern.height,warm:lantern.warm}:null));
   const ridgeStart=point(u,m,h+roof),ridgeEnd=point(r,m,h+roof);
   polygon(ctx,[sideTop,ridgeEnd,corner],t.side[0],'#352936');
   line(ctx,[sideTop,ridgeEnd,corner],'#8e7989',1.9);
   line(ctx,[point(r,m,h+roof-2),point(r,m,h)],t.wood,2.7);
   plane(ctx,ridgeStart,ridgeEnd,point(u,v,h),frontWidth,36,
    (w,height)=>roofSlates(ctx,w,height,t,true,seed));
   plane(ctx,ridgeStart,ridgeEnd,frontTop,frontWidth,36,
    (w,height)=>roofSlates(ctx,w,height,t,false,seed+1));
   const far=point(r,v,h);
   line(ctx,[frontTop,corner,ridgeEnd,far],'#332738',2.4);
   line(ctx,[ridgeStart,ridgeEnd],'#b29aa086',1.6);
   line(ctx,[frontTop,corner],'#b18c805e',1.25);
   line(ctx,[point(r,v,0),point(r,b,0),point(u,b,0)],'#312b3a');
  }
  function archFace(ctx,data,u,front){
   const [,v,,b]=data.area,[a,c]=data.opening,h=data.height;
   const [openLeft,openRight]=[(a-v)*42,(c-v)*42];
   const spring=h-data.spring,rise=data.peak-data.spring;
   const edge=(t,depth=0)=>{
    const dx=openRight-openLeft,dy=-4*rise*(1-2*t),len=Math.hypot(dx,dy);
    return [openLeft+t*dx+dy*depth/len,spring-4*rise*t*(1-t)-dx*depth/len];
   };
   plane(ctx,point(u,v,h),point(u,b,h),point(u,v,0),(b-v)*42,h,(w,height)=>{
    ctx.save();ctx.beginPath();ctx.rect(0,0,w,height);
    ctx.moveTo(openLeft,height);ctx.lineTo(openLeft,spring);
    ctx.quadraticCurveTo((openLeft+openRight)/2,spring-2*rise,openRight,spring);
    ctx.lineTo(openRight,height);ctx.closePath();ctx.clip('evenodd');
    color(ctx,'#363347',0,0,w,height);
    masonry(ctx,w,height,103,20,9);
    shade(ctx,0,0,w,height,front?'#dfb4aa36':'#3c3c6252',front?'#352a4b35':'#24253992');
    for(const x of [openLeft-14,openRight]){
     shade(ctx,x,spring,14,height-spring,'#887782','#544559');
     for(let y=spring+7;y<height;y+=8){
      color(ctx,'#3e3448',x,y,14,1);
      color(ctx,'#b6a0917c',x,y+1,14,.8);
     }
    }
    range(12,i=>{
     const a=(i+.055)/12,b=(i+.945)/12,k=i===5||i===6?15:12;
     polygon(ctx,[edge(a),edge(b),edge(b,k),edge(a,k)],stoneColors[i%stoneColors.length],'#332b3f');
     line(ctx,[edge(a,k),edge(b,k)],front?'#d0b3aa8f':'#a69da37a',1.2);
    });
    color(ctx,'#3b3247',0,3,w,4);
    color(ctx,'#c9b1af',0,2,w,1);
    color(ctx,'#756377',0,9,w,2);
    if(front&&data.lantern)lamp(ctx,(data.lantern.at[1]-v)*42,h-data.lantern.height,data.lantern.warm);
    ctx.restore();
   });
  }
  function arch(ctx,data){
   const [u,v,r,b]=data.area,[a,c]=data.opening,h=data.height;
   archFace(ctx,data,u,false);
   for(const bound of [a,c]){
    polygon(ctx,[point(u,bound,0),point(r,bound,0),point(r,bound,data.spring),point(u,bound,data.spring)],
     '#4b455e','#302b40');
    for(let z=7;z<data.spring;z+=9)line(ctx,[point(u,bound,z),point(r,bound,z)],'#82788a50');
   }
   archFace(ctx,data,r,true);
   polygon(ctx,[point(u,v,h),point(r,v,h),point(r,b,h),point(u,b,h)],'#988693','#4c4055');
   for(let x=v+.3;x<b;x+=.35)line(ctx,[point(u,x,h),point(r,x,h)],'#605268a6');
   line(ctx,[point(r,v,h),point(r,b,h)],'#b7a3aa',1.3);
  }
  function skyline(ctx,{area,height,roof},index){
   const [u,v,r,b]=area,m=(v+b)/2;
   const t=themes[index%2?'stone':'teal'];
   const upper=point(u,m,height+roof),front=point(u,b,height),back=point(u,v,height);
   const frontSlope=Math.hypot(front[0]-upper[0],front[1]-upper[1]);
   const backSlope=Math.hypot(back[0]-upper[0],back[1]-upper[1]);
   plane(ctx,point(r,v,height),point(r,b,height),point(r,v,0),(b-v)*42,height,(w,h)=>{
    shade(ctx,0,0,w,h,t.side[0],t.side[1]);
    material(ctx,index%2?1:3,w,h,.35);
    for(let x=14;x<w-8;x+=24)windowBay(ctx,x,h*.38,7,Math.min(15,h*.28),t,false,false);
    color(ctx,'#1c203b6b',0,h*.75,w,h*.25);
   });
   plane(ctx,point(u,b,height),point(r,b,height),point(u,b,0),(r-u)*42,height,(w,h)=>{
    shade(ctx,0,0,w,h,t.front[0],t.front[1]);
    material(ctx,index%2?1:3,w,h,.38);
    for(let x=15;x<w-8;x+=26)windowBay(ctx,x,h*.35,8,Math.min(15,h*.33),t,false,false);
    color(ctx,'#2522395b',0,h*.75,w,h*.25);
   });
   plane(ctx,upper,point(r,m,height+roof),front,(r-u)*42,frontSlope,
    (w,h)=>roofSlates(ctx,w,h,t,true,100+index));
   plane(ctx,upper,point(r,m,height+roof),back,(r-u)*42,backSlope,
    (w,h)=>roofSlates(ctx,w,h,t,true,103+index));
   line(ctx,[point(u,b,height),point(r,b,height),point(r,m,height+roof)],'#302b41',1.6);
  }
  return {
   building,arch,skyline,
   onReady(callback){
    if(atlasReady)callback();
    else readyListeners.push(callback);
   }
  };
 }
 window.AlleyArchitecture={create};
})();
