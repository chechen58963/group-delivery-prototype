-- 이용 흐름 개선 이후 전체 실행. 기존 주문과 송금/환불 내역은 보존합니다.
begin;
select pg_advisory_xact_lock(73194628);
alter table public.gd_order_states add column if not exists planned_order_at timestamptz;
alter table public.gd_order_states add column if not exists delivery_eta_start timestamptz;
alter table public.gd_order_states add column if not exists delivery_eta_end timestamptz;
alter table public.gd_order_people add column if not exists pickup_notice_seen_at timestamptz;
do $$ declare r record; v_time timestamptz; begin
  for r in select s.post_id,s.meeting_time,p.note from gd_order_states s join gd_posts p on p.id=s.post_id where s.planned_order_at is null loop
    begin v_time:=(r.note::jsonb->>'starts_at')::timestamptz; exception when others then v_time:=null; end;
    update gd_order_states set planned_order_at=coalesce(v_time,r.meeting_time) where post_id=r.post_id;
  end loop;
end $$;
create or replace function public.gd_seed_order_plan() returns trigger
language plpgsql security definer set search_path=public as $$ begin
  if new.planned_order_at is null then
    begin select (note::jsonb->>'starts_at')::timestamptz into new.planned_order_at from gd_posts where id=new.post_id; exception when others then new.planned_order_at:=null; end;
  end if;
  return new;
end $$;
drop trigger if exists gd_seed_order_plan on public.gd_order_states;
create trigger gd_seed_order_plan before insert on public.gd_order_states for each row execute function public.gd_seed_order_plan();

-- 수령 시각을 미리 확정하지 않아도 주문할 수 있게 기존 준비 검사를 수정합니다.
do $$ declare definition text; begin
  definition:=pg_get_functiondef('public.gd_order_ux_internal(text,uuid,jsonb)'::regprocedure);
  if definition like '% or v_state.meeting_time is null%' then
    definition:=replace(definition,' or v_state.meeting_time is null','');
    definition:=replace(definition,'리더 계좌와 수령 장소·시간을 먼저 정해 주세요.','리더 계좌와 수령 장소를 먼저 정해 주세요.');
    execute definition;
  elsif definition like '%수령 장소·시간을 먼저%' then raise exception '기존 주문 함수의 버전을 확인해 주세요.';
  end if;
end $$;

create or replace function public.gd_order_action(p_action text,p_post uuid,p_data jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare s gd_order_states%rowtype; p gd_posts%rowtype; target uuid; a timestamptz; b timestamptz; ready timestamptz; seen timestamptz;
begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  select * into p from gd_posts where id=p_post;
  if not found then raise exception '모집을 찾을 수 없어요.'; end if;
  select * into s from gd_order_states where post_id=p_post;
  if p_action in('delivery-eta','pickup-notice-seen','late-report','order-plan') then
    if not exists(select 1 from gd_participations where post_id=p_post and user_id=auth.uid() and status='accepted' and active) then raise exception '참여 중인 모임에서 이용해 주세요.'; end if;
    if p_action='order-plan' then
      if p.owner_id<>auth.uid() or s.phase<>'menu' then raise exception '리더가 주문 확정 전에 예정 시간을 바꿀 수 있어요.'; end if;
      a:=(p_data->>'start')::timestamptz;b:=(p_data->>'end')::timestamptz;
      perform gd_update_room_time_checked(p_post,a,b,(p_data->>'expected')::timestamptz);
      update gd_order_states set planned_order_at=a,updated_at=clock_timestamp() where post_id=p_post;
      return;
    elsif p_action='delivery-eta' then
      if p.owner_id<>auth.uid() or s.phase not in('ordered','delivering') then raise exception '리더가 주문 후 예상 도착 시간을 안내할 수 있어요.'; end if;
      if p_data ? 'expected' and (p_data->>'expected')::timestamptz is distinct from s.updated_at then raise exception '진행 정보가 변경됐어요. 다시 확인해 주세요.'; end if;
      a:=(p_data->>'start')::timestamptz;b:=(p_data->>'end')::timestamptz;
      if (a is null)<>(b is null) or (a is not null and (b<a or b-a>interval '4 hours' or b<now() or b>now()+interval '1 day')) then raise exception '배달앱에서 확인한 앞으로의 예상 도착 범위를 입력해 주세요.'; end if;
      update gd_order_states set delivery_eta_start=a,delivery_eta_end=b,updated_at=clock_timestamp() where post_id=p_post;return;
    end if;
    ready:=case when s.pickup_mode='contactless' then s.pickup_dropped_at else s.arrived_at end;
    if s.phase<>'arrived' or ready is null then raise exception '음식을 받을 준비가 된 뒤 확인할 수 있어요.'; end if;
    if p_action='pickup-notice-seen' then
      update gd_order_people set pickup_notice_seen_at=coalesce(pickup_notice_seen_at,clock_timestamp()) where post_id=p_post and user_id=auth.uid();return;
    end if;
    target:=(p_data->>'user_id')::uuid;
    select pickup_notice_seen_at into seen from gd_order_people where post_id=p_post and user_id=target;
    if p.owner_id<>auth.uid() or target=p.owner_id or seen is null or now()<greatest(ready,seen)+interval '10 minutes' then raise exception '상대가 수령 안내를 확인한 뒤 10분이 지나야 확인을 요청할 수 있어요.'; end if;
    update gd_order_people set late_reported=true where post_id=p_post and user_id=target and received_at is null and exists(select 1 from gd_participations where post_id=p_post and user_id=target and status='accepted' and active);
    if not found then raise exception '수령 대기 중인 참가자가 아니에요.'; end if;return;
  end if;
  if p_action='review' and (not gd_real_order(p_post) or exists(select 1 from gd_testers where user_id=(p_data->>'user_id')::uuid and is_virtual)) then raise exception '함께 이용한 실제 참가자에게 후기를 남겨 주세요.'; end if;
  perform gd_order_ux_internal(p_action,p_post,p_data);
end $$;
revoke all on function public.gd_seed_order_plan() from public,anon,authenticated;
revoke all on function public.gd_order_action(text,uuid,jsonb) from public,anon;
grant execute on function public.gd_order_action(text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
select '주문 시간과 수령 기준 변경 완료' as "확인";
