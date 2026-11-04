-- Generated bundle. Source files: distance-matching.sql, signup-profiles.sql, restore-workflow.sql
-- Existing setup.sql and menu-discovery.sql must already be installed.

-- distance-matching.sql
-- Run after setup.sql and menu-discovery.sql. Existing interests need their location saved once.
-- Two users can meet at a midpoint when their straight-line separation is <= 800 m.
-- This does not calculate walking routes or guarantee one common point for 3+ people.
begin;
alter table public.gd_intents add column if not exists latitude double precision;
alter table public.gd_intents add column if not exists longitude double precision;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.gd_intents'::regclass and conname='gd_intent_coordinates_valid') then
    alter table public.gd_intents add constraint gd_intent_coordinates_valid check(
      (latitude is null and longitude is null) or
      (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180));
  end if;
end $$;
create or replace function public.gd_match_distance_m(a_lat double precision,a_lng double precision,b_lat double precision,b_lng double precision)
returns double precision language sql immutable strict set search_path='' as $$
  select 12742000 * asin(sqrt(least(1::double precision,greatest(0::double precision,
    power(sin(radians(b_lat-a_lat)/2),2)+cos(radians(a_lat))*cos(radians(b_lat))*power(sin(radians(b_lng-a_lng)/2),2)))));
$$;
update public.gd_menu_notifications set expires_at=least(expires_at,now()) where not(payload ? 'max_walk_m');
create or replace function public.gd_save_intent(p_menus text[],p_stores text[],p_start timestamptz,p_end timestamptz,p_area text,p_lat double precision,p_lng double precision)
returns void language plpgsql security definer set search_path=public as $$
declare v_old public.gd_intents%rowtype; v_other public.gd_intents%rowtype; v_shared text[]; v_sig text; v_exp timestamptz;
begin
  if not public.gd_is_tester() then raise exception '로그인한 참여자만 선택을 저장할 수 있어요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  if exists(select 1 from public.gd_participations where user_id=auth.uid() and active) then
    raise exception '진행 중인 주문을 마친 뒤 새 메뉴를 찾아 주세요.';
  end if;
  if p_menus is null or cardinality(p_menus) not between 1 and 3 or not(p_menus<@array['coffee','burger','sandwich'])
    or p_stores is null or cardinality(p_stores) not between 1 and 4
    or p_start is null or p_end is null or p_end<=now() or p_end<=p_start
    or p_end-p_start>interval '12 hours' or p_end>now()+interval '2 days'
    or ((p_lat is null)<>(p_lng is null)) or (p_lat is not null and (not(p_lat between -90 and 90) or not(p_lng between -180 and 180)))
    or p_area is null or p_area not in ('cnu-main','cnu-north','gungdong') then
    raise exception '메뉴와 가능한 가게, 지역, 출발 위치, 시간대를 확인해 주세요.';
  end if;
  if exists(select 1 from unnest(p_stores) s where not exists(select 1 from public.gd_menu_catalog c
    where c.store_name=s and c.menu_key=any(p_menus))) then raise exception '선택한 메뉴에 해당하는 가게를 골라 주세요.'; end if;
  select * into v_old from public.gd_intents where user_id=auth.uid();
  if found and v_old.active and v_old.menus=p_menus and v_old.stores=p_stores and v_old.starts_at=p_start and v_old.ends_at=p_end and v_old.area_id=p_area and v_old.latitude=p_lat and v_old.longitude=p_lng then return; end if;
  update public.gd_menu_notifications set expires_at=least(expires_at,now()) where recipient_id=auth.uid() or peer_id=auth.uid();
  insert into public.gd_intents(user_id,menus,stores,starts_at,ends_at,area_id,latitude,longitude)
    values(auth.uid(),p_menus,p_stores,p_start,p_end,p_area,p_lat,p_lng)
    on conflict(user_id) do update set menus=excluded.menus,stores=excluded.stores,starts_at=excluded.starts_at,
      ends_at=excluded.ends_at,area_id=excluded.area_id,latitude=excluded.latitude,longitude=excluded.longitude,active=true,updated_at=now();
  for v_other in select i.* from public.gd_intents i join public.gd_testers t on t.user_id=i.user_id and t.active
    where i.user_id<>auth.uid() and i.active and i.ends_at>now() and public.gd_match_distance_m(p_lat,p_lng,i.latitude,i.longitude)<=800
    and greatest(i.starts_at,p_start)<least(i.ends_at,p_end) and i.stores&&p_stores
    and not exists(select 1 from public.gd_participations a where a.user_id=i.user_id and a.active)
  loop
    select array_agg(distinct s order by s) into v_shared from unnest(p_stores) s where s=any(v_other.stores);
    v_exp:=least(p_end,v_other.ends_at);
    v_sig:=md5(least(auth.uid()::text,v_other.user_id::text)||greatest(auth.uid()::text,v_other.user_id::text)||p_lat::text||p_lng::text||v_other.latitude::text||v_other.longitude::text||v_shared::text||greatest(p_start,v_other.starts_at)::text||v_exp::text);
    insert into public.gd_menu_notifications(recipient_id,peer_id,kind,signature,payload,expires_at)
      values(auth.uid(),v_other.user_id,'menu_match',v_sig,jsonb_build_object('stores',v_shared,'area',p_area,'max_walk_m',400,'starts_at',greatest(p_start,v_other.starts_at),'ends_at',v_exp),v_exp),
      (v_other.user_id,auth.uid(),'menu_match',v_sig,jsonb_build_object('stores',v_shared,'area',p_area,'max_walk_m',400,'starts_at',greatest(p_start,v_other.starts_at),'ends_at',v_exp),v_exp)
      on conflict(recipient_id,signature) do update set expires_at=excluded.expires_at;
  end loop;
