import { lazy, Suspense, useId, useState, type FormEvent, type ReactNode } from 'react'
import { useSharedDelivery } from './SharedDelivery'
import { money } from './MenuDiscoveryContext'
import { useFlow } from './FlowContext'
import { BasketEditor, SmallIcon } from './MenuDiscovery'
import { distanceM, midpoint, orderDue, phaseLabel, remainingTransfer, useDeliveryLifecycle } from './DeliveryLifecycle'
import type { Screen } from './WorkflowScreens'
import type { MapPin } from './LocationMap'
import './order-flow.css'
import { WalkingRewardDetails as WalkingRewardPlan, WalkingRewardWallet } from './WalkingRewards'
import { ButtonHint, SaveFeedback, useSaveFeedback } from './uiFeedback'
import { OrderGuide } from './OrderGuide'
import { orderNextStep } from './orderGuidance'
import { useMenuDiscovery } from './MenuDiscoveryContext'
import PickupTimeField from './PickupTimeField'
import { pickupTimestamp } from './pickupTime'
const LocationMap=lazy(()=>import('./LocationMap'))
type Navigate=(screen:Screen)=>void
function InfoDetails({title,summary,children,initiallyOpen=false}:{title:string;summary:ReactNode;children:ReactNode;initiallyOpen?:boolean}){
  return <details className="baef-info-details" open={initiallyOpen}><summary><span>{title}</span><small>{summary}</small></summary><div className="baef-info-content">{children}</div></details>
}
function ActionButton({children,onClick,secondary=false,disabled=false,disabledReason=''}:{children:ReactNode;onClick:()=>void;secondary?:boolean;disabled?:boolean;disabledReason?:string}){
  const o=useDeliveryLifecycle()
  const hint=useId()
  return <><button className={`baef-button ${secondary?'secondary':''}`} aria-busy={o.busy} aria-describedby={disabledReason?hint:undefined} disabled={disabled||!!disabledReason||o.busy} onClick={onClick}>{children}</button><ButtonHint id={hint} reason={disabledReason}/></>
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
  const next=orderNextStep({role:o.owner?'leader':'participant',application:'accepted',phase:o.state?.phase,count:o.members.length})
  return <button className="chat-tool chat-order-link" onClick={()=>push(next.route)}>{next.action}<span aria-hidden="true">→</span></button>
}
export function PersonProfile({userId,close}:{userId:string;close:()=>void}){
  const s=useSharedDelivery(),o=useDeliveryLifecycle(),rep=o.reputation(userId)
  const [report,setReport]=useState(false),[sent,setSent]=useState(false)
  const reviews=o.reviews.filter(r=>r.subject_id===userId)
  const canReport=userId!==o.uid&&o.members.some(m=>m.user_id===userId)&&o.members.some(m=>m.user_id===o.uid)
  return <div className="baef-overlay" role="dialog" aria-modal="true" aria-labelledby="person-heading"><section className="baef-sheet"><div className="baef-sheet-title"><h2 id="person-heading">{s.nickname(userId)}</h2><button aria-label="프로필 닫기" className="baef-icon-button" onClick={close}><SmallIcon name="close"/></button></div><p className="baef-reputation">{rep?.rating!=null?`★ ${rep.rating}`:'아직 별점 없음'} · 공동배달 {rep?.trades??0}회 · 후기 {rep?.review_count??0}개</p>{reviews.map(r=><div className="baef-review" key={r.id}><b>★ {r.stars}</b><p>{r.comment||'별점만 남겼어요.'}</p><small>{new Date(r.created_at).toLocaleDateString('ko-KR')}</small></div>)}{!reviews.length&&<p className="baef-muted">완료한 거래의 후기가 여기에 쌓여요.</p>}
    {canReport&&<button className="baef-text-cancel" onClick={()=>setReport(!report)}>이 참가자 신고</button>}{report&&!sent&&<form className="baef-order-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(await o.act('report',{user_id:userId,reason:f.get('reason'),detail:f.get('detail')}))setSent(true)}}><label>사유<select name="reason"><option>약속 불이행</option><option>입금·환불 문제</option><option>부적절한 대화</option><option>기타</option></select></label><label>상황 설명<textarea name="detail" maxLength={1000} required/></label><p className="baef-muted">신고는 검토 후 처리돼요. 신고만으로 상대가 정지되지는 않아요.</p><button className="baef-button" disabled={o.busy}>신고 접수</button></form>}{sent&&<p role="status" className="baef-muted">신고를 접수했어요. 내 정보에서 처리 상태를 확인할 수 있어요.</p>}{o.error&&<p className="baef-error" role="alert">{o.error}</p>}
  </section></div>
}
export function OrderParticipants(){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),[person,setPerson]=useState<string|null>(null)
  return <><InfoDetails title="함께하는 배프" summary={`${o.members.length}명 · 프로필과 평판`}>{o.members.map(m=>{const r=o.reputation(m.user_id);return <button key={m.id} className="baef-person-row" onClick={()=>setPerson(m.user_id)}><span className="baef-avatar">{s.nickname(m.user_id).slice(0,1)}</span><span><b>{s.nickname(m.user_id)}{m.user_id===o.post?.owner_id?' · 리더':''}</b><small>{r?.rating!=null?`★ ${r.rating}`:'첫 거래를 기다려요'} · {r?.trades??0}회</small></span><span>›</span></button>})}</InfoDetails>{person&&<PersonProfile userId={person} close={()=>setPerson(null)}/>}</>
}
export function MeetingTools(){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),{currentLocation}=useFlow()
  const [address,setAddress]=useState('')
  const feedback=useSaveFeedback()
  const positions=o.orderPeople.filter(p=>p.latitude!=null&&p.longitude!=null&&o.members.some(m=>m.user_id===p.user_id))
  const points=positions.map(p=>({lat:p.latitude!,lng:p.longitude!}))
  const candidate=points.length===o.members.length&&points.length>=2?midpoint(points):null
  const feasible=candidate&&points.every(p=>distanceM(p,candidate)<=400)
  const editable=o.state?.phase==='menu'||o.state?.phase==='payment'
  const pins:MapPin[]=positions.map(p=>({id:p.user_id,point:{x:0,y:0},coordinates:{lat:p.latitude!,lng:p.longitude!},label:s.nickname(p.user_id),symbol:p.user_id===o.uid?'나':s.nickname(p.user_id).slice(0,1),kind:p.user_id===o.uid?'me':'person'}))
  if(o.state?.meeting_lat!=null&&o.state.meeting_lng!=null)pins.push({id:'meeting',point:{x:0,y:0},coordinates:{lat:o.state.meeting_lat,lng:o.state.meeting_lng},label:o.state.meeting,symbol:'만남',kind:'meeting'})
  if(candidate&&feasible)pins.push({id:'candidate',point:{x:0,y:0},coordinates:candidate,label:'중간 수령점 후보',symbol:'후보',kind:'meeting'})
  let suggestedDate:string|null=null
  try{const meta=JSON.parse(o.post?.note??'{}');if(typeof meta.starts_at==='string')suggestedDate=meta.starts_at}catch{/* Existing plain-text notes have no suggested date. */}
  const form=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget),time=pickupTimestamp(String(f.get('meeting_day')??''),String(f.get('time')??''));if(!time){o.setError('수령할 날짜와 시간을 확인해 주세요.');return}const version=feedback.begin();if(await o.act('meeting',{meeting:f.get('meeting'),time}))feedback.saved(version)}
  return <InfoDetails title="수령 장소와 시간" initiallyOpen={o.state?.phase==='menu'&&!o.state.meeting_time} summary={<>{o.state?.meeting||o.post?.meeting||'장소 미정'} · {o.state?.meeting_time?new Date(o.state.meeting_time).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시간 설정 필요'}{o.state?.nearby_requester&&!o.state.nearby_agreed&&' · 근처 수령 제안 동의 대기'}</>}>
    {editable&&<form key={`${o.selectedId}:${o.state?.meeting}`} className="baef-order-form" onChange={feedback.change} onSubmit={form}><label>합의한 공개 수령 장소<input name="meeting" defaultValue={o.state?.meeting||o.post?.meeting} maxLength={200} required/></label><PickupTimeField value={o.state?.meeting_time??null} suggestedDate={suggestedDate}/><button className="baef-button secondary" disabled={o.busy}>{o.busy?'저장 중…':'장소·시간 저장'}</button><SaveFeedback status={feedback.status}/></form>}
    <details className="baef-order-details"><summary>참가자 위치·중간 지점 지도</summary><p className="baef-muted">내 위치 공유는 선택이에요. 공유한 위치는 이 모임의 참가자에게 표시돼요.</p>{o.mine?.latitude!=null?<ActionButton secondary onClick={()=>void o.act('share-location',{})}>내 위치 공유 끄기</ActionButton>:<><button className="baef-button secondary" disabled={currentLocation.loading} onClick={currentLocation.request}>현재 위치 확인</button><ActionButton secondary disabledReason={!currentLocation.coordinates?'현재 위치를 먼저 확인해 주세요.':''} onClick={()=>{const p=currentLocation.coordinates;if(p)void o.act('share-location',{lat:p.lat,lng:p.lng})}}>이 모임에 내 위치 공유</ActionButton></>}{currentLocation.error&&<p className="baef-error">{currentLocation.error}</p>}
      {!!pins.length&&<div className="baef-order-map"><Suspense fallback={<p>지도 불러오는 중…</p>}><LocationMap pins={pins} onSelect={()=>{}} title="함께 수령할 참가자와 장소" center={pins[0].coordinates}/></Suspense></div>}
      {candidate&&feasible?<><p className="baef-muted">중간 지점까지 각자 약 {Math.ceil(Math.max(...points.map(p=>distanceM(p,candidate))))}m 이내예요. 직선거리 기준이므로 길과 출입 가능 여부를 함께 확인해 주세요.</p>{editable&&!o.state?.nearby_agreed&&<ActionButton secondary onClick={()=>void o.act('meeting',{meeting:'중간 지점 · 채팅에서 상세 위치 확인',time:o.state?.meeting_time,lat:candidate.lat,lng:candidate.lng})}>중간 지점을 수령 후보로 저장</ActionButton>}</>:<p className="baef-muted">{points.length<o.members.length?'참가자 전원이 위치를 공유하면 중간 지점을 비교할 수 있어요.':'현재 위치들의 중간점은 모두의 400m 범위 안에 들어오지 않아요. 장소를 다시 조율해 주세요.'}</p>}
    </details>
    {o.members.length===2&&o.state?.phase==='menu'&&<details className="baef-order-details"><summary>내 근처에서 받기</summary><p className="baef-muted">배달 주소를 요청자 근처로 정해요. 요청자는 배달비 전액, 이동하는 상대는 배달비 0원이에요. 상대가 동의해야 적용돼요.</p>{o.state.nearby_requester?<><p>{s.nickname(o.state.nearby_requester)}님의 제안 · {o.state.nearby_address}</p><b>{o.state.nearby_agreed?'상대 동의 완료':'상대 동의 대기'}</b>{o.state.nearby_requester!==o.uid&&!o.state.nearby_agreed&&<ActionButton onClick={()=>void o.act('nearby-agree')}>이 장소로 이동하고 배달비 0원에 동의</ActionButton>}<ActionButton secondary onClick={()=>void o.act('nearby-reset')}>제안 취소·다시 조율</ActionButton></>:<><label className="baef-order-field">내 근처 공개 수령 장소<input value={address} maxLength={200} onChange={e=>setAddress(e.target.value)} placeholder="건물 앞 등 만날 수 있는 장소"/></label><ActionButton disabled={!address.trim()} onClick={()=>void o.act('nearby-propose',{address:address.trim()})}>내 근처 수령 제안</ActionButton></>}</details>}
  </InfoDetails>
}
export function OrderMenu({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),d=useMenuDiscovery(),accountFeedback=useSaveFeedback()
  if(!o.post)return <Page title="주문 진행" pop={pop}><p>참여 중인 모임을 선택해 주세요.</p></Page>
  const orders=d.baskets.filter(b=>b.post_id===o.post!.id&&o.members.some(m=>m.user_id===b.user_id)&&b.total>0)
  const amount=orders.reduce((sum,b)=>sum+b.total,0)
  const meetingReady=!!o.state?.meeting&&!!o.state.meeting_time
  const accountReady=!!o.state?.bank&&!!o.state.account&&!!o.state.holder
  const finalizeReason=o.members.length<2?'함께 주문할 배프가 한 명 더 필요해요.':orders.length<o.members.length?'모든 참가자가 메뉴를 저장해야 해요.':amount<o.post.min_order?`목표금액까지 ${money(o.post.min_order-amount)} 더 필요해요.`:!meetingReady?'수령 장소와 시간을 저장해 주세요.':!accountReady?'송금받을 리더 계좌를 저장해 주세요.':''
  const account=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const version=accountFeedback.begin(),f=new FormData(e.currentTarget);if(await o.act('account',{bank:f.get('bank'),account:f.get('account'),holder:f.get('holder')})){accountFeedback.saved(version);s.setNotice('리더 계좌를 저장했어요.')}}
  return <Page title="메뉴와 주문 확정" pop={pop}>{o.state?.phase==='menu'&&<><OrderGuide title={o.owner?'주문 전 준비를 마쳐 주세요':'내 메뉴를 먼저 확인해 주세요'} description={o.owner?'메뉴·수령 장소·계좌를 정하고 모집을 마감하면 송금 단계로 넘어갈 수 있어요.':'내 메뉴를 저장하고 채팅에서 장소와 시간을 정해요. 주문 확정은 리더가 진행해요.'}/><ul className="baef-prep-checks"><li data-done={orders.length===o.members.length&&orders.length>0}><span aria-hidden="true">{orders.length===o.members.length&&orders.length>0?'✓':'○'}</span>메뉴 {orders.length}/{o.members.length}명</li><li data-done={meetingReady}><span aria-hidden="true">{meetingReady?'✓':'○'}</span>수령 장소·시간</li>{o.owner&&<li data-done={accountReady}><span aria-hidden="true">{accountReady?'✓':'○'}</span>리더 계좌</li>}</ul></>}<BasketEditor postId={o.post.id}/><div className="baef-settings-group"><MeetingTools/>{o.owner&&o.state?.phase==='menu'&&<InfoDetails title="송금받을 리더 계좌" initiallyOpen={!accountReady} summary={o.state.bank&&o.state.account&&o.state.holder?`${o.state.bank} · ${o.state.holder}`:'계좌 등록 필요'}><form className="baef-order-form" key={o.post.id} onChange={accountFeedback.change} onSubmit={account}><label>은행<input name="bank" defaultValue={o.state.bank} maxLength={30} required/></label><label>계좌번호<input name="account" defaultValue={o.state.account} maxLength={40} required/></label><label>예금주<input name="holder" defaultValue={o.state.holder} maxLength={30} required/></label><button className="baef-button secondary" disabled={o.busy}>{o.busy?'저장 중…':'리더 계좌 저장'}</button><SaveFeedback status={accountFeedback.status}/></form></InfoDetails>}</div>
    <div className="baef-next-action">{o.state?.phase==='menu'?(o.owner?<>{o.members.length<2?<ActionButton onClick={()=>push('applicants')}>함께할 배프·신청자 확인</ActionButton>:o.post.status==='open'?<ActionButton disabled={s.busy} onClick={()=>void s.act('close',o.post!.id)}>현재 인원으로 모집 마감</ActionButton>:<ActionButton disabledReason={o.post.status!=='closed'?'모집 마감 상태를 확인해 주세요.':finalizeReason} onClick={()=>void o.act('finalize').then(ok=>{if(ok)push('payment')})}>주문 확정하고 송금으로</ActionButton>}<p className="baef-muted">모두 메뉴를 저장하고 목표금액을 채운 뒤 확정할 수 있어요.</p></>:<><p className="baef-muted">리더가 주문을 확정하면 송금 단계가 열려요.</p><ActionButton secondary onClick={()=>push('chat')}>채팅에서 장소·시간 정하기</ActionButton></>):<ActionButton onClick={()=>push(o.state?.phase==='completed'?'complete':'payment')}>다음 진행 확인</ActionButton>}</div><OrderParticipants/><WalkingRewardPlan/>
  </Page>
}
export function OrderPayment({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),[copy,setCopy]=useState('')
  if(!o.state||!o.post)return <Page title="송금 현황" pop={pop}><p>모임을 선택해 주세요.</p></Page>
  if(o.state.phase==='menu')return <Page title="송금 현황" pop={pop}><p>메뉴·계좌·수령 장소를 정하고 주문 내용을 확정하면 송금할 수 있어요.</p><ActionButton onClick={()=>push('menu')}>메뉴와 주문 확정으로</ActionButton></Page>
  const members=o.orderPeople.filter(p=>o.members.some(m=>m.user_id===p.user_id))
  const paid=members.filter(p=>p.user_id!==o.post!.owner_id&&remainingTransfer(p)===0).length
  const platformSupport=o.state.coupon_funding==='platform'?members.reduce((sum,p)=>sum+p.coupon_discount,0):0
  const ledger=members.map(p=><div className="baef-ledger-person" key={p.user_id}><b>{s.nickname(p.user_id)}</b><span>{money(orderDue(p))}</span><small>{p.user_id===o.post!.owner_id?o.state!.leader_ready?'결제 준비 완료':'결제 준비 전':remainingTransfer(p)===0?'입금 확인 완료':p.claimed_amount>p.confirmed_amount?'리더 확인 대기':'송금 전'}</small>{o.owner&&p.user_id!==o.uid&&p.claimed_amount>p.confirmed_amount&&o.state!.phase==='payment'&&<ActionButton secondary onClick={()=>void o.act('confirm-transfer',{user_id:p.user_id})}>{s.nickname(p.user_id)} 입금 확인</ActionButton>}</div>)
  return <Page title={o.state.phase==='cancelled'?'취소·환불 현황':'리더에게 송금'} pop={pop}>
    {o.state.phase!=='cancelled'&&<>{o.state.phase==='payment'&&<OrderGuide title={o.owner?'참가자의 입금 확인 → 배달앱에서 주문':'계좌 확인 → 송금 → 송금 완료 표시'} description={o.owner?'각 참가자의 입금을 확인한 뒤 배달앱에서 주문하고, 아래에서 주문 완료를 기록해 주세요.':'아래 계좌로 내 금액을 보내고 ‘송금했어요’를 눌러 주세요. 리더가 입금을 확인하고 최종 주문해요.'}/>}
      {o.mine&&<section className="baef-payment-amount"><span>{o.owner?'내 부담액':'총 송금액'}</span><strong>{money(orderDue(o.mine))}</strong>{!o.owner&&<p className="baef-muted">{remainingTransfer(o.mine)===0?'입금 확인 완료':o.mine.claimed_amount>o.mine.confirmed_amount?'리더 입금 확인 대기':`남은 송금액 ${money(remainingTransfer(o.mine))}`}</p>}<details className="baef-amount-breakdown"><summary>금액 상세</summary><div className="baef-bill"><p>내 음식값 <b>{money(o.mine.food_total)}</b></p><p>내 배달비 <b>{money(o.mine.fee)}</b></p>{o.mine.coupon_discount>0&&<p>{o.state.coupon_funding==='platform'?'배프 지원 쿠폰':'쿠폰'} <b>−{money(o.mine.coupon_discount)}</b></p>}</div></details></section>}
      <section className="baef-profile-section baef-bank-card"><h2>{o.state.bank} · {o.state.holder}</h2><p className="baef-account-number">{o.state.account}</p><button className="baef-text-action" onClick={()=>void navigator.clipboard.writeText(o.state!.account).then(()=>setCopy('계좌번호를 복사했어요.')).catch(()=>setCopy('복사하지 못했어요. 계좌번호를 직접 확인해 주세요.'))}>계좌번호 복사</button>{copy&&<p role="status" className="baef-muted">{copy}</p>}</section>
      {o.state.nearby_agreed&&<p className="baef-muted">내 근처 수령 · 요청자 {s.nickname(o.state.nearby_requester!)}님이 배달비 전액 부담</p>}
      {o.state.phase==='payment'&&o.couponEligible&&o.state.coupon_funding==='platform'&&!o.owner&&!o.state.nearby_agreed&&!o.mine?.coupon_discount&&<ActionButton secondary onClick={()=>void o.act('coupon')}>배프 지원 쿠폰 적용 · 최대 1,000원</ActionButton>}
      {o.owner?<section className="baef-profile-section"><h2>참가자 입금 확인 {paid}/{Math.max(0,o.members.length-1)}</h2>{ledger}</section>:<InfoDetails title="전체 입금 현황" summary={`${paid}/${Math.max(0,o.members.length-1)}명 확인 완료`}>{ledger}</InfoDetails>}
      {platformSupport>0&&<section className="baef-bill"><p>참여자 부담 합계 <b>{money(members.reduce((sum,p)=>sum+orderDue(p),0))}</b></p><p>배프 쿠폰 지원 <b>{money(platformSupport)}</b></p><p className="total">전체 주문금액 <b>{money(members.reduce((sum,p)=>sum+p.food_total+p.fee,0))}</b></p></section>}
      {o.state.phase==='payment'&&(o.owner?<><ActionButton secondary disabled={o.state.leader_ready} onClick={()=>void o.act('leader-ready')}>{o.state.leader_ready?'내 결제 준비 완료':'내 결제 준비 완료 표시'}</ActionButton><ActionButton disabledReason={!o.state.leader_ready?'내 결제 준비 완료를 먼저 표시해 주세요.':paid!==o.members.length-1?'모든 참가자의 입금을 확인해 주세요.':o.orderPeople.some(p=>p.refund_due>0)?'남은 환불 확인을 마쳐 주세요.':''} onClick={()=>{if(confirm('배달앱에서 주문을 완료했나요? 이후에는 일반 취소가 불가능해요.'))void o.act('order').then(ok=>{if(ok)push('delivery')})}}>배달앱 주문 완료 기록</ActionButton></>:<ActionButton disabledReason={!o.mine?'내 주문 정보를 불러오는 중이에요.':remainingTransfer(o.mine)===0?'입금 확인이 완료됐어요.':o.mine.claimed_amount>o.mine.confirmed_amount?'리더의 입금 확인을 기다리고 있어요.':''} onClick={()=>void o.act('claim-transfer')}>송금했어요</ActionButton>)}
      {['ordered','delivering','arrived','completed'].includes(o.state.phase)&&<ActionButton onClick={()=>push(o.state!.phase==='completed'?'complete':'delivery')}>주문 진행 확인</ActionButton>}
    </>}
    {o.orderPeople.filter(p=>p.refund_due>0).map(p=><section className="baef-profile-section" key={p.user_id}><h2>{s.nickname(p.user_id)} 환불 {money(p.refund_due)}</h2><p className="baef-muted">{p.refund_sent?'환불 보냄 · 수령 확인 대기':'리더 환불 대기'}</p>{o.owner&&!p.refund_sent&&<ActionButton secondary onClick={()=>void o.act('refund-sent',{user_id:p.user_id})}>환불을 보냈어요</ActionButton>}{p.user_id===o.uid&&p.refund_sent&&<ActionButton onClick={()=>void o.act('refund-received')}>환불을 받았어요</ActionButton>}</section>)}
  </Page>
}
export function OrderDelivery({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle()
  return <Page title="주문·배달 현황" pop={pop}><h2 className="baef-flow-status">{o.state?phaseLabel[o.state.phase]:'아직 주문 전이에요'}</h2><p className="baef-muted">리더가 배달앱에서 확인한 진행 상황을 기록해요.</p><MeetingTools/><WalkingRewardPlan/>{o.owner&&o.state?.phase==='ordered'&&<ActionButton onClick={()=>void o.act('delivering')}>배달 중으로 표시</ActionButton>}{o.owner&&['ordered','delivering'].includes(o.state?.phase??'')&&<ActionButton onClick={()=>void o.act('arrive')}>음식 도착 확인</ActionButton>}{['arrived','completed'].includes(o.state?.phase??'')&&<ActionButton onClick={()=>push(o.state!.phase==='completed'?'complete':'receipt')}>내 음식 수령 확인</ActionButton>}{['menu','payment'].includes(o.state?.phase??'menu')&&<ActionButton secondary onClick={()=>push('payment')}>송금·주문 준비 확인</ActionButton>}<ActionButton secondary onClick={()=>push('chat')}>채팅방으로</ActionButton></Page>
}
export function OrderReceipt({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  const received=o.orderPeople.filter(p=>p.received_at&&o.members.some(m=>m.user_id===p.user_id)).length
  const lateAllowed=o.state?.arrived_at&&Date.now()>=Math.max(new Date(o.state.arrived_at).getTime(),new Date(o.state.meeting_time??o.state.arrived_at).getTime())+600000
  return <Page title="음식 수령 확인" pop={pop}><h2 className="baef-flow-status">수령 확인 {received}/{o.members.length}</h2><p className="baef-muted">{o.state?.meeting} · {o.state?.meeting_time&&new Date(o.state.meeting_time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</p><p className="baef-muted">닉네임과 주문 메뉴를 확인하고 각자 수령을 눌러 주세요.</p>{o.members.map(m=>{const p=o.orderPeople.find(p=>p.user_id===m.user_id);return <div className="baef-ledger-person" key={m.id}><b>{s.nickname(m.user_id)}</b><small>{p?.received_at?'수령 완료':'수령 대기'}</small>{o.owner&&m.user_id!==o.uid&&!p?.received_at&&lateAllowed&&!p?.late_reported&&<ActionButton secondary onClick={()=>void o.act('late-report',{user_id:m.user_id})}>수령 지각 확인 요청</ActionButton>}</div>})}
    <WalkingRewardPlan/>
    {o.state?.phase==='arrived'&&<ActionButton disabled={!!o.mine?.received_at} onClick={()=>void o.act('receive')}>{o.mine?.received_at?'내 수령 확인 완료':'내 음식 수령 완료'}</ActionButton>}
    {o.mine?.late_reported&&!o.mine.late_ack&&<section className="baef-profile-section"><h2>지각 확인 요청이 있어요</h2><p className="baef-muted">인정한 지각이 2회부터는 3일간 새 모집 참여가 제한돼요. 사실과 다르면 채팅으로 확인하거나 상대 프로필에서 신고할 수 있어요.</p><ActionButton secondary onClick={()=>{if(confirm('이번 수령 지각이 맞나요?'))void o.act('late-ack')}}>이번 지각을 인정해요</ActionButton></section>}
    {o.state?.phase==='completed'&&<ActionButton onClick={()=>push('complete')}>모두 수령 완료 · 거래 마무리</ActionButton>}{o.state?.phase!=='arrived'&&o.state?.phase!=='completed'&&<p className="baef-muted">음식 도착을 확인한 뒤 수령할 수 있어요.</p>}
  </Page>
}
export function OrderComplete({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle()
  return <Page title="거래 완료" pop={pop}>{o.state?.phase==='completed'?<><h2 className="baef-flow-status">모든 배프가 음식을 받았어요.</h2><p className="baef-muted">함께한 사람에 대한 후기를 남겨 주세요.</p><WalkingRewardPlan/><OrderParticipants/><ActionButton onClick={()=>push('rating')}>별점·후기 남기기</ActionButton><ActionButton secondary onClick={()=>push('main')}>다음 메뉴 찾기</ActionButton></>:<><p>아직 모든 참가자가 수령하지 않았어요.</p><ActionButton onClick={()=>push('receipt')}>수령 현황 확인</ActionButton></>}</Page>
}
export function OrderRating({pop}:{pop:()=>void}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  return <Page title="함께한 배프 평가" pop={pop}>{o.state?.phase!=='completed'?<p>전원 수령 완료 후 평가할 수 있어요.</p>:o.members.filter(m=>m.user_id!==o.uid).map(m=>{const saved=o.reviews.find(r=>r.post_id===o.selectedId&&r.subject_id===m.user_id&&r.reviewer_id===o.uid);return <section className="baef-profile-section" key={m.id}><h2>{s.nickname(m.user_id)}</h2>{saved?<p>★ {saved.stars} · {saved.comment||'평가 완료'}</p>:<form className="baef-order-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await o.act('review',{user_id:m.user_id,stars:Number(f.get('stars')),comment:f.get('comment')})}}><label>별점<select name="stars" defaultValue="5">{[5,4,3,2,1].map(n=><option key={n} value={n}>{n}점</option>)}</select></label><label>간단한 후기<textarea name="comment" maxLength={500} placeholder="약속 시간, 소통, 수령 경험을 남겨 주세요."/></label><button className="baef-button" disabled={o.busy}>평가 저장</button></form>}</section>})}</Page>
}
export function OrderProfileExtras({push}:{push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  if(!s.session)return null
  return <><WalkingRewardWallet/><section className="baef-profile-section"><h2>내 평판과 이용 기록</h2><p>{o.myReputation?.rating!=null?`★ ${o.myReputation.rating}`:'아직 별점 없음'} · 공동배달 {o.myReputation?.trades??0}회 · 후기 {o.myReputation?.review_count??0}개</p>{s.me?.suspended_until&&new Date(s.me.suspended_until).getTime()>Date.now()&&<p className="baef-error">{new Date(s.me.suspended_until).toLocaleString('ko-KR')}까지 새 모집 참여가 제한돼요.</p>}<p className="baef-muted">인정한 수령 지각 {o.people.filter(p=>p.user_id===o.uid&&p.late_ack).length}회 · 2회부터 3일 제한</p></section>
    <InfoDetails title="우수 배프 혜택" summary={o.couponEligible?"쿠폰 사용 가능":"쿠폰 조건 보기"}><p>{o.couponEligible?'배달비 쿠폰 사용 가능':'별점 4.8 이상 · 완료 거래 5회부터 쿠폰을 받을 수 있어요.'}</p><p className="baef-muted">배프가 배달비를 최대 1,000원 지원해요. 계정당 1회, 일반 모임에서 송금 전에 사용할 수 있어요.</p></InfoDetails>
    <InfoDetails title="주문·환불 이력" summary={`${o.states.length}건`}>{o.states.map(v=>{const post=s.rawPosts.find(p=>p.id===v.post_id);if(!post)return null;return <button key={v.post_id} className="baef-history-row" onClick={()=>{s.selectPost(s.numberFor(v.post_id));push(v.phase==='cancelled'?'payment':v.phase==='completed'?'complete':'detail')}}><b>{post.restaurant}</b><span>{phaseLabel[v.phase]} ›</span></button>})}{!o.states.length&&<p className="baef-muted">참여한 주문이 여기에 쌓여요.</p>}</InfoDetails>
    <InfoDetails title="신고 처리 내역" summary={o.reports.some(r=>r.status==='pending')?'검토 중인 신고 있음':`${o.reports.length}건`}>{o.reports.map(r=><div className="baef-review" key={r.id}><b>{r.reporter_id===o.uid?'내가 접수한 신고':'나에 대한 신고'} · {r.reason}</b><p>{r.status==='pending'?'검토 대기':r.status==='confirmed'?'확인 후 처리':'종결'}</p>{r.resolution&&<p>{r.resolution}</p>}</div>)}{!o.reports.length&&<p className="baef-muted">접수된 신고가 없어요. 상대 프로필에서 신고할 수 있어요.</p>}</InfoDetails>{o.error&&<p className="baef-error" role="alert">{o.error}</p>}</>
}
