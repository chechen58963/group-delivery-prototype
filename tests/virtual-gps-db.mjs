// Run after installing PGlite in the ignored .tmp-db-check directory.
import { PGlite } from '../.tmp-db-check/node_modules/@electric-sql/pglite/dist/index.js'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const db=new PGlite()
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to authenticated;
grant execute on function auth.uid() to authenticated;`)
const files=['setup.sql','signup-profiles.sql','menu-discovery.sql','distance-matching.sql','restore-workflow.sql','APPLY-CONSISTENCY-FIXES.sql','APPLY-MENU-IMPROVEMENTS.sql','APPLY-TESTER-FEEDBACK.sql','APPLY-VIRTUAL-USERS-GPS.sql']
for(const file of files){
  try{await db.exec(readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'))}
  catch(e){console.error('Migration failed:',file);throw e}
}
const sql=async(text,params=[]) => (await db.query(text,params)).rows
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
await db.exec(`insert into auth.users(id,email_confirmed_at) values('${uid}',now()),('${other}',now());`)
const auth=async id=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`)}
const admin=async()=>{await db.exec('reset role')}
await auth(uid)
assert.equal((await sql('select count(*)::int n from gd_posts')).at(0).n,3)
await assert.rejects(db.query('select gd_new_virtual_actor(9)'),/permission denied/)
await assert.rejects(db.query('update gd_testers set is_virtual=true where user_id=$1',[uid]),/permission denied/)
console.log('PASS: public virtual rooms, normal signup, private bot creation, RLS')
let created=(await sql(`select gd_action('create',null,$1::jsonb) id`,[JSON.stringify({restaurant:'맘스터치 충남대점',category:'버거',max_members:4,deadline:new Date(Date.now()+3600000).toISOString(),delivery_fee:3000,min_order:12000,meeting:'충남대 정문'})]))[0].id
await admin();await db.query('update gd_virtual_rooms set next_join_at=now()-interval \'1 second\' where post_id=$1',[created]);await auth(uid)
await sql('select gd_virtual_tick()')
let pending=await sql("select * from gd_participations where post_id=$1 and status='pending'",[created])
assert.equal(pending.length,1)
assert.equal((await sql('select member_count from gd_posts where id=$1',[created]))[0].member_count,1)
await sql("select gd_action('accept',$1,$2::jsonb)",[created,JSON.stringify({user_id:pending[0].user_id})])
await sql('select gd_virtual_tick()')
assert.equal((await sql('select count(*)::int n from gd_baskets where post_id=$1',[created]))[0].n,1)
console.log('PASS: delayed bot application still requires leader approval; accepted bots select menus')
await auth(other)
await assert.rejects(db.query("select gd_virtual_control($1,'disable')",[created]),/내 방/)
await sql('select gd_virtual_tick()')
assert.equal((await sql('select member_count from gd_posts where id=$1',[created]))[0].member_count,2)
await auth(uid)
await sql("select gd_virtual_control($1,'disable')",[created])
await admin();await db.query('update gd_virtual_rooms set next_join_at=now()-interval \'1 second\' where post_id=$1',[created]);await auth(uid)
await sql('select gd_virtual_tick()')
assert.equal((await sql("select count(*)::int n from gd_participations where post_id=$1 and status='pending'",[created]))[0].n,0)
console.log('PASS: another member cannot control the room; auto-join can be disabled')
await sql("select gd_action('cancel',$1)",[created])
const room=(await sql('select p.* from gd_posts p join gd_virtual_rooms v on v.post_id=p.id where v.virtual_leader and p.status=\'open\' limit 1'))[0]
await sql("select gd_action('apply',$1)",[room.id]);await sql('select gd_virtual_tick()')
assert.equal((await sql('select status from gd_participations where post_id=$1 and user_id=$2',[room.id,uid]))[0].status,'accepted')
const menu=(await sql('select menus from gd_menu_catalog where store_name=$1',[room.restaurant]))[0].menus[0]
await sql('select gd_save_basket($1,$2::jsonb)',[room.id,JSON.stringify([{id:menu.id,quantity:2}])]);await sql('select gd_virtual_tick()')
assert.equal((await sql('select phase from gd_order_states where post_id=$1',[room.id]))[0].phase,'payment')
assert.equal((await sql('select confirmed_amount from gd_order_people where post_id=$1 and user_id=$2',[room.id,uid]))[0].confirmed_amount,0)
await assert.rejects(db.query('select gd_set_walk_plan($1,100,\'gps\')',[room.id]),/주문 완료/)
await sql("select gd_virtual_control($1,'order')",[room.id])
await assert.rejects(db.query('select gd_set_walk_plan($1,401,\'gps\')',[room.id]),/GPS/)
await assert.rejects(db.query('select gd_set_walk_plan($1,100,\'manual\')',[room.id]),/GPS/)
await sql("select gd_set_walk_plan($1,150,'gps')",[room.id])
await admin();await db.query("update gd_order_states set updated_at=now()-interval '20 seconds' where post_id=$1",[room.id]);await auth(uid);await sql('select gd_virtual_tick()')
await admin();await db.query("update gd_order_states set updated_at=now()-interval '20 seconds' where post_id=$1",[room.id]);await auth(uid);await sql('select gd_virtual_tick()');await sql('select gd_virtual_tick()')
await sql("select gd_order_action('receive',$1,'{\"walk_meters\":150,\"walk_source\":\"gps\"}')",[room.id])
await sql('select gd_virtual_tick()');await sql('select gd_virtual_tick()')
assert.equal((await sql('select phase from gd_order_states where post_id=$1',[room.id]))[0].phase,'completed')
assert.equal((await sql('select count(*)::int n from gd_walk_rewards where post_id=$1 and user_id=$2',[room.id,uid]))[0].n,1)
assert.equal((await sql('select meters,points from gd_walk_rewards where post_id=$1 and user_id=$2',[room.id,uid]))[0].points,50)
console.log('PASS: virtual leader accepts and advances; real payments untouched; GPS bounds and exactly-once rewards')
await auth(other)
const nextRoom=(await sql("select p.* from gd_posts p join gd_virtual_rooms v on v.post_id=p.id where v.virtual_leader and p.status='open' limit 1"))[0]
await sql("select gd_action('apply',$1)",[nextRoom.id]);await sql('select gd_virtual_tick()')
await sql("select gd_order_action('nearby-propose',$1,'{\"address\":\"정문 벤치\"}')",[nextRoom.id]);await sql('select gd_virtual_tick()')
let pickupState=(await sql('select * from gd_order_states where post_id=$1',[nextRoom.id]))[0]
assert.equal(pickupState.nearby_agreed,true)
await sql("select gd_pickup_action('propose',$1,$2::jsonb)",[nextRoom.id,JSON.stringify({note:'정문 벤치 오른쪽',expected_updated_at:pickupState.updated_at})]);await sql('select gd_virtual_tick()')
pickupState=(await sql('select * from gd_order_states where post_id=$1',[nextRoom.id]))[0]
assert.equal(pickupState.pickup_agreed_by.length,2)
const nextMenu=(await sql('select menus from gd_menu_catalog where store_name=$1',[nextRoom.restaurant]))[0].menus[0]
await sql('select gd_save_basket($1,$2::jsonb)',[nextRoom.id,JSON.stringify([{id:nextMenu.id,quantity:2}])]);await sql('select gd_virtual_tick()')
assert.equal((await sql('select fee from gd_order_people where post_id=$1 and user_id=$2',[nextRoom.id,other]))[0].fee,nextRoom.delivery_fee)
await sql("select gd_virtual_control($1,'order')",[nextRoom.id])
for(let i=0;i<2;i++){await admin();await db.query("update gd_order_states set updated_at=now()-interval '20 seconds' where post_id=$1",[nextRoom.id]);await auth(other);await sql('select gd_virtual_tick()')}
await sql('select gd_virtual_tick()')
assert.ok((await sql('select pickup_dropped_at from gd_order_states where post_id=$1',[nextRoom.id]))[0].pickup_dropped_at)
await assert.rejects(db.query("select gd_order_action('receive',$1,'{\"walk_meters\":30,\"walk_source\":\"gps\"}')",[nextRoom.id]),/0m/)
await sql("select gd_order_action('receive',$1,'{\"walk_meters\":0,\"walk_source\":\"gps\"}')",[nextRoom.id])
assert.equal((await sql('select phase from gd_order_states where post_id=$1',[nextRoom.id]))[0].phase,'completed')
console.log('PASS: nearby pickup remains 0m and pays the full fee; contactless consent and receipt complete')
await auth(uid)
const mixed=(await sql("select gd_action('create',null,$1::jsonb) id",[JSON.stringify({restaurant:'맘스터치 충남대점',category:'버거',max_members:5,deadline:new Date(Date.now()+3600000).toISOString(),delivery_fee:3000,min_order:12000,meeting:'정문'})]))[0].id
for(let i=0;i<6;i++){
  await admin();await db.query("update gd_virtual_rooms set next_join_at=now()-interval '1 second' where post_id=$1",[mixed]);await auth(uid);await sql('select gd_virtual_tick()')
}
assert.equal((await sql("select count(*)::int n from gd_participations where post_id=$1 and status='pending'",[mixed]))[0].n,3)
await auth(other);await sql("select gd_action('apply',$1)",[mixed]);await sql('select gd_virtual_tick()')
assert.equal((await sql('select status from gd_participations where post_id=$1 and user_id=$2',[mixed,other]))[0].status,'pending')
await auth(uid);await sql("select gd_action('accept',$1,$2::jsonb)",[mixed,JSON.stringify({user_id:other})])
const virtualMembers=await sql("select a.user_id from gd_participations a join gd_testers t on t.user_id=a.user_id where a.post_id=$1 and t.is_virtual",[mixed])
for(const member of virtualMembers)await sql("select gd_action('accept',$1,$2::jsonb)",[mixed,JSON.stringify(member)])
await sql('select gd_virtual_tick()')
assert.equal((await sql('select member_count,status from gd_posts where id=$1',[mixed]))[0].member_count,5)
assert.equal((await sql('select member_count,status from gd_posts where id=$1',[mixed]))[0].status,'closed')
await admin();await db.query('update gd_order_people set claimed_amount=1000,confirmed_amount=1000 where post_id=$1 and user_id=$2',[mixed,other]);await auth(uid)
await sql("select gd_action('cancel',$1)",[mixed]);await sql('select gd_virtual_tick()')
const genuine=(await sql('select confirmed_amount,refund_due from gd_order_people where post_id=$1 and user_id=$2',[mixed,other]))[0]
assert.deepEqual(genuine,{confirmed_amount:1000,refund_due:1000})
console.log('PASS: at most three virtual applicants; real users still need approval; full capacity closes; real refunds preserved')
await admin()
const before=await sql('select count(*)::int n from gd_posts')
await db.exec(readFileSync(new URL('../supabase/APPLY-VIRTUAL-USERS-GPS.sql',import.meta.url),'utf8'))
assert.equal((await sql('select count(*)::int n from gd_posts'))[0].n,before[0].n)
assert.equal((await sql('select count(*)::int n from auth.users'))[0].n,2)
console.log('PASS: migration reruns preserve rooms, rewards and real auth accounts')
await db.close()
