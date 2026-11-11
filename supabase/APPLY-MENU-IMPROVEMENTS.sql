-- 메뉴 표시 및 HOT/ICE 저장, 모집 진행 합계. 기존 주문과 메뉴 가격은 변경하지 않습니다.
begin;
select pg_advisory_xact_lock(73194628);
with definitions(store_name,id,name,temperatures,size_label,section) as (values
('써브웨이 대전충남대정문점',1,'에그마요 (15cm)','[]','15cm','샌드위치'),
('써브웨이 대전충남대정문점',2,'이탈리안 비엠티 (15cm)','[]','15cm','샌드위치'),
('써브웨이 대전충남대정문점',3,'로스트 치킨 (15cm)','[]','15cm','샌드위치'),
('써브웨이 대전충남대정문점',4,'초코칩 쿠키','[]','기본','디저트'),
('써브웨이 대전충남대정문점',5,'스테이크 & 치즈 (15cm)','[]','15cm','샌드위치'),
('써브웨이 대전충남대정문점',6,'로티세리 바비큐 치킨 (15cm)','[]','15cm','샌드위치'),
('써브웨이 대전충남대정문점',7,'쉬림프 (15cm)','[]','15cm','샌드위치'),
('써브웨이 대전충남대정문점',8,'참치 (15cm)','[]','15cm','샌드위치'),
('써브웨이 대전충남대정문점',9,'비엘티 (15cm)','[]','15cm','샌드위치'),
('써브웨이 대전충남대정문점',10,'베지 (15cm)','[]','15cm','샌드위치'),
('써브웨이 대전충남대정문점',11,'더블 초코칩 쿠키','[]','기본','디저트'),
('써브웨이 대전충남대정문점',12,'화이트 초코 마카다미아 쿠키','[]','기본','디저트'),
('맘스터치 충남대점',1,'싸이버거','[]','기본','버거'),
('맘스터치 충남대점',2,'불싸이버거','[]','기본','버거'),
('맘스터치 충남대점',3,'화이트갈릭버거','[]','기본','버거'),
('맘스터치 충남대점',4,'간장마늘싸이버거','[]','기본','버거'),
('맘스터치 충남대점',5,'휠렛버거','[]','기본','버거'),
('맘스터치 충남대점',6,'딥치즈버거','[]','기본','버거'),
('맘스터치 충남대점',7,'싸이플렉스버거','[]','기본','버거'),
('맘스터치 충남대점',8,'인크레더블버거','[]','기본','버거'),
('맘스터치 충남대점',9,'케이준양념감자 (중)','[]','중','사이드'),
('맘스터치 충남대점',10,'코울슬로','[]','기본','사이드'),
('맘스터치 충남대점',11,'콘샐러드','[]','기본','사이드'),
('맘스터치 충남대점',12,'바삭크림치즈볼 (4조각)','[]','4조각','사이드'),
('이디야커피 충대정문점',1,'카페 아메리카노','["HOT", "ICE"]','기본','커피'),
('이디야커피 충대정문점',2,'카페 라떼','["HOT", "ICE"]','기본','커피'),
('이디야커피 충대정문점',3,'토피 넛 라떼','["HOT", "ICE"]','기본','기타 음료'),
('이디야커피 충대정문점',4,'바닐라 라떼','["HOT", "ICE"]','기본','커피'),
('이디야커피 충대정문점',5,'카페 모카','["HOT", "ICE"]','기본','커피'),
('이디야커피 충대정문점',6,'카라멜 마끼아또','["HOT", "ICE"]','기본','커피'),
('이디야커피 충대정문점',7,'콜드브루','["ICE"]','기본','커피'),
('이디야커피 충대정문점',8,'아이스티 복숭아','["ICE"]','기본','티·에이드·주스'),
('이디야커피 충대정문점',9,'초콜릿','[]','기본','기타 음료'),
('이디야커피 충대정문점',10,'녹차 라떼','[]','기본','기타 음료'),
('이디야커피 충대정문점',11,'딸기 요거트 플랫치노','["ICE"]','기본','스무디·프라페'),
('이디야커피 충대정문점',12,'플레인 와플','[]','기본','디저트'),
('메가MGC커피 대전충남대정문점',1,'메가리카노','["ICE"]','기본','커피'),
('메가MGC커피 대전충남대정문점',2,'퐁크러쉬플레인','["ICE"]','기본','스무디·프라페'),
('메가MGC커피 대전충남대정문점',3,'쿠키프라페','["ICE"]','기본','스무디·프라페'),
('메가MGC커피 대전충남대정문점',4,'아메리카노 (ICED)','["ICE"]','기본','커피'),
('메가MGC커피 대전충남대정문점',5,'카페라떼','["HOT", "ICE"]','기본','커피'),
('메가MGC커피 대전충남대정문점',6,'바닐라라떼','["HOT", "ICE"]','기본','커피'),
('메가MGC커피 대전충남대정문점',7,'카라멜마끼아또','["HOT", "ICE"]','기본','커피'),
('메가MGC커피 대전충남대정문점',8,'복숭아아이스티','["ICE"]','기본','티·에이드·주스'),
('메가MGC커피 대전충남대정문점',9,'딸기라떼','["ICE"]','기본','기타 음료'),
('메가MGC커피 대전충남대정문점',10,'레몬에이드','["ICE"]','기본','티·에이드·주스'),
('메가MGC커피 대전충남대정문점',11,'청포도에이드','["ICE"]','기본','티·에이드·주스'),
('메가MGC커피 대전충남대정문점',12,'플레인요거트스무디','["ICE"]','기본','스무디·프라페'),
('컴포즈커피 대전충남대점',1,'아메리카노 (HOT)','["HOT"]','기본','커피'),
('컴포즈커피 대전충남대점',2,'아메리카노 (ICED)','["ICE"]','기본','커피'),
('컴포즈커피 대전충남대점',3,'카페라떼','["HOT", "ICE"]','기본','커피'),
('컴포즈커피 대전충남대점',4,'바닐라라떼','["HOT", "ICE"]','기본','커피'),
('컴포즈커피 대전충남대점',5,'카라멜마끼아또','["HOT", "ICE"]','기본','커피'),
('컴포즈커피 대전충남대점',6,'카페모카','["HOT", "ICE"]','기본','커피'),
('컴포즈커피 대전충남대점',7,'딸기라떼','["ICE"]','기본','기타 음료'),
('컴포즈커피 대전충남대점',8,'쿠키초코프라페','["ICE"]','기본','스무디·프라페'),
('빽다방 충남대후문점',1,'앗!메리카노 (HOT)','["HOT"]','기본','커피'),
('빽다방 충남대후문점',2,'바닐라라떼 (HOT)','["HOT"]','기본','커피'),
('빽다방 충남대후문점',3,'원조커피 (HOT)','["HOT"]','기본','커피'),
('빽다방 충남대후문점',4,'완전초코 (ICED)','["ICE"]','기본','기타 음료'),
('빽다방 충남대후문점',5,'옥수크림','[]','기본','디저트'),
('빽다방 충남대후문점',6,'사라다빵','[]','기본','디저트'),
('빽다방 충남대후문점',7,'아이스티샷추가 (아샷추)','["ICE"]','기본','티·에이드·주스'),
('빽다방 충남대후문점',8,'원조커피 (ICED)','["ICE"]','기본','커피'),
('롯데리아 충남대점',1,'리아 사각새우 더블 세트','[]','기본','세트'),
('롯데리아 충남대점',2,'모짜렐라 인 더 버거 베이컨 세트','[]','기본','세트'),
('롯데리아 충남대점',3,'새우버거','[]','기본','버거'),
('롯데리아 충남대점',4,'치킨버거','[]','기본','버거'),
('롯데리아 충남대점',5,'데리버거','[]','기본','버거'),
('롯데리아 충남대점',6,'치킨휠레 (4조각)','[]','4조각','사이드'),
('롯데리아 충남대점',7,'화이어윙 (2조각)','[]','2조각','사이드'),
('롯데리아 충남대점',8,'치킨휠레 (2조각)','[]','2조각','사이드'),
('롯데리아 충남대점',9,'치킨다리 (1조각)','[]','1조각','사이드'),
('롯데리아 충남대점',10,'치킨다리 하프팩 (코울슬로)','[]','기본','세트'),
('더벤티 충남대점',1,'아이스 아메리카노','["ICE"]','기본','커피'),
('더벤티 충남대점',2,'허니레몬에이드','["ICE"]','기본','티·에이드·주스'),
('더벤티 충남대점',3,'바닐라딥라떼 (HOT)','["HOT"]','기본','커피'),
('더벤티 충남대점',4,'저당 말차라떼 (HOT)','["HOT"]','기본','기타 음료'),
('더벤티 충남대점',5,'더쌍화라떼 (HOT)','["HOT"]','기본','기타 음료'),
('더벤티 충남대점',6,'디카페인 코코넛라떼 (HOT)','["HOT"]','기본','커피'),
('더벤티 충남대점',7,'오렌지과채주스','["ICE"]','기본','티·에이드·주스'),
('더벤티 충남대점',8,'카페라떼','["HOT", "ICE"]','기본','커피')
), additions as (
  select c.store_name,jsonb_agg(case when d.id is not null then item || jsonb_build_object('temperature_options',d.temperatures::jsonb,'size_label',d.size_label,'section',d.section) else item end order by pos) as menus
  from public.gd_menu_catalog c cross join lateral jsonb_array_elements(c.menus) with ordinality x(item,pos)
  left join definitions d on d.store_name=c.store_name and d.id=(item->>'id')::int and d.name=item->>'name'
  group by c.store_name
)
update public.gd_menu_catalog c set menus=a.menus from additions a where a.store_name=c.store_name;

