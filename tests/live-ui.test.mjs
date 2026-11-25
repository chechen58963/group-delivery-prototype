import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

// Render the production components with controlled context data. No browser,
// credentials, Supabase requests, or persisted account data are used here.
const require = createRequire(import.meta.url)
const src = path.resolve('src')
let shared, discovery, lifecycle
const placeholder = name => () => React.createElement('div', { 'data-feature': name }, name)
const mocks = {
  './foodPhotos': { foodPhotoSource: () => '/images/coffee.jpg' },
  './supabase': { supabase: {} },
  './SharedDelivery': { useSharedDelivery: () => shared },
  './MenuDiscoveryContext': { useMenuDiscovery: () => discovery, FOOD_CHOICES: [{ id: 'coffee', name: '커피' }, { id: 'burger', name: '햄버거' }, { id: 'sandwich', name: '샌드위치' }], areaName: () => '충남대 정문', money: n => n.toLocaleString('ko-KR') + '원', formatWindow: () => '오늘 18:00' },
  './MenuDiscovery': { LocationChoice: placeholder('위치 설정'), StoreSheet: placeholder('메뉴 선택'), BasketEditor: placeholder('메뉴 편집'), SmallIcon: placeholder('아이콘') },
  './WalkingRewards': { WalkingRewardDetails: placeholder('이동 포인트'), WalkingRewardWallet: placeholder('포인트 지갑'), WalkingRewardReceipt: placeholder('수령 포인트') },
  './AppPreferences': { usePreferences: () => ({ currentLocation: {} }) },
  './RecruitmentProgress': { default: placeholder('모집 진행') },
}
const cache = new Map()
function load(file) {
  const filename = path.resolve(src, file)
  if (cache.has(filename)) return cache.get(filename)
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  const localRequire = specifier => {
    if (specifier in mocks) return { __esModule: true, ...mocks[specifier] }
    if (specifier.endsWith('.css')) return {}
    if (!specifier.startsWith('.')) return require(specifier)
    const resolved = path.resolve(path.dirname(filename), specifier)
    if (specifier.endsWith('.json')) return JSON.parse(readFileSync(resolved, 'utf8'))
    const candidate = [resolved, resolved + '.tsx', resolved + '.ts'].find(p => existsSync(p))
    if (!candidate) throw new Error('Cannot load ' + specifier)
    return load(candidate)
  }
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  cache.set(filename, module.exports)
  return module.exports
}
const helpers = load('DeliveryLifecycle.tsx')
mocks['./DeliveryLifecycle'] = { ...helpers, useDeliveryLifecycle: () => lifecycle }
const { LiveExplore, LiveOrders, LiveStorePicker } = load('LiveDiscovery.tsx')
const { OrderMenu, OrderPayment, OrderReceipt } = load('OrderScreens.tsx')
const {default:OrderSuggestionsPanel}=load('OrderSuggestionsPanel.tsx')
const {suggestionDraft,findWishStores}=load('orderSuggestions.ts')
const {default:OrderWishEditor}=load('OrderWishEditor.tsx')
const {MenuAlerts}=load('MenuDiscovery.tsx')
const render = component => renderToStaticMarkup(React.createElement(component, { push() {}, pop() {} }))
function reset() {
  const raw = { id: 'room-1', owner_id: 'leader', restaurant: '이디야커피 충대정문점', category: '카페', status: 'open', member_count: 1, max_members: 2, delivery_fee: 3000, min_order: 8000, meeting: '정문 벤치', deadline: '2026-12-01T09:00:00Z', pickup_lat: 36.3621, pickup_lng: 127.3444 }
  const post = { id: 1000000, sharedId: raw.id, restaurant: raw.restaurant, status: 'recruiting', currentMembers: 1, maxMembers: 2, category: '카페', deadline: '20분 뒤', description: '같이 주문해요' }
  shared = { session: { user: { id: 'me' } }, allowed: true, ready: true, initializing: false, rawPosts: [raw], posts: [post], members: [], active: false, activeTx: null, me: { nickname: '테스터' }, nickname: id => id === 'me' ? '테스터' : '리더', numberFor: () => 1000000 }
  discovery = { preferencesReady: true, listScroll: { current: 0 }, matchLocation: { lat: raw.pickup_lat, lng: raw.pickup_lng }, catalog: [{ store_name: raw.restaurant, menu_key: 'coffee', goal_amount: 8000, menus: [{ id: 1, name: '카페 아메리카노', price: 3200 }] }], browseCategory: 'all', browseRange: 'all', browseView: 'list', search: '', sort: 'recent', intent: null, error: '', baskets: [], setBrowseRange() {}, saveListScroll() {} }
  lifecycle = { states: [], members: [], reviews: [], reputations: [], reports: [], orderPeople: [], state: null, post: null, mine: null, owner: false, uid: 'me', selectedId: 'room-1', error: '', busy: false, reputation: () => undefined }
}
test('connected discovery renders actual fees, slots and store data without generated sample rooms', () => {
  reset()
  const html = render(LiveExplore)
  assert.match(html, /이디야커피 모집 상세/)
  assert.match(html, /1,500원/)
  assert.match(html, /1 \/ 2명/)
  assert.doesNotMatch(html, /아아 한 잔, 같이 시킬 분|민지|1,280 P/)
})

