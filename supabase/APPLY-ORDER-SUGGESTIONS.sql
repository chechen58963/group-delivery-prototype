-- 주문 조합 제안. 기존 모집·메뉴·송금·환불 내역은 변경하지 않습니다.
begin;
select pg_advisory_xact_lock(73194628);
alter table public.gd_intents add column if not exists wish_store text;
alter table public.gd_intents add column if not exists wish_menu_id integer;
alter table public.gd_intents add column if not exists wish_quantity integer not null default 1 check(wish_quantity between 1 and 10);
alter table public.gd_intents add column if not exists flexibility text not null default 'exact' check(flexibility in('exact','brand','similar'));
alter table public.gd_intents add column if not exists ready_until timestamptz;

-- The expanded catalogue can contain more than four acceptable stores.
do $$ declare definition text; begin
  definition:=pg_get_functiondef('public.gd_base_save_intent(text[],text[],timestamptz,timestamptz,text,double precision,double precision)'::regprocedure);
  definition:=replace(definition,'cardinality(p_stores) not between 1 and 4','cardinality(p_stores) not between 1 and 20');
  execute definition;
end $$;
create or replace function public.gd_reset_order_preference() returns trigger
language plpgsql set search_path=public as $$ begin
  new.wish_store:=null;new.wish_menu_id:=null;new.ready_until:=null;
  return new;
end $$;
drop trigger if exists gd_reset_order_preference on public.gd_intents;
create trigger gd_reset_order_preference before update of menus,stores,starts_at,ends_at,latitude,longitude,area_id on public.gd_intents
for each row execute function public.gd_reset_order_preference();

create or replace function public.gd_menu_family(p_name text) returns text
language sql immutable set search_path='' as $$
 select case
 when p_name~'쿠키' then 'side:cookie' when p_name~'감자|후렌치|프렌치프라이' then 'side:fries'
 when p_name~'치즈볼|너겟|치킨너겟' then 'side:'||regexp_replace(p_name,'[[:space:]]','','g')
 when p_name~'아메리카노|메가리카노' then 'americano'
 when p_name~'바닐라.*라떼' then 'vanilla-latte'
 when p_name~'카페[[:space:]]*라떼' then 'cafe-latte'
 when p_name~'카푸치노' then 'cappuccino' when p_name~'카라멜.*마끼아또|캐러멜.*마키아토' then 'caramel-coffee'
 when p_name~'에그마요|에그[[:space:]]마요' then 'egg-sandwich'
 else 'named:'||regexp_replace(lower(p_name),'[[:space:]]','','g') end
$$;
create or replace function public.gd_recommended_item(p_store text,p_wish_store text,p_menu integer,p_flex text) returns jsonb
language sql stable security definer set search_path=public as $$
 with wish as (select c.menu_key,original.item from gd_menu_catalog c cross join lateral jsonb_array_elements(c.menus) original(item)
   where c.store_name=p_wish_store and (original.item->>'id')::int=p_menu)
 select candidate.item from gd_menu_catalog c cross join lateral jsonb_array_elements(c.menus) candidate(item) cross join wish w
 where c.store_name=p_store and c.menu_key=w.menu_key and (
   (p_store=p_wish_store and (candidate.item->>'id')::int=p_menu) or
   (p_flex in('brand','similar') and gd_menu_family(candidate.item->>'name')=gd_menu_family(w.item->>'name')) or
   (p_flex='similar' and gd_menu_family(candidate.item->>'name') not like 'side:%' and gd_menu_family(w.item->>'name') not like 'side:%'))
 order by (p_store=p_wish_store and (candidate.item->>'id')::int=p_menu) desc,
   (gd_menu_family(candidate.item->>'name')=gd_menu_family(w.item->>'name')) desc,
   abs((candidate.item->>'price')::int-(w.item->>'price')::int), (candidate.item->>'id')::int limit 1
$$;
create or replace function public.gd_save_order_preference(p_store text,p_menu integer,p_quantity integer,p_flex text,p_ready boolean,
 p_start timestamptz,p_end timestamptz,p_area text,p_lat double precision,p_lng double precision) returns void
language plpgsql security definer set search_path=public as $$
declare category text; allowed text[]; chosen_start timestamptz; chosen_end timestamptz; begin
 if not gd_is_tester() then raise exception '로그인한 뒤 메뉴를 선택해 주세요.'; end if;
 perform pg_advisory_xact_lock(73194628);
 if exists(select 1 from gd_testers where user_id=auth.uid() and suspended_until>now()) then raise exception '참여 제한 기간에는 새 매칭을 시작할 수 없어요.'; end if;
 if p_store is null or p_menu is null or p_flex is null or p_flex not in('exact','brand','similar') or p_quantity is null or p_quantity not between 1 and 10
   or p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) then raise exception '원하는 메뉴, 타협 범위와 출발 위치를 확인해 주세요.'; end if;
 select menu_key into category from gd_menu_catalog c where store_name=p_store and exists(select 1 from jsonb_array_elements(c.menus) m where (m->>'id')::int=p_menu);
 if category is null then raise exception '현재 가게에 있는 메뉴를 골라 주세요.'; end if;
 chosen_start:=case when p_ready then now() else p_start end;
 chosen_end:=case when p_ready then now()+interval '15 minutes' else p_end end;
 select array_agg(store_name order by store_name) into allowed from gd_menu_catalog c
 where c.menu_key=category and (p_flex<>'exact' or c.store_name=p_store) and gd_recommended_item(c.store_name,p_store,p_menu,p_flex) is not null;
 perform gd_save_intent(array[category],allowed,chosen_start,chosen_end,p_area,p_lat,p_lng);
 update gd_intents set wish_store=p_store,wish_menu_id=p_menu,wish_quantity=p_quantity,flexibility=p_flex,
   ready_until=case when p_ready then chosen_end else null end,updated_at=clock_timestamp() where user_id=auth.uid();
