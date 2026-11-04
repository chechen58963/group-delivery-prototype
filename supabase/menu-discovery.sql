-- 기존 setup.sql 실행 후, 메뉴 선택·매칭 알림·주문 메뉴 공유 기능을 추가합니다.
begin;
create table if not exists public.gd_menu_catalog (
  store_name text primary key,
  menu_key text not null check(menu_key in ('coffee','burger','sandwich')),
  goal_amount integer not null check(goal_amount>=0),
  menus jsonb not null
);
insert into public.gd_menu_catalog values
('써브웨이 대전충남대정문점','sandwich',12000,'[{"id":1,"name":"에그마요 (15cm)","price":7200},{"id":2,"name":"이탈리안 비엠티 (15cm)","price":8500},{"id":3,"name":"로스트 치킨 (15cm)","price":9000},{"id":4,"name":"초코칩 쿠키","price":2100}]'),
('맘스터치 충남대점','burger',12000,'[{"id":1,"name":"싸이버거","price":4900},{"id":2,"name":"불싸이버거","price":5100},{"id":3,"name":"화이트갈릭버거","price":5500},{"id":4,"name":"간장마늘싸이버거","price":5400}]'),
('이디야커피 충대정문점','coffee',8000,'[{"id":1,"name":"카페 아메리카노","price":3200},{"id":2,"name":"카페 라떼","price":4200},{"id":3,"name":"토피 넛 라떼","price":4200}]'),
('메가MGC커피 대전충남대정문점','coffee',8000,'[{"id":1,"name":"메가리카노","price":3000},{"id":2,"name":"퐁크러쉬플레인","price":3900},{"id":3,"name":"쿠키프라페","price":3900}]')
on conflict(store_name) do update set menu_key=excluded.menu_key,goal_amount=excluded.goal_amount,menus=excluded.menus;

