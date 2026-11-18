import {PGlite} from '../.tmp-db-check/node_modules/@electric-sql/pglite/dist/index.js'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to authenticated;grant execute on function auth.uid() to authenticated;`)
const file=name=>readFileSync(new URL('../supabase/'+name,import.meta.url),'utf8')
for(const name of ['setup.sql','signup-profiles.sql','menu-discovery.sql','distance-matching.sql','restore-workflow.sql','APPLY-CONSISTENCY-FIXES.sql','APPLY-MENU-IMPROVEMENTS.sql','APPLY-TESTER-FEEDBACK.sql','APPLY-VIRTUAL-USERS-GPS.sql','APPLY-UX-FLOW.sql','APPLY-ORDER-TIMING.sql','APPLY-ORDER-SUGGESTIONS.sql']){
 try{await db.exec(file(name))}catch(e){console.error(name);throw e}
}
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333'
await db.exec(`insert into auth.users(id,email_confirmed_at) values('${a}',now()),('${b}',now()),('${c}',now());`)
const auth=id=>db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
const admin=()=>db.exec('reset role')
const save=async(id,store,flex='exact',ready=true,lat=36.3621)=>{await auth(id);await db.query("select gd_save_order_preference($1,1,1,$2,$3,now(),now()+interval '1 hour','cnu-main',$4,127.3444)",[store,flex,ready,lat])}
const suggestions=async id=>{await auth(id);return (await db.query('select gd_order_suggestions() value')).rows[0].value}
await save(a,'이디야커피 충대정문점');await save(b,'메가MGC커피 대전충남대정문점')
assert.equal((await suggestions(a)).length,0)
await save(a,'이디야커피 충대정문점','brand');await save(b,'메가MGC커피 대전충남대정문점','brand')
let offers=await suggestions(a);assert.ok(offers.length>=2)
for(const x of offers){assert.equal(x.ready_count,2);assert.ok(x.walk_m<=400);assert.equal(x.my_total,x.my_item.price+1500);assert.equal(x.shortfall,Math.max(0,x.goal-x.food_total));assert.ok(!('latitude' in x));assert.ok(!('other_lat' in x));assert.ok(x.my_item.name.match(/아메리카노|메가리카노/))}
for(const x of offers){const row=(await db.query('select menus from gd_menu_catalog where store_name=$1',[x.store])).rows[0];assert.ok(row.menus.some(m=>m.id===x.my_item.id&&m.name===x.my_item.name&&m.price===x.my_item.price))}
console.log('PASS: exact preference stays strict; brand flexibility offers actual menu pairs and explicit costs')
await auth(a);await db.query("select gd_save_order_preference('이디야커피 충대정문점',3,1,'brand',true,now(),now()+interval '1 hour','cnu-main',36.3621,127.3444)")
offers=await suggestions(a);assert.ok(offers.length>0);assert.ok(offers.every(x=>x.store==='이디야커피 충대정문점'&&x.my_item.id===3))
await auth(a);await db.query("select gd_save_order_preference('이디야커피 충대정문점',3,1,'similar',true,now(),now()+interval '1 hour','cnu-main',36.3621,127.3444)")
offers=await suggestions(a);assert.ok(offers.some(x=>x.store==='메가MGC커피 대전충남대정문점'))
await save(a,'이디야커피 충대정문점','brand')
console.log('PASS: brand mode retains the desired item family; similar mode requires explicit opt-in')

await save(c,'이디야커피 충대정문점','brand',false)
offers=await suggestions(a);assert.equal(offers[0].ready_count,2);assert.ok(offers.some(x=>x.ready_count===1))
await save(b,'메가MGC커피 대전충남대정문점','brand',true,36.38)
offers=await suggestions(a);assert.ok(offers.every(x=>x.ready_count===1))
await admin();await db.query("update gd_intents set ends_at=now()-interval '1 second',starts_at=now()-interval '1 hour' where user_id=$1",[c])
assert.equal((await suggestions(a)).length,0)
console.log('PASS: ready participants rank first; distant and expired preferences are excluded')
await auth(a);await assert.rejects(db.query("select gd_save_order_preference('이디야커피 충대정문점',9999,1,'exact',true,now(),now()+interval '1 hour','cnu-main',36.3621,127.3444)"),/메뉴/)
await assert.rejects(db.query('select gd_recommended_item($1,$1,1,$2)',['이디야커피 충대정문점','brand']),/permission denied/)
assert.equal((await db.query('select count(*)::int n from gd_intents')).rows[0].n,1)
await db.exec('set role anon');await assert.rejects(db.query('select gd_order_suggestions()'),/permission denied/)
await save(a,'이디야커피 충대정문점','brand')
await auth(a);const room=(await db.query("select gd_action('create',null,$1::jsonb) id",[JSON.stringify({restaurant:'이디야커피 충대정문점',category:'카페',max_members:2,deadline:new Date(Date.now()+3600000).toISOString(),delivery_fee:3000,min_order:8000,meeting:'충남대 정문'})])).rows[0].id
assert.equal((await suggestions(a)).length,0)
await assert.rejects(db.query("select gd_save_order_preference('이디야커피 충대정문점',1,1,'brand',true,now(),now()+interval '1 hour','cnu-main',36.3621,127.3444)"),/진행 중인/)
await auth(a);await db.query("select gd_action('cancel',$1)",[room])
console.log('PASS: a single active order still blocks new matching and preference registration')
await admin();const before=(await db.query('select count(*)::int n from gd_posts')).rows[0].n
await db.exec(file('APPLY-ORDER-SUGGESTIONS.sql'))
assert.equal((await db.query('select count(*)::int n from gd_posts')).rows[0].n,before)
console.log('PASS: RPC permissions, own-row privacy, invalid menus and repeat application preserve existing rooms')
await db.close()
