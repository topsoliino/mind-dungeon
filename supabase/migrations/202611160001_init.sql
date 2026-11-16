create table if not exists public.item_catalog (
 id text primary key, kind text not null check(kind in ('weapon','ring')),
 name_de text not null, description_de text not null, icon text not null default '⚔',
 base_damage integer, reach integer, attack_seconds numeric, stamina_cost integer,
 scaling jsonb not null default '{}'::jsonb, effect jsonb not null default '{}'::jsonb,
 enabled boolean not null default true, updated_at timestamptz not null default now()
);
create table if not exists public.character_saves (
 user_id uuid not null references auth.users(id) on delete cascade,
 slot smallint not null default 1 check(slot between 1 and 3),
 data jsonb not null, revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 primary key(user_id,slot), constraint save_is_object check(jsonb_typeof(data)='object')
);
alter table public.item_catalog enable row level security;
alter table public.character_saves enable row level security;
create policy "catalog public read" on public.item_catalog for select to anon,authenticated using(enabled);
create policy "read own saves" on public.character_saves for select to authenticated using((select auth.uid())=user_id);
create policy "insert own saves" on public.character_saves for insert to authenticated with check((select auth.uid())=user_id);
create policy "update own saves" on public.character_saves for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "delete own saves" on public.character_saves for delete to authenticated using((select auth.uid())=user_id);
revoke all on public.item_catalog from anon,authenticated;
grant select on public.item_catalog to anon,authenticated;
grant select,insert,update,delete on public.character_saves to authenticated;