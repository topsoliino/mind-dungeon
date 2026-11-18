/* World tiles and sprites share a 64px source grid and use nearest-neighbour sampling. */
window.DungeonArt = (() => {
  'use strict';
  const SIZE = 64;
  const stone = [
    { floor:['#272924','#403f32','#4e4a39','#605844','#33362a'], wall:['#1a211e','#373d34','#4c5141','#6b6850'], accent:'#687747', light:'#e89440' },
    { floor:['#28252b','#403a44','#4f4652','#63555c','#332d38'], wall:['#1c1923','#393342','#524453','#6c5764'], accent:'#8f5749', light:'#ed9c54' },
    { floor:['#252029','#3a313b','#483946','#594553','#302832'], wall:['#19151e','#322932','#493844','#694b58'], accent:'#92535d', light:'#bb6670' },
    { floor:['#2f2521','#48352c','#574236','#68503f','#372923'], wall:['#211b1b','#3d302c','#564238','#735543'], accent:'#a38049', light:'#ffae58' },
    { floor:['#1d282e','#30424a','#3b5058','#4b636a','#26343f'], wall:['#151f27','#2b3c48','#3d535e','#597079'], accent:'#588a91', light:'#79b7c6' },
    { floor:['#26342a','#394633','#485540','#647054','#303b30'], wall:['#242b22','#3b4433','#545e44','#788165'], accent:'#71854f', light:'#b1bc75' }
    ,{ floor:['#263330','#36443c','#435849','#5a6a51','#283731'], wall:['#182821','#31443a','#536654','#778367'], accent:'#788b53',light:'#9cc29b' }
  ];
  const ink='#17141a', shade='#352323', wood='#694433', grain='#855837', edge='#aa7847', gold='#c99b56', bright='#ecd28d';
  const floorCache = new Map(), wallCache = new Map(), spriteCache = new Map(), iconCache = new Map();
  function surface(w=SIZE,h=SIZE) {
    const c=document.createElement('canvas'); c.width=w; c.height=h; return c;
  }
  function brush(c) {
    const g=c.getContext('2d');
    const r=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h)};
    // Scan-convert silhouettes to integer rows so diagonals have a hard pixel edge.
    function poly(points,color) {
      const ys=points.map(p=>p[1]);
      for(let y=Math.min(...ys);y<Math.max(...ys);y++){
        const intersections=[];
        for(let i=0;i<points.length;i++){
          const [x1,y1]=points[i], [x2,y2]=points[(i+1)%points.length];
          const mid=y+.5;
          if(mid>=Math.min(y1,y2)&&mid<Math.max(y1,y2)) intersections.push(x1+(mid-y1)*(x2-x1)/(y2-y1));
        }
        intersections.sort((a,b)=>a-b);
        for(let i=0;i+1<intersections.length;i+=2){
          const x=Math.round(intersections[i]);r(x,y,Math.round(intersections[i+1])-x,1,color);
        }
      }
    }
    return {g,r,poly};
  }
  function random(seed) {
    let x=seed|0;
    return n=>{x=(Math.imul(1664525,x)+1013904223)|0;return Math.floor((x>>>0)*n/4294967296)};
  }
  function block(r,x,y,w,h,p,v) {
    if(w<3||h<3)return;
    r(x+1,y,w-2,h,p[0]);r(x,y+1,w,h-2,p[0]);
    r(x+2,y+2,w-4,h-4,p[1+v%2]);r(x+2,y+1,w-5,1,p[3]);
    r(x+1,y+3,1,h-7,p[2]);r(x+3,y+h-4,w-5,2,p[4]);
  }
  function floor(zone,variant) {
    const key=zone*12+variant;
    if(floorCache.has(key))return floorCache.get(key);
    const c=surface(),{r,poly}=brush(c),t=stone[zone],p=t.floor,rnd=random(key+37);
    r(0,0,64,64,p[0]);
    if(zone===5){
      r(0,0,64,64,p[1]);
      for(let i=0;i<118;i++){
       const x=rnd(64),y=rnd(64),w=1+rnd(8);
       r(x,y,w,1,[p[0],p[2],p[4],'#626346'][rnd(4)]);
       if(i%8===0){r(x,y-3,1,4,'#687c4b');r(x+2,y-2,1,3,p[3]);}
      }
      if(variant%3===0){
       for(let i=0;i<8;i++){
        const x=rnd(58),y=rnd(58);r(x,y,4,3,'#777364');r(x+1,y,3,1,'#a09a7a');
       }
      }
    }else if(zone===6){
      const seam=21+variant%5*4;
      block(r,0,0,seam,37,p,variant);block(r,seam,0,64-seam,37,p,variant+1);
      block(r,0,37,64,27,p,variant+3);
      for(let i=0;i<15;i++){
       const x=rnd(60),y=rnd(62);
       r(x,y,2+rnd(6),1+rnd(2),['#405341','#627153','#52634a','#6a795b'][rnd(4)]);
      }
      if(variant%4!==3){
       const x=6+rnd(28),y=8+rnd(21);
       poly([[x,y],[x+2,y],[x+8,y+9],[x+13,y+11],[x+11,y+17],[x+26,y+26],[x+8,y+18],[x+10,y+12],[x+6,y+11]],'#1e342b');
       r(x+13,y+16,5,1,'#92947b');
      }
      if([0,2,5,7,9].includes(variant)){
       const sx=5+rnd(25),sy=26+rnd(15);
       poly([[sx-3,sy+11],[sx+4,sy+3],[sx+13,sy],[sx+27,sy+2],[sx+32,sy+14],[sx+25,sy+20],[sx+4,sy+19]],'#293a2c');
       poly([[sx,sy+11],[sx+9,sy+4],[sx+23,sy+4],[sx+29,sy+13],[sx+23,sy+18],[sx+6,sy+16]],'#594b38');
       for(let i=0;i<15;i++)r(sx+3+rnd(23),sy+7+rnd(9),1+rnd(3),1,['#806952','#453d31','#a08459'][rnd(3)]);
       if(variant!==7)for(let i=0;i<3;i++){
        const px=sx+6+i*8,py=sy+11+(i%2)*3;
        r(px,py-9-i%2*3,2,12+i%2*3,'#48633b');r(px-3,py-10,4,2,'#6e8747');r(px+2,py-13,5,2,'#92a361');
        r(px+2,py-7,4,2,'#587b44');r(px-4,py-3,4,2,'#627a41');
       }
      }
    }else if(zone===3){
      for(let y=0;y<64;y+=16){
        const split=12+rnd(38);
        block(r,0,y,split,16,p,rnd(2));block(r,split,y,64-split,16,p,rnd(2));
      }
    }else if(zone===1||zone===2){
      block(r,0,0,40,35,p,rnd(2));block(r,40,0,24,35,p,rnd(2));
      block(r,0,35,21,29,p,rnd(2));block(r,21,35,43,29,p,rnd(2));
    }else{
      block(r,0,0,64,64,p,rnd(2));
      const x=12+rnd(28),y=9+rnd(20);
      poly([[x,y],[x+1,y],[x+8,y+9],[x+7,y+16],[x+20,y+21],[x+6,y+17],[x+6,y+10]],p[4]);
      r(x+8,y+14,6,1,p[3]);
    }
    for(let i=0;i<34;i++){
      const x=4+rnd(55),y=4+rnd(55);
      r(x,y,1+rnd(zone===3?11:4),1+rnd(2),p[2+rnd(3)]);
    }
    if(variant<5&&(zone===0||zone===4||zone===5)){
      const x=variant%2?5:48,y=12+rnd(31);
      for(let i=0;i<12;i++)r(x+rnd(12),y+rnd(12),1+rnd(4),1+rnd(3),i%3?t.accent:p[4]);
    }
    if(zone===2&&variant===4) {
      r(11,12,4,11,'#71645b');r(9,13,9,2,'#8a796a');r(13,22,10,2,'#77685c');r(31,45,12,2,'#6a5b50');r(38,43,4,7,'#7f6f63');
    }
    floorCache.set(key,c);return c;
  }
  function wall(zone,mask,variant) {
    const key=zone*64+mask*4+variant;
    if(wallCache.has(key))return wallCache.get(key);
    const c=surface(),{r}=brush(c),p=stone[zone].wall,rnd=random(key+509);
    r(0,0,64,64,p[0]);
    for(let y=0;y<64;y+=16){
      const split=y%32===0?23:43, colors=[p[0],p[1],p[2],p[3],p[1]];
      block(r,0,y,split,16,colors,rnd(2));block(r,split,y,64-split,16,colors,rnd(2));
    }
    for(let i=0;i<32;i++)r(3+rnd(57),3+rnd(57),1+rnd(5),1,p[1+rnd(2)]);
    if(mask&1){r(0,0,64,4,p[3]);r(0,4,64,4,p[2]);}
    if(mask&2){r(57,0,7,64,p[2]);r(62,0,2,64,p[3]);}
    if(mask&8){r(0,0,7,64,p[2]);r(0,0,2,64,p[3]);}
    if(mask&4){
      r(0,40,64,4,p[3]);r(0,44,64,20,p[1]);r(0,59,64,5,p[0]);
      r(6,46,19,2,p[2]);r(30,44,3,15,p[0]);r(35,47,21,2,p[2]);
    }
    wallCache.set(key,c);return c;
  }
  const terrainCache=new Map();
  function terrainTile(type,variant){
    const key=type+variant;
    if(terrainCache.has(key))return terrainCache.get(key);
    const c=surface(),{r,poly}=brush(c),rng=random(variant+31);
    if(type==='roof-stone'){
     r(0,0,64,64,'#464955');
     for(let row=0;row<4;row++){
      const y=row*16,split=15+rng(35);
      r(1,y+1,split-2,13,'#636772');r(split+1,y+1,62-split,13,'#575d69');
      r(2,y+2,split-4,2,'#767984');r(split+2,y+2,59-split,2,'#717683');
      for(let i=0;i<5;i++)r(3+rng(58),y+5+rng(7),1+rng(4),1,'#7a7d866e');
     }
    }else if(type.startsWith('sewer-')){
     r(0,0,64,64,type==='sewer-pool'?'#244b4b':'#1c464d');
     for(let i=0;i<65;i++)r(rng(64),rng(64),3+rng(11),1+rng(3),['#254b46','#32615e','#38524b','#38716a'][rng(4)]);
     for(let i=0;i<7;i++){const x=rng(58),y=rng(58);r(x,y,3,2,'#527f71');r(x+1,y+2,2,1,'#305351');}
    }else if(type==='abyss'||type==='river'||type==='clear-river'||type==='waterfall'){
     const clear=type==='clear-river'||type==='waterfall',river=type!=='abyss';
     r(0,0,64,64,clear?'#235557':river?'#182e37':'#11151e');
     for(let i=0;i<42;i++){
      const x=rng(64),y=rng(64),w=2+rng(15);
      const palette=clear?['#2e7776','#448b83','#69a79a']:river?['#223d48','#2e4e57','#42737c']:['#1b2230','#262938','#343344'];
      r(x,y,w,1+rng(3),palette[rng(3)]);
     }
     if(type==='waterfall'){r(0,0,64,7,'#606e59');r(0,7,64,3,'#829075');}
     if(river)for(let i=0;i<8;i++){
      const x=rng(57),y=rng(61);
      r(x,y,5+rng(10),1,'#83a8a697');r(x+4,y+1,3,1,'#4a7a86');
     }
    }else{
     if(type==='bridge-y'){const ctx=c.getContext('2d');ctx.translate(64,0);ctx.rotate(Math.PI/2);}
     r(0,0,64,64,'#282324');
     for(let y=0;y<64;y+=12){
      r(0,y+1,64,10,y%24?'#735339':'#674934');
      r(0,y+2,64,2,'#a27248');r(0,y+9,64,2,'#4e372b');
      for(let i=0;i<4;i++){r(rng(59),y+4+rng(4),4+rng(8),1,'#906347');}
     }
     for(const y of [5,57]){r(0,y,64,3,'#b18957');for(const x of [8,30,53])r(x,y,2,2,'#2e2622');}
    }
    terrainCache.set(key,c);return c;
  }
  function world(map,zoneAt,lights,seed,terrain) {
    const rnd=random(seed),chunkSize=16,chunks=[];
    const tiles=map.map((row,y)=>row.map((value,x)=>{
      const v=rnd(12),surfaceType=terrain?.[y]?.[x];
      if(value===0||surfaceType==='partition')return {v,open:value===0,surfaceType};
      if(surfaceType)return {v,surfaceType};
      const mask=(map[y-1]?.[x]===0?1:0)|(map[y]?.[x+1]===0?2:0)|(map[y+1]?.[x]===0?4:0)|(map[y]?.[x-1]===0?8:0);
      return mask?{v,mask}:null;
    }));
    for(let top=0;top<map.length;top+=chunkSize)for(let left=0;left<map[0].length;left+=chunkSize){
      const bottom=Math.min(top+chunkSize,map.length),right=Math.min(left+chunkSize,map[0].length);
      const cells=[];
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(tiles[y][x])cells.push({x,y,...tiles[y][x]});
      if(!cells.length)continue;
      const x0=left*SIZE,y0=top*SIZE,c=surface((right-left)*SIZE,(bottom-top)*SIZE),{g,r}=brush(c);
      r(0,0,c.width,c.height,'#101212');
      g.translate(-x0,-y0);
      for(const {x,y,v,mask,open,surfaceType} of cells){
        const zone=zoneAt(x,y);
        const image=surfaceType&&surfaceType!=='partition'?terrainTile(surfaceType,v):
         open||surfaceType==='partition'?floor(zone,v):wall(zone,mask,v%4);
        g.drawImage(image,x*SIZE,y*SIZE);
      }
      g.beginPath();
      for(const p of cells)if(p.open)g.rect(p.x*SIZE,p.y*SIZE,SIZE,SIZE);
      g.clip();g.globalCompositeOperation='screen';
      for(const {x,y,zone,radius,power} of lights){
        if(x+radius<x0||x-radius>x0+c.width||y+radius<y0||y-radius>y0+c.height)continue;
        const light=g.createRadialGradient(x,y,3,x,y,radius),color=stone[zone].light;
        light.addColorStop(0,color+power);light.addColorStop(.34,color+'36');light.addColorStop(1,color+'00');
        g.fillStyle=light;g.fillRect(x-radius,y-radius,radius*2,radius*2);
      }
      chunks.push({x:x0,y:y0,bitmap:c});
    }
    return chunks;
  }
  function partition(zone=0,ends=3){
    const key='partition-'+zone+'-'+ends;
    if(spriteCache.has(key))return spriteCache.get(key);
    const c=surface(64,90),{r,poly}=brush(c);
    const [dark,base,mid,edgeTone]=stone[zone].wall;
    const left=ends&1?3:0,right=ends&2?61:64;
    const north=Boolean(ends&4),south=Boolean(ends&8);
    const upright=(ends&3)===3&&(north||south);
    const edgeLight=zone===4?'#899caa':zone===2?'#a78d91':'#a9a08a';
    // The face extends up from the middle of the occupied tile. A raised
    // coping strip and offset mortar joints read as masonry at game scale.
    if(north){
      r(21,0,25,48,dark);r(24,0,18,48,mid);r(24,0,3,48,edgeLight);
      for(const y of [11,24,38]){r(23,y,20,2,dark);r(27,y+2,13,1,edgeTone);}
    }
    if(south){
      r(18,50,33,40,'#100e13aa');r(21,47,24,43,dark);r(23,47,19,43,mid);
      r(24,47,4,43,edgeLight);
      for(const y of [60,73,86]){r(22,y,22,2,dark);r(28,y+2,12,1,edgeTone);}
    }
    const x=upright?18:left,w=upright?29:right-left;
    if(!upright){
      r(x,64,w,9,'#100e12aa');r(x,27,w,42,dark);r(x,37,w,27,base);
      for(const [y,seams] of [[39,[0,14,33,50,64]],[53,[0,7,24,42,57,64]]]){
        for(let i=1;i<seams.length;i++){
          const a=Math.max(x,seams[i-1]),b=Math.min(right,seams[i]);
          if(b-a<3)continue;
          r(a,y,b-a-1,10,mid);r(a+1,y,b-a-3,2,edgeTone);
          r(a+2,y+8,b-a-4,1,base);
        }
        r(x,y+11,w,2,dark);
      }
      poly([[x,28],[x+3,20],[x+w-3,20],[x+w,28],[x+w,36],[x,36]],dark);
      r(x+(ends&1?3:0),22,w-(ends&1?3:0)-(ends&2?3:0),9,edgeTone);
      r(x+(ends&1?3:0),22,w-(ends&1?3:0)-(ends&2?3:0),3,edgeLight);
      r(x,33,w,2,mid);
      if(ends&1){r(x,29,3,38,dark);r(x+3,34,2,31,edgeTone);}
      if(ends&2)r(x+w-3,29,3,38,dark);
    }
    if(upright||north||south){
      r(18,25,30,7,dark);r(20,24,26,4,edgeLight);r(23,31,20,6,edgeTone);
      r(21,38,24,3,mid);
    }
    spriteCache.set(key,c);return c;
  }
  function furniture(type,variant=0,pose=0) {
    const key=type+'-'+variant+'-'+pose;
    if(spriteCache.has(key))return spriteCache.get(key);
    const c=surface(128,112),{r,poly}=brush(c);
    const shadow=(x,y,w,h)=>poly([[x+5,y],[x+w-4,y],[x+w,y+h-4],[x+w-5,y+h],[x,y+h],[x,y+5]],'#100e12aa');
    const planks=(x,y,w,h)=>{
      r(x,y,w,h,shade);r(x+2,y+2,w-4,h-5,grain);r(x+3,y+2,w-6,2,edge);
      for(let j=7;j<h-4;j+=6){r(x+3,y+j,w-6,1,wood);r(x+9+(j*5)%(w-15),y+j+2,9,1,edge);}
    };
    const cloth=['#55705c','#844b46','#694349','#75603b','#426e76'][variant%5];
    if(type==='carpet'){
      r(3,20,122,72,ink);r(6,23,116,66,cloth);
      for(let x=7;x<124;x+=5){r(x,17,2,6,gold);r(x,89,2,6,gold);}
      r(10,27,108,2,gold);r(10,83,108,2,gold);r(10,29,2,54,gold);r(116,29,2,54,gold);
      for(let i=0;i<4;i++){
        const x=25+i*26;
        poly([[x,37],[x+12,55],[x,75],[x-12,55]],'#2b2324');
        poly([[x,42],[x+9,55],[x,70],[x-9,55]],gold);
        poly([[x,47],[x+6,55],[x,65],[x-6,55]],cloth);
        r(x-1,54,3,3,bright);
      }
      for(let x=15;x<115;x+=6){r(x,33,3,1,bright);r(x,78,3,1,bright);}
    }else if(type==='table'){
      shadow(18,68,93,18);
      for(const x of [25,94]){r(x,57,10,23,ink);r(x+2,58,6,19,wood);r(x+2,58,2,17,edge);}
      r(20,28,88,41,ink);planks(22,30,84,32);r(24,62,80,6,wood);r(25,63,79,2,edge);
      if(variant===1||variant===3){
        r(49,38,28,16,shade);r(50,36,25,14,'#ccb480');r(52,38,9,10,'#ecd6a2');r(64,38,9,10,'#e2c595');
        for(let i=0;i<3;i++){r(54,40+i*3,6,1,'#8b6b58');r(65,40+i*3,6,1,'#8b6b58');}
      }else{
        r(54,40,14,11,'#b18954');r(56,41,10,7,'#574635');r(56,40,8,1,bright);
        r(71,40,6,7,shade);r(71,39,5,4,'#a18560');
      }
      flame(84,47,false);
    }else if(type==='chair'){
      shadow(44,65,40,12);
      r(47,35,34,32,ink);r(50,37,28,14,wood);r(51,37,26,3,edge);
      for(const x of [48,74]){r(x,58,7,16,shade);r(x+2,58,2,14,edge);}
      planks(48,49,32,16);r(54,51,20,9,cloth);
    }else if(type==='straw-bed'){
      shadow(23,68,82,24);r(26,25,76,61,ink);planks(29,27,70,57);
      poly([[34,37],[93,37],[97,74],[30,74]],'#574128');
      poly([[37,38],[91,38],[94,71],[33,71]],'#ad824a');
      for(let i=0;i<65;i++){
        const x=36+i*13%55,y=45+i*17%26;
        r(x,y,2+i%5,1,i%3?'#d4ad64':'#715136');
      }
      r(40,37,47,9,'#d0b58b');r(42,38,45,3,'#e5cca2');r(42,45,43,2,'#8f6a50');
      poly([[33,59],[92,56],[94,71],[32,71]],'#685451');
      r(34,62,59,2,'#958071');r(33,68,60,2,'#453940');r(29,77,70,5,edge);
    }else if(type==='shelf'){
      const top=[10,24,14,35][pose],rows=[[22,38,59],[38,59],[31,48,59],[48,59]][pose];
      shadow(27,73,75,11);r(28,top,72,74-top,ink);
      r(32,top+4,65,67-top,grain);r(37,top+6,54,61-top,shade);
      r(29,top,71,4,edge);r(31,top+4,6,67-top,wood);r(91,top+4,6,67-top,wood);
      r(33,top+5,2,65-top,edge);r(93,top+5,2,65-top,edge);
      const props=['#967253','#ad9165','#74938a','#9d797e'];
      rows.forEach((base,j)=>{
        for(let i=0;i<5;i++){
          const x=40+i*10,tint=props[(i+j+variant)%4];
          const kind=(i+2*j+pose)%6;
          if(kind<2){
            const height=6+(i*3+j*5)%7;
            r(x,base-height,4,height,tint);r(x+5,base-height+2,3,height-2,cloth);r(x,base-height+2,4,1,gold);
          }else if(kind===2){
            r(x+2,base-11,3,4,'#b6a58b');r(x,base-7,7,7,ink);r(x+1,base-6,5,5,tint);r(x+1,base-5,1,3,bright);
          }else if(kind===3){
            planks(x,base-6,9,6);r(x+4,base-3,2,2,gold);
          }else if(kind===4){
            r(x,base-4,8,4,'#bc9d68');r(x+1,base-4,5,1,bright);r(x+6,base-3,1,3,'#755536');
          }
        }
        r(37,base,54,4,wood);r(38,base,52,1,edge);
      });
      r(30,68,67,5,edge);r(33,72,5,5,wood);r(91,72,5,5,wood);
    }else if(type==='cabinet'||type==='bookcase'){
      shadow(34,64,61,14);r(33,9,62,65,ink);planks(36,12,56,58);r(40,20,48,45,shade);
      if(type==='bookcase'){
        for(let j=0;j<3;j++){
          const y=21+j*14;
          for(let i=0;i<7;i++){
            const h=6+(i*7+j*3)%7,col=[cloth,'#a26a49','#6d866a','#b19968','#785369'][(i+2*j)%5];
            r(43+i*6,y+12-h,4,h,col);r(43+i*6,y+12-h,4,1,gold);
          }
          r(40,y+12,48,2,edge);
        }
      }else{
        planks(41,22,22,40);planks(65,22,22,40);r(57,39,3,5,gold);r(67,39,3,5,gold);
      }
      r(34,10,60,4,edge);r(37,66,54,4,edge);
    }else if(type==='torch'||type==='candle'){
      shadow(49,61,31,12);flame(64,62,type==='torch');
    }else if(type==='barrel'){
      shadow(43,66,42,12);
      poly([[47,36],[80,36],[86,47],[82,70],[46,70],[42,48]],ink);
      r(46,43,37,23,wood);r(49,39,30,9,grain);r(51,40,25,2,edge);
      for(let x=49;x<80;x+=6)r(x,48,2,17,grain);
      for(const y of [48,61]){r(45,y,39,4,'#494844');r(48,y,31,1,'#898276');r(76,y+1,2,2,gold);}
    }else if(type==='sarcophagus'){
      shadow(20,70,88,15);
      const p=stone[variant].wall;
      poly([[30,28],[98,28],[109,44],[101,74],[25,74],[19,44]],ink);
      poly([[32,31],[96,31],[104,45],[97,69],[29,69],[24,45]],p[2]);
      r(29,49,68,19,p[1]);r(34,34,60,3,p[3]);r(36,58,55,2,p[3]);
      r(60,36,8,20,'#81756c');r(55,41,18,4,'#9a8a7d');r(62,39,4,12,'#b0a08d');
    }else if(type==='web'){
      c.getContext('2d').drawImage(icon('floor-web'),37,29,54,54);
    }else if(type==='roots'||type==='crystal'){
      shadow(34,69,61,11);
      const p=type==='roots'?['#24362c','#426550','#78915c']:['#23404d','#497c88','#8dc1c2'];
      for(const [x,y,w,h] of [[44,61,17,28],[62,70,23,46],[79,69,13,22]]){
        poly([[x,y],[x-3,y-h+9],[x+5,y-h],[x+w-4,y-h+7],[x+w,y-5],[x+w-6,y]],p[0]);
        poly([[x+4,y-4],[x+1,y-h+10],[x+6,y-h+3],[x+w-7,y-h+9],[x+w-6,y-8]],p[1]);
        r(x+5,y-h+7,2,h/3|0,p[2]);r(x+8,y-h+10,2,h/4|0,p[2]);
      }
    }else if(type==='lab'){
      shadow(13,69,103,16);planks(17,41,94,29);
      for(const x of [23,98]){r(x,66,8,15,shade);r(x,67,2,13,edge);}
      r(19,67,90,3,edge);
      c.getContext('2d').drawImage(icon('kettle'),40,10,47,52);
      for(const [x,y,col] of [[26,31,'#dbb377'],[94,34,'#89b8b8'],[101,37,'#ad779c']]){
       r(x+3,y,4,5,edge);r(x,y+5,10,12,ink);r(x+1,y+7,8,8,col);r(x+2,y+8,2,4,bright);
      }
    }else if(type==='pine'||type==='birch'){
      shadow(28,71,76,16);
      if(type==='pine'){
        r(61,42,9,36,'#493a33');r(63,49,3,27,'#967658');
        for(const [i,[top,left,right,y]] of [[35,29,99,66],[23,36,92,54],[12,44,83,41],[2,51,77,30]].entries()){
          poly([[65,top],[right,y],[right-8,y+6],[left+9,y+5],[left,y]],'#263c34');
          poly([[65,top+2],[right-5,y-1],[66,y+2],[left+7,y-1]],i%2?'#41634e':'#385a46');
          poly([[65,top+4],[65,y],[left+11,y-2]],'#628364');
          r(left+15,y-5,13,2,'#7a966b');r(66,y-4,11,2,'#365345');
        }
      }else{
        poly([[53,78],[57,45],[54,25],[62,20],[66,43],[65,78]],'#9c9580');
        r(58,47,7,28,'#cac0a2');r(59,57,3,11,'#e1d1ac');
        for(const [x,y,w] of [[58,61,5],[59,71,5],[59,51,6],[57,38,4]])r(x,y,w,2,'#615f52');
        for(const [x,y,w,h] of [[37,25,25,26],[54,9,29,32],[65,21,29,30],[81,31,19,22],[46,35,30,21]]){
          poly([[x,y+8],[x+8,y],[x+w-7,y+2],[x+w,y+9],[x+w-3,y+h],[x+5,y+h]],'#4a5c42');
          r(x+5,y+9,w-9,h-13,'#87965b');r(x+6,y+7,w-13,3,'#adad6d');r(x+8,y+14,9,3,'#b9b273');
        }
      }
    }else if(type==='tree'){
      shadow(27,65,73,22);r(57,43,13,36,'#77523b');r(58,48,4,28,'#ab7850');
      poly([[19,46],[24,33],[32,24],[42,20],[45,12],[62,10],[77,15],[82,22],[99,30],[108,47],[101,55],[80,64],[50,60],[30,62]],'#26382c');
      poly([[24,44],[33,31],[47,27],[50,17],[63,14],[76,20],[84,29],[98,36],[101,48],[89,56],[73,57],[55,52],[40,57],[29,52]],'#456147');
      for(const [x,y,w] of [[31,38,17],[44,26,18],[55,21,17],[64,35,20],[78,42,18],[46,45,16]]){r(x,y,w,6,'#687a4d');r(x+2,y-2,w-7,3,'#88945d');r(x+3,y+7,w-5,2,'#3a5744');}
      r(60,70,3,8,'#816746');r(52,76,10,3,'#574236');
    }else if(type==='grass'){
      for(const [x,y,h] of [[44,59,11],[52,56,13],[58,61,8],[67,57,15],[76,63,10],[85,58,8]]){
       poly([[x-5,y],[x-7,y-h],[x,y-4],[x+3,y-h-3],[x+5,y]],'#536a42');
       r(x+2,y-6,2,6,'#8d9959');
      }
    }else if(type==='provisions'||type==='alchemy'){
      shadow(20,70,87,12);planks(23,21,82,51);r(28,25,72,38,'#2e2423');
      for(const row of [28,49]){
       r(26,row+16,76,4,edge);
       for(let i=0;i<5;i++){
        const x=32+i*13,col=['#b48450','#9eae75','#c8986d','#798f9e','#ad7d96'][i];
        if(type==='alchemy'){
         r(x+2,row,4,6,'#b4a585');r(x,row+5,8,10,col);r(x+1,row+6,2,6,'#dad3ae');
        }else{r(x,row+5,10,10,col);r(x+1,row+4,8,3,'#d0a366');r(x+3,row+8,2,4,'#77553d');}
       }
      }
      r(25,23,78,3,'#b28051');
    }else if(type==='banquet'){
      shadow(17,69,94,15);planks(18,37,92,34);r(25,64,8,15,shade);r(94,64,8,15,shade);
      for(const [i,id] of ['bread','banana','chicken'].entries())c.getContext('2d').drawImage(icon('food',id),24+i*24,32,25,25);
      r(77,56,10,6,'#b4a286');r(85,57,2,3,'#efe3b9');
    }else if(type==='round-table'){
      shadow(24,66,80,18);
      for(const x of [34,58,86]){r(x,49,7,27,shade);r(x+1,52,2,23,edge);}
      poly([[36,31],[91,31],[104,44],[104,55],[92,66],[37,66],[24,54],[24,43]],shade);
      poly([[38,31],[89,31],[101,44],[92,57],[36,57],[27,45]],grain);
      r(38,32,50,2,edge);for(const y of [40,46,52])r(35,y,57,1,wood);
      r(53,42,21,9,'#6c724c');r(55,43,17,2,'#a5a471');r(61,38,6,9,'#c1a574');r(63,36,2,4,bright);
    }else if(type==='banquet-long'){
      shadow(6,64,116,18);
      for(const x of [10,47,73,112]){r(x,52,6,24,shade);r(x+1,54,2,21,edge);}
      planks(5,37,58,30);planks(64,37,59,30);
      r(8,48,112,8,'#673c46');r(8,48,112,1,'#b48b65');
      for(const [i,id] of ['bread','chicken','banana','bread'].entries())c.getContext('2d').drawImage(icon('food',id),12+i*27,35,23,23);
    }else if(type==='bench'||type.startsWith('fence')){
      const fence=type.startsWith('fence'),start=fence?10:24,end=128-start;
      shadow(start,68,end-start,12);
      for(const x of type==='fence'?[start+2]:[start+2,end-8]){
        r(x,fence?34:39,7,fence?44:38,shade);r(x+1,fence?35:40,2,fence?42:36,edge);
        r(x-1,fence?33:38,9,4,wood);r(x,fence?33:38,6,1,gold);
      }
      planks(start,44,end-start,13);planks(start,fence?60:54,end-start,fence?9:14);
    }else if(type==='weapon-rack'||type==='armor-rack'){
      const weapon=type==='weapon-rack';
      shadow(29,68,69,13);
      for(const x of [29,92]){r(x,24,7,49,shade);r(x+1,25,2,45,edge);}
      planks(30,25,68,10);planks(26,64,77,11);
      for(const x of [28,91]){r(x,36,7,2,gold);r(x,60,6,2,'#d8af66');}
      for(const x of [37,55,73,89])r(x,33,2,12,'#ba955b');
      r(30,67,68,2,'#c5905d');r(34,70,61,2,'#5c3a33');
      const ctx=c.getContext('2d');
      if(weapon)for(const [i,id] of ['rust','rapier','hammer'].entries())ctx.drawImage(icon('weapon',id),27+i*19,31+i%2*2,36,37);
      else {
        ctx.drawImage(icon('armor','helmet','#a9afbe'),47,19,32,28);
        ctx.drawImage(icon('armor','chest','#96a0a0'),34,34,57,34);
      }
    }else if(type==='display'||type==='dresser'){
      const glass=type==='display';
      shadow(24,68,81,13);planks(24,glass?52:31,81,23+(glass?0:18));
      for(const x of [28,94])r(x,69,6,8,shade);
      if(glass){
        poly([[31,27],[96,27],[104,35],[105,57],[24,57],[24,36]],'#352830');
        r(28,35,73,19,'#456468');r(29,33,69,2,'#90adaa');r(30,36,2,16,'#b2c6af');
        for(const [i,col] of ['#be8d68','#94c8cd','#b4a3d9'].entries()){
          const x=43+i*16;r(x+2,42,4,2,col);r(x,44,8,7,col);r(x+2,45,2,3,'#f2d6a3');
        }
      }else for(const y of [36,48,60]){r(30,y,69,9,shade);r(32,y+1,65,5,grain);r(60,y+3,9,2,gold);}
    }else if(type==='statue'){
      const [dark,base,mid,edgeTone]=stone[variant].wall;
      const highlight=variant===4?'#a1abb3':'#b2a794',weathered='#77745e';
      shadow(22,83,84,13);
      poly([[34,85],[45,77],[83,78],[94,86],[88,92],[42,92]],dark);
      poly([[44,77],[83,77],[90,85],[38,85]],mid);
      r(41,85,47,2,edgeTone);
      // The cloak opens over two boots, with a long blade beside the figure.
      poly([[53,22],[73,22],[80,28],[82,42],[89,73],[78,79],[50,78],[39,72],[45,46],[43,36]],dark);
      poly([[48,30],[58,25],[55,44],[50,61],[49,74],[41,71],[45,52]],base);
      poly([[72,28],[79,33],[79,47],[83,63],[86,73],[75,77],[72,59],[70,41]],mid);
      poly([[55,42],[72,42],[74,58],[72,71],[77,78],[66,80],[62,75],[60,75],[57,81],[47,80],[48,75],[52,70],[51,57]],dark);
      poly([[53,53],[62,55],[59,68],[56,74],[51,74],[54,65]],edgeTone);
      poly([[64,54],[72,51],[71,65],[72,74],[67,76],[65,67]],mid);
      r(48,77,10,3,mid);r(67,77,10,3,edgeTone);
      poly([[55,29],[61,24],[71,25],[77,32],[74,45],[68,50],[58,48],[53,43]],mid);
      r(57,32,15,2,highlight);r(57,37,15,2,edgeTone);r(58,46,13,5,base);r(63,46,4,4,highlight);
      poly([[53,27],[50,35],[55,43],[62,43],[64,40],[57,39],[55,32]],edgeTone);
      poly([[77,30],[82,35],[81,45],[86,47],[84,50],[76,47],[75,39]],edgeTone);
      r(79,46,15,3,highlight);r(85,42,3,10,base);
      poly([[85,50],[90,51],[90,71],[87,80],[84,72]],edgeTone);r(86,52,1,21,highlight);
      poly([[57,11],[63,7],[70,9],[73,14],[73,23],[68,28],[58,26],[54,21],[54,15]],dark);
      poly([[59,12],[64,10],[70,13],[70,21],[66,25],[59,23],[57,18]],edgeTone);
      r(59,13,9,2,highlight);r(58,17,11,2,dark);r(64,19,2,3,mid);
      r(49,64,2,9,edgeTone);r(80,59,1,8,edgeTone);
      r(42,86,8,2,weathered);r(78,82,5,2,'#7e8d60');
    }else if(type==='well'){
      shadow(12,70,104,20);
      poly([[15,45],[28,35],[98,35],[113,45],[114,67],[100,81],[27,81],[14,69]],'#20262f');
      poly([[19,46],[30,37],[97,37],[109,46],[98,59],[30,59]],'#70818b');
      poly([[25,47],[35,41],[93,41],[103,47],[95,54],[35,54]],'#263d4f');
      r(36,47,54,5,'#4f93ab');r(49,46,26,2,'#91d9d0');r(61,46,6,2,'#dcfce5');
      for(const [x,y,w] of [[20,61,21],[44,60,18],[65,60,20],[88,61,21],[30,71,26],[59,70,17],[79,71,20]]){
        r(x,y,w,8,'#465462');r(x+1,y,w-2,2,'#687a88');
      }
      poly([[28,33],[37,19],[88,19],[99,31],[95,35],[87,26],[39,26],[32,37]],'#455264');
      r(62,25,3,19,'#99977d');
      poly([[63,26],[68,33],[63,40],[58,33]],'#6ad3be');r(62,29,2,6,'#c6ffe5');
    }else if(type==='campfire'){
      shadow(23,58,82,23);
      for(const [x,y,w] of [[25,56,15],[36,66,15],[53,69,15],[71,65,15],[86,57,15],[78,50,14],[34,51,15]]){
        r(x,y,w,8,'#392f2b');r(x+2,y,w-4,5,'#867564');r(x+3,y,w-6,2,'#a99378');
      }
      poly([[42,63],[46,55],[83,62],[79,68]],'#94543a');
      poly([[46,62],[77,53],[85,57],[52,68]],'#6d3f2e');
      const sway=[0,3,5,2,-2,-4,-2,1][pose],tip=[0,-4,1,-5,-2,3,-4,1][pose];
      poly([[47,62],[43-sway,50],[50,41],[56-sway,26-tip],[61,37],[68+sway,31],[72+sway,17+tip],[77+sway,35],[83,48],[87,55],[80,65]],'#ba4b32');
      poly([[51,60],[48,52],[57,45],[61-sway,35+tip],[65,45],[73+sway,33+tip],[79,50],[81,60],[75,65]],'#ff9b48');
      poly([[57,62],[55,54],[64,50],[69+sway,41+tip],[73,55],[76,62],[69,66]],'#ffd584');
      r(65,55,6,9,'#fff1b4');r(47+sway,32+tip,3,4,'#e7a15a');
    }else if(type==='market'||type==='market-back'){
      const brass='#bb9656',oak='#664435',darkOak='#30212a',cloth='#31535a';
      if(type==='market-back'){
        shadow(8,73,112,17);
        for(const x of [12,107]){
          r(x,19,9,63,darkOak);r(x+2,20,4,60,oak);r(x+2,20,1,60,'#987154');
          r(x-1,37,11,3,brass);r(x-1,74,11,4,brass);
        }
        poly([[9,21],[24,6],[104,6],[119,21],[124,31],[4,31]],darkOak);
        poly([[12,22],[26,9],[102,9],[116,22],[120,29],[8,29]],cloth);
        for(const [x,top] of [[26,11],[45,9],[64,9],[83,9],[102,11]]){
          poly([[x-4,top],[x+3,top],[x+7,29],[x-8,29]],'#3c6566');
          r(x-7,28,14,2,brass);
        }
        r(6,30,116,3,'#1b3038');r(10,29,108,1,'#81a29a');
        poly([[47,27],[81,27],[81,37],[75,43],[53,43],[47,37]],darkOak);
        r(50,29,28,8,'#786044');r(51,29,26,1,brass);
        poly([[53,34],[57,32],[61,35],[64,33],[67,35],[71,32],[75,34],[70,38],[58,38]],'#f2cf83');
        for(const x of [23,102]){
          r(x,32,1,13,brass);r(x-4,44,9,10,'#3e3435');r(x-3,46,7,6,'#df9d54');
          r(x-1,47,3,4,'#ffe6a3');r(x-3,53,7,2,brass);
        }
        for(const x of [24,80]){
          r(x,60,24,7,darkOak);r(x+1,60,22,2,'#a87854');
          r(x+3,52,6,8,'#537f74');r(x+4,53,2,5,'#93b8a4');r(x+4,50,3,3,brass);
          r(x+13,54,6,6,'#79516c');r(x+14,52,3,2,'#cc956c');
        }
      }else{
        shadow(9,77,109,10);
        for(const x of [15,106]){r(x,68,8,17,darkOak);r(x+2,69,3,15,oak);}
        poly([[14,53],[113,53],[122,60],[120,66],[8,66],[6,60]],darkOak);
        poly([[15,55],[112,55],[117,60],[11,60]],'#986846');
        r(9,60,110,2,'#cc9762');r(12,65,104,14,oak);r(12,77,104,2,darkOak);
        for(const x of [28,43,82,97])r(x,66,2,10,darkOak);
        r(48,62,32,18,cloth);r(49,63,30,1,'#759d93');r(48,78,32,2,brass);
        poly([[64,66],[70,71],[64,76],[58,71]],brass);r(63,70,3,3,'#ead89a');
        r(20,56,15,3,'#a3825f');r(23,54,10,3,'#dac799');r(24,54,1,4,'#8a5944');
        r(88,57,15,2,darkOak);r(90,55,11,2,brass);
        r(94,49,2,7,brass);r(87,51,16,1,brass);
        poly([[86,52],[91,52],[90,55],[87,55]],'#c69559');poly([[99,52],[104,52],[103,55],[100,55]],'#c69559');
      }
    }else if(type==='grave'){
      shadow(30,63,67,17);poly([[33,58],[78,48],[95,65],[79,77],[32,74]],'#414033');
      poly([[38,56],[39,33],[46,25],[66,25],[73,34],[72,57]],'#26312c');
      poly([[42,54],[42,35],[48,29],[65,29],[69,35],[67,55]],'#65736a');
      r(48,32,16,2,'#929885');r(53,36,3,13,'#424d46');r(49,40,12,2,'#424d46');
      r(42,56,25,3,'#7b8368');r(46,59,16,2,'#536246');r(74,63,9,3,'#7f7548');
    }else if(type.startsWith('jungle-shrine')||type==='rubble'){
      shadow(25,63,81,19);poly([[28,65],[38,52],[89,52],[99,66],[88,74],[36,74]],'#293730');
      for(const [x,y,w,h] of [[33,53,25,12],[58,51,31,16],[46,64,22,7]]){r(x,y,w,h,'#536355');r(x+2,y,w-4,2,'#82917a');r(x+2,y+3,w-5,2,'#59764c');}
      if(type.startsWith('jungle-shrine')){
        const active=type==='jungle-shrine';
        r(45,41,37,15,'#435449');r(48,38,31,5,'#94a087');r(48,42,29,2,'#738a5a');
        poly([[64,16],[75,27],[68,38],[60,38],[54,28]],active?'#5a252e':'#343537');
        poly([[63,18],[72,27],[66,34],[59,29]],active?'#cf5462':'#655861');r(63,22,3,5,active?'#ffaf9c':'#887982');
        for(const x of [43,81]){r(x,47,4,8,'#86734e');r(x+1,47,2,3,'#d2aa63');}
      }
    }else if(type==='basket'){
      shadow(35,66,58,12);poly([[36,52],[44,42],[82,42],[91,52],[83,72],[45,72]],'#5d4531');
      r(42,48,43,5,'#b18c58');r(45,46,36,2,'#6b503a');
      for(let y=54;y<70;y+=4)for(let x=44;x<84;x+=6)r(x+(y%8?0:2),y,4,2,y%8?'#a78655':'#c0a067');
    }else if(type==='bush'||type==='vines'){
      const colors=['#304838','#466248','#5a7c53','#7c965d'];
      for(let i=0;i<21;i++){
        const x=34+(i*19)%61,y=(type==='vines'?16:44)+(i*11)%(type==='vines'?48:26);
        if(type==='vines')r(x+4,13,2,y-12,colors[0]);
        poly([[x,y],[x+5,y-4],[x+12,y-1],[x+13,y+3],[x+6,y+7],[x+1,y+4]],colors[i%4]);r(x+3,y+1,6,1,colors[(i+1)%4]);
      }
    }else if(type==='lectern'){
      shadow(37,69,53,11);
      r(59,48,11,23,wood);r(49,68,30,6,edge);
      poly([[43,36],[85,36],[92,52],[36,52]],shade);
      r(45,38,38,12,grain);r(53,33,25,13,'#d4b57e');r(54,34,10,10,'#edd8a3');r(65,34,11,10,'#dbc491');
      for(let i=0;i<3;i++){r(56,36+i*3,6,1,wood);r(67,36+i*3,7,1,wood);}
    }
    function flame(x,y,tall){
      r(x-4,y-2,8,5,shade);r(x-2,y-(tall?19:9),4,tall?19:9,tall?grain:'#d9c195');
      const yy=y-(tall?21:10),drift=tall?[0,1,3,2,-1,-2,-3,-1][pose]:0;
      poly([[x-6,yy],[x-6,yy-7],[x-2+drift,yy-20+Math.abs(drift)],[x+1+drift,yy-16],[x+5+drift,yy-11],[x+7,yy-3],[x+4,yy+2],[x-3,yy+2]],'#ae4b32');
      r(x-4,yy-9,8,10,'#f49648');r(x-1+Math.sign(drift),yy-13,3,12,'#ffcd6d');r(x-2,yy-5,4,5,'#fff2aa');
    }
    spriteCache.set(key,c);return c;
  }
  // Integer-pixel sprite poses. The feet stay anchored while limbs, faces and effects move.
  function enemyPose(zone,frame,fireSnake=false){
    const c=surface(),{r,poly}=brush(c),step=frame%4,stage=(frame/4)|0;
    const stride=[-2,0,2,0][step],reach=[0,5,10,4][step];
    const anticipation=[0,1,3,5][step];
    const crouch=stage===1?anticipation:stage===2?-2:stage===3?3-step:Math.abs(stride);
    const y=n=>n+crouch;
    poly([[10,51],[18,47],[48,47],[55,52],[49,56],[14,56]],'#100d13a8');
    if(zone===16||zone===17){
     const g=c.getContext('2d');
     g.drawImage(enemyPose(zone===16?5:8,frame),0,0);
     g.globalCompositeOperation='source-atop';r(0,0,64,64,'#72bbde68');g.globalCompositeOperation='source-over';
     r(26,y(18),4,2,'#bdecff');r(35,y(18),4,2,'#fcffff');
     r(31,y(11),3,4,'#b3e4ed');r(21,y(31),5,2,'#9cdbf7');
     if(zone===17){r(48,28,13,2,'#9bd5f5');r(58,28,4,1,'#d1f6ff');}
     return c;
    }
    if(zone===15){
     const flight=stage===2?3:[0,4,6,2][step],crest=stage===1?4:0;
     for(const side of [-1,1]){
      const x=d=>32+d*side;
      poly([[x(4),27],[x(13),18-flight],[x(24),12-flight],[x(30),15-flight],[x(27),25],[x(17),33],[x(8),36]],'#30252a');
      poly([[x(6),28],[x(14),20-flight],[x(25),14-flight],[x(27),17-flight],[x(24),25],[x(15),31],[x(8),33]],'#896749');
      poly([[x(14),21-flight],[x(24),16-flight],[x(25),19-flight],[x(20),24],[x(13),28]],'#b19462');
     }
     poly([[24,22],[35,21],[44,27],[45,37],[35,43],[25,40],[19,44],[16,41],[22,34]],'#584031');
     poly([[33+crest,19],[42+crest,20],[49+crest,26],[45+crest,33],[35+crest,32],[30+crest,26]],'#ded4b5');
     r(41+crest,24,3,2,'#402e26');r(47+crest,27,8,2,'#e4ae43');r(51+crest,29,3,2,'#b98a3d');
     if(stage===2){r(34,40,7,3,'#c79a4e');r(40,39,3,4,'#f0c368');}
     return c;
    }
    if(zone===13||zone===14){
     const large=zone===14,bob=stage===2?-2:Math.abs(stride)%3,cx=large?29:32;
     poly([[19,43],[10,43],[6,38],[4,40],[10,46],[19,48]],'#a77b72');
     poly([[13,39+bob],[19,28+bob],[33,26+bob],[44,32+bob],[45,44],[20,48]],'#261f25');
     poly([[15,39+bob],[21,30+bob],[33,28+bob],[42,34+bob],[42,42],[21,45]],large?'#626373':'#87695e');
     for(const x of [20,35]){r(x,42+stride%3,6,7,'#423640');r(x+1,48+stride%3,7,2,'#a68779');}
     poly([[cx-1,30+bob],[cx+4,23+bob],[cx+12,24+bob],[cx+17,31+bob],[cx+23,34+bob],[cx+22,40+bob],[cx+10,42+bob],[cx+3,37+bob]],'#59464b');
     r(cx+4,22+bob,7,7,'#93716e');r(cx+5,23+bob,4,4,'#be8391');
     r(cx+13,30+bob,3,2,large?'#9bf2ff':'#f7c495');r(cx+21,34+bob,3,3,'#322331');
     if(stage===2||!large){r(cx+20,39+bob,3,3,'#eee4bc');r(cx+15,40+bob,2,2,'#e2ce9c');}
     if(large){
      const tip=stage===2?57:stage===1?48:51;
      r(19,22+bob,16,9,'#414653');r(20,23+bob,12,6,'#627783');r(23,24+bob,4,4,'#85c3bf');
      poly([[30,37],[35,36],[tip+3,14],[tip+5,16],[37,39],[31,41]],'#4e4148');
      poly([[34,36],[tip+3,15],[tip+4,17],[36,38]],'#c4a76f');
      poly([[tip,17],[tip+3,11],[tip+8,13],[tip+6,18]],stage===1||stage===2?'#cafcff':'#69a9bf');
      if(stage===2){r(tip-5,13,6,2,'#7eeaff');r(tip-3,7,2,5,'#b2f5ff');}
     }
     return c;
    }
    if(zone===7||zone===8){
     const bow=zone===7,body=enemyPose(bow?3:5,stage===0?frame:4);
     c.getContext('2d').drawImage(body,0,0);
     r(44,14,20,38,'#211b1a77');
     const pull=stage===1?step*3:stage===2?8-step*2:0;
     if(bow){
      poly([[48,12],[53,9],[60,18],[63,29],[61,42],[54,49],[49,48],[57,40],[59,29],[55,19]],'#b68959');
      poly([[52,10],[55-pull,29],[54,49],[52,49],[53-pull,29]],'#dec8a4');
      if(stage<2)r(47-pull,28,15+pull,2,'#f2dcaa');
     }else{
      r(40,28,22,5,'#a47a51');r(47-pull/2|0,30,6,11,'#674437');
      poly([[42,19],[47,21],[51,26],[57,22],[62,21],[60,25],[52,30],[44,24]],'#99918a');
      r(55,27,8,2,'#e6d6ab');
     }
     r(42-pull/2|0,29,5,5,bow?'#cfc09e':'#a5a473');
     return c;
    }else if(zone===5){
     // A bent corpse straightens and reaches with both hands before its grab.
     const thrust=stage===2?reach+6:stage===1?-anticipation:stride;
     r(21,40+stride,9,14-stride,'#252923');r(36,40-stride,9,14+stride,'#303229');
     poly([[20,y(21)],[45,y(19)],[48,y(42)],[32,48],[17,y(43)]],'#182123');
     poly([[23,y(22)],[40,y(22)],[44,y(37)],[38,45],[21,43]],'#526459');
     r(25,y(30),13,3,'#887d67');r(23,y(36),6,3,'#465349');
     poly([[25,y(7)],[38,y(8)],[44,y(15)],[41,y(27)],[32,y(29)],[22,y(24)],[21,y(15)]],'#252b25');
     r(25,y(12),14,11,'#9a9e73');r(27,y(10),10,3,'#656b51');
     r(26,y(18),4,3,'#deb86e');r(35,y(18),4,3,'#d5a96f');r(29,y(24),8,2,'#50433c');
     for(const x of [12,43]){
      r(x,y(24)+thrust,8,13,'#344840');r(x+1,y(34)+thrust,6,6,'#a4a57c');r(x+1,y(38)+thrust,2,4,'#c1bc8c');
     }
     if(stage===2){r(9,43+step,4,2,'#c1bc8c');r(54,42+step,4,2,'#c1bc8c');}
    }else if(zone===6){
     // A low serpentine silhouette, lifted head and a separate strike pose.
     const wave=[0,3,0,-3][step],lift=stage===1?anticipation*2:stage===2?8:0;
     const tail=[[4,42],[11,44+wave],[19,44],[24,38],[33,35-wave],[44,39],[53,36],[57,27-lift],[61,32-lift],[60,42],[51,49],[41,49],[33,45+wave],[25,47],[17,51],[10,48]];
     const [edge,scales,spots,crown,face]=fireSnake?
      ['#3d2228','#ae4b43','#f38555','#622d30','#da6851']:['#252822','#727c54','#afb47c','#303728','#a7a879'];
     poly(tail,edge);
     poly([[7,44],[18,46],[26,40],[35,39-wave],[45,42],[53,40],[57,33-lift],[59,37-lift],[57,44],[48,47],[38,44+wave],[26,44],[17,49]],scales);
     for(let n=0;n<4;n++)r(19+n*8,43+(n%2?wave:0),3,2,spots);
     poly([[51,27-lift],[55,23-lift],[62,23-lift],[64,28-lift],[61,35-lift],[53,35-lift],[50,32-lift]],crown);
     r(54,27-lift,8,5,face);r(59,27-lift,2,2,'#f4ce7f');
     if(fireSnake&&stage===2){
      r(61,32-lift,3,4,'#ffb651');r(58,35-lift,2,2,'#ffe3a0');r(62,38-lift-step,2,2,'#d76344');
     }
     if(stage===2){r(59,33-lift,4,2,'#e2d8aa');r(60,36-lift,4,1,'#c88f89');}
    }else if(zone===0){
     // Moss sentinel plants alternating feet, tucks its head, then drives both fists forward.
     const p=['#222b22','#414d35','#647454','#a49f6b','#324334'];
     const arm=stage===2?8+reach:stage===1?-anticipation:stride;
     block(r,19,40+stride,12,14-stride,p,0);block(r,34,40-stride,12,14+stride,p,0);
     block(r,11,y(26)+arm,12,17,p,1);block(r,41,y(26)+arm,12,17,p,1);
     block(r,19,y(21),27,24,p,1);block(r,22,y(10),21,17,p,1);
     r(25,y(18),5,3,'#f0c77b');r(34,y(18),5,3,'#f0c77b');
     r(20,y(33),8,3,'#89925b');r(34,y(26),9,4,'#8c9b61');
     if(stage===2){r(5,19+step*5,5,4,'#c5aa7766');r(55,27+step*4,4,3,'#c5aa7766');}
    }else if(zone===1){
     // The cinder cultist disappears into its cloak and tears a dark rift while lunging.
     const sway=stage===2?reach:stride;
     poly([[30,y(8)],[42,y(14)],[48,y(29)],[53+sway,50],[40,53],[17+sway,54],[10+sway,48],[19,y(22)]],ink);
     poly([[31,y(12)],[41,y(17)],[44,y(33)],[49+sway,48],[34+sway,51],[15+sway,49],[22,y(23)]],'#794147');
     poly([[27,y(18)],[33,y(15)],[39,y(21)],[38,y(29)],[25,y(29)]],'#b27157');
     r(27,y(23),11,5,ink);r(29,y(24),3,2,'#ffd18a');r(34,y(24),3,2,'#ffd18a');
     r(31+sway,y(34),3,9,'#b8845c');r(29+sway,y(36),7,2,'#e2b779');
     if(stage>0&&stage<3){
      const x=13+reach;
      poly([[x,y(33)],[x+3,y(28)],[x+10,y(32)],[x+8,y(39)],[x-3,y(42)]],'#b17ecf');
      r(x+2,y(34),4,5,'#ebc6f4');r(x-6,y(43)+step,3,2,'#b37bc6');
     }
    }else if(zone===2){
     // Each opposing leg pair changes angle. The abdomen rises before the web release.
     const lift=stage===1?anticipation*2:stage===2?8-reach/2:0;
     for(const side of [-1,1])for(let i=0;i<4;i++){
      const leg=22+i*6,bend=7+i*3+(i%2===0?stride:-stride)+lift;
      const mir=points=>points.map(([x,yy])=>[32+(x-32)*side,Math.round(yy)]);
      poly(mir([[37,leg],[54,leg-bend],[59,leg-bend+3],[63,leg+5],[60,leg+7],[55,leg-bend+7],[37,leg+6]]),ink);
      poly(mir([[39,leg+1],[54,leg-bend+2],[58,leg-bend+4],[61,leg+5],[57,leg-bend+6],[38,leg+4]]),'#986361');
     }
     poly([[24,y(10)],[40,y(10)],[47,y(22)],[44,43],[38,50],[24,49],[18,39],[19,y(23)]],ink);
     poly([[25,y(12)],[38,y(12)],[44,y(23)],[42,39],[35,46],[24,43],[22,34],[22,y(22)]],'#593a4b');
     r(27,y(19),10,4,'#9c626c');r(24,y(26),3,3,'#805869');r(38,y(26),3,3,'#805869');
     for(const x of [24,30,36])r(x,38,4,3,'#f19478');
     r(24,43,3,6,'#a78579');r(37,43,3,6,'#a78579');
     if(stage===2){r(30,48+step,4+step*2,2,'#ebdfc8');r(25-step,52+step,3,2,'#c5b9a9');}
    }else if(zone===3){
     // A skeleton raises its blade overhead, then swings through four hand positions.
     poly([[22,y(25)],[43,y(25)],[49,49],[40,53],[17,52],[13,49]],'#473631');
     r(24,29+stride,5,20,'#a4977a');r(35,29-stride,5,20,'#b1a88a');
     r(20,y(9),24,20,ink);r(23,y(10),18,16,'#c0b399');r(23,y(10),18,3,'#e2d4ae');
     r(25,y(17),5,5,ink);r(34,y(17),5,5,ink);r(30,y(22),4,4,'#63574a');
     for(const i of [0,1,2]){r(23,31+i*4,20,2,'#cebf99');}
     const [x,handY,tipX,tipY]=(stage===1?[[50,34,53,11],[50,30,55,6],[47,26,52,4],[43,22,48,3]]:
      stage===2?[[42,22,56,5],[48,27,63,23],[48,38,62,49],[42,42,48,61]]:
      [[46,37,52,13],[47,37,53,14],[46,39,52,15],[46,38,52,14]])[step];
     poly([[39,29],[x,handY],[x-3,handY+5],[37,34]],'#b3a78c');
     poly([[x-2,handY],[tipX-2,tipY],[tipX+2,tipY],[x+3,handY+4]],'#d6c7a2');
     r(x-3,handY,7,3,'#a8784d');
    }else{
     // The wraith's hem ripples, then ice crystals grow between its raised hands.
     const float=y(0),spread=stage===2?step*3:stride;
     poly([[31,6+float],[43,14+float],[48,27+float],[55+spread,46],[43,44],[40,54],[31,49+stride],[23,55],[19,47],[11-spread,51],[17,26+float]],'#223140');
     poly([[31,10+float],[41,17+float],[44,28+float],[49+spread,42],[38,42],[36,49],[29,46],[23,51],[18-spread,45],[21,30+float]],'#537d8b');
     poly([[29,y(13)],[39,y(17)],[43,y(26)],[35,y(30)],[24,y(27)],[24,y(20)]],'#87aab2');
     r(25,y(23),15,5,'#304351');r(27,y(24),4,2,'#c7f7ef');r(34,y(24),4,2,'#c7f7ef');
     if(stage===1||stage===2){
      for(const x of [12,51]){
       const height=3+step*2+(stage===2?5:0);
       poly([[x,31-height],[x+4,31],[x+1,37],[x-3,32]],'#b3f0ff');
       r(x,31,2,4,'#e9ffff');
      }
     }
    }
    return c;
  }
  const armorAccents={pathfinder:'#b6d0c6',bastion:'#f4d28c',emberheart:'#ffac76',windstep:'#9de1f1'};
  function armorEmblem({r,poly},set,x,y){
    const accent=armorAccents[set];
    switch(set){
      case 'pathfinder':
        poly([[x,y-4],[x+4,y],[x+2,y],[x+2,y+3],[x-2,y+3],[x-2,y],[x-4,y]],accent);
        break;
      case 'bastion':
        poly([[x-4,y-3],[x+4,y-3],[x+3,y+1],[x,y+4],[x-3,y+1]],accent);
        r(x-1,y-2,2,4,'#88704d');
        break;
      case 'emberheart':
        poly([[x,y-4],[x+1,y-1],[x+4,y-2],[x+3,y+2],[x,y+4],[x-3,y+2],[x-4,y-2],[x-1,y-1]],accent);
        r(x-1,y,2,2,'#fff2c2');
        break;
      case 'windstep':
        r(x-1,y-3,5,1,accent);r(x-4,y-1,7,1,accent);r(x-3,y+1,4,1,accent);
        break;
    }
  }
  function armorDetails({r,poly},armor,back,step,sway){
    const leather='#7b533d',silver='#c8c3b0',antique='#bc995d',shadeBlue='#3c4158',inkGold='#523c42';
    switch(armor.helmetStyle){
      case 'wanderer':
        r(22,12,21,3,leather);r(22,13,21,1,'#a57b4e');r(24,15,2,5,leather);
        if(!back)r(33,13,2,4,antique);
        break;
      case 'scholar':
        poly([[20,15],[25,10],[30,7],[34,8],[42,13],[45,21],[41,26],[38,23],[39,16],[25,16],[25,25],[21,24]],'#505074');
        r(28,10,9,2,'#a68ed2');r(31,12,3,2,'#d1b8ef');
        if(back){r(27,16,12,9,armor.helmet);r(31,16,2,9,'#a68ed2');}
        break;
      case 'hunter':
        r(20,15,25,3,'#587665');r(22,16,20,2,'#9bab74');
        poly([[36,13],[39,6],[43,3],[42,9],[39,14]],'#ba9d60');r(39,10,3,2,'#e3c081');
        if(back)r(27,22,10,3,'#435a49');
        break;
      case 'knight':
        r(22,11,21,13,armor.helmet);r(24,11,17,2,silver);
        if(back){r(37,14,2,9,'#586478');r(31,23,4,2,antique);}
        else{r(25,17,15,3,'#343642');r(31,16,2,7,silver);}
        poly([[27,9],[29,5],[37,5],[40,8],[35,8],[33,10]],'#965467');
        break;
      case 'shadow':
        poly([[20,16],[25,10],[29,9],[28,5],[34,8],[39,9],[44,15],[44,24],[40,29],[38,25],[24,25],[20,24]],'#302743');
        r(23,16,18,2,'#685980');if(!back){r(26,18,12,4,'#46374e');r(26,19,4,1,'#dcc1a3');r(34,19,4,1,'#dcc1a3');}
        break;
    }
    if(armorAccents[armor.helmetStyle]){
      r(22,13,21,2,armorAccents[armor.helmetStyle]);
      if(!back)armorEmblem({r,poly},armor.helmetStyle,32,14);
    }
    switch(armor.chestStyle){
      case 'wanderer':
        if(back){r(25+sway,35,12,2,leather);r(27+sway,36,3,6,'#9f7752');}
        else{r(24,29,3,10,leather);r(36,29,3,10,leather);r(26,35,12,2,antique);}
        break;
      case 'scholar':
        r(17,29,6,6,'#6c577f');r(41,29,6,6,'#6c577f');
        poly([[32+sway,back?36:31],[36+sway,back?40:35],[32+sway,back?44:39],[28+sway,back?40:35]],'#ad9ad1');
        r(31+sway,back?39:34,3,3,'#e4d7d9');
        break;
      case 'hunter':
        poly([[21+sway,28],[24+sway,28],[41+sway,42],[37+sway,44]],leather);
        r(30+sway,35,5,4,antique);
        if(back){r(38+sway,40,5,9,'#333b31');r(40+sway,35,2,7,antique);}
        break;
      case 'knight':
        r(15,28,10,5,silver);r(40,28,10,5,silver);
        r(16,33,6,3,'#738094');r(42,33,6,3,'#738094');
        if(back){r(26+sway,31,13,3,antique);r(31+sway,34,3,3,silver);}
        else{r(27,32,10,2,silver);r(30,34,4,4,antique);}
        break;
      case 'shadow':
        poly([[14,31],[21,26],[25,29],[22,36],[17,34]],shadeBlue);
        poly([[50,31],[43,26],[39,29],[42,36],[47,35]],shadeBlue);
        r(25+sway,34,13,2,'#8d7698');r(29+sway,36,6,2,'#705878');
        if(back){r(24+sway,42,2,5,'#493650');r(39+sway,43,2,5,'#493650');}
        break;
    }
    if(armorAccents[armor.chestStyle]){
      const accent=armorAccents[armor.chestStyle];
      r(17,29,6,2,accent);r(41,29,6,2,accent);
      armorEmblem({r,poly},armor.chestStyle,32+sway,back?35:33);
    }
    for(const [x,y] of [[23,step],[34,-step]]){
      const band={wanderer:leather,scholar:'#9180af',hunter:'#5b6541',knight:silver,shadow:shadeBlue}[armor.legsStyle]??armorAccents[armor.legsStyle];
      const cuff={wanderer:'#79563b',scholar:'#a392bf',hunter:'#92955f',knight:silver,shadow:inkGold}[armor.bootsStyle]??armorAccents[armor.bootsStyle];
      if(band)r(x+1,45+y,5,1,band);
      if(cuff)r(x,50+y,7,1,cuff);
    }
  }
  function actor(type,options={}) {
    if(type==='foe')return enemyPose(options.zone||0,options.frame||0,options.fireSnake);
    const {frame=0,skin='#d4a785',hair='#392b4e',color='#755666',gender='male',armor={},back=false,groundShadow=true}=options;
    const c=surface(),{r,poly}=brush(c);
    const shape=(p,col)=>poly(p,col);
    if(groundShadow)shape([[13,47],[49,47],[55,52],[51,56],[13,56],[8,53]],'#100d13a8');
    if(type==='hero'&&back){
      const stride=[0,-3,-2,-1,3,2,1][frame],sway=[0,-2,-1,1,2,1,-1][frame];
      const lift=0;
      for(const [x,y] of [[23,stride],[34,-stride]]){
        r(x,40,8,13+y,ink);r(x+1,41,6,10+y,armor.legs||skin);
        r(x-1,49+y,10,5,ink);r(x,49+y,8,3,armor.boots||skin);
        if(armor.boots)r(x+1,49+y,5,1,'#b6aa8a');
      }
      shape([[20,27+lift],[43,27+lift],[48,39],[42,43],[21,43],[16,39]],ink);
      r(22,27+lift,20,15-lift,armor.chest||skin);
      if(!armor.legs){
        shape([[23,40],[41,40],[38,49],[33,51],[26,48]],'#70503d');
        r(25,41,14,2,'#bd935e');r(30,43,2,5,'#a77b54');
      }
      if(armor.chest){
        shape([[16,30],[21,26+lift],[43,26+lift],[48,31],[44,37],[20,37]],armor.chest);
        r(18,29+lift,10,2,'#cabda3');r(36,29+lift,10,2,'#cabda3');
        shape([[23,29],[41,29],[43+sway,46],[47+sway,48],[34+sway,51],[18+sway,49],[21+sway,45]],ink);
        shape([[24,30],[39,30],[41+sway,46],[44+sway,47],[34+sway,49],[20+sway,47],[23+sway,44]],color);
        shape([[25,32],[29,31],[27+sway,46],[24+sway,47],[21+sway,47]],'#0f0b194f');
        shape([[33,31],[36,32],[36+sway,43],[40+sway,47],[36+sway,48],[34+sway,44]],'#e3c5bd52');
        r(30+sway,44,2,3,'#e3c5bd52');r(29,30,6,2,'#a79173');
      }else{
        r(24,30,7,1,'#8b5d5270');r(33,30,7,1,'#8b5d5270');r(31,30,1,9,'#8b5d5270');
        if(gender==='female'){r(22,31,20,5,'#694336');r(24,32,16,2,'#ab7856');}
        r(23,39,18,3,'#51362d');
      }
      r(17,37,6,6,skin);r(42,37,6,6,skin);
      r(28,23+lift,8,6,skin);
      shape([[22,11],[24,9],[40,9],[43,12],[43,24],[40,27],[24,27],[22,25]],ink);
      shape([[23,12],[25,10],[39,10],[42,13],[42,24],[39,26],[25,26],[23,24]],armor.helmet||hair);
      if(armor.helmet){
        r(29,11+lift,9,2,'#ddd5b4');r(32,13+lift,2,10,'#d6c9a875');
        r(24,22+lift,16,2,'#343036a0');r(27,25+lift,10,1,'#a39a83');
      }else{
        r(27,12+lift,10,2,'#b984995c');r(25,17+lift,2,7,'#18132178');r(29,26+lift,7,2,skin);
        if(gender==='female'){
          shape([[34,20],[39,20],[41+sway,33],[36+sway,37],[33+sway,34]],hair);
          r(35+sway,34,3,2,'#b3916590');
        }
      }
      armorDetails({r,poly},armor,true,stride,sway);
      return c;
    }
    if(type==='hero'){
      const step=frame===1?2:frame===2?-2:0;
      if(armor.chest){
        shape([[21,25],[43,25],[51,50],[44,54],[19,54],[12,49]],ink);
        shape([[22,27],[42,27],[47,49],[36,52],[17,48]],color);
      }
      for(const [x,y] of [[23,step],[34,-step]]){
        r(x,41,8,12+y,ink);r(x+1,42,6,10+y,armor.legs||skin);
        r(x-2,50+y,11,4,armor.boots||skin);
      }
      r(20,29,24,12,ink);r(23,27,18,14,armor.chest||skin);
      if(armor.chest){
        r(24,29,15,2,'#d6c9a8');r(26,33,12,2,'#5f5d56');
        r(16,28,9,8,'#514846');r(17,28,7,2,'#bcb39c');r(40,28,9,8,'#514846');r(41,28,6,2,'#bcb39c');
      }else{
        r(18,29,7,10,skin);r(40,29,6,9,skin);
        if(gender==='female'){r(22,28,20,8,'#5f3d30');r(24,29,16,2,'#ac7856');r(24,34,16,2,'#3a2623');}
        else {r(24,30,6,1,'#8b5d5290');r(34,30,5,1,'#8b5d5290');r(31,36,2,2,'#8b5d52a0');}
      }
      if(!armor.legs){
        shape([[23,39],[41,39],[39,49],[32,52],[25,48]],'#4d3228');
        shape([[26,40],[39,40],[36,49],[29,50]],'#9b7452');r(29,42,2,6,'#c79b63');
      }
      r(23,38,18,3,'#51362d');r(31,38,4,4,gold);
      r(17,38,6,6,skin);if(frame<3)r(42,37,6,6,skin);
      r(22,11,20,16,ink);r(24,13,16,13,skin);r(23,10,18,6,hair);r(22,15,4,7,hair);r(39,15,4,6,hair);
      r(27,18,3,2,ink);r(35,18,3,2,ink);r(30,23,5,1,'#905d51');
      if(gender==='female'&&!armor.helmet){r(21,18,4,10,hair);r(39,18,5,9,hair);}
      if(armor.helmet){r(22,10,21,7,armor.helmet);r(24,9,16,2,'#ddd5b4');r(22,15,5,9,armor.helmet);r(39,15,4,9,armor.helmet);}
      armorDetails({r,poly},armor,false,step,0);
      if(frame>=3){
       const drinking=frame>=7,stage=(frame-3)%4;
       const [hx,hy]=[[43,38],[39,29],[35,23],[41,31]][stage];
       shape([[43,30],[47,30],[48,hy+5],[hx+3,hy+5],[hx,hy],[42,hy]],'#34252a');
       shape([[44,32],[45,32],[46,hy+4],[hx+3,hy+4],[hx+1,hy]],armor.chest||skin);
       r(hx,hy-1,5,5,skin);
       if(drinking){
        const tilted=stage===2?3:0;
        shape([[hx-5,hy-8+tilted],[hx+3,hy-8],[hx+2,hy],[hx-3,hy]],'#604353');
        r(hx-4,hy-8+tilted,7,2,'#dbc9ad');r(hx-3,hy-5,5,3,'#9976b0');
       }else{
        shape([[hx-6,hy-2],[hx-5,hy-7],[hx,hy-8],[hx+2,hy-5],[hx+1,hy]],'#9c6841');
        r(hx-4,hy-6,4,3,'#eac085');if(stage===2)r(hx-7,hy+1,2,2,'#e2ab62');
       }
      }
    }
    return c;
  }
  function icon(type,id='',color='') {
    const key=[type,id,color].join('/');
    if(iconCache.has(key))return iconCache.get(key);
    const c=surface(),{r,poly}=brush(c);
    const iron=color||'#9aabad', pale='#d6dcd0';
    if(type==='card-ornament'){
      const enamel=color||'#9c8068';
      const dark='#392923',gold='#b39768',shine='#d6b987';
      for(const side of [-1,1]){
       const edge=x=>32+side*x;
       poly([[edge(0),33],[edge(7),25],[edge(16),22],[edge(28),26],[edge(19),27],[edge(14),31],[edge(6),35]],dark);
       poly([[edge(1),32],[edge(7),27],[edge(17),24],[edge(27),26],[edge(19),26],[edge(14),29],[edge(5),33]],gold);
       poly([[edge(7),32],[edge(14),31],[edge(20),33],[edge(24),31],[edge(23),35],[edge(14),36]],enamel);
       r(edge(26)-1,25,2,2,shine);r(edge(18)-1,21,2,2,gold);
      }
      poly([[32,18],[41,29],[39,36],[32,44],[25,36],[23,29]],'#48352b');
      poly([[32,21],[39,30],[37,36],[32,41],[27,35],[25,30]],shine);
      poly([[32,24],[37,30],[35,35],[32,38],[28,33]],enamel);
      r(30,28,3,3,'#e2c398');
    }else if(type==='rest-cat'){
      const [mode,pose='0']=id.split('-'),n=Number(pose),dark='#24212a',white='#ede2cb',shadeWhite='#c6bda9';
      poly([[14,48],[49,48],[55,52],[42,55],[13,54],[9,51]],'#17121488');
      const face=(x,y,closed)=>{
        poly([[x-10,y-4],[x-11,y-13],[x-6,y-10],[x+4,y-10],[x+10,y-14],[x+11,y-6],[x+10,y+4],[x+6,y+7],[x-6,y+7],[x-10,y+4]],dark);
        r(x-9,y-10,2,3,'#ab7b7d');r(x+6,y-10,2,3,'#ab7b7d');
        poly([[x-5,y],[x+4,y],[x+7,y+3],[x+4,y+7],[x-5,y+7],[x-8,y+3]],white);
        r(x-6,y-3,3,closed?1:2,closed?'#8d8075':'#d0da94');r(x+4,y-3,3,closed?1:2,closed?'#8d8075':'#d0da94');
        r(x-1,y+2,3,2,'#a9767b');
      };
      if(mode==='sleep'){
        const breath=n%4===1||n%4===2?1:0;
        poly([[16,40],[26,35-breath],[39,35-breath],[46,41],[47,48],[44,51],[17,51],[12,46]],dark);
        r(18,43,11,6,shadeWhite);face(38,42,true);
        r(13,44,5,6,dark);r(14,48,12,3,dark);r(20,49,4,2,white);
      }else if(mode==='walk'||mode==='jump'){
        const jump=mode==='jump',lift=jump?[0,4,9,11,9,5,1,0][n]:0;
        const y=37-lift,bob=jump?0:n%2;
        poly([[15,y],[25,y-6],[38,y-6],[47,y-1],[44,y+7],[18,y+7],[13,y+3]],dark);
        r(27,y+3,12,4,white);
        poly([[16,y+1],[10,y-4],[8,y-12],[11,y-14],[13,y-7],[19,y-3]],dark);
        r(9,y-14,4,3,white);face(47,y-3-bob,false);
        for(const [i,x] of [18,26,39,46].entries()){
          const dx=jump?(i<2?-3:4):[[-3,2],[0,0],[3,-2],[0,0]][n%4][i%2];
          const foot=y+(jump?8+i%2*2:11+(i+n)%2*2);
          r(x+dx,y+6,4,foot-y-4,dark);r(x+dx,foot,5,2,white);
        }
      }else{
        const y=mode==='sit'?29:34,tail=[0,1,3,1][n%4];
        poly([[21,y+1],[33,y],[42,y+5],[46,46],[40,50],[20,50],[15,45]],dark);
        poly([[29,y+4],[36,y+4],[38,42],[34,49],[26,49]],white);
        for(const x of [24,34])r(x,47,6,4,white);
        poly([[40,44],[49,44],[54,41-tail],[57,37-tail],[60,38-tail],[57,47],[49,51],[42,51]],dark);
        r(57,37-tail,3,3,shadeWhite);face(31,y-1,n===3);
      }
    }else if(type==='soul'){
      const f=Number(id)||0,tone=color||'#f3e6cb';
      const blend=(target,alpha)=>{
       const rgb=[1,3,5].map((i,j)=>Math.round(parseInt(tone.slice(i,i+2),16)*(1-alpha)+target[j]*alpha));
       return '#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('');
      };
      const mist=blend([255,255,255],.37),dark=blend([21,14,29],.64),core=blend([255,250,230],.72);
      poly([[15,50],[26,47],[41,47],[50,52],[41,55],[19,55]],'#100e1680');
      poly([[31+f%3,9],[36,16],[46,26],[49,36],[45,46],[37,51],[26,51],[17,46],[14,37],[18,27],[24,20]],tone+'36');
      poly([[30+f%3,14],[36,22],[43,29],[46,37],[43,44],[36,48],[25,48],[19,43],[17,36],[21,28],[26,23]],dark);
      poly([[30+f%3,19],[34,26],[41,31],[43,38],[39,45],[32,47],[24,45],[20,39],[22,31],[27,25]],tone);
      poly([[30,25+f%2],[34,32],[38,34],[36,42],[30,45],[25,40],[25,34]],mist);
      poly([[30,31],[34,35],[33,41],[29,42],[27,37]],core);
      r(23,31,2,6,mist);r(37,42,3,2,dark);
      for(const [x,y,w] of [[12+f,23-f,2],[47-f,17+f*2,2],[25+f*2,10+f,1],[44,39-f,2]])r(x,y,w,w,mist);
    }else if(type==='kettle'){
      r(9,53,46,4,'#1a1515');r(15,44,34,9,'#674434');r(18,45,7,7,'#44302b');r(39,45,7,7,'#44302b');
      poly([[9,25],[55,25],[52,38],[47,45],[40,49],[24,49],[17,45],[12,38]],ink);
      poly([[12,25],[52,25],[50,36],[45,43],[39,46],[25,46],[19,43],[14,36]],'#52535a');
      r(9,24,46,5,'#817b6b');r(14,25,36,2,'#6eb49f');r(16,31,3,8,'#a7a08a');r(45,32,3,5,'#6a7774');
      r(27,51,9,7,'#713b25');r(30,49,4,8,'#ec9a54');r(31,52,3,4,'#ffda83');
      for(const [x,y] of [[24,20],[37,15],[30,11],[35,6]]){r(x,y,3,3,'#789a87');r(x+1,y,1,1,'#a9ceb3');}
    }else if(type==='food'){
      if(id==='glucose'){
       for(const [x,y] of [[18,31],[32,27],[27,41]]){r(x,y,15,12,'#786368');r(x+2,y+1,11,8,'#e6d0cb');r(x+2,y+1,11,2,'#fff2e3');}
      }else if(id==='banana'){
       poly([[14,23],[20,21],[22,29],[28,34],[37,35],[44,28],[45,19],[51,20],[53,29],[48,40],[39,46],[26,46],[17,39]],'#84542d');
       poly([[17,24],[20,25],[22,34],[30,40],[40,40],[46,34],[49,22],[51,25],[47,37],[38,44],[27,44],[19,37]],'#e6bb52');
       r(19,22,3,4,'#82905b');r(46,21,6,2,'#e9d681');
      }else if(id==='bread'){
       poly([[12,38],[16,29],[22,24],[39,22],[49,25],[53,32],[51,42],[45,46],[19,47],[12,43]],'#693d2f');
       poly([[15,35],[20,28],[29,25],[40,24],[48,28],[50,33],[45,40],[19,43],[15,40]],'#bc8250');
       for(const x of [22,31,40])poly([[x,29],[x+3,28],[x+7,33],[x+4,35]],'#eac189');
      }else{
       poly([[13,27],[21,21],[34,23],[43,31],[43,38],[34,46],[20,45],[13,38]],'#6b3931');
       poly([[16,28],[23,24],[33,25],[39,31],[40,38],[31,44],[21,42],[16,36]],'#b47047');
       r(21,29,9,2,'#e1aa65');r(26,35,8,2,'#d49155');
       poly([[39,33],[51,36],[54,34],[57,37],[55,43],[49,44],[38,39]],'#e4cab0');
      }
    }else if(type==='chest'){
      r(8,39,48,13,'#110e12aa');r(10,23,44,25,ink);r(13,27,38,18,wood);r(15,41,34,2,edge);
      if(id==='open'){r(14,15,36,15,shade);r(17,15,29,3,grain);r(17,26,30,7,ink);}
      else{poly([[11,28],[14,20],[19,17],[47,17],[54,23],[54,30],[11,30]],grain);r(17,18,29,2,edge);r(12,27,42,3,gold);}
      r(16,22,4,23,'#a97b4b');r(45,22,4,23,'#a97b4b');r(29,28,8,9,gold);r(31,31,3,3,ink);
      if(id==='trial'){r(12,27,42,3,'#a985c6');r(16,22,4,23,'#82729f');r(45,22,4,23,'#82729f');r(29,28,8,9,'#726795');r(31,30,4,4,'#dfb4f0');r(32,19,2,5,'#d5b5dc');}
    }else if(type==='shrine'||type==='seal'){
      const glow=color||'#9cbed0';
      if(type==='shrine'){r(12,47,40,10,ink);r(16,44,32,8,'#636564');r(20,43,24,2,'#9c9080');}
      poly([[32,8],[46,23],[44,39],[32,49],[19,40],[18,25]],ink);
      poly([[32,11],[43,25],[41,37],[32,45],[22,37],[22,25]],type==='seal'?glow:'#526d75');
      poly([[32,16],[40,26],[39,34],[32,41],[25,34],[25,26]],glow);
      r(30,20,3,13,'#e6e6bf');r(26,26,11,3,'#e6e6bf');r(31,36,2,2,ink);
    }else if(type==='bat-merchant'){
      const phase=Number(id)%8||0,lift=[0,0,1,1,1,0,0,0][phase],blink=phase===7;
      const outline='#251f2c',skin='#8a717e',light='#ad8c8f',cloak='#4d435e',vest='#31565d';
      for(const side of [-1,1]){
        const x=n=>32+side*n;
        poly([[x(7),31-lift],[x(17),20-lift],[x(27),23-lift],[x(30),36],[x(23),34],[x(26),50],[x(15),45],[x(13),53]],outline);
        poly([[x(11),33-lift],[x(18),23-lift],[x(25),25-lift],[x(27),33],[x(21),31],[x(23),46],[x(15),43],[x(13),48]],cloak);
        poly([[x(14),37],[x(18),25-lift],[x(24),27-lift],[x(20),31],[x(19),42]],'#6b5670');
        poly([[x(7),19-lift],[x(11),7-lift],[x(20),5-lift],[x(19),18-lift],[x(12),25-lift]],outline);
        poly([[x(10),19-lift],[x(12),10-lift],[x(17),8-lift],[x(16),17-lift],[x(12),22-lift]],'#765563');
      }
      poly([[20,31-lift],[30,27-lift],[43,29-lift],[48,43],[44,53],[20,53],[16,43]],outline);
      poly([[21,32-lift],[29,29-lift],[42,30-lift],[44,44],[41,51],[23,51],[20,44]],vest);
      poly([[22,32],[29,40],[32,37],[36,40],[43,32],[40,42],[32,46],[24,42]],'#82a29b');
      r(31,39,3,11,'#21373f');r(29,42,7,3,'#d9b46e');r(32,42,2,1,'#fff0b0');
      poly([[21,19-lift],[25,15-lift],[38,15-lift],[43,20-lift],[42,28-lift],[37,35-lift],[29,35-lift],[23,30-lift]],outline);
      poly([[23,21-lift],[28,17-lift],[37,17-lift],[41,21-lift],[39,28-lift],[35,33-lift],[29,32-lift],[25,28-lift]],skin);
      r(27,18-lift,10,2,light);r(26,23-lift,5,2,blink?'#58414f':'#f2bc79');r(35,23-lift,5,2,blink?'#58414f':'#f2bc79');
      if(!blink){r(29,23-lift,1,2,outline);r(37,23-lift,1,2,outline);}
      r(31,25-lift,5,3,'#573d4d');r(29,29-lift,8,1,outline);r(29,29-lift,2,2,'#f0dab4');r(36,29-lift,2,2,'#f0dab4');
      r(19,47,8,4,skin);r(38,47,8,4,skin);r(20,47,5,1,light);r(39,47,5,1,light);
    }else if(type==='lion'){
      const [style,raw]=id.split('-'),pose=Number(raw),stage=pose>>2,step=pose%4;
      const mane=style==='mane',bob=stage===2?-3:stage===3?-1:stage===1?2:step%2;
      const coat=mane?'#b68a52':'#d7ac6a',shadowTone=mane?'#805634':'#aa7b49';
      r(12,49,43,4,'#15161899');
      poly([[10,40],[8,30-step],[13,28-step],[15,34],[20,38],[19,44]],shadowTone);r(8,27-step,5,4,'#674536');
      poly([[15,34+bob],[26,28+bob],[41,28+bob],[50,37+bob],[47,45+bob],[21,46+bob]],'#3e302b');
      poly([[17,34+bob],[28,30+bob],[40,31+bob],[47,38+bob],[43,43+bob],[20,43+bob]],coat);
      const front=stage===4?[0,13,9,3][step]:stage===2?step+4:stage===3&&step%2?5:0;
      for(const [x,offset] of [[19,0],[28,2],[38,front],[45,front+2]]){
        const y=44+bob+((step+offset)%3);
        r(x+offset,y-4,5,8,'#563c2e');r(x+offset+1,y-4,3,7,shadowTone);r(x+offset,y+3,6,2,'#e6c998');
      }
      const head=stage===4?[-2,3,1,0][step]:stage===3?step%2:0,hy=26+bob-head;
      if(mane)poly([[34,hy-7],[46,hy-8],[53,hy-1],[57,hy+5],[51,hy+13],[42,hy+15],[32,hy+8],[32,hy]],'#6f4430');
      r(39,hy-5,5,6,shadowTone);r(48,hy-5,5,6,shadowTone);
      poly([[39,hy],[50,hy],[55,hy+5],[53,hy+11],[43,hy+12],[37,hy+7]],coat);
      r(41,hy+4,3,2,'#4b362e');r(47,hy+4,3,2,'#4b362e');r(46,hy+8,6,4,'#f7dca1');r(48,hy+8,3,2,'#654034');
      if(stage===3){r(48,hy+11,5,3,'#6b3430');r(50,hy+11,2,1,'#f5d3ac');}
      if(stage===4&&step>0){
       poly([[37,35+bob],[45,34+bob],[54+step,36+step*2],[59,42+step],[56,46+step],[47,42],[38,43]],shadowTone);
       for(let i=0;i<3;i++)r(55+i*2,42+step+i,2,3,'#f2d9aa');
      }
    }else if(type==='plate'||type==='bone-pile'){
      if(type==='plate'){
       const down=id==='down',top=down?28:24;
       poly([[8,34],[19,17],[46,17],[57,34],[51,45],[13,45]],'#252824');
       poly([[10,34],[20,20],[45,20],[54,34],[47,42],[16,42]],'#57594d');
       poly([[14,34],[22,22],[43,22],[50,34],[46,39],[18,39]],'#343c34');
       poly([[18,35],[24,top],[41,top],[47,35],[43,38],[21,38]],down?'#68644f':'#93917a');
       r(22,36,22,2,down?'#63553a':'#a68960');r(26,top+1,14,2,down?'#ab7656':'#c0ab7e');
       for(const [x,y] of [[15,34],[19,39],[44,38],[50,34]]){r(x,y,2,2,'#c2a16d');r(x+1,y+2,1,1,'#32291e');}
       poly([[31,top+2],[37,top+5],[32,top+10],[27,top+6]],down?'#a96c55':'#626550');
       r(31,top+4,2,3,down?'#fbaf70':'#cab991');
      }
      else{
        for(const [x,y] of [[19,31],[32,27],[37,42]]){r(x,y,14,4,'#cabd98');r(x-2,y-1,4,6,'#e1d5b0');r(x+12,y-1,4,6,'#a89978');}
        r(23,38,9,9,'#d4c6a0');r(24,40,2,2,'#5b5548');r(29,40,2,2,'#5b5548');
      }
    }else if(type==='merchant'){
      r(10,50,45,6,'#130f10a0');r(11,32,42,17,ink);r(14,35,36,11,wood);r(16,35,32,2,edge);
      r(14,18,3,29,edge);r(47,18,3,29,edge);
      poly([[14,10],[49,10],[55,26],[9,26]],'#a25146');
      for(const x of [15,29,43])r(x,12,5,14,'#cf9866');
      r(9,26,46,3,shade);r(16,39,7,5,gold);r(39,38,7,6,'#8d6246');
      for(const x of [16,41]){r(x,48,8,8,ink);r(x+2,50,4,4,gold);}
    }else if(type==='portal'){
      r(10,53,44,7,'#100e12aa');
      poly([[8,55],[8,26],[16,11],[25,5],[40,5],[49,11],[56,26],[56,55]],'#252532');
      poly([[12,52],[12,26],[19,14],[27,8],[38,8],[46,14],[52,26],[52,52]],'#6d7081');
      poly([[17,53],[17,27],[24,16],[31,11],[37,13],[44,20],[47,28],[47,53]],'#304a69');
      poly([[20,51],[20,27],[26,20],[31,15],[35,17],[42,22],[44,31],[44,51]],'#537a9e');
      for(const [x,y,w] of [[28,23,13],[23,31,14],[28,39,13],[21,47,15]]){r(x,y,w,2,'#b8e4df');r(x+3,y+3,w-4,1,'#7cacbb');}
      for(const y of [29,40,51]){r(10,y,6,2,'#a0a0a4');r(48,y,6,2,'#a0a0a4');}
      r(8,53,48,4,'#555363');r(13,53,38,1,'#a09b9a');
    }else if(type==='floor-web'){
      const col='#c9bdafaa';
      for(const pts of [[[3,30],[61,30],[61,32],[3,32]],[[31,4],[33,4],[33,60],[31,60]],[[9,9],[11,9],[55,54],[54,56]],[[53,9],[55,10],[12,56],[10,54]],
       [[15,18],[19,14],[46,14],[50,18],[50,46],[46,50],[19,50],[15,46]]]){
       if(pts.length===4)poly(pts,col);
       else for(let i=0;i<pts.length;i++){
        const [x,y]=pts[i],[u,v]=pts[(i+1)%pts.length];
        poly([[x,y],[u,v],[u+1,v+1],[x+1,y+1]],col);
       }
      }
      r(25,24,14,1,col);r(25,39,14,1,col);r(24,25,1,14,col);r(39,25,1,14,col);
    }else if(type==='trophy'){
      const won=id==='gold',cup=won?'#ba8546':'#655957',trim=won?'#efca7a':'#908181';
      r(12,17,40,13,ink);r(14,18,36,9,cup);r(17,20,30,5,'#2b2425');
      poly([[20,12],[44,12],[44,29],[38,37],[35,39],[35,48],[46,51],[46,55],[18,55],[18,51],[29,48],[29,39],[26,37],[20,29]],cup);
      r(20,12,24,3,trim);r(24,16,3,14,trim);r(29,50,13,2,trim);r(17,54,30,3,ink);
    }else if(type==='map'){
      const glint=[0,0,1,2,1,0,0,0][Number(id)%8]||0;
      poly([[13,43],[19,32],[51,29],[55,36],[47,46],[22,49]],'#17151b90');
      poly([[13,39],[20,28],[34,27],[40,25],[54,27],[48,39],[34,44],[28,42],[18,44]],'#4c352d');
      poly([[17,38],[22,30],[34,29],[39,27],[51,28],[46,37],[33,42],[28,40],[19,42]],'#b09366');
      poly([[20,38],[24,31],[33,30],[31,38],[28,38],[22,40]],'#c8ac78');
      poly([[34,30],[40,28],[49,29],[45,36],[33,41]],'#d7be87');
      r(25,33,7,1,'#7b6556');r(28,36,8,1,'#7b6556');r(36,32,7,1,'#7b6556');
      r(39,31,3,3,'#824b43');r(40,31,1,1,glint?'#ffca83':'#bd7962');
      if(glint===2){r(42,30,2,1,'#e9bf7e');r(43,29,1,3,'#e9bf7e');}
    }else if(type==='trial-charm'){
      poly([[11,23],[42,13],[54,36],[42,49],[14,50]],'#342b39');
      poly([[14,23],[42,16],[50,35],[39,46],[17,47]],'#b89364');
      r(18,23,20,4,'#e4bd87');r(20,31,14,2,'#76564c');r(20,35,12,2,'#76564c');
      poly([[33,27],[42,24],[49,31],[46,42],[37,43],[31,35]],'#644b88');
      poly([[39,28],[44,33],[39,39],[35,33]],'#d4b6ee');
    }else if(type==='stairs'||type==='ladder'){
      poly([[9,39],[15,19],[48,17],[57,41],[49,52],[16,53]],'#151921');
      if(type==='stairs'){
       for(let i=0;i<5;i++){
        const x=14+i*3,y=44-i*5,w=37-i*4;
        r(x,y,w,6,'#524e54');r(x,y,w,2,'#ada18c');r(x+3,y+3,w-6,1,'#6c6370');
       }
       r(13,46,3,5,'#927b64');r(49,46,3,5,'#927b64');
      }else{
       poly([[16,20],[49,20],[51,44],[17,46]],'#283a3c');
       r(20,16,5,31,'#b28156');r(40,16,5,31,'#b28156');
       for(let y=21;y<45;y+=6){r(24,y,17,3,'#d4a577');r(25,y+2,16,1,'#806044');}
       r(21,16,2,30,'#d1a575');r(41,16,2,30,'#d1a575');
      }
    }else if(type==='ground-bones'){
      const bones=id==='3'?[[18,34,-4],[25,38,3],[31,30,-2]]:[[23,35,-4]];
      poly([[14,39],[24,32],[45,32],[50,38],[40,43],[20,44]],'#18151999');
      for(const [x,y,tilt] of bones){
        poly([[x,y-2],[x+4,y-3],[x+7,y],[x+15,y+tilt],[x+16,y+tilt-2],[x+20,y+tilt-2],[x+22,y+tilt+2],
         [x+19,y+tilt+5],[x+15,y+tilt+3],[x+6,y+4],[x+3,y+6],[x,y+4]],'#665c51');
        poly([[x+2,y-1],[x+5,y-1],[x+7,y+1],[x+16,y+tilt+1],[x+18,y+tilt-1],[x+20,y+tilt],[x+19,y+tilt+3],
         [x+16,y+tilt+2],[x+6,y+3],[x+3,y+4],[x+1,y+3]],'#d7c5a3');
      }
    }else if(type==='cup'||type==='potion'){
      const filled=type==='potion';
      poly([[15,18],[20,12],[44,12],[49,18],[48,40],[42,49],[22,49],[16,40]],'#28232b');
      poly([[18,20],[46,20],[44,40],[39,46],[25,46],[20,41]],'#8b6550');
      r(22,26,3,14,'#c79163');r(40,25,3,15,'#5d4044');r(24,42,17,3,'#bd895d');
      poly([[17,18],[22,14],[42,14],[47,18],[44,24],[20,24]],'#dec18b');
      poly([[20,18],[25,16],[41,16],[44,19],[40,22],[23,22]],filled?(color||'#71a7a9'):'#554049');
      if(filled){r(25,17,10,1,'#fff1b8');r(33,10,2,4,color);r(39,7,2,2,'#f7e0ab');r(30,23,7,2,color);}
      r(31,47,3,5,'#a47c56');r(25,51,15,3,'#dec18b');
    }else if(type==='currency'){
      if(id==='gold'){
        poly([[13,37],[21,24],[39,22],[52,29],[54,39],[44,49],[24,50],[13,45]],'#714229');
        poly([[13,34],[21,23],[41,22],[51,29],[50,37],[42,43],[23,44],[13,39]],'#e5b75e');
        poly([[19,34],[25,27],[39,26],[46,31],[44,36],[38,40],[24,41]],'#b98540');r(25,29,14,2,'#ffe0a0');
        poly([[27,10],[40,8],[50,14],[51,23],[44,31],[29,31],[23,22]],'#86502d');
        poly([[29,11],[39,10],[48,15],[48,21],[41,27],[30,27],[25,21]],'#f1bf62');
        r(30,13,10,2,'#ffe4a8');r(36,16,2,8,'#a36a36');r(31,19,11,2,'#b27839');
      }else if(id==='bones'){
        poly([[12,19],[16,13],[25,14],[28,20],[41,34],[47,32],[54,37],[54,45],[48,50],[43,47],[37,49],[33,43],[33,39],[20,27],[14,29],[9,25]],'#676052');
        poly([[15,18],[22,16],[26,22],[42,37],[49,35],[52,40],[48,46],[44,43],[38,45],[37,40],[19,25],[14,26],[11,23]],'#e5d4b0');
        r(15,18,6,2,'#fff1cd');r(44,37,4,3,'#fff1cd');
      }else{
        poly([[31,8],[47,16],[54,30],[45,44],[32,55],[16,44],[10,28],[19,15]],'#572638');
        poly([[31,10],[45,17],[51,28],[44,40],[31,51],[17,41],[12,28],[20,17]],'#cc485d');
        poly([[31,12],[44,20],[42,29],[31,34],[22,28],[21,19]],'#f17786');
        poly([[31,34],[42,29],[44,40],[31,49]],'#912f49');r(25,19,11,2,'#ffc0a9');r(20,23,3,3,'#ffe2c4');
      }
    }else if(type==='wild-bat'){
      const [variant,index]=id.split('-'),n=Number(index),stage=n>>2,step=n%4,shock=variant==='storm';
      const lift=[-12,-4,8,0][step],tuck=stage===1?step*2:0;
      const base=shock?'#252a46':'#332233',cloth=shock?'#465682':'#623345';
      const rim=shock?'#81c5f2':'#c07866',body=shock?'#7389ac':'#9e6656';
      const crouch=stage===1?2:stage===2?-1:0;
      for(const side of [-1,1]){
        const x=d=>32+d*side;
        const tip=stage===2?29:30-tuck,y=20+lift+tuck;
        poly([[x(5),24],[x(15),13+lift],[x(tip),y],[x(tip-1),y+7],[x(22-tuck),y+3],
         [x(18-tuck),31+lift*.6],[x(13),29+lift*.4],[x(10),38],[x(4),34]],base);
        poly([[x(6),26],[x(15),16+lift],[x(tip-1),y+1],[x(21-tuck),y+2],[x(17-tuck),29+lift*.6],
         [x(13),27+lift*.4],[x(9),34]],cloth);
        poly([[x(8),28],[x(15),17+lift],[x(17-tuck),29+lift*.6],[x(13),27+lift*.4]],body);
        poly([[x(15),15+lift],[x(tip-1),y],[x(23-tuck),y+1],[x(16),18+lift]],rim);
        if(stage===1||stage===2)r(x(17+step*2),y+step%2,2,1,shock?'#c2e3ff':'#ef9b59');
      }
      poly([[22,22+crouch],[22,13+crouch],[27,17+crouch],[30,21+crouch],[36,20+crouch],[41,13+crouch],
       [42,26+crouch],[40,39],[34,46],[27,43],[23,36]],base);
      poly([[25,25+crouch],[30,22+crouch],[36,23+crouch],[39,28+crouch],[36,39],[29,39],[25,34]],body);
      for(const x of [26,35])r(x,27+crouch,4,2,shock?'#c7efff':'#ffe0a7');
      r(29,32+crouch,7,stage===2?7:2,'#241827');
      if(stage!==3){r(29,33+crouch,1,3,'#dfceb3');r(35,33+crouch,1,3,'#dfceb3');}
      if(stage===1||stage===2){
        const glow=shock?'#a8e8ff':'#ff9356';
        r(31,34+crouch,2+step%2,step%2+1,glow);
        if(stage===2){r(29,35+crouch,7,3,glow);r(31,36+crouch,3,2,'#fff1ba');}
      }
    }else if(type==='ring'){
      poly([[19,21],[45,21],[52,30],[51,44],[41,53],[23,53],[13,44],[12,30]],ink);
      poly([[20,23],[44,23],[49,31],[48,43],[40,50],[24,50],[16,42],[15,31]],gold);
      poly([[22,29],[42,29],[44,34],[43,42],[38,45],[26,45],[21,42],[20,34]],ink);
      poly([[32,9],[44,17],[42,26],[32,33],[22,26],[20,17]],'#42313a');
      poly([[32,12],[41,18],[39,25],[32,30],[25,24],[23,18]],color||'#81acac');r(28,16,7,3,pale);
    }else if(type==='armor'){
      const parts=id.split('-'),style=parts.length>1?parts[0]:'',slot=parts.at(-1);
      if(slot==='helmet'){
        poly([[22,12],[41,12],[51,25],[50,48],[40,52],[22,52],[14,43],[14,24]],ink);
        poly([[24,15],[40,15],[48,27],[48,45],[40,49],[22,49],[17,42],[17,25]],iron);
        r(24,16,16,3,pale);r(21,28,23,7,ink);r(30,27,4,16,pale);r(21,39,4,5,gold);r(40,39,4,5,gold);
      }else if(slot==='chest'){
        poly([[12,17],[23,13],[29,20],[36,20],[42,13],[53,17],[57,28],[48,32],[46,47],[31,53],[17,47],[16,32],[7,27]],ink);
        poly([[12,20],[23,16],[30,23],[35,23],[43,16],[51,20],[53,26],[45,29],[43,45],[31,50],[20,45],[19,29],[11,26]],iron);
        r(21,26,22,3,pale);r(22,39,20,4,shade);r(29,39,6,5,gold);
      }else if(slot==='legs'){
        r(17,14,30,34,ink);r(16,39,13,13,ink);r(35,39,13,13,ink);r(20,17,24,14,iron);r(19,27,10,23,iron);r(35,27,10,23,iron);
        r(19,19,26,4,wood);r(30,18,5,5,gold);r(20,37,7,3,pale);r(37,37,7,3,pale);
      }else{
        for(const x of [10,34]){r(x+4,15,17,34,ink);r(x,36,22,15,ink);r(x+7,17,11,26,iron);r(x+3,39,17,8,iron);r(x+7,22,11,3,gold);r(x+4,44,15,2,pale);}
      }
      if(armorAccents[style]&&(slot==='helmet'||slot==='chest')){
        if(slot==='helmet')r(22,24,21,2,armorAccents[style]);
        armorEmblem({r,poly},style,32,slot==='helmet'?20:34);
      }else if(style==='hunter'&&slot==='helmet'){
        poly([[36,21],[42,10],[50,5],[48,13],[40,22]],'#ba9f61');r(19,24,29,3,color);
      }else if(style==='knight'&&slot==='helmet'){
        poly([[21,14],[26,5],[39,5],[44,13],[37,11],[32,15]],'#985a68');
      }else if(style==='shadow'&&slot==='helmet'){
        poly([[16,24],[26,12],[28,5],[38,12],[46,20],[52,46],[42,55],[19,53],[12,47]],'#40344f');r(22,29,21,6,ink);r(24,31,4,1,pale);r(38,31,4,1,pale);
      }else if(style==='scholar'&&slot==='helmet'){
        poly([[14,26],[23,10],[32,5],[44,13],[52,30],[48,50],[40,55],[19,54],[12,44]],color);r(20,28,25,10,ink);r(30,14,5,5,'#ce99dc');
      }else if(style&&slot==='chest'){
        if(style==='knight'){r(11,17,14,6,pale);r(40,17,14,6,pale);r(26,30,13,4,gold);}
        else if(style==='hunter'){poly([[19,20],[23,17],[46,39],[43,45]],'#6b4a35');r(28,29,7,5,gold);}
        else if(style==='scholar'){poly([[32,23],[39,33],[32,44],[24,33]],'#af81ca');r(30,31,4,5,'#e1cff0');}
        else if(style==='shadow'){poly([[9,28],[22,14],[27,20],[20,34]],'#534464');poly([[55,28],[42,14],[37,20],[44,34]],'#534464');r(24,32,17,3,'#ae829e');}
        else{r(22,24,4,20,'#835d48');r(38,24,4,20,'#835d48');}
      }else if(style&&slot==='legs'){
        const tint={wanderer:'#775748',scholar:'#9b82b5',hunter:'#a69457',knight:pale,shadow:'#837394'}[style]??armorAccents[style];
        r(19,31,10,3,tint);r(35,31,10,3,tint);
      }else if(style&&slot==='boots'){
        const tint={wanderer:'#8c6544',scholar:'#9b82b5',hunter:'#b4aa70',knight:pale,shadow:'#88768f'}[style]??armorAccents[style];
        for(const x of [10,34]){r(x+6,18,12,4,tint);r(x+4,38,15,2,tint);}
      }
    }else if(type==='weapon'){
      if(id==='bow'){
        poly([[18,6],[31,8],[39,15],[44,24],[46,32],[43,42],[37,52],[27,58],[17,59],[23,55],[33,49],[38,41],[41,32],[39,23],[35,17],[27,12]],'#482a21');
        poly([[18,7],[31,10],[39,17],[44,28],[43,39],[35,52],[19,59],[28,54],[36,45],[41,34],[39,25],[35,18],[27,12]],'#9b6645');
        r(18,8,1,50,'#d5c5a4');r(41,28,4,9,'#c79b5d');r(42,30,2,5,'#594334');
        r(22,53,6,2,'#c7a66c');r(22,10,6,2,'#c7a66c');
      }else if(id==='staff'||id==='hammer'){
        r(29,23,6,36,shade);r(31,22,2,34,edge);
        if(id==='staff'){
          poly([[31,4],[40,11],[41,21],[32,30],[23,22],[24,11]],ink);
          poly([[31,7],[37,12],[38,20],[32,26],[26,20],[27,12]],'#689693');r(30,10,4,10,'#b1e1d0');r(28,27,9,3,gold);
          poly([[21,11],[20,18],[23,25],[29,28],[28,31],[21,29],[17,22],[18,14]],'#77608e');
          poly([[42,10],[45,16],[44,23],[39,28],[35,28],[42,22],[43,16]],'#a98eaf');r(30,37,3,2,gold);
        }else{r(16,10,33,19,ink);r(19,12,27,15,iron);r(19,12,27,4,pale);r(28,13,7,13,gold);r(16,15,4,8,shade);r(14,12,4,14,'#777180');r(46,12,4,13,'#777180');r(21,17,5,4,gold);}
      }else{
        const w=id==='greatsword'?12:id==='rapier'?3:id==='dagger'?6:8, top=id==='dagger'?15:4, end=id==='dagger'?38:43;
        poly([[32,top],[33+w/2|0,top+7],[34+w/2|0,end],[30-w/2|0,end],[31-w/2|0,top+7]],ink);
        poly([[32,top+2],[31+w/2|0,top+8],[32+w/2|0,end],[32-w/2|0,end],[33-w/2|0,top+8]],id==='rust'?'#9b8370':iron);
        r(32,top+5,1,end-top-6,pale);r(30,end,5,16,shade);r(31,end+4,2,8,edge);
        r(id==='rapier'?24:22,end,20,3,gold);r(27,end+13,11,3,gold);
        if(id==='blade'){r(31,end-16,3,13,'#e8cc72');r(29,end-9,7,2,'#f4edbc');}
        if(id==='greatsword'){r(29,13,2,21,'#81829b');r(35,18,2,18,'#c2c0d4');r(29,40,7,3,'#a59cb8');}
        if(id==='dagger'){r(28,26,3,2,'#a78ba1');r(32,29,3,2,'#a78ba1');}
        if(id==='rust'){r(28,31,3,2,'#835742');r(32,34,3,2,'#835742');}
        if(id==='rapier'){poly([[24,end],[27,end+8],[35,end+10],[42,end+4],[36,end+10],[27,end+11],[22,end+4]],gold);}
      }
    }
    iconCache.set(key,c);return c;
  }
  function gate(vertical,color) {
    const c=surface(vertical?52:272,vertical?272:52),{g,r}=brush(c);
    if(vertical){g.translate(52,0);g.rotate(Math.PI/2);}
    r(4,8,264,36,'#151318');r(8,12,256,28,'#302d32');r(9,14,254,3,'#867367');
    r(9,36,254,3,'#706257');
    for(let x=12;x<260;x+=15){r(x,18,3,18,'#999083');r(x+3,18,2,18,'#4c4545');r(x,21,2,2,color);}
    for(const x of [4,250]){r(x,5,18,42,'#4c4547');r(x+2,6,14,4,'#877671');r(x+6,20,6,10,color);}
    g.drawImage(icon('seal','',color),111,1,50,50);
    return c;
  }
  function woodenDoor(vertical,span,damaged=false){
    const length=Math.round(span*64/48);
    const c=surface(vertical?29:length,vertical?length:29);
    const {g,r}=brush(c);
    if(vertical){g.translate(29,0);g.rotate(Math.PI/2);}
    r(0,2,length,25,'#1c1418');r(1,4,length-2,19,'#6c4635');
    for(let x=2;x<length-3;x+=11){
     r(x,5,8,16,x%2?'#967154':'#835a40');
     r(x,5,1,16,'#b98b62');
    }
    for(const y of [6,17]){
     r(3,y,length-6,3,'#37343b');r(3,y,length-6,1,'#7b7370');
     for(let x=6;x<length-4;x+=14)r(x,y+1,2,2,'#d0a269');
    }
    r(length/2-4,11,8,6,'#b18a54');r(length/2-1,13,3,3,'#342828');
    if(damaged)for(let i=0;i<5;i++)r(length*.42+i*5,10+i%3*3,5,2,'#352323');
    return c;
  }
  const urls=new Map();
  function url(type,id,color){
    const key=[type,id,color].join('/');
    if(!urls.has(key))urls.set(key,icon(type,id,color).toDataURL());
    return urls.get(key);
  }
  return {world,furniture,partition,actor,icon,gate,woodenDoor,url};
})();
