import {useEffect,useState,type FormEvent} from 'react'
import {useDeliveryLifecycle} from './DeliveryLifecycle'
import {pickupDay,pickupTimestamp,pickupTimeFields} from './pickupTime'
import {timingSummary,etaExpired} from './orderTiming'
import {useNow} from './useNow'
export default function OrderTimingPanel(){
  const o=useDeliveryLifecycle(),s=o.state
  const now=useNow(15000)
  const [dirty,setDirty]=useState(false),[version,setVersion]=useState(s?.updated_at)
  const [draft,setDraft]=useState({day:pickupDay(new Date()),start:'',end:''})
  useEffect(()=>{setDirty(false);setDraft({day:pickupDay(new Date()),start:'',end:''});setVersion(s?.updated_at)},[o.selectedId,o.uid])
  useEffect(()=>{if(!dirty){const a=pickupTimeFields(s?.delivery_eta_start??null);const b=pickupTimeFields(s?.delivery_eta_end??null);setDraft({day:a.day,start:a.clock,end:b.clock});setVersion(s?.updated_at)}},[s?.delivery_eta_start,s?.delivery_eta_end,s?.updated_at,dirty])
  if(!s)return null
  const platform=s.checkout_mode==='platform'
  const editable=!platform&&o.owner&&['ordered','delivering'].includes(s.phase)
  const submit=async(e:FormEvent)=>{
    e.preventDefault();const start=pickupTimestamp(draft.day,draft.start)
    let end=pickupTimestamp(draft.day,draft.end)
    if(start&&end&&new Date(end)<new Date(start))end=new Date(new Date(end).getTime()+86400000).toISOString()
    if(!start||!end){o.setError('배달앱에서 확인한 예상 도착 범위를 입력해 주세요.');return}
    if(await o.act('delivery-eta',{start,end,expected:version})){setDirty(false)}
  }
  const days=pickupTimeFields(s.delivery_eta_start??null).days
  const conflict=dirty&&version!==s.updated_at
  return <section className="baef-timing-panel"><h2>{timingSummary(s,now)}</h2>{etaExpired(s,now)&&o.owner&&!platform&&<p className="baef-time-update" role="status">배달앱에서 진행 상황을 확인하고 예상 시간을 갱신해 주세요.</p>}{['ordered','delivering'].includes(s.phase)&&<p className="baef-muted">{platform?'도착 예상 시간은 확인되는 대로 안내해요. 음식이 도착하면 수령 알림으로 알려드려요.':'리더가 배달앱에서 확인한 예상 시간이며 배달 상황에 따라 달라질 수 있어요. 실제로 음식이 준비되면 수령 알림으로 알려드려요.'}</p>}{editable&&<details><summary>예상 도착 시간 안내하기</summary><form className="baef-order-form" onSubmit={submit} onChange={()=>{if(!dirty)setVersion(s.updated_at);setDirty(true)}}>{conflict&&<div role="status"><p>진행 정보가 변경됐어요. 최신 내용을 확인하고 다시 입력해 주세요.</p><button type="button" className="baef-button secondary" onClick={()=>setDirty(false)}>최신 내용 불러오기</button></div>}<label>도착 예상 날짜<select value={draft.day} onChange={e=>setDraft(v=>({...v,day:e.target.value}))}>{days.map(d=><option value={d.value} key={d.value}>{d.label}</option>)}</select></label><div className="baef-eta-range"><label>부터<input aria-label="예상 도착 시작" type="time" required value={draft.start} onChange={e=>setDraft(v=>({...v,start:e.target.value}))}/></label><label>까지<input aria-label="예상 도착 끝" type="time" required value={draft.end} onChange={e=>setDraft(v=>({...v,end:e.target.value}))}/></label></div><button className="baef-button secondary" disabled={o.busy||conflict}>예상 시간 알리기</button>{dirty&&<p role="status">아직 저장하지 않은 예상 시간이에요.</p>}{s.delivery_eta_start&&<button type="button" className="baef-text-action" disabled={o.busy} onClick={()=>void o.act('delivery-eta',{start:null,end:null,expected:s.updated_at}).then(ok=>{if(ok)setDirty(false)})}>예상 시간 미정으로 변경</button>}</form></details>}</section>
}
