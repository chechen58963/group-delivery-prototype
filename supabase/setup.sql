-- Supabase SQL Editor에서 전체 실행. 기존 시연 데이터에는 영향을 주지 않습니다.
begin;

create table if not exists public.gd_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 20),
  active boolean not null default true
);
create table if not exists public.gd_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.gd_testers(user_id),
  restaurant text not null check (char_length(btrim(restaurant)) between 1 and 100),
  category text not null check (category in ('치킨','피자','한식','중식','패스트푸드','일식','카페','분식','버거')),
  max_members integer not null check (max_members between 2 and 5),
  member_count integer not null default 1 check (member_count between 0 and 5),
  deadline timestamptz not null,
  delivery_fee integer not null check (delivery_fee between 0 and 100000),
  min_order integer not null check (min_order between 0 and 1000000),
  meeting text not null check (char_length(btrim(meeting)) between 1 and 200),
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'open' check (status in ('open','closed','cancelled','completed')),
  created_at timestamptz not null default now()
);
create table if not exists public.gd_participations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.gd_posts(id) on delete cascade,
  user_id uuid not null references public.gd_testers(user_id),
  status text not null check (status in ('pending','accepted','rejected','withdrawn')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(post_id,user_id)
);
-- 리더도 참여자에 포함하므로, 글 작성/신청을 통틀어 동시에 하나만 진행할 수 있습니다.
create unique index if not exists gd_one_active_participation
  on public.gd_participations(user_id) where active;
