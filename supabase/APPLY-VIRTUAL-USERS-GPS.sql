-- 기존 피드백/메뉴/포인트 업데이트 이후 전체 실행. 실제 회원의 인증 정보는 변경하지 않습니다.
begin;
select pg_advisory_xact_lock(73194628);

-- 서비스의 등장인물과 로그인 계정을 분리합니다. 가상 유저는 로그인 계정이 없습니다.
create table if not exists public.gd_actor_identities (
  user_id uuid primary key,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  virtual boolean not null default false,
  check ((virtual and auth_user_id is null) or (not virtual and auth_user_id is not null and auth_user_id=user_id))
);
alter table public.gd_actor_identities enable row level security;
revoke all on public.gd_actor_identities from public,anon,authenticated;
insert into public.gd_actor_identities(user_id,auth_user_id) select id,id from auth.users on conflict do nothing;
alter table public.gd_testers add column if not exists is_virtual boolean not null default false;
create or replace function public.gd_register_actor_identity() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from gd_actor_identities where user_id=new.user_id) then
    insert into gd_actor_identities(user_id,auth_user_id) select id,id from auth.users where id=new.user_id on conflict do nothing;
  end if;
  if not exists(select 1 from gd_actor_identities where user_id=new.user_id and virtual=new.is_virtual) then raise exception '유효하지 않은 사용자 정보예요.'; end if;
  return new;
end; $$;
drop trigger if exists gd_register_actor on public.gd_testers;
create trigger gd_register_actor before insert or update of user_id,is_virtual on public.gd_testers for each row execute function public.gd_register_actor_identity();
do $$ declare r record; begin
  for r in select conname from pg_constraint where conrelid='public.gd_testers'::regclass and confrelid='auth.users'::regclass and contype='f'
  loop execute format('alter table public.gd_testers drop constraint %I',r.conname); end loop;
  if not exists(select 1 from pg_constraint where conrelid='public.gd_testers'::regclass and conname='gd_testers_actor_fkey') then
    alter table public.gd_testers add constraint gd_testers_actor_fkey foreign key(user_id) references public.gd_actor_identities(user_id) on delete cascade;
  end if;
end $$;

create table if not exists public.gd_virtual_rooms (
  post_id uuid primary key references public.gd_posts(id) on delete cascade,
  virtual_leader boolean not null default false,
  auto_join boolean not null default true,
  next_join_at timestamptz not null default now()+interval '6 seconds'
);
alter table public.gd_virtual_rooms enable row level security;
revoke all on public.gd_virtual_rooms from public,anon,authenticated;
grant select on public.gd_virtual_rooms to authenticated;
drop policy if exists gd_virtual_rooms_read on public.gd_virtual_rooms;
create policy gd_virtual_rooms_read on public.gd_virtual_rooms for select to authenticated using(public.gd_is_tester());

create or replace function public.gd_new_virtual_actor(p_number integer) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid(); begin
  insert into gd_actor_identities(user_id,virtual) values(v_id,true);
  insert into gd_testers(user_id,nickname,active,is_virtual,registration_source) values(v_id,'가상 유저 '||p_number,true,true,'virtual');
  return v_id;
end; $$;

create or replace function public.gd_virtual_seed() returns void
language plpgsql security definer set search_path=public as $$
declare c record; p uuid; u uuid; n integer:=0; begin
  -- 진행 중인 방은 보존하고, 비어 있는 모집글만 시간을 갱신합니다.
  update gd_posts p set deadline=now()+interval '40 minutes',note=jsonb_build_object('format','campus-v1','text','같이 메뉴를 골라요.','starts_at',now()+interval '30 minutes','ends_at',now()+interval '90 minutes','deliveryTime','약 30분 뒤')::text
    from gd_virtual_rooms v where v.post_id=p.id and v.virtual_leader and p.status='open' and p.deadline<now()+interval '5 minutes'
    and not exists(select 1 from gd_participations a join gd_testers t on t.user_id=a.user_id where a.post_id=p.id and not t.is_virtual);
  for c in select distinct on(menu_key) * from gd_menu_catalog where jsonb_array_length(menus)>0 order by menu_key,store_name loop
    n:=n+1;
    if exists(select 1 from gd_posts p join gd_virtual_rooms v on v.post_id=p.id join gd_menu_catalog m on m.store_name=p.restaurant where v.virtual_leader and m.menu_key=c.menu_key and p.status='open' and p.deadline>now()) then continue; end if;
    u:=gd_new_virtual_actor(n);
    insert into gd_posts(owner_id,restaurant,category,max_members,deadline,delivery_fee,min_order,meeting,note,pickup_lat,pickup_lng)
      values(u,c.store_name,case c.menu_key when 'coffee' then '카페' when 'burger' then '버거' else '패스트푸드' end,2,now()+interval '40 minutes',3000,c.goal_amount,'충남대 정문',jsonb_build_object('format','campus-v1','text','같이 메뉴를 골라요.','starts_at',now()+interval '30 minutes','ends_at',now()+interval '90 minutes','deliveryTime','약 30분 뒤')::text,36.3621+(n-2)*0.00025,127.3444) returning id into p;
    insert into gd_virtual_rooms(post_id,virtual_leader,auto_join) values(p,true,false);
    insert into gd_participations(post_id,user_id,status) values(p,u,'accepted');
    insert into gd_order_states(post_id,meeting,meeting_time,meeting_lat,meeting_lng) values(p,'충남대 정문',now()+interval '30 minutes',36.3621+(n-2)*0.00025,127.3444);
    insert into gd_order_people(post_id,user_id,latitude,longitude) values(p,u,36.3621+(n-2)*0.00025,127.3444);
  end loop;
