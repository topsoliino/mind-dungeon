/* World tiles and sprites share a 64px source grid and use nearest-neighbour sampling. */
window.DungeonArt = (() => {
  'use strict';
  const SIZE = 64;
  const stone = [
    { floor:['#272924','#403f32','#4e4a39','#605844','#33362a'], wall:['#1a211e','#373d34','#4c5141','#6b6850'], accent:'#687747', light:'#e89440' },
    { floor:['#28252b','#403a44','#4f4652','#63555c','#332d38'], wall:['#1c1923','#393342','#524453','#6c5764'], accent:'#8f5749', light:'#ed9c54' },
    { floor:['#252029','#3a313b','#483946','#594553','#302832'], wall:['#19151e','#322932','#493844','#694b58'], accent:'#92535d', light:'#bb6670' },
    { floor:['#2f2521','#48352c','#574236','#68503f','#372923'], wall:['#211b1b','#3d302c','#564238','#735543'], accent:'#a38049', light:'#ffae58' },
    { floor:['#1d282e','#30424a','#3b5058','#4b636a','#26343f'], wall:['#151f27','#2b3c48','#3d535e','#597079'], accent:'#588a91', light:'#79b7c6' }
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
    if(zone===3){
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
    if(variant<5&&(zone===0||zone===4)){
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
  function world(map,zoneAt,lights,seed) {
    const c=surface(map[0].length*SIZE,map.length*SIZE),{g,r}=brush(c);
    r(0,0,c.width,c.height,'#101212');
    const rnd=random(seed);
    for(let y=0;y<map.length;y++) for(let x=0;x<map[y].length;x++){
      const z=zoneAt(x,y),v=rnd(12);
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
      for(let i=0;i<5;i++){
        const x=31+i*7,y=34+i*7;
        r(x,26,1,y-16,'#827784');r(31,y,x-24,1,'#827784');
      }
      poly([[30,24],[33,24],[67,62],[65,63]],'#aa9e9d');
    }else if(type==='roots'||type==='crystal'){
      shadow(34,69,61,11);
      const p=type==='roots'?['#24362c','#426550','#78915c']:['#23404d','#497c88','#8dc1c2'];
      for(const [x,y,w,h] of [[44,61,17,28],[62,70,23,46],[79,69,13,22]]){
        poly([[x,y],[x-3,y-h+9],[x+5,y-h],[x+w-4,y-h+7],[x+w,y-5],[x+w-6,y]],p[0]);
        poly([[x+4,y-4],[x+1,y-h+10],[x+6,y-h+3],[x+w-7,y-h+9],[x+w-6,y-8]],p[1]);
        r(x+5,y-h+7,2,h/3|0,p[2]);r(x+8,y-h+10,2,h/4|0,p[2]);
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
      const yy=y-(tall?21:10);
      poly([[x-6,yy],[x-6,yy-7],[x-2,yy-20],[x+1,yy-16],[x+5,yy-11],[x+7,yy-3],[x+4,yy+2],[x-3,yy+2]],'#ae4b32');
      r(x-4,yy-9,8,10,'#f49648');r(x-1,yy-13,3,12,'#ffcd6d');r(x-2,yy-5,4,5,'#fff2aa');
    }
    spriteCache.set(key,c);return c;
  }
  function actor(type,options={}) {
    const {zone=0,frame=0,skin='#d4a785',hair='#392b4e',color='#755666',armor={}}=options;
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
    }else if(zone===0){
      const p=['#252a22','#3d4b31','#65704c','#9a9266'];
      for(const [x,y,w,h] of [[20,38,11,15],[34,38,11,15],[10,26,12,21],[40,27,14,22],[17,19,30,26],[22,9,22,22]]){
        block(r,x,y,w,h,[p[0],p[1],p[2],p[3],ink],1);
      }
      r(25,19,5,3,'#eab863');r(35,19,5,3,'#efc779');r(22,35,7,4,'#a6a36a');r(35,28,8,3,'#828b51');
    }else if(zone===1){
      shape([[16,24],[20,14],[31,8],[43,15],[49,27],[54,49],[43,53],[18,53],[10,48]],ink);
      shape([[18,26],[24,14],[33,12],[45,22],[47,38],[51,48],[38,50],[25,48],[14,49]],'#753f41');
      shape([[22,24],[27,16],[34,15],[41,23],[39,32],[24,32]],'#a86356');
      r(25,22,14,7,ink);r(27,23,4,2,'#ffd885');r(34,23,3,2,'#ffd885');
      r(29,34,7,3,gold);r(31,37,3,9,bright);r(15,34,5,13,'#ae695b');r(45,33,5,13,'#61383a');
    }else if(zone===2){
      for(const side of [-1,1])for(let i=0;i<4;i++){
        const y=21+i*6, bend=7+i*4+(frame===2?4:frame===1?-2:0);
        const mirror=points=>points.map(([x,yy])=>[32+(x-32)*side,yy]);
        shape(mirror([[38,y],[55,y-bend],[61,y-bend+3],[63,y+4],[60,y+6],[56,y-bend+7],[38,y+6]]),ink);
        shape(mirror([[39,y+1],[55,y-bend+2],[59,y-bend+4],[61,y+4],[57,y-bend+6],[39,y+4]]),'#835455');
      }
      shape([[24,11],[40,11],[47,22],[46,40],[39,49],[25,49],[18,40],[18,24]],ink);
      shape([[25,13],[38,13],[43,23],[42,38],[36,45],[26,44],[21,36],[22,22]],'#53374a');
      r(27,18,9,5,'#99616a');r(25,25,3,3,'#715164');r(37,25,3,3,'#715164');
      for(const x of [24,30,37])r(x,36,4,3,'#f68f75');
      r(24,42,3,6,'#ab8679');r(37,42,3,6,'#ab8679');
    }else if(zone===3){
      shape([[22,24],[42,24],[50,49],[44,53],[20,53],[13,49]],ink);
      shape([[24,25],[40,25],[46,48],[35,50],[17,47]],'#5f4538');
      r(19,8,27,21,ink);r(22,10,21,16,'#aca284');r(22,10,21,3,'#d6c9a1');r(24,17,6,5,ink);r(35,17,6,5,ink);
      r(30,22,5,5,'#6f6254');for(let i=0;i<4;i++)r(24+i*4,29,3,3,'#c4b795');
      r(24,36,17,4,gold);r(31,33,3,14,'#dfc58d');r(49,18,4,33,'#9e7445');r(47,14,8,6,'#d5aa66');
    }else{
      shape([[29,6],[38,11],[47,21],[54,44],[42,44],[43,55],[35,51],[29,57],[23,48],[12,52],[16,28]],'#1c2838');
      shape([[29,10],[38,15],[44,24],[49,42],[38,39],[39,48],[33,45],[29,51],[24,43],[17,47],[21,28]],'#4f7884');
      shape([[29,13],[39,18],[42,26],[37,29],[24,27],[24,20]],'#779aa1');
      r(25,22,15,7,'#2d4354');r(27,23,4,2,'#c0f3ed');r(34,23,4,2,'#c0f3ed');r(23,34,3,5,'#8cb4b7');r(38,36,4,3,'#8cb4b7');
    }
    if(type==='foe'&&frame===2){
      const flare=['#fac16c','#ffd880','#ff9b78','#ffe0a0','#bbf3ed'][zone];
      const y=[20,23,36,19,24][zone];
      for(const x of [25,36]){r(x-2,y-1,7,4,flare);r(x,y,3,2,'#fff1c1');}
    }
    return c;
  }
  function icon(type,id='',color='') {
    const key=[type,id,color].join('/');
    if(iconCache.has(key))return iconCache.get(key);
    const c=surface(),{r,poly}=brush(c);
    const iron=color||'#9aabad', pale='#d6dcd0';
    if(type==='chest'){
      r(8,39,48,13,'#110e12aa');r(10,23,44,25,ink);r(13,27,38,18,wood);r(15,41,34,2,edge);
      if(id==='open'){r(14,15,36,15,shade);r(17,15,29,3,grain);r(17,26,30,7,ink);}
      else{poly([[11,28],[14,20],[19,17],[47,17],[54,23],[54,30],[11,30]],grain);r(17,18,29,2,edge);r(12,27,42,3,gold);}
      r(16,22,4,23,'#a97b4b');r(45,22,4,23,'#a97b4b');r(29,28,8,9,gold);r(31,31,3,3,ink);
    }else if(type==='shrine'||type==='seal'){
      const glow=color||'#9cbed0';
      if(type==='shrine'){r(12,47,40,10,ink);r(16,44,32,8,'#636564');r(20,43,24,2,'#9c9080');}
      poly([[32,8],[46,23],[44,39],[32,49],[19,40],[18,25]],ink);
      poly([[32,11],[43,25],[41,37],[32,45],[22,37],[22,25]],type==='seal'?glow:'#526d75');
      poly([[32,16],[40,26],[39,34],[32,41],[25,34],[25,26]],glow);
      r(30,20,3,13,'#e6e6bf');r(26,26,11,3,'#e6e6bf');r(31,36,2,2,ink);
    }else if(type==='merchant'){
      r(10,50,45,6,'#130f10a0');r(11,32,42,17,ink);r(14,35,36,11,wood);r(16,35,32,2,edge);
      r(14,18,3,29,edge);r(47,18,3,29,edge);
      poly([[14,10],[49,10],[55,26],[9,26]],'#a25146');
      for(const x of [15,29,43])r(x,12,5,14,'#cf9866');
      r(9,26,46,3,shade);r(16,39,7,5,gold);r(39,38,7,6,'#8d6246');
      for(const x of [16,41]){r(x,48,8,8,ink);r(x+2,50,4,4,gold);}
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
