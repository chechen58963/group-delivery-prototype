import type { OrderPerson, OrderState } from './DeliveryLifecycle'

export function platformCheckout(state: Pick<OrderState, 'phase' | 'checkout_mode'> | null | undefined, people: Pick<OrderPerson, 'claimed_amount' | 'confirmed_amount' | 'refund_due' | 'transfer_review_pending'>[] = []) {
  if (state?.checkout_mode === 'platform') return true
  return state?.phase === 'menu' && !people.some(p => p.claimed_amount > 0 || p.confirmed_amount > 0 || p.refund_due > 0 || p.transfer_review_pending)
}

export function platformPaid(person: Pick<OrderPerson, 'platform_paid_at' | 'food_total' | 'fee' | 'coupon_discount' | 'confirmed_amount' | 'refunded_amount'>) {
  return !!person.platform_paid_at && person.confirmed_amount - person.refunded_amount >= person.food_total + person.fee - person.coupon_discount
}

export function merchantStatus(state: Pick<OrderState, 'phase' | 'platform_accepted_at'>) {
  if (state.phase === 'ordered') return state.platform_accepted_at ? '가게에서 조리 중이에요' : '가게에 주문을 전달하고 있어요'
  if (state.phase === 'delivering') return '음식이 배달 중이에요'
  if (state.phase === 'arrived') return '음식이 도착했어요'
  if (state.phase === 'completed') return '모두 음식을 받았어요'
  return '모두 결제하면 가게에 주문을 전달해요'
}
