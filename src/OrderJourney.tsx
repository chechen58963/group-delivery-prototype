import { orderJourney } from './userFlow'
export default function OrderJourney(){
  return <details className="ux-journey"><summary>배프에서는 이렇게 주문해요</summary><ol>{orderJourney.map((step,i)=><li key={step}><span>{i+1}</span>{step}</li>)}</ol><p>각자 내 금액을 결제하면 배프가 주문을 모아 가게에 전달해요.</p></details>
}