create table if not exists public.gd_intents (
  user_id uuid primary key references public.gd_testers(user_id) on delete cascade,
  menus text[] not null, stores text[] not null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  area_id text not null check(area_id in ('cnu-main','cnu-north','gungdong')),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at)
);
create table if not exists public.gd_menu_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.gd_testers(user_id) on delete cascade,
  peer_id uuid not null references public.gd_testers(user_id) on delete cascade,
  kind text not null check(kind in ('menu_match','group_invite')),
  signature text not null, payload jsonb not null,
  created_at timestamptz not null default now(), expires_at timestamptz not null,
  read_at timestamptz,
  unique(recipient_id,signature)
);
create table if not exists public.gd_baskets (
  post_id uuid not null references public.gd_posts(id) on delete cascade,
  user_id uuid not null references public.gd_testers(user_id),
  items jsonb not null, total integer not null check(total between 0 and 1000000),
  updated_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
alter table public.gd_menu_catalog enable row level security;
alter table public.gd_intents enable row level security;
alter table public.gd_menu_notifications enable row level security;
alter table public.gd_baskets enable row level security;
drop policy if exists gd_catalog_read on public.gd_menu_catalog;
create policy gd_catalog_read on public.gd_menu_catalog for select to anon,authenticated using(true);
drop policy if exists gd_intent_read on public.gd_intents;
create policy gd_intent_read on public.gd_intents for select to authenticated using(public.gd_is_tester() and user_id=auth.uid());
drop policy if exists gd_menu_notification_read on public.gd_menu_notifications;
create policy gd_menu_notification_read on public.gd_menu_notifications for select to authenticated
  using(public.gd_is_tester() and recipient_id=auth.uid());
drop policy if exists gd_basket_read on public.gd_baskets;
create policy gd_basket_read on public.gd_baskets for select to authenticated
  using(public.gd_is_tester() and (user_id=auth.uid() or public.gd_is_owner(post_id) or
    (public.gd_is_member(post_id) and exists(select 1 from public.gd_participations a
      where a.post_id=gd_baskets.post_id and a.user_id=gd_baskets.user_id and a.status='accepted'))));

create or replace function public.gd_save_intent(p_menus text[],p_stores text[],p_start timestamptz,p_end timestamptz,p_area text)
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
    or p_area is null or p_area not in ('cnu-main','cnu-north','gungdong') then
    raise exception '메뉴와 가능한 가게, 지역, 시간대를 확인해 주세요.';
  end if;
  if exists(select 1 from unnest(p_stores) s where not exists(select 1 from public.gd_menu_catalog c
    where c.store_name=s and c.menu_key=any(p_menus))) then raise exception '선택한 메뉴에 해당하는 가게를 골라 주세요.'; end if;
  select * into v_old from public.gd_intents where user_id=auth.uid();
  if found and v_old.active and v_old.menus=p_menus and v_old.stores=p_stores and v_old.starts_at=p_start and v_old.ends_at=p_end and v_old.area_id=p_area then return; end if;
  update public.gd_menu_notifications set expires_at=least(expires_at,now()) where recipient_id=auth.uid() or peer_id=auth.uid();
  insert into public.gd_intents(user_id,menus,stores,starts_at,ends_at,area_id)
    values(auth.uid(),p_menus,p_stores,p_start,p_end,p_area)
    on conflict(user_id) do update set menus=excluded.menus,stores=excluded.stores,starts_at=excluded.starts_at,
      ends_at=excluded.ends_at,area_id=excluded.area_id,active=true,updated_at=now();
  for v_other in select i.* from public.gd_intents i join public.gd_testers t on t.user_id=i.user_id and t.active
    where i.user_id<>auth.uid() and i.active and i.ends_at>now() and i.area_id=p_area
    and greatest(i.starts_at,p_start)<least(i.ends_at,p_end) and i.stores&&p_stores
    and not exists(select 1 from public.gd_participations a where a.user_id=i.user_id and a.active)
  loop
    select array_agg(distinct s order by s) into v_shared from unnest(p_stores) s where s=any(v_other.stores);
    v_exp:=least(p_end,v_other.ends_at);
    v_sig:=md5(least(auth.uid()::text,v_other.user_id::text)||greatest(auth.uid()::text,v_other.user_id::text)||p_area||v_shared::text||greatest(p_start,v_other.starts_at)::text||v_exp::text);
    insert into public.gd_menu_notifications(recipient_id,peer_id,kind,signature,payload,expires_at)
      values(auth.uid(),v_other.user_id,'menu_match',v_sig,jsonb_build_object('stores',v_shared,'area',p_area,'starts_at',greatest(p_start,v_other.starts_at),'ends_at',v_exp),v_exp),
      (v_other.user_id,auth.uid(),'menu_match',v_sig,jsonb_build_object('stores',v_shared,'area',p_area,'starts_at',greatest(p_start,v_other.starts_at),'ends_at',v_exp),v_exp)
      on conflict(recipient_id,signature) do update set expires_at=excluded.expires_at;
  end loop;
end; $$;

create or replace function public.gd_cancel_intent() returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.gd_is_tester() then raise exception '접근 권한이 없어요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  update public.gd_intents set active=false,updated_at=now() where user_id=auth.uid();
  update public.gd_menu_notifications set expires_at=least(expires_at,now()) where recipient_id=auth.uid() or peer_id=auth.uid();
end; $$;

create or replace function public.gd_find_menu_matches() returns table(store_name text,people_count bigint)
language sql stable security definer set search_path=public as $$
  select c.store_name,count(distinct other.user_id) from public.gd_intents me
  join public.gd_menu_catalog c on c.store_name=any(me.stores)
  join public.gd_intents other on other.user_id<>me.user_id and other.active and other.ends_at>now()
    and other.area_id=me.area_id and c.store_name=any(other.stores)
    and greatest(me.starts_at,other.starts_at)<least(me.ends_at,other.ends_at)
  join public.gd_testers t on t.user_id=other.user_id and t.active
  where public.gd_is_tester() and me.user_id=auth.uid() and me.active and me.ends_at>now()
    and not exists(select 1 from public.gd_participations a where a.active and a.user_id in(me.user_id,other.user_id))
  group by c.store_name;
$$;

create or replace function public.gd_mark_menu_notifications(p_ids uuid[]) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.gd_is_tester() then raise exception '접근 권한이 없어요.'; end if;
  update public.gd_menu_notifications set read_at=now() where recipient_id=auth.uid() and id=any(p_ids);
end; $$;

create or replace function public.gd_invite_menu_matches(p_post uuid) returns void
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
  for v_other in select i.* from public.gd_intents i join public.gd_testers t on i.user_id=t.user_id and t.active
    where i.user_id<>auth.uid() and i.active and i.ends_at>now() and i.area_id=v_me.area_id
    and v_post.restaurant=any(i.stores) and greatest(i.starts_at,v_me.starts_at)<least(i.ends_at,v_me.ends_at)
    and not exists(select 1 from public.gd_participations a where a.user_id=i.user_id and a.active)
  loop
    insert into public.gd_menu_notifications(recipient_id,peer_id,kind,signature,payload,expires_at)
      values(v_other.user_id,auth.uid(),'group_invite','post:'||p_post::text,
        jsonb_build_object('post_id',p_post,'stores',array[v_post.restaurant],'area',v_me.area_id),least(v_post.deadline,v_other.ends_at))
      on conflict(recipient_id,signature) do nothing;
  end loop;
end; $$;

create or replace function public.gd_save_basket(p_post uuid,p_items jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare v_catalog jsonb; v_items jsonb; v_total integer;
begin
  if not public.gd_is_tester() then raise exception '접근 권한이 없어요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  if not exists(select 1 from public.gd_participations a join public.gd_posts p on p.id=a.post_id
    where a.post_id=p_post and a.user_id=auth.uid() and a.active and a.status in('pending','accepted') and p.status in('open','closed')) then
    raise exception '참여 중인 주문의 메뉴만 저장할 수 있어요.';
  end if;
  select c.menus into v_catalog from public.gd_menu_catalog c join public.gd_posts p on p.restaurant=c.store_name where p.id=p_post;
  if v_catalog is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception '메뉴를 한 개 이상 골라 주세요.'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where (x->>'quantity')::int not between 1 and 10
    or x->>'quantity' is null or not exists(select 1 from jsonb_array_elements(v_catalog) c where c->>'id'=x->>'id'))
    or (select count(distinct x->>'id') from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception '메뉴와 수량을 확인해 주세요.'; end if;
  select jsonb_agg(jsonb_build_object('id',(c->>'id')::int,'name',c->>'name','price',(c->>'price')::int,'quantity',(x->>'quantity')::int)),
    sum((c->>'price')::int*(x->>'quantity')::int)::int into v_items,v_total
    from jsonb_array_elements(p_items) x join jsonb_array_elements(v_catalog) c on c->>'id'=x->>'id';
  insert into public.gd_baskets(post_id,user_id,items,total) values(p_post,auth.uid(),v_items,v_total)
    on conflict(post_id,user_id) do update set items=excluded.items,total=excluded.total,updated_at=now();
end; $$;

revoke all on public.gd_menu_catalog,public.gd_intents,public.gd_menu_notifications,public.gd_baskets from anon,authenticated;
grant select on public.gd_menu_catalog to anon,authenticated;
grant select on public.gd_intents,public.gd_menu_notifications,public.gd_baskets to authenticated;
revoke all on function public.gd_save_intent(text[],text[],timestamptz,timestamptz,text),public.gd_cancel_intent(),public.gd_find_menu_matches(),public.gd_mark_menu_notifications(uuid[]),public.gd_invite_menu_matches(uuid),public.gd_save_basket(uuid,jsonb) from public,anon;
grant execute on function public.gd_save_intent(text[],text[],timestamptz,timestamptz,text),public.gd_cancel_intent(),public.gd_find_menu_matches(),public.gd_mark_menu_notifications(uuid[]),public.gd_invite_menu_matches(uuid),public.gd_save_basket(uuid,jsonb) to authenticated;
commit;
