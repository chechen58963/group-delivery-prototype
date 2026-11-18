-- 가상 유저·GPS 업데이트 이후 전체 실행. 계좌·대화·참가자 위치는 공개하지 않습니다.
begin;
select pg_advisory_xact_lock(73194628);
create or replace function public.gd_public_rooms()
returns table(id uuid,restaurant text,category text,max_members integer,member_count integer,deadline timestamptz,delivery_fee integer,min_order integer,meeting text,status text,pickup_lat double precision,pickup_lng double precision,public_virtual_leader boolean)
language sql stable security definer set search_path=public as $$
  select p.id,p.restaurant,p.category,p.max_members,p.member_count,p.deadline,p.delivery_fee,p.min_order,
    case when p.pickup_lat is not null and p.pickup_lng is not null then '지도에 표시된 공개 수령점' else '참가 후 장소 조율' end,
    p.status,p.pickup_lat,p.pickup_lng,t.is_virtual
  from gd_posts p join gd_testers t on t.user_id=p.owner_id
  where p.status='open' and p.deadline>now() and p.member_count<p.max_members and t.active
  order by p.created_at desc limit 100;
$$;
revoke all on function public.gd_public_rooms() from public;
grant execute on function public.gd_public_rooms() to anon,authenticated;

-- 실제 사람 두 명 이상이 완료한 거래만 신뢰 지표에 반영합니다.
create or replace function public.gd_real_order(p_post uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select count(*)>=2 from gd_participations a join gd_testers t on t.user_id=a.user_id where a.post_id=p_post and a.status='accepted' and not t.is_virtual;
$$;
create or replace function public.gd_reputation() returns table(user_id uuid,rating numeric,review_count bigint,trades bigint)
language sql stable security definer set search_path=public as $$
  select t.user_id,
    (select round(avg(r.stars),1) from gd_reviews r join gd_testers author on author.user_id=r.reviewer_id where r.subject_id=t.user_id and not author.is_virtual and not t.is_virtual and gd_real_order(r.post_id)),
    (select count(*) from gd_reviews r join gd_testers author on author.user_id=r.reviewer_id where r.subject_id=t.user_id and not author.is_virtual and not t.is_virtual and gd_real_order(r.post_id)),
    (select count(*) from gd_participations a join gd_order_states s on s.post_id=a.post_id where a.user_id=t.user_id and a.status='accepted' and s.phase='completed' and not t.is_virtual and gd_real_order(a.post_id))
  from gd_testers t where gd_is_tester();
$$;
do $$ begin
  if to_regprocedure('public.gd_order_ux_internal(text,uuid,jsonb)') is null then
    alter function public.gd_order_action(text,uuid,jsonb) rename to gd_order_ux_internal;
  end if;
end $$;
create or replace function public.gd_order_action(p_action text,p_post uuid,p_data jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  if p_action='review' and (not gd_real_order(p_post) or exists(select 1 from gd_testers where user_id=(p_data->>'user_id')::uuid and is_virtual)) then raise exception '함께 이용한 실제 참가자에게 후기를 남겨 주세요.'; end if;
  perform gd_order_ux_internal(p_action,p_post,p_data);
end; $$;
revoke all on function public.gd_real_order(uuid),public.gd_order_ux_internal(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.gd_order_action(text,uuid,jsonb) from public,anon;
grant execute on function public.gd_order_action(text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
select '이용 흐름 개선 적용 완료' as "확인";
