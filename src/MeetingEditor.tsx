import { useEffect, useState, type FormEvent } from 'react'
import { useDeliveryLifecycle, type OrderState } from './DeliveryLifecycle'
import { SaveFeedback } from './uiFeedback'

const fields=(state:OrderState)=>JSON.stringify([state.meeting,state.meeting_lat,state.meeting_lng])
export default function MeetingEditor({state,suggestedDate}:{state:OrderState;suggestedDate:string|null}){
 const o=useDeliveryLifecycle()
 const [base,setBase]=useState(state),[dirty,setDirty]=useState(false),[saved,setSaved]=useState(false)
 const conflict=dirty&&fields(base)!==fields(state)
 useEffect(()=>{if(!dirty||fields(base)===fields(state))setBase(state)},[state.updated_at,state.meeting,state.meeting_time,state.meeting_lat,state.meeting_lng,dirty])
 const submit=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();if(conflict||o.busy)return
  const data=new FormData(e.currentTarget),meeting=String(data.get('meeting')??'').trim()
  const samePlace=meeting===base.meeting
  if(await o.act('meeting',{meeting,time:null,lat:samePlace?base.meeting_lat:null,lng:samePlace?base.meeting_lng:null,expected_updated_at:base.updated_at})){setDirty(false);setSaved(true)}
 }
 return <form key={`${base.post_id}:${fields(base)}:${base.meeting_time?'':suggestedDate}`} className="baef-order-form" onChange={()=>{setDirty(true);setSaved(false)}} onSubmit={submit}>
  {conflict&&<div className="baef-sync-conflict" role="status"><p>상대가 수령 장소를 변경했어요. 최신 내용을 확인한 뒤 다시 수정해 주세요.</p><button type="button" className="baef-button secondary" onClick={()=>{setBase(state);setDirty(false);setSaved(false);o.setError('')}}>최신 내용 불러오기</button></div>}
  <label>합의한 공개 수령 장소<input name="meeting" defaultValue={base.meeting} maxLength={200} required/></label>
  <p className="baef-muted">수령 시각은 미리 확정하지 않아요. 주문 후 도착 예상 시간을 안내하고, 음식이 준비되면 수령 알림을 보내요.</p>
  <button className="baef-button secondary" disabled={o.busy||conflict}>{o.busy?'저장 중…':'수령 장소 저장'}</button>
  <SaveFeedback status={dirty?'dirty':saved?'saved':'idle'}/>
 </form>
}
