create function mind_dungeon_private.can_stream_coop_motion(p_topic text)
returns boolean
language sql stable security definer set search_path = ''
as $$
 select exists (
  select 1 from mind_dungeon_private.coop_rooms r
   where r.code=split_part(p_topic,':',2)
     and p_topic='mind-dungeon-motion:'||r.code||':'||r.floor
     and r.started and r.guest is not null
     and (select auth.uid()) in (r.host,r.guest)
     and r.updated_at>now()-interval '6 hours'
 );
$$;
revoke all on function mind_dungeon_private.can_stream_coop_motion(text) from public, anon;
grant execute on function mind_dungeon_private.can_stream_coop_motion(text) to authenticated;

create policy "Mind Dungeon lobby members can receive motion"
 on realtime.messages for select to authenticated
 using (extension='broadcast' and
        (select mind_dungeon_private.can_stream_coop_motion(realtime.topic())));

create policy "Mind Dungeon lobby members can send motion"
 on realtime.messages for insert to authenticated
 with check (extension='broadcast' and
             (select mind_dungeon_private.can_stream_coop_motion(realtime.topic())));
