-- Apply after walking-rewards.sql. Existing rewards retain their original amounts.
begin;
select pg_advisory_xact_lock(73194628);
alter table public.gd_walk_rewards drop constraint if exists gd_walk_rewards_points_check;
alter table public.gd_walk_rewards add constraint gd_walk_rewards_points_check check(points between 0 and 100);
alter table public.gd_walk_rewards add column if not exists rule_version integer not null default 1;
create table if not exists public.gd_point_products(
 id text primary key,name text not null,category text not null,description text not null,
 price integer not null check(price>0),symbol text not null,active boolean not null default true,sort_order integer not null default 0
);
insert into public.gd_point_products(id,name,category,description,price,symbol,sort_order) values
 ('coffee','카페 음료 교환권','음료','한 잔의 여유를 선물하세요.',3000,'coffee',1),
 ('convenience','편의점 모바일 상품권 1,000원','상품권','가까운 편의점에서 즐기는 작은 보상.',1000,'gift',2),
 ('icecream','아이스크림 교환권','간식','함께 주문한 뒤 달콤한 디저트 한 번.',2000,'icecream',3),
 ('culture','문화상품권 5,000원','상품권','차곡차곡 모은 포인트로 더 큰 즐거움.',5000,'culture',4),
 ('ebike','전기자전거 이용료 1,000원 할인권','이동','가까운 이동부터 등하교까지, 전기자전거 이용료를 아껴보세요.',1000,'ebike',5),
 ('escooter','전동킥보드 이용료 1,000원 할인권','이동','모아둔 포인트로 다음 전동킥보드 이동을 준비하세요.',1000,'escooter',6)
 on conflict(id) do nothing;
create table if not exists public.gd_point_redemptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.gd_testers(user_id),
 request_id uuid not null,product_id text not null references public.gd_point_products(id),
 product_name text not null,cost integer not null check(cost>0),
 status text not null default 'requested' check(status in('requested','fulfilled','cancelled')),
 voucher_code text,created_at timestamptz not null default now(),cancelled_at timestamptz,
 unique(user_id,request_id),check(status<>'fulfilled' or nullif(btrim(voucher_code),'') is not null)
);
alter table public.gd_point_products enable row level security;
alter table public.gd_point_redemptions enable row level security;
drop policy if exists gd_product_read on public.gd_point_products;
create policy gd_product_read on public.gd_point_products for select to authenticated using(public.gd_is_tester() and active);
drop policy if exists gd_redemption_read on public.gd_point_redemptions;
create policy gd_redemption_read on public.gd_point_redemptions for select to authenticated using(public.gd_is_tester() and user_id=auth.uid());
revoke all on public.gd_point_products,public.gd_point_redemptions from anon,authenticated;
grant select on public.gd_point_products,public.gd_point_redemptions to authenticated;

create or replace function public.gd_point_wallet()
returns table(balance bigint,earned bigint,spent bigint,today_earned bigint,rule_version integer)
language sql stable security definer set search_path=public as $$
 select a.amount-b.amount,a.amount,b.amount,
 (select coalesce(sum(w.points),0) from gd_walk_rewards w where w.user_id=auth.uid() and (w.awarded_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date),2
 from (select coalesce(sum(points),0) amount from gd_walk_rewards where user_id=auth.uid()) a,
 (select coalesce(sum(cost),0) amount from gd_point_redemptions where user_id=auth.uid() and status<>'cancelled') b
 where gd_is_tester();
$$;
create or replace function public.gd_redeem_points(p_product text,p_request uuid,p_expected integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare item gd_point_products%rowtype; result uuid; funds bigint;
begin
 if not gd_is_tester() then raise exception '로그인 후 교환해 주세요.'; end if;
 if p_request is null then raise exception '교환 요청을 확인해 주세요.'; end if;
 perform pg_advisory_xact_lock(73194628);
 select id into result from gd_point_redemptions where user_id=auth.uid() and request_id=p_request and product_id=p_product;
 if found then return result; end if;
 select * into item from gd_point_products where id=p_product and active;
 if not found then raise exception '현재 교환할 수 없는 상품이에요.'; end if;
 select balance into funds from gd_point_wallet();
 if p_expected is null or p_expected<>item.price then raise exception '상품의 필요 포인트가 변경됐어요. 상세창을 닫고 다시 확인해 주세요.'; end if;
 if funds<item.price then raise exception '포인트가 부족해요.'; end if;
 insert into gd_point_redemptions(user_id,request_id,product_id,product_name,cost)
 values(auth.uid(),p_request,item.id,item.name,item.price) returning id into result;
 return result;
end; $$;
create or replace function public.gd_cancel_point_redemption(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not gd_is_tester() then raise exception '로그인이 필요해요.'; end if;
 perform pg_advisory_xact_lock(73194628);
 update gd_point_redemptions set status='cancelled',cancelled_at=now() where id=p_id and user_id=auth.uid() and status='requested';
 if not found then raise exception '발급 대기 중인 내 교환 신청만 취소할 수 있어요.'; end if;
end; $$;

create or replace function public.gd_award_walk_completion() returns trigger
language plpgsql security definer set search_path=public as $$
declare member record; meters integer; used_today bigint; award integer;
begin
 perform pg_advisory_xact_lock(73194628);
 if exists(select 1 from gd_participations a left join gd_order_people p on p.post_id=a.post_id and p.user_id=a.user_id where a.post_id=new.post_id and a.status='accepted' and p.received_at is null) then return new; end if;
 if (select count(*) from gd_participations where post_id=new.post_id and status='accepted')<2 then return new; end if;
 for member in select a.user_id,w.meters from gd_participations a left join gd_walk_plans w on w.post_id=a.post_id and w.user_id=a.user_id where a.post_id=new.post_id and a.status='accepted'
 loop
  if exists(select 1 from gd_walk_rewards where post_id=new.post_id and user_id=member.user_id) then continue; end if;
  meters:=case when new.nearby_agreed and new.nearby_requester=member.user_id then 0 else coalesce(member.meters,0) end;
  select coalesce(sum(points),0) into used_today from gd_walk_rewards where user_id=member.user_id and (awarded_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date;
  award:=least(20+meters/5,greatest(0,200-used_today));
  insert into gd_walk_rewards(post_id,user_id,meters,points,rule_version) values(new.post_id,member.user_id,meters,award,2) on conflict do nothing;
 end loop;
 return new;
end; $$;
revoke all on function public.gd_point_wallet(),public.gd_redeem_points(text,uuid,integer),public.gd_cancel_point_redemption(uuid) from public,anon;
grant execute on function public.gd_point_wallet(),public.gd_redeem_points(text,uuid,integer),public.gd_cancel_point_redemption(uuid) to authenticated;
revoke all on function public.gd_award_walk_completion() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
