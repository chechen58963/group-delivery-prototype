import { useRef, useState } from 'react'
import { useDeliveryLifecycle, orderDue } from './DeliveryLifecycle'
import { useSharedDelivery } from './SharedDelivery'
import { money, useMenuDiscovery } from './MenuDiscoveryContext'
import { displayStoreName } from './storeNames'
import { platformPaid } from './platformCheckout'
import CancelOrderControl from './CancelOrderControl'
import { OrderGuide } from './OrderGuide'
import { Modal } from './ui/Modal'
import Icon from './ui/Icon'
import type { Screen } from './navigationTypes'
import './platform-checkout.css'

export default function PlatformPayment({ pop, push }: { pop: () => void; push: (screen: Screen) => void }) {
  const o = useDeliveryLifecycle(), s = useSharedDelivery(), d = useMenuDiscovery()
  const [checkout, setCheckout] = useState<{ amount: number; method: 'easy' | 'card' } | null>(null)
  const submitting = useRef(false)
  if (!o.state || !o.post) return null
  const state = o.state, mine = o.mine
  const people = o.orderPeople.filter(p => o.members.some(m => m.user_id === p.user_id))
  const paid = people.filter(platformPaid).length
  const ownPaid = !!mine && platformPaid(mine)
  const amount = mine ? orderDue(mine) : 0
  const active = o.members.some(m => m.user_id === o.uid && m.active)
  const payable = active && state.phase === 'payment' && !!mine && !ownPaid
  const cancelled = state.phase === 'cancelled' || !active
  const changed = !!checkout && checkout.amount !== amount
  const basket = d.baskets.find(b => b.post_id === o.selectedId && b.user_id === o.uid)
  const pay = async () => {
    if (!checkout || changed || !payable || submitting.current) return
    submitting.current = true
    try {
      if (await o.act('platform-pay', { amount: checkout.amount, method: checkout.method })) setCheckout(null)
    } finally { submitting.current = false }
  }
  return <div className="live-workflow-route">
    <div className="baef-scroll"><div className="baef-page">
      <button className="baef-back" onClick={pop}><Icon name="back" size={18} />뒤로</button>
      <h1 className="baef-page-title">{cancelled ? '취소·환불 내역' : '내 주문 결제'}</h1>
      <p className="baef-muted">{displayStoreName(o.post.restaurant)}</p>
      {o.error && <p role="alert" className="baef-error">{o.error}</p>}
      <CancelOrderControl onCancelled={() => push('orders')} />
      {!cancelled && <>
        <OrderGuide title={ownPaid ? '내 결제를 마쳤어요' : '내 메뉴 금액만 결제해 주세요'} description={ownPaid ? '다른 배프도 결제를 마치면 가게로 주문이 자동 전달돼요.' : '리더도 참가자도 각자 결제해요. 전원이 완료하면 배프가 주문을 모아 가게에 전달해요.'} />
        {mine && <section className="baef-payment-amount">
          <span>{ownPaid ? '결제한 금액' : '내 결제 금액'}</span><strong>{money(amount)}</strong>
          {ownPaid && <p className="platform-paid-label"><Icon name="check" size={16} />결제 완료</p>}
          <div className="baef-bill platform-bill"><p>내 메뉴 <b>{money(mine.food_total)}</b></p><p>내 배달비 <b>{money(mine.fee)}</b></p>{mine.coupon_discount > 0 && <p>배프 지원 쿠폰 <b>−{money(mine.coupon_discount)}</b></p>}</div>
          {basket && <details className="baef-amount-breakdown"><summary>내 주문 메뉴 확인</summary>{basket.items.map((item, i) => <p className="baef-muted" key={i}>{item.name} {item.quantity}개 · {money(item.price * item.quantity)}</p>)}</details>}
        </section>}
        {payable && o.couponEligible && !state.nearby_agreed && !mine?.coupon_discount && <button className="baef-text-action" disabled={o.busy} onClick={() => void o.act('platform-coupon')}>배프 지원 쿠폰 적용 · 최대 1,000원</button>}
        <section className="platform-payment-roster" aria-label="함께 결제하는 배프">
          <div className="baef-section-title"><h2>함께 결제해요</h2><span aria-live="polite">{paid} / {o.members.length}명 완료</span></div>
          <progress aria-label="전체 결제 진행" value={paid} max={Math.max(1, o.members.length)} />
          {people.map(p => <div className="platform-person" key={p.user_id}>
            <span><b>{s.nickname(p.user_id)}{p.user_id === o.uid ? ' (나)' : ''}</b><small>{p.user_id === o.post!.owner_id ? '리더' : '참가자'}</small></span>
            <span><b>{money(orderDue(p))}</b><small className={platformPaid(p) ? 'platform-paid-label' : ''}>{platformPaid(p) ? '결제 완료' : '결제 대기'}</small></span>
          </div>)}
        </section>
        <div className="platform-order-note"><Icon name="bag" size={22} /><p>모든 결제가 모이면<br /><b>{displayStoreName(o.post.restaurant)}에 한 번에 주문해요.</b></p></div>
        <p className="baef-muted">가게로 주문이 전달되기 전까지 취소할 수 있어요. 참가 인원이 바뀌면 결제 금액을 돌려드리고 새 금액으로 다시 확인해요.</p>
      </>}
      {o.orderPeople.filter(p => p.platform_refunded_at && p.refunded_amount > 0 && (o.owner || p.user_id === o.uid)).map(p => <section className="platform-refund" key={p.user_id}>
        <Icon name="check" size={18} /><div><b>{s.nickname(p.user_id)} · {money(p.refunded_amount)} 환불 완료</b><p>결제한 수단으로 환불했어요.</p></div>
      </section>)}
      {cancelled && <button className="baef-button secondary" onClick={() => push('orders')}>내 주문으로</button>}
    </div></div>
    {!cancelled && <footer className="live-workflow-footer">
      {payable ? <button className="baef-button" disabled={o.busy} onClick={() => { o.setError(''); setCheckout({ amount, method: 'easy' }) }}>{money(amount)} 결제하기</button>
        : ownPaid ? <div className="platform-waiting" role="status"><Icon name="check" size={20} /><span>내 결제 완료 · 다른 배프의 결제를 기다려요</span></div>
          : <p role="status" className="baef-muted">내 결제 정보를 불러오고 있어요.</p>}
    </footer>}
    {checkout && payable && <Modal title="결제 확인" close={() => { if (!o.busy) setCheckout(null) }} footer={<button className="baef-button" disabled={o.busy || changed} aria-busy={o.busy} onClick={() => void pay()}>{o.busy ? '결제 처리 중…' : `${money(checkout.amount)} 결제 완료하기`}</button>}>
      <p className="platform-checkout-store">{displayStoreName(o.post.restaurant)}</p><strong className="platform-checkout-total">{money(checkout.amount)}</strong>
      {basket && <p className="baef-muted">{basket.items.map(item => `${item.name} ${item.quantity}개`).join(' · ')}</p>}
      <p className="baef-muted">수령 장소 · {state.meeting}</p>
      <fieldset className="platform-methods"><legend>결제 수단</legend>{([{ id: 'easy', name: '간편결제', detail: '빠르고 간편하게 결제' }, { id: 'card', name: '카드 결제', detail: '카드로 내 금액 결제' }] as const).map(m => <label key={m.id} data-selected={checkout.method === m.id}>
        <input type="radio" name="payment-method" value={m.id} checked={checkout.method === m.id} disabled={o.busy} onChange={() => setCheckout({ ...checkout, method: m.id })} /><span><b>{m.name}</b><small>{m.detail}</small></span>
      </label>)}</fieldset>
      <p className="baef-muted">모두 결제하면 주문이 자동 전달돼요. 전달 후에는 일반 취소가 어려워요.</p>
      {changed && <p role="alert" className="baef-error">결제 금액이 바뀌었어요. 창을 닫고 새 금액을 확인해 주세요.</p>}
      {o.error && <p role="alert" className="baef-error">{o.error}</p>}
    </Modal>}
  </div>
}