test('virtual rooms are explicitly identified in the normal discovery list',()=>{
  reset();shared.isVirtual=()=>true
  assert.match(render(LiveExplore),/가상 유저의 모집/)
})

test('a virtual leader offers order progression without asking the real participant to transfer',()=>{
  reset();shared.isVirtual=()=>true
  lifecycle.post=shared.rawPosts[0]
  lifecycle.state={phase:'payment'}
  lifecycle.mine={food_total:3200,fee:1500,coupon_discount:0}
  lifecycle.members=[{user_id:'me'}]
  const html=render(OrderPayment)
  assert.match(html,/내 주문 결제/)
  assert.match(html,/내 금액 결제로 이동/)
  assert.match(html,/4,700원/)
  assert.doesNotMatch(html,/송금했어요|계좌번호|남은 송금액/)
})
test('nearby discovery filters actual coordinates, while all-range discovery keeps distant posts', () => {
  reset()
  shared.rawPosts[0].pickup_lat += .02
  discovery.browseRange = 'near'
  assert.doesNotMatch(render(LiveExplore), /이디야커피 모집 상세/)
  discovery.browseRange = 'all'
  assert.match(render(LiveExplore), /이디야커피 모집 상세/)
})
test('search includes catalogue menu names and category filters apply to real rooms', () => {
  reset()
  discovery.search = '아메리카노'
  assert.match(render(LiveExplore), /모집 상세/)
  discovery.browseCategory = 'burger'
  assert.doesNotMatch(render(LiveExplore), /모집 상세/)
})
test('an empty room search opens matching with the exact catalogue store and item', () => {
  reset()
  shared.posts = []
  const burgers = {store_name:'맘스터치 충남대점',menu_key:'burger',goal_amount:12000,menus:[
    {id:1,name:'불싸이버거',price:5100},{id:7,name:'싸이버거',price:4900},
  ]}
  discovery.catalog.push(burgers)
  discovery.search = '싸이버거'
  assert.match(render(LiveExplore), /싸이버거 같이 먹을 사람 찾기/)
  discovery.intent = {wish_store:discovery.catalog[0].store_name, wish_menu_id:1}
  const choices = findWishStores(discovery.catalog, {query:discovery.search, category:'all'})
  assert.deepEqual(choices.map(c => c.menus.map(m => m.id)), [[7]])
  const editor = renderToStaticMarkup(React.createElement(OrderWishEditor, {choices,close(){}}))
  assert.match(editor, /value="맘스터치 충남대점" selected=""/)
  assert.match(editor, /value="7" selected="">싸이버거/)
  assert.doesNotMatch(editor, /불싸이버거|이디야커피/)
  shared.session = null
  assert.match(render(LiveExplore), /싸이버거 같이 먹을 사람 찾기/)
  discovery.search = '없는 메뉴'
  assert.match(render(LiveExplore), /다른 메뉴로 배프 찾기/)
})
test('ambiguous searches ask for a matching store and respect the active category', () => {
  reset()
  discovery.catalog.push({...discovery.catalog[0],store_name:'빽다방 충남대점'})
  const choices = findWishStores(discovery.catalog, {query:' 카페 아메리카노 ',category:'coffee'})
  const html = renderToStaticMarkup(React.createElement(OrderWishEditor, {choices,close(){}}))
  assert.match(html, /가게를 선택해 주세요/)
  assert.match(html, /빽다방/)
  assert.deepEqual(findWishStores(discovery.catalog, {query:'아메리카노',category:'burger'}), [])
})
test('recruitment cards show the pickup landmark without the visitor sharing a location', () => {
  reset()
  discovery.matchLocation = null
  assert.match(render(LiveExplore), /수령 · 정문 벤치/)
  shared.session = null
  shared.rawPosts[0].meeting = '지도에 표시된 공개 수령점'
  assert.match(render(LiveExplore), /수령 · 충남대 정문/)
  shared.rawPosts[0].pickup_lat = null
  shared.rawPosts[0].meeting = ''
  assert.match(render(LiveExplore), /수령 · 참가 후 장소 조율/)
})
test('full rooms are not advertised as available to join', () => {
  reset()
  shared.rawPosts[0].member_count = 2
  assert.doesNotMatch(render(LiveExplore), /모집 상세/)
})
test('logged-out discovery previews public rooms and explains who places the order', () => {
  reset()
  shared.session = null
  assert.match(render(LiveExplore), /배프가 가게에 주문 전달/)
  assert.match(render(LiveExplore), /모집 상세/)
  assert.match(render(LiveStorePicker), /이디야커피/)
})
test('order history is restricted to memberships of the current account', () => {
  reset()
  shared.members = [{ post_id: 'room-1', user_id: 'another', status: 'accepted' }]
  assert.match(render(LiveOrders), /아직 함께한 주문이 없어요/)
  shared.members.push({ post_id: 'room-1', user_id: 'me', status: 'pending', active: true })
  assert.match(render(LiveOrders), /수락 대기/)
})
function prepareOrder() {
  reset()
  shared.members = [{ id: 'member1', post_id: 'room-1', user_id: 'me', status: 'accepted', active: true }, { id: 'member2', post_id: 'room-1', user_id: 'other', status: 'accepted', active: true }]
  discovery.baskets = shared.members.map(m => ({ post_id: 'room-1', user_id: m.user_id, total: 4200, items: [{ id: 2, name: '카페 라떼', price: 4200, quantity: 1 }] }))
  lifecycle = { ...lifecycle, post: { ...shared.rawPosts[0], owner_id: 'me', status: 'closed' }, members: shared.members, owner: true, state: { phase: 'menu', meeting: '정문 벤치', meeting_time: '2026-12-01T09:00:00Z', bank: '테스트은행', account: '1234567890', holder: '테스터', updated_at: 'v1' } }
}
test('leader order preparation keeps a single next action and leaves settings behind explicit tools', () => {
  prepareOrder()
  const html = render(OrderMenu)
  assert.match(html, /주문 확정하고 결제로/)
  assert.match(html, /live-workflow-footer/)
  assert.match(html, /4,200원/)
  assert.match(html, /정문 벤치/)
  assert.doesNotMatch(html, /name="account"|name="bank"|name="holder"/)
})
test('platform finalization needs menus, goal and a pickup place but no leader bank account', () => {
  prepareOrder()
  lifecycle.state.account = ''
  let html = render(OrderMenu)
  assert.doesNotMatch(html, /송금받을 리더 계좌를 저장해 주세요/)
  assert.doesNotMatch(html, /disabled=""[^>]*>주문 확정하고 결제로/)
  lifecycle.state.account = '1234567890'
  lifecycle.post.min_order = 20000
  html = render(OrderMenu)
  assert.match(html, /11,600원/)
  assert.match(html, /disabled=""[^>]*>주문 확정하고 결제로/)
})

