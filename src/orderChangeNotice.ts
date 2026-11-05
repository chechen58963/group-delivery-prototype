import type { OrderState } from './DeliveryLifecycle'
export function orderChangeNotice(before:OrderState|undefined,after:OrderState,uid:string){
  if(after.nearby_requester&&after.nearby_requester!==uid&&!after.nearby_agreed&&(!before||before.nearby_requester!==after.nearby_requester||before.nearby_address!==after.nearby_address))return '내 근처에서 받기 제안이 왔어요. 장소를 확인하고 동의해 주세요.'
  if(!before)return null
  if(!before.nearby_agreed&&after.nearby_agreed)return '근처 수령 제안에 동의했어요. 수령 장소와 배달비 분담을 확인해 주세요.'
  if(before.nearby_requester&&!after.nearby_requester)return '근처 수령 제안이 취소됐어요.'
  if(before.meeting!==after.meeting||before.meeting_lat!==after.meeting_lat||before.meeting_lng!==after.meeting_lng)return '수령 장소 후보가 변경됐어요. 지도에서 확인해 주세요.'
  if(before.meeting_time!==after.meeting_time)return '수령 시간이 변경됐어요. 새 약속 시간을 확인해 주세요.'
  return null
}