end $$;

create or replace function public.gd_order_suggestions() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(result order by ready_count desc,compromises,walk,food_total desc),'[]'::jsonb) from (
 select ready_count,compromises,walk,food_total,jsonb_build_object(
 'id',md5(me.user_id::text||other.user_id::text||c.store_name||me.updated_at::text||other.updated_at::text),
 'store',c.store_name,'menu_key',c.menu_key,'goal',c.goal_amount,'my_item',mine.item,'other_item',theirs.item,
 'my_quantity',me.wish_quantity,'other_quantity',other.wish_quantity,'other_name',t.nickname,'other_virtual',t.is_virtual,
 'food_total',food_total,'shortfall',greatest(0,c.goal_amount-food_total),'delivery_fee',3000,'my_fee',1500,
 'my_total',(mine.item->>'price')::int*me.wish_quantity+1500,'ready_count',ready_count,'compromises',compromises,
 'meeting',place.name,'meeting_lat',place.lat,'meeting_lng',place.lng,'walk_m',ceil(walk),
 'starts_at',greatest(me.starts_at,other.starts_at,date_trunc('minute',now())+interval '5 minutes'),
 'expires_at',least(me.ends_at,other.ends_at)) result
 from gd_intents me
 join gd_intents other on other.user_id<>me.user_id and other.active and other.ends_at>now()+interval '5 minutes'
   and greatest(me.starts_at,other.starts_at)<least(me.ends_at,other.ends_at)
 join gd_testers t on t.user_id=other.user_id and t.active and (t.suspended_until is null or t.suspended_until<=now())
 join gd_menu_catalog c on c.store_name=any(me.stores) and c.store_name=any(other.stores) and c.menu_key=any(me.menus) and c.menu_key=any(other.menus)
 cross join lateral (select gd_recommended_item(c.store_name,me.wish_store,me.wish_menu_id,me.flexibility) item) mine
 cross join lateral (select gd_recommended_item(c.store_name,other.wish_store,other.wish_menu_id,other.flexibility) item) theirs
 cross join lateral (select name,lat,lng,greatest(gd_match_distance_m(me.latitude,me.longitude,lat,lng),gd_match_distance_m(other.latitude,other.longitude,lat,lng)) walk
   from (values('충남대 정문',36.3621::float8,127.3444::float8),('충남대 중앙도서관 앞',36.3665,127.3451),('충남대 후문',36.3708,127.3472)) p(name,lat,lng)
   where gd_match_distance_m(me.latitude,me.longitude,lat,lng)<=400 and gd_match_distance_m(other.latitude,other.longitude,lat,lng)<=400
   order by walk,name limit 1) place
 cross join lateral (select (mine.item->>'price')::int*me.wish_quantity+(theirs.item->>'price')::int*other.wish_quantity food_total,
   (case when me.ready_until>now() then 1 else 0 end)+(case when other.ready_until>now() then 1 else 0 end) ready_count,
   (case when me.wish_store=c.store_name and me.wish_menu_id=(mine.item->>'id')::int then 0 else 1 end)+
   (case when other.wish_store=c.store_name and other.wish_menu_id=(theirs.item->>'id')::int then 0 else 1 end) compromises) scores
 where gd_is_tester() and me.user_id=auth.uid() and me.active and me.ends_at>now()+interval '5 minutes'
   and mine.item is not null and theirs.item is not null
   and not exists(select 1 from gd_testers x where x.user_id=me.user_id and x.suspended_until>now())
   and not exists(select 1 from gd_participations a where a.active and a.user_id in(me.user_id,other.user_id))
 order by ready_count desc,compromises,place.walk,food_total desc,c.store_name,other.user_id limit 6
 ) offers
$$;
revoke all on function public.gd_reset_order_preference(),public.gd_menu_family(text),public.gd_recommended_item(text,text,integer,text) from public,anon,authenticated;
revoke all on function public.gd_save_order_preference(text,integer,integer,text,boolean,timestamptz,timestamptz,text,double precision,double precision),public.gd_order_suggestions() from public,anon;
grant execute on function public.gd_save_order_preference(text,integer,integer,text,boolean,timestamptz,timestamptz,text,double precision,double precision),public.gd_order_suggestions() to authenticated;
notify pgrst,'reload schema';
commit;
select '주문 조합 제안 업데이트 적용 완료' as "확인";
