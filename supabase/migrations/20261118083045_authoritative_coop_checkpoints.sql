create schema mind_dungeon_checkpoints;
revoke all on schema mind_dungeon_checkpoints from public, anon, authenticated;
grant usage on schema mind_dungeon_checkpoints to anon;

create table mind_dungeon_checkpoints.credentials (
 singleton boolean primary key default true check (singleton),
 token_hash bytea not null check (octet_length(token_hash) = 32)
);
create table mind_dungeon_checkpoints.runs (
 code text primary key check (code ~ '^[A-F0-9]{8}$'),
 host uuid not null,
 guest uuid not null check (guest <> host),
 revision integer not null default 1 check (revision > 0),
 last_write uuid not null,
 metadata jsonb not null,
 checkpoint jsonb not null,
 updated_at timestamptz not null default now()
);
create index checkpoint_host_updated on mind_dungeon_checkpoints.runs (host, updated_at desc);
create index checkpoint_guest_updated on mind_dungeon_checkpoints.runs (guest, updated_at desc);
alter table mind_dungeon_checkpoints.credentials enable row level security;
alter table mind_dungeon_checkpoints.runs enable row level security;
revoke all on all tables in schema mind_dungeon_checkpoints from public, anon, authenticated;

create function mind_dungeon_checkpoints.access_run(
 p_action text, p_code text, p_player uuid, p_expected integer, p_write uuid, p_meta jsonb, p_state jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 token text := current_setting('request.headers', true)::jsonb ->> 'x-mind-coop-storage-token';
 result jsonb;
 existing_revision integer;
 existing_write uuid;
begin
 if token is null or length(token) <> 64 or not exists (
  select 1 from mind_dungeon_checkpoints.credentials c
   where c.token_hash = extensions.digest(token, 'sha256')
 ) then
  raise exception 'Invalid checkpoint credentials' using errcode = '42501';
 end if;

 if p_action = 'ready' then return 'true'::jsonb; end if;
 if p_action = 'list' then
  select coalesce(jsonb_agg(rows.summary order by rows.updated_at desc), '[]'::jsonb) into result
  from (
   select r.updated_at, jsonb_build_object('code', r.code, 'updatedAt', r.updated_at,
    'floor', r.checkpoint #> (case when r.host = p_player then '{members,0,floor}' else '{members,1,floor}' end)::text[]) as summary
   from mind_dungeon_checkpoints.runs r
   where r.host = p_player or r.guest = p_player
   order by r.updated_at desc limit 20
  ) rows;
  return result;
 end if;
 if p_action = 'load' then
  select jsonb_build_object('meta', r.metadata, 'state', r.checkpoint, 'revision', r.revision) into result
  from mind_dungeon_checkpoints.runs r where r.code = p_code and (r.host = p_player or r.guest = p_player);
  return result;
 end if;

 if p_action <> 'save' or p_action is null or p_write is null or p_expected is null or p_expected < 0
   or p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 4500000 then
  raise exception 'Invalid checkpoint';
 end if;
 if p_expected = 0 and p_meta is not null then
  if octet_length(p_meta::text) > 5500000 then raise exception 'Invalid checkpoint metadata'; end if;
  insert into mind_dungeon_checkpoints.runs(code, host, guest, last_write, metadata, checkpoint)
  values(p_code, (p_meta #>> '{members,0,id}')::uuid, (p_meta #>> '{members,1,id}')::uuid, p_write, p_meta, p_state)
  on conflict (code) do nothing
  returning revision into existing_revision;
 elsif p_expected > 0 then
  update mind_dungeon_checkpoints.runs r set revision = r.revision + 1, checkpoint = p_state,
   last_write = p_write, updated_at = now()
  where r.code = p_code and r.revision = p_expected returning r.revision into existing_revision;
 end if;
 if found and existing_revision is not null then
  return jsonb_build_object('revision', existing_revision);
 end if;
 select r.revision, r.last_write into existing_revision, existing_write
 from mind_dungeon_checkpoints.runs r where r.code = p_code;
 if existing_write = p_write then return jsonb_build_object('revision', existing_revision); end if;
 return '{"conflict":true}'::jsonb;
end;
$$;
revoke all on function mind_dungeon_checkpoints.access_run(text,text,uuid,integer,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function mind_dungeon_checkpoints.access_run(text,text,uuid,integer,uuid,jsonb,jsonb) to anon;

create function public.mind_coop_checkpoint(
 p_action text, p_code text default null, p_player uuid default null, p_expected integer default null,
 p_write uuid default null, p_meta jsonb default null, p_state jsonb default null
) returns jsonb language sql security invoker set search_path = '' as $$
 select mind_dungeon_checkpoints.access_run(p_action, p_code, p_player, p_expected, p_write, p_meta, p_state);
$$;
revoke all on function public.mind_coop_checkpoint(text,text,uuid,integer,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.mind_coop_checkpoint(text,text,uuid,integer,uuid,jsonb,jsonb) to anon;
