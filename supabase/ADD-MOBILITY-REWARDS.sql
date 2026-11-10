-- Apply after APPLY-POINTS-SHOP.sql. Existing products and point balances are preserved.
begin;
insert into public.gd_point_products(id,name,category,description,price,symbol,sort_order) values
 ('ebike','전기자전거 이용료 1,000원 할인권','이동','가까운 이동부터 등하교까지, 전기자전거 이용료를 아껴보세요.',1000,'ebike',5),
 ('escooter','전동킥보드 이용료 1,000원 할인권','이동','모아둔 포인트로 다음 전동킥보드 이동을 준비하세요.',1000,'escooter',6)
on conflict(id) do nothing;
commit;
