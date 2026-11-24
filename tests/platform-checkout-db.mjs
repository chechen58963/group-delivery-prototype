import { PGlite } from '../.tmp-db-check/node_modules/@electric-sql/pglite/dist/index.js'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

process.on('uncaughtException', e => { console.error(e.message, e.where ?? '', e.internalQuery ?? '', e.stack?.split('\n').slice(1, 3).join('\n')); process.exit(1) })
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated;`)
const file = name => readFileSync(new URL('../supabase/' + name, import.meta.url), 'utf8')
for (const name of ['setup.sql','signup-profiles.sql','menu-discovery.sql','distance-matching.sql','restore-workflow.sql','APPLY-CONSISTENCY-FIXES.sql','APPLY-MENU-IMPROVEMENTS.sql','APPLY-TESTER-FEEDBACK.sql','APPLY-VIRTUAL-USERS-GPS.sql','APPLY-UX-FLOW.sql','APPLY-ORDER-TIMING.sql','APPLY-ORDER-SUGGESTIONS.sql','APPLY-LEADER-REWARDS.sql']) await db.exec(file(name))
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222', outsider='33333333-3333-4333-8333-333333333333'
await db.query('insert into auth.users(id,email_confirmed_at) values($1,now()),($2,now()),($3,now())',[a,b,outsider])
const auth = id => db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`)
const admin = () => db.exec('reset role')
const sql = async (q, params=[]) => (await db.query(q, params)).rows
const act = (action, id, data={}) => sql('select gd_action($1,$2,$3::jsonb)',[action,id,JSON.stringify(data)])
const order = (action,id,data={}) => sql('select gd_order_action($1,$2,$3::jsonb)',[action,id,JSON.stringify(data)])
const checkout = (action,id,data={}) => sql('select gd_platform_checkout($1,$2,$3::jsonb)',[action,id,JSON.stringify(data)])
const state = async id => (await sql('select * from gd_order_states where post_id=$1',[id]))[0]
const people = id => sql('select * from gd_order_people where post_id=$1 order by user_id',[id])
const room = async () => {
  await auth(a)
  const id=(await sql("select gd_action('create',null,$1::jsonb) id",[JSON.stringify({restaurant:'맘스터치 충남대점',category:'버거',max_members:2,deadline:new Date(Date.now()+3600000).toISOString(),delivery_fee:3001,min_order:12000,meeting:'정문 벤치'})]))[0].id
  await sql("select gd_virtual_control($1,'disable')",[id])
  await auth(b);await act('apply',id);await auth(a);await act('accept',id,{user_id:b})
  for(const uid of [a,b]){await auth(uid);await sql('select gd_save_basket($1,$2::jsonb)',[id,JSON.stringify([{id:1,quantity:2}])])}
  await auth(a);await act('close',id)
  return id
}
// An in-flight legacy transfer is created before migration and must not be relabelled.
const legacy=await room()
await order('account',legacy,{bank:'테스트은행',account:'123456',holder:'테스터'})
await order('finalize',legacy)
await auth(b);await order('claim-transfer',legacy);await auth(a);await order('confirm-transfer',legacy,{user_id:b})
const legacyBefore=await state(legacy),legacyPeople=await people(legacy)
await admin();await db.exec(file('APPLY-PLATFORM-CHECKOUT.sql'));await db.exec(file('APPLY-PLATFORM-CHECKOUT.sql'))
await auth(a)
assert.equal((await state(legacy)).checkout_mode,'leader_transfer')
assert.equal((await state(legacy)).account,legacyBefore.account)
assert.equal((await people(legacy))[1].confirmed_amount,legacyPeople[1].confirmed_amount)
await order('leader-ready',legacy);await order('order',legacy);await order('arrive',legacy)
await order('receive',legacy);await auth(b);await order('receive',legacy)
console.log('PASS: migration reruns; old account, confirmed transfers and receipt workflow are preserved')

const id=await room()
await checkout('finalize',id)
assert.equal((await state(id)).phase,'payment');assert.equal((await state(id)).bank,'');assert.equal((await state(id)).meeting_time,null)
const original=await people(id);assert.equal(original.reduce((sum,x)=>sum+x.fee,0),3001)
await auth(outsider)
await assert.rejects(checkout('pay',id,{amount:11301,method:'card'}),/참여 중/)
await assert.rejects(sql('select gd_platform_try_submit($1)',[id]),/permission denied/)
await assert.rejects(sql('select gd_order_before_platform($1,$2,$3::jsonb)',['order',id,'{}']),/permission denied/)
await auth(a)
await assert.rejects(checkout('pay',id,{amount:1,method:'card'}),/금액이 변경/)
await assert.rejects(checkout('pay',id,{amount:11301,method:'unknown'}),/결제 수단/)
await assert.rejects(order('leader-ready',id),/앱 내 결제/)
await assert.rejects(order('order',id),/앱 내 결제/)
await checkout('pay',id,{amount:original[0].food_total+original[0].fee,method:'card'})
assert.equal((await state(id)).phase,'payment')
await checkout('pay',id,{amount:original[0].food_total+original[0].fee,method:'card'})
assert.equal((await people(id))[0].confirmed_amount,original[0].food_total+original[0].fee)
await auth(b);await checkout('pay',id,{amount:original[1].food_total+original[1].fee,method:'easy'})
assert.equal((await state(id)).phase,'ordered');assert.ok((await state(id)).platform_submitted_at)
const submitted=(await state(id)).platform_submitted_at
await checkout('pay',id,{amount:original[1].food_total+original[1].fee,method:'easy'})
assert.deepEqual((await state(id)).platform_submitted_at,submitted)
await assert.rejects(act('withdraw',id),/주문 후/)
await auth(a);await assert.rejects(order('delivering',id),/접수를 기다려/)
await admin();await db.query("update gd_order_states set platform_submitted_at=now()-interval '5 seconds' where post_id=$1",[id]);await auth(a)
await sql('select gd_virtual_tick()');assert.ok((await state(id)).platform_accepted_at)
await order('delivering',id);await order('arrive',id);await order('receive',id)
await auth(b);await order('receive',id);assert.equal((await state(id)).phase,'completed')
console.log('PASS: authenticated own payments, amount validation, leader payment, fee remainder, duplicate payment and exactly-once auto submission')

