(() => {
 'use strict';

 const {project,unproject,width,height,footOffset,create:createArt,shortestRoute}=window.AlleyStudy;
 const tile=window.DungeonWorld.TILE;
 const radius=window.DungeonWorld.HERO_RADIUS;
 const unit=([u,v])=>({x:u*tile,y:v*tile});
 const toView=(x,y,z=0)=>{
  const [px,py]=project(x/tile,y/tile,z);
  return {x:px,y:py};
 };
 const toWorld=(x,y)=>unit(unproject(x,y-footOffset));
 const atOrigin=toView(0,0);
 function viewAngle(angle) {
  const point=toView(Math.cos(angle),Math.sin(angle));
  return Math.atan2(point.y-atOrigin.y,point.x-atOrigin.x);
 }
 function pointBetween(from,to,clear) {
  const d=Math.hypot(to.x-from.x,to.y-from.y);
  const steps=Math.max(1,Math.ceil(d/3));
  for(let i=1;i<=steps;i++){
   if(!clear(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps))return false;
  }
  return true;
 }
 function imageAt(size,draw){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  draw(canvas.getContext('2d'));
  return canvas;
 }
 function create(){
  const scene=window.AlleyStudyMap,art=createArt(),map=scene.logic;
  const spawn=unit(map.spawn),chest=unit(map.stations.chest.at),archer=unit(map.encounter.archer);
  // These are the same ground footprints as the neutral props in the art pass.
  const props=[
   {kind:'chest',point:chest,half:[.26,.36]},
   {kind:'pickup-high',point:unit(map.stations['pickup-high'].at),half:[.43,.64]},
   {kind:'barrel',point:unit(map.barrel),half:[.23,.23]}
  ];
  const frontAngle=(map.stations.chest.front-1)*Math.PI/4;
  const goal={x:chest.x+Math.cos(frontAngle)*(.43*tile+radius),y:chest.y+Math.sin(frontAngle)*(.43*tile+radius)};
  function walkable(x,y,r=radius,includeProps=true){
   if(art.blockedGround(x/tile,y/tile,r/tile))return false;
   return !includeProps||props.every(({point,half:[a,b]})=>{
    const dx=Math.max(0,Math.abs(x-point.x)-a*tile),dy=Math.max(0,Math.abs(y-point.y)-b*tile);
    return Math.hypot(dx,dy)>r;
   });
  }
  const clearLine=(x,y,endX,endY)=>pointBetween({x,y},{x:endX,y:endY},(px,py)=>walkable(px,py,0));
  const clearSegment=(from,to)=>pointBetween(from,to,walkable);
  const pad=radius+4;
  const offsets=(x,y)=>[-pad,pad].flatMap(dx=>[-pad,pad].map(dy=>({x:x+dx,y:y+dy})));
  const corners=([u,v,r,b])=>[u,r].flatMap(x=>[v,b].flatMap(y=>offsets(x*tile,y*tile)));
  const gate=scene.art.foreground.arch,[u,v,r,b]=gate.area,[a,c]=gate.opening;
  const waypoints=[
   ...map.waypoints.map(unit),
   ...[...map.walkable,[u,v,r,a],[u,c,r,b]].flatMap(corners),
   ...props.flatMap(({point,half:[hw,hh]})=>
    [-1,1].flatMap(sx=>[-1,1].map(sy=>({x:point.x+sx*(hw*tile+pad),y:point.y+sy*(hh*tile+pad)}))))
  ].filter(({x,y})=>walkable(x,y));
  function nearestWalkable(goal){
   if(walkable(goal.x,goal.y))return goal;
   // A click just inside a wall or prop may land next to its footprint.
   for(let radius=4;radius<=36;radius+=4){
    for(let i=0;i<24;i++){
     const angle=i*Math.PI/12,x=goal.x+Math.cos(angle)*radius,y=goal.y+Math.sin(angle)*radius;
     if(walkable(x,y))return {x,y};
    }
   }
   return null;
  }
  function routeTo(start,target){
   const goal=nearestWalkable(target);
   if(!goal)return null;
   const steps=shortestRoute(start,goal,waypoints,clearSegment);
   return steps?{goal,steps}:null;
  }
  function canInteract(actor){
   return Math.hypot(actor.x-chest.x,actor.y-chest.y)<=88&&
    pointBetween(actor,chest,(x,y)=>walkable(x,y,0,false));
  }
  function cameraOrigin(player,cw,ch,zoom,lift){
   const target=toView(player.x,player.y,lift);
   const center=(point,view,extent)=>{
    const half=view/(2*zoom);
    return (half*2>=extent?extent/2:Math.min(extent-half,Math.max(half,point)))-view/2;
   };
   return {x:center(target.x,cw,width),y:center(target.y,ch,height)};
  }
  const ground=art.groundLayers().map((canvas,i)=>({canvas,x:0,y:0,depth:-4+i}));
  const atmosphere={canvas:art.overlayLayer(),x:0,y:0,depth:height+1};
  const scenery=props.flatMap(({kind,point})=>{
   const {x,y}=toView(point.x,point.y),size=104;
   return (kind==='chest'?[false,true]:[false]).map(completed=>{
    const canvas=imageAt(size,ctx=>{
     const screen=toView(point.x,point.y);
     ctx.translate(size/2-screen.x,size*.71-screen.y);
     art.drawProp(ctx,{kind,completed,x:screen.x,y:screen.y-footOffset},{height:.68,radius:.39},34);
    });
    return {canvas,x:x-size/2,y:y-size*.71,depth:y,complete:kind==='chest'?completed:null};
   });
  });
  function layers(player,opened){
   const {x,y}=toView(player.x,player.y);
   const buildings=art.structures(x,y-footOffset).map(({image,depth,alpha})=>({...image,depth:depth+footOffset,alpha}));
   return [...ground,...buildings,...scenery.map(prop=>({...prop,visible:prop.complete===null||prop.complete===opened})),atmosphere];
  }
  function addLayers(scene,player){
   return layers(player,false).map(({canvas,x,y,depth},index)=>{
    const key='alley-layer-'+index;
    scene.textures.addCanvas(key,canvas);
    return scene.add.image(x,y,key).setOrigin(0).setDepth(depth);
   });
  }
  function refreshLayers(images,player,opened){
   const current=layers(player,opened);
   images.forEach((image,i)=>{
    const {depth,alpha=1,visible=true}=current[i];
    image.setDepth(depth).setAlpha(alpha).setVisible(visible);
   });
  }
  function drawLayers(ctx,player,opened,actors){
   const ordered=layers(player,opened).filter(layer=>layer.visible!==false).concat(actors);
   ordered.sort((a,b)=>a.depth-b.depth);
   for(const layer of ordered){
    if(layer.draw){layer.draw();continue;}
    ctx.globalAlpha=layer.alpha??1;
    ctx.drawImage(layer.canvas,layer.x,layer.y);
    ctx.globalAlpha=1;
   }
  }
  return {spawn,chest,archer,walkable,clearLine,canInteract,routeTo,cameraOrigin,addLayers,refreshLayers,drawLayers,
   inEncounter:actor=>actor.x>=9.5*tile&&actor.y<map.encounter.entryV*tile,
   lootPosition:actor=>walkable(actor.x,actor.y,4)?{x:actor.x,y:actor.y}:archer,
   chestRoute:player=>shortestRoute(player,goal,waypoints,clearSegment),
   chestFacing:Math.atan2(chest.y-goal.y,chest.x-goal.x),
   clearStrike:(...points)=>Number(clearLine(...points))};
 }
 window.DungeonIsometric={create,toView,toWorld,viewAngle,width,height};
})();