create index if not exists gd_participations_post on public.gd_participations(post_id);
create table if not exists public.gd_messages (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.gd_posts(id) on delete cascade,
  sender_id uuid not null references public.gd_testers(user_id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists gd_messages_post on public.gd_messages(post_id,id);

create or replace function public.gd_is_tester() returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.gd_testers where user_id=auth.uid() and active); $$;
create or replace function public.gd_is_member(p_post uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select public.gd_is_tester() and exists(select 1 from public.gd_participations
  where post_id=p_post and user_id=auth.uid() and status='accepted'); $$;
create or replace function public.gd_is_owner(p_post uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select public.gd_is_tester() and exists(select 1 from public.gd_posts
  where id=p_post and owner_id=auth.uid()); $$;

alter table public.gd_testers enable row level security;
alter table public.gd_posts enable row level security;
alter table public.gd_participations enable row level security;
alter table public.gd_messages enable row level security;
drop policy if exists gd_testers_read on public.gd_testers;
create policy gd_testers_read on public.gd_testers for select to authenticated
  using (user_id=auth.uid() or public.gd_is_tester());
drop policy if exists gd_posts_read on public.gd_posts;
create policy gd_posts_read on public.gd_posts for select to authenticated using(public.gd_is_tester());
drop policy if exists gd_participations_read on public.gd_participations;
create policy gd_participations_read on public.gd_participations for select to authenticated
  using(public.gd_is_tester() and (user_id=auth.uid() or public.gd_is_owner(post_id)
    or (status='accepted' and public.gd_is_member(post_id))));
drop policy if exists gd_messages_read on public.gd_messages;
create policy gd_messages_read on public.gd_messages for select to authenticated
  using(public.gd_is_member(post_id));

-- 쓰기는 이 함수를 통해서만 허용. 참여 처리를 직렬화하여 정원 초과와 중복 참여 방지.
create or replace function public.gd_action(p_action text, p_post uuid default null, p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.gd_posts%rowtype;
  v_target uuid;
  v_count integer;
begin
  if not public.gd_is_tester() then raise exception '테스트 참여자로 등록되어 있지 않아요.'; end if;
  -- 소규모 검증용. 작성·신청·수락·취소에 같은 잠금 사용.
  perform pg_advisory_xact_lock(73194628);
  update public.gd_posts set status='closed' where status='open' and deadline<=now();
  update public.gd_participations a set status='rejected',active=false
    where a.status='pending' and a.active and exists
      (select 1 from public.gd_posts p where p.id=a.post_id and p.status<>'open');
  if p_action='refresh' then return null; end if;
  if p_action='create' then
    if exists(select 1 from public.gd_participations where user_id=v_uid and active) then
      raise exception '진행 중인 모집이나 신청이 있어요. 먼저 종료하거나 취소해 주세요.';
    end if;
    if (p_data->>'deadline')::timestamptz <= now() or (p_data->>'deadline')::timestamptz > now()+interval '7 days' then
      raise exception '마감은 현재부터 7일 이내의 미래 시간으로 정해 주세요.';
    end if;
    insert into public.gd_posts(owner_id,restaurant,category,max_members,deadline,delivery_fee,min_order,meeting,note)
      values(v_uid,btrim(p_data->>'restaurant'),p_data->>'category',(p_data->>'max_members')::int,
        (p_data->>'deadline')::timestamptz,(p_data->>'delivery_fee')::int,(p_data->>'min_order')::int,
        btrim(p_data->>'meeting'),coalesce(p_data->>'note','')) returning id into p_post;
    insert into public.gd_participations(post_id,user_id,status) values(p_post,v_uid,'accepted');
    return p_post;
  end if;
  select * into v_post from public.gd_posts where id=p_post for update;
  if not found then raise exception '모집글을 찾을 수 없어요.'; end if;

  if p_action='apply' then
    if v_post.owner_id=v_uid then raise exception '자신의 모집글에는 신청할 수 없어요.'; end if;
    if v_post.status<>'open' or v_post.deadline<=now() then raise exception '모집이 마감되었어요.'; end if;
    if exists(select 1 from public.gd_participations where user_id=v_uid and active) then
      raise exception '한 번에 하나의 모집글에만 신청·참여할 수 있어요.';
    end if;
    select count(*) into v_count from public.gd_participations where post_id=p_post and status='accepted';
    if v_count>=v_post.max_members then raise exception '모집 정원이 모두 찼어요.'; end if;
    insert into public.gd_participations(post_id,user_id,status,active) values(p_post,v_uid,'pending',true)
      on conflict(post_id,user_id) do update set status='pending',active=true,created_at=now();
  elsif p_action in ('accept','reject') then
    if v_post.owner_id<>v_uid then raise exception '리더만 처리할 수 있어요.'; end if;
    if v_post.status<>'open' or v_post.deadline<=now() then raise exception '모집이 마감되었어요.'; end if;
    v_target := (p_data->>'user_id')::uuid;
    if p_action='accept' then
      select count(*) into v_count from public.gd_participations where post_id=p_post and status='accepted';
      if v_count>=v_post.max_members then raise exception '모집 정원이 모두 찼어요.'; end if;
    end if;
    update public.gd_participations set status=case when p_action='accept' then 'accepted' else 'rejected' end,
      active=(p_action='accept') where post_id=p_post and user_id=v_target and status='pending' and active;
    if not found then raise exception '처리할 수 있는 신청이 없어요.'; end if;
    if p_action='accept' and v_count+1>=v_post.max_members then
      update public.gd_posts set status='closed' where id=p_post;
      update public.gd_participations set status='rejected',active=false where post_id=p_post and status='pending';
    end if;
  elsif p_action='withdraw' then
    if v_post.owner_id=v_uid then raise exception '리더는 모집 취소를 이용해 주세요.'; end if;
    update public.gd_participations set status='withdrawn',active=false
      where post_id=p_post and user_id=v_uid and active;
    if not found then raise exception '취소할 수 있는 신청·참여가 없어요.'; end if;
  elsif p_action='reopen' then
    if v_post.owner_id<>v_uid then raise exception '리더만 다시 모집할 수 있어요.'; end if;
    select count(*) into v_count from public.gd_participations where post_id=p_post and status='accepted';
    if v_post.status<>'closed' or v_post.deadline<=now() or v_count>=v_post.max_members then
      raise exception '모집을 다시 열 수 없는 상태예요.';
    end if;
    update public.gd_posts set status='open' where id=p_post;
  elsif p_action in ('close','cancel','complete') then
    if v_post.owner_id<>v_uid then raise exception '리더만 처리할 수 있어요.'; end if;
    if v_post.status in ('cancelled','completed') then raise exception '이미 종료된 모집이에요.'; end if;
    update public.gd_posts set status=case p_action when 'close' then 'closed' when 'cancel' then 'cancelled' else 'completed' end where id=p_post;
    update public.gd_participations set status='rejected',active=false where post_id=p_post and status='pending';
    if p_action in ('cancel','complete') then
      update public.gd_participations set active=false where post_id=p_post;
    end if;
  elsif p_action='message' then
    if not public.gd_is_member(p_post) or v_post.status in ('cancelled','completed') then
      raise exception '진행 중이고 수락된 채팅방에만 메시지를 보낼 수 있어요.';
    end if;
    insert into public.gd_messages(post_id,sender_id,body) values(p_post,v_uid,btrim(p_data->>'body'));
  else raise exception '지원하지 않는 요청이에요.';
  end if;
  update public.gd_posts set member_count=(select count(*) from public.gd_participations
    where post_id=p_post and status='accepted') where id=p_post;
  return p_post;
end;
$$;

revoke all on public.gd_testers,public.gd_posts,public.gd_participations,public.gd_messages from anon,authenticated;
grant select on public.gd_testers,public.gd_posts,public.gd_participations,public.gd_messages to authenticated;
revoke all on function public.gd_is_tester(),public.gd_is_member(uuid),public.gd_is_owner(uuid),public.gd_action(text,uuid,jsonb) from public,anon;
grant execute on function public.gd_is_tester(),public.gd_is_member(uuid),public.gd_is_owner(uuid),public.gd_action(text,uuid,jsonb) to authenticated;
commit;
