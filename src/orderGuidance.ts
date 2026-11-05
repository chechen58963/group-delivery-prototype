import type { OrderPhase } from './DeliveryLifecycle'
import type { Screen } from './WorkflowScreens'

export function orderNextStep({role,application,phase,count}:{role:'leader'|'participant';application:string;phase?:OrderPhase;count:number}):{title:string;description:string;action:string;route:Screen}{
  if(application==='pending')return {title:'리더의 수락을 기다리고 있어요',description:'수락되면 메뉴를 확인하고 채팅방에서 수령 장소를 정할 수 있어요.',action:'참가 신청 확인',route:'detail'}
  if(phase==='cancelled')return {title:'취소·환불 내역을 확인해 주세요',description:'송금한 금액이 있다면 환불 진행 상황을 확인해 주세요.',action:'환불 현황 보기',route:'payment'}
  if(phase==='completed')return {title:'함께한 배프에게 후기를 남겨 주세요',description:'모든 참가자가 음식 수령을 확인했어요.',action:'거래 마무리하기',route:'complete'}
  if(phase==='arrived')return {title:'음식을 받았다면 수령을 확인해 주세요',description:'약속한 장소에서 닉네임과 메뉴를 확인한 뒤 음식을 받아요.',action:'내 음식 수령 확인',route:'receipt'}
  if(phase==='ordered'||phase==='delivering')return {title:phase==='ordered'?'주문을 마쳤어요':'음식이 배달 중이에요',description:role==='leader'?'배달 진행 상황을 확인하고 도착을 알려 주세요.':'채팅에서 만날 장소와 시간을 확인해 주세요.',action:'배달·수령 장소 확인',route:'delivery'}
  if(phase==='payment')return role==='leader'?{title:'입금을 확인하고 배달앱에서 주문해 주세요',description:'모든 참가자의 입금 확인 후 리더가 최종 주문을 진행해요.',action:'입금 현황 확인',route:'payment'}:{title:'내 주문 금액을 리더에게 송금해 주세요',description:'계좌와 금액을 확인해 송금하면 리더가 입금을 확인하고 주문해요.',action:'내 송금액·계좌 확인',route:'payment'}
  if(role==='leader'&&count<2)return {title:'함께 주문할 사람을 기다리고 있어요',description:'참가 신청을 수락하면 메뉴와 수령 장소를 정하고 주문을 준비해요.',action:'모집·신청자 확인',route:'applicants'}
  return {title:'메뉴와 수령 장소를 확인해 주세요',description:role==='leader'?'각자의 메뉴, 수령 장소·시간, 송금받을 계좌를 정한 뒤 주문을 확정해요.':'내 메뉴를 저장하고 채팅에서 장소와 시간을 정해요. 리더가 확정하면 송금할 수 있어요.',action:role==='leader'?'메뉴 확인하고 주문 준비':'내 메뉴·수령 장소 확인',route:'menu'}
}
