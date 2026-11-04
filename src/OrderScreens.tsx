import { lazy, Suspense, useState, type FormEvent, type ReactNode } from 'react'
import { useSharedDelivery } from './SharedDelivery'
import { money } from './MenuDiscoveryContext'
import { useFlow } from './FlowContext'
import { BasketEditor, SmallIcon } from './MenuDiscovery'
import { distanceM, midpoint, orderDue, phaseLabel, remainingTransfer, useDeliveryLifecycle } from './DeliveryLifecycle'
import type { Screen } from './WorkflowScreens'
import type { MapPin } from './LocationMap'
import './order-flow.css'
const LocationMap=lazy(()=>import('./LocationMap'))
const localDate=(value:string|null)=>value?new Date(new Date(value).getTime()-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):''
type Navigate=(screen:Screen)=>void
function ActionButton({children,onClick,secondary=false,disabled=false}:{children:ReactNode;onClick:()=>void;secondary?:boolean;disabled?:boolean}){
  const o=useDeliveryLifecycle()
  return <button className={`baef-button ${secondary?'secondary':''}`} disabled={disabled||o.busy} onClick={onClick}>{children}</button>
}
function Page({title,pop,children}:{title:string;pop:()=>void;children:ReactNode}){
  const o=useDeliveryLifecycle()
  return <div className="baef-scroll"><div className="baef-page"><button className="baef-back" onClick={pop}><SmallIcon name="back"/>뒤로</button><h1 className="baef-page-title">{title}</h1>{o.post&&<p className="baef-muted">{o.post.restaurant}</p>}{o.error&&<p role="alert" className="baef-error">{o.error}</p>}{children}</div></div>
}
export function OrderProgress({push}:{push:Navigate}){
  const o=useDeliveryLifecycle();if(!o.state)return null
  const steps=[{id:'menu',label:'메뉴',route:'menu'},{id:'payment',label:'송금',route:'payment'},{id:'ordered',label:'배달',route:'delivery'},{id:'arrived',label:'수령',route:'receipt'},{id:'completed',label:'평가',route:'complete'}] as const
  const index=o.state.phase==='delivering'?2:steps.findIndex(s=>s.id===o.state!.phase)
  return <nav className="baef-order-progress" aria-label="공동배달 진행 단계">{steps.map((s,i)=><button key={s.id} aria-current={index===i?'step':undefined} disabled={i>index+1||o.state!.phase==='menu'&&i>0} onClick={()=>push(s.route)}><i className={i<=index?'done':''}/>{s.label}</button>)}</nav>
}
export function OrderChatControls({push}:{push:Navigate}){
  const o=useDeliveryLifecycle()
  const target:Screen=o.state?.phase==='completed'?'complete':o.state?.phase==='arrived'?'receipt':o.state?.phase==='ordered'||o.state?.phase==='delivering'?'delivery':o.state?.phase==='payment'?'payment':'menu'
  return <button className="chat-tool w-full rounded-xl py-2 text-xs mt-2" onClick={()=>push(target)}>{o.state?phaseLabel[o.state.phase]:'메뉴·송금·수령'} · 주문 진행 보기 →</button>
}
export function PersonProfile({userId,close}:{userId:string;close:()=>void}){
  const s=useSharedDelivery(),o=useDeliveryLifecycle(),rep=o.reputation(userId)
  const [report,setReport]=useState(false),[sent,setSent]=useState(false)
  const reviews=o.reviews.filter(r=>r.subject_id===userId)
  const canReport=userId!==o.uid&&o.members.some(m=>m.user_id===userId)&&o.members.some(m=>m.user_id===o.uid)
  return <div className="baef-overlay" role="dialog" aria-modal="true" aria-labelledby="person-heading"><section className="baef-sheet"><div className="baef-sheet-title"><h2 id="person-heading">{s.nickname(userId)}</h2><button aria-label="프로필 닫기" className="baef-icon-button" onClick={close}><SmallIcon name="close"/></button></div><p className="baef-reputation">{rep?.rating!=null?`★ ${rep.rating}`:'아직 별점 없음'} · 공동배달 {rep?.trades??0}회 · 후기 {rep?.review_count??0}개</p>{reviews.map(r=><div className="baef-review" key={r.id}><b>★ {r.stars}</b><p>{r.comment||'별점만 남겼어요.'}</p><small>{new Date(r.created_at).toLocaleDateString('ko-KR')}</small></div>)}{!reviews.length&&<p className="baef-muted">완료한 거래의 후기가 여기에 쌓여요.</p>}
    {canReport&&<button className="baef-text-cancel" onClick={()=>setReport(!report)}>이 참여자 신고</button>}{report&&!sent&&<form className="baef-order-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(await o.act('report',{user_id:userId,reason:f.get('reason'),detail:f.get('detail')}))setSent(true)}}><label>사유<select name="reason"><option>약속 불이행</option><option>입금·환불 문제</option><option>부적절한 대화</option><option>기타</option></select></label><label>상황 설명<textarea name="detail" maxLength={1000} required/></label><p className="baef-muted">신고는 검토 후 처리돼요. 신고만으로 상대가 정지되지는 않아요.</p><button className="baef-button" disabled={o.busy}>신고 접수</button></form>}{sent&&<p role="status" className="baef-muted">신고를 접수했어요. 내 정보에서 처리 상태를 확인할 수 있어요.</p>}{o.error&&<p className="baef-error" role="alert">{o.error}</p>}
  </section></div>
}
export function OrderParticipants(){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),[person,setPerson]=useState<string|null>(null)
  return <section className="baef-profile-section"><h2>함께하는 배프</h2>{o.members.map(m=>{const r=o.reputation(m.user_id);return <button key={m.id} className="baef-person-row" onClick={()=>setPerson(m.user_id)}><span className="baef-avatar">{s.nickname(m.user_id).slice(0,1)}</span><span><b>{s.nickname(m.user_id)}{m.user_id===o.post?.owner_id?' · 리더':''}</b><small>{r?.rating!=null?`★ ${r.rating}`:'첫 거래를 기다려요'} · {r?.trades??0}회</small></span><span>›</span></button>})}{person&&<PersonProfile userId={person} close={()=>setPerson(null)}/>}</section>
}
export function MeetingTools(){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),{currentLocation}=useFlow()
  const [address,setAddress]=useState(''),[saved,setSaved]=useState(false)
  const positions=o.orderPeople.filter(p=>p.latitude!=null&&p.longitude!=null&&o.members.some(m=>m.user_id===p.user_id))
  const points=positions.map(p=>({lat:p.latitude!,lng:p.longitude!}))
  const candidate=points.length===o.members.length&&points.length>=2?midpoint(points):null
  const feasible=candidate&&points.every(p=>distanceM(p,candidate)<=400)
  const editable=o.state?.phase==='menu'||o.state?.phase==='payment'
  const pins:MapPin[]=positions.map(p=>({id:p.user_id,point:{x:0,y:0},coordinates:{lat:p.latitude!,lng:p.longitude!},label:s.nickname(p.user_id),symbol:p.user_id===o.uid?'나':s.nickname(p.user_id).slice(0,1),kind:p.user_id===o.uid?'me':'person'}))
  if(o.state?.meeting_lat!=null&&o.state.meeting_lng!=null)pins.push({id:'meeting',point:{x:0,y:0},coordinates:{lat:o.state.meeting_lat,lng:o.state.meeting_lng},label:o.state.meeting,symbol:'만남',kind:'meeting'})
  if(candidate&&feasible)pins.push({id:'candidate',point:{x:0,y:0},coordinates:candidate,label:'중간 수령점 후보',symbol:'후보',kind:'meeting'})
  const form=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const time=String(f.get('time'));if(await o.act('meeting',{meeting:f.get('meeting'),time:time?new Date(time).toISOString():null}))setSaved(true)}
  return <section className="baef-profile-section"><h2>수령 장소와 시간</h2><p className="baef-muted">{o.state?.meeting||o.post?.meeting||'함께 정해 주세요.'}{o.state?.meeting_time&&<> · {new Date(o.state.meeting_time).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</>}</p>
    {editable&&<form key={`${o.selectedId}:${o.state?.meeting}`} className="baef-order-form" onSubmit={form}><label>합의한 공개 수령 장소<input name="meeting" defaultValue={o.state?.meeting||o.post?.meeting} maxLength={200} required/></label><label>수령 약속 시간<input name="time" type="datetime-local" defaultValue={localDate(o.state?.meeting_time??null)} required/></label><button className="baef-button secondary" disabled={o.busy}>장소·시간 저장</button>{saved&&<p role="status" className="baef-muted">저장했어요. 변경한 내용은 채팅에서도 알려 주세요.</p>}</form>}
    <details className="baef-order-details"><summary>참여자 위치·중간 지점 지도</summary><p className="baef-muted">내 위치 공유는 선택이에요. 공유한 위치는 이 모임의 참여자에게 표시돼요.</p>{o.mine?.latitude!=null?<ActionButton secondary onClick={()=>void o.act('share-location',{})}>내 위치 공유 끄기</ActionButton>:<><button className="baef-button secondary" disabled={currentLocation.loading} onClick={currentLocation.request}>현재 위치 확인</button><ActionButton secondary disabled={!currentLocation.coordinates} onClick={()=>{const p=currentLocation.coordinates;if(p)void o.act('share-location',{lat:p.lat,lng:p.lng})}}>이 모임에 내 위치 공유</ActionButton></>}{currentLocation.error&&<p className="baef-error">{currentLocation.error}</p>}
      {!!pins.length&&<div className="baef-order-map"><Suspense fallback={<p>지도 불러오는 중…</p>}><LocationMap pins={pins} onSelect={()=>{}} title="함께 수령할 참여자와 장소" center={pins[0].coordinates}/></Suspense></div>}
      {candidate&&feasible?<><p className="baef-muted">중간 지점까지 각자 약 {Math.ceil(Math.max(...points.map(p=>distanceM(p,candidate))))}m 이내예요. 직선거리 기준이므로 길과 출입 가능 여부를 함께 확인해 주세요.</p>{editable&&!o.state?.nearby_agreed&&<ActionButton secondary onClick={()=>void o.act('meeting',{meeting:'중간 지점 · 채팅에서 상세 위치 확인',time:o.state?.meeting_time,lat:candidate.lat,lng:candidate.lng})}>중간 지점을 수령 후보로 저장</ActionButton>}</>:<p className="baef-muted">{points.length<o.members.length?'참여자 전원이 위치를 공유하면 중간 지점을 비교할 수 있어요.':'현재 위치들의 중간점은 모두의 400m 범위 안에 들어오지 않아요. 장소를 다시 조율해 주세요.'}</p>}
    </details>
    {o.members.length===2&&o.state?.phase==='menu'&&<details className="baef-order-details"><summary>내 근처에서 받기</summary><p className="baef-muted">배달 주소를 요청자 근처로 정해요. 요청자는 배달비 전액, 이동하는 상대는 배달비 0원이에요. 상대가 동의해야 적용돼요.</p>{o.state.nearby_requester?<><p>{s.nickname(o.state.nearby_requester)}님의 제안 · {o.state.nearby_address}</p><b>{o.state.nearby_agreed?'상대 동의 완료':'상대 동의 대기'}</b>{o.state.nearby_requester!==o.uid&&!o.state.nearby_agreed&&<ActionButton onClick={()=>void o.act('nearby-agree')}>이 장소로 이동하고 배달비 0원에 동의</ActionButton>}<ActionButton secondary onClick={()=>void o.act('nearby-reset')}>제안 취소·다시 조율</ActionButton></>:<><label className="baef-order-field">내 근처 공개 수령 장소<input value={address} maxLength={200} onChange={e=>setAddress(e.target.value)} placeholder="건물 앞 등 만날 수 있는 장소"/></label><ActionButton disabled={!address.trim()} onClick={()=>void o.act('nearby-propose',{address:address.trim()})}>내 근처 수령 제안</ActionButton></>}</details>}
  </section>
}
export function OrderMenu({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  if(!o.post)return <Page title="주문 진행" pop={pop}><p>참여 중인 모임을 선택해 주세요.</p></Page>
  const account=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);if(await o.act('account',{bank:f.get('bank'),account:f.get('account'),holder:f.get('holder'),reward_support:f.has('reward_support')}))s.setNotice('리더 계좌를 저장했어요.')}
  return <Page title="메뉴와 주문 확정" pop={pop}><BasketEditor postId={o.post.id}/><OrderParticipants/><MeetingTools/>{o.owner&&o.state?.phase==='menu'&&<section className="baef-profile-section"><h2>리더 계좌</h2><form className="baef-order-form" key={o.post.id} onSubmit={account}><label>은행<input name="bank" defaultValue={o.state.bank} maxLength={30} required/></label><label>계좌번호<input name="account" defaultValue={o.state.account} maxLength={40} required/></label><label>예금주<input name="holder" defaultValue={o.state.holder} maxLength={30} required/></label><label className="baef-checkbox"><input name="reward_support" type="checkbox" defaultChecked={o.state.reward_support}/>우수 참여자 쿠폰의 할인액을 내가 추가 부담하는 데 동의</label><p className="baef-muted">쿠폰은 해당 참가자의 배달비에서 최대 1,000원을 줄이고, 같은 금액을 리더 부담에 더해요.</p><button className="baef-button secondary" disabled={o.busy}>계좌·혜택 설정 저장</button></form></section>}
    {o.state?.phase==='menu'?(o.owner?<>{o.post.status==='open'&&<ActionButton secondary onClick={()=>void s.act('close',o.post!.id)}>현재 인원으로 모집 마감</ActionButton>}<ActionButton disabled={o.post.status!=='closed'} onClick={()=>void o.act('finalize').then(ok=>{if(ok)push('payment')})}>주문 내용 확정하고 송금으로</ActionButton><p className="baef-muted">모두 메뉴를 저장하고 목표금액을 채운 뒤 확정할 수 있어요.</p></>:<p className="baef-muted">각자 메뉴를 저장하면 리더가 최종 주문을 확정해요.</p>):<ActionButton onClick={()=>push(o.state?.phase==='completed'?'complete':'payment')}>다음 진행 확인</ActionButton>}
  </Page>
}
export function OrderPayment({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),[copy,setCopy]=useState('')
  if(!o.state||!o.post)return <Page title="송금 현황" pop={pop}><p>모임을 선택해 주세요.</p></Page>
  if(o.state.phase==='menu')return <Page title="송금 현황" pop={pop}><p>메뉴·계좌·수령 장소를 정하고 주문 내용을 확정하면 송금할 수 있어요.</p><ActionButton onClick={()=>push('menu')}>메뉴와 주문 확정으로</ActionButton></Page>
  const members=o.orderPeople.filter(p=>o.members.some(m=>m.user_id===p.user_id))
  const paid=members.filter(p=>p.user_id!==o.post!.owner_id&&remainingTransfer(p)===0).length
  return <Page title={o.state.phase==='cancelled'?'취소·환불 현황':'리더에게 송금'} pop={pop}>
    {o.state.phase!=='cancelled'&&<><section className="baef-profile-section"><h2>{o.state.bank} · {o.state.holder}</h2><p className="baef-account-number">{o.state.account}</p><button className="baef-text-action" onClick={()=>void navigator.clipboard.writeText(o.state!.account).then(()=>setCopy('계좌번호를 복사했어요.')).catch(()=>setCopy('복사하지 못했어요. 계좌번호를 직접 확인해 주세요.'))}>계좌번호 복사</button>{copy&&<p role="status" className="baef-muted">{copy}</p>}<p className="baef-muted">송금 후 아래에 표시하면 리더가 입금을 확인해요.</p></section>
      {o.mine&&<section className="baef-bill"><p>내 음식값 <b>{money(o.mine.food_total)}</b></p><p>내 배달비 <b>{money(o.mine.fee)}</b></p>{o.mine.coupon_discount>0&&<p>쿠폰 <b>−{money(o.mine.coupon_discount)}</b></p>}<p className="total">{o.owner?'내 부담액':'총 송금액'}<b>{money(orderDue(o.mine))}</b></p>{!o.owner&&<p>추가 송금 필요 <b>{money(remainingTransfer(o.mine))}</b></p>}</section>}
      {o.state.nearby_agreed&&<p className="baef-muted">내 근처 수령 · 요청자 {s.nickname(o.state.nearby_requester!)}님이 배달비 전액 부담</p>}
      {o.state.phase==='payment'&&o.couponEligible&&o.state.reward_support&&!o.owner&&!o.state.nearby_agreed&&!o.mine?.coupon_discount&&<ActionButton secondary onClick={()=>void o.act('coupon')}>우수 배프 쿠폰 적용 · 최대 1,000원</ActionButton>}
      <section className="baef-profile-section"><h2>입금 확인 {paid}/{Math.max(0,o.members.length-1)}</h2>{members.map(p=><div className="baef-ledger-person" key={p.user_id}><b>{s.nickname(p.user_id)}</b><span>{money(orderDue(p))}</span><small>{p.user_id===o.post!.owner_id?o.state!.leader_ready?'결제 준비 완료':'결제 준비 전':remainingTransfer(p)===0?'입금 확인 완료':p.claimed_amount>p.confirmed_amount?'리더 확인 대기':'송금 전'}</small>{o.owner&&p.user_id!==o.uid&&p.claimed_amount>p.confirmed_amount&&o.state!.phase==='payment'&&<ActionButton secondary onClick={()=>void o.act('confirm-transfer',{user_id:p.user_id})}>{s.nickname(p.user_id)} 입금 확인</ActionButton>}</div>)}</section>
      {o.state.phase==='payment'&&(o.owner?<><ActionButton secondary disabled={o.state.leader_ready} onClick={()=>void o.act('leader-ready')}>{o.state.leader_ready?'내 결제 준비 완료':'내 결제 준비 완료 표시'}</ActionButton><ActionButton disabled={!o.state.leader_ready||paid!==o.members.length-1||o.orderPeople.some(p=>p.refund_due>0)} onClick={()=>{if(confirm('배달앱에서 주문을 완료했나요? 이후에는 일반 취소가 불가능해요.'))void o.act('order').then(ok=>{if(ok)push('delivery')})}}>배달앱 주문 완료 기록</ActionButton></>:<ActionButton disabled={!o.mine||remainingTransfer(o.mine)===0||o.mine.claimed_amount>o.mine.confirmed_amount} onClick={()=>void o.act('claim-transfer')}>송금했어요</ActionButton>)}
      {['ordered','delivering','arrived','completed'].includes(o.state.phase)&&<ActionButton onClick={()=>push(o.state!.phase==='completed'?'complete':'delivery')}>주문 진행 확인</ActionButton>}
    </>}
    {o.orderPeople.filter(p=>p.refund_due>0).map(p=><section className="baef-profile-section" key={p.user_id}><h2>{s.nickname(p.user_id)} 환불 {money(p.refund_due)}</h2><p className="baef-muted">{p.refund_sent?'환불 보냄 · 수령 확인 대기':'리더 환불 대기'}</p>{o.owner&&!p.refund_sent&&<ActionButton secondary onClick={()=>void o.act('refund-sent',{user_id:p.user_id})}>환불을 보냈어요</ActionButton>}{p.user_id===o.uid&&p.refund_sent&&<ActionButton onClick={()=>void o.act('refund-received')}>환불을 받았어요</ActionButton>}</section>)}
  </Page>
}
export function OrderDelivery({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle()
  return <Page title="주문·배달 현황" pop={pop}><h2 className="baef-flow-status">{o.state?phaseLabel[o.state.phase]:'아직 주문 전이에요'}</h2><p className="baef-muted">리더가 배달앱에서 확인한 진행 상황을 기록해요.</p><MeetingTools/>{o.owner&&o.state?.phase==='ordered'&&<ActionButton onClick={()=>void o.act('delivering')}>배달 중으로 표시</ActionButton>}{o.owner&&['ordered','delivering'].includes(o.state?.phase??'')&&<ActionButton onClick={()=>void o.act('arrive')}>음식 도착 확인</ActionButton>}{['arrived','completed'].includes(o.state?.phase??'')&&<ActionButton onClick={()=>push(o.state!.phase==='completed'?'complete':'receipt')}>내 음식 수령 확인</ActionButton>}{['menu','payment'].includes(o.state?.phase??'menu')&&<ActionButton secondary onClick={()=>push('payment')}>송금·주문 준비 확인</ActionButton>}<ActionButton secondary onClick={()=>push('chat')}>채팅방으로</ActionButton></Page>
}
export function OrderReceipt({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  const received=o.orderPeople.filter(p=>p.received_at&&o.members.some(m=>m.user_id===p.user_id)).length
  const lateAllowed=o.state?.arrived_at&&Date.now()>=Math.max(new Date(o.state.arrived_at).getTime(),new Date(o.state.meeting_time??o.state.arrived_at).getTime())+600000
  return <Page title="음식 수령 확인" pop={pop}><h2 className="baef-flow-status">수령 확인 {received}/{o.members.length}</h2><p className="baef-muted">{o.state?.meeting} · {o.state?.meeting_time&&new Date(o.state.meeting_time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</p><p className="baef-muted">닉네임과 주문 메뉴를 확인하고 각자 수령을 눌러 주세요.</p>{o.members.map(m=>{const p=o.orderPeople.find(p=>p.user_id===m.user_id);return <div className="baef-ledger-person" key={m.id}><b>{s.nickname(m.user_id)}</b><small>{p?.received_at?'수령 완료':'수령 대기'}</small>{o.owner&&m.user_id!==o.uid&&!p?.received_at&&lateAllowed&&!p?.late_reported&&<ActionButton secondary onClick={()=>void o.act('late-report',{user_id:m.user_id})}>수령 지각 확인 요청</ActionButton>}</div>})}
    {o.state?.phase==='arrived'&&<ActionButton disabled={!!o.mine?.received_at} onClick={()=>void o.act('receive')}>{o.mine?.received_at?'내 수령 확인 완료':'내 음식 수령 완료'}</ActionButton>}
    {o.mine?.late_reported&&!o.mine.late_ack&&<section className="baef-profile-section"><h2>지각 확인 요청이 있어요</h2><p className="baef-muted">인정한 지각이 2회부터는 3일간 새 모집 참여가 제한돼요. 사실과 다르면 채팅으로 확인하거나 상대 프로필에서 신고할 수 있어요.</p><ActionButton secondary onClick={()=>{if(confirm('이번 수령 지각이 맞나요?'))void o.act('late-ack')}}>이번 지각을 인정해요</ActionButton></section>}
    {o.state?.phase==='completed'&&<ActionButton onClick={()=>push('complete')}>모두 수령 완료 · 거래 마무리</ActionButton>}{o.state?.phase!=='arrived'&&o.state?.phase!=='completed'&&<p className="baef-muted">음식 도착을 확인한 뒤 수령할 수 있어요.</p>}
  </Page>
}
export function OrderComplete({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle()
  return <Page title="거래 완료" pop={pop}>{o.state?.phase==='completed'?<><h2 className="baef-flow-status">모든 배프가 음식을 받았어요.</h2><p className="baef-muted">함께한 사람에 대한 후기를 남겨 주세요.</p><OrderParticipants/><ActionButton onClick={()=>push('rating')}>별점·후기 남기기</ActionButton><ActionButton secondary onClick={()=>push('main')}>다음 메뉴 찾기</ActionButton></>:<><p>아직 모든 참여자가 수령하지 않았어요.</p><ActionButton onClick={()=>push('receipt')}>수령 현황 확인</ActionButton></>}</Page>
}
export function OrderRating({pop}:{pop:()=>void}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  return <Page title="함께한 배프 평가" pop={pop}>{o.state?.phase!=='completed'?<p>전원 수령 완료 후 평가할 수 있어요.</p>:o.members.filter(m=>m.user_id!==o.uid).map(m=>{const saved=o.reviews.find(r=>r.post_id===o.selectedId&&r.subject_id===m.user_id&&r.reviewer_id===o.uid);return <section className="baef-profile-section" key={m.id}><h2>{s.nickname(m.user_id)}</h2>{saved?<p>★ {saved.stars} · {saved.comment||'평가 완료'}</p>:<form className="baef-order-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await o.act('review',{user_id:m.user_id,stars:Number(f.get('stars')),comment:f.get('comment')})}}><label>별점<select name="stars" defaultValue="5">{[5,4,3,2,1].map(n=><option key={n} value={n}>{n}점</option>)}</select></label><label>간단한 후기<textarea name="comment" maxLength={500} placeholder="약속 시간, 소통, 수령 경험을 남겨 주세요."/></label><button className="baef-button" disabled={o.busy}>평가 저장</button></form>}</section>})}</Page>
}
export function OrderProfileExtras({push}:{push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  if(!s.session)return null
  return <><section className="baef-profile-section"><h2>내 평판과 이용 기록</h2><p>{o.myReputation?.rating!=null?`★ ${o.myReputation.rating}`:'아직 별점 없음'} · 공동배달 {o.myReputation?.trades??0}회 · 후기 {o.myReputation?.review_count??0}개</p>{s.me?.suspended_until&&new Date(s.me.suspended_until).getTime()>Date.now()&&<p className="baef-error">{new Date(s.me.suspended_until).toLocaleString('ko-KR')}까지 새 모집 참여가 제한돼요.</p>}<p className="baef-muted">인정한 수령 지각 {o.people.filter(p=>p.user_id===o.uid&&p.late_ack).length}회 · 2회부터 3일 제한</p></section>
    <section className="baef-profile-section"><h2>우수 배프 혜택</h2><p>{o.couponEligible?'배달비 쿠폰 사용 가능':'별점 4.8 이상 · 완료 거래 5회부터 쿠폰을 받을 수 있어요.'}</p><p className="baef-muted">계정당 1회, 최대 1,000원. 리더가 할인액 부담에 동의한 모임에서 송금 전에 사용할 수 있어요.</p></section>
    <section className="baef-profile-section"><h2>주문·환불 이력</h2>{o.states.map(v=>{const post=s.rawPosts.find(p=>p.id===v.post_id);if(!post)return null;return <button key={v.post_id} className="baef-history-row" onClick={()=>{s.selectPost(s.numberFor(v.post_id));push(v.phase==='cancelled'?'payment':v.phase==='completed'?'complete':'detail')}}><b>{post.restaurant}</b><span>{phaseLabel[v.phase]} ›</span></button>})}{!o.states.length&&<p className="baef-muted">참여한 주문이 여기에 쌓여요.</p>}</section>
    <section className="baef-profile-section"><h2>신고 처리 내역</h2>{o.reports.map(r=><div className="baef-review" key={r.id}><b>{r.reporter_id===o.uid?'내가 접수한 신고':'나에 대한 신고'} · {r.reason}</b><p>{r.status==='pending'?'검토 대기':r.status==='confirmed'?'확인 후 처리':'종결'}</p>{r.resolution&&<p>{r.resolution}</p>}</div>)}{!o.reports.length&&<p className="baef-muted">접수된 신고가 없어요. 상대 프로필에서 신고할 수 있어요.</p>}</section>{o.error&&<p className="baef-error" role="alert">{o.error}</p>}</>
}