test('leader cancellation is visible before ordering and hidden after an order is placed',()=>{
  prepareOrder();shared.rawPosts[0]=lifecycle.post
  lifecycle.states=[{...lifecycle.state,post_id:'room-1'}]
  assert.match(render(OrderMenu),/>모집 취소</)
  lifecycle.states[0].phase='ordered'
  assert.doesNotMatch(render(OrderMenu),/>모집 취소</)
})

test('a pickup place without an agreed arrival time can be finalized',()=>{
  prepareOrder();lifecycle.state.meeting_time=null
  const html=render(OrderMenu)
  assert.match(html,/>주문 확정하고 결제로</)
  assert.doesNotMatch(html,/disabled=""[^>]*>주문 확정하고 결제로/)
  assert.doesNotMatch(html,/수령 장소와 시간을 저장/)
})
test('participant preparation cannot confirm the leader order and exposes pending pickup proposals', () => {
  prepareOrder()
  lifecycle.owner = false
  lifecycle.state.nearby_requester = 'other'
  lifecycle.state.nearby_agreed = false
  const html = render(OrderMenu)
  assert.doesNotMatch(html, /주문 확정하고 결제로/)
  assert.match(html, /리더가 주문을 확정하면/)
  assert.match(html, /내 근처 수령 제안이 왔어요/)
})
function preparePayment() {
  prepareOrder()
  lifecycle.owner = false
  lifecycle.post.owner_id = 'other'
  lifecycle.state.phase = 'payment'
  lifecycle.orderPeople = shared.members.map(m => ({ user_id: m.user_id, food_total: 4200, fee: 1500, coupon_discount: 0, claimed_amount: 0, confirmed_amount: 0, refunded_amount: 0, refund_due: 0 }))
  lifecycle.mine = lifecycle.orderPeople[0]
}
test('participant payment uses the actual ledger amount and disables a duplicate transfer claim', () => {
  preparePayment()
  let html = render(OrderPayment)
  assert.match(html, /5,700원/)
  assert.match(html, /live-workflow-footer/)
  assert.match(html, />송금했어요</)
  lifecycle.mine.claimed_amount = 5700
  html = render(OrderPayment)
  assert.match(html, /disabled=""[^>]*>송금했어요/)
  assert.match(html, /리더의 입금 확인을 기다리고 있어요/)
})
test('a withdrawn participant keeps refund information but cannot claim a new transfer', () => {
  preparePayment()
  lifecycle.members = lifecycle.members.filter(m => m.user_id !== 'me')
  lifecycle.mine.refund_due = 5700
  const html = render(OrderPayment)
  assert.doesNotMatch(html, />송금했어요</)
  assert.match(html, /환불 5,700원/)
})
test('leader payment gives one primary preparation action before enabling ordering', () => {
  preparePayment()
  lifecycle.owner = true
  lifecycle.post.owner_id = 'me'
  lifecycle.state.leader_ready = false
  let html = render(OrderPayment)
  assert.match(html, /내 결제 준비 완료</)
  assert.doesNotMatch(html, /배달앱 주문 완료 기록/)
  lifecycle.state.leader_ready = true
  html = render(OrderPayment)
  assert.match(html, /모든 참가자의 입금을 확인해 주세요/)
  assert.match(html, /disabled=""[^>]*>배달앱 주문 완료 기록/)
})


