create table public.question_packs (
 user_id uuid not null references auth.users(id) on delete cascade,
 pack_id text not null check (char_length(pack_id) between 1 and 200),
 data jsonb check (data is null or (jsonb_typeof(data) = 'object' and data->>'packId' = pack_id and jsonb_typeof(data->'questions') = 'array')),
 primary key (user_id, pack_id)
);
alter table public.question_packs enable row level security;
revoke all on public.question_packs from anon, authenticated;
grant select, insert, update on public.question_packs to authenticated;
create policy "read own question packs" on public.question_packs for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own question packs" on public.question_packs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own question packs" on public.question_packs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
comment on column public.question_packs.data is 'A null payload records removal and prevents an older character save from restoring the pack.';
