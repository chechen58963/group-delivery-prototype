-- Prototype checkout only: no payment provider, bank API, merchant API or outbound request.
-- Run after APPLY-ORDER-TIMING.sql. Existing transfers retain their original workflow.
begin;
select pg_advisory_xact_lock(73194628);
alter table public.gd_order_states add column if not exists checkout_mode text not null default 'leader_transfer' check(checkout_mode in('leader_transfer','platform'));
alter table public.gd_order_states alter column checkout_mode set default 'platform';
alter table public.gd_order_states add column if not exists platform_submitted_at timestamptz;
alter table public.gd_order_states add column if not exists platform_accepted_at timestamptz;
alter table public.gd_order_people add column if not exists platform_paid_at timestamptz;
alter table public.gd_order_people add column if not exists platform_payment_method text;
alter table public.gd_order_people add column if not exists platform_refunded_at timestamptz;

-- Never convert an order with existing money or transfer claims.
update gd_order_states s set checkout_mode='platform'
where s.phase='menu' and not exists(select 1 from gd_order_people x where x.post_id=s.post_id
  and (x.claimed_amount>0 or x.confirmed_amount>0 or x.refund_due>0 or x.transfer_review_pending));

-- An old virtual-led room never requested a real transfer. Bring its untouched
-- payment screen into the same checkout, without converting any real payment.
update gd_order_states s set checkout_mode='platform',bank='',account='',holder=''
where s.phase='payment' and exists(select 1 from gd_virtual_rooms v where v.post_id=s.post_id and v.virtual_leader)
  and not exists(select 1 from gd_order_people x join gd_testers t on t.user_id=x.user_id
    where x.post_id=s.post_id and not t.is_virtual and (x.claimed_amount>0 or x.confirmed_amount>0 or x.refund_due>0 or x.transfer_review_pending));

create or replace function public.gd_platform_try_submit(p_post uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  -- Called only from locked, authenticated RPCs. Check the whole accepted roster,
  -- including the leader, rather than trusting a browser's paid count.
  if not exists(select 1 from gd_order_states where post_id=p_post and checkout_mode='platform' and phase='payment') then return; end if;
  if (select count(*) from gd_participations where post_id=p_post and status='accepted' and active)<2 then return; end if;
  if exists(select 1 from gd_participations a left join gd_order_people x on x.post_id=a.post_id and x.user_id=a.user_id
    where a.post_id=p_post and a.status='accepted' and active
    and (x.platform_paid_at is null or x.confirmed_amount-x.refunded_amount<x.food_total+x.fee-x.coupon_discount)) then return; end if;
  if exists(select 1 from gd_order_people where post_id=p_post and (refund_due>0 or transfer_review_pending)) then return; end if;
  update gd_order_states set phase='ordered',leader_ready=true,platform_submitted_at=clock_timestamp(),
    platform_accepted_at=null,updated_at=clock_timestamp() where post_id=p_post and phase='payment';
end $$;

create or replace function public.gd_platform_checkout(p_action text,p_post uuid,p_data jsonb default '{}') returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); s gd_order_states%rowtype; p gd_posts%rowtype; person gd_order_people%rowtype;
  headcount int; total int; due int; rating numeric; trades bigint; method text;
begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  select * into p from gd_posts where id=p_post for update;
  if not found or not exists(select 1 from gd_participations where post_id=p_post and user_id=uid and status='accepted' and active) then raise exception '참여 중인 모임에서 이용해 주세요.'; end if;
  select * into s from gd_order_states where post_id=p_post for update;
  if not found then raise exception '주문 정보를 불러온 뒤 다시 시도해 주세요.'; end if;
  if p_action='adopt' then
    if s.checkout_mode='platform' then return; end if;
    if s.phase<>'payment' or not exists(select 1 from gd_virtual_rooms where post_id=p_post and virtual_leader)
      or exists(select 1 from gd_order_people x join gd_testers t on t.user_id=x.user_id where x.post_id=p_post and not t.is_virtual
        and (x.claimed_amount>0 or x.confirmed_amount>0 or x.refund_due>0 or x.transfer_review_pending)) then raise exception '기존 송금 내역이 있는 주문은 기존 방식으로 마무리해 주세요.'; end if;
    update gd_order_states set checkout_mode='platform',bank='',account='',holder='',updated_at=clock_timestamp() where post_id=p_post;
    return;
  end if;
  if p_action='finalize' then
    if uid<>p.owner_id then raise exception '리더가 주문 내용을 확정할 수 있어요.'; end if;
    if s.phase<>'menu' or p.status<>'closed' then raise exception '모집을 마감한 뒤 주문을 확정해 주세요.'; end if;
    if s.checkout_mode<>'platform' and exists(select 1 from gd_order_people where post_id=p_post and (claimed_amount>0 or confirmed_amount>0 or refund_due>0 or transfer_review_pending)) then raise exception '기존 송금 내역이 있는 주문은 기존 방식으로 마무리해 주세요.'; end if;
    if p_data ? 'expected' and (p_data->>'expected')::timestamptz is distinct from s.updated_at then raise exception '주문 내용이 바뀌었어요. 다시 확인해 주세요.'; end if;
    select count(*) into headcount from gd_participations where post_id=p_post and status='accepted' and active;
    if headcount<2 then raise exception '함께 주문할 배프가 한 명 더 필요해요.'; end if;
    if btrim(s.meeting)='' then raise exception '수령 장소를 저장해 주세요.'; end if;
    if s.nearby_requester is not null and not s.nearby_agreed then raise exception '내 근처 수령 제안에 동의하거나 취소해 주세요.'; end if;
    if s.pickup_mode='contactless' and exists(select 1 from gd_participations where post_id=p_post and status='accepted' and active and not(user_id=any(s.pickup_agreed_by))) then raise exception '모두 비대면 수령 안내에 동의해 주세요.'; end if;
    if exists(select 1 from gd_order_people where post_id=p_post and (refund_due>0 or transfer_review_pending)) then raise exception '이전 환불 확인을 먼저 마쳐 주세요.'; end if;
    if exists(select 1 from gd_participations a left join gd_baskets b on b.post_id=a.post_id and b.user_id=a.user_id
      where a.post_id=p_post and a.status='accepted' and active and coalesce(b.total,0)<=0) then raise exception '모든 참가자가 메뉴를 저장해야 해요.'; end if;
    select sum(b.total) into total from gd_baskets b join gd_participations a on a.post_id=b.post_id and a.user_id=b.user_id
      where b.post_id=p_post and a.status='accepted' and a.active;
    if total<p.min_order then raise exception '목표 주문금액을 아직 채우지 못했어요.'; end if;
    insert into gd_order_people(post_id,user_id) select post_id,user_id from gd_participations where post_id=p_post and status='accepted' and active on conflict do nothing;
    update gd_order_people x set food_total=b.total,
      fee=case when s.nearby_agreed then case when x.user_id=s.nearby_requester then p.delivery_fee else 0 end
        else p.delivery_fee/headcount+case when x.user_id=p.owner_id then p.delivery_fee%headcount else 0 end end,
      coupon_discount=0,platform_paid_at=null,platform_payment_method=null
      from gd_baskets b,gd_participations a where x.post_id=p_post and b.post_id=x.post_id and b.user_id=x.user_id
        and a.post_id=x.post_id and a.user_id=x.user_id and a.status='accepted' and a.active;
    update gd_order_states set checkout_mode='platform',phase='payment',coupon_funding='platform',leader_ready=false,
      bank='',account='',holder='',platform_submitted_at=null,platform_accepted_at=null,updated_at=clock_timestamp() where post_id=p_post;
    return;
  end if;
  if s.checkout_mode<>'platform' then raise exception '기존 송금 방식의 주문이에요.'; end if;
  select * into person from gd_order_people where post_id=p_post and user_id=uid for update;
  if not found then raise exception '내 결제 정보를 불러오지 못했어요.'; end if;
  if p_action='pay' and person.platform_paid_at is not null and s.phase in('payment','ordered','delivering','arrived','completed') then return; end if;
  if s.phase<>'payment' then raise exception '결제 대기 상태를 확인해 주세요.'; end if;
  if btrim(s.meeting)='' or (s.nearby_requester is not null and not s.nearby_agreed) then raise exception '수령 장소와 제안 동의를 확인해 주세요.'; end if;
  if s.pickup_mode='contactless' and exists(select 1 from gd_participations where post_id=p_post and status='accepted' and active and not(user_id=any(s.pickup_agreed_by))) then raise exception '모두 비대면 수령 안내에 동의해 주세요.'; end if;
  if p_action='coupon' then
    if person.platform_paid_at is not null or s.nearby_agreed or person.fee<=0 then raise exception '결제 전 일반 모임에서 쿠폰을 적용해 주세요.'; end if;
    select r.rating,r.trades into rating,trades from gd_reputation() r where r.user_id=uid;
    if coalesce(rating,0)<4.8 or coalesce(trades,0)<5 or exists(select 1 from gd_order_people a join gd_order_states b on b.post_id=a.post_id where a.user_id=uid and a.coupon_discount>0 and b.phase<>'cancelled') then raise exception '쿠폰 사용 조건을 확인해 주세요.'; end if;
    update gd_order_people set coupon_discount=least(1000,fee) where post_id=p_post and user_id=uid;
    update gd_order_states set updated_at=clock_timestamp() where post_id=p_post;return;
  elsif p_action<>'pay' then raise exception '지원하지 않는 결제 요청이에요.';
  end if;
  due:=person.food_total+person.fee-person.coupon_discount;
  if p_data->>'amount' is null or (p_data->>'amount')::int<>due then raise exception '결제 금액이 변경됐어요. 금액을 다시 확인해 주세요.'; end if;
  method:=p_data->>'method';
  if method is null or method not in('easy','card') then raise exception '결제 수단을 선택해 주세요.'; end if;
  if exists(select 1 from gd_order_people where post_id=p_post and (refund_due>0 or transfer_review_pending)) then raise exception '이전 환불 확인을 먼저 마쳐 주세요.'; end if;
  -- Records a prototype payment. This function never transfers or charges money.
  update gd_order_people set platform_paid_at=clock_timestamp(),platform_payment_method=method,
    confirmed_amount=refunded_amount+due,claimed_amount=refunded_amount+due where post_id=p_post and user_id=uid;
  update gd_order_states set updated_at=clock_timestamp() where post_id=p_post;
  perform gd_platform_try_submit(p_post);