test('agreed nearby pickup shows my actual delivery fee before payment',()=>{
 prepareOrder();lifecycle.state.nearby_agreed=true;lifecycle.state.nearby_requester='other'
 let html=render(OrderMenu);assert.match(html,/이동하는 내 배달비/);assert.doesNotMatch(html,/균등 분담 시/)
 lifecycle.state.nearby_requester='me';html=render(OrderMenu);assert.match(html,/내가 배달비 전액 부담/)
 assert.match(html,/3,000원/);assert.doesNotMatch(html,/균등 분담 시/)
})
test('pickup acknowledgement explains grace before confirming and shows remaining time after',()=>{
 prepareOrder();lifecycle.owner=false;lifecycle.state.phase='arrived';lifecycle.state.arrived_at=new Date().toISOString()
 lifecycle.mine={};let html=render(OrderReceipt)
 assert.match(html,/수령 여유 시간 10분/);assert.match(html,/수령 가능 안내 확인/)
 lifecycle.mine.pickup_notice_seen_at=new Date().toISOString();html=render(OrderReceipt)
 assert.match(html,/수령 여유 시간/);assert.match(html,/안내 확인/);assert.doesNotMatch(html,/>수령 가능 안내 확인</)
})

function prepareSuggestion(){
 reset();discovery.suggestionsReady=true;discovery.alerts=[]
 discovery.suggestions=[{id:'proposal',store:shared.rawPosts[0].restaurant,menu_key:'coffee',goal:8000,my_item:{id:1,name:'카페 아메리카노',price:3200},other_item:{id:2,name:'카페 라떼',price:4200},my_quantity:1,other_quantity:1,other_name:'주문친구',other_virtual:false,food_total:7400,shortfall:600,delivery_fee:3000,my_fee:1500,my_total:4700,ready_count:2,compromises:1,meeting:'충남대 정문',meeting_lat:36.3621,meeting_lng:127.3444,walk_m:100,starts_at:new Date(Date.now()+600000).toISOString(),expires_at:new Date(Date.now()+1200000).toISOString()}]
}
test('order proposals show actual menus, cost, shortfall and leader approval without assuming participation',()=>{
 prepareSuggestion();const html=render(OrderSuggestionsPanel)
 assert.match(html,/카페 아메리카노/);assert.match(html,/카페 라떼/);assert.match(html,/4,700원/)
 assert.match(html,/600원 부족/);assert.match(html,/둘 다 지금 주문 가능/);assert.match(html,/참가 신청은 리더가 수락/)
 assert.match(html,/이 조합으로 모집 준비/);assert.doesNotMatch(html,/자동 참가|참가 확정/)
})
test('expired proposals and active orders do not offer another suggested recruitment',()=>{
 prepareSuggestion();discovery.suggestions[0].expires_at=new Date(Date.now()-1000).toISOString()
 assert.doesNotMatch(render(OrderSuggestionsPanel),/이 조합으로 모집 준비/)
 shared.active=true;assert.equal(render(OrderSuggestionsPanel),'')
})
test('a proposal seeds a reviewable two-person draft and rejects stale menu prices',()=>{
 prepareSuggestion();const offer=discovery.suggestions[0]
 const draft=suggestionDraft(offer,discovery.catalog)
 assert.equal(draft.maxMembers,2);assert.equal(draft.fee,'3000');assert.equal(draft.meeting,'충남대 정문')
 assert.equal(Object.values(draft.quantities).reduce((a,b)=>a+b,0),1)
 assert.deepEqual(draft.publicPoint,{lat:36.3621,lng:127.3444})
 assert.ok(Date.parse(draft.deadline)>Date.now() && Date.parse(draft.deadline)<Date.parse(offer.starts_at))
 offer.my_item.price=1;assert.equal(suggestionDraft(offer,discovery.catalog),null)
})

