create schema if not exists mind_dungeon_private;
revoke all on schema mind_dungeon_private from public, anon;
grant usage on schema mind_dungeon_private to authenticated;

create table mind_dungeon_private.coop_rooms (
 code text primary key,
 host uuid not null references auth.users(id) on delete cascade,
 guest uuid references auth.users(id) on delete cascade,
 mode text not null check (mode in ('same','own')),
 host_pack text not null,
 guest_pack text,
 seed integer not null,
 floor smallint not null default 1 check (floor between 1 and 5),
 started boolean not null default false,
 host_state jsonb,
 guest_state jsonb,
 host_seen timestamptz not null default now(),
 guest_seen timestamptz,
 updated_at timestamptz not null default now(),
 check (host <> guest)
);
create index coop_rooms_cleanup on mind_dungeon_private.coop_rooms(updated_at);
create table mind_dungeon_private.coop_events (
 code text not null references mind_dungeon_private.coop_rooms(code) on delete cascade,
 floor smallint not null,
 seq bigint generated always as identity,
 seat smallint not null check (seat in (1,2)),
 token uuid not null,
 data jsonb not null,
 primary key (code, token)
);
create index coop_events_receiver on mind_dungeon_private.coop_events(code,floor,seat,seq);
create table mind_dungeon_private.coop_drops (
 code text not null references mind_dungeon_private.coop_rooms(code) on delete cascade,
 floor smallint not null,
 id uuid not null,
 seat smallint not null check (seat between 0 and 2),
 x double precision not null check (x between 0 and 3500),
 y double precision not null check (y between 0 and 3500),
 item jsonb not null,
 claimed uuid,
 primary key(code,floor,id)
);
alter table mind_dungeon_private.coop_rooms enable row level security;
alter table mind_dungeon_private.coop_events enable row level security;
alter table mind_dungeon_private.coop_drops enable row level security;
revoke all on all tables in schema mind_dungeon_private from public,anon,authenticated;

