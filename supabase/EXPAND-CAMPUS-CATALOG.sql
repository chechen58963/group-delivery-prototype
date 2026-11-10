-- Append stores and menu IDs without replacing existing prices or orders.
begin;
select pg_advisory_xact_lock(73194628);
create temporary table expansion_catalog(store_name text,menu_key text,goal_amount integer,menus jsonb) on commit drop;
insert into expansion_catalog values
('써브웨이 대전충남대정문점','sandwich',12000,'[{"id": 1, "name": "에그마요 (15cm)", "price": 7200}, {"id": 2, "name": "이탈리안 비엠티 (15cm)", "price": 8500}, {"id": 3, "name": "로스트 치킨 (15cm)", "price": 9000}, {"id": 4, "name": "초코칩 쿠키", "price": 2100}, {"id": 5, "name": "스테이크 & 치즈 (15cm)", "price": 10200}, {"id": 6, "name": "로티세리 바비큐 치킨 (15cm)", "price": 9500}, {"id": 7, "name": "쉬림프 (15cm)", "price": 9500}, {"id": 8, "name": "참치 (15cm)", "price": 7800}, {"id": 9, "name": "비엘티 (15cm)", "price": 8500}, {"id": 10, "name": "베지 (15cm)", "price": 6500}, {"id": 11, "name": "더블 초코칩 쿠키", "price": 2100}, {"id": 12, "name": "화이트 초코 마카다미아 쿠키", "price": 2100}]'::jsonb),
('맘스터치 충남대점','burger',12000,'[{"id": 1, "name": "싸이버거", "price": 4900}, {"id": 2, "name": "불싸이버거", "price": 5100}, {"id": 3, "name": "화이트갈릭버거", "price": 5500}, {"id": 4, "name": "간장마늘싸이버거", "price": 5400}, {"id": 5, "name": "휠렛버거", "price": 4700}, {"id": 6, "name": "딥치즈버거", "price": 5400}, {"id": 7, "name": "싸이플렉스버거", "price": 8000}, {"id": 8, "name": "인크레더블버거", "price": 6200}, {"id": 9, "name": "케이준양념감자 (중)", "price": 2300}, {"id": 10, "name": "코울슬로", "price": 2000}, {"id": 11, "name": "콘샐러드", "price": 2000}, {"id": 12, "name": "바삭크림치즈볼 (4조각)", "price": 3700}]'::jsonb),
('이디야커피 충대정문점','coffee',8000,'[{"id": 1, "name": "카페 아메리카노", "price": 3200}, {"id": 2, "name": "카페 라떼", "price": 4200}, {"id": 3, "name": "토피 넛 라떼", "price": 4200}, {"id": 4, "name": "바닐라 라떼", "price": 4500}, {"id": 5, "name": "카페 모카", "price": 4500}, {"id": 6, "name": "카라멜 마끼아또", "price": 4500}, {"id": 7, "name": "콜드브루", "price": 3900}, {"id": 8, "name": "아이스티 복숭아", "price": 2900}, {"id": 9, "name": "초콜릿", "price": 4200}, {"id": 10, "name": "녹차 라떼", "price": 4200}, {"id": 11, "name": "딸기 요거트 플랫치노", "price": 4500}, {"id": 12, "name": "플레인 와플", "price": 2900}]'::jsonb),
('메가MGC커피 대전충남대정문점','coffee',8000,'[{"id": 1, "name": "메가리카노", "price": 3000}, {"id": 2, "name": "퐁크러쉬플레인", "price": 3900}, {"id": 3, "name": "쿠키프라페", "price": 3900}, {"id": 4, "name": "아메리카노 (ICED)", "price": 2000}, {"id": 5, "name": "카페라떼", "price": 2900}, {"id": 6, "name": "바닐라라떼", "price": 3400}, {"id": 7, "name": "카라멜마끼아또", "price": 3700}, {"id": 8, "name": "복숭아아이스티", "price": 3000}, {"id": 9, "name": "딸기라떼", "price": 3900}, {"id": 10, "name": "레몬에이드", "price": 3500}, {"id": 11, "name": "청포도에이드", "price": 3500}, {"id": 12, "name": "플레인요거트스무디", "price": 3900}]'::jsonb),
('컴포즈커피 대전충남대점','coffee',8000,'[{"id": 1, "name": "아메리카노 (HOT)", "price": 1500}, {"id": 2, "name": "아메리카노 (ICED)", "price": 1800}, {"id": 3, "name": "카페라떼", "price": 2900}, {"id": 4, "name": "바닐라라떼", "price": 3300}, {"id": 5, "name": "카라멜마끼아또", "price": 3500}, {"id": 6, "name": "카페모카", "price": 3500}, {"id": 7, "name": "딸기라떼", "price": 3800}, {"id": 8, "name": "쿠키초코프라페", "price": 3900}]'::jsonb),
('빽다방 충남대후문점','coffee',8000,'[{"id": 1, "name": "앗!메리카노 (HOT)", "price": 1500}, {"id": 2, "name": "바닐라라떼 (HOT)", "price": 3000}, {"id": 3, "name": "원조커피 (HOT)", "price": 2000}, {"id": 4, "name": "완전초코 (ICED)", "price": 3500}, {"id": 5, "name": "옥수크림", "price": 2500}, {"id": 6, "name": "사라다빵", "price": 2500}, {"id": 7, "name": "아이스티샷추가 (아샷추)", "price": 3000}, {"id": 8, "name": "원조커피 (ICED)", "price": 2500}]'::jsonb),
('롯데리아 충남대점','burger',12000,'[{"id": 1, "name": "리아 사각새우 더블 세트", "price": 9900}, {"id": 2, "name": "모짜렐라 인 더 버거 베이컨 세트", "price": 11700}, {"id": 3, "name": "새우버거", "price": 6000}, {"id": 4, "name": "치킨버거", "price": 5400}, {"id": 5, "name": "데리버거", "price": 4700}, {"id": 6, "name": "치킨휠레 (4조각)", "price": 6400}, {"id": 7, "name": "화이어윙 (2조각)", "price": 4300}, {"id": 8, "name": "치킨휠레 (2조각)", "price": 4200}, {"id": 9, "name": "치킨다리 (1조각)", "price": 4000}, {"id": 10, "name": "치킨다리 하프팩 (코울슬로)", "price": 12500}]'::jsonb),
('더벤티 충남대점','coffee',8000,'[{"id": 1, "name": "아이스 아메리카노", "price": 2000}, {"id": 2, "name": "허니레몬에이드", "price": 3900}, {"id": 3, "name": "바닐라딥라떼 (HOT)", "price": 3700}, {"id": 4, "name": "저당 말차라떼 (HOT)", "price": 3500}, {"id": 5, "name": "더쌍화라떼 (HOT)", "price": 3800}, {"id": 6, "name": "디카페인 코코넛라떼 (HOT)", "price": 4500}, {"id": 7, "name": "오렌지과채주스", "price": 4300}, {"id": 8, "name": "카페라떼", "price": 3000}]'::jsonb);
do $$ begin
 if exists(select 1 from expansion_catalog n join gd_menu_catalog c using(store_name),jsonb_array_elements(n.menus) x,jsonb_array_elements(c.menus) y where x->>'id'=y->>'id' and x->>'name'<>y->>'name') then
 raise exception 'Existing menu IDs differ. Keep existing orders and review the catalog before applying.';
 end if;
