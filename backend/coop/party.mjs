import {run,defaultPack,makePlayer} from './rules.mjs';
import {Simulation} from './simulation.mjs';
import {actions} from './actions.mjs';

function createFloor(room,depth,seed,players=[]){
 const sim=new Simulation(room.seed,players,{},depth,seed);
 sim.actions=actions(sim);
 room.floors.set(depth,sim);
 return sim;
}
export const getFloor=(room,member)=>room?.floors?.get(member?.floor);

export function startParty(room){
 room.floors=new Map();
 const players=[...room.members.values()].map(member=>{
  member.floor=1;
  member.player=makePlayer(member.seat,member.character,member.pack);
  member.player.online=Boolean(member.ws);
  return member.player;
 });
 createFloor(room,1,room.seed,players);
}
export function syncDifficulty(room,member){
 getFloor(room,member)?.adaptDifficulty();
}
export function advanceParty(room,member){
 const from=getFloor(room,member),depth=member.floor+1;
 const moving=[...room.members.values()].filter(m=>m.floor===member.floor&&m.player.online);
 const target=room.floors.get(depth)??createFloor(room,depth,
  run.differentLayoutSeed(from.state.dungeonSeed,from.floor.rooms,from.floor.gates));
 for(const m of moving){
  from.players=from.players.filter(p=>p!==m.player);
  target.players.push(m.player);
  m.floor=depth;m.force=true;
  target.resetAtRest(m.player,true);
 }
 from.adaptDifficulty();target.adaptDifficulty();
}
export function partyMetadata(room){
 const members=[...room.members.values()];
 const decks=members.map((m,i)=>m.pack.packId===run.DEFAULT_PACK||room.mode==='same'&&i===1?null:m.pack);
 return {seed:room.seed,mode:room.mode,members:members.map(m=>({id:m.id,seat:m.seat})),decks};
}
export function partyState(room){
 return {version:1,members:[...room.members.values()].map(m=>({floor:m.floor,awayAt:m.awayAt??getFloor(room,m).clock,player:Simulation.savePlayer(m.player)})),
  floors:[...room.floors.values()].map(sim=>sim.checkpoint())};
}
export function restoreParty(code,saved){
 const {meta,state,revision}=saved;
 if(state.version!==1)throw new Error('Dieser Spielstand benötigt eine andere Serverversion.');
 const {seed,mode}=meta;
 const room={code,seed,mode,members:new Map(),floors:new Map(),seen:Date.now(),revision,dirty:false};
 const bySeat=new Map();
 meta.members.forEach(({id,seat},i)=>{
  const pack=mode==='same'&&i===1?bySeat.get(1).pack:meta.decks[i]??defaultPack;
  const {player:stored,floor,awayAt}=state.members[i];
  const player=Simulation.loadPlayer(stored,pack);
  const member={id,seat,pack,floor,awayAt,player};
  room.members.set(id,member);bySeat.set(seat,member);
 });
 for(const savedFloor of state.floors){
  const {floor,dungeonSeed}=savedFloor.state;
  const players=[...room.members.values()].filter(m=>m.floor===floor).map(m=>m.player);
  createFloor(room,floor,dungeonSeed).restore(savedFloor,players,bySeat);
 }
 return room;
}