const cancelled=await room();await checkout('finalize',cancelled)
const bill=(await people(cancelled))[0];await checkout('pay',cancelled,{amount:bill.food_total+bill.fee,method:'easy'})
await act('cancel',cancelled)
const refunded=(await people(cancelled))[0]
assert.equal(refunded.refunded_amount,refunded.confirmed_amount);assert.ok(refunded.platform_refunded_at)
assert.equal(refunded.refund_due,0);assert.equal(refunded.platform_paid_at,null)
await assert.rejects(checkout('pay',cancelled,{amount:bill.food_total+bill.fee,method:'easy'}),/참여 중|대기 상태/)
console.log('PASS: cancellation refunds the leader too and blocks late payment')

const changed=await room();await checkout('finalize',changed)
let items=await people(changed);await checkout('pay',changed,{amount:items[0].food_total+items[0].fee,method:'card'})
await auth(b);await act('withdraw',changed);await auth(a)
items=await people(changed);assert.equal((await state(changed)).phase,'menu')
assert.equal(items[0].confirmed_amount-items[0].refunded_amount,0);assert.ok(items[0].platform_refunded_at)
await assert.rejects(checkout('finalize',changed),/한 명 더/)
await act('reopen',changed);await auth(b);await act('apply',changed);await auth(a);await act('accept',changed,{user_id:b})
await auth(b);await sql('select gd_save_basket($1,$2::jsonb)',[changed,JSON.stringify([{id:1,quantity:2}])]);await auth(a);await act('close',changed)
await checkout('finalize',changed)
items=await people(changed);await checkout('pay',changed,{amount:items[0].food_total+items[0].fee,method:'card'})
await auth(b);await checkout('pay',changed,{amount:items[1].food_total+items[1].fee,method:'easy'})
assert.equal((await state(changed)).phase,'ordered')
console.log('PASS: withdrawal refunds existing payments; rejoining recalculates and pays once against the new bill')

// New virtual-led rooms use the same checkout. Old explicit order shortcut is denied.
await admin();await db.exec("update gd_participations set active=false where user_id in('"+a+"','"+b+"')")
await auth(a)
await sql('select gd_virtual_tick()')
const vr=(await sql("select p.id from gd_posts p join gd_virtual_rooms v on v.post_id=p.id where v.virtual_leader and p.status='open' limit 1"))[0].id
// Existing untouched virtual rooms may be legacy; new rooms have platform defaults.
await admin();await db.query("update gd_order_states set checkout_mode='platform' where post_id=$1 and phase='menu'",[vr]);await auth(a)
await act('apply',vr);await sql('select gd_virtual_tick()')
await sql('select gd_save_basket($1,$2::jsonb)',[vr,JSON.stringify([{id:1,quantity:4}])]);await sql('select gd_virtual_tick()')
assert.equal((await state(vr)).phase,'payment')
await assert.rejects(sql("select gd_virtual_control($1,'order')",[vr]),/내 금액을 결제/)
let mine=(await people(vr)).find(x=>x.user_id===a)
assert.equal(mine.confirmed_amount,0)
await checkout('pay',vr,{amount:mine.food_total+mine.fee,method:'easy'});await sql('select gd_virtual_tick()')
assert.equal((await state(vr)).phase,'ordered')
await admin();await db.query("update gd_order_states set platform_submitted_at=now()-interval '30 seconds',updated_at=now()-interval '30 seconds' where post_id=$1",[vr]);await auth(a)
await sql('select gd_virtual_tick()');assert.ok((await state(vr)).platform_accepted_at)
console.log('PASS: virtual actors pay only for themselves; a real participant still confirms their own checkout')
// Notification deletion is permanent and scoped to its recipient.
await admin()
const noteA=(await sql("insert into gd_menu_notifications(recipient_id,peer_id,kind,signature,payload,expires_at) values($1,$2,'group_invite','delete-a','{}',now()+interval '1 hour') returning id",[a,b]))[0].id
const noteB=(await sql("insert into gd_menu_notifications(recipient_id,peer_id,kind,signature,payload,expires_at) values($1,$2,'group_invite','delete-b','{}',now()+interval '1 hour') returning id",[b,a]))[0].id
await auth(a);await sql('select gd_delete_menu_notifications($1::uuid[])',[[noteA,noteB]])
assert.equal((await sql('select count(*)::int n from gd_menu_notifications where id=$1',[noteA]))[0].n,0)
await auth(b);assert.equal((await sql('select count(*)::int n from gd_menu_notifications where id=$1',[noteB]))[0].n,1)
await sql('select gd_delete_menu_notifications($1::uuid[])',[[noteB]])
assert.equal((await sql('select count(*)::int n from gd_menu_notifications where id=$1',[noteB]))[0].n,0)
console.log('PASS: deletion removes database rows permanently and cannot delete someone else\'s notification')
await db.close()
