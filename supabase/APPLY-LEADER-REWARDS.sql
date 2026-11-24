-- 기존 포인트·교환 내역을 보존하고, 이후 완료되는 모임부터 적용합니다.
begin;
select pg_advisory_xact_lock(73194628);
alter table public.gd_walk_rewards add column if not exists leader_bonus integer not null default 0;
alter table public.gd_walk_rewards drop constraint if exists gd_walk_rewards_points_check;
alter table public.gd_walk_rewards add constraint gd_walk_rewards_points_check check(points between 0 and 150);
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.gd_walk_rewards'::regclass and conname='gd_leader_bonus_valid') then
  alter table public.gd_walk_rewards add constraint gd_leader_bonus_valid check(leader_bonus between 0 and 50 and leader_bonus<=points);
 end if;
end $$;

create or replace function public.gd_award_walk_completion() returns trigger
language plpgsql security definer set search_path=public as $$
declare member record; meters integer; used_today bigint; base_award integer; bonus integer; owner_id uuid; real_order boolean;
begin
 perform pg_advisory_xact_lock(73194628);
 if new.phase<>'completed' or old.phase='completed' then return new; end if;
 if exists(select 1 from gd_participations a left join gd_order_people p on p.post_id=a.post_id and p.user_id=a.user_id
   where a.post_id=new.post_id and a.status='accepted' and p.received_at is null) then return new; end if;
 if (select count(*) from gd_participations where post_id=new.post_id and status='accepted')<2 then return new; end if;
 select p.owner_id into owner_id from gd_posts p where p.id=new.post_id;
 real_order:=gd_real_order(new.post_id);
 for member in select a.user_id,t.is_virtual,w.meters from gd_participations a join gd_testers t on t.user_id=a.user_id
   left join gd_walk_plans w on w.post_id=a.post_id and w.user_id=a.user_id where a.post_id=new.post_id and a.status='accepted'
 loop
  if exists(select 1 from gd_walk_rewards where post_id=new.post_id and user_id=member.user_id) then continue; end if;
  meters:=case when new.nearby_agreed and new.nearby_requester=member.user_id then 0 else coalesce(member.meters,0) end;
  select coalesce(sum(points),0) into used_today from gd_walk_rewards where user_id=member.user_id
    and (awarded_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date;
  base_award:=least(20+meters/5,greatest(0,200-used_today));
  bonus:=case when member.user_id=owner_id and not member.is_virtual and real_order
    then least(50,greatest(0,200-used_today-base_award)) else 0 end;
  insert into gd_walk_rewards(post_id,user_id,meters,points,rule_version,leader_bonus)
    values(new.post_id,member.user_id,meters,base_award+bonus,3,bonus) on conflict do nothing;
 end loop;
 return new;
end; $$;
create or replace function public.gd_point_wallet()
returns table(balance bigint,earned bigint,spent bigint,today_earned bigint,rule_version integer)
language sql stable security definer set search_path=public as $$
 select a.amount-b.amount,a.amount,b.amount,
 (select coalesce(sum(w.points),0) from gd_walk_rewards w where w.user_id=auth.uid()
   and (w.awarded_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date),3
 from (select coalesce(sum(points),0) amount from gd_walk_rewards where user_id=auth.uid()) a,
 (select coalesce(sum(cost),0) amount from gd_point_redemptions where user_id=auth.uid() and status<>'cancelled') b
 where gd_is_tester();
$$;
revoke all on function public.gd_award_walk_completion() from public,anon,authenticated;
revoke all on function public.gd_point_wallet() from public,anon;
grant execute on function public.gd_point_wallet() to authenticated;
notify pgrst,'reload schema';
commit;
select '리더 추가 포인트 업데이트 적용 완료' as "확인";