end; $$;

create or replace function public.gd_find_menu_matches() returns table(store_name text,people_count bigint)
language sql stable security definer set search_path=public as $$
  select c.store_name,count(distinct other.user_id) from public.gd_intents me
  join public.gd_menu_catalog c on c.store_name=any(me.stores)
  join public.gd_intents other on other.user_id<>me.user_id and other.active and other.ends_at>now()
    and public.gd_match_distance_m(me.latitude,me.longitude,other.latitude,other.longitude)<=800 and c.store_name=any(other.stores)
    and greatest(me.starts_at,other.starts_at)<least(me.ends_at,other.ends_at)
  join public.gd_testers t on t.user_id=other.user_id and t.active
  where public.gd_is_tester() and me.user_id=auth.uid() and me.active and me.ends_at>now()
    and not exists(select 1 from public.gd_participations a where a.active and a.user_id in(me.user_id,other.user_id))
  group by c.store_name;
$$;

create or replace function public.gd_invite_menu_matches(p_post uuid,p_lat double precision,p_lng double precision) returns void
language plpgsql security definer set search_path=public as $$
declare v_post public.gd_posts%rowtype; v_me public.gd_intents%rowtype; v_other public.gd_intents%rowtype; v_meta jsonb;
begin
  if not public.gd_is_tester() then raise exception '접근 권한이 없어요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  select * into v_post from public.gd_posts where id=p_post and owner_id=auth.uid() and status='open' and deadline>now();
  if not found then raise exception '진행 중인 내 모집글이 아니에요.'; end if;
  select * into v_me from public.gd_intents where user_id=auth.uid() and active and ends_at>now() and v_post.restaurant=any(stores);
  if not found then
    begin
      v_meta:=v_post.note::jsonb;
      v_me.area_id:=v_meta->>'area_id'; v_me.starts_at:=(v_meta->>'starts_at')::timestamptz;
      v_me.ends_at:=(v_meta->>'ends_at')::timestamptz;
      if v_me.area_id is null or v_me.area_id not in ('cnu-main','cnu-north','gungdong') or v_me.starts_at is null
        or v_me.ends_at is null or v_me.ends_at<=now() or v_me.ends_at<=v_me.starts_at then return; end if;
    exception when others then return;
    end;
  end if;
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

