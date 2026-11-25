(function(root){'use strict';
const node=(floor,room)=>String(floor)+':'+String(room),edgeKey=(floor,a,b)=>String(floor)+':'+String(a)+'>'+String(b);
function analyze({rooms,doors,verticalLinks=[],count=1,startFloor=0,startRoom=0,blockedEdges=[]}){
 const ids=rooms.map(r=>r.id),known=new Set(ids),adj=new Map(),blocked=new Set();
 for(const e of blockedEdges){blocked.add(edgeKey(e.floor,e.from,e.to));blocked.add(edgeKey(e.floor,e.to,e.from));}
 const add=id=>{if(!adj.has(id))adj.set(id,[]);},link=(a,b)=>{add(a);add(b);adj.get(a).push(b);adj.get(b).push(a);};
 for(let floor=0;floor<count;floor++)for(const id of ids)add(node(floor,id));
 for(let floor=0;floor<count;floor++)for(const door of doors){if(!known.has(door.from)||!known.has(door.to)||blocked.has(edgeKey(floor,door.from,door.to)))continue;link(node(floor,door.from),node(floor,door.to));}
 for(const edge of verticalLinks){if(!Number.isInteger(edge.fromFloor)||!Number.isInteger(edge.toFloor)||!known.has(edge.fromRoom)||!known.has(edge.toRoom)||edge.fromFloor<0||edge.toFloor<0||edge.fromFloor>=count||edge.toFloor>=count)continue;link(node(edge.fromFloor,edge.fromRoom),node(edge.toFloor,edge.toRoom));}
 const start=node(startFloor,startRoom),reachable=new Set(),previous=new Map();
 if(adj.has(start)){const queue=[start];reachable.add(start);previous.set(start,null);for(let i=0;i<queue.length;i++)for(const next of adj.get(queue[i]))if(!reachable.has(next)){reachable.add(next);previous.set(next,queue[i]);queue.push(next);}}
 const pathTo=target=>{const key=node(target.floor,target.room);if(!reachable.has(key))return null;const path=[];for(let at=key;at!==null;at=previous.get(at))path.push(at);return path.reverse();};
 return {reachable,previous,pathTo,start,adjacency:adj};
}
function validate({rooms,doors,verticalLinks=[],count=1,startFloor=0,startRoom=0,levers=[],gates=[]}){
 const blockedEdges=gates.map(g=>({floor:g.floor,from:g.from,to:g.to})),graph=analyze({rooms,doors,verticalLinks,count,startFloor,startRoom,blockedEdges});
 const missingLever=gates.length>0&&levers.length===0;
 const unreachableLevers=levers.filter(l=>!graph.reachable.has(node(l.floor,l.room))||l.localReachable===false).map(l=>({id:l.id,floor:l.floor,room:l.room,reason:l.localReachable===false?'Hebelposition im Raum selbst nicht erreichbar':'Nur über ein geschlossenes Fallgitter erreichbar'}));
 const invalidGates=gates.filter(g=>!doors.some(d=>d.from===g.from&&d.to===g.to));
 const ok=!missingLever&&!unreachableLevers.length&&!invalidGates.length&&graph.reachable.has(graph.start);
 let reason='';if(missingLever)reason='Fallgitter vorhanden, aber kein Hebel platziert';else if(unreachableLevers.length)reason='Mindestens ein Hebel ist bei geschlossenen Fallgittern nicht erreichbar';else if(invalidGates.length)reason='Mindestens ein Fallgitter liegt nicht auf einer gültigen Raumverbindung';else if(!graph.reachable.has(graph.start))reason='Startkammer fehlt im Raumgraphen';
 return {ok,reason,missingLever,unreachableLevers,invalidGates,reachable:[...graph.reachable],blockedEdges,leverPaths:levers.map(l=>({id:l.id,path:graph.pathTo(l)})),gateCount:gates.length,leverCount:levers.length};
}
const api=Object.freeze({node,edgeKey,analyze,validate});root.AlleyProgression=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:{});