create or replace function public.gd_save_menu_basket(p_post uuid,p_items jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare v_catalog jsonb;v_item jsonb;v_menu jsonb;v_temp text;v_options jsonb;v_qty int;v_base jsonb;v_saved jsonb:='[]'::jsonb;v_name text;v_size text;
begin
  if not public.gd_is_tester() then raise exception '로그인이 필요해요.';end if;
  perform pg_advisory_xact_lock(73194628);
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception '메뉴를 한 개 이상 골라 주세요.';end if;
  if jsonb_array_length(p_items) not between 1 and 40 then raise exception '메뉴와 수량을 확인해 주세요.';end if;
  select c.menus into v_catalog from public.gd_menu_catalog c join public.gd_posts p on p.restaurant=c.store_name where p.id=p_post;
  if v_catalog is null then raise exception '등록된 메뉴를 확인해 주세요.';end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'id','')!~'^[0-9]{1,8}$' or coalesce(v_item->>'quantity','')!~'^[0-9]{1,2}$' then raise exception '메뉴와 수량을 확인해 주세요.';end if;
    v_qty:=(v_item->>'quantity')::int;
    if v_qty not between 1 and 10 then raise exception '메뉴별 수량은 1~10개로 정해 주세요.';end if;
    select value into v_menu from jsonb_array_elements(v_catalog) where value->>'id'=v_item->>'id';
    if v_menu is null then raise exception '등록된 메뉴를 골라 주세요.';end if;
    v_options:=coalesce(v_menu->'temperature_options','[]'::jsonb);v_temp:=nullif(v_item->>'temperature','');
    if jsonb_array_length(v_options)=1 and v_temp is null then v_temp:=v_options->>0;end if;
    if (jsonb_array_length(v_options)>0 and (v_temp is null or not(v_options ? v_temp))) or (jsonb_array_length(v_options)=0 and v_temp is not null) then raise exception '메뉴의 HOT·ICE 옵션을 확인해 주세요.';end if;
    if exists(select 1 from jsonb_array_elements(v_saved) x where x->>'id'=v_item->>'id' and coalesce(x->>'temperature','')=coalesce(v_temp,'')) then raise exception '같은 메뉴 옵션은 수량을 합쳐 주세요.';end if;
    v_size:=coalesce(v_menu->>'size_label','기본');
    v_name:=v_menu->>'name';
    if v_temp is not null and v_name!~*'(\(HOT\)|\(ICED\)|아이스)' then v_name:=v_name||' · '||v_temp;end if;
    v_saved:=v_saved||jsonb_build_array(jsonb_build_object('id',(v_menu->>'id')::int,'name',v_name,'base_name',v_menu->>'name','price',(v_menu->>'price')::int,'quantity',v_qty,'temperature',v_temp,'size_label',v_size));
  end loop;
  if exists(select 1 from jsonb_array_elements(v_saved) x group by x->>'id' having sum((x->>'quantity')::int)>10) then raise exception '같은 메뉴는 HOT·ICE를 합해 10개까지 담을 수 있어요.';end if;
  select jsonb_agg(jsonb_build_object('id',id,'quantity',quantity) order by id) into v_base from (
    select (x->>'id')::int as id,sum((x->>'quantity')::int)::int as quantity from jsonb_array_elements(v_saved) x group by x->>'id'
  ) grouped;
  -- Existing procedure preserves membership checks, phase locks and authoritative catalog prices.
  perform public.gd_save_basket(p_post,v_base);
  update public.gd_baskets set items=v_saved where post_id=p_post and user_id=auth.uid();
end;$$;

create or replace function public.gd_menu_selection_info() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_progress jsonb;
begin
  if not public.gd_is_tester() then raise exception '로그인이 필요해요.';end if;
  select coalesce(jsonb_agg(jsonb_build_object('post_id',id,'food_total',total,'selected_people',selected)),'[]'::jsonb) into v_progress from (
    select p.id,coalesce(sum(b.total),0)::int total,count(b.user_id)::int selected
    from public.gd_posts p
    left join public.gd_participations a on a.post_id=p.id and a.status='accepted' and a.active
    left join public.gd_baskets b on b.post_id=p.id and b.user_id=a.user_id and b.total>0
    where p.status='open' and p.deadline>now()
    group by p.id
  ) aggregate_only;
  return jsonb_build_object('version',1,'progress',v_progress);
end;$$;
revoke all on function public.gd_save_menu_basket(uuid,jsonb),public.gd_menu_selection_info() from public,anon;
grant execute on function public.gd_save_menu_basket(uuid,jsonb),public.gd_menu_selection_info() to authenticated;
notify pgrst,'reload schema';
commit;
select '메뉴 개선 업데이트 적용 완료' as 확인;