end $$;
insert into public.gd_menu_catalog as c(store_name,menu_key,goal_amount,menus)
select store_name,menu_key,goal_amount,menus from expansion_catalog
on conflict(store_name) do update set menus=(
 select jsonb_agg(item order by (item->>'id')::int) from (
 select item from jsonb_array_elements(c.menus) item
 union all
 select item from jsonb_array_elements(excluded.menus) item where not exists(select 1 from jsonb_array_elements(c.menus) old where old->>'id'=item->>'id')
 ) all_items
);
create or replace function public.gd_base_save_intent(p_menus text[],p_stores text[],p_start timestamptz,p_end timestamptz,p_area text,p_lat double precision,p_lng double precision)
returns void language plpgsql security definer set search_path=public as $$
declare v_old public.gd_intents%rowtype; v_other public.gd_intents%rowtype; v_shared text[]; v_sig text; v_exp timestamptz;
begin
  if not public.gd_is_tester() then raise exception '로그인한 참여자만 선택을 저장할 수 있어요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  if exists(select 1 from public.gd_participations where user_id=auth.uid() and active) then
    raise exception '진행 중인 주문을 마친 뒤 새 메뉴를 찾아 주세요.';
  end if;
  if p_menus is null or cardinality(p_menus) not between 1 and 3 or not(p_menus<@array['coffee','burger','sandwich'])
    or p_stores is null or cardinality(p_stores) not between 1 and 20
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
revoke all on function public.gd_base_save_intent(text[],text[],timestamptz,timestamptz,text,double precision,double precision) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
select count(*) as stores, sum(jsonb_array_length(menus)) as menus from public.gd_menu_catalog;
