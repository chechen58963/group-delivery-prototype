-- Run once in the SQL Editor. Existing rooms, members, menus and chat are preserved.
begin;
create or replace function public.gd_update_room_time(p_post uuid,p_start timestamptz,p_end timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare p gd_posts%rowtype; meta jsonb; label text;
begin
  if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(73194628);
  select * into p from gd_posts where id=p_post for update;
  if not found or p.owner_id<>auth.uid() then raise exception '리더만 시간을 변경할 수 있어요.'; end if;
  if p.status not in('open','closed') or exists(select 1 from gd_order_states where post_id=p_post and phase<>'menu') then raise exception '주문 확정 전에 시간을 변경해 주세요.'; end if;
  if p_start is null or p_end is null or p_start<=now() or p_start>now()+interval '7 days' or p_end<=p_start or p_end-p_start>interval '4 hours' then raise exception '앞으로의 수령 시간을 선택해 주세요.'; end if;
  begin meta:=p.note::jsonb; exception when others then meta:=jsonb_build_object('text',p.note); end;
  if jsonb_typeof(meta) is distinct from 'object' then meta:=jsonb_build_object('text',p.note); end if;
  label:=to_char(p_start at time zone 'Asia/Seoul','MM.DD HH24:MI')||'–'||to_char(p_end at time zone 'Asia/Seoul','HH24:MI');
  meta:=meta||jsonb_build_object('format','campus-v1','starts_at',p_start,'ends_at',p_end,'deliveryTime',label,'text',label||' 함께 주문해요.'||chr(10)||regexp_replace(coalesce(meta->>'text',''),'^(오늘|내일) [^' || chr(10) || ']*함께 주문해요[.]' || chr(10) || '?','',''));
  update gd_posts set note=meta::text,deadline=case when deadline<=now() or deadline>p_start then p_start else deadline end where id=p_post;
  update gd_order_states set meeting_time=p_start,updated_at=now() where post_id=p_post;
  update gd_menu_notifications set expires_at=least(expires_at,now()) where kind='group_invite' and payload->>'post_id'=p_post::text;
end; $$;
revoke all on function public.gd_update_room_time(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.gd_update_room_time(uuid,timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