end; $$;

create or replace function public.gd_virtual_tick() returns void
language plpgsql security definer set search_path=public as $$
declare p record; v_actor record; v_count integer; v_virtual integer; v_uid uuid; v_menu jsonb; v_quantity integer; v_total integer; v_phase text; begin
  if not gd_is_tester() then return; end if;
  perform pg_advisory_xact_lock(73194628);
  perform gd_virtual_seed();
  -- 호출한 본인의 방과 현재 참가한 방만 진행합니다.
  for p in select r.*,v.virtual_leader,v.auto_join,v.next_join_at from gd_posts r join gd_virtual_rooms v on v.post_id=r.id
    where r.owner_id=auth.uid() or exists(select 1 from gd_participations where post_id=r.id and user_id=auth.uid() and active)
  loop
    select phase into v_phase from gd_order_states where post_id=p.id;
    if p.status='cancelled' then
      update gd_order_people x set refunded_amount=refunded_amount+refund_due,refund_due=0,refund_sent=false,transfer_review_pending=false from gd_testers t where x.post_id=p.id and x.user_id=t.user_id and t.is_virtual;
      continue;
    end if;
    if p.status='completed' then continue; end if;
    if p.virtual_leader and p.status='open' and p.deadline>now() and v_phase='menu' then
      select count(*) into v_count from gd_participations where post_id=p.id and status='accepted';
      for v_actor in select * from gd_participations where post_id=p.id and status='pending' and active order by created_at,id loop
        if v_count>=p.max_members then exit; end if;
        update gd_participations set status='accepted' where id=v_actor.id;
        insert into gd_order_people(post_id,user_id) values(p.id,v_actor.user_id) on conflict do nothing;
        v_count:=v_count+1;
        insert into gd_messages(post_id,sender_id,body) values(p.id,p.owner_id,'참가를 수락했어요. 원하는 메뉴를 담아 주세요.');
      end loop;
      if v_count>=p.max_members then
        update gd_posts set status='closed',member_count=v_count where id=p.id;
        update gd_participations set status='rejected',active=false where post_id=p.id and status='pending';
      end if;
    elsif not p.virtual_leader and p.auto_join and p.status='open' and p.deadline>now() and v_phase='menu' and p.next_join_at<=now() then
      select count(*) into v_count from gd_participations where post_id=p.id and active and status in('accepted','pending');
      select count(*) into v_virtual from gd_participations a join gd_testers t on t.user_id=a.user_id where a.post_id=p.id and t.is_virtual;
      if v_count<p.max_members and v_virtual<3 and not exists(select 1 from gd_order_states where post_id=p.id and nearby_agreed) then
        v_uid:=gd_new_virtual_actor(v_virtual+1);
        insert into gd_participations(post_id,user_id,status) values(p.id,v_uid,'pending');
      end if;
      update gd_virtual_rooms set next_join_at=now()+interval '6 seconds' where post_id=p.id;
    end if;
    select count(*) into v_count from gd_participations where post_id=p.id and status='accepted';
    -- 동의 처리는 가상 상대에게만 적용합니다. 실제 상대의 동의는 대신하지 않습니다.
    if v_phase='menu' and v_count=2 and exists(select 1 from gd_participations a join gd_testers t on t.user_id=a.user_id join gd_order_states s on s.post_id=a.post_id where a.post_id=p.id and a.status='accepted' and t.is_virtual and s.nearby_requester is not null and s.nearby_requester<>a.user_id and not s.nearby_agreed) then
      update gd_order_states set nearby_agreed=true,meeting=nearby_address,meeting_lat=null,meeting_lng=null,updated_at=now() where post_id=p.id;
      update gd_posts set status='closed' where id=p.id;
      update gd_participations set status='rejected',active=false where post_id=p.id and status='pending';
    end if;
    if v_phase='menu' then
      update gd_order_states s set pickup_agreed_by=array(select distinct u from unnest(s.pickup_agreed_by||array(select a.user_id from gd_participations a join gd_testers t on t.user_id=a.user_id where a.post_id=p.id and a.status='accepted' and t.is_virtual)) u),updated_at=now()
        where s.post_id=p.id and s.pickup_mode='contactless' and exists(select 1 from gd_participations a join gd_testers t on t.user_id=a.user_id where a.post_id=p.id and a.status='accepted' and t.is_virtual and not(a.user_id=any(s.pickup_agreed_by)));
    end if;
    if p.virtual_leader and v_phase='arrived' then
      update gd_order_states set pickup_dropped_at=now(),updated_at=now() where post_id=p.id and pickup_mode='contactless' and pickup_dropped_at is null;
    end if;
    for v_actor in select a.* from gd_participations a join gd_testers t on t.user_id=a.user_id where a.post_id=p.id and a.status='accepted' and t.is_virtual loop
      if v_phase='menu' and not exists(select 1 from gd_baskets where post_id=p.id and user_id=v_actor.user_id) then
        select m into v_menu from gd_menu_catalog c cross join lateral jsonb_array_elements(c.menus) m where c.store_name=p.restaurant and coalesce((m->>'available')::boolean,true) and (m->>'price')::int>0 order by (m->>'id')::int limit 1;
        if v_menu is not null then
          v_quantity:=least(5,greatest(1,ceil(p.min_order::numeric/greatest(2,p.max_members)/(v_menu->>'price')::int)::int));
          insert into gd_baskets(post_id,user_id,items,total) values(p.id,v_actor.user_id,jsonb_build_array(v_menu||jsonb_build_object('quantity',v_quantity)),(v_menu->>'price')::int*v_quantity);
          insert into gd_messages(post_id,sender_id,body) values(p.id,v_actor.user_id,(v_menu->>'name')||' '||v_quantity||'개 담았어요.');
        end if;
      end if;
      -- 가상 인물의 기록만 처리합니다. 실제 회원의 송금/수령 기록은 변경하지 않습니다.
      if v_phase='payment' and not p.virtual_leader then
        update gd_order_people set claimed_amount=food_total+fee-coupon_discount,confirmed_amount=food_total+fee-coupon_discount where post_id=p.id and user_id=v_actor.user_id;
      elsif v_phase='arrived' and exists(select 1 from gd_order_states where post_id=p.id and (pickup_mode<>'contactless' or pickup_dropped_at is not null)) then
        update gd_order_people set received_at=coalesce(received_at,now()) where post_id=p.id and user_id=v_actor.user_id;
      end if;
    end loop;
    if p.virtual_leader and v_phase='menu' and v_count>=2 then
      select sum(b.total) into v_total from gd_baskets b join gd_participations a on a.post_id=b.post_id and a.user_id=b.user_id and a.status='accepted' where b.post_id=p.id;
      if v_total>=p.min_order and not exists(select 1 from gd_participations a left join gd_baskets b on b.post_id=a.post_id and b.user_id=a.user_id where a.post_id=p.id and a.status='accepted' and coalesce(b.total,0)=0)
        and not exists(select 1 from gd_order_states where post_id=p.id and nearby_requester is not null and not nearby_agreed) then
        update gd_order_people x set food_total=b.total,fee=case when s.nearby_agreed then case when x.user_id=s.nearby_requester then p.delivery_fee else 0 end else p.delivery_fee/v_count+case when x.user_id=p.owner_id then p.delivery_fee%v_count else 0 end end from gd_baskets b,gd_order_states s where x.post_id=p.id and s.post_id=x.post_id and b.post_id=x.post_id and b.user_id=x.user_id;
        update gd_order_states set phase='payment',leader_ready=true,updated_at=now() where post_id=p.id;
      end if;
    elsif p.virtual_leader and v_phase in('ordered','delivering') then
      update gd_order_states set phase=case when v_phase='ordered' then 'delivering' else 'arrived' end,arrived_at=case when v_phase='delivering' then now() else arrived_at end,updated_at=now() where post_id=p.id and updated_at<now()-interval '10 seconds';
    end if;
    -- 마지막 확인자가 가상 유저인 경우에도 정확히 한 번 완료됩니다.
    if v_phase='arrived' and v_count>=2 and not exists(select 1 from gd_participations a left join gd_order_people x on x.post_id=a.post_id and x.user_id=a.user_id where a.post_id=p.id and a.status='accepted' and x.received_at is null) then
      update gd_order_states set phase='completed',updated_at=now() where post_id=p.id;
      update gd_posts set status='completed' where id=p.id;
      update gd_participations set active=false where post_id=p.id;
      update gd_order_people set latitude=null,longitude=null where post_id=p.id;
    end if;
  end loop;
