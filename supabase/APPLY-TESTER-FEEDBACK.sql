-- Apply after APPLY-MENU-IMPROVEMENTS.sql. Existing orders retain direct pickup.
begin;
select pg_advisory_xact_lock(73194628);
alter table public.gd_order_states add column if not exists pickup_mode text not null default 'meet' check(pickup_mode in('meet','contactless'));
alter table public.gd_order_states add column if not exists pickup_proposer uuid references public.gd_testers(user_id);
alter table public.gd_order_states add column if not exists pickup_agreed_by uuid[] not null default '{}';
alter table public.gd_order_states add column if not exists pickup_note text not null default '' check(char_length(pickup_note)<=500);
alter table public.gd_order_states add column if not exists pickup_dropped_at timestamptz;

-- Photos are fetched separately, rather than included in the recurring status query.
-- A bounded JPEG keeps this small-group prototype independent of a public image bucket.
create table if not exists public.gd_pickup_photos(
  post_id uuid primary key references public.gd_posts(id) on delete cascade,
  photo text not null check(char_length(photo)<=240000 and photo ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/=]+$')
);
alter table public.gd_pickup_photos enable row level security;
drop policy if exists gd_pickup_photo_members on public.gd_pickup_photos;
create policy gd_pickup_photo_members on public.gd_pickup_photos for select to authenticated using(
  public.gd_is_tester() and public.gd_is_member(post_id)
  and exists(select 1 from public.gd_posts p where p.id=post_id and p.status<>'cancelled')
);
revoke all on public.gd_pickup_photos from anon,authenticated;
grant select on public.gd_pickup_photos to authenticated;

create or replace function public.gd_pickup_action(p_action text,p_post uuid,p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_state gd_order_states%rowtype; v_owner uuid; v_note text; v_photo text;
begin
  if not public.gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  select owner_id into v_owner from gd_posts where id=p_post for update;
  if not found or not exists(select 1 from gd_participations where post_id=p_post and user_id=v_uid and status='accepted' and active) then raise exception '참여 중인 배프만 수령 방식을 정할 수 있어요.'; end if;
  select * into v_state from gd_order_states where post_id=p_post for update;
  if not found then raise exception '주문 정보를 불러온 뒤 다시 시도해 주세요.'; end if;
  if p_action in('propose','agree','reset') then
    if v_state.phase<>'menu' then raise exception '주문 확정 전에 수령 방식을 정해 주세요.'; end if;
    if p_data->>'expected_updated_at' is null or (p_data->>'expected_updated_at')::timestamptz is distinct from v_state.updated_at then raise exception '상대가 주문 정보를 변경했어요. 최신 내용을 확인한 뒤 다시 시도해 주세요.'; end if;
    if p_action='propose' then
      v_note:=btrim(coalesce(p_data->>'note',''));
      if char_length(v_note) not between 1 and 500 then raise exception '음식을 놓을 위치와 구분 방법을 500자 이내로 적어 주세요.'; end if;
      update gd_order_states set pickup_mode='contactless',pickup_proposer=v_uid,pickup_note=v_note,pickup_agreed_by=array[v_uid],pickup_dropped_at=null,updated_at=clock_timestamp() where post_id=p_post;
    elsif p_action='agree' then
      if v_state.pickup_mode<>'contactless' then raise exception '확인할 비대면 수령 제안이 없어요.'; end if;
      update gd_order_states set pickup_agreed_by=case when v_uid=any(pickup_agreed_by) then pickup_agreed_by else array_append(pickup_agreed_by,v_uid) end,updated_at=clock_timestamp() where post_id=p_post;
    else
      update gd_order_states set pickup_mode='meet',pickup_proposer=null,pickup_note='',pickup_agreed_by='{}',pickup_dropped_at=null,updated_at=clock_timestamp() where post_id=p_post;
    end if;
  elsif p_action='dropoff' then
    if v_uid<>v_owner then raise exception '배달을 받은 리더가 음식을 놓은 뒤 알려 주세요.'; end if;
    if v_state.phase<>'arrived' or v_state.pickup_mode<>'contactless' or v_state.pickup_dropped_at is not null then raise exception '음식 도착 후 비대면 수령을 한 번 기록할 수 있어요.'; end if;
    if exists(select 1 from gd_participations where post_id=p_post and status='accepted' and not(user_id=any(v_state.pickup_agreed_by))) then raise exception '모두 비대면 수령에 동의해야 해요.'; end if;
    v_photo:=coalesce(p_data->>'photo','');
    if char_length(v_photo)>240000 or v_photo !~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/=]+$' then raise exception '음식을 놓은 장소 사진을 선택해 주세요.'; end if;
    insert into gd_pickup_photos(post_id,photo) values(p_post,v_photo);
    update gd_order_states set pickup_dropped_at=clock_timestamp(),updated_at=clock_timestamp() where post_id=p_post;
  else raise exception '지원하지 않는 수령 요청이에요.';
  end if;
end; $$;

create or replace function public.gd_pickup_state_guard()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.phase='menu' and new.pickup_mode='contactless' and
     (new.meeting is distinct from old.meeting or new.meeting_time is distinct from old.meeting_time or new.meeting_lat is distinct from old.meeting_lat or new.meeting_lng is distinct from old.meeting_lng) then
    new.pickup_agreed_by:='{}';
  end if;
  if new.phase='payment' and old.phase='menu' and new.pickup_mode='contactless' and
     exists(select 1 from gd_participations where post_id=new.post_id and status='accepted' and not(user_id=any(new.pickup_agreed_by))) then
    raise exception '모두 비대면 수령 안내에 동의한 뒤 주문을 확정해 주세요.';
  end if;
  return new;
end; $$;
drop trigger if exists gd_pickup_state_guard on public.gd_order_states;
create trigger gd_pickup_state_guard before update on public.gd_order_states for each row execute function public.gd_pickup_state_guard();

create or replace function public.gd_pickup_member_guard()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    if new.status<>'accepted' then return new; end if;
  elsif new.status is not distinct from old.status then return new;
  elsif new.status<>'accepted' and old.status<>'accepted' then return new;
  end if;
  update gd_order_states set pickup_agreed_by='{}',updated_at=clock_timestamp()
    where post_id=new.post_id and phase='menu' and pickup_mode='contactless';
  return new;
end; $$;
drop trigger if exists gd_pickup_member_guard on public.gd_participations;
create trigger gd_pickup_member_guard after insert or update of status on public.gd_participations for each row execute function public.gd_pickup_member_guard();

create or replace function public.gd_pickup_receipt_guard()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.received_at is null and new.received_at is not null and exists(select 1 from gd_order_states where post_id=new.post_id and pickup_mode='contactless' and pickup_dropped_at is null) then
    raise exception '리더가 음식을 놓았다는 알림을 보낸 뒤 찾아간 음식을 확인해 주세요.';
  end if;
  return new;
end; $$;
drop trigger if exists gd_pickup_receipt_guard on public.gd_order_people;
create trigger gd_pickup_receipt_guard before update of received_at on public.gd_order_people for each row execute function public.gd_pickup_receipt_guard();

revoke all on function public.gd_pickup_action(text,uuid,jsonb) from public,anon;
grant execute on function public.gd_pickup_action(text,uuid,jsonb) to authenticated;
revoke all on function public.gd_pickup_state_guard(),public.gd_pickup_member_guard(),public.gd_pickup_receipt_guard() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
select '사용자 피드백 업데이트 적용 완료' as "확인";
