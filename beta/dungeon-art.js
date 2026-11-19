/* Tiles and sprites share a 64px source grid. Terrain is baked at world size. */
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
    const c=surface(),{g,r,poly}=brush(c),rng=random(variant+31);
    if(type==='jungle-wall'||type==='jungle-stairs'||type==='jungle-mosaic'){
     const wall=type==='jungle-wall',stairs=type==='jungle-stairs',height=stairs?16:wall?16:21;
     r(0,0,64,64,wall?'#202b25':'#303e32');
     for(let y=0;y<64;y+=height){
      const seam=19+rng(24),stone=wall?(y<24?'#4a5747':'#394839'):stairs?'#59664e':'#434f3e';
      r(1,y+1,seam-2,height-2,stone);r(seam+1,y+1,62-seam,height-2,stone);
      r(2,y+1,seam-5,stairs?3:2,wall?'#68765a':'#69775a');r(seam+2,y+1,59-seam,stairs?3:2,'#636f53');
      if(stairs)r(0,y+height-4,64,4,'#344238');
     }
     for(let i=0;i<(wall?19:12);i++){
      const x=rng(61),y=rng(62);r(x,y,2+rng(7),1+rng(2),i%2?'#687c465e':'#273b2a66');
     }
     if(wall){
      for(const x of [4+rng(17),36+rng(17)]){
       const length=19+rng(38);
       for(let y=0;y<length;y++){
        const bx=x+Math.round(Math.sin(y*.15)*3);r(bx,y,2,2,'#78925a');
        if(y%7===2){r(bx-4,y,5,2,'#557347');r(bx+2,y-2,4,2,'#91a76b');}
       }
      }
      if(variant%4===0){r(26,16,13,10,'#29352b');r(28,18,9,1,'#8c9872');r(29,21,2,2,'#9aab73');r(34,21,2,2,'#9aab73');}
     }else if(!stairs&&variant%4===0){
      poly([[32,9],[48,30],[32,48],[16,30]],'#687654');poly([[32,13],[43,30],[32,43],[21,30]],'#44533e');
     }
    }else if(type.startsWith('sanctuary-')){
     const kind=type.slice(10);
     if(kind==='water'){
      r(0,0,64,64,'#295052');
      for(let i=0;i<23;i++)r(rng(64),rng(64),7+rng(15),1+rng(2),['#46706a','#345e5d','#5a85794a'][rng(3)]);
     }else if(kind==='meadow'){
      r(0,0,64,64,'#596b50');
      for(let i=0;i<26;i++){
       const x=rng(64),y=rng(64);r(x,y,2+rng(7),2,'#768467');
       if(i%5===0){r(x+1,y-2,2,2,'#b3ad81');r(x,y+1,1,2,'#495b49');}
      }
     }else if(kind==='spiral-wall'){
      r(0,0,64,64,'#282e34');
      for(let y=0;y<64;y+=16){
       const seam=y%32===0?26:43;
       r(2,y+1,seam-3,13,'#525b60');r(seam+1,y+1,62-seam,13,'#4c555c');
       r(3,y+2,seam-5,2,'#79807c');r(seam+2,y+2,59-seam,2,'#727c78');
      }
      r(0,0,64,5,'#a19b81');r(0,5,64,4,'#606a68');r(0,59,64,5,'#24272d');
     }else if(kind.startsWith('stairs')){
      const facing=kind.at(-1);g.translate(32,32);g.rotate(({n:0,e:1,s:2,w:3})[facing]*Math.PI/2);g.translate(-32,-32);
      for(let y=0;y<64;y+=32){
       r(0,y,64,32,'#62675d');r(0,y,64,5,'#aea588');r(0,y+5,64,3,'#868575');
       r(0,y+22,64,10,'#434941');r(0,y+31,64,1,'#323831');
       r(19+rng(29),y+8,1,13,'#51564b');r(9,y+10,12+rng(14),1,'#96927b75');
      }
     }else{
      const [grout,stone,shine]=kind==='garden'?['#465647','#59674e','#6b795b']:kind==='forge'?['#38343b','#4f4948','#666052']:
       kind==='stone'?['#414442','#52564f','#676761']:kind==='apothecary'?['#323848','#45495b','#616479']:['#555b4d','#6a7060','#828471'];
      r(0,0,64,64,grout);
      for(let y=0;y<64;y+=16){
       const seam=18+rng(29);r(1,y+1,seam-2,14,stone);r(seam+1,y+1,62-seam,14,stone);
       r(2,y+1,seam-5,1,shine);r(seam+2,y+1,59-seam,1,shine);
       r(5+rng(18),y+7+rng(5),9+rng(16),1,shine+'60');
      }
      if(kind==='ward'){
       poly([[32,10],[51,31],[32,52],[13,31]],'#8df6d348');poly([[32,14],[47,31],[32,48],[17,31]],'#545f50');
       poly([[32,17],[43,31],[32,45],[21,31]],'#b5f8db');poly([[32,21],[39,31],[32,41],[25,31]],'#46574e');
       r(31,23,3,17,'#f2f5ce');r(27,29,11,2,'#f2f5ce');r(8,30,7,3,'#a5efcc');r(49,30,7,3,'#a5efcc');
      }
     }
    }else if(type==='house-boards'){
     const boards=['#594036','#61483d','#654638','#6c4d40'];
     r(0,0,64,64,'#4a332d');
     for(let y=0;y<64;y+=16){
      const seam=14+rng(35);
      r(0,y+1,seam-1,14,boards[rng(4)]);r(seam,y+1,64-seam,14,boards[rng(4)]);
      r(0,y+2,seam-1,2,'#79584855');r(seam,y+2,64-seam,2,'#79584855');
      for(let i=0;i<4;i++)r(rng(56),y+4+rng(8),3+rng(11),1,'#35252b48');
     }
    }else if(type.startsWith('street-')){
     const [,tier,style,mark]=type.split('-');
     const day=type.endsWith('-day'),evening=type.endsWith('-evening'),lit=!day;
     if(tier==='step'){
      const flip=style==='south';
      const tones=day?['#6a5d57','#9c8c7f','#81746b']:evening?['#534651','#86717a','#6d5964']:['#37374a','#5c576b','#494659'];
      g.drawImage(terrainTile('street-'+(day?'day':evening?'evening':'night'),variant),0,0);
      for(let i=0;i<3;i++){
       const y=flip?48-i*9:8+i*9,edge=6+i*3;
       r(edge,y,64-edge*2,8,tones[2]);r(edge+1,y+(flip?0:6),62-edge*2,2,tones[1]);
       r(33+(i%2)*6,y+3,2,4,tones[0]);
      }
     }else if(tier==='rear'||tier==='backroof'){
      const phase=day?0:evening?1:2;
      const cap=(style==='brick'?['#866559','#674c57','#494052']:
       style==='limestone'?['#857b70','#716371','#51495d']:['#826953','#6b5156','#4e4052'])[phase];
      r(0,0,64,64,'#101212');
      if(tier==='rear'){
       r(0,0,64,10,'#211b246b');r(0,4,64,4,cap);r(0,8,64,3,'#2f2834');
       const shade=g.createLinearGradient(0,11,0,58);
       shade.addColorStop(0,cap);shade.addColorStop(1,'#101212');
       r(0,11,64,47,shade);
       for(let x=variant%2?11:22;x<64;x+=26)r(x,5,2,7,'#30263170');
       if(mark==='lamp'){
        r(28,0,8,13,'#322834');r(25,1,14,9,'#332936');
        r(28,2,8,5,lit?'#e7aa69':'#64606a');
       }
      }
     }else if(tier==='roof'){
      const material={
       timber:[['#816055','#694b49','#a27762'],['#70515a','#563e48','#8d635f'],['#4b4056','#382d45','#695269']],
       limestone:[['#716b71','#5a555d','#8f8589'],['#62596d','#4d475b','#786b7e'],['#45465d','#35394e','#60627b']],
       brick:[['#875949','#714b45','#a47260'],['#735056','#5b3f49','#936561'],['#494058','#393245','#6a5366']]
      };
      const [base,edge,cap]=(material[style]??material.timber)[day?0:evening?1:2];
      r(0,0,64,64,base);
      const courses=style==='limestone'?16:style==='brick'?14:12,span=style==='brick'?22:21;
      for(let y=2;y<62;y+=courses)for(let x=-(y%2+1)*8+(Math.floor(y/courses)%2?10:0);x<64;x+=span){
       r(x,y,span-2,2,cap);r(x+span-3,y+3,3,courses-4,edge);
       if(rng(4)===0)r(x+4,y+4,span-8,5,edge+'62');
      }
      r(0,59,64,5,edge);
     }else if(['facade','upper','home'].includes(tier)){
      const material={
       timber:[['#b19473','#947353','#51423b','#7e7369'],['#927168','#6a5155','#493744','#615059'],['#60566a','#484255','#2b2638','#49465a']],
       limestone:[['#b6a895','#948978','#6f655d','#817974'],['#8d7d77','#71656c','#574a55','#61565f'],['#676478','#4d4b5f','#353448','#48465b']],
       brick:[['#a48173','#8b645d','#654c48','#746666'],['#8d6c70','#6f515d','#513c4a','#635260'],['#62536a','#51445c','#3a2d43','#4b4259']]
      };
      const [base,shade,beam,stone]=(material[style]??material.timber)[day?0:evening?1:2];
      r(0,0,64,64,tier==='upper'?shade:base);
      if(style==='timber'){
       r(0,4,7,52,beam);r(56,4,8,52,beam);
       poly([[6,12],[11,9],[56,41],[56,49]],shade);
      }else{
       const h=style==='brick'?9:16,w=style==='brick'?19:33;
       for(let y=6;y<56;y+=h){
        r(0,y,64,2,shade);
        for(let x=Math.floor(y/h)%2?6:19;x<64;x+=w)r(x,y+1,2,h-2,shade);
       }
       if(style==='limestone'){r(0,6,5,46,stone);r(59,6,5,46,stone);}
      }
      r(0,0,64,tier==='upper'?6:4,beam);r(0,51,64,5,beam);r(0,56,64,8,stone);
      if(mark==='lamp'){
       r(29,13,6,14,beam);r(23,22,18,4,beam);
       if(lit){
        poly([[20,24],[44,24],[59,51],[9,51]],evening?'#dd9b4b37':'#e9a24d49');
        r(20,24,24,21,'#e3a55348');
       }
       r(24,25,16,19,beam);r(27,28,10,13,lit?'#edaf60':'#62606a');
       r(30,29,4,9,lit?'#ffe1a1':'#454550');r(25,41,14,3,beam);
      }else if(mark==='window'||mark==='lit'||tier==='home'){
       const bright=lit&&(mark==='lit'||tier==='home'),left=style==='limestone'?19:17,right=style==='limestone'?45:47;
       if(style==='limestone')poly([[left,41],[left,19],[25,12],[39,12],[right,19],[right,41]],beam);
       else r(left,13,right-left,28,beam);
       r(left+4,19,right-left-8,18,bright?'#d68f50':'#322d3d');
       if(bright){r(left+5,21,right-left-11,8,'#efbc79');r(left+5,31,right-left-11,5,'#b87951');}
       r(30,17,4,22,beam);r(left+2,27,right-left-4,2,beam);r(left-3,38,right-left+6,4,shade);
       if(style==='timber'&&mark==='window'){r(left-5,16,5,21,stone);r(right,16,5,21,stone);}
      }
     }else{
      const mortar=day?'#76695d':evening?'#564852':'#383447';
      const shades=day?['#918275','#928779','#a08e7e','#898077']:
       evening?['#7b6570','#806974','#736472','#72606c']:['#51495c','#534a60','#484557','#57515e'];
      r(0,0,64,64,mortar);
      for(let y=0;y<64;y+=13)for(let x=-12+(Math.floor(y/13)%2?11:0);x<64;x+=24){
       r(x+1,y+1,22,11,shades[rng(4)]);r(x+3,y+2,15,2,day?'#b1a08d68':'#ad8ca139');
      }
      for(let i=0;i<2+variant%3;i++){
       const x=rng(64),y=rng(64),w=8+rng(18),h=5+rng(10),dirt=day?'#5f4c3966':evening?'#523a3e70':'#292b3a7c';
       poly([[x,y+4],[x+4,y],[x+w-3,y+1],[x+w,y+6],[x+w-4,y+h],[x+3,y+h+1]],dirt);
       r(x+3,y+3,3,2,day?'#6b6351':'#555161');
      }
     }
    }else if(type==='stair-wall'){
     r(0,0,64,64,'#22212a');
     for(let y=0;y<64;y+=16){
      const split=y%32?39:23;
      r(2,y+2,split-4,12,'#48434a');r(split,y+2,62-split,12,'#514b50');
      r(2,y+2,split-4,2,'#6b6464');r(split,y+2,62-split,2,'#6b6464');
     }
    }else if(type.startsWith('stairs-')){
     r(0,0,64,64,'#39353c');
     for(let y=0;y<64;y+=16){
      const light=type==='stairs-top'?'#a89a86':type==='stairs-base'?'#887769':'#958578';
      r(0,y+1,64,5,'#4d4342');r(0,y+6,64,7,'#74655c');
      r(0,y+12,64,2,light);r(0,y+14,64,2,'#291f26');
      for(let i=0;i<5;i++)r(rng(59),y+7+rng(4),2+rng(6),1,'#9e8c764f');
     }
    }else if(type==='boss-carpet'){
     r(0,0,64,64,'#513b4c');
     for(let i=0;i<100;i++){
      const x=rng(62),y=rng(63);
      r(x,y,1+rng(3),1,['#67505a5e','#74586750','#3e2c3d55','#8b6c7147'][rng(4)]);
     }
     for(let i=0;i<13;i++)r(rng(63),rng(62),1,2,'#ac88743a');
    }else if(type==='roof-stone'){
     r(0,0,64,64,'#505460');
     for(let row=0;row<4;row++){
      const y=row*16,split=15+rng(35);
      r(1,y+1,split-2,13,'#626673');r(split+1,y+1,62-split,13,'#595e6c');
      r(2,y+2,split-4,2,'#767984');r(split+2,y+2,59-split,2,'#717683');
      for(let i=0;i<5;i++)r(3+rng(58),y+5+rng(7),1+rng(4),1,'#7a7d866e');
     }
    }else if(type==='abyss'||type==='tower-sky'||type==='tower-horizon'){
     r(0,0,64,64,'#11151e');
     for(let i=0;i<42;i++)r(rng(64),rng(64),2+rng(15),1+rng(3),['#1b2230','#262938','#343344'][rng(3)]);
    }else if(type.startsWith('sewer-')||type==='river'||type==='clear-river'||type==='waterfall'){
     const sewer=type.startsWith('sewer-'),temple=type==='clear-river'||type==='waterfall';
     const palette=sewer?['#254b46','#32615e','#38524b','#38716a']:
      temple?['#203e43','#264e51','#2b5050','#386460']:['#1a333e','#24424c','#294952','#335b63'];
     r(0,0,64,64,sewer?(type==='sewer-pool'?'#244b4b':'#1c464d'):temple?'#1c393e':'#152b37');
     for(let i=0;i<65;i++)r(rng(64),rng(64),3+rng(11),1+rng(3),palette[rng(4)]);
     for(let i=0;i<7;i++){
      const x=rng(58),y=rng(58);
      r(x,y,3,2,sewer?'#527f71':'#416966');r(x+1,y+2,2,1,palette[1]);
     }
     if(type==='waterfall'){r(0,0,64,7,'#606e59');r(0,7,64,3,'#829075');}
    }else{
     if(type==='bridge-y'){g.translate(64,0);g.rotate(Math.PI/2);}
     // Wider planks and low-contrast grain keep the fast scrolling deck legible.
     r(0,0,64,64,'#755440');
     const plank=['#825d46','#88634a','#89654d','#805e48'];
     for(let x=0;x<64;x+=16){
      const board=g.createLinearGradient(x,0,x+16,0);
      board.addColorStop(0,'#6d4e3e');board.addColorStop(.18,plank[rng(plank.length)]);
      board.addColorStop(.82,'#88634b');board.addColorStop(1,'#795741');
      r(x,0,16,64,board);
      for(let grain=0;grain<3;grain++)r(x+3+rng(8),5+rng(35),2,8+rng(14),grain%2?'#6c4d3e42':'#b78e6740');
      r(x+4+rng(7),16+rng(30),3,5,'#60443465');
     }
     for(const end of [3,58]){
      r(0,end,64,3,'#6d504143');
      for(const x of [7,23,39,55])r(x,end,3,3,'#6048389e');
     }
    }
    terrainCache.set(key,c);return c;
  }
  function towerBackdrop(roof,size,seed){
    const pad=size*5,padX=size*12,top=roof.y*size,w=roof.w*size,h=roof.h*size;
    const bitmap=surface(w+2*padX,h+top+pad),{g,r,poly}=brush(bitmap),rnd=random(seed^0x433bad);
    g.translate(padX,top);
    const sky=g.createLinearGradient(0,-top,0,h+pad);
    sky.addColorStop(0,roof.hail?'#414858':'#415a6c');sky.addColorStop(.55,'#768994');sky.addColorStop(1,'#a7aba0');
    r(-padX,-top,bitmap.width,bitmap.height,sky);
    for(const [y,shade] of [[h*.54,'#54677a'],[h*.79,'#657789'],[h*1.12,'#798986']]){
      const ridge=Array.from({length:22},(_,i)=>[-padX+Math.round(i*bitmap.width/21),Math.round(y-rnd(92))]);
      poly([...ridge,[w+padX,h+pad],[-padX,h+pad]],shade);
    }
    for(let i=0;i<40;i++){
      const x=rnd(bitmap.width)-padX,y=h+pad-12-rnd(pad),width=5+rnd(11),height=3+rnd(6);
      r(x,y,width,height,'#526667');poly([[x-2,y],[x+Math.floor(width/2),y-height],[x+width+2,y]],'#58666c');
    }
    for(let i=0;i<22;i++){
      const x=rnd(bitmap.width)-padX,y=rnd(bitmap.height)-top,length=34+rnd(88);
      r(x,y,length,3,'#c2cbd236');r(x+9,y-3,length-16,3,'#c9cfd53a');r(x+14,y+3,length-21,3,'#aab9c34a');
    }
    const sides=[[-17,h-12],[w+17,h-12],[w-15,h+pad],[19,h+pad]];
    g.save();g.beginPath();for(const [i,[x,y]] of sides.entries())if(i)g.lineTo(x,y);else g.moveTo(x,y);g.closePath();g.clip();
    const face=g.createLinearGradient(0,h,0,h+pad);
    face.addColorStop(0,'#50596a');face.addColorStop(.65,'#343d52');face.addColorStop(1,'#526676');
    r(-17,h-12,w+34,pad+12,face);
    for(let y=h+10;y<h+pad;y+=17){
      r(-17,y,w+34,2,'#252e4399');r(-17,y+2,w+34,1,'#8391a039');
      for(let x=((y-h)%2?22:3);x<w+17;x+=32)r(x,y+2,2,15,'#252d4190');
    }
    for(let x=30;x<w-20;x+=size*2){
      r(x-5,h+30,17,42,'#687184');poly([[x-5,h+32],[x+3,h+22],[x+12,h+32]],'#737f8c');
      r(x,h+34,7,33,'#242b40');r(x+2,h+46,2,18,'#121b30');r(x-6,h+70,19,3,'#858e9b');
    }
    for(const x of [-9,Math.round(w/2)-9,w-10]){
      r(x,h-4,19,pad-4,'#434e63');r(x+1,h-4,5,pad-4,'#647184');r(x+15,h,4,pad,'#2b3449');
      for(let y=h+14;y<h+pad;y+=22)r(x,y,19,2,'#283247');
    }
    r(-17,h,w+34,8,'#303b51');r(-17,h+2,w+34,3,'#7c8896');
    g.restore();
    g.clearRect(0,0,w,h);
    const coping=(x,y,width,height)=>{
      r(x,y,width,height,'#343943');r(x+1,y+1,width-2,height-3,'#7a8291');r(x+2,y+1,width-4,2,'#a0a6ad');
    };
    for(let x=5;x<w-18;x+=32){coping(x,-10,20,15);coping(x,h-6,20,13);}
    for(let y=19;y<h-17;y+=36){coping(-9,y,13,20);coping(w-4,y,13,20);}
    for(const x of [-13,w-19])for(const y of [-12,h-15]){
      coping(x,y,32,26);r(x+8,y+7,16,11,'#505965');r(x+8,y+7,16,2,'#263344');
    }
    return {bitmap,x:roof.x*size-padX,y:roof.y*size-top};
  }
  function world(map,zoneAt,lights,seed,terrain,frontWalls,tileSize=SIZE,roof=null) {
    const rnd=random(seed),chunkSize=16,chunks=[],fx=window.DungeonStrataFx;
    const tower=roof&&towerBackdrop(roof,tileSize,seed);
    const towerTile=({x,y,surfaceType})=>tower&&(surfaceType==='roof-stone'||surfaceType==='tower-sky'||surfaceType==='tower-horizon'||
     surfaceType==='abyss'&&x>=roof.x-1&&x<=roof.x+roof.w&&y>=roof.y-1&&y<=roof.y+roof.h);
    const tiles=map.map((row,y)=>row.map((value,x)=>{
      const v=rnd(12),surfaceType=terrain?.[y]?.[x];
      if(value===0||surfaceType==='partition')return {v,open:value===0,surfaceType};
      if(surfaceType)return {v,surfaceType};
      const mask=(map[y-1]?.[x]===0?1:0)|(map[y]?.[x+1]===0?2:0)|(map[y+1]?.[x]===0?4:0)|(map[y]?.[x-1]===0?8:0);
      if(mask&&[[x,y-1],[x+1,y],[x,y+1],[x-1,y]].some(([a,b])=>map[b]?.[a]===0&&zoneAt(a,b)===6))
       return {v,mask,surfaceType:'jungle-wall'};
      return mask?{v,mask}:null;
    }));
    for(let top=0;top<map.length;top+=chunkSize)for(let left=0;left<map[0].length;left+=chunkSize){
      const bottom=Math.min(top+chunkSize,map.length),right=Math.min(left+chunkSize,map[0].length);
      const cells=[];
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(tiles[y][x])cells.push({x,y,...tiles[y][x]});
      if(!cells.length)continue;
      const x0=left*tileSize,y0=top*tileSize,c=surface((right-left)*tileSize,(bottom-top)*tileSize),{g,r}=brush(c);
      r(0,0,c.width,c.height,'#101212');
      g.translate(-x0,-y0);
      for(const {x,y,v,mask,open,surfaceType} of cells){
        const zone=zoneAt(x,y);
        const image=surfaceType&&surfaceType!=='partition'?terrainTile(surfaceType,v):
         open||surfaceType==='partition'?floor(zone,v):wall(zone,mask,v%4);
        const px=x*tileSize,py=y*tileSize;
        // Filter dense patterns once at their final world resolution.
        g.imageSmoothingEnabled=Boolean(surfaceType&&
         (surfaceType.startsWith('street-')||surfaceType.startsWith('bridge-')||surfaceType==='roof-stone'||surfaceType==='house-boards'));
        if(frontWalls&&(mask&1))frontWalls.push({x,y,bitmap:image,key:'front-wall-'+(surfaceType??zone)+'-'+mask+'-'+(surfaceType?v:v%4)});
        if(surfaceType==='sanctuary-water'&&fx){
         const edges=[[x-1,y],[x,y-1],[x+1,y],[x,y+1]].map(([col,row])=>Number(terrain[row]?.[col]!=='sanctuary-water'));
         g.drawImage(terrainTile('sanctuary-garden',v),px,py,tileSize,tileSize);
         g.save();fx.shorePath(g,px,py,tileSize,edges);g.clip();
         g.drawImage(image,px,py,tileSize,tileSize);g.restore();
        }else if(fx?.isSewer(surfaceType)){
         g.drawImage(floor(zone,v),px,py,tileSize,tileSize);
         g.save();fx.sewerPath(g,px,py,tileSize,fx.shoreline(terrain,x,y));g.clip();
         g.drawImage(image,px,py,tileSize,tileSize);g.restore();
        }else g.drawImage(image,px,py,tileSize,tileSize);
      }
      const towerCells=cells.filter(towerTile);
      if(towerCells.length){
        g.save();g.beginPath();
        for(const p of towerCells)g.rect(p.x*tileSize,p.y*tileSize,tileSize,tileSize);
        g.clip();g.drawImage(tower.bitmap,tower.x,tower.y);g.restore();
      }
      g.beginPath();
      for(const p of cells)if(p.open)g.rect(p.x*tileSize,p.y*tileSize,tileSize,tileSize);
      g.clip();g.globalCompositeOperation='screen';
      for(const {x,y,zone,radius,power,color=stone[zone].light} of lights){
        if(x+radius<x0||x-radius>x0+c.width||y+radius<y0||y-radius>y0+c.height)continue;
        const light=g.createRadialGradient(x,y,3,x,y,radius);
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
    if(type==='sanctuary-ban-table'){
      const ellipse=(cy,w,h,col)=>poly(Array.from({length:24},(_,i)=>[
       Math.round(64+Math.cos(i*Math.PI/12)*w),Math.round(cy+Math.sin(i*Math.PI/12)*h)
      ]),col);
      ellipse(76,60,26,'#1917219e');ellipse(63,61,27,'#332d3b');
      r(34,63,9,19,'#3d3848');r(84,63,9,19,'#3d3848');
      ellipse(51,62,30,'#6b6273');ellipse(49,57,26,'#a499a3');ellipse(49,53,23,'#5d566b');
      const glow=['#8a83c8','#a199e1','#bdb5ff','#d4c6ff','#f0dbff','#d4c6ff','#bdb5ff','#a199e1'][pose%8];
      ellipse(49,43,19,glow);ellipse(49,41,17,'#57536c');ellipse(49,29,12,glow);ellipse(49,26,10,'#655c76');
      poly([[64,39],[77,49],[64,59],[51,49]],'#b9aad7');poly([[64,42],[73,49],[64,56],[55,49]],'#625873');
      for(let i=0;i<8;i++){
       const a=i*Math.PI/4,x=Math.round(64+Math.cos(a)*36),y=Math.round(49+Math.sin(a)*15);
       r(x-1,y-1,3,3,glow);r(x-3,y,7,1,glow);
      }
      r(61,47,6,4,'#e8dcff');
    }else if(type==='sanctuary-mosaic'){
      const ring=(w,h,col)=>poly(Array.from({length:20},(_,i)=>[
       Math.round(64+Math.cos(i*Math.PI/10)*w),Math.round(56+Math.sin(i*Math.PI/10)*h)
      ]),col);
      ring(62,44,'#484e44');ring(60,42,'#8e8e77');ring(56,39,'#626a59');ring(49,34,'#a3a282');
      ring(46,32,'#535e51');ring(33,24,'#747966');ring(30,21,'#54594e');
      for(let i=0;i<12;i++){
       const a=i*Math.PI/6,x=Math.round(64+Math.cos(a)*41),y=Math.round(56+Math.sin(a)*28);
       poly([[x,y-4],[x+4,y],[x,y+4],[x-4,y]],'#aad6af');r(x-1,y-1,2,2,'#536a57');
      }
    }else if(type==='sanctuary-smith'){
      const talking=pose===8,bob=talking?-6:[0,-2,-3,0,2,1,0,0][pose],hy=31+bob;
      shadow(17,75,99,15);
      poly([[32,76],[29,49],[34,39],[46,34],[60,40],[67,55],[53,75]],'#352c32');
      poly([[34,49],[41,39],[56,41],[61,54],[55,67],[36,71]],'#6d6557');
      poly([[38,45],[48,44],[54,54],[51,72],[32,75],[31,62]],'#73533e');
      r(38,58,15,3,'#ab8051');r(49,59,4,3,'#cfad69');
      r(35,70,11,12,'#403736');r(49,69,12,13,'#403736');
      poly([[34,hy-6],[45,hy-12],[58,hy-10],[64,hy],[63,hy+15],[57,hy+14],[52,hy+27],[43,hy+19],[37,hy+20],[32,hy+6]],'#5e5855');
      poly([[37,hy-2],[45,hy-9],[56,hy-7],[60,hy+2],[54,hy+9],[45,hy+13],[39,hy+9]],'#a29a8b');
      poly([[35,hy-5],[23,hy-10],[18,hy-21],[23,hy-15],[33,hy-13],[43,hy-9]],'#ddcfac');
      poly([[48,hy-10],[59,hy-16],[63,hy-23],[63,hy-12],[55,hy-6]],'#c7b897');
      if(talking){
       poly([[40,hy+5],[42,hy-1],[54,hy-3],[61,hy+2],[61,hy+11],[54,hy+15],[44,hy+11]],'#c39370');
       r(45,hy+3,3,2,'#34282a');r(54,hy+3,3,2,'#34282a');r(49,hy+5,3,5,'#e1b38e');
       poly([[42,hy+8],[48,hy+11],[51,hy+9],[58,hy+10],[61,hy+8],[59,hy+18],[54,hy+26],[49,hy+30],
        [45,hy+23],[41,hy+15]],'#c6bca4');r(49,hy+14,3,11,'#e2d4b4');
      }else{
       poly([[48,hy],[55,hy-4],[63,hy],[64,hy+8],[59,hy+12],[49,hy+8]],'#c39370');
       r(56,hy+1,4,1,'#6b4a44');r(58,hy+2,2,2,'#271f27');r(61,hy+5,4,2,'#e4ae84');
       poly([[47,hy+6],[58,hy+8],[62,hy+5],[61,hy+15],[54,hy+24],[49,hy+27],[47,hy+20],[43,hy+18]],'#aca397');
       poly([[48,hy+8],[55,hy+10],[58,hy+9],[53,hy+19],[50,hy+22],[48,hy+16]],'#cfc5ab');
      }
      r(73,66,23,15,'#4c3831');r(72,65,25,4,'#926e53');r(76,70,18,2,'#6f523c');
      poly([[63,56],[109,56],[104,62],[95,64],[92,71],[77,71],[76,65],[68,63]],'#303743');
      poly([[63,55],[107,55],[106,59],[69,59]],'#86908e');r(77,63,16,2,'#596263');
      poly([[79,48],[108,48],[117,52],[109,56],[79,54]],'#d1b39e');
      r(82,49,26,2,'#fbe0bb');r(85,52,20,2,'#e17d4d');r(72,51,10,2,'#5e4639');r(76,48,4,7,'#a58860');
      const hx=talking?61:[52,50,53,61,72,68,62,57][pose],ay=talking?63:[24,17,14,29,46,40,33,27][pose];
      poly([[45,48],[52,48],[hx+3,ay+4],[hx,ay+7],[47,58]],'#bd906e');
      if(!talking){
       poly([[hx-1,ay-9],[hx+3,ay-10],[hx+5,ay+4],[hx+1,ay+7]],'#805d42');
       r(hx-4,ay-12,15,5,'#6f797a');r(hx-3,ay-12,12,1,'#abb0a3');
       if(pose===4||pose===5)for(let i=0;i<7;i++)r(80+i*5,49-(i*7)%18-(pose-4)*5,2+i%2,2,i%2?'#ffc16a':'#fff0ba');
      }
    }else if(type==='sanctuary-archive'||type==='sanctuary-plaque'){
      const book=type==='sanctuary-archive';shadow(28,66,73,16);
      poly([[40,48],[88,48],[87,72],[39,72]],'#494844');r(45,53,39,15,'#68685c');r(47,54,5,12,'#817e6c');
      poly([[29,49],[40,32],[88,32],[99,50],[89,54],[40,54]],'#8e8876');r(40,50,48,3,'#585955');
      if(book){
       poly([[44,29],[62,31],[79,27],[87,40],[64,46],[40,41]],'#4e3730');
       poly([[44,28],[63,31],[62,43],[42,40]],'#e4cea1');poly([[64,31],[79,27],[84,39],[64,43]],'#f4e1b7');
       for(let i=0;i<3;i++){r(47,32+i*2,12,1,'#886f59');r(66,32+i*2,12,1,'#967958');}
      }else{r(47,41,34,3,'#95d5bc');r(63,36,3,10,'#c9e7c8');}
    }else if(type==='sanctuary-vault'){
      poly([[0,60],[0,41],[12,26],[37,18],[91,18],[115,26],[128,41],[128,60],[111,60],[110,48],
       [94,40],[78,40],[76,59],[63,59],[61,40],[45,40],[29,45],[18,55],[18,60]],'#595b53');
      poly([[0,40],[12,25],[36,15],[93,15],[116,25],[128,40],[117,44],[98,36],[87,33],[38,33],[18,40],[10,44]],'#797c6d');
      poly([[4,37],[19,25],[37,19],[91,19],[109,24],[122,35],[116,37],[93,27],[39,27],[24,31],[13,40]],'#8a8b78');
      for(const [x,y] of [[9,44],[30,36],[52,34],[77,34],[99,38],[117,45]]){
       r(x,y,3,10,'#434942');r(x+3,y,3,9,'#a59d84');
      }
      for(const x of [7,64,111]){r(x,50,10,9,'#747768');r(x+2,50,2,8,'#a4a087');}
    }else if(type==='sanctuary-arch'){
      shadow(17,69,94,12);
      poly([[12,71],[12,38],[22,20],[41,9],[57,5],[70,5],[89,9],[106,20],[116,39],[116,71],[103,71],
       [103,40],[93,27],[78,20],[63,17],[47,20],[34,27],[24,41],[24,71]],'#575850');
      for(const x of [13,104])for(let y=41;y<72;y+=9){r(x,y,12,8,'#82806d');r(x+1,y+1,10,2,'#a39d81');}
      for(const [x,y,w] of [[22,27,12],[33,17,13],[47,12,13],[62,8,13],[77,13,13],[91,21,12]]){
       r(x,y,w,7,'#8a8675');r(x+1,y+1,w-3,2,'#aaa08d');
      }
      poly([[62,8],[69,5],[76,12],[69,20]],'#c2d6a6');r(67,11,4,5,'#cffadd');
    }else if(type==='sanctuary-flowers'||type==='sanctuary-tree'){
      const tree=type==='sanctuary-tree',rnd=random(variant+129);
      shadow(tree?27:36,66,tree?77:55,13);
      if(tree){
       poly([[53,75],[56,48],[45,33],[49,28],[63,49],[75,23],[81,28],[65,55],[67,75]],'#725541');
       r(58,51,4,22,'#ac845c');
      }
      for(let i=0;i<(tree?31:19);i++){
       const x=(tree?24:39)+rnd(tree?76:49),y=(tree?16:52)+rnd(tree?36:18);
       poly([[x-4,y],[x,y-4],[x+7,y-3],[x+10,y+1],[x+6,y+6],[x-1,y+4]],['#476750','#577a58','#7c9568','#9da56f'][rnd(4)]);
       if(i%2===0){r(x+1,y,4,3,['#f2b4aa','#edc797','#c8aada','#f3dfb5'][rnd(4)]);r(x+2,y+1,2,1,'#fff0bc');}
      }
    }else if(type==='sanctuary-pillar'||type==='sanctuary-seat'||type==='sanctuary-brazier'){
      const tall=type==='sanctuary-pillar',fire=type==='sanctuary-brazier',top=tall?24:fire?52:60;
      shadow(39,68,52,10);r(45,69,40,7,'#454b43');r(48,66,34,4,'#908c76');r(51,top,28,68-top,'#606458');
      r(52,top,6,68-top,'#8c8978');r(47,top-4,36,7,'#777b67');r(48,top-3,34,2,'#aba48b');
      if(tall){r(50,43,29,1,'#4e544a');r(52,30,3,32,'#a0a089');}
      if(fire)flame(65,53,true);
    }else if(type==='carpet'){
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
    }else if(type==='barrel'||type==='large-barrel'){
      if(type==='large-barrel'){
        const g=c.getContext('2d');g.translate(64,71);g.scale(1.33,1.43);g.translate(-64,-71);
      }
      shadow(43,66,42,12);
      poly([[47,36],[80,36],[86,47],[82,70],[46,70],[42,48]],ink);
      r(46,43,37,23,wood);r(49,39,30,9,grain);r(51,40,25,2,edge);
      for(let x=49;x<80;x+=6)r(x,48,2,17,grain);
      for(const y of [48,61]){r(45,y,39,4,'#494844');r(48,y,31,1,'#898276');r(76,y+1,2,2,gold);}
    }else if(type==='street-drain'){
      poly([[46,45],[80,45],[91,55],[88,68],[78,76],[48,76],[36,65],[37,53]],'#221f2b');
      poly([[48,47],[78,47],[88,55],[85,67],[76,73],[49,73],[39,64],[41,53]],'#6d6870');
      poly([[49,50],[77,50],[84,57],[82,66],[74,70],[50,70],[43,62],[45,55]],'#3e3e49');
      for(let x=52;x<80;x+=7){r(x,54,2,12,'#23232e');r(x+2,54,1,11,'#817981');}
      r(49,59,30,2,'#59565d');r(51,49,21,1,'#968589');r(54,69,17,1,'#272934');
    }else if(type==='street-stalls'){
      shadow(31,62,64,13);
      for(const x of [35,86]){r(x,22,6,48,'#413034');r(x+1,25,2,41,'#967058');}
      r(34,12,59,15,'#4f334b');
      for(let x=35;x<92;x+=14){r(x,13,7,17,'#b46755');r(x+7,13,7,14,'#d7ae79');}
      planks(30,48,68,13);r(39,42,12,6,'#75643c');r(44,40,5,3,'#a49053');
      r(69,39,20,9,'#925f56');r(71,38,16,2,'#c08e66');
    }else if(type==='street-lantern'){
      r(77,16,2,17,'#292631');r(74,25,8,2,'#a68b73');
      r(72,30,13,16,'#352b35');r(74,32,9,11,pose?'#666270':'#cb803f');r(77,33,3,8,pose?'#6f6b74':'#ffd393');
      r(81,32,1,11,'#6f4b47');r(72,43,13,2,'#8b6653');
    }else if(type==='street-straw'){
      for(let i=0;i<18;i++){
        const x=38+i*17%49,y=49+i*13%15;
        r(x,y,5+i%5,1,['#6d593d','#8f7953','#b49a65'][i%3]);
        if(i%3===0)r(x+5,y+1,3,1,'#92805a');
      }
    }else if(type==='roof-rubble'){
      shadow(29,56,69,24);
      const cut=pose%3*3;
      poly([[32,60],[38,40],[56+cut,30],[75,34],[93,49],[94,62],[75,72],[42,70]],'#302a39');
      poly([[35,59],[41,41],[56+cut,33],[72,37],[91,49],[78,58],[55,55],[43,64]],'#796b77');
      poly([[41,42],[56+cut,33],[72,37],[80,43],[65,41],[54,45],[49,52],[37,58]],'#ad998e');
      poly([[46,64],[55,55],[78,58],[91,50],[91,60],[74,69],[45,68]],'#504652');
      r(56,40,12,2,'#594f62');r(66,41,4,4,'#594f62');r(69,45,10,2,'#605262');
      r(34,64,8,4,'#8c7c7f');r(87,65,7,4,'#665965');
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
    }else if(type==='campfire'||type==='sanctuary-hearth'){
      shadow(23,58,82,23);
      if(type==='sanctuary-hearth'){
       poly([[11,64],[28,46],[99,46],[116,65],[101,87],[28,87]],'#4d5145');
       poly([[15,65],[28,54],[101,54],[110,65],[99,82],[28,82]],'#92907a');
       poly([[25,65],[39,58],[91,58],[102,66],[88,76],[39,76]],'#535547');
       r(26,77,11,2,'#b0b494');r(90,77,11,2,'#b0b494');
      }
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
    if(zone!==15)poly([[10,51],[18,47],[48,47],[55,52],[49,56],[14,56]],'#100d13a8');
    if(zone===20){
     const stride=stage===0?[-4,1,4,-1][step]:stage===2?4+step:0;
     const neck=stage===2?reach:stage===1?-2:0,bob=stage===1?3:stage===2?-2:crouch;
     poly([[18,40],[11,39],[5,33],[3,26],[8,29],[14,33],[19,32]],'#382c34');
     for(const [x,z] of [[20,stride],[36,-stride]]){
      poly([[x,38],[x+6,39],[x+5+z,51],[x+z,51]],'#514039');
      r(x+z-1,49,8,3,'#5d4941');
     }
     poly([[13,33+bob],[17,27+bob],[31,25+bob],[39,27+bob],[45,34+bob],[41,44+bob],[23,46+bob],[14,41+bob]],'#3d3036');
     poly([[15,33+bob],[20,28+bob],[31,27+bob],[40,31+bob],[41,37+bob],[32,38+bob],[20,41+bob]],'#997357');
     poly([[19,35+bob],[25,32+bob],[36,31+bob],[39,37+bob],[30,43+bob],[19,41+bob]],'#795642');
     for(const [x,z] of [[18,-stride],[38,stride]]){
      poly([[x,37+bob],[x+6,38+bob],[x+6+z,51],[x+z,51]],'#89634a');
      r(x+z,50,8,4,'#bc9680');r(x+z+5,51,1,2,'#56413d');
     }
     const head=x=>Math.min(62,x+neck);
     poly([[head(32),29+bob],[head(35),20+bob],[head(36),13+bob],[head(43),20+bob],[head(49),19+bob],
      [head(52),25+bob],[head(59),26+bob],[head(62),30+bob],[head(57),36+bob],[head(48),36+bob],[head(44),43+bob]],'#45343a');
     poly([[head(35),30+bob],[head(38),21+bob],[head(47),21+bob],[head(51),27+bob],[head(58),28+bob],
      [head(56),34+bob],[head(48),34+bob],[head(42),39+bob]],'#a37b59');
     poly([[head(36),18+bob],[head(39),19+bob],[head(43),24+bob],[head(41),28+bob],[head(37),24+bob]],'#bb8b78');
     r(head(47),24+bob,3,2,'#ffd185');r(head(57),27+bob,3,2,'#3b2a31');
     r(head(50),33+bob,7,2,stage===2?'#eee1bb':'#58423a');r(head(36),33+bob,4,7,'#7d4f50');
     return c;
    }
    if(zone===18||zone===19){
     const light=zone===18,cloth=light?'#d3c9b1':'#272331',shade=light?'#9f968d':'#514459',edge=light?'#f3ead6':'#8e7a98';
     const flutter=stage===1?7+step*2:stride,blade=stage===2?7+reach:stride;
     for(const [x,d] of [[25,stride],[34,-stride]]){r(x,44,5,8+d,'#4b4243');r(x-1,51+d,7,3,'#292330');}
     poly([[20,y(26)],[27,y(22)],[37,y(22)],[43,y(28)],[40+flutter,46],[43+flutter,49],[30,51],[18+flutter,49],[23,41]],cloth);
     poly([[25,y(26)],[32,y(25)],[30,49],[22+flutter,48],[26,40]],shade);
     poly([[33,y(24)],[39,y(25)],[37,40],[42+flutter,48],[34,46]],edge);
     poly([[23,y(21)],[17,y(15)],[26,y(16)],[28,y(7)],[36,y(7)],[42,y(13)],[46,y(15)],[41,y(22)],[36,y(25)],[28,y(25)]],'#53675c');
     poly([[25,y(10)],[35,y(8)],[40,y(16)],[38,y(23)],[28,y(23)],[24,y(18)]],'#7a917d');
     r(27,y(15),4,2,'#ead186');r(34,y(15),4,2,'#ead186');r(31,y(18),3,3,'#334745');
     r(27,y(20),2,3,'#e0d4aa');r(36,y(20),2,3,'#e0d4aa');
     poly([[18,y(29)],[22,y(31)],[20,y(38)],[17,y(40)],[14,y(38)]],shade);
     poly([[38,y(27)],[44,y(29)],[44+blade,y(35)],[38+blade,y(37)],[37,y(34)]],cloth);
     const end=Math.min(58,44+blade);
     poly([[end-5,y(38)],[end-3,y(30)],[end+1,y(24)],[62,y(21)],[end+1,y(29)],[end+1,y(37)],[end-2,y(41)]],'#798291');
     r(end-3,y(36),5,2,'#e0d9c7');
     return c;
    }
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
     const flap=[-22,-18,-9,5,22,17,5,-9,-6,-14,-22,-24,-15,0,12,16,11,3,16,22,16,6,-8,-21][frame];
     const pitch=[-4,-6,-8,-9,4,10,13,12,7,2,-2,-5,-7,-7,-5,-2][frame-8]??0;
     const diving=frame>=12&&frame<18,fold=diving?[6,12,15,12,8,3][frame-12]:0;
     const body=(points,color)=>poly(points.map(([x,y])=>[x,y+Math.round((x-28)*pitch/28)]),color);
     function wing(side){
      const near=side<0,sx=near?29:34,sy=near?30:25;
      const span=(near?.84:.87)-fold*.014;
      const feather=(p,color)=>poly(p.map(([u,v])=>[
       sx+Math.round(u*(span*side-fold*.01)),sy+Math.round(v+flap*(near?1:.74)*(u/33)**1.28)
      ]),color);
      feather([[0,0],[9,-5],[18,-5],[32,-7],[26,-1],[33,-2],[25,4],[30,4],[22,8],[26,9],[16,12],[8,10],[1,7]],'#302429');
      feather([[1,1],[10,-4],[18,-3],[29,-6],[19,2],[23,2],[15,7],[8,8],[2,6]],near?'#a88054':'#76583e');
      feather([[13,0],[25,-5],[20,0],[24,0],[17,5],[21,5],[14,9],[9,8]],near?'#bd9b67':'#937454');
      feather([[19,5],[27,3],[21,8],[24,8],[17,11],[14,10]],'#4a3430');
     }
     wing(1);
     body([[23,32],[14,33],[7,41],[13,40],[10,45],[24,40],[30,34]],'#594033');
     body([[20,32],[26,24],[38,22],[45,28],[44,35],[36,41],[26,40],[20,36]],'#694a37');
     body([[28,25],[37,25],[42,29],[37,35],[28,37],[23,33]],'#956b43');
     wing(-1);
     body([[37,24],[41,19],[49,18],[55,23],[54,29],[49,32],[42,30],[37,32],[39,27]],'#dfd0a6');
     body([[44,19],[51,19],[55,23],[50,23],[44,22],[41,25]],'#f2e7c9');
     body([[53,23],[59,23],[62,27],[58,30],[58,27],[53,27]],'#dead53');
     body([[47,23],[51,23],[50,25],[47,25]],'#4a362c');
     if(diving&&frame>=13&&frame<=16){
      body([[32,36],[35,42],[43,41],[45,43],[43,44],[42,43],[36,45],[32,42],[29,40]],'#dfb568');
      body([[38,35],[42,39],[49,38],[51,41],[49,42],[48,40],[42,42],[37,39]],'#f0ca74');
     }
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
    const c=surface(),{g,r,poly}=brush(c);
    const shape=(p,col)=>poly(p,col);
    const flask=(hx,hy,tilted)=>{
      shape([[hx-5,hy-8+tilted],[hx+3,hy-8],[hx+2,hy],[hx-3,hy]],'#604353');
      r(hx-4,hy-8+tilted,7,2,'#dbc9ad');r(hx-3,hy-5,5,3,'#9976b0');
    };
    if(groundShadow)shape([[13,47],[49,47],[55,52],[51,56],[13,56],[8,53]],'#100d13a8');
    if(type==='hero'&&back){
      const stride=options.stride??[0,-3,-2,-1,3,2,1][frame];
      const sway=options.stride===undefined?[0,-2,-1,1,2,1,-1][frame]:Math.round(stride/2);
      const lift=0;
      for(const [x,y] of [[23,stride],[34,-stride]]){
        r(x,40,8,13+y,ink);r(x+1,41,6,10+y,armor.legs||skin);
        r(x-1,49+y,10,5,ink);r(x,49+y,8,3,armor.boots||skin);
        if(armor.boots)r(x+1,49+y,5,1,'#b6aa8a');
      }
      g.translate(0,-(options.bob??0));
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
      r(17,37+sway,6,6,skin);if(options.potion===undefined)r(42,37,6,6,skin);
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
      if(options.potion!==undefined){
        const [hx,hy]=[[46,38],[48,29],[44,23],[47,31]][options.potion];
        shape([[40,28],[46,29],[hx+4,hy+5],[hx-1,hy+6],[41,36]],armor.chest||skin);
        r(hx-2,hy-1,6,5,skin);flask(hx,hy,options.potion===2?3:0);
      }
      g.resetTransform();armorDetails({r,poly},armor,true,stride,sway);
      return c;
    }
    if(type==='hero'){
      const step=options.stride??(frame===1?2:frame===2?-2:0);
      if(armor.chest){
        shape([[21,25],[43,25],[51,50],[44,54],[19,54],[12,49]],ink);
        shape([[22,27],[42,27],[47,49],[36,52],[17,48]],color);
      }
      for(const [x,y] of [[23,step],[34,-step]]){
        r(x,41,8,12+y,ink);r(x+1,42,6,10+y,armor.legs||skin);
        r(x-2,50+y,11,4,armor.boots||skin);
      }
      g.translate(0,-(options.bob??0));
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
      r(17,38+Math.round(step/2),6,6,skin);if(frame<3)r(42,37,6,6,skin);
      r(22,11,20,16,ink);r(24,13,16,13,skin);r(23,10,18,6,hair);r(22,15,4,7,hair);r(39,15,4,6,hair);
      r(27,18,3,2,ink);r(35,18,3,2,ink);r(30,23,5,1,'#905d51');
      if(gender==='female'&&!armor.helmet){r(21,18,4,10,hair);r(39,18,5,9,hair);}
      if(armor.helmet){r(22,10,21,7,armor.helmet);r(24,9,16,2,'#ddd5b4');r(22,15,5,9,armor.helmet);r(39,15,4,9,armor.helmet);}
      g.resetTransform();armorDetails({r,poly},armor,false,step,0);
      g.translate(0,-(options.bob??0));
      if(frame>=3){
       const drinking=frame>=7,stage=(frame-3)%4;
       const [hx,hy]=[[43,38],[39,29],[35,23],[41,31]][stage];
       shape([[43,30],[47,30],[48,hy+5],[hx+3,hy+5],[hx,hy],[42,hy]],'#34252a');
       shape([[44,32],[45,32],[46,hy+4],[hx+3,hy+4],[hx+1,hy]],armor.chest||skin);
       r(hx,hy-1,5,5,skin);
       if(drinking)flask(hx,hy,stage===2?3:0);
       else{
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
    const c=surface(),{g,r,poly}=brush(c);
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
      const [mode,pose='0']=id.split('-'),n=Number(pose),dark=color||'#24212a',white=color?'#f4c698':'#ede2cb',shadeWhite=color?'#d39a66':'#c6bda9';
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
      }else if(id==='pellet'){
       for(const [x,y] of [[17,34],[27,23],[37,34]]){r(x,y,13,9,'#62392a');r(x+1,y,10,7,'#b67b4f');r(x+2,y,8,2,'#e2aa6d');r(x+2,y+4,2,2,'#8c583c');}
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
      const mane=style==='mane',walking=stage===0,leaping=stage===2,raking=stage===4;
      const bodyY=(stage===1?4:leaping?[-1,-4,-4,0][step]:stage===3?-2:walking?step%2:[0,1,1,0][step])+(mane?0:1);
      const stride=walking?[-4,0,5,0][step]:leaping?[-6,-9,-7,-2][step]:0;
      const lunge=leaping?[1,5,7,4][step]:raking?[0,4,2,0][step]:stage===1?-2:0;
      const coat=mane?'#bb864a':'#cfa263',edge=mane?'#604027':'#755235',lit=mane?'#ddab68':'#e5bf81';
      const ink='#302420',shade=mane?'#986438':'#a47849',maneBase='#6c3d27',maneLight='#9c5830';
      r(7,49,49,4,'#13111665');r(13,48,38,3,'#13111655');
      const tail=leaping?-5:stage===3?2:[1,-3,-2,2][step];
      poly([[16,36+bodyY],[10,35],[5,29+tail],[3,22+tail],[6,20+tail],[9,30+tail],[13,32],[19,32+bodyY]],ink);
      poly([[17,34+bodyY],[11,33],[7,28+tail],[5,23+tail],[7,24+tail],[9,30+tail],[13,32]],shade);
      poly([[2,20+tail],[5,17+tail],[9,19+tail],[8,24+tail],[4,25+tail]],mane?maneBase:edge);
      const paw=(x,reach,ground,far)=>{
       const toe=x+reach;
       poly([[x-4,37+bodyY],[x+5,36+bodyY],[x+4,42+bodyY],[toe+4,ground-5],[toe+5,ground-2],[toe+4,ground],[toe-3,ground],[toe-5,ground-4],[x-3,44+bodyY]],ink);
       poly([[x-2,38+bodyY],[x+3,38+bodyY],[x+2,43+bodyY],[toe+3,ground-4],[toe+2,ground-2],[toe-2,ground-2],[toe-3,ground-5],[x-2,43+bodyY]],far?edge:shade);
       if(!far)r(toe,ground-3,4,1,lit);
      };
      const sole=leaping?49-[2,6,6,2][step]:49;
      paw(18,-stride,sole-2,true);paw(39,stride+lunge,sole-2,true);
      poly([[12,33+bodyY],[17,28+bodyY],[26,27+bodyY],[35,28+bodyY],[43,26+bodyY],[50,31+bodyY],[47,43+bodyY],[42,46+bodyY],[24,44+bodyY],[16,46+bodyY],[12,41+bodyY]],ink);
      poly([[14,33+bodyY],[18,30+bodyY],[28,28+bodyY],[34,30+bodyY],[43,28+bodyY],[48,32+bodyY],[45,42+bodyY],[40,44+bodyY],[24,42+bodyY],[17,44+bodyY],[14,40+bodyY]],coat);
      poly([[15,38+bodyY],[20,40+bodyY],[27,38+bodyY],[36,39+bodyY],[45,35+bodyY],[45,41+bodyY],[39,44+bodyY],[24,42+bodyY],[17,44+bodyY]],shade);
      poly([[17,32+bodyY],[25,29+bodyY],[34,31+bodyY],[41,29+bodyY],[39,32+bodyY],[25,32+bodyY],[19,36+bodyY]],lit);
      r(20,37+bodyY,4,1,mane?'#cb9154':'#deb47a');r(29,34+bodyY,7,1,lit);
      const swipe=raking?[0,10,7,2][step]:0;
      paw(20,stride,sole,false);paw(41,-stride+lunge+swipe,sole-(swipe?4:0),false);
      const hx=39+lunge,hy=25+bodyY+(stage===1?3:stage===3?-4:0);
      if(mane){
       poly([[hx-11,hy+2],[hx-6,hy-8],[hx+4,hy-11],[hx+13,hy-7],[hx+17,hy+3],[hx+14,hy+13],[hx+8,hy+19],[hx,hy+18],[hx-3,hy+15],[hx-8,hy+15],[hx-8,hy+11],[hx-13,hy+10]],ink);
       poly([[hx-9,hy+2],[hx-5,hy-7],[hx+5,hy-9],[hx+12,hy-6],[hx+16,hy+3],[hx+13,hy+12],[hx+7,hy+17],[hx,hy+16],[hx-4,hy+12],[hx-8,hy+13],[hx-11,hy+8]],maneBase);
       poly([[hx-8,hy+1],[hx-4,hy-6],[hx+5,hy-8],[hx+10,hy-5],[hx+4,hy-3],[hx-3,hy+4],[hx-8,hy+8]],maneLight);
       r(hx-6,hy+7,4,2,maneLight);r(hx-2,hy+12,5,2,'#825034');
      }
      poly([[hx,hy-3],[hx-1,hy-7],[hx+2,hy-9],[hx+6,hy-8],[hx+8,hy-3],[hx+12,hy-5],[hx+15,hy-3],[hx+15,hy+2],[hx+13,hy+4],[hx,hy+3]],ink);
      r(hx+1,hy-7,4,4,shade);r(hx+2,hy-5,3,2,mane?'#c89462':'#d9b289');
      poly([[hx,hy-2],[hx+7,hy-4],[hx+13,hy-1],[hx+15,hy+6],[hx+18,hy+8],[hx+17,hy+12],[hx+12,hy+15],[hx+5,hy+13],[hx,hy+8]],ink);
      poly([[hx+1,hy-1],[hx+7,hy-2],[hx+12,hy],[hx+13,hy+6],[hx+16,hy+8],[hx+15,hy+11],[hx+11,hy+13],[hx+6,hy+11],[hx+2,hy+7]],coat);
      r(hx+4,hy,6,2,lit);r(hx+9,hy+3,4,2,'#4a3025');
      if(stage!==5||step!==3)r(hx+10,hy+3,2,1,'#ffe29a');
      r(hx+9,hy+7,6,4,'#edd19e');r(hx+14,hy+7,3,2,ink);
      if(stage===3||leaping||raking&&step===1){
       r(hx+9,hy+11,7,4,'#4d2621');r(hx+13,hy+11,2,2,'#f6e1b9');r(hx+9,hy+14,6,1,lit);
      }else r(hx+11,hy+11,4,1,'#684333');
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
    }else if(type==='dungeon-key'){
      poly([[12,21],[21,12],[32,12],[41,20],[41,31],[36,37],[51,52],[49,57],[44,56],[39,51],[35,52],[31,48],[34,45],[28,39],[20,38],[12,31]],'#32251e');
      poly([[15,22],[22,15],[31,15],[38,22],[38,30],[33,35],[49,51],[46,54],[39,47],[35,50],[33,47],[36,44],[27,36],[21,35],[15,29]],'#c78a46');
      r(21,21,10,9,'#32251e');r(22,17,9,3,'#f5d79a');r(16,21,4,8,'#efd08e');r(30,34,4,4,'#e9b973');
    }else if(type==='portal'){
      const returning=id==='return';
      r(10,53,44,7,'#100e12aa');
      poly([[8,55],[8,26],[16,11],[25,5],[40,5],[49,11],[56,26],[56,55]],'#252532');
      poly([[12,52],[12,26],[19,14],[27,8],[38,8],[46,14],[52,26],[52,52]],'#6d7081');
      poly([[17,53],[17,27],[24,16],[31,11],[37,13],[44,20],[47,28],[47,53]],returning?'#493250':'#304a69');
      poly([[20,51],[20,27],[26,20],[31,15],[35,17],[42,22],[44,31],[44,51]],returning?'#936783':'#537a9e');
      for(const [x,y,w] of [[28,23,13],[23,31,14],[28,39,13],[21,47,15]]){r(x,y,w,2,returning?'#efd1b2':'#b8e4df');r(x+3,y+3,w-4,1,'#7cacbb');}
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
    }else if(type==='crypt-altar'){
      poly([[9,30],[20,20],[44,20],[55,30],[52,48],[43,54],[20,54],[10,46]],'#25202a');
      poly([[11,30],[22,24],[42,24],[54,30],[43,38],[21,38]],'#827783');
      poly([[21,38],[43,38],[49,48],[41,51],[22,51],[16,47]],'#4e4656');
      r(20,35,24,2,'#bb976c');r(23,48,18,2,'#937555');
      poly([[23,16],[41,16],[38,26],[34,28],[34,32],[39,33],[25,33],[30,32],[30,28],[26,26]],'#d2a559');
      r(23,16,18,2,'#fff0ac');r(27,20,3,4,'#f1ce79');r(36,20,2,4,'#935a43');
      for(const x of [16,47]){r(x,21,2,11,'#d9bc8e');r(x,17,2,3,'#ffd180');}
    }else if(type==='cup'||type==='potion'){
      const filled=type==='potion',golden=id==='golden-cup';
      poly([[15,18],[20,12],[44,12],[49,18],[48,40],[42,49],[22,49],[16,40]],'#28232b');
      poly([[18,20],[46,20],[44,40],[39,46],[25,46],[20,41]],golden?'#c58d38':'#8b6550');
      r(22,26,3,14,'#c79163');r(40,25,3,15,'#5d4044');r(24,42,17,3,'#bd895d');
      poly([[17,18],[22,14],[42,14],[47,18],[44,24],[20,24]],'#dec18b');
      poly([[20,18],[25,16],[41,16],[44,19],[40,22],[23,22]],filled?(color||'#71a7a9'):'#554049');
      if(filled){r(25,17,10,1,'#fff1b8');r(33,10,2,4,color);r(39,7,2,2,'#f7e0ab');r(30,23,7,2,color);}
      r(31,47,3,5,'#a47c56');r(25,51,15,3,'#dec18b');
      if(golden){r(25,29,14,2,'#fff0a1');r(27,32,10,6,'#e6b44f');r(30,33,4,4,'#a44d69');r(26,49,13,2,'#f3cb65');}
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
        if(!shock){
          poly([[x(7),29],[x(15),17+lift],[x(16),19+lift],[x(10),32]],'#48282f');
          poly([[x(14),20+lift],[x(21-tuck),y+3],[x(19-tuck),y+3],[x(15),22+lift]],'#9e5a51');
        }else if(stage===1||stage===2)r(x(17+step*2),y+step%2,2,1,'#c2e3ff');
      }
      poly([[22,22+crouch],[22,13+crouch],[27,17+crouch],[30,21+crouch],[36,20+crouch],[41,13+crouch],
       [42,26+crouch],[40,39],[34,46],[27,43],[23,36]],base);
      poly([[25,25+crouch],[30,22+crouch],[36,23+crouch],[39,28+crouch],[36,39],[29,39],[25,34]],body);
      for(const x of [26,35])r(x,27+crouch,4,2,shock?'#c7efff':'#ffe0a7');
      r(29,32+crouch,7,stage===2?7:2,'#241827');
      if(stage!==3){r(29,33+crouch,1,3,'#dfceb3');r(35,33+crouch,1,3,'#dfceb3');}
      if(!shock&&stage===2){
        const jaw=39+crouch+step%2;
        poly([[25,31+crouch],[39,31+crouch],[39,jaw-3],[35,jaw+2],[29,jaw+2],[25,jaw-3]],'#4c292a');
        poly([[27,32+crouch],[37,32+crouch],[35,jaw],[30,jaw],[27,jaw-2]],'#9a3829');
        poly([[28,33+crouch],[36,33+crouch],[35,jaw-1],[30,jaw-1]],'#e67937');
        r(30,34+crouch,4,2,'#ffc36b');r(29,32+crouch,1,3,'#edc394');r(35,32+crouch,1,3,'#edc394');
      }else if(stage===1||stage===2){
        const glow=shock?'#a8e8ff':'#ff9356';
        r(31,34+crouch,2+step%2,step%2+1,glow);
        if(stage===2){r(29,35+crouch,7,3,glow);r(31,36+crouch,3,2,'#fff1ba');}
      }
    }else if(type==='jungle-trail'){
      poly([[8,53],[8,24],[14,16],[24,8],[40,8],[50,16],[56,24],[56,53],[44,53],[44,27],[38,21],[26,21],[20,27],[20,53]],'#3f5746');
      r(9,48,11,8,'#97ad75');r(44,48,11,8,'#97ad75');r(13,21,8,3,'#7b925f');r(43,21,8,3,'#7b925f');
      poly([[23,14],[31,9],[39,13],[35,18],[30,19]],'#8b9d70');
      for(const x of [14,19,47,51]){r(x,16,2,27,'#799957');r(x-2,24,5,2,'#a8bd79');r(x,35,5,2,'#a8bd79');}
      r(25,48,14,3,'#8e9c73');r(28,53,8,2,'#b4c48d');
    }else if(type==='ring'){
      const setting={hunter:'#9d6c46',bulwark:'#899b9e',scholar:'#a191bf',faith:'#deaa55',luck:'#889979',
       dodge:'#899fa4',precision:'#b98a55',brewer:'#90a46d',merchant:'#d4a65e',height:'#a9b4a9',madness:'#765267',avoidance:'#5d557b'}[id]??gold;
      const jewel=color||'#81acac';
      poly([[16,20],[47,20],[54,31],[52,46],[42,55],[22,55],[12,46],[10,31]],ink);
      poly([[17,22],[46,22],[51,32],[50,44],[41,52],[23,52],[14,44],[13,32]],setting);
      poly([[20,32],[24,28],[40,28],[45,34],[44,42],[38,47],[26,47],[20,42]],'#211c26');
      r(23,50,17,1,'#fbecbc7a');
      switch(id){
       case 'hunter':poly([[20,10],[29,17],[32,30],[40,26],[49,8],[44,22],[37,34],[26,34]],'#e1c2a0');r(29,22,3,6,'#a46b51');break;
       case 'bulwark':poly([[21,12],[43,12],[43,25],[32,35],[21,25]],'#b8c5bd');poly([[24,15],[40,15],[39,24],[32,31],[25,23]],'#60757c');r(30,17,4,11,pale);break;
       case 'scholar':poly([[15,15],[27,12],[32,17],[38,12],[49,14],[49,28],[37,27],[32,32],[27,28],[15,28]],'#d7cab1');
        r(31,18,2,11,'#756489');for(let i=0;i<3;i++){r(19,17+i*3,8,1,'#817087');r(37,17+i*3,8,1,'#817087');}break;
       case 'faith':poly([[32,6],[36,15],[47,19],[37,23],[32,34],[27,23],[17,19],[27,15]],'#efc76e');r(30,16,4,7,'#fff2cf');break;
       case 'luck':poly([[32,10],[42,9],[44,18],[39,22],[45,27],[42,32],[33,29],[31,35],[28,28],[20,29],[16,24],[22,20],[18,13],[24,9]],'#82bd83');r(30,15,4,11,'#bbd99a');break;
       case 'dodge':poly([[47,9],[41,22],[32,28],[19,32],[24,25],[14,27],[24,17],[36,12]],'#b7ded6');r(22,27,12,2,'#5c8b8d');break;
       case 'precision':poly([[31,6],[37,18],[46,22],[38,28],[32,35],[26,28],[18,22],[28,17]],'#e2a562');r(31,12,2,17,'#fff2c9');r(23,21,18,2,'#68475a');break;
       case 'brewer':poly([[23,10],[40,10],[37,19],[43,26],[38,33],[25,33],[21,26],[27,18]],'#9fbd90');
        poly([[22,24],[42,24],[37,31],[26,31]],'#547e72');r(24,11,15,3,'#e2d7ab');r(33,26,3,3,'#caf3b2');break;
       case 'merchant':poly([[19,15],[24,8],[40,8],[46,15],[46,27],[39,32],[25,32],[19,27]],'#e5b767');
        poly([[23,16],[29,12],[39,14],[42,24],[36,28],[26,26]],'#966b43');r(31,14,3,12,'#f4dc9e');break;
       case 'height':poly([[17,29],[23,18],[28,20],[35,7],[47,29]],'#879ba6');
        poly([[28,21],[35,7],[42,21],[37,18],[34,22],[32,17]],'#e9e4d0');r(20,28,25,3,'#aab3a3');break;
       case 'madness':poly([[13,20],[23,12],[34,10],[44,14],[51,20],[43,29],[32,32],[21,28]],'#d87591');
        poly([[18,20],[29,16],[41,16],[46,20],[39,25],[29,27]],'#f0acc0');r(29,14,7,14,'#6d384e');r(31,17,3,7,'#2f2033');break;
       case 'avoidance':poly([[40,8],[29,9],[22,20],[26,27],[35,31],[43,26],[37,35],[25,34],[17,27],[17,17],[25,9]],'#bbaadb');r(45,11,3,7,'#e9d9ed');r(43,13,7,2,'#e9d9ed');break;
       default:poly([[32,9],[44,18],[41,28],[32,33],[22,26],[20,17]],jewel);r(28,16,7,3,pale);
      }
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
      if(id==='spear'){
        r(30,20,4,42,'#51382d');r(31,20,2,40,'#a47a56');
        poly([[32,2],[39,14],[36,23],[32,27],[28,23],[25,14]],'#474853');
        poly([[32,3],[36,14],[33,23],[28,19],[27,14]],'#b9c3cb');
        poly([[32,4],[33,18],[30,21],[29,15]],'#eff0e2');
        r(28,24,8,3,'#9f8a63');r(30,38,4,8,'#594958');r(31,39,2,5,'#b39e86');
      }else if(id==='farm-scythe'){
        poly([[34,15],[38,16],[27,61],[24,60]],'#352b27');
        poly([[35,17],[37,17],[26,58],[25,58]],'#a78258');
        const steel=g.createLinearGradient(0,5,0,26);
        steel.addColorStop(0,'#66727b');steel.addColorStop(.46,'#9da7a8');steel.addColorStop(.7,'#ddd9c7');steel.addColorStop(1,'#605e5d');
        g.fillStyle=steel;g.beginPath();g.moveTo(32,17);g.bezierCurveTo(39,7,54,5,62,21);
        g.bezierCurveTo(51,13,43,13,37,24);g.quadraticCurveTo(32,23,32,17);g.fill();
        g.lineWidth=1;g.strokeStyle='#eee9d8';g.beginPath();g.moveTo(37,23);
        g.bezierCurveTo(43,13,51,13,61,20);g.stroke();
        r(33,20,6,3,'#716456');r(34,20,2,1,'#cab398');
      }else if(id.endsWith('-scythe')){
        const heavy=id==='great-scythe',dark=id==='dark-scythe';
        poly([[33,10],[37,11],[31,61],[27,61]],'#30242b');
        poly([[34,12],[36,12],[30,59],[28,59]],dark?'#725578':'#9d7047');
        poly([[36,8],[47,5],[60,8],[62,heavy?25:21],[56,17],[48,14],[37,16],[29,20],[28,16]],dark?'#504962':'#7b828d');
        poly([[31,17],[39,12],[52,10],[62,heavy?25:21],[57,13],[51,7],[41,7],[34,10]],dark?'#b490c8':'#d9d4c3');
        r(31,19,6,3,heavy?'#c99451':'#837787');
      }else if(id==='bow'){
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
  function gate(vertical,color,progress=0) {
    const c=surface(vertical?64:272,vertical?272:64),{g,r,poly}=brush(c);
    if(vertical){g.translate(64,0);g.rotate(Math.PI/2);}
    const slide=Math.min(1,Math.max(0,(progress-.12)/.88));
    const travel=Math.round(116*slide*slide*(3-2*slide));
    const seal=icon('seal','',color);
    g.save();g.beginPath();g.rect(16,0,240,64);g.clip();
    for(const [left,dir] of [[20,-1],[136,1]]){
      g.save();g.translate(dir*travel,0);g.beginPath();g.rect(left,0,116,64);g.clip();
      r(left,7,116,50,'#1c191f');r(left+2,11,112,42,'#413b40');
      for(let y=14;y<52;y+=12){
        for(let x=left-15+(y%24?9:0);x<left+116;x+=25){
          r(x,y,23,10,'#585057');r(x+1,y,21,2,'#756960');
          r(x+22,y+2,1,7,'#383038');
        }
      }
      r(left+1,9,114,4,'#9a8673');r(left+1,51,114,4,'#675752');
      r(dir<0?132:136,10,4,43,'#2f282e');
      g.globalAlpha=Math.max(0,1-Math.max(0,(progress-.09)*1.28));
      g.drawImage(seal,111,6,50,50);g.restore();
    }
    g.restore();
    for(const x of [1,249]){
      r(x,3,22,58,'#24202a');r(x+3,5,17,52,'#4a444c');
      r(x+4,7,14,6,'#938176');r(x+2,48,18,8,'#675a56');
      r(x+6,16,10,28,'#302b32');r(x+8,18,6,24,'#585057');
      poly([[x+11,20],[x+15,27],[x+11,35],[x+7,27]],color+(progress>=1?'55':'bb'));
    }
    return c;
  }
  function crackedFurniture(bitmap){
    const c=surface(bitmap.width,bitmap.height),{g}=brush(c);
    g.drawImage(bitmap,0,0);g.globalCompositeOperation='source-atop';
    for(const [dx,dy] of [[0,0],[23,6]]){
      g.beginPath();g.moveTo(44+dx,26+dy);g.lineTo(54+dx,35+dy);
      g.lineTo(52+dx,41+dy);g.lineTo(64+dx,48+dy);
      g.lineWidth=2.5;g.strokeStyle='#2e1c19';g.stroke();
    }
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
  function houseDoor(style,light,span,open){
    const width=Math.round(span*SIZE/48),c=surface(width,78),{r,poly}=brush(c);
    const left=Math.max(3,Math.round((width-52)/2)),right=width-left,center=width/2;
    const trim=style==='limestone'?'#918276':style==='brick'?'#7a5654':'#715645';
    const edge=light==='day'?'#a78b71':'#69596a',base=style==='brick'?'#744b41':'#71503d';
    const shadow=light==='day'?'#302634':'#231f2e';
    if(style==='limestone')poly([[left,67],[left,20],[center-12,11],[center+12,11],[right,20],[right,67]],trim);
    else r(left,12,right-left,55,trim);
    r(left+4,21,right-left-8,46,shadow);r(left+3,20,3,48,edge);r(right-6,20,3,48,edge);
    r(left+6,19,right-left-12,3,edge);
    if(open){
     poly([[left+6,22],[center-4,30],[center-4,64],[left+6,66]],base);
     r(left+7,25,2,39,edge);r(center-9,47,3,3,'#b99567');
     r(center,59,right-center-6,8,'#9b6c4566');
    }else{
     r(left+6,23,right-left-12,43,base);
     for(let x=left+9;x<right-7;x+=7){r(x,24,2,40,'#52382f');r(x+2,24,1,39,'#a078583d');}
     r(left+7,30,right-left-14,3,'#473b40');r(left+7,58,right-left-14,3,'#473b40');
     r(right-16,44,6,6,'#af8a5d');r(right-15,46,3,3,'#634d45');
    }
    r(left-2,66,right-left+4,3,edge);r(left-2,69,right-left+4,3,shadow);
    return c;
  }
  const urls=new Map();
  function url(type,id,color){
    const key=[type,id,color].join('/');
    if(!urls.has(key))urls.set(key,icon(type,id,color).toDataURL());
    return urls.get(key);
  }
  return {world,furniture,partition,actor,icon,gate,crackedFurniture,woodenDoor,houseDoor,url};
})();
