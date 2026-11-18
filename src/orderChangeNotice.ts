import type { OrderState } from './DeliveryLifecycle'
export function orderChangeNotice(before:OrderState|undefined,after:OrderState,uid:string){
  if(after.pickup_mode==='contactless'&&after.pickup_proposer!==uid&&!after.pickup_agreed_by?.includes(uid)&&(!before||before.pickup_mode!=='contactless'||before.pickup_note!==after.pickup_note||before.pickup_proposer!==after.pickup_proposer))return '비대면 수령 제안이 왔어요. 음식을 놓을 장소와 안내를 확인하고 동의해 주세요.'
  if(before&&!before.pickup_dropped_at&&after.pickup_dropped_at)return '리더가 지정 장소에 음식을 놓았어요. 사진을 확인하고 내 음식을 찾아가 주세요.'
  if(after.nearby_requester&&after.nearby_requester!==uid&&!after.nearby_agreed&&(!before||before.nearby_requester!==after.nearby_requester||before.nearby_address!==after.nearby_address))return '내 근처에서 받기 제안이 왔어요. 장소를 확인하고 동의해 주세요.'
  if(!before)return null
  if(before.pickup_mode==='contactless'&&after.pickup_mode==='meet')return '직접 만나서 받기로 수령 방식이 변경됐어요.'
  if(after.pickup_mode==='contactless'&&JSON.stringify([...(before.pickup_agreed_by??[])].sort())!==JSON.stringify([...(after.pickup_agreed_by??[])].sort()))return after.pickup_agreed_by?.length?'비대면 수령 동의 상태가 바뀌었어요. 참가자의 확인 상태를 봐 주세요.':'수령 조건이 바뀌었어요. 비대면 수령 안내에 다시 동의해 주세요.'
  if(!before.nearby_agreed&&after.nearby_agreed)return '근처 수령 제안에 동의했어요. 수령 장소와 배달비 분담을 확인해 주세요.'
  if(before.nearby_requester&&!after.nearby_requester)return '근처 수령 제안이 취소됐어요.'
  if(before.meeting!==after.meeting||before.meeting_lat!==after.meeting_lat||before.meeting_lng!==after.meeting_lng)return '수령 장소 후보가 변경됐어요. 지도에서 확인해 주세요.'
  if(before.planned_order_at!==after.planned_order_at)return '주문 예정 시간이 변경됐어요. 모임을 확인해 주세요.'
  if(before.delivery_eta_start!==after.delivery_eta_start||before.delivery_eta_end!==after.delivery_eta_end)return '리더가 도착 예상 시간을 변경했어요. 배달 진행을 확인해 주세요.'
  return null
}
