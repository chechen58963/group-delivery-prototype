import { orderJourney } from './userFlow'
export default function OrderJourney(){
  return <details className="ux-journey"><summary>배프에서는 이렇게 주문해요</summary><ol>{orderJourney.map((step,i)=><li key={step}><span>{i+1}</span>{step}</li>)}</ol><p>참가자는 내 메뉴 금액을 리더에게 보내고, 리더가 배달앱에서 함께 주문해요.</p></details>
}