-- Keep older deployed clients functional, but never infer coordinates from an area name.
create or replace function public.gd_save_intent(p_menus text[],p_stores text[],p_start timestamptz,p_end timestamptz,p_area text)
returns void language sql security definer set search_path=public as $$
  select public.gd_save_intent(p_menus,p_stores,p_start,p_end,p_area,
    (select latitude from public.gd_intents where user_id=auth.uid()),
    (select longitude from public.gd_intents where user_id=auth.uid()));
$$;
create or replace function public.gd_invite_menu_matches(p_post uuid) returns void
language sql security definer set search_path=public as $$
  select public.gd_invite_menu_matches(p_post,null,null);
$$;
revoke all on function public.gd_match_distance_m(double precision,double precision,double precision,double precision) from public,anon,authenticated;
revoke all on function public.gd_save_intent(text[],text[],timestamptz,timestamptz,text,double precision,double precision),public.gd_invite_menu_matches(uuid,double precision,double precision),public.gd_find_menu_matches() from public,anon;
grant execute on function public.gd_save_intent(text[],text[],timestamptz,timestamptz,text,double precision,double precision),public.gd_invite_menu_matches(uuid,double precision,double precision),public.gd_find_menu_matches() to authenticated;
notify pgrst,'reload schema';
commit;

-- signup-profiles.sql
-- 회원가입 시 프로필 생성, 이메일 인증 시 자동 활성화. 기존 수동 계정은 유지합니다.
begin;
alter table public.gd_testers add column if not exists joined_at timestamptz not null default now();
alter table public.gd_testers add column if not exists registration_source text not null default 'manual';
alter table public.gd_testers add column if not exists email_activation_done boolean not null default false;

create or replace function public.gd_handle_signup_profile()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_nickname text;
begin
  v_nickname:=btrim(coalesce(new.raw_user_meta_data->>'nickname',''));
  if char_length(v_nickname)<2 or char_length(v_nickname)>20 then
    v_nickname:='배프'||left(replace(new.id::text,'-',''),6);
  end if;
  -- active/admin 등 사용자 메타데이터는 권한 결정에 사용하지 않습니다.
  insert into public.gd_testers(user_id,nickname,active,registration_source,email_activation_done)
    values(new.id,v_nickname,new.email_confirmed_at is not null,'signup',new.email_confirmed_at is not null)
    on conflict(user_id) do nothing;
  if tg_op='UPDATE' and new.email_confirmed_at is not null then
    update public.gd_testers set active=true,email_activation_done=true
      where user_id=new.id and registration_source='signup' and not email_activation_done;
  end if;
  return new;
end;
$$;
drop trigger if exists gd_create_signup_profile on auth.users;
create trigger gd_create_signup_profile after insert on auth.users
for each row execute function public.gd_handle_signup_profile();
drop trigger if exists gd_activate_confirmed_signup on auth.users;
create trigger gd_activate_confirmed_signup after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.gd_handle_signup_profile();
revoke all on function public.gd_handle_signup_profile() from public,anon,authenticated;
commit;

-- 새 가입자는 Authentication > Users와 Table Editor > gd_testers에서 확인할 수 있습니다.
-- 이메일 인증 후 active가 자동으로 true가 됩니다. 운영자 승인 절차는 없습니다.
-- 기존 setup.sql의 SELECT 전용 RLS가 유지되며, 가입자가 스스로 active를 변경할 수 없습니다.

