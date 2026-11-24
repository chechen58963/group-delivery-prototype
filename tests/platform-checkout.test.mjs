import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const load = name => { const m={exports:{}}; new Function('module','exports',ts.transpileModule(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m,m.exports);return m.exports }
const {platformCheckout,platformPaid,merchantStatus}=load('platformCheckout.ts')
const {orderActionRequest}=load('orderActionRequest.ts')
const {orderNextStep}=load('orderGuidance.ts')

test('new menu preparation uses platform checkout while existing transfer ledgers retain their workflow',()=>{
  assert.equal(platformCheckout({phase:'menu'},[]),true)
  assert.equal(platformCheckout({phase:'payment'},[]),false)
  assert.equal(platformCheckout({phase:'menu'},[{confirmed_amount:100,claimed_amount:100,refund_due:0}]),false)
  assert.equal(platformCheckout({phase:'payment',checkout_mode:'platform'}),true)
})
test('zero-cost, refunded and partially paid members require a confirmed checkout timestamp',()=>{
  const p={food_total:0,fee:0,coupon_discount:0,confirmed_amount:0,refunded_amount:0}
  assert.equal(platformPaid(p),false)
  assert.equal(platformPaid({...p,platform_paid_at:'now'}),true)
  assert.equal(platformPaid({...p,food_total:100,confirmed_amount:100,refunded_amount:100,platform_paid_at:'now'}),false)
  assert.equal(platformPaid({...p,food_total:100,confirmed_amount:200,refunded_amount:100,platform_paid_at:'now'}),true)
})
test('merchant acceptance differs from submission and never means food has arrived',()=>{
  assert.match(merchantStatus({phase:'ordered'}),/전달하고/)
  assert.match(merchantStatus({phase:'ordered',platform_accepted_at:'now'}),/조리 중/)
  assert.doesNotMatch(merchantStatus({phase:'ordered',platform_accepted_at:'now'}),/도착했/)
})
test('platform financial actions route to the dedicated prototype API',()=>{
  for(const action of ['pay','finalize','coupon'])assert.deepEqual(orderActionRequest('platform-'+action,'room',{amount:500}),{name:'gd_platform_checkout',args:{p_action:action,p_post:'room',p_data:{amount:500}}})
  assert.equal(orderActionRequest('receive','room').name,'gd_order_action')
})
test('leader and participant next actions consistently use platform checkout, even in virtual-led rooms',()=>{
  for(const role of ['leader','participant']){
    const next=orderNextStep({role,application:'accepted',phase:'payment',count:2,virtualLeader:true,platform:true})
    assert.equal(next.action,'내 금액 결제하기');assert.match(next.description,/가게에 주문을 전달/)
    assert.doesNotMatch(next.description,/송금|리더가.*입금/)
  }
})
