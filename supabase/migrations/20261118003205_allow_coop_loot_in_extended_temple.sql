alter table mind_dungeon_private.coop_drops
 drop constraint coop_drops_x_check,
 add constraint coop_drops_x_check check (x between 0 and 4608);
