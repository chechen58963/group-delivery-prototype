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