test('preference editor exposes the three flexibility levels and a time-limited ready choice',()=>{
 prepareSuggestion();discovery.matchLocation={lat:36.3621,lng:127.3444}
 const html=render(OrderWishEditor)
 assert.match(html,/꼭 이 가게·메뉴/);assert.match(html,/다른 가게도 괜찮아요/);assert.match(html,/비슷한 메뉴도 괜찮아요/)
 assert.match(html,/15분 동안 유효/);assert.match(html,/지금 주문할 조합 찾기/)
 assert.match(html,/카페 아메리카노/)
})

test('store labels show only franchise names while preference values retain catalogue keys',()=>{
 reset();const html=render(LiveStorePicker)
 assert.match(html,/>이디야커피</);assert.doesNotMatch(html,/충대정문점/)
 const editor=render(OrderWishEditor)
 assert.match(editor,/<option[^>]*value="이디야커피 충대정문점"[^>]*>이디야커피<\/option>/)
 assert.equal(shared.rawPosts[0].restaurant,'이디야커피 충대정문점')
})


test('platform checkout shows each member including the leader and never asks for a real transfer',()=>{
  preparePayment();lifecycle.state.checkout_mode='platform'
  let html=render(OrderPayment)
  assert.match(html,/5,700원 결제하기/)
  assert.match(html,/0 \/ 2명 완료/)
  assert.match(html,/가게에 전달해요/)
  assert.doesNotMatch(html,/송금했어요|계좌번호|리더 입금 확인|입금 확인과 주문/)
  lifecycle.owner=true;lifecycle.post.owner_id='me'
  html=render(OrderPayment)
  assert.match(html,/5,700원 결제하기/)
  assert.doesNotMatch(html,/내 결제 준비 완료|배달앱 주문/)
})

test('a paid platform participant waits without another pay button',()=>{
  preparePayment();lifecycle.state.checkout_mode='platform'
  lifecycle.mine.platform_paid_at='2026-11-24T06:00:00Z';lifecycle.mine.confirmed_amount=5700
  const html=render(OrderPayment)
  assert.match(html,/1 \/ 2명 완료/)
  assert.match(html,/내 결제 완료 · 다른 배프의 결제를 기다려요/)
  assert.doesNotMatch(html,/>5,700원 결제하기</)
})

test('a withdrawn platform participant sees their refund without payment or manual bank controls',()=>{
  preparePayment();lifecycle.state.checkout_mode='platform'
  lifecycle.members=lifecycle.members.filter(m=>m.user_id!=='me')
  lifecycle.mine.refunded_amount=5700;lifecycle.mine.platform_refunded_at='2026-11-24T06:00:00Z'
  const html=render(OrderPayment)
  assert.match(html,/5,700원 환불 완료/)
  assert.doesNotMatch(html,/결제하기|송금했어요|환불을 보냈어요|계좌번호/)
})

test('notification center offers separate delete controls for both saved menu alerts and order notifications',()=>{
  reset()
  discovery.alerts=[{id:'note-1',kind:'group_invite',payload:{stores:['이디야커피 충대정문점'],area:'cnu-main'},created_at:'2026-11-24T06:00:00Z',read_at:null}]
  discovery.matches=[]
  shared.notifications=[{id:1,restaurant:'이디야커피 충대정문점',text:'음식이 도착했어요.',time:Date.now(),read:false,target:'receipt'}]
  const html=renderToStaticMarkup(React.createElement(MenuAlerts,{close(){},push(){}}))
  assert.match(html,/전체 삭제/)
  assert.match(html,/모두 읽음/)
  assert.equal((html.match(/aria-label="이 알림 삭제"/g)||[]).length,2)
  assert.match(html,/읽지 않은 알림 2개/)
  assert.match(html,/baef-alert-row/)
})
