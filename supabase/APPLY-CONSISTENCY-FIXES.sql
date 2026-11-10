-- Existing app update: run this entire file in Supabase SQL Editor.
-- Keeps existing rooms, confirmed payments, reward balances and product prices.
-- Requires setup.sql, menu-discovery.sql, distance-matching.sql and restore-workflow.sql already installed.
begin;
select pg_advisory_xact_lock(73194628);

-- platform-coupons.sql
-- Existing installations: run this file once in the Supabase SQL Editor.
-- Does not send money or rewrite completed/cancelled order amounts.

select pg_advisory_xact_lock(73194628);
-- Keep the funding source explicit so old clients cannot shift a platform coupon to the leader.
alter table public.gd_order_states add column if not exists coupon_funding text not null default 'leader' check(coupon_funding in('leader','platform'));
alter table public.gd_order_states alter column coupon_funding set default 'platform';
-- Restore the leader's original share on unpaid/unplaced legacy orders only.
with members as (
  select post_id,count(*)::int n from public.gd_participations where status='accepted' group by post_id
), repaired as (
  update public.gd_order_people x
  set fee=p.delivery_fee/m.n+p.delivery_fee%m.n
  from public.gd_posts p,public.gd_order_states s,members m
  where x.post_id=p.id and s.post_id=p.id and m.post_id=p.id and x.user_id=p.owner_id
    and s.coupon_funding='leader' and s.phase='payment' and p.status='closed' and not s.nearby_agreed
    and x.fee<>p.delivery_fee/m.n+p.delivery_fee%m.n
    and exists(select 1 from public.gd_order_people c where c.post_id=p.id and c.coupon_discount>0)
  returning x.post_id
)
update public.gd_order_states set leader_ready=false where post_id in(select post_id from repaired);
update public.gd_order_states s set coupon_funding='platform',reward_support=false
where s.phase in('menu','payment') and exists(select 1 from public.gd_posts p where p.id=s.post_id and p.status in('open','closed'));

