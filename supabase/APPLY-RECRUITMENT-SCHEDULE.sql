-- Apply after APPLY-ORDER-TIMING.sql. All times in this migration are absolute instants.
begin;
select pg_advisory_xact_lock(73194628);

create or replace function public.gd_recruitment_plan(p_note text) returns timestamptz
language plpgsql stable strict set search_path=pg_catalog as $$
declare planned timestamptz;
begin
  planned := (p_note::jsonb ->> 'starts_at')::timestamptz;
  if isfinite(planned) then return planned; end if;
  return null;
exception when data_exception then
  -- Older rooms can have a plain-text note and no scheduled order.
  return null;
end $$;

create or replace function public.gd_check_recruitment_deadline() returns trigger
language plpgsql set search_path=public as $$
declare planned timestamptz := gd_recruitment_plan(new.note);
begin
  if planned is null or new.deadline < date_trunc('minute', planned) then return new; end if;
  if new.deadline > planned then raise exception '모집 마감은 주문 예정 시각보다 앞서야 해요.'; end if;
  -- Earlier app versions and the room-time editor use the order time itself as a cutoff.
  new.deadline := date_trunc('minute', planned) - interval '1 minute';
  if new.status = 'open' and new.deadline <= now() then
    raise exception '모집할 시간이 남도록 주문 예정 시각을 조금 늦춰 주세요.';
  end if;
  return new;
end $$;

create or replace function public.gd_virtual_seed() returns void
language plpgsql security definer set search_path=public as $$
declare
  planned timestamptz := date_trunc('minute', now()) + interval '30 minutes';
  cutoff timestamptz := planned - interval '10 minutes';
  room_note text := jsonb_build_object('format','campus-v1','text','같이 메뉴를 골라요.',
    'starts_at',planned,'ends_at',planned + interval '1 hour','deliveryTime','약 30분 뒤')::text;
  store record;
  room_id uuid;
  leader_id uuid;
  store_number integer := 0;
  latitude double precision;
begin
  with renewed as (
    update gd_posts p set deadline=cutoff, note=room_note
    from gd_virtual_rooms v
    where v.post_id=p.id and v.virtual_leader and p.status='open'
      and (p.deadline < now() + interval '5 minutes' or p.deadline >= gd_recruitment_plan(p.note))
      and not exists (select 1 from gd_participations a join gd_testers t on t.user_id=a.user_id
                      where a.post_id=p.id and not t.is_virtual)
    returning p.id
  )
  update gd_order_states s set planned_order_at=planned, updated_at=now()
    from renewed where s.post_id=renewed.id and s.phase='menu';

  for store in select distinct on (menu_key) * from gd_menu_catalog
    where jsonb_array_length(menus)>0 order by menu_key,store_name
  loop
    store_number := store_number + 1;
    if exists (select 1 from gd_posts p join gd_virtual_rooms v on v.post_id=p.id
               join gd_menu_catalog c on c.store_name=p.restaurant
               where v.virtual_leader and c.menu_key=store.menu_key and p.status='open' and p.deadline>now())
    then continue; end if;
    leader_id := gd_new_virtual_actor(store_number);
    latitude := 36.3621 + (store_number-2)*0.00025;
    insert into gd_posts(owner_id,restaurant,category,max_members,deadline,delivery_fee,min_order,meeting,note,pickup_lat,pickup_lng)
      values(leader_id,store.store_name,case store.menu_key when 'coffee' then '카페' when 'burger' then '버거' else '패스트푸드' end,
             2,cutoff,3000,store.goal_amount,'충남대 정문',room_note,latitude,127.3444) returning id into room_id;
    insert into gd_virtual_rooms(post_id,virtual_leader,auto_join) values(room_id,true,false);
    insert into gd_participations(post_id,user_id,status) values(room_id,leader_id,'accepted');
    insert into gd_order_states(post_id,meeting,meeting_time,planned_order_at,meeting_lat,meeting_lng)
      values(room_id,'충남대 정문',planned,planned,latitude,127.3444);
    insert into gd_order_people(post_id,user_id,latitude,longitude) values(room_id,leader_id,latitude,127.3444);
  end loop;
end $$;

drop trigger if exists gd_check_recruitment_deadline on public.gd_posts;
create trigger gd_check_recruitment_deadline before insert or update of note,deadline on public.gd_posts
  for each row execute function public.gd_check_recruitment_deadline();
revoke all on function public.gd_recruitment_plan(text), public.gd_check_recruitment_deadline(),
  public.gd_virtual_seed() from public, anon, authenticated;

select public.gd_virtual_seed();
-- Keep announced order times for existing open rooms that people are already using.
with schedules as (
  select id, date_trunc('minute', gd_recruitment_plan(note)) as planned
  from gd_posts where status='open' and deadline>now()
)
update gd_posts p set deadline=s.planned - interval '1 minute'
  from schedules s where p.id=s.id and p.deadline>=s.planned;
update gd_order_states s set planned_order_at=gd_recruitment_plan(p.note), updated_at=now()
  from gd_posts p join gd_virtual_rooms v on v.post_id=p.id and v.virtual_leader
  where s.post_id=p.id and s.phase='menu' and p.status='open' and gd_recruitment_plan(p.note) is not null
    and s.planned_order_at is distinct from gd_recruitment_plan(p.note);
commit;
