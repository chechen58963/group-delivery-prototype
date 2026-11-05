-- Run after restore-workflow.sql. Prototype estimates, no pedometer or cash redemption.
begin;
create table if not exists public.gd_walk_plans (
  post_id uuid not null references public.gd_posts(id) on delete cascade,
  user_id uuid not null references public.gd_testers(user_id),
  meters integer not null check(meters between 0 and 400),
  source text not null check(source in('map','manual')),
  updated_at timestamptz not null default now(), primary key(post_id,user_id)
);
create table if not exists public.gd_walk_rewards (
  post_id uuid not null references public.gd_posts(id),
  user_id uuid not null references public.gd_testers(user_id),
  meters integer not null check(meters between 0 and 400),
  points integer not null check(points in(0,100)),
  awarded_at timestamptz not null default now(),primary key(post_id,user_id)
);
alter table public.gd_walk_plans enable row level security;
alter table public.gd_walk_rewards enable row level security;
drop policy if exists gd_walk_plan_read on public.gd_walk_plans;
create policy gd_walk_plan_read on public.gd_walk_plans for select to authenticated using(public.gd_is_tester() and user_id=auth.uid());
drop policy if exists gd_walk_reward_read on public.gd_walk_rewards;
create policy gd_walk_reward_read on public.gd_walk_rewards for select to authenticated using(public.gd_is_tester() and user_id=auth.uid());
create or replace function public.gd_set_walk_plan(p_post uuid,p_meters integer,p_source text)
returns void language plpgsql security definer set search_path=public as $$
declare v_phase text;
begin
  if not public.gd_is_tester() then raise exception '로그인 후 예상 거리를 저장해 주세요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  if p_meters is null or p_meters not between 0 and 400 or p_source is null or p_source not in('map','manual') then raise exception '편도 예상 이동거리는 0~400m로 입력해 주세요.'; end if;
  select s.phase into v_phase from gd_order_states s join gd_participations a on a.post_id=s.post_id
    where s.post_id=p_post and a.user_id=auth.uid() and a.status='accepted' and a.active;
  if v_phase is null or v_phase not in('menu','payment','ordered','delivering','arrived') then raise exception '진행 중인 모임에서 수령 전에 저장할 수 있어요.'; end if;
  if exists(select 1 from gd_order_people where post_id=p_post and user_id=auth.uid() and received_at is not null) then raise exception '이미 수령한 모임의 예상 거리는 바꿀 수 없어요.'; end if;
  if exists(select 1 from gd_order_states where post_id=p_post and nearby_agreed and nearby_requester=auth.uid()) and p_meters<>0 then raise exception '내 근처에서 받기를 요청한 사람의 이동거리는 0m로 기록해요.'; end if;
  insert into gd_walk_plans(post_id,user_id,meters,source) values(p_post,auth.uid(),p_meters,p_source)
    on conflict(post_id,user_id) do update set meters=excluded.meters,source=excluded.source,updated_at=now();
end; $$;

create or replace function public.gd_award_walk_completion() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_plan record; v_before bigint; v_meters integer;
begin
  -- Serialise the per-account cumulative balance with order/receipt mutations.
  perform pg_advisory_xact_lock(73194628);
  if exists(select 1 from gd_participations a left join gd_order_people p on p.post_id=a.post_id and p.user_id=a.user_id
    where a.post_id=new.post_id and a.status='accepted' and p.received_at is null) then return new; end if;
  if (select count(*) from gd_participations where post_id=new.post_id and status='accepted')<2 then return new; end if;
  for v_plan in select w.* from gd_walk_plans w join gd_participations a on a.post_id=w.post_id and a.user_id=w.user_id
    where w.post_id=new.post_id and a.status='accepted'
  loop
    if exists(select 1 from gd_walk_rewards where post_id=v_plan.post_id and user_id=v_plan.user_id) then continue; end if;
    select coalesce(sum(meters),0) into v_before from gd_walk_rewards where user_id=v_plan.user_id;
    v_meters:=case when new.nearby_agreed and new.nearby_requester=v_plan.user_id then 0 else v_plan.meters end;
    insert into gd_walk_rewards(post_id,user_id,meters,points) values(v_plan.post_id,v_plan.user_id,v_meters,
      (((v_before+v_meters)/1000)-(v_before/1000))*100)
      on conflict(post_id,user_id) do nothing;
  end loop;
  return new;
end; $$;
drop trigger if exists gd_walk_on_completion on public.gd_order_states;
create trigger gd_walk_on_completion after update of phase on public.gd_order_states
  for each row when(new.phase='completed' and old.phase is distinct from new.phase)
  execute function public.gd_award_walk_completion();
revoke all on public.gd_walk_plans,public.gd_walk_rewards from anon,authenticated;
grant select on public.gd_walk_plans,public.gd_walk_rewards to authenticated;
revoke all on function public.gd_set_walk_plan(uuid,int,text) from public,anon;
grant execute on function public.gd_set_walk_plan(uuid,int,text) to authenticated;
revoke all on function public.gd_award_walk_completion() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
