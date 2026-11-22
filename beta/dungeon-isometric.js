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
 const toWorld=(x,y,z=0)=>unit(unproject(x,y+z-footOffset));
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
  if(window.RockyCoastPrison?.isExterior)
   return window.RockyCoastTerrain.create({tile,radius,toView,toWorld,viewAngle});
  const scene=window.AlleyStudyMap,art=createArt(),map=scene.logic,route=window.AlleyRoute;
  const procedural=Boolean(window.AlleyGenerator?.enabled);
  const vertical=procedural&&window.AlleyVertical?.enabled?window.AlleyVertical:null;
  const prison=window.RockyCoastPrison;
  const returnGate=prison?.enabled&&prison.entry==='from-upper'&&
   window.AlleyGenerator?.outdoorExit;
  // Floors 2-4 start INSIDE their own generated building, not in the
  // original outdoor alley or through an invisible/forbidden entrance.
  // The first interior corridor always occupies [12..,4..7].
  const innerSpawn=prison?.enabled&&prison.level>1&&prison.level<=4?
   {x:14.5*tile,y:5.5*tile}:null;
  const spawn=returnGate?{x:(returnGate.x-returnGate.dx*.70)*tile,
    y:(returnGate.y-returnGate.dy*.70)*tile}:innerSpawn||unit(map.spawn);
  const chest=unit(map.stations.chest.at),archer=unit(map.encounter.archer);
  // These are the same ground footprints as the neutral props in the art pass.
  const props=procedural?[]:[
   {kind:'chest',point:chest,half:[.26,.36]},
   {kind:'pickup-high',point:unit(map.stations['pickup-high'].at),half:[.43,.64]},
   {kind:'barrel',point:unit(map.barrel),half:[.23,.23]},
   {kind:'knowledge',point:unit(map.stations.knowledge.at),half:[.27,.24]},
   {kind:'apparatus',point:unit(map.stations.lab.at),half:[.40,.31]}
  ];
  const frontAngle=(map.stations.chest.front-1)*Math.PI/4;
  const goal={x:chest.x+Math.cos(frontAngle)*(.43*tile+radius),y:chest.y+Math.sin(frontAngle)*(.43*tile+radius)};
  function walkableOnFloor(x,y,floor=0,r=radius,includeProps=true){
   // Upper-floor slabs themselves are authoritative colliders. In seed 4148
   // a duplicate stair-overlap test rejected ~20 visibly painted deck cells.
   if(floor===1)return Boolean(vertical?.insideTop(x/tile,y/tile,r/tile));
   return groundWalkable(x,y,r,includeProps);
  }
  function walkable(x,y,r=radius,includeProps=true){
   return walkableOnFloor(x,y,vertical?.state.floor===1?1:0,r,includeProps);
  }
  const groundRouteWalk=(x,y)=>walkableOnFloor(x,y,0);
  const upperRouteWalk=(x,y)=>walkableOnFloor(x,y,1);
  const crouchRouteWalk=(x,y)=>walkableOnFloor(x,y,0);
  const floorPredicate=floor=>floor===1?upperRouteWalk:
   floor==='0-crouch'?crouchRouteWalk:groundRouteWalk;
  function groundWalkable(x,y,r=radius,includeProps=true){
   // Stair treads are physical geometry, not ordinary ground. The only
   // accessible gaps into the ribbon are the guarded foot and head.
   if(vertical?.blocksGround(x/tile,y/tile,r/tile))return false;
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
   ...[...map.walkable.slice(0,3),[u,v,r,a],[u,c,r,b]].flatMap(corners),
   ...props.flatMap(({point,half:[hw,hh]})=>
    [-1,1].flatMap(sx=>[-1,1].map(sy=>({x:point.x+sx*(hw*tile+pad),y:point.y+sy*(hh*tile+pad)}))))
  ].filter(({x,y})=>walkable(x,y));
  function nearestWalkable(goal,canWalk=walkable){
   if(canWalk(goal.x,goal.y))return goal;
   for(let radius=4;radius<=36;radius+=4){
    for(let i=0;i<24;i++){
     const angle=i*Math.PI/12,x=goal.x+Math.cos(angle)*radius,
      y=goal.y+Math.sin(angle)*radius;
     if(canWalk(x,y))return {x,y};
    }
   }
   return null;
  }
  function routeToFloor(start,target,floor=vertical?.state.floor===1?1:0){
   const canWalk=floorPredicate(floor),goal=nearestWalkable(target,canWalk);
   if(!goal)return null;
   if(procedural)return route.path(start,goal,canWalk,floor);
   const steps=shortestRoute(start,goal,waypoints,clearSegment);
   return steps?{goal,steps}:null;
  }
  function routeTo(start,target){
   return routeToFloor(start,target,vertical?.state.floor===1?1:
    vertical?.state.crouching?'0-crouch':0);
  }
  function clearLineOnFloor(x,y,endX,endY,floor){
   return pointBetween({x,y},{x:endX,y:endY},
    (px,py)=>walkableOnFloor(px,py,floor,0,false));
  }
  function canInteract(actor){
   if(procedural)return false;
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
  // Large generated maps are sliced into <=1536px tiles for GPU portability.
  const ground=art.groundLayers();
  const atmosphere=art.overlayLayers();
  const upperArchitecture=art.verticalLayers();
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
   // A level is a VISIBILITY GROUP, not a mostly transparent overlay.
   // Upper floors and upper-only fixtures are entirely hidden below. They
   // fade in near the last top-out frames (never before the landing).
   const crossing=vertical?.state.transition,stair=vertical?.state.stairRide;
   const liftProgress=crossing?crossing.age/crossing.duration:
    stair?stair.s/Math.max(.001,vertical.stairLength):0;
   // Stair visibility follows the actual height on the ribbon, not a
   // separate cutscene timer. The upper floor appears only at the crest.
   const reveal=stair?
     Math.max(0,Math.min(1,(liftProgress-.84)/.16)):
     crossing?
     (crossing.up?Math.max(0,Math.min(1,(liftProgress-.84)/.16)):
      Math.max(0,Math.min(1,(.18-liftProgress)/.18))):
     (vertical?.state.floor===1?1:0);
   const raised=Boolean(vertical&&(vertical.state.floor===1||vertical.state.stairRide||vertical.state.transition));
   const verticalObjects=upperArchitecture.map(part=>{
    const visible=part.level===0||reveal>0;
    const alpha=part.level===1?reveal:1;
    // Treads and spiral pillars belong to the SAME sorting plane as the
    // Guardian while climbing. The previous 0-vs-7000 mismatch forced the
    // player in front of every step/column, regardless of physical position.
    const stairPart=part.kind==='stair-tread'||part.kind==='stair-landing'||part.kind==='stair-spindle';
    const depth=part.depth+(raised&&stairPart?7000:0);
    return {...part.image,depth,alpha,visible};
   });
   return [...ground,...buildings,...scenery.map(prop=>({...prop,visible:prop.complete===null||prop.complete===opened})),
    ...verticalObjects,...atmosphere];
  }
  function addLayers(scene,player){
   const images=layers(player,false).map(({canvas,x,y,depth},index)=>{
    const key='alley-layer-'+index;
    scene.textures.addCanvas(key,canvas);
    return scene.add.image(x,y,key).setOrigin(0).setDepth(depth);
   });
   art.onArtReady(()=>images.forEach(image=>image.texture.refresh()));
   return images;
  }
  // Layer canvases and structural depths never change once the seed is baked.
  // Re-evaluate wall occlusion only after meaningful movement, floor changes
  // or a visible portion of the upper-floor transition.
  let lastLayerRefresh=null;
  function refreshLayers(images,player,opened,view=null){
   const stair=vertical?.state.stairRide,cross=vertical?.state.transition;
   const stage=stair?'stair':cross?'ladder':'floor';
   const progress=stair?stair.s/Math.max(.001,vertical.stairLength):
    cross?cross.age/Math.max(.001,cross.duration):0;
   const floor=vertical?.state.floor??0;
   const old=lastLayerRefresh;
   if(old&&old.images===images&&old.opened===opened&&old.floor===floor&&
    old.stage===stage&&Math.hypot(old.x-player.x,old.y-player.y)<9&&
    Math.abs(old.progress-progress)<.025&&
    (!view||old.camera&&Math.abs(old.camera.x-view.x)<14&&
     Math.abs(old.camera.y-view.y)<14&&Math.abs(old.camera.zoom-(view.zoom||1))<.015))return;
   lastLayerRefresh={images,opened,floor,stage,progress,x:player.x,y:player.y,
    camera:view?{x:view.x,y:view.y,zoom:view.zoom||1}:null};
   const current=layers(player,opened);
   // Discard static wall/tread tiles outside the viewport before Phaser
   // submits them. A generous margin avoids seams while the camera moves.
   const pad=128,zoom=view?.zoom||1;
   const viewport=view?{left:view.x-pad,top:view.y-pad,
    right:view.x+view.width/zoom+pad,bottom:view.y+view.height/zoom+pad}:null;
   images.forEach((image,i)=>{
    const {depth,alpha=1,visible=true,x,y,canvas}=current[i];
    const inView=!viewport||!(x>viewport.right||y>viewport.bottom||
     x+canvas.width<viewport.left||y+canvas.height<viewport.top);
    const drawn=visible&&alpha>.001&&inView;
    if(image.depth!==depth)image.setDepth(depth);
    if(image.alpha!==alpha)image.setAlpha(alpha);
    if(image.visible!==drawn)image.setVisible(drawn);
   });
  }
  function drawLayers(ctx,player,opened,actors){
   const ordered=layers(player,opened).filter(layer=>layer.visible!==false).concat(actors);
   ordered.sort((a,b)=>a.depth-b.depth);
   // The Canvas fallback previously submitted EVERY baked building / floor
   // surface, even tens of rooms beyond the camera. On software GPUs
   // drawImage() for a huge off-screen transparent layer can still trigger
   // costly compositing. Cull BEFORE issuing a draw.
   const m=ctx.getTransform();
   const visible=m.a>0&&m.d>0?{
    left:-m.e/m.a-20,top:-m.f/m.d-20,
    right:(ctx.canvas.width-m.e)/m.a+20,
    bottom:(ctx.canvas.height-m.f)/m.d+20
   }:null;
   for(const layer of ordered){
    if(layer.draw){layer.draw();continue;}
    if(visible&&(layer.x>visible.right||layer.y>visible.bottom||
       layer.x+layer.canvas.width<visible.left||
       layer.y+layer.canvas.height<visible.top))continue;
    ctx.globalAlpha=layer.alpha??1;
    ctx.drawImage(layer.canvas,layer.x,layer.y);
    ctx.globalAlpha=1;
   }
  }
  // Bake both floor navigation graphs during scene loading, with the same
  // walkable/collision function that runtime right-click movement uses.
  if(procedural&&vertical&&typeof route.prewarm==='function'){
   const originalFloor=vertical.state.floor,oldCrouch=vertical.state.crouching;
   try{
    for(const floor of [0,1]){
     vertical.state.floor=floor;vertical.state.crouching=false;
     route.prewarm(floorPredicate(floor),floor);
    }
    vertical.state.floor=0;vertical.state.crouching=true;
    route.prewarm(crouchRouteWalk,'0-crouch');
   }finally{
    vertical.state.floor=originalFloor;vertical.state.crouching=oldCrouch;
   }
  }
  const knowledge=map.stations.knowledge?unit(map.stations.knowledge.at):spawn;
  const lab=map.stations.lab?unit(map.stations.lab.at):spawn;
  const nearStation=(actor,target)=>Math.hypot(actor.x-target.x,actor.y-target.y)<82&&
   pointBetween(actor,target,(x,y)=>walkable(x,y,0,false));
  return {spawn,chest,archer,knowledge,lab,walkable,walkableOnFloor,groundWalkable,
   clearLine,clearLineOnFloor,canInteract,routeTo,routeToFloor,cameraOrigin,addLayers,refreshLayers,drawLayers,
   vertical,
   enemies:{archive:(map.encounter.archive??[]).map(unit),lab:(map.encounter.lab??[]).map(unit)},
   archiveUnlocked:()=>route.isUnlocked(),unlockArchive:()=>route.unlock(),
   zoneAt:actor=>route.areaAt(actor.x/tile,actor.y/tile),
   nearKnowledge:actor=>!procedural&&nearStation(actor,knowledge),
   nearLab:actor=>!procedural&&nearStation(actor,lab),
   inEncounter:actor=>actor.x>=9.5*tile&&(actor.y<map.encounter.entryV*tile||actor.x>=14*tile),
   lootPosition:actor=>walkable(actor.x,actor.y,4,false)?{x:actor.x,y:actor.y}:archer,
   chestRoute:player=>procedural?null:shortestRoute(player,goal,waypoints,clearSegment),
   chestFacing:Math.atan2(chest.y-goal.y,chest.x-goal.x),
   clearStrike:(...points)=>Number(clearLine(...points))};
 }
 window.DungeonIsometric={create,toView,toWorld,viewAngle,width,height};
})();