end; $$;

create or replace function public.gd_virtual_control(p_post uuid,p_action text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  if p_action in('enable','disable') then
    if not exists(select 1 from gd_posts p join gd_order_states s on s.post_id=p.id where p.id=p_post and p.owner_id=auth.uid() and s.phase='menu') then raise exception '모집 중인 내 방에서 변경할 수 있어요.'; end if;
    insert into gd_virtual_rooms(post_id,auto_join) values(p_post,p_action='enable') on conflict(post_id) do update set auto_join=excluded.auto_join;
    if p_action='disable' then update gd_participations a set status='rejected',active=false from gd_testers t where a.post_id=p_post and a.user_id=t.user_id and t.is_virtual and a.status='pending'; end if;
  elsif p_action='order' then
    if not exists(select 1 from gd_virtual_rooms v join gd_order_states s on s.post_id=v.post_id join gd_participations a on a.post_id=v.post_id where v.post_id=p_post and v.virtual_leader and a.user_id=auth.uid() and a.status='accepted' and a.active and s.phase='payment') then raise exception '진행할 가상 리더의 주문이 없어요.'; end if;
    update gd_order_states set phase='ordered',updated_at=now() where post_id=p_post;
  else raise exception '지원하지 않는 요청이에요.';
  end if;
end; $$;

-- 새 방만 자동 신청을 켭니다. 이전 방의 설정/참가자는 그대로 둡니다.
create or replace function public.gd_enable_new_virtual_room() returns trigger
language plpgsql security definer set search_path=public as $$ begin
  if not exists(select 1 from gd_testers where user_id=new.owner_id and is_virtual) then insert into gd_virtual_rooms(post_id) values(new.id) on conflict do nothing; end if;
  return new;
end; $$;
drop trigger if exists gd_new_virtual_room on public.gd_posts;
create trigger gd_new_virtual_room after insert on public.gd_posts for each row execute function public.gd_enable_new_virtual_room();

-- 기존 적립 내역은 보존하고 앞으로의 거리 저장만 GPS 기록으로 받습니다.
alter table public.gd_walk_plans drop constraint if exists gd_walk_plans_source_check;
alter table public.gd_walk_plans add constraint gd_walk_plans_source_check check(source in('map','manual','gps'));
create or replace function public.gd_set_walk_plan(p_post uuid,p_meters integer,p_source text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  if p_meters is null or p_meters not between 0 and 400 or p_source is distinct from 'gps' then raise exception 'GPS로 기록한 이동거리만 저장할 수 있어요. 새로고침 후 다시 시도해 주세요.'; end if;
  if not exists(select 1 from gd_order_states s join gd_participations a on a.post_id=s.post_id where s.post_id=p_post and s.phase in('ordered','delivering','arrived') and a.user_id=auth.uid() and a.status='accepted' and a.active) or exists(select 1 from gd_order_people where post_id=p_post and user_id=auth.uid() and received_at is not null) then raise exception '주문 완료 후 수령 전에 이동거리를 기록해 주세요.'; end if;
  if exists(select 1 from gd_order_states where post_id=p_post and nearby_agreed and nearby_requester=auth.uid()) and p_meters<>0 then raise exception '내 근처 수령의 이동거리는 0m예요.'; end if;
  insert into gd_walk_plans(post_id,user_id,meters,source) values(p_post,auth.uid(),p_meters,'gps') on conflict(post_id,user_id) do update set meters=excluded.meters,source='gps',updated_at=now();
end; $$;

revoke all on function public.gd_new_virtual_actor(integer),public.gd_virtual_seed(),public.gd_register_actor_identity(),public.gd_enable_new_virtual_room() from public,anon,authenticated;
revoke all on function public.gd_virtual_tick(),public.gd_virtual_control(uuid,text) from public,anon;
grant execute on function public.gd_virtual_tick(),public.gd_virtual_control(uuid,text) to authenticated;
select public.gd_virtual_seed();
notify pgrst,'reload schema';
commit;
select '가상 유저·GPS 업데이트 적용 완료' as "확인";
