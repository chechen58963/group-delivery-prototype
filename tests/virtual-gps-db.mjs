// Run after installing PGlite in the ignored .tmp-db-check directory.
import { PGlite } from '../.tmp-db-check/node_modules/@electric-sql/pglite/dist/index.js'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const routing={exports:{}}
new Function('module','exports',ts.transpileModule(readFileSync(new URL('../src/orderActionRequest.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(routing,routing.exports)

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
await db.exec(readFileSync(new URL('../supabase/APPLY-UX-FLOW.sql',import.meta.url),'utf8'))
await db.exec('set role anon')
const publicRooms=await sql('select * from gd_public_rooms()')
assert.ok(publicRooms.length>0)
assert.ok(!Object.keys(publicRooms[0]).some(k=>['owner_id','account','note','bank','holder'].includes(k)))
await assert.rejects(db.query('select * from gd_posts'),/permission denied/)
await auth(uid)
assert.equal(Number((await sql('select * from gd_reputation() where user_id=$1',[uid]))[0].trades),0)
await assert.rejects(db.query("select gd_order_action('review',$1,$2::jsonb)",[room.id,JSON.stringify({user_id:room.owner_id,stars:5,comment:'test'})]),/실제 참가자/)
console.log('PASS: guest browse excludes private data and raw tables; virtual-only orders do not inflate reputation')
await admin();await db.exec(readFileSync(new URL('../supabase/APPLY-UX-FLOW.sql',import.meta.url),'utf8'))
console.log('PASS: UX migration safely reruns')
await admin();await db.exec(readFileSync(new URL('../supabase/APPLY-ORDER-TIMING.sql',import.meta.url),'utf8'))
await auth(uid)
const timed=(await sql("select gd_action('create',null,$1::jsonb) id",[JSON.stringify({restaurant:'맘스터치 충남대점',category:'버거',max_members:2,deadline:new Date(Date.now()+3600000).toISOString(),delivery_fee:3000,min_order:12000,meeting:'정문',note:JSON.stringify({format:'campus-v1',starts_at:new Date(Date.now()+3600000).toISOString()})})]))[0].id
await sql("select gd_virtual_control($1,'disable')",[timed])
await auth(other);await sql("select gd_action('apply',$1)",[timed]);await auth(uid);await sql("select gd_action('accept',$1,$2::jsonb)",[timed,JSON.stringify({user_id:other})])
for(const user of [uid,other]){await auth(user);await sql('select gd_save_basket($1,$2::jsonb)',[timed,JSON.stringify([{id:1,quantity:2}])])}
await auth(uid);await sql("select gd_order_action('account',$1,$2::jsonb)",[timed,JSON.stringify({bank:'test',account:'123',holder:'test'})])
await sql("select gd_order_action('meeting',$1,$2::jsonb)",[timed,JSON.stringify({meeting:'정문',time:null})])
await sql("select gd_order_action('finalize',$1)",[timed])
assert.equal((await sql('select phase,meeting_time,planned_order_at from gd_order_states where post_id=$1',[timed]))[0].meeting_time,null)
await auth(other);await sql("select gd_order_action('claim-transfer',$1)",[timed]);await auth(uid)
await sql("select gd_order_action('confirm-transfer',$1,$2::jsonb)",[timed,JSON.stringify({user_id:other})]);await sql("select gd_order_action('leader-ready',$1)",[timed]);await sql("select gd_order_action('order',$1)",[timed])
const eta={start:new Date(Date.now()+1200000).toISOString(),end:new Date(Date.now()+1800000).toISOString()}
await sql("select gd_order_action('delivery-eta',$1,$2::jsonb)",[timed,JSON.stringify(eta)])
await auth(other);await assert.rejects(db.query("select gd_order_action('delivery-eta',$1,$2::jsonb)",[timed,JSON.stringify(eta)]),/리더/)
await auth(uid);await sql("select gd_order_action('arrive',$1)",[timed])
await admin();await db.query("update gd_order_states set arrived_at=now()-interval '20 minutes',meeting_time=now()+interval '1 day' where post_id=$1",[timed]);await auth(uid)
await assert.rejects(db.query("select gd_order_action('late-report',$1,$2::jsonb)",[timed,JSON.stringify({user_id:other})]),/안내를 확인/)
await auth(other);const acknowledgement=routing.exports.orderActionRequest('pickup-notice-seen',timed);assert.equal(acknowledgement.name,'gd_order_action');await sql(`select ${acknowledgement.name}($1,$2,$3::jsonb)`,[acknowledgement.args.p_action,acknowledgement.args.p_post,JSON.stringify(acknowledgement.args.p_data)]);await auth(uid)
await assert.rejects(db.query("select gd_order_action('late-report',$1,$2::jsonb)",[timed,JSON.stringify({user_id:other})]),/10분/)
await admin();await db.query("update gd_order_people set pickup_notice_seen_at=now()-interval '11 minutes' where post_id=$1 and user_id=$2",[timed,other]);await auth(uid)
await sql("select gd_order_action('late-report',$1,$2::jsonb)",[timed,JSON.stringify({user_id:other})])
assert.equal((await sql('select late_reported from gd_order_people where post_id=$1 and user_id=$2',[timed,other]))[0].late_reported,true)
await admin();await db.exec(readFileSync(new URL('../supabase/APPLY-ORDER-TIMING.sql',import.meta.url),'utf8'))
console.log('PASS: no pickup-time requirement; ETA is leader-only; late report needs acknowledgement plus grace; migration reruns')
// Leader bonuses use the existing receipt transaction and wallet, without rewriting old earnings.
await admin()
const historical=JSON.stringify(await sql('select post_id,user_id,meters,points,awarded_at,rule_version from gd_walk_rewards order by post_id,user_id'))
const leaderMigration=readFileSync(new URL('../supabase/APPLY-LEADER-REWARDS.sql',import.meta.url),'utf8')
await db.exec(leaderMigration)
assert.equal(JSON.stringify(await sql('select post_id,user_id,meters,points,awarded_at,rule_version from gd_walk_rewards order by post_id,user_id')),historical)
await db.exec("update gd_walk_rewards set awarded_at=now()-interval '2 days'")
await auth(uid);await sql("select gd_order_action('receive',$1,'{\"walk_meters\":0,\"walk_source\":\"gps\"}')",[timed])
assert.equal((await sql('select count(*)::int n from gd_walk_rewards where post_id=$1',[timed]))[0].n,0)
await auth(other);await sql("select gd_order_action('receive',$1,'{\"walk_meters\":50,\"walk_source\":\"gps\"}')",[timed])
await auth(uid)
let leaderReward=(await sql('select points,leader_bonus from gd_walk_rewards where post_id=$1 and user_id=$2',[timed,uid]))[0]
assert.deepEqual(leaderReward,{points:70,leader_bonus:50})
await auth(other);assert.deepEqual((await sql('select points,leader_bonus from gd_walk_rewards where post_id=$1',[timed]))[0],{points:30,leader_bonus:0})
await admin();await db.query("update gd_order_states set phase='completed' where post_id=$1",[timed])
assert.equal((await sql('select count(*)::int n from gd_walk_rewards where post_id=$1',[timed]))[0].n,2)
const afterReward=JSON.stringify(await sql('select * from gd_walk_rewards order by post_id,user_id'))
await db.exec(leaderMigration);assert.equal(JSON.stringify(await sql('select * from gd_walk_rewards order by post_id,user_id')),afterReward)
console.log('PASS: leader earns 50P only after all receipts; participant amount unchanged; no historical backfill or duplicate bonus')

async function rewardFixture(meters,virtual=false,cancel=false){
 await auth(uid)
 const id=(await sql("select gd_action('create',null,$1::jsonb) id",[JSON.stringify({restaurant:'맘스터치 충남대점',category:'버거',max_members:2,deadline:new Date(Date.now()+3600000).toISOString(),delivery_fee:3000,min_order:12000,meeting:'정문'})]))[0].id
 if(virtual){
  await admin();await db.query("update gd_virtual_rooms set next_join_at=now()-interval '1 second' where post_id=$1",[id]);await auth(uid);await sql('select gd_virtual_tick()')
  const actor=(await sql("select user_id from gd_participations where post_id=$1 and status='pending'",[id]))[0].user_id
  await sql("select gd_action('accept',$1,$2::jsonb)",[id,JSON.stringify({user_id:actor})])
 }else{
  await sql("select gd_virtual_control($1,'disable')",[id])
  await auth(other);await sql("select gd_action('apply',$1)",[id]);await auth(uid);await sql("select gd_action('accept',$1,$2::jsonb)",[id,JSON.stringify({user_id:other})])
 }
 await sql("select gd_order_action('initialize',$1)",[id]);await admin()
 await db.query('update gd_order_people set received_at=now() where post_id=$1',[id])
 await db.query("insert into gd_walk_plans(post_id,user_id,meters,source) values($1,$2,$3,'gps') on conflict(post_id,user_id) do update set meters=excluded.meters",[id,uid,meters])
 await db.query('update gd_order_states set phase=$2 where post_id=$1',[id,cancel?'cancelled':'completed'])
 await db.query("update gd_participations set active=false where post_id=$1",[id])
 return id
}
await admin();await db.exec("update gd_walk_rewards set awarded_at=now()-interval '2 days'")
const full=await rewardFixture(400)
assert.deepEqual((await sql('select points,leader_bonus from gd_walk_rewards where post_id=$1 and user_id=$2',[full,uid]))[0],{points:150,leader_bonus:50})
const capped=await rewardFixture(0)
assert.deepEqual((await sql('select points,leader_bonus from gd_walk_rewards where post_id=$1 and user_id=$2',[capped,uid]))[0],{points:50,leader_bonus:30})
await auth(uid);assert.equal(Number((await sql('select today_earned from gd_point_wallet()'))[0].today_earned),200)
await admin();await db.exec("update gd_walk_rewards set awarded_at=now()-interval '2 days'")
const bot=await rewardFixture(0,true)
assert.equal((await sql('select leader_bonus from gd_walk_rewards where post_id=$1 and user_id=$2',[bot,uid]))[0].leader_bonus,0)
const cancelled=await rewardFixture(0,false,true)
assert.equal((await sql('select count(*)::int n from gd_walk_rewards where post_id=$1',[cancelled]))[0].n,0)
await auth(uid);await assert.rejects(db.query('update gd_walk_rewards set leader_bonus=50'),/permission denied/)
console.log('PASS: daily 200P cap includes the leader bonus; virtual-only and cancelled rooms give no leader bonus; client cannot alter points')

await admin()
const scheduleOwner = '44444444-4444-4444-8444-444444444444'
await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[scheduleOwner])
const originalPlan = new Date(Math.floor(Date.now()/60000)*60000 + 3600000).toISOString()
const legacySchedule = {restaurant:'맘스터치 충남대점',category:'버거',max_members:2,delivery_fee:3000,min_order:12000,
  meeting:'충남대 정문',deadline:new Date(Date.parse(originalPlan)+600000).toISOString(),
  note:JSON.stringify({format:'campus-v1',starts_at:originalPlan})}
await auth(scheduleOwner)
const legacyRoom = (await sql("select gd_action('create',null,$1::jsonb) id",[JSON.stringify(legacySchedule)]))[0].id
await admin()
const scheduleMigration = readFileSync(new URL('../supabase/APPLY-RECRUITMENT-SCHEDULE.sql',import.meta.url),'utf8')
await db.exec(scheduleMigration)
const roomSchedule = async id => (await sql(`select p.deadline,gd_recruitment_plan(p.note) as planned,s.planned_order_at as detail
  from gd_posts p left join gd_order_states s on s.post_id=p.id where p.id=$1`,[id]))[0]
const corrected = await roomSchedule(legacyRoom)
assert.equal(new Date(corrected.planned).toISOString(),originalPlan)
assert.ok(corrected.deadline < corrected.planned)
await db.exec(scheduleMigration)
assert.deepEqual(await roomSchedule(legacyRoom),corrected)

const demoRoom = (await sql(`select p.id,p.restaurant from gd_posts p join gd_virtual_rooms v on v.post_id=p.id
  where v.virtual_leader and p.status='open' and not exists(select 1 from gd_participations a join gd_testers t on t.user_id=a.user_id
  where a.post_id=p.id and not t.is_virtual) limit 1`))[0]
const assertDemoSchedule = async id => {
  const schedule = await roomSchedule(id)
  assert.equal(Date.parse(schedule.planned)-Date.parse(schedule.deadline),10*60000)
  assert.equal(Date.parse(schedule.planned),Date.parse(schedule.detail))
}
await db.query("update gd_posts set deadline=now()+interval '1 minute' where id=$1",[demoRoom.id])
await db.query("update gd_order_states set planned_order_at=now()-interval '1 day' where post_id=$1",[demoRoom.id])
await db.exec('select gd_virtual_seed()')
await assertDemoSchedule(demoRoom.id)
await db.query("update gd_posts set status='closed' where id=$1",[demoRoom.id])
await db.exec('select gd_virtual_seed()')
const replacement = (await sql("select id from gd_posts where restaurant=$1 and status='open' and id<>$2 order by created_at desc limit 1",[demoRoom.restaurant,demoRoom.id]))[0]
await assertDemoSchedule(replacement.id)
await auth(scheduleOwner)
const earlier = new Date(Date.parse(originalPlan)-1200000).toISOString()
await sql("select gd_order_action('order-plan',$1,$2::jsonb)",[legacyRoom,JSON.stringify({start:earlier,end:originalPlan})])
await admin()
const edited = await roomSchedule(legacyRoom)
assert.equal(new Date(edited.detail).toISOString(),earlier)
assert.equal(Date.parse(edited.planned)-Date.parse(edited.deadline),60000)
await auth(scheduleOwner)
await sql("select gd_action('cancel',$1)",[legacyRoom])
await assert.rejects(db.query("select gd_action('create',null,$1::jsonb)",[JSON.stringify(legacySchedule)]),/마감은 주문 예정 시각보다 앞서야/)
console.log('PASS: existing, new, renewed and rescheduled rooms close before the planned order; repeat migration is stable')
await db.close()