end $$;

-- Preserve the existing financial workflow for old orders; block its use on new orders.
do $$ begin
  if to_regprocedure('public.gd_order_before_platform(text,uuid,jsonb)') is null then alter function public.gd_order_action(text,uuid,jsonb) rename to gd_order_before_platform; end if;
  if to_regprocedure('public.gd_action_before_platform(text,uuid,jsonb)') is null then alter function public.gd_action(text,uuid,jsonb) rename to gd_action_before_platform; end if;
  if to_regprocedure('public.gd_virtual_before_platform()') is null then alter function public.gd_virtual_tick() rename to gd_virtual_before_platform; end if;
  if to_regprocedure('public.gd_virtual_control_before_platform(uuid,text)') is null then alter function public.gd_virtual_control(uuid,text) rename to gd_virtual_control_before_platform; end if;
end $$;
-- The legacy bot maintenance must not overwrite the cumulative refund ledger.
do $$ declare definition text; begin
  definition:=pg_get_functiondef('public.gd_virtual_before_platform()'::regprocedure);
  if definition like '%if v_phase=''payment'' and not p.virtual_leader then%' then
    definition:=replace(definition,'if v_phase=''payment'' and not p.virtual_leader then',
      'if v_phase=''payment'' and not p.virtual_leader and not exists(select 1 from gd_order_states where post_id=p.id and checkout_mode=''platform'') then');
    execute definition;
  end if;
end $$;
create or replace function public.gd_order_action(p_action text,p_post uuid,p_data jsonb default '{}') returns void
language plpgsql security definer set search_path=public as $$
begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  if exists(select 1 from gd_order_states where post_id=p_post and checkout_mode='platform') then
    if p_action in('account','finalize','claim-transfer','confirm-transfer','leader-ready','order','coupon','confirm-cancelled-transfer','retract-transfer-claim','refund-sent','refund-received') then raise exception '앱 내 결제 화면에서 진행해 주세요.'; end if;
    if p_action='delivering' and exists(select 1 from gd_order_states where post_id=p_post and platform_accepted_at is null) then raise exception '가게의 주문 접수를 기다려 주세요.'; end if;
  end if;
  perform gd_order_before_platform(p_action,p_post,p_data);
