import {useSharedDelivery} from './SharedDelivery'
import {useDeliveryLifecycle} from './DeliveryLifecycle'
export default function CancelOrderControl({postId,onCancelled}:{postId?:string;onCancelled?:()=>void}){
  const s=useSharedDelivery(),o=useDeliveryLifecycle()
  const post=s.rawPosts.find(p=>p.id===(postId??o.selectedId)),uid=s.session?.user.id
  const member=s.members.find(m=>m.post_id===post?.id&&m.user_id===uid)
  const state=o.states.find(v=>v.post_id===post?.id)
  if(!post||!member?.active||['cancelled','completed'].includes(post.status)||state&&!['menu','payment'].includes(state.phase))return null
  const owner=post.owner_id===uid
  return <button className="baef-cancel-order" disabled={s.busy} onClick={()=>{
    if(!confirm(state?.checkout_mode==='platform'?(owner?'모집을 취소할까요? 결제한 금액은 결제 수단으로 환불돼요.':'참가를 취소할까요? 결제 금액은 환불되고, 남은 배프는 새 금액을 확인해요.'):owner?'모집을 취소할까요? 참가자에게도 취소 상태가 표시돼요. 확인된 입금이 있으면 환불을 마쳐 주세요.':'신청·참가를 취소할까요? 확인된 입금이 있으면 환불 현황에서 확인해 주세요.'))return
    void s.act(owner?'cancel':'withdraw',post.id).then(ok=>{if(ok)onCancelled?.()})
  }}>{s.busy?'처리 중…':owner?'모집 취소':member.status==='pending'?'신청 취소':'참가 취소'}</button>
}