create function mind_dungeon_private.coop_call(p_action text, p_code text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 room mind_dungeon_private.coop_rooms%rowtype;
 loot mind_dungeon_private.coop_drops%rowtype;
 code_value text := upper(coalesce(p_code,''));
 player_seat smallint;
 pack text;
 e jsonb;
 peer jsonb;
 result jsonb;
 current_floor integer;
 px double precision;
 py double precision;
 batch jsonb;
 pair jsonb;
begin
 if uid is null then raise exception 'Bitte zuerst anmelden'; end if;
 if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data)>440000 then
   raise exception 'Ungültige Koop-Daten';
 end if;
 if p_action in ('create','join') then
   pack := p_data->>'pack';
   if pack is distinct from 'kvt3-konfrontationsverfahren' and not exists
     (select 1 from public.question_packs q where q.user_id=uid and q.pack_id=pack and q.data is not null) then
     raise exception 'Dieses Fragenpaket ist in deinem Konto nicht verfügbar';
   end if;
 end if;
 if p_action='create' then
   delete from mind_dungeon_private.coop_rooms where updated_at < now()-interval '6 hours';
   select * into room from mind_dungeon_private.coop_rooms
    where host=uid and not started and updated_at>now()-interval '10 seconds' order by updated_at desc limit 1;
   if found then return jsonb_build_object('code',room.code,'seat',1,'mode',room.mode,'started',false,'floor',room.floor,'seed',room.seed,'ready',room.guest is not null); end if;
   loop
     code_value:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
     insert into mind_dungeon_private.coop_rooms(code,host,mode,host_pack,seed)
       values(code_value,uid,p_data->>'mode',pack,(p_data->>'seed')::integer)
       on conflict(code) do nothing returning * into room;
     exit when found;
   end loop;
   return jsonb_build_object('code',room.code,'seat',1,'mode',room.mode,'started',false,'floor',1,'seed',room.seed,'ready',false);
 end if;

 if code_value !~ '^[0-9A-F]{8}$' then raise exception 'Lobbycode ungültig'; end if;
 select * into room from mind_dungeon_private.coop_rooms r where r.code=code_value and r.updated_at>now()-interval '6 hours' for update;
 if not found then raise exception 'Lobby nicht gefunden oder abgelaufen'; end if;
 if p_action='join' and room.host<>uid and room.guest is distinct from uid then
   if room.guest is not null or room.started then raise exception 'Diese Lobby ist bereits voll'; end if;
   update mind_dungeon_private.coop_rooms set guest=uid,guest_pack=pack,guest_seen=now(),updated_at=now()
     where code=code_value returning * into room;
 end if;
 if room.host=uid then player_seat:=1;
 elsif room.guest=uid then player_seat:=2;
 else raise exception 'Du bist kein Mitglied dieser Lobby'; end if;

 if p_action='leave' then
   if player_seat=1 or room.started then
     delete from mind_dungeon_private.coop_rooms where code=code_value;
   else
     update mind_dungeon_private.coop_rooms set guest=null,guest_pack=null,guest_state=null,guest_seen=null where code=code_value;
   end if;
   return jsonb_build_object('left',true);
 elsif p_action='start' then
   if player_seat<>1 or room.guest is null then raise exception 'Zum Start sind zwei Spieler nötig'; end if;
   if not room.started then
     update mind_dungeon_private.coop_rooms set started=true,updated_at=now() where code=code_value returning * into room;
   end if;
 elsif p_action='deck' then
   if not room.started then raise exception 'Die Lobby wurde noch nicht gestartet'; end if;
   pack:=case when room.mode='same' or player_seat=1 then room.host_pack else room.guest_pack end;
   if pack<>'kvt3-konfrontationsverfahren' then
     select q.data into result from public.question_packs q
      where q.user_id=case when room.mode='same' or player_seat=1 then room.host else room.guest end and q.pack_id=pack;
     if result is null then raise exception 'Das ausgewählte Fragenpaket wurde entfernt'; end if;
   end if;
   return jsonb_build_object('pack',pack,'data',result);
 elsif p_action='advance' then
   if player_seat<>1 or not room.started or room.floor>=5 or coalesce((p_data->>'floor')::integer,0)<>room.floor then
     raise exception 'Ebenenwechsel nicht möglich';
   end if;
   update mind_dungeon_private.coop_rooms set floor=floor+1,seed=(p_data->>'seed')::integer,host_state=null,guest_state=null,updated_at=now()
    where code=code_value returning * into room;
 elsif p_action in ('sync','drop','take') then
   if not room.started then raise exception 'Die Lobby wurde noch nicht gestartet'; end if;
   current_floor:=coalesce((p_data->>'floor')::integer,0);
   if p_action<>'sync' and current_floor<>room.floor then raise exception 'Die Ebene wurde gewechselt'; end if;
   if p_action='sync' and current_floor=room.floor then
     if jsonb_typeof(p_data->'state')='object' then
       if player_seat=1 then
         update mind_dungeon_private.coop_rooms set host_state=p_data->'state',host_seen=now(),updated_at=now() where code=code_value returning * into room;
       else
         update mind_dungeon_private.coop_rooms set guest_state=p_data->'state',guest_seen=now(),updated_at=now() where code=code_value returning * into room;
       end if;
     end if;
     batch:=coalesce(p_data->'events','[]'::jsonb);
     if jsonb_typeof(batch)<>'array' or jsonb_array_length(batch)>45 then raise exception 'Zu viele Koop-Ereignisse'; end if;
     for e in select value from jsonb_array_elements(batch) loop
       if e->>'kind' in ('hit','gate','altar-wave','advance-request','ambush') or (e->>'kind'='hurt' and player_seat=1) then
         insert into mind_dungeon_private.coop_events(code,floor,seat,token,data)
          values(code_value,room.floor,player_seat,(e->>'token')::uuid,e) on conflict(code,token) do nothing;
       end if;
     end loop;
     batch:=coalesce(p_data->'pairs','[]'::jsonb);
     if jsonb_typeof(batch)<>'array' or jsonb_array_length(batch)>40 then raise exception 'Zu viele Seelenbälle'; end if;
     if player_seat=1 then
       for pair in select value from jsonb_array_elements(batch) loop
         if jsonb_typeof(pair)<>'array' or jsonb_array_length(pair)<>2 or
            pair->0->>'seat' is distinct from '1' or pair->1->>'seat' is distinct from '2' then
           raise exception 'Gegnerbeute braucht einen Seelenball pro Person';
         end if;
         insert into mind_dungeon_private.coop_drops(code,floor,id,seat,x,y,item)
           select code_value,room.floor,(v->>'id')::uuid,(v->>'seat')::smallint,(v->>'x')::double precision,(v->>'y')::double precision,v->'item'
           from jsonb_array_elements(pair) as drop_rows(v)
           on conflict(code,floor,id) do nothing;
       end loop;
     end if;
   elsif p_action='drop' then
     if jsonb_typeof(p_data->'item') is distinct from 'object' or pg_column_size(p_data->'item')>12000 or
        coalesce(p_data->'item'->>'kind','') not in ('food','potion','cup','weapon','armor','ring') then
       raise exception 'Dieser Gegenstand kann nicht abgelegt werden';
     end if;
     insert into mind_dungeon_private.coop_drops(code,floor,id,seat,x,y,item)
       values(code_value,room.floor,(p_data->>'id')::uuid,0,(p_data->>'x')::double precision,(p_data->>'y')::double precision,p_data->'item')
       on conflict(code,floor,id) do nothing;
     return jsonb_build_object('ok',true);
   elsif p_action='take' then
     select * into loot from mind_dungeon_private.coop_drops d
       where d.code=code_value and d.floor=room.floor and d.id=(p_data->>'id')::uuid for update;
     if not found or loot.seat not in (0,player_seat) or loot.claimed is not null and loot.claimed<>uid then
       return jsonb_build_object('item',null);
     end if;
     if loot.claimed is null then
       px:=(p_data->>'x')::double precision; py:=(p_data->>'y')::double precision;
       if px is null or py is null or ((loot.x-px)^2+(loot.y-py)^2)>75^2 then return jsonb_build_object('item',null); end if;
       update mind_dungeon_private.coop_drops set claimed=uid where code=code_value and floor=room.floor and id=loot.id;
     end if;
     return jsonb_build_object('item',loot.item);
   end if;
 elsif p_action not in ('join','status') then raise exception 'Unbekannte Koop-Aktion';
 end if;

 result:=jsonb_build_object('code',room.code,'seat',player_seat,'mode',room.mode,'started',room.started,'floor',room.floor,'seed',room.seed,
   'ready',room.guest is not null,'pack',case when room.mode='same' or player_seat=1 then room.host_pack else room.guest_pack end);
 if p_action='sync' and current_floor=room.floor then
   peer:=case when player_seat=1 then room.guest_state else room.host_state end;
   result:=result||jsonb_build_object('peer',peer,'peerOnline',
     coalesce((case when player_seat=1 then room.guest_seen else room.host_seen end)>now()-interval '9 seconds',false),
     'events',coalesce((select jsonb_agg(t.data||jsonb_build_object('seq',t.seq) order by t.seq)
       from (select seq,data from mind_dungeon_private.coop_events e2 where e2.code=code_value and e2.floor=room.floor and e2.seat<>player_seat
             and e2.seq>coalesce((p_data->>'cursor')::bigint,0) order by e2.seq limit 140) t),'[]'::jsonb),
     'loot',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'seat',d.seat,'x',d.x,'y',d.y,'item',d.item))
       from mind_dungeon_private.coop_drops d where d.code=code_value and d.floor=room.floor and d.seat in (0,player_seat) and d.claimed is null),'[]'::jsonb));
 end if;
 return result;
end;
$$;
revoke all on function mind_dungeon_private.coop_call(text,text,jsonb) from public, anon;
grant execute on function mind_dungeon_private.coop_call(text,text,jsonb) to authenticated;

create function public.mind_coop(p_action text, p_code text default '', p_data jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select mind_dungeon_private.coop_call(p_action,p_code,p_data); $$;
revoke all on function public.mind_coop(text,text,jsonb) from public, anon;
grant execute on function public.mind_coop(text,text,jsonb) to authenticated;