end $$;
create or replace function public.gd_action(p_action text,p_post uuid default null,p_data jsonb default '{}') returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid; platform boolean;
begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  platform:=exists(select 1 from gd_order_states where post_id=p_post and checkout_mode='platform');
  result:=gd_action_before_platform(p_action,p_post,p_data);
  if platform and p_action in('cancel','withdraw') then
    -- A changed roster needs a fresh bill. Refund every recorded payment,
    -- including the leader, and let remaining members reconfirm the new split.
    update gd_order_people set platform_refunded_at=case when confirmed_amount>refunded_amount then clock_timestamp() else platform_refunded_at end,
      refunded_amount=confirmed_amount,refund_due=0,refund_sent=false,transfer_review_pending=false,
      claimed_amount=confirmed_amount,platform_paid_at=null where post_id=p_post;
    update gd_order_states set leader_ready=false,updated_at=clock_timestamp() where post_id=p_post;
  end if;
  return result;
end $$;
create or replace function public.gd_virtual_tick() returns void
language plpgsql security definer set search_path=public as $$
declare room record;
begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  -- A suspended browser may return after the virtual courier is ready to advance.
  -- Record acceptance before the legacy bot tick moves that order to delivery.
  update gd_order_states set platform_accepted_at=clock_timestamp(),updated_at=clock_timestamp()
    where checkout_mode='platform' and phase='ordered' and platform_accepted_at is null
      and platform_submitted_at<clock_timestamp()-interval '3 seconds';
  perform gd_virtual_before_platform();
  -- Only virtual actors are auto-paid. Real members always press their own pay button.
  update gd_order_people x set platform_paid_at=clock_timestamp(),platform_payment_method='virtual',
    claimed_amount=x.refunded_amount+x.food_total+x.fee-x.coupon_discount,
    confirmed_amount=x.refunded_amount+x.food_total+x.fee-x.coupon_discount
    from gd_order_states s,gd_participations a,gd_testers t where s.post_id=x.post_id and s.checkout_mode='platform'
      and s.phase='payment' and a.post_id=x.post_id and a.user_id=x.user_id and a.status='accepted' and a.active
      and t.user_id=x.user_id and t.is_virtual and x.platform_paid_at is null;
  for room in select post_id from gd_order_states where checkout_mode='platform' and phase='payment' loop
    perform gd_platform_try_submit(room.post_id);
  end loop;
end $$;
create or replace function public.gd_virtual_control(p_post uuid,p_action text) returns void
language plpgsql security definer set search_path=public as $$ begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  if p_action='order' and exists(select 1 from gd_order_states where post_id=p_post and checkout_mode='platform') then raise exception '내 금액을 결제하면 가게로 주문이 전달돼요.'; end if;
  perform gd_virtual_control_before_platform(p_post,p_action);
end $$;
revoke all on function public.gd_platform_try_submit(uuid),public.gd_order_before_platform(text,uuid,jsonb),public.gd_action_before_platform(text,uuid,jsonb),public.gd_virtual_before_platform(),public.gd_virtual_control_before_platform(uuid,text) from public,anon,authenticated;
revoke all on function public.gd_platform_checkout(text,uuid,jsonb),public.gd_order_action(text,uuid,jsonb),public.gd_action(text,uuid,jsonb),public.gd_virtual_tick(),public.gd_virtual_control(uuid,text) from public,anon;
grant execute on function public.gd_platform_checkout(text,uuid,jsonb),public.gd_order_action(text,uuid,jsonb),public.gd_action(text,uuid,jsonb),public.gd_virtual_tick(),public.gd_virtual_control(uuid,text) to authenticated;
-- Delete only the signed-in recipient's own notifications; no broad table write grant.
create or replace function public.gd_delete_menu_notifications(p_ids uuid[]) returns void
language plpgsql security definer set search_path=public as $$ begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  delete from gd_menu_notifications where recipient_id=auth.uid() and id=any(p_ids);
end $$;
revoke all on function public.gd_delete_menu_notifications(uuid[]) from public,anon;
grant execute on function public.gd_delete_menu_notifications(uuid[]) to authenticated;
-- Correct the current catalogue label only; historical basket snapshots stay intact.
update public.gd_menu_catalog c set menus=(select jsonb_agg(case when m->>'id'='2' and m->>'name'='허니레몬에이드'
  then jsonb_set(m,'{name}',to_jsonb('레몬에이드'::text)) else m end order by position)
  from jsonb_array_elements(c.menus) with ordinality x(m,position)) where store_name='더벤티 충남대점';
notify pgrst,'reload schema';
commit;
select '배프 결제와 가게 주문 전달 업데이트 적용 완료' as "확인";
