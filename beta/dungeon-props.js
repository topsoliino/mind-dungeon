// Poly Haven Treasure Chest (CC0) and original seals, baked in the dungeon camera.
window.DungeonPropAtlas=(()=>{
 const frames={
  "chest-0":[0, 0, 101, 99, 0.5, 0.744681, 1.00107, 0.980214],
  "chest-1":[105, 0, 102, 99, 0.496552, 0.744681, 1.008021, 0.980214],
  "chest-2":[211, 0, 102, 99, 0.503448, 0.744681, 1.008021, 0.980214],
  "chest-3":[317, 0, 102, 99, 0.496552, 0.744681, 1.008021, 0.980214],
  "chest-open-0":[423, 0, 112, 132, 0.45, 0.809524, 1.112299, 1.313904],
  "chest-open-1":[539, 0, 112, 132, 0.54375, 0.809524, 1.112299, 1.313904],
  "chest-open-2":[655, 0, 111, 117, 0.54717, 0.784431, 1.105348, 1.160963],
  "chest-open-3":[770, 0, 111, 116, 0.45283, 0.783133, 1.105348, 1.154011],
  "seal-2":[0, 136, 179, 253, 0.503906, 0.839779, 1.777778, 2.513889],
  "seal-3":[183, 136, 251, 289, 0.502793, 0.79661, 2.486111, 2.868056],
  "seal-4":[438, 136, 322, 325, 0.502174, 0.765086, 3.194444, 3.222222],
  "seal-5":[0, 465, 393, 359, 0.501779, 0.7393, 3.902778, 3.569444],
  "seal-6":[397, 465, 464, 396, 0.501508, 0.716431, 4.603279, 3.929797]
 };
 if(!window.AlleyGenerator?.enabled)return null;
 const image=new Image();
 image.src='beta/art/props/dungeon-props.webp?v=1';
 const ready=image.decode();
 function sprite(name,point,flip=false){
  if(!image.naturalWidth)return null;
  const [sx,sy,w,h,ox,oy,width,height]=frames[name];
  const unit=42*Math.SQRT2;
  return {image,key:'dungeon-prop-atlas',frame:name,sx,sy,w,h,x:point.x,y:point.y,
   width:width*unit,height:height*unit,originX:flip?1-ox:ox,originY:oy,depth:point.y,flip};
 }
 return {sprite,ready};
})();
