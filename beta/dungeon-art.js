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
    if(type==='abyss'||type==='river'){
     const river=type==='river';
     r(0,0,64,64,river?'#182e37':'#11151e');
     for(let i=0;i<42;i++){
      const x=rng(64),y=rng(64),w=2+rng(15);
      const palette=river?['#223d48','#2e4e57','#42737c']:['#1b2230','#262938','#343344'];
      r(x,y,w,1+rng(3),palette[rng(3)]);
     }
     if(river)for(let i=0;i<8;i++){
      const x=rng(57),y=rng(61);
      r(x,y,5+rng(10),1,'#83a8a697');r(x+4,y+1,3,1,'#4a7a86');
     }
    }else if(type==='partition'){
     r(1,32,62,24,'#171c2299');r(1,17,62,31,'#292b2c');r(3,17,58,7,'#79756a');
     for(const x of [3,25,45]){r(x,26,x===45?16:20,10,'#5f5b55');r(x+1,27,16,2,'#827d72');}
     r(4,38,54,7,'#45464a');r(6,45,50,2,'#8a765e');
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
    const c=surface(map[0].length*SIZE,map.length*SIZE),{g,r}=brush(c);
    r(0,0,c.width,c.height,'#101212');
    const rnd=random(seed);
    for(let y=0;y<map.length;y++) for(let x=0;x<map[y].length;x++){
      const z=zoneAt(x,y),v=rnd(12);
      const surfaceType=terrain?.[y]?.[x];
      if(surfaceType){g.drawImage(terrainTile(surfaceType,v),x*SIZE,y*SIZE);continue;}
      if(map[y][x]===0){g.drawImage(floor(z,v),x*SIZE,y*SIZE);continue;}
      const mask=(map[y-1]?.[x]===0?1:0)|(map[y]?.[x+1]===0?2:0)|(map[y+1]?.[x]===0?4:0)|(map[y]?.[x-1]===0?8:0);
      if(mask)g.drawImage(wall(z,mask,v%4),x*SIZE,y*SIZE);
    }
    // Keep the pools of light inside their rooms and retain the wall fronts.
    g.save();g.beginPath();
    for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)if(map[y][x]===0)g.rect(x*SIZE,y*SIZE,SIZE,SIZE);
    g.clip();
    g.globalCompositeOperation='screen';
    for(const {x,y,zone,radius,power} of lights){
      const light=g.createRadialGradient(x,y,3,x,y,radius),color=stone[zone].light;
      light.addColorStop(0,color+power);light.addColorStop(.34,color+'36');light.addColorStop(1,color+'00');
      g.fillStyle=light;g.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
    g.restore();
    return c;
  }
  function furniture(type,variant=0) {
    const key=type+'-'+variant;
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
    }else if(type==='market'){
      shadow(4,67,120,22);
      for(const x of [12,109]){r(x,20,7,57,shade);r(x+1,21,2,55,edge);}
      poly([[18,12],[108,12],[122,33],[7,33]],'#723e46');
      for(const x of [20,39,58,77,96])poly([[x,13],[x+9,13],[x+13,33],[x-3,33]],'#cb9663');
      r(8,33,112,4,shade);planks(12,51,105,19);r(13,68,103,8,wood);
      for(const [x,y] of [[21,44],[42,48],[83,46],[101,47]]){r(x,y,10,9,'#8d754b');r(x+2,y,7,2,'#d8b57b');}
    }else if(type==='lectern'){
      shadow(37,69,53,11);
      r(59,48,11,23,wood);r(49,68,30,6,edge);
      poly([[43,36],[85,36],[92,52],[36,52]],shade);
      r(45,38,38,12,grain);r(53,33,25,13,'#d4b57e');r(54,34,10,10,'#edd8a3');r(65,34,11,10,'#dbc491');
      for(let i=0;i<3;i++){r(56,36+i*3,6,1,wood);r(67,36+i*3,7,1,wood);}
    }
    function flame(x,y,tall){
      r(x-4,y-2,8,5,shade);r(x-2,y-(tall?19:9),4,tall?19:9,tall?grain:'#d9c195');
      const yy=y-(tall?21:10);
      poly([[x-6,yy],[x-6,yy-7],[x-2,yy-20],[x+1,yy-16],[x+5,yy-11],[x+7,yy-3],[x+4,yy+2],[x-3,yy+2]],'#ae4b32');
      r(x-4,yy-9,8,10,'#f49648');r(x-1,yy-13,3,12,'#ffcd6d');r(x-2,yy-5,4,5,'#fff2aa');
    }
    spriteCache.set(key,c);return c;
  }
  // Integer-pixel sprite poses. The feet stay anchored while limbs, faces and effects move.
  function enemyPose(zone,frame){
    const c=surface(),{r,poly}=brush(c),step=frame%4,stage=(frame/4)|0;
    const stride=[-2,0,2,0][step],reach=[0,5,10,4][step];
    const anticipation=[0,1,3,5][step];
    const crouch=stage===1?anticipation:stage===2?-2:stage===3?3-step:Math.abs(stride);
    const y=n=>n+crouch;
    poly([[10,51],[18,47],[48,47],[55,52],[49,56],[14,56]],'#100d13a8');
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
     poly(tail,'#252822');
     poly([[7,44],[18,46],[26,40],[35,39-wave],[45,42],[53,40],[57,33-lift],[59,37-lift],[57,44],[48,47],[38,44+wave],[26,44],[17,49]],'#727c54');
     for(let n=0;n<4;n++)r(19+n*8,43+(n%2?wave:0),3,2,'#afb47c');
     poly([[51,27-lift],[55,23-lift],[62,23-lift],[64,28-lift],[61,35-lift],[53,35-lift],[50,32-lift]],'#303728');
     r(54,27-lift,8,5,'#a7a879');r(59,27-lift,2,2,'#f4ce7f');
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
  function actor(type,options={}) {
    if(type==='foe')return enemyPose(options.zone||0,options.frame||0);
    const {frame=0,skin='#d4a785',hair='#392b4e',color='#755666',armor={}}=options;
    const c=surface(),{r,poly}=brush(c);
    const shape=(p,col)=>poly(p,col);
    shape([[13,47],[49,47],[55,52],[51,56],[13,56],[8,53]],'#100d13a8');
    if(type==='hero'){
      const step=frame===1?2:frame===2?-2:0;
      shape([[21,25],[43,25],[51,50],[44,54],[19,54],[12,49]],ink);
      shape([[22,27],[42,27],[47,49],[36,52],[17,48]],color);
      r(23,41,8,12+step,armor.legs||'#3d343e');r(34,41,8,12-step,armor.legs||'#3d343e');
      r(20,50+step,11,4,armor.boots||ink);r(34,50-step,12,4,armor.boots||ink);
      r(20,29,24,11,ink);r(23,27,18,14,armor.chest||'#999890');
      r(24,29,15,2,'#d6c9a8');r(26,33,12,2,'#5f5d56');r(24,38,17,3,'#51362d');r(31,38,4,4,gold);
      r(16,28,9,8,'#514846');r(17,28,7,2,'#bcb39c');r(40,28,9,8,'#514846');r(41,28,6,2,'#bcb39c');
      r(17,38,6,6,skin);r(42,37,6,6,skin);
      r(22,11,20,16,ink);r(24,13,16,13,skin);r(23,10,18,6,hair);r(22,15,4,7,hair);r(39,15,4,6,hair);
      r(27,18,3,2,ink);r(35,18,3,2,ink);r(30,23,5,1,'#905d51');
      if(armor.helmet){r(22,10,21,7,armor.helmet);r(24,9,16,2,'#ddd5b4');r(22,15,5,9,armor.helmet);r(39,15,4,9,armor.helmet);}
    }
    return c;
  }
  function icon(type,id='',color='') {
    const key=[type,id,color].join('/');
    if(iconCache.has(key))return iconCache.get(key);
    const c=surface(),{r,poly}=brush(c);
    const iron=color||'#9aabad', pale='#d6dcd0';
    if(type==='soul'){
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
      poly([[5,45],[2,29],[12,21],[20,27],[23,20],[22,11],[29,14],[35,14],[42,9],[42,21],[47,25],[54,19],[63,30],[58,47],[46,46],[45,54],[20,54],[18,47]],'#211922');
      poly([[7,29],[13,24],[22,30],[22,44],[15,38],[9,41]],'#654550');
      poly([[43,30],[53,24],[59,29],[55,41],[50,38],[43,43]],'#654550');
      poly([[23,27],[39,26],[46,46],[40,53],[22,51],[18,42]],'#574c62');
      r(25,17,15,13,'#86727d');r(26,20,4,2,'#f1bf6f');r(35,20,4,2,'#f1bf6f');
      r(28,26,9,2,'#2f2227');r(29,27,2,3,'#e9daac');r(34,27,2,3,'#e9daac');
      r(24,38,19,4,'#70513a');r(31,38,5,5,'#d1aa67');
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
      poly([[12,19],[25,15],[38,19],[52,15],[54,45],[39,50],[26,45],[12,50]],shade);
      poly([[15,21],[25,17],[38,21],[50,18],[51,43],[39,47],[26,43],[15,47]],'#c7aa74');
      r(25,19,2,24,'#9d825a');r(37,22,2,24,'#e4c98a');
      r(20,33,6,2,'#875c4b');r(25,28,12,2,'#875c4b');r(35,27,2,8,'#875c4b');r(35,34,10,2,'#875c4b');
      r(42,31,6,7,'#9f5446');r(44,32,2,4,'#e1b674');
    }else if(type==='ring'){
      poly([[19,21],[45,21],[52,30],[51,44],[41,53],[23,53],[13,44],[12,30]],ink);
      poly([[20,23],[44,23],[49,31],[48,43],[40,50],[24,50],[16,42],[15,31]],gold);
      poly([[22,29],[42,29],[44,34],[43,42],[38,45],[26,45],[21,42],[20,34]],ink);
      poly([[32,9],[44,17],[42,26],[32,33],[22,26],[20,17]],'#42313a');
      poly([[32,12],[41,18],[39,25],[32,30],[25,24],[23,18]],color||'#81acac');r(28,16,7,3,pale);
    }else if(type==='armor'){
      if(id==='helmet'){
        poly([[22,12],[41,12],[51,25],[50,48],[40,52],[22,52],[14,43],[14,24]],ink);
        poly([[24,15],[40,15],[48,27],[48,45],[40,49],[22,49],[17,42],[17,25]],iron);
        r(24,16,16,3,pale);r(21,28,23,7,ink);r(30,27,4,16,pale);r(21,39,4,5,gold);r(40,39,4,5,gold);
      }else if(id==='chest'){
        poly([[12,17],[23,13],[29,20],[36,20],[42,13],[53,17],[57,28],[48,32],[46,47],[31,53],[17,47],[16,32],[7,27]],ink);
        poly([[12,20],[23,16],[30,23],[35,23],[43,16],[51,20],[53,26],[45,29],[43,45],[31,50],[20,45],[19,29],[11,26]],iron);
        r(21,26,22,3,pale);r(22,39,20,4,shade);r(29,39,6,5,gold);
      }else if(id==='legs'){
        r(17,14,30,34,ink);r(16,39,13,13,ink);r(35,39,13,13,ink);r(20,17,24,14,iron);r(19,27,10,23,iron);r(35,27,10,23,iron);
        r(19,19,26,4,wood);r(30,18,5,5,gold);r(20,37,7,3,pale);r(37,37,7,3,pale);
      }else{
        for(const x of [10,34]){r(x+4,15,17,34,ink);r(x,36,22,15,ink);r(x+7,17,11,26,iron);r(x+3,39,17,8,iron);r(x+7,22,11,3,gold);r(x+4,44,15,2,pale);}
      }
    }else if(type==='weapon'){
      if(id==='staff'||id==='hammer'){
        r(29,23,6,36,shade);r(31,22,2,34,edge);
        if(id==='staff'){
          poly([[31,4],[40,11],[41,21],[32,30],[23,22],[24,11]],ink);
          poly([[31,7],[37,12],[38,20],[32,26],[26,20],[27,12]],'#689693');r(30,10,4,10,'#b1e1d0');r(28,27,9,3,gold);
        }else{r(16,10,33,19,ink);r(19,12,27,15,iron);r(19,12,27,4,pale);r(28,13,7,13,gold);r(16,15,4,8,shade);}
      }else{
        const w=id==='greatsword'?12:id==='rapier'?3:id==='dagger'?6:8, top=id==='dagger'?15:4, end=id==='dagger'?38:43;
        poly([[32,top],[33+w/2|0,top+7],[34+w/2|0,end],[30-w/2|0,end],[31-w/2|0,top+7]],ink);
        poly([[32,top+2],[31+w/2|0,top+8],[32+w/2|0,end],[32-w/2|0,end],[33-w/2|0,top+8]],id==='rust'?'#9b8370':iron);
        r(32,top+5,1,end-top-6,pale);r(30,end,5,16,shade);r(31,end+4,2,8,edge);
        r(id==='rapier'?24:22,end,20,3,gold);r(27,end+13,11,3,gold);
        if(id==='blade')r(31,end-7,3,4,'#e8cc72');
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
  const urls=new Map();
  function url(type,id,color){
    const key=[type,id,color].join('/');
    if(!urls.has(key))urls.set(key,icon(type,id,color).toDataURL());
    return urls.get(key);
  }
  return {world,furniture,actor,icon,gate,url};
})();