-- restore-workflow.sql
-- setup.sql -> menu-discovery.sql -> distance-matching.sql -> this file.
-- Records user confirmations only. No bank, payment or delivery-provider API is called.
begin;
alter table public.gd_posts add column if not exists pickup_lat double precision;
alter table public.gd_posts add column if not exists pickup_lng double precision;
alter table public.gd_testers add column if not exists suspended_until timestamptz;
create table if not exists public.gd_order_states (
  post_id uuid primary key references public.gd_posts(id) on delete cascade,
  phase text not null default 'menu' check(phase in('menu','payment','ordered','delivering','arrived','completed','cancelled')),
  meeting text not null default '', meeting_time timestamptz,
  meeting_lat double precision, meeting_lng double precision,
  bank text not null default '', account text not null default '', holder text not null default '',
  leader_ready boolean not null default false, reward_support boolean not null default false,
  nearby_requester uuid references public.gd_testers(user_id), nearby_address text,
  nearby_agreed boolean not null default false,
  arrived_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.gd_order_people (
  post_id uuid not null references public.gd_posts(id) on delete cascade,
  user_id uuid not null references public.gd_testers(user_id),
  food_total integer not null default 0, fee integer not null default 0,
  coupon_discount integer not null default 0,
  claimed_amount integer not null default 0, confirmed_amount integer not null default 0,
  refunded_amount integer not null default 0, refund_due integer not null default 0,
  refund_sent boolean not null default false,
  received_at timestamptz, late_reported boolean not null default false, late_ack boolean not null default false,
  latitude double precision, longitude double precision,
  primary key(post_id,user_id)
);
create table if not exists public.gd_reviews (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.gd_posts(id),
  reviewer_id uuid not null references public.gd_testers(user_id), subject_id uuid not null references public.gd_testers(user_id),
  stars integer not null check(stars between 1 and 5), comment text not null check(char_length(comment)<=500),
  created_at timestamptz not null default now(), unique(post_id,reviewer_id,subject_id), check(reviewer_id<>subject_id)
);
create table if not exists public.gd_reports (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.gd_posts(id),
  reporter_id uuid not null references public.gd_testers(user_id), subject_id uuid not null references public.gd_testers(user_id),
  reason text not null check(char_length(reason) between 1 and 80), detail text not null check(char_length(detail)<=1000),
  status text not null default 'pending' check(status in('pending','confirmed','dismissed')),
  resolution text, created_at timestamptz not null default now(),
  unique(post_id,reporter_id,subject_id), check(reporter_id<>subject_id)
);
alter table public.gd_order_states enable row level security;
alter table public.gd_order_people enable row level security;
alter table public.gd_reviews enable row level security;
alter table public.gd_reports enable row level security;
create or replace function public.gd_can_read_order(p_post uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.gd_is_tester() and exists(select 1 from gd_participations where post_id=p_post and user_id=auth.uid() and status in('accepted','withdrawn'));
$$;
drop policy if exists gd_order_state_read on public.gd_order_states;
create policy gd_order_state_read on public.gd_order_states for select to authenticated using(public.gd_can_read_order(post_id));
drop policy if exists gd_order_people_read on public.gd_order_people;
create policy gd_order_people_read on public.gd_order_people for select to authenticated using(
  public.gd_is_tester() and (user_id=auth.uid() or public.gd_is_member(post_id)));
drop policy if exists gd_review_read on public.gd_reviews;
create policy gd_review_read on public.gd_reviews for select to authenticated using(public.gd_is_tester());
drop policy if exists gd_report_read on public.gd_reports;
create policy gd_report_read on public.gd_reports for select to authenticated using(public.gd_is_tester() and auth.uid() in(reporter_id,subject_id));

create or replace function public.gd_reputation() returns table(user_id uuid,rating numeric,review_count bigint,trades bigint)
language sql stable security definer set search_path=public as $$
  select t.user_id,(select round(avg(r.stars),1) from gd_reviews r where r.subject_id=t.user_id),
    (select count(*) from gd_reviews r where r.subject_id=t.user_id),
    (select count(*) from gd_participations a join gd_order_states s on s.post_id=a.post_id where a.user_id=t.user_id and a.status='accepted' and s.phase='completed')
  from gd_testers t where public.gd_is_tester();
$$;

-- Private implementation, so phase and cancellation checks cannot be bypassed.
do $$ begin
  if to_regprocedure('public.gd_base_action_internal(text,uuid,jsonb)') is null then
    alter function public.gd_action(text,uuid,jsonb) rename to gd_base_action_internal;
  end if;
end $$;
revoke all on function public.gd_base_action_internal(text,uuid,jsonb) from public,anon,authenticated;

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
  if p_action='complete' then raise exception '모든 참여자가 직접 수령 완료를 눌러야 종료돼요.'; end if;
  if p_action in('apply','accept','reopen') and v_state.phase is not null and v_state.phase<>'menu' then raise exception '주문 내용이 확정되어 참여자를 바꿀 수 없어요.'; end if;
  if p_action in('apply','accept','reopen') and v_state.nearby_agreed then raise exception '내 근처 수령 합의를 해제한 뒤 인원을 변경해 주세요.'; end if;
  if p_action in('cancel','withdraw') and v_state.phase in('ordered','delivering','arrived','completed') then raise exception '주문 후에는 일반 취소가 불가능해요.'; end if;
  if p_action in('cancel','withdraw') and v_state.phase in('menu','payment') then
    if p_action='cancel' and v_owner=auth.uid() then
      update gd_order_states set phase='cancelled',updated_at=now() where post_id=p_post;
      update gd_order_people set refund_due=greatest(claimed_amount,confirmed_amount)-refunded_amount,refund_sent=false where post_id=p_post and user_id<>v_owner;
    elsif p_action='withdraw' and v_owner<>auth.uid() then
      update gd_order_people set refund_due=greatest(claimed_amount,confirmed_amount)-refunded_amount,refund_sent=false,food_total=0,fee=0,coupon_discount=0 where post_id=p_post and user_id=auth.uid();
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

-- Freeze menu edits once payment amounts have been agreed.
do $$ begin
  if to_regprocedure('public.gd_base_save_basket(uuid,jsonb)') is null then alter function public.gd_save_basket(uuid,jsonb) rename to gd_base_save_basket; end if;
end $$;
revoke all on function public.gd_base_save_basket(uuid,jsonb) from public,anon,authenticated;
create or replace function public.gd_save_basket(p_post uuid,p_items jsonb) returns void
language plpgsql security definer set search_path=public as $$ begin
  perform pg_advisory_xact_lock(73194628);
  if exists(select 1 from gd_order_states where post_id=p_post and phase<>'menu') then raise exception '확정된 메뉴는 변경할 수 없어요.'; end if;
  perform public.gd_base_save_basket(p_post,p_items);
end; $$;

do $$ begin
  if to_regprocedure('public.gd_base_save_intent(text[],text[],timestamptz,timestamptz,text,double precision,double precision)') is null then
    alter function public.gd_save_intent(text[],text[],timestamptz,timestamptz,text,double precision,double precision) rename to gd_base_save_intent;
  end if;
end $$;
revoke all on function public.gd_base_save_intent(text[],text[],timestamptz,timestamptz,text,double precision,double precision) from public,anon,authenticated;
create or replace function public.gd_save_intent(p_menus text[],p_stores text[],p_start timestamptz,p_end timestamptz,p_area text,p_lat double precision,p_lng double precision)
returns void language plpgsql security definer set search_path=public as $$ begin
  perform pg_advisory_xact_lock(73194628);
  if exists(select 1 from gd_testers where user_id=auth.uid() and suspended_until>now()) then raise exception '이용 제한 기간에는 새 메뉴 매칭을 시작할 수 없어요.'; end if;
  perform public.gd_base_save_intent(p_menus,p_stores,p_start,p_end,p_area,p_lat,p_lng);
end; $$;
revoke all on function public.gd_save_intent(text[],text[],timestamptz,timestamptz,text,double precision,double precision) from public,anon;
grant execute on function public.gd_save_intent(text[],text[],timestamptz,timestamptz,text,double precision,double precision) to authenticated;

create or replace function public.gd_order_action(p_action text,p_post uuid,p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_owner uuid; v_state gd_order_states%rowtype; v_post gd_posts%rowtype;
  v_target uuid; v_count int; v_total int; v_due int; v_discount int; v_coupon_total int; v_rating numeric; v_trades bigint;
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
    if v_state.phase<>'payment' or not v_state.reward_support or v_uid=v_owner or v_state.nearby_agreed then raise exception '주문 담당이 혜택 부담에 동의한 일반 모임에서 사용할 수 있어요.'; end if;
    select r.rating,r.trades into v_rating,v_trades from gd_reputation() r where r.user_id=v_uid;
    if coalesce(v_rating,0)<4.8 or coalesce(v_trades,0)<5 or exists(select 1 from gd_order_people x join gd_order_states s on s.post_id=x.post_id where x.user_id=v_uid and x.coupon_discount>0 and s.phase<>'cancelled') then raise exception '쿠폰 사용 조건을 확인해 주세요.'; end if;
    if exists(select 1 from gd_order_people where post_id=p_post and (claimed_amount>0 or confirmed_amount>0)) then raise exception '송금 전에 쿠폰을 적용해 주세요.'; end if;
    update gd_order_people set coupon_discount=least(1000,fee) where post_id=p_post and user_id=v_uid;
    select coalesce(sum(coupon_discount),0) into v_coupon_total from gd_order_people where post_id=p_post;
    update gd_order_people set fee=v_post.delivery_fee/v_count+v_post.delivery_fee%v_count+v_coupon_total where post_id=p_post and user_id=v_owner;return;
  end if;
  if v_uid<>v_owner then raise exception '주문 담당만 처리할 수 있어요.'; end if;
  if p_action='account' then
    if v_state.phase<>'menu' then raise exception '메뉴 확정 전에 계좌를 정해 주세요.'; end if;
    if char_length(btrim(coalesce(p_data->>'bank',''))) not between 1 and 30 or char_length(btrim(coalesce(p_data->>'account',''))) not between 1 and 40 or char_length(btrim(coalesce(p_data->>'holder',''))) not between 1 and 30 then raise exception '은행, 계좌번호와 예금주를 확인해 주세요.'; end if;
    update gd_order_states set bank=btrim(p_data->>'bank'),account=btrim(p_data->>'account'),holder=btrim(p_data->>'holder'),reward_support=coalesce((p_data->>'reward_support')::bool,false),updated_at=now() where post_id=p_post;
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

-- Project operator only: authenticated clients cannot impose sanctions on peers.
create or replace function public.gd_resolve_report(p_id uuid,p_confirm bool,p_note text,p_days int default 0) returns void
language plpgsql security definer set search_path=public as $$ declare v_target uuid; begin
  if p_days not between 0 and 30 then raise exception '정지 기간은 0~30일이에요.'; end if;
  update gd_reports set status=case when p_confirm then 'confirmed' else 'dismissed' end,resolution=p_note where id=p_id and status='pending' returning subject_id into v_target;
  if not found then raise exception '검토할 신고가 없어요.'; end if;
  if p_confirm and p_days>0 then update gd_testers set suspended_until=greatest(coalesce(suspended_until,now()),now()+make_interval(days=>p_days)) where user_id=v_target; end if;
end; $$;
revoke all on public.gd_order_states,public.gd_order_people,public.gd_reviews,public.gd_reports from anon,authenticated;
grant select on public.gd_order_states,public.gd_order_people,public.gd_reviews,public.gd_reports to authenticated;
revoke all on function public.gd_can_read_order(uuid),public.gd_reputation(),public.gd_order_action(text,uuid,jsonb),public.gd_action(text,uuid,jsonb),public.gd_save_basket(uuid,jsonb) from public,anon;
grant execute on function public.gd_can_read_order(uuid),public.gd_reputation(),public.gd_order_action(text,uuid,jsonb),public.gd_action(text,uuid,jsonb),public.gd_save_basket(uuid,jsonb) to authenticated;
revoke all on function public.gd_resolve_report(uuid,bool,text,int) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
