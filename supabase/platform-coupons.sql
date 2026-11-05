-- Existing installations: run this file once in the Supabase SQL Editor.
-- Does not send money or rewrite completed/cancelled order amounts.
begin;
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
commit;
