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
  './supabase': { supabase: {} },
  './SharedDelivery': { useSharedDelivery: () => shared },
  './MenuDiscoveryContext': { useMenuDiscovery: () => discovery, FOOD_CHOICES: [{ id: 'coffee', name: '커피' }, { id: 'burger', name: '햄버거' }, { id: 'sandwich', name: '샌드위치' }], money: n => n.toLocaleString('ko-KR') + '원', formatWindow: () => '오늘 18:00' },
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
const { OrderMenu, OrderPayment } = load('OrderScreens.tsx')
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
  assert.match(html, /이디야커피 충대정문점 모집 상세/)
  assert.match(html, /1,500원/)
  assert.match(html, /1 \/ 2명/)
  assert.doesNotMatch(html, /아아 한 잔, 같이 시킬 분|민지|1,280 P/)
})
test('nearby discovery filters actual coordinates, while all-range discovery keeps distant posts', () => {
  reset()
  shared.rawPosts[0].pickup_lat += .02
  discovery.browseRange = 'near'
  assert.doesNotMatch(render(LiveExplore), /이디야커피 충대정문점 모집 상세/)
  discovery.browseRange = 'all'
  assert.match(render(LiveExplore), /이디야커피 충대정문점 모집 상세/)
})
test('search includes catalogue menu names and category filters apply to real rooms', () => {
  reset()
  discovery.search = '아메리카노'
  assert.match(render(LiveExplore), /모집 상세/)
  discovery.browseCategory = 'burger'
  assert.doesNotMatch(render(LiveExplore), /모집 상세/)
})
test('full rooms are not advertised as available to join', () => {
  reset()
  shared.rawPosts[0].member_count = 2
  assert.doesNotMatch(render(LiveExplore), /모집 상세/)
})
test('logged-out discovery offers login and browsing actual store menus', () => {
  reset()
  shared.session = null
  assert.match(render(LiveExplore), /로그인하고 모집 보기/)
  assert.doesNotMatch(render(LiveExplore), /모집 상세/)
  assert.match(render(LiveStorePicker), /이디야커피 충대정문점/)
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
  assert.match(html, /주문 확정하고 송금으로/)
  assert.match(html, /live-workflow-footer/)
  assert.match(html, /4,200원/)
  assert.match(html, /정문 벤치/)
  assert.doesNotMatch(html, /name="account"|name="bank"|name="holder"/)
})
test('order finalization stays disabled until menu, goal, meeting and account checks pass', () => {
  prepareOrder()
  lifecycle.state.account = ''
  let html = render(OrderMenu)
  assert.match(html, /송금받을 리더 계좌를 저장해 주세요/)
  assert.match(html, /disabled=""[^>]*>주문 확정하고 송금으로/)
  lifecycle.state.account = '1234567890'
  lifecycle.post.min_order = 20000
  html = render(OrderMenu)
  assert.match(html, /11,600원/)
  assert.match(html, /disabled=""[^>]*>주문 확정하고 송금으로/)
})
test('participant preparation cannot confirm the leader order and exposes pending pickup proposals', () => {
  prepareOrder()
  lifecycle.owner = false
  lifecycle.state.nearby_requester = 'other'
  lifecycle.state.nearby_agreed = false
  const html = render(OrderMenu)
  assert.doesNotMatch(html, /주문 확정하고 송금으로/)
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