create or replace function public.gd_order_action(p_action text,p_post uuid,p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_owner uuid; v_state gd_order_states%rowtype; v_post gd_posts%rowtype;
  v_target uuid; v_count int; v_total int; v_due int; v_discount int; v_rating numeric; v_trades bigint;
begin
  if not public.gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  select * into v_post from gd_posts where id=p_post for update;v_owner:=v_post.owner_id;
  if not found or not exists(select 1 from gd_participations where post_id=p_post and user_id=v_uid and status in('accepted','withdrawn')) then raise exception '이 모임의 참여자만 이용할 수 있어요.'; end if;
  insert into gd_order_states(post_id,meeting,phase) values(p_post,v_post.meeting,case when v_post.status='cancelled' then 'cancelled' when v_post.status='completed' then 'completed' else 'menu' end) on conflict do nothing;
  insert into gd_order_people(post_id,user_id) select post_id,user_id from gd_participations where post_id=p_post and status='accepted' on conflict do nothing;
  select * into v_state from gd_order_states where post_id=p_post;
  if p_action='initialize' then return; end if;
  v_target:=coalesce((p_data->>'user_id')::uuid,v_uid);
  select count(*) into v_count from gd_participations where post_id=p_post and status='accepted';
  if p_action in('refund-sent','refund-received') then
    if p_action='refund-sent' then
      if v_uid<>v_owner or v_target=v_owner then raise exception '주문 담당만 환불을 기록할 수 있어요.'; end if;
      update gd_order_people set refund_sent=true where post_id=p_post and user_id=v_target and refund_due>0;
    else
      update gd_order_people set refunded_amount=refunded_amount+refund_due,refund_due=0,refund_sent=false where post_id=p_post and user_id=v_uid and refund_sent;
    end if;
    if not found then raise exception '처리할 환불 내역이 없어요.'; end if;
    return;
  end if;
  if not exists(select 1 from gd_participations where post_id=p_post and user_id=v_uid and status='accepted') then raise exception '참여가 종료됐어요.'; end if;
  if p_action='review' then
    if v_state.phase<>'completed' or v_target=v_uid or not exists(select 1 from gd_participations where post_id=p_post and user_id=v_target and status='accepted') then raise exception '완료된 모임의 상대만 평가할 수 있어요.'; end if;
    insert into gd_reviews(post_id,reviewer_id,subject_id,stars,comment) values(p_post,v_uid,v_target,(p_data->>'stars')::int,btrim(coalesce(p_data->>'comment','')));
    return;
  elsif p_action='report' then
    if v_target=v_uid or not exists(select 1 from gd_participations where post_id=p_post and user_id=v_target and status='accepted') then raise exception '함께 참여한 상대를 선택해 주세요.'; end if;
    insert into gd_reports(post_id,reporter_id,subject_id,reason,detail) values(p_post,v_uid,v_target,btrim(p_data->>'reason'),btrim(coalesce(p_data->>'detail','')));return;
  elsif p_action='late-ack' then
    update gd_order_people set late_ack=true where post_id=p_post and user_id=v_uid and late_reported and not late_ack;
    if not found then raise exception '확인할 지각 기록이 없어요.'; end if;
    if (select count(*) from gd_order_people where user_id=v_uid and late_ack)>=2 then
      update gd_testers set suspended_until=greatest(coalesce(suspended_until,now()),now()+interval '3 days') where user_id=v_uid;
    end if;return;
  end if;
  if v_state.phase in('completed','cancelled') or v_post.status in('completed','cancelled') then raise exception '종료된 모임이에요.'; end if;
  if p_action='share-location' then
    if p_data->>'lat' is null or p_data->>'lng' is null then
      update gd_order_people set latitude=null,longitude=null where post_id=p_post and user_id=v_uid;
    else
      if not((p_data->>'lat')::float8 between -90 and 90 and (p_data->>'lng')::float8 between -180 and 180) then raise exception '위치를 확인해 주세요.'; end if;
      update gd_order_people set latitude=(p_data->>'lat')::float8,longitude=(p_data->>'lng')::float8 where post_id=p_post and user_id=v_uid;
    end if;return;
  elsif p_action='meeting' then
    if v_state.phase not in('menu','payment') then raise exception '주문 전에 수령 장소를 정해 주세요.'; end if;
    if char_length(btrim(coalesce(p_data->>'meeting',''))) not between 1 and 200 then raise exception '수령 장소를 입력해 주세요.'; end if;
    if ((p_data->>'lat' is null)<>(p_data->>'lng' is null)) or (p_data->>'lat' is not null and not((p_data->>'lat')::float8 between -90 and 90 and (p_data->>'lng')::float8 between -180 and 180)) then raise exception '수령 좌표를 확인해 주세요.'; end if;
    if v_state.nearby_agreed and btrim(p_data->>'meeting')<>v_state.nearby_address then raise exception '합의한 내 근처 수령 장소를 유지해 주세요.'; end if;
    update gd_order_states set meeting=btrim(p_data->>'meeting'),meeting_time=(p_data->>'time')::timestamptz,meeting_lat=(p_data->>'lat')::float8,meeting_lng=(p_data->>'lng')::float8,updated_at=now() where post_id=p_post;return;
  elsif p_action='nearby-propose' then
    if v_state.phase<>'menu' or v_count<>2 then raise exception '메뉴 확정 전 2인 모임에서 제안할 수 있어요.'; end if;
    if char_length(btrim(coalesce(p_data->>'address',''))) not between 1 and 200 then raise exception '집 근처의 공개 수령 장소를 적어 주세요.'; end if;
    update gd_order_states set nearby_requester=v_uid,nearby_address=btrim(p_data->>'address'),nearby_agreed=false,updated_at=now() where post_id=p_post;return;
  elsif p_action='nearby-agree' then
    if v_state.phase<>'menu' or v_count<>2 or v_state.nearby_requester is null or v_state.nearby_requester=v_uid then raise exception '상대의 제안만 동의할 수 있어요.'; end if;
    update gd_order_states set nearby_agreed=true,meeting=nearby_address,meeting_lat=null,meeting_lng=null,updated_at=now() where post_id=p_post;
    update gd_posts set status='closed' where id=p_post;
    update gd_participations set status='rejected',active=false where post_id=p_post and status='pending';return;
  elsif p_action='nearby-reset' then
    if v_state.phase<>'menu' then raise exception '메뉴 확정 전에 변경해 주세요.'; end if;
    update gd_order_states set nearby_requester=null,nearby_address=null,nearby_agreed=false where post_id=p_post;return;
  elsif p_action='claim-transfer' then
    if v_state.phase<>'payment' or v_uid=v_owner then raise exception '입금 대기 중인 참가자만 송금을 표시할 수 있어요.'; end if;
    update gd_order_people set claimed_amount=greatest(confirmed_amount,food_total+fee-coupon_discount+refunded_amount) where post_id=p_post and user_id=v_uid;return;
  elsif p_action='receive' then
    if v_state.phase<>'arrived' then raise exception '배달 도착 후에 수령을 확인해 주세요.'; end if;
    update gd_order_people set received_at=coalesce(received_at,now()) where post_id=p_post and user_id=v_uid;
    if not exists(select 1 from gd_participations a left join gd_order_people x on x.post_id=a.post_id and x.user_id=a.user_id where a.post_id=p_post and a.status='accepted' and x.received_at is null) then
      update gd_order_states set phase='completed',updated_at=now() where post_id=p_post;
      update gd_posts set status='completed' where id=p_post;update gd_participations set active=false where post_id=p_post;
      update gd_order_people set latitude=null,longitude=null where post_id=p_post;
    end if;return;
  elsif p_action='coupon' then
    if v_state.phase<>'payment' or v_state.coupon_funding<>'platform' or v_uid=v_owner or v_state.nearby_agreed then raise exception '송금 전 일반 모임에서 배프 지원 쿠폰을 사용할 수 있어요.'; end if;
    select r.rating,r.trades into v_rating,v_trades from gd_reputation() r where r.user_id=v_uid;
    if coalesce(v_rating,0)<4.8 or coalesce(v_trades,0)<5 or exists(select 1 from gd_order_people x join gd_order_states s on s.post_id=x.post_id where x.user_id=v_uid and x.coupon_discount>0 and s.phase<>'cancelled') then raise exception '쿠폰 사용 조건을 확인해 주세요.'; end if;
    if exists(select 1 from gd_order_people where post_id=p_post and (claimed_amount>0 or confirmed_amount>0)) then raise exception '송금 전에 쿠폰을 적용해 주세요.'; end if;
    update gd_order_people set coupon_discount=least(1000,fee) where post_id=p_post and user_id=v_uid and fee>0;
    if not found then raise exception '할인할 배달비가 없어요.'; end if;
    -- The platform funds the discount; no participant's delivery fee is increased.
    update gd_order_states set leader_ready=false,updated_at=now() where post_id=p_post;return;
  end if;
  if v_uid<>v_owner then raise exception '주문 담당만 처리할 수 있어요.'; end if;
  if p_action='account' then
    if v_state.phase<>'menu' then raise exception '메뉴 확정 전에 계좌를 정해 주세요.'; end if;
    if char_length(btrim(coalesce(p_data->>'bank',''))) not between 1 and 30 or char_length(btrim(coalesce(p_data->>'account',''))) not between 1 and 40 or char_length(btrim(coalesce(p_data->>'holder',''))) not between 1 and 30 then raise exception '은행, 계좌번호와 예금주를 확인해 주세요.'; end if;
    update gd_order_states set bank=btrim(p_data->>'bank'),account=btrim(p_data->>'account'),holder=btrim(p_data->>'holder'),reward_support=false,updated_at=now() where post_id=p_post;
  elsif p_action='finalize' then
    if v_state.phase<>'menu' or v_post.status<>'closed' or v_count<2 then raise exception '2명 이상 모여 모집을 마감한 뒤 확정해 주세요.'; end if;
    if v_state.bank='' or v_state.account='' or v_state.holder='' or v_state.meeting='' or v_state.meeting_time is null then raise exception '리더 계좌와 수령 장소·시간을 먼저 정해 주세요.'; end if;
    if exists(select 1 from gd_participations a left join gd_baskets b on b.post_id=a.post_id and b.user_id=a.user_id where a.post_id=p_post and a.status='accepted' and coalesce(b.total,0)<=0) then raise exception '모든 참여자가 메뉴를 저장해야 해요.'; end if;
    select sum(b.total) into v_total from gd_baskets b join gd_participations a on a.post_id=b.post_id and a.user_id=b.user_id where b.post_id=p_post and a.status='accepted';
    if v_total<v_post.min_order then raise exception '목표 주문금액을 아직 채우지 못했어요.'; end if;
    update gd_order_people x set food_total=b.total,fee=case when v_state.nearby_agreed then case when x.user_id=v_state.nearby_requester then v_post.delivery_fee else 0 end else v_post.delivery_fee/v_count+case when x.user_id=v_owner then v_post.delivery_fee%v_count else 0 end end,coupon_discount=0
      from gd_baskets b,gd_participations a where x.post_id=p_post and b.post_id=x.post_id and b.user_id=x.user_id and a.post_id=x.post_id and a.user_id=x.user_id and a.status='accepted';
    update gd_order_people x set refund_due=greatest(0,x.confirmed_amount-x.refunded_amount-x.food_total-x.fee),refund_sent=false where x.post_id=p_post and exists(select 1 from gd_participations a where a.post_id=x.post_id and a.user_id=x.user_id and a.status='accepted');
    update gd_order_states set phase='payment',leader_ready=false,updated_at=now() where post_id=p_post;
  elsif p_action='confirm-transfer' then
    if v_state.phase<>'payment' or v_target=v_owner then raise exception '입금 대기 상태를 확인해 주세요.'; end if;
    update gd_order_people set confirmed_amount=claimed_amount where post_id=p_post and user_id=v_target and claimed_amount>0;
    if not found then raise exception '상대가 송금 표시를 먼저 해야 해요.'; end if;
  elsif p_action='leader-ready' then
    if v_state.phase<>'payment' then raise exception '입금 대기 상태가 아니에요.'; end if;
    update gd_order_states set leader_ready=true where post_id=p_post;
  elsif p_action='order' then
    if v_state.phase<>'payment' or not v_state.leader_ready or exists(select 1 from gd_order_people x join gd_participations a on a.post_id=x.post_id and a.user_id=x.user_id where x.post_id=p_post and a.status='accepted' and x.user_id<>v_owner and x.confirmed_amount-x.refunded_amount<x.food_total+x.fee-x.coupon_discount) or exists(select 1 from gd_order_people where post_id=p_post and refund_due>0) then raise exception '전원 입금 확인과 환불 확인을 먼저 마쳐 주세요.'; end if;
    update gd_order_states set phase='ordered',updated_at=now() where post_id=p_post;
  elsif p_action='delivering' then
    if v_state.phase<>'ordered' then raise exception '주문 완료 다음에 배달 중으로 변경해 주세요.'; end if;
    update gd_order_states set phase='delivering',updated_at=now() where post_id=p_post;
  elsif p_action='arrive' then
    if v_state.phase not in('ordered','delivering') then raise exception '주문 후 도착을 확인해 주세요.'; end if;
    update gd_order_states set phase='arrived',arrived_at=now(),updated_at=now() where post_id=p_post;
  elsif p_action='late-report' then
    if v_state.phase<>'arrived' or now()<greatest(v_state.arrived_at,coalesce(v_state.meeting_time,v_state.arrived_at))+interval '10 minutes' or v_target=v_owner then raise exception '약속 시간과 배달 도착 후 10분이 지나야 확인할 수 있어요.'; end if;
    update gd_order_people set late_reported=true where post_id=p_post and user_id=v_target and received_at is null and exists(select 1 from gd_participations where post_id=p_post and user_id=v_target and status='accepted');
    if not found then raise exception '수령 대기 중인 참가자가 아니에요.'; end if;
  else raise exception '지원하지 않는 요청이에요.';
  end if;
end; $$;

revoke all on function public.gd_order_action(text,uuid,jsonb) from public,anon;
grant execute on function public.gd_order_action(text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';


-- walking-rewards.sql
-- Run after restore-workflow.sql. Prototype estimates, no pedometer or cash redemption.

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


-- points-shop.sql
-- Apply after walking-rewards.sql. Existing rewards retain their original amounts.

select pg_advisory_xact_lock(73194628);
alter table public.gd_walk_rewards drop constraint if exists gd_walk_rewards_points_check;
alter table public.gd_walk_rewards add constraint gd_walk_rewards_points_check check(points between 0 and 100);
alter table public.gd_walk_rewards add column if not exists rule_version integer not null default 1;
create table if not exists public.gd_point_products(
 id text primary key,name text not null,category text not null,description text not null,
 price integer not null check(price>0),symbol text not null,active boolean not null default true,sort_order integer not null default 0
);
insert into public.gd_point_products(id,name,category,description,price,symbol,sort_order) values
 ('coffee','카페 음료 교환권','음료','한 잔의 여유를 선물하세요.',3000,'coffee',1),
 ('convenience','편의점 모바일 상품권 1,000원','상품권','가까운 편의점에서 즐기는 작은 보상.',1000,'gift',2),
 ('icecream','아이스크림 교환권','간식','함께 주문한 뒤 달콤한 디저트 한 번.',2000,'icecream',3),
 ('culture','문화상품권 5,000원','상품권','차곡차곡 모은 포인트로 더 큰 즐거움.',5000,'culture',4),
 ('ebike','전기자전거 이용료 1,000원 할인권','이동','가까운 이동부터 등하교까지, 전기자전거 이용료를 아껴보세요.',1000,'ebike',5),
 ('escooter','전동킥보드 이용료 1,000원 할인권','이동','모아둔 포인트로 다음 전동킥보드 이동을 준비하세요.',1000,'escooter',6)
 on conflict(id) do nothing;
create table if not exists public.gd_point_redemptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.gd_testers(user_id),
 request_id uuid not null,product_id text not null references public.gd_point_products(id),
 product_name text not null,cost integer not null check(cost>0),
 status text not null default 'requested' check(status in('requested','fulfilled','cancelled')),
 voucher_code text,created_at timestamptz not null default now(),cancelled_at timestamptz,
 unique(user_id,request_id),check(status<>'fulfilled' or nullif(btrim(voucher_code),'') is not null)
);
alter table public.gd_point_products enable row level security;
alter table public.gd_point_redemptions enable row level security;
drop policy if exists gd_product_read on public.gd_point_products;
create policy gd_product_read on public.gd_point_products for select to authenticated using(public.gd_is_tester() and active);
drop policy if exists gd_redemption_read on public.gd_point_redemptions;
create policy gd_redemption_read on public.gd_point_redemptions for select to authenticated using(public.gd_is_tester() and user_id=auth.uid());
revoke all on public.gd_point_products,public.gd_point_redemptions from anon,authenticated;
grant select on public.gd_point_products,public.gd_point_redemptions to authenticated;

create or replace function public.gd_point_wallet()
returns table(balance bigint,earned bigint,spent bigint,today_earned bigint,rule_version integer)
language sql stable security definer set search_path=public as $$
 select a.amount-b.amount,a.amount,b.amount,
 (select coalesce(sum(w.points),0) from gd_walk_rewards w where w.user_id=auth.uid() and (w.awarded_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date),2
 from (select coalesce(sum(points),0) amount from gd_walk_rewards where user_id=auth.uid()) a,
 (select coalesce(sum(cost),0) amount from gd_point_redemptions where user_id=auth.uid() and status<>'cancelled') b
 where gd_is_tester();
$$;
create or replace function public.gd_redeem_points(p_product text,p_request uuid,p_expected integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare item gd_point_products%rowtype; result uuid; funds bigint;
begin
 if not gd_is_tester() then raise exception '로그인 후 교환해 주세요.'; end if;
 if p_request is null then raise exception '교환 요청을 확인해 주세요.'; end if;
 perform pg_advisory_xact_lock(73194628);
 select id into result from gd_point_redemptions where user_id=auth.uid() and request_id=p_request and product_id=p_product;
 if found then return result; end if;
 select * into item from gd_point_products where id=p_product and active;
 if not found then raise exception '현재 교환할 수 없는 상품이에요.'; end if;
 select balance into funds from gd_point_wallet();
 if p_expected is null or p_expected<>item.price then raise exception '상품의 필요 포인트가 변경됐어요. 상세창을 닫고 다시 확인해 주세요.'; end if;
 if funds<item.price then raise exception '포인트가 부족해요.'; end if;
 insert into gd_point_redemptions(user_id,request_id,product_id,product_name,cost)
 values(auth.uid(),p_request,item.id,item.name,item.price) returning id into result;
 return result;
end; $$;
create or replace function public.gd_cancel_point_redemption(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
 perform pg_advisory_xact_lock(73194628);
 update gd_point_redemptions set status='cancelled',cancelled_at=now() where id=p_id and user_id=auth.uid() and status='requested';
 if not found then raise exception '발급 대기 중인 내 교환 신청만 취소할 수 있어요.'; end if;
end; $$;

create or replace function public.gd_award_walk_completion() returns trigger
language plpgsql security definer set search_path=public as $$
declare member record; meters integer; used_today bigint; award integer;
begin
 perform pg_advisory_xact_lock(73194628);
 if exists(select 1 from gd_participations a left join gd_order_people p on p.post_id=a.post_id and p.user_id=a.user_id where a.post_id=new.post_id and a.status='accepted' and p.received_at is null) then return new; end if;
 if (select count(*) from gd_participations where post_id=new.post_id and status='accepted')<2 then return new; end if;
 for member in select a.user_id,w.meters from gd_participations a left join gd_walk_plans w on w.post_id=a.post_id and w.user_id=a.user_id where a.post_id=new.post_id and a.status='accepted'
 loop
  if exists(select 1 from gd_walk_rewards where post_id=new.post_id and user_id=member.user_id) then continue; end if;
  meters:=case when new.nearby_agreed and new.nearby_requester=member.user_id then 0 else coalesce(member.meters,0) end;
  select coalesce(sum(points),0) into used_today from gd_walk_rewards where user_id=member.user_id and (awarded_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date;
  award:=least(20+meters/5,greatest(0,200-used_today));
  insert into gd_walk_rewards(post_id,user_id,meters,points,rule_version) values(new.post_id,member.user_id,meters,award,2) on conflict do nothing;
 end loop;
 return new;
end; $$;
revoke all on function public.gd_point_wallet(),public.gd_redeem_points(text,uuid,integer),public.gd_cancel_point_redemption(uuid) from public,anon;
grant execute on function public.gd_point_wallet(),public.gd_redeem_points(text,uuid,integer),public.gd_cancel_point_redemption(uuid) to authenticated;
revoke all on function public.gd_award_walk_completion() from public,anon,authenticated;
notify pgrst,'reload schema';


-- consistency-fixes.sql
-- Apply after APPLY-POINTS-SHOP.sql and existing room-time/platform-coupon updates.
-- Preserve existing rooms, confirmed money, issued rewards and product prices.

select pg_advisory_xact_lock(73194628);
alter table public.gd_order_people add column if not exists transfer_review_pending boolean not null default false;
-- Do not relabel money already marked sent. Unconfirmed claims need a separate decision.
update public.gd_order_people p set transfer_review_pending=true,refund_due=greatest(0,p.confirmed_amount-p.refunded_amount)
where p.claimed_amount>greatest(p.confirmed_amount,p.refunded_amount) and not p.refund_sent
and exists(select 1 from public.gd_participations a join public.gd_order_states s on s.post_id=a.post_id where a.post_id=p.post_id and a.user_id=p.user_id and (a.status='withdrawn' or s.phase='cancelled'));
insert into public.gd_point_products(id,name,category,description,price,symbol,sort_order)
values('small-snack','작은 간식 교환권','간식','가볍게 모아 즐기는 첫 번째 간식 보상.',200,'icecream',0)
on conflict(id) do nothing;

create or replace function public.gd_action(p_action text,p_post uuid default null,p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_state gd_order_states%rowtype; v_owner uuid; v_paid integer;
begin
  if not public.gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  if p_action in('create','apply') and exists(select 1 from gd_testers where user_id=auth.uid() and suspended_until>now()) then
    raise exception '이용 제한 기간에는 새 모집에 참여할 수 없어요. 진행 중인 주문은 마무리할 수 있어요.';
  end if;
  select * into v_state from gd_order_states where post_id=p_post;
  select owner_id into v_owner from gd_posts where id=p_post;
  if p_action='apply' and exists(select 1 from gd_order_people where post_id=p_post and user_id=auth.uid() and (transfer_review_pending or refund_due>0)) then raise exception '이 모임의 입금·환불 확인을 먼저 마쳐 주세요.'; end if;
  if p_action='complete' then raise exception '모든 참여자가 직접 수령 완료를 눌러야 종료돼요.'; end if;
  if p_action in('apply','accept','reopen') and v_state.phase is not null and v_state.phase<>'menu' then raise exception '주문 내용이 확정되어 참여자를 바꿀 수 없어요.'; end if;
  if p_action in('apply','accept','reopen') and v_state.nearby_agreed then raise exception '내 근처 수령 합의를 해제한 뒤 인원을 변경해 주세요.'; end if;
  if p_action in('cancel','withdraw') and v_state.phase in('ordered','delivering','arrived','completed') then raise exception '주문 후에는 일반 취소가 불가능해요.'; end if;
  if p_action in('cancel','withdraw') and v_state.phase in('menu','payment') then
    if p_action='cancel' and v_owner=auth.uid() then
      update gd_order_states set phase='cancelled',updated_at=now() where post_id=p_post;
      update gd_order_people set refund_due=greatest(0,confirmed_amount-refunded_amount),refund_sent=case when refund_due=greatest(0,confirmed_amount-refunded_amount) then refund_sent else false end,transfer_review_pending=claimed_amount>greatest(confirmed_amount,refunded_amount) where post_id=p_post and user_id<>v_owner;
    elsif p_action='withdraw' and v_owner<>auth.uid() then
      update gd_order_people set refund_due=greatest(0,confirmed_amount-refunded_amount),refund_sent=case when refund_due=greatest(0,confirmed_amount-refunded_amount) then refund_sent else false end,transfer_review_pending=claimed_amount>greatest(confirmed_amount,refunded_amount),food_total=0,fee=0,coupon_discount=0 where post_id=p_post and user_id=auth.uid();
      update gd_order_states set phase='menu',leader_ready=false,nearby_agreed=false,nearby_requester=null,updated_at=now() where post_id=p_post;
    end if;
  end if;
  v_id:=public.gd_base_action_internal(p_action,p_post,p_data);
  if p_action='create' then
    insert into gd_order_states(post_id,meeting) select id,meeting from gd_posts where id=v_id;
    insert into gd_order_people(post_id,user_id) values(v_id,auth.uid());
    if p_data ? 'pickup_lat' and p_data ? 'pickup_lng' then
      if not((p_data->>'pickup_lat')::float8 between -90 and 90 and (p_data->>'pickup_lng')::float8 between -180 and 180) then raise exception '수령 위치를 확인해 주세요.'; end if;
      update gd_posts set pickup_lat=(p_data->>'pickup_lat')::float8,pickup_lng=(p_data->>'pickup_lng')::float8 where id=v_id;
    end if;
  elsif p_action='cancel' then
    update gd_order_states set phase='cancelled',updated_at=now() where post_id=p_post;
  elsif p_action in('accept','apply') then
    insert into gd_order_states(post_id,meeting) select id,meeting from gd_posts where id=v_id on conflict do nothing;
    insert into gd_order_people(post_id,user_id) select post_id,user_id from gd_participations where post_id=v_id and status='accepted' on conflict do nothing;
  end if;
  return v_id;
end; $$;

create or replace function public.gd_order_action(p_action text,p_post uuid,p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_owner uuid; v_state gd_order_states%rowtype; v_post gd_posts%rowtype;
  v_target uuid; v_count int; v_total int; v_due int; v_discount int; v_rating numeric; v_trades bigint; v_person gd_order_people%rowtype; v_time timestamptz; v_meta jsonb; v_duration interval; v_label text;
begin
  if not public.gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  select * into v_post from gd_posts where id=p_post for update;v_owner:=v_post.owner_id;
  if not found or not exists(select 1 from gd_participations where post_id=p_post and user_id=v_uid and status in('accepted','withdrawn')) then raise exception '이 모임의 참여자만 이용할 수 있어요.'; end if;
  insert into gd_order_states(post_id,meeting,phase) values(p_post,v_post.meeting,case when v_post.status='cancelled' then 'cancelled' when v_post.status='completed' then 'completed' else 'menu' end) on conflict do nothing;
  insert into gd_order_people(post_id,user_id) select post_id,user_id from gd_participations where post_id=p_post and status='accepted' on conflict do nothing;
  select * into v_state from gd_order_states where post_id=p_post;
  if p_action='initialize' then return; end if;
  v_target:=coalesce((p_data->>'user_id')::uuid,v_uid);
  select count(*) into v_count from gd_participations where post_id=p_post and status='accepted';
  if p_action in('confirm-cancelled-transfer','retract-transfer-claim') then
    select * into v_person from gd_order_people where post_id=p_post and user_id=v_target for update;
    if not found or not v_person.transfer_review_pending or not exists(select 1 from gd_participations where post_id=p_post and user_id=v_target and (status='withdrawn' or v_state.phase='cancelled')) then raise exception '확인할 취소 입금 내역이 없어요.'; end if;
    if p_action='confirm-cancelled-transfer' then
      if v_uid<>v_owner or v_target=v_owner then raise exception '리더만 실제 입금을 확인할 수 있어요.'; end if;
      update gd_order_people set confirmed_amount=greatest(confirmed_amount,claimed_amount),transfer_review_pending=false,refund_due=greatest(0,greatest(confirmed_amount,claimed_amount)-refunded_amount),refund_sent=false where post_id=p_post and user_id=v_target;
    else
      if v_target<>v_uid then raise exception '내 송금 표시만 철회할 수 있어요.'; end if;
      update gd_order_people set claimed_amount=confirmed_amount,transfer_review_pending=false,refund_due=greatest(0,confirmed_amount-refunded_amount) where post_id=p_post and user_id=v_uid;
    end if;
    return;
  end if;
  if p_action in('refund-sent','refund-received') then
    if exists(select 1 from gd_order_people where post_id=p_post and user_id=v_target and transfer_review_pending) then raise exception '취소된 송금의 입금 여부를 먼저 확인해 주세요.'; end if;
    if p_action='refund-sent' then
      if v_uid<>v_owner or v_target=v_owner then raise exception '주문 담당만 환불을 기록할 수 있어요.'; end if;
      update gd_order_people set refund_sent=true where post_id=p_post and user_id=v_target and refund_due>0;
    else
      update gd_order_people set refunded_amount=refunded_amount+refund_due,refund_due=0,refund_sent=false where post_id=p_post and user_id=v_uid and refund_sent;
    end if;
    if not found then raise exception '처리할 환불 내역이 없어요.'; end if;
    return;
  end if;
  if not exists(select 1 from gd_participations where post_id=p_post and user_id=v_uid and status='accepted') then raise exception '참여가 종료됐어요.'; end if;
  if p_action='review' then
    if v_state.phase<>'completed' or v_target=v_uid or not exists(select 1 from gd_participations where post_id=p_post and user_id=v_target and status='accepted') then raise exception '완료된 모임의 상대만 평가할 수 있어요.'; end if;
    insert into gd_reviews(post_id,reviewer_id,subject_id,stars,comment) values(p_post,v_uid,v_target,(p_data->>'stars')::int,btrim(coalesce(p_data->>'comment','')));
    return;
  elsif p_action='report' then
    if v_target=v_uid or not exists(select 1 from gd_participations where post_id=p_post and user_id=v_target and status='accepted') then raise exception '함께 참여한 상대를 선택해 주세요.'; end if;
    insert into gd_reports(post_id,reporter_id,subject_id,reason,detail) values(p_post,v_uid,v_target,btrim(p_data->>'reason'),btrim(coalesce(p_data->>'detail','')));return;
  elsif p_action='late-ack' then
    update gd_order_people set late_ack=true where post_id=p_post and user_id=v_uid and late_reported and not late_ack;
    if not found then raise exception '확인할 지각 기록이 없어요.'; end if;
    if (select count(*) from gd_order_people where user_id=v_uid and late_ack)>=2 then
      update gd_testers set suspended_until=greatest(coalesce(suspended_until,now()),now()+interval '3 days') where user_id=v_uid;
    end if;return;
  end if;
  if p_action='receive' and exists(select 1 from gd_order_people where post_id=p_post and user_id=v_uid and received_at is not null) then return; end if;
  if v_state.phase in('completed','cancelled') or v_post.status in('completed','cancelled') then raise exception '종료된 모임이에요.'; end if;
  if p_action='share-location' then
    if p_data->>'lat' is null or p_data->>'lng' is null then
      update gd_order_people set latitude=null,longitude=null where post_id=p_post and user_id=v_uid;
    else
      if not((p_data->>'lat')::float8 between -90 and 90 and (p_data->>'lng')::float8 between -180 and 180) then raise exception '위치를 확인해 주세요.'; end if;
      update gd_order_people set latitude=(p_data->>'lat')::float8,longitude=(p_data->>'lng')::float8 where post_id=p_post and user_id=v_uid;
    end if;return;
  elsif p_action='meeting' then
    if v_state.phase not in('menu','payment') then raise exception '주문 전에 수령 장소를 정해 주세요.'; end if;
    if char_length(btrim(coalesce(p_data->>'meeting',''))) not between 1 and 200 then raise exception '수령 장소를 입력해 주세요.'; end if;
    if ((p_data->>'lat' is null)<>(p_data->>'lng' is null)) or (p_data->>'lat' is not null and not((p_data->>'lat')::float8 between -90 and 90 and (p_data->>'lng')::float8 between -180 and 180)) then raise exception '수령 좌표를 확인해 주세요.'; end if;
    if v_state.nearby_agreed and btrim(p_data->>'meeting')<>v_state.nearby_address then raise exception '합의한 내 근처 수령 장소를 유지해 주세요.'; end if;
    if p_data ? 'expected_updated_at' and (p_data->>'expected_updated_at')::timestamptz is distinct from v_state.updated_at then raise exception '상대가 장소나 시간을 변경했어요. 최신 내용을 확인한 뒤 다시 저장해 주세요.'; end if;
    v_time:=(p_data->>'time')::timestamptz;
    update gd_order_states set meeting=btrim(p_data->>'meeting'),meeting_time=v_time,
      meeting_lat=case when p_data ? 'lat' then (p_data->>'lat')::float8 when btrim(p_data->>'meeting')=v_state.meeting then meeting_lat else null end,
      meeting_lng=case when p_data ? 'lng' then (p_data->>'lng')::float8 when btrim(p_data->>'meeting')=v_state.meeting then meeting_lng else null end,
      updated_at=clock_timestamp() where post_id=p_post;
    if v_time is not null and v_time is distinct from v_state.meeting_time then
      begin v_meta:=v_post.note::jsonb; exception when others then v_meta:=jsonb_build_object('text',v_post.note); end;
      if jsonb_typeof(v_meta) is distinct from 'object' then v_meta:=jsonb_build_object('text',v_post.note); end if;
      begin v_duration:=(v_meta->>'ends_at')::timestamptz-(v_meta->>'starts_at')::timestamptz; exception when others then v_duration:=interval '1 hour'; end;
      if v_duration is null or v_duration<=interval '0' or v_duration>interval '4 hours' then v_duration:=interval '1 hour'; end if;
      v_label:=to_char(v_time at time zone 'Asia/Seoul','MM.DD HH24:MI')||'–'||to_char((v_time+v_duration) at time zone 'Asia/Seoul','HH24:MI');
      v_meta:=v_meta||jsonb_build_object('format','campus-v1','starts_at',v_time,'ends_at',v_time+v_duration,'deliveryTime',v_label,'text',v_label||' 함께 주문해요.'||chr(10)||regexp_replace(coalesce(v_meta->>'text',''),'^(오늘|내일|[0-9]{2}[.][0-9]{2}) [^' || chr(10) || ']*함께 주문해요[.]' || chr(10) || '?','',''));
      update gd_posts set note=v_meta::text where id=p_post;
      update gd_menu_notifications set expires_at=least(expires_at,now()) where kind='group_invite' and payload->>'post_id'=p_post::text;
    end if;
    return;
  elsif p_action='nearby-propose' then
    if v_state.phase<>'menu' or v_count<>2 then raise exception '메뉴 확정 전 2인 모임에서 제안할 수 있어요.'; end if;
    if char_length(btrim(coalesce(p_data->>'address',''))) not between 1 and 200 then raise exception '집 근처의 공개 수령 장소를 적어 주세요.'; end if;
    update gd_order_states set nearby_requester=v_uid,nearby_address=btrim(p_data->>'address'),nearby_agreed=false,updated_at=now() where post_id=p_post;return;
  elsif p_action='nearby-agree' then
    if v_state.phase<>'menu' or v_count<>2 or v_state.nearby_requester is null or v_state.nearby_requester=v_uid then raise exception '상대의 제안만 동의할 수 있어요.'; end if;
    update gd_order_states set nearby_agreed=true,meeting=nearby_address,meeting_lat=null,meeting_lng=null,updated_at=now() where post_id=p_post;
    update gd_posts set status='closed' where id=p_post;
    update gd_participations set status='rejected',active=false where post_id=p_post and status='pending';return;
  elsif p_action='nearby-reset' then
    if v_state.phase<>'menu' then raise exception '메뉴 확정 전에 변경해 주세요.'; end if;
    update gd_order_states set nearby_requester=null,nearby_address=null,nearby_agreed=false,updated_at=clock_timestamp() where post_id=p_post;return;
  elsif p_action='claim-transfer' then
    if v_state.phase<>'payment' or v_uid=v_owner then raise exception '입금 대기 중인 참가자만 송금을 표시할 수 있어요.'; end if;
    update gd_order_people set claimed_amount=greatest(confirmed_amount,food_total+fee-coupon_discount+refunded_amount) where post_id=p_post and user_id=v_uid;return;
  elsif p_action='receive' then
    if v_state.phase<>'arrived' then raise exception '배달 도착 후에 수령을 확인해 주세요.'; end if;
    if p_data ? 'walk_meters' and not exists(select 1 from gd_order_people where post_id=p_post and user_id=v_uid and received_at is not null) then
      perform public.gd_set_walk_plan(p_post,(p_data->>'walk_meters')::int,p_data->>'walk_source');
    end if;
    update gd_order_people set received_at=coalesce(received_at,now()) where post_id=p_post and user_id=v_uid;
    if not exists(select 1 from gd_participations a left join gd_order_people x on x.post_id=a.post_id and x.user_id=a.user_id where a.post_id=p_post and a.status='accepted' and x.received_at is null) then
      update gd_order_states set phase='completed',updated_at=now() where post_id=p_post;
      update gd_posts set status='completed' where id=p_post;update gd_participations set active=false where post_id=p_post;
      update gd_order_people set latitude=null,longitude=null where post_id=p_post;
    end if;return;
  elsif p_action='coupon' then
    if v_state.phase<>'payment' or v_state.coupon_funding<>'platform' or v_uid=v_owner or v_state.nearby_agreed then raise exception '송금 전 일반 모임에서 배프 지원 쿠폰을 사용할 수 있어요.'; end if;
    select r.rating,r.trades into v_rating,v_trades from gd_reputation() r where r.user_id=v_uid;
    if coalesce(v_rating,0)<4.8 or coalesce(v_trades,0)<5 or exists(select 1 from gd_order_people x join gd_order_states s on s.post_id=x.post_id where x.user_id=v_uid and x.coupon_discount>0 and s.phase<>'cancelled') then raise exception '쿠폰 사용 조건을 확인해 주세요.'; end if;
    if exists(select 1 from gd_order_people where post_id=p_post and (claimed_amount>0 or confirmed_amount>0)) then raise exception '송금 전에 쿠폰을 적용해 주세요.'; end if;
    update gd_order_people set coupon_discount=least(1000,fee) where post_id=p_post and user_id=v_uid and fee>0;
    if not found then raise exception '할인할 배달비가 없어요.'; end if;
    -- The platform funds the discount; no participant's delivery fee is increased.
    update gd_order_states set leader_ready=false,updated_at=now() where post_id=p_post;return;
  end if;
  if v_uid<>v_owner then raise exception '주문 담당만 처리할 수 있어요.'; end if;
  if p_action='account' then
    if v_state.phase<>'menu' then raise exception '메뉴 확정 전에 계좌를 정해 주세요.'; end if;
    if char_length(btrim(coalesce(p_data->>'bank',''))) not between 1 and 30 or char_length(btrim(coalesce(p_data->>'account',''))) not between 1 and 40 or char_length(btrim(coalesce(p_data->>'holder',''))) not between 1 and 30 then raise exception '은행, 계좌번호와 예금주를 확인해 주세요.'; end if;
    update gd_order_states set bank=btrim(p_data->>'bank'),account=btrim(p_data->>'account'),holder=btrim(p_data->>'holder'),reward_support=false,updated_at=now() where post_id=p_post;
  elsif p_action='finalize' then
    if v_state.nearby_requester is not null and not v_state.nearby_agreed then raise exception '근처 수령 제안에 동의하거나 제안을 취소한 뒤 확정해 주세요.'; end if;
    if exists(select 1 from gd_order_people where post_id=p_post and transfer_review_pending) then raise exception '취소된 참가자의 입금 확인을 먼저 마쳐 주세요.'; end if;
    if v_state.phase<>'menu' or v_post.status<>'closed' or v_count<2 then raise exception '2명 이상 모여 모집을 마감한 뒤 확정해 주세요.'; end if;
    if v_state.bank='' or v_state.account='' or v_state.holder='' or v_state.meeting='' or v_state.meeting_time is null then raise exception '리더 계좌와 수령 장소·시간을 먼저 정해 주세요.'; end if;
    if exists(select 1 from gd_participations a left join gd_baskets b on b.post_id=a.post_id and b.user_id=a.user_id where a.post_id=p_post and a.status='accepted' and coalesce(b.total,0)<=0) then raise exception '모든 참여자가 메뉴를 저장해야 해요.'; end if;
    select sum(b.total) into v_total from gd_baskets b join gd_participations a on a.post_id=b.post_id and a.user_id=b.user_id where b.post_id=p_post and a.status='accepted';
    if v_total<v_post.min_order then raise exception '목표 주문금액을 아직 채우지 못했어요.'; end if;
    update gd_order_people x set food_total=b.total,fee=case when v_state.nearby_agreed then case when x.user_id=v_state.nearby_requester then v_post.delivery_fee else 0 end else v_post.delivery_fee/v_count+case when x.user_id=v_owner then v_post.delivery_fee%v_count else 0 end end,coupon_discount=0
      from gd_baskets b,gd_participations a where x.post_id=p_post and b.post_id=x.post_id and b.user_id=x.user_id and a.post_id=x.post_id and a.user_id=x.user_id and a.status='accepted';
    update gd_order_people x set refund_due=greatest(0,x.confirmed_amount-x.refunded_amount-x.food_total-x.fee),refund_sent=false where x.post_id=p_post and exists(select 1 from gd_participations a where a.post_id=x.post_id and a.user_id=x.user_id and a.status='accepted');
    update gd_order_states set phase='payment',leader_ready=false,updated_at=now() where post_id=p_post;
  elsif p_action='confirm-transfer' then
    if v_state.phase<>'payment' or v_target=v_owner then raise exception '입금 대기 상태를 확인해 주세요.'; end if;
    update gd_order_people set confirmed_amount=claimed_amount where post_id=p_post and user_id=v_target and claimed_amount>0;
    if not found then raise exception '상대가 송금 표시를 먼저 해야 해요.'; end if;
  elsif p_action='leader-ready' then
    if v_state.phase<>'payment' then raise exception '입금 대기 상태가 아니에요.'; end if;
    update gd_order_states set leader_ready=true where post_id=p_post;
  elsif p_action='order' then
    if exists(select 1 from gd_order_people where post_id=p_post and transfer_review_pending) then raise exception '취소된 참가자의 입금 확인을 먼저 마쳐 주세요.'; end if;
    if v_state.phase<>'payment' or not v_state.leader_ready or exists(select 1 from gd_order_people x join gd_participations a on a.post_id=x.post_id and a.user_id=x.user_id where x.post_id=p_post and a.status='accepted' and x.user_id<>v_owner and x.confirmed_amount-x.refunded_amount<x.food_total+x.fee-x.coupon_discount) or exists(select 1 from gd_order_people where post_id=p_post and refund_due>0) then raise exception '전원 입금 확인과 환불 확인을 먼저 마쳐 주세요.'; end if;
    update gd_order_states set phase='ordered',updated_at=now() where post_id=p_post;
  elsif p_action='delivering' then
    if v_state.phase<>'ordered' then raise exception '주문 완료 다음에 배달 중으로 변경해 주세요.'; end if;
    update gd_order_states set phase='delivering',updated_at=now() where post_id=p_post;
  elsif p_action='arrive' then
    if v_state.phase not in('ordered','delivering') then raise exception '주문 후 도착을 확인해 주세요.'; end if;
    update gd_order_states set phase='arrived',arrived_at=now(),updated_at=now() where post_id=p_post;
  elsif p_action='late-report' then
    if v_state.phase<>'arrived' or now()<greatest(v_state.arrived_at,coalesce(v_state.meeting_time,v_state.arrived_at))+interval '10 minutes' or v_target=v_owner then raise exception '약속 시간과 배달 도착 후 10분이 지나야 확인할 수 있어요.'; end if;
    update gd_order_people set late_reported=true where post_id=p_post and user_id=v_target and received_at is null and exists(select 1 from gd_participations where post_id=p_post and user_id=v_target and status='accepted');
    if not found then raise exception '수령 대기 중인 참가자가 아니에요.'; end if;
  else raise exception '지원하지 않는 요청이에요.';
  end if;
end; $$;

create or replace function public.gd_invite_menu_matches(p_post uuid,p_lat double precision,p_lng double precision) returns void
language plpgsql security definer set search_path=public as $$
declare v_post public.gd_posts%rowtype; v_me public.gd_intents%rowtype; v_other public.gd_intents%rowtype; v_meta jsonb;
begin
  if not public.gd_is_tester() then raise exception '접근 권한이 없어요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  select * into v_post from public.gd_posts where id=p_post and owner_id=auth.uid() and status='open' and deadline>now();
  if not found then raise exception '진행 중인 내 모집글이 아니에요.'; end if;
  select * into v_me from public.gd_intents where user_id=auth.uid() and active and ends_at>now() and v_post.restaurant=any(stores);
  -- The room schedule is authoritative even when the leader has an older saved intent.
  begin
    v_meta:=v_post.note::jsonb;
    if v_meta->>'starts_at' is not null and v_meta->>'ends_at' is not null then
      v_me.area_id:=coalesce(v_meta->>'area_id',v_me.area_id);
      v_me.starts_at:=(v_meta->>'starts_at')::timestamptz;
      v_me.ends_at:=(v_meta->>'ends_at')::timestamptz;
    end if;
  exception when others then null;
  end;
  if v_me.area_id is null or v_me.area_id not in ('cnu-main','cnu-north','gungdong') or v_me.starts_at is null
    or v_me.ends_at is null or v_me.ends_at<=now() or v_me.ends_at<=v_me.starts_at then return; end if;
  -- No coordinates means no distance-based invite. Never fall back to area equality.
  p_lat:=coalesce(p_lat,v_me.latitude);p_lng:=coalesce(p_lng,v_me.longitude);
  if p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) then return; end if;
  for v_other in select i.* from public.gd_intents i join public.gd_testers t on i.user_id=t.user_id and t.active
    where i.user_id<>auth.uid() and i.active and i.ends_at>now() and public.gd_match_distance_m(p_lat,p_lng,i.latitude,i.longitude)<=800
    and v_post.restaurant=any(i.stores) and greatest(i.starts_at,v_me.starts_at)<least(i.ends_at,v_me.ends_at)
    and not exists(select 1 from public.gd_participations a where a.user_id=i.user_id and a.active)
  loop
    insert into public.gd_menu_notifications(recipient_id,peer_id,kind,signature,payload,expires_at)
      values(v_other.user_id,auth.uid(),'group_invite','post:'||p_post::text,
        jsonb_build_object('post_id',p_post,'stores',array[v_post.restaurant],'area',v_me.area_id,'max_walk_m',400),least(v_post.deadline,v_other.ends_at))
      on conflict(recipient_id,signature) do nothing;
  end loop;
end; $$;


create or replace function public.gd_update_room_time(p_post uuid,p_start timestamptz,p_end timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare p gd_posts%rowtype; meta jsonb; label text;
begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  select * into p from gd_posts where id=p_post for update;
  if not found or p.owner_id<>auth.uid() then raise exception '리더만 시간을 변경할 수 있어요.'; end if;
  if p.status not in('open','closed') or exists(select 1 from gd_order_states where post_id=p_post and phase<>'menu') then raise exception '주문 확정 전에 시간을 변경해 주세요.'; end if;
  if p_start is null or p_end is null or p_start<=now() or p_start>now()+interval '7 days' or p_end<=p_start or p_end-p_start>interval '4 hours' then raise exception '앞으로의 수령 시간을 선택해 주세요.'; end if;
  begin meta:=p.note::jsonb; exception when others then meta:=jsonb_build_object('text',p.note); end;
  if jsonb_typeof(meta) is distinct from 'object' then meta:=jsonb_build_object('text',p.note); end if;
  label:=to_char(p_start at time zone 'Asia/Seoul','MM.DD HH24:MI')||'–'||to_char(p_end at time zone 'Asia/Seoul','HH24:MI');
  meta:=meta||jsonb_build_object('format','campus-v1','starts_at',p_start,'ends_at',p_end,'deliveryTime',label,'text',label||' 함께 주문해요.'||chr(10)||regexp_replace(coalesce(meta->>'text',''),'^(오늘|내일|[0-9]{2}[.][0-9]{2}) [^' || chr(10) || ']*함께 주문해요[.]' || chr(10) || '?','',''));
  update gd_posts set note=meta::text,deadline=case when deadline<=now() or deadline>p_start then p_start else deadline end where id=p_post;
  update gd_order_states set meeting_time=p_start,updated_at=now() where post_id=p_post;
  update gd_menu_notifications set expires_at=least(expires_at,now()) where kind='group_invite' and payload->>'post_id'=p_post::text;
end; $$;

create or replace function public.gd_update_room_time_checked(p_post uuid,p_start timestamptz,p_end timestamptz,p_expected timestamptz)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  if p_expected is not null and p_expected is distinct from (select updated_at from gd_order_states where post_id=p_post) then raise exception '상대가 장소나 시간을 변경했어요. 최신 내용을 확인한 뒤 다시 저장해 주세요.'; end if;
  perform public.gd_update_room_time(p_post,p_start,p_end);
end; $$;
revoke all on function public.gd_update_room_time(uuid,timestamptz,timestamptz),public.gd_update_room_time_checked(uuid,timestamptz,timestamptz,timestamptz) from public,anon;
grant execute on function public.gd_update_room_time(uuid,timestamptz,timestamptz),public.gd_update_room_time_checked(uuid,timestamptz,timestamptz,timestamptz) to authenticated;

revoke all on function public.gd_action(text,uuid,jsonb),public.gd_order_action(text,uuid,jsonb),public.gd_invite_menu_matches(uuid,double precision,double precision) from public,anon;
grant execute on function public.gd_action(text,uuid,jsonb),public.gd_order_action(text,uuid,jsonb),public.gd_invite_menu_matches(uuid,double precision,double precision) to authenticated;
notify pgrst,'reload schema';


commit;
