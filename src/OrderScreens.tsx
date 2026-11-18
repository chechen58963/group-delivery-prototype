import { lazy, Suspense, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { useSharedDelivery } from './SharedDelivery'
import { money } from './MenuDiscoveryContext'
import { usePreferences } from './AppPreferences'
import { BasketEditor, SmallIcon } from './MenuDiscovery'
import { distanceM, midpoint, orderDue, phaseLabel, remainingTransfer, useDeliveryLifecycle } from './DeliveryLifecycle'
import type { Screen } from './navigationTypes'
import type { MapPin } from './LocationMap'
import './order-flow.css'
import { WalkingRewardDetails as WalkingRewardPlan, WalkingRewardWallet } from './WalkingRewards'
import { ButtonHint, SaveFeedback, useSaveFeedback } from './uiFeedback'
import { OrderGuide } from './OrderGuide'
import { orderNextStep } from './orderGuidance'
import { useMenuDiscovery } from './MenuDiscoveryContext'
import PickupTimeField from './PickupTimeField'
import { pickupTimestamp } from './pickupTime'
import MeetingEditor from './MeetingEditor'
import PickupMethod, { pickupAgreed } from './PickupMethod'
import { WalkingRewardReceipt } from './WalkingRewards'
import {pickupCandidates} from './userFlow'
import Icon from './ui/Icon'
import { Modal } from './ui/Modal'
const LocationMap=lazy(()=>import('./LocationMap'))
type Navigate=(screen:Screen)=>void
function InfoDetails({title,summary,children,initiallyOpen=false,id}:{title:string;summary:ReactNode;children:ReactNode;initiallyOpen?:boolean;id?:string}){
  return <details id={id} className="baef-info-details" open={initiallyOpen}><summary><span>{title}</span><small>{summary}</small></summary><div className="baef-info-content">{children}</div></details>
}
function ActionButton({children,onClick,secondary=false,disabled=false,disabledReason=''}:{children:ReactNode;onClick:()=>void;secondary?:boolean;disabled?:boolean;disabledReason?:string}){
  const o=useDeliveryLifecycle()
  const hint=useId()
  return <><button className={`baef-button ${secondary?'secondary':''}`} aria-busy={o.busy} aria-describedby={disabledReason?hint:undefined} disabled={disabled||!!disabledReason||o.busy} onClick={onClick}>{children}</button><ButtonHint id={hint} reason={disabledReason}/></>
}
function Page({title,pop,children,footer}:{title:string;pop:()=>void;children:ReactNode;footer?:ReactNode}){
  const o=useDeliveryLifecycle()
  return <div className="live-workflow-route"><div className="baef-scroll"><div className="baef-page"><button className="baef-back" onClick={pop}><SmallIcon name="back"/>뒤로</button><h1 className="baef-page-title">{title}</h1>{o.post&&<p className="baef-muted">{o.post.restaurant}</p>}{o.error&&<p role="alert" className="baef-error">{o.error}</p>}{children}</div></div>{footer&&<footer className="live-workflow-footer">{footer}</footer>}</div>
}
export function OrderProgress({push,currentOnly=false,onReview}:{push:Navigate;currentOnly?:boolean;onReview?:Navigate}){
  const o=useDeliveryLifecycle();if(!o.state)return null
  const steps=[{id:'menu',label:'메뉴',route:'menu'},{id:'payment',label:'송금',route:'payment'},{id:'ordered',label:'배달',route:'delivery'},{id:'arrived',label:'수령',route:'receipt'},{id:'completed',label:'평가',route:'complete'}] as const
  const index=o.state.phase==='delivering'?2:steps.findIndex(s=>s.id===o.state!.phase)
  return <nav className="baef-order-progress" aria-label="공동배달 진행 단계">{steps.map((s,i)=><button key={s.id} aria-current={index===i?'step':undefined} disabled={i>index||currentOnly&&!onReview&&i!==index} onClick={()=>onReview?onReview(s.route):push(s.route)}><i className={i<=index?'done':''}/>{s.label}</button>)}</nav>
}
export function OrderWorkspace({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  const withdrawn=s.members.some(m=>m.post_id===o.selectedId&&m.user_id===o.uid&&m.status==='withdrawn')
  const phase=o.state?.phase??'menu'
  const stage=withdrawn||phase==='cancelled'?'payment':phase==='ordered'||phase==='delivering'?'delivery':phase==='arrived'?'receipt':phase==='completed'?'complete':phase
  const key=`${o.selectedId}:${o.uid}:${stage}`
  const [review,setReview]=useState<{key:string;screen:Screen}|null>(null)
  const d=useMenuDiscovery()
  return <><OrderProgress push={push} currentOnly onReview={screen=>setReview(screen===stage?null:{key,screen})}/>{review?.key===key&&<Modal title="이전 주문 내용 확인" close={()=>setReview(null)}><p className="baef-muted">저장된 주문 내용이에요. 현재 진행 단계는 그대로 유지돼요.</p>{d.baskets.filter(b=>b.post_id===o.selectedId&&o.members.some(m=>m.user_id===b.user_id)).map(b=><section key={b.user_id}><h3>{s.nickname(b.user_id)}</h3><p>{b.items.map(i=>`${i.name} ${i.quantity}개`).join(' · ')}</p><b>{money(b.total)}</b></section>)}<p>{o.state?.meeting} · {o.state?.meeting_time&&new Date(o.state.meeting_time).toLocaleString('ko-KR')}</p>{o.orderPeople.filter(p=>o.members.some(m=>m.user_id===p.user_id)).map(p=><p key={p.user_id}>{s.nickname(p.user_id)} · 부담액 {money(orderDue(p))} · {p.received_at?'수령 완료':'수령 전'}</p>)}</Modal>}<div className="baef-order-hub-bar"><span>주문 진행 · {o.owner?'리더':'참가자'}</span><button onClick={()=>push('chat')}>채팅 열기</button></div>{stage==='menu'?<OrderMenu key={key} pop={pop} push={push}/>:stage==='payment'?<OrderPayment key={key} pop={pop} push={push}/>:stage==='delivery'?<OrderDelivery key={key} pop={pop} push={push}/>:stage==='receipt'?<OrderReceipt key={key} pop={pop} push={push}/>:<OrderComplete key={key} pop={pop} push={push}/>}</>
}
export function OrderChatControls({push}:{push:Navigate}){
  const o=useDeliveryLifecycle()
  const next=orderNextStep({role:o.owner?'leader':'participant',application:'accepted',phase:o.state?.phase,count:o.members.length,virtualLeader:useSharedDelivery().isVirtual?.(o.post?.owner_id??'')})
  return <button className="chat-tool chat-order-link" onClick={()=>push(next.route)}>{next.action}<span aria-hidden="true">→</span></button>
}
export function PersonProfile({userId,close}:{userId:string;close:()=>void}){
  const s=useSharedDelivery(),o=useDeliveryLifecycle(),rep=o.reputation(userId)
  const [report,setReport]=useState(false),[sent,setSent]=useState(false)
  const reviews=o.reviews.filter(r=>r.subject_id===userId&&!s.isVirtual?.(r.reviewer_id)&&!s.isVirtual?.(userId))
  const canReport=userId!==o.uid&&o.members.some(m=>m.user_id===userId)&&o.members.some(m=>m.user_id===o.uid)
  return <div className="baef-overlay" role="dialog" aria-modal="true" aria-labelledby="person-heading"><section className="baef-sheet"><div className="baef-sheet-title"><h2 id="person-heading">{s.nickname(userId)}</h2><button aria-label="프로필 닫기" className="baef-icon-button" onClick={close}><SmallIcon name="close"/></button></div><p className="baef-reputation">{rep?.rating!=null?`★ ${rep.rating}`:'아직 별점 없음'} · 공동배달 {rep?.trades??0}회 · 후기 {rep?.review_count??0}개</p>{reviews.map(r=><div className="baef-review" key={r.id}><b>★ {r.stars}</b><p>{r.comment||'별점만 남겼어요.'}</p><small>{new Date(r.created_at).toLocaleDateString('ko-KR')}</small></div>)}{!reviews.length&&<p className="baef-muted">완료한 거래의 후기가 여기에 쌓여요.</p>}
    {canReport&&<button className="baef-text-cancel" onClick={()=>setReport(!report)}>이 참가자 신고</button>}{report&&!sent&&<form className="baef-order-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(await o.act('report',{user_id:userId,reason:f.get('reason'),detail:f.get('detail')}))setSent(true)}}><label>사유<select name="reason"><option>약속 불이행</option><option>입금·환불 문제</option><option>부적절한 대화</option><option>기타</option></select></label><label>상황 설명<textarea name="detail" maxLength={1000} required/></label><p className="baef-muted">신고는 검토 후 처리돼요. 신고만으로 상대가 정지되지는 않아요.</p><button className="baef-button" disabled={o.busy}>신고 접수</button></form>}{sent&&<p role="status" className="baef-muted">신고를 접수했어요. 내 정보에서 처리 상태를 확인할 수 있어요.</p>}{o.error&&<p className="baef-error" role="alert">{o.error}</p>}
  </section></div>
}
export function OrderParticipants(){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),[person,setPerson]=useState<string|null>(null)
  return <><InfoDetails title="함께하는 배프" summary={`${o.members.length}명 · 프로필과 평판`}>{o.members.map(m=>{const r=o.reputation(m.user_id);return <button key={m.id} className="baef-person-row" onClick={()=>setPerson(m.user_id)}><span className="baef-avatar">{s.nickname(m.user_id).slice(0,1)}</span><span><b>{s.nickname(m.user_id)}{m.user_id===o.post?.owner_id?' · 리더':''}</b><small>{r?.rating!=null?`★ ${r.rating}`:'첫 거래를 기다려요'} · {r?.trades??0}회</small></span><span>›</span></button>})}</InfoDetails>{person&&<PersonProfile userId={person} close={()=>setPerson(null)}/>}</>
}
export function ApplicantReputation({userId}:{userId:string}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),[profile,setProfile]=useState(false)
  const rep=o.reputation(userId)
  const latest=o.reviews.filter(r=>r.subject_id===userId&&r.comment.trim()).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]
  return <><div className="baef-applicant-identity"><span className="baef-avatar" aria-hidden="true">{s.nickname(userId).slice(0,1)}</span><b>{s.nickname(userId)}</b></div>{rep?<p className="baef-applicant-reputation">{rep.rating!=null?`★ ${rep.rating}`:'아직 별점 없음'} · 공동배달 {rep.trades}회 · 후기 {rep.review_count}개</p>:<p className="baef-muted" role="status">{o.error?'평판을 불러오지 못했어요.':o.available?'확인할 평판 정보가 없어요.':'평판 불러오는 중…'}</p>}{latest&&<p className="baef-applicant-review"><span>최근 후기</span>{latest.comment}</p>}<button type="button" className="baef-text-action" onClick={()=>setProfile(true)}>프로필·후기 보기 →</button>{profile&&<PersonProfile userId={userId} close={()=>setProfile(false)}/>}</>
}
export function RoomTimeEditor(){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),feedback=useSaveFeedback()
  let start:string|null=null,end:string|null=null
  try{const meta=JSON.parse(o.post?.note??'{}');start=meta.starts_at??null;end=meta.ends_at??null}catch{/* Older rooms can choose a new time. */}
  const currentTime=o.state?.meeting_time??start??null
  const [base,setBase]=useState(currentTime)
  const [baseVersion,setBaseVersion]=useState(o.state?.updated_at??null)
  const [basePost,setBasePost]=useState(o.selectedId)
  const dirty=feedback.status==='dirty',conflict=dirty&&base!==currentTime
  useEffect(()=>{if(basePost!==o.selectedId||!dirty){setBase(currentTime);setBaseVersion(o.state?.updated_at??null);setBasePost(o.selectedId);if(basePost!==o.selectedId)feedback.reset()}},[currentTime,o.state?.updated_at,o.selectedId,dirty])
  if(!o.owner||!o.post||o.state?.phase!=='menu')return null
  const duration=start&&end?new Date(end).getTime()-new Date(start).getTime():3600000
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(conflict)return;const f=new FormData(e.currentTarget),time=pickupTimestamp(String(f.get('meeting_day')??''),String(f.get('time')??''));if(!time||new Date(time).getTime()<=Date.now()){o.setError('앞으로의 수령 시간을 골라 주세요.');return}const version=feedback.begin();if(await o.act('room-time',{start:time,end:new Date(new Date(time).getTime()+(duration>0&&duration<=14400000?duration:3600000)).toISOString(),expected:baseVersion})){feedback.saved(version);s.setNotice('방을 유지하고 수령 시간을 변경했어요. 참가자에게도 변경된 시간이 표시돼요.')}}
  return <InfoDetails title="수령 약속 시간 변경" summary="방·참가자·메뉴·채팅을 유지하고 시간만 수정"><form key={`${o.selectedId}:${base}`} className="baef-order-form" onChange={feedback.change} onSubmit={submit}>{conflict&&<div className="baef-sync-conflict" role="status"><p>수령 시간이 변경됐어요. 최신 시간을 확인해 주세요.</p><button type="button" className="baef-button secondary" onClick={()=>{setBase(currentTime);setBaseVersion(o.state?.updated_at??null);feedback.reset()}}>최신 시간 불러오기</button></div>}<PickupTimeField value={base}/><p className="baef-muted">리더가 주문을 확정하기 전까지 변경할 수 있어요.</p><button className="baef-button secondary" disabled={o.busy||conflict}>{o.busy?'변경 중…':'이 방의 시간 변경'}</button><SaveFeedback status={feedback.status}/></form></InfoDetails>
}
export function MeetingTools(){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),{currentLocation}=usePreferences()
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
  return <InfoDetails id="order-meeting" title="수령 장소와 시간" initiallyOpen={o.state?.phase==='menu'&&(!o.state.meeting_time||!!o.state.nearby_requester&&!o.state.nearby_agreed&&o.state.nearby_requester!==o.uid)} summary={<>{o.state?.meeting||o.post?.meeting||'장소 미정'} · {o.state?.meeting_time?new Date(o.state.meeting_time).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시간 설정 필요'}{o.state?.nearby_requester&&!o.state.nearby_agreed&&' · 근처 수령 제안 동의 대기'}</>}>
    {editable&&o.state&&<MeetingEditor key={o.selectedId} state={o.state} suggestedDate={suggestedDate}/>}
    <section className="ux-place-candidates"><h3>공개 수령 장소 후보</h3><p className="baef-muted">출발점 기준 직선거리예요. 실제 도보 경로와 출입 가능 여부를 함께 확인해 주세요.</p>{pickupCandidates(points.length?points:currentLocation.coordinates?[currentLocation.coordinates]:[]).map(p=><ActionButton key={p.id} secondary disabled={!editable||!!o.state?.nearby_agreed} onClick={()=>void o.act('meeting',{meeting:p.name,time:o.state?.meeting_time,lat:p.lat,lng:p.lng})}>{p.name} · 최대 약 {Math.max(...p.distances)}m</ActionButton>)}{!points.length&&<p className="baef-muted">내 위치를 확인하면 가까운 후보를 볼 수 있어요. 전원이 위치를 공유하면 모두의 거리를 비교해요.</p>}</section>
    <details className="baef-order-details"><summary>참가자 위치·중간 지점 지도</summary><p className="baef-muted">내 위치 공유는 선택이에요. 공유한 위치는 이 모임의 참가자에게 표시돼요.</p>{!['completed','cancelled'].includes(o.state?.phase??'')&&(o.mine?.latitude!=null?<ActionButton secondary onClick={()=>void o.act('share-location',{})}>내 위치 공유 끄기</ActionButton>:<><button className="baef-button secondary" disabled={currentLocation.loading} onClick={currentLocation.request}>현재 위치 확인</button><ActionButton secondary disabledReason={!currentLocation.coordinates?'현재 위치를 먼저 확인해 주세요.':''} onClick={()=>{const p=currentLocation.coordinates;if(p)void o.act('share-location',{lat:p.lat,lng:p.lng})}}>이 모임에 내 위치 공유</ActionButton></>)}{currentLocation.error&&<p className="baef-error">{currentLocation.error}</p>}
      {!!pins.length&&<div className="baef-order-map"><Suspense fallback={<p>지도 불러오는 중…</p>}><LocationMap pins={pins} onSelect={()=>{}} title="함께 수령할 참가자와 장소" center={pins[0].coordinates}/></Suspense></div>}
      {candidate&&feasible?<><p className="baef-muted">중간 지점까지 각자 약 {Math.ceil(Math.max(...points.map(p=>distanceM(p,candidate))))}m 이내예요. 직선거리 기준이므로 길과 출입 가능 여부를 함께 확인해 주세요.</p>{editable&&!o.state?.nearby_agreed&&<ActionButton secondary onClick={()=>void o.act('meeting',{meeting:'중간 지점 · 채팅에서 상세 위치 확인',time:o.state?.meeting_time,lat:candidate.lat,lng:candidate.lng})}>중간 지점을 수령 후보로 저장</ActionButton>}</>:<p className="baef-muted">{points.length<o.members.length?'참가자 전원이 위치를 공유하면 중간 지점을 비교할 수 있어요.':'현재 위치들의 중간점은 모두의 400m 범위 안에 들어오지 않아요. 장소를 다시 조율해 주세요.'}</p>}
    </details>
    {o.members.length!==2&&o.state?.phase==='menu'&&<p className="baef-muted">내 근처에서 받기는 2인 모임에서 선택할 수 있어요.</p>}{o.members.length===2&&o.state?.phase==='menu'&&<details className="baef-order-details" open={!!o.state.nearby_requester&&!o.state.nearby_agreed}><summary>내 근처에서 받기</summary><p className="baef-muted">배달 주소를 요청자 근처로 정해요. 요청자는 배달비 전액, 이동하는 상대는 배달비 0원이에요. 상대가 동의해야 적용돼요.</p>{o.state.nearby_requester?<><p>{s.nickname(o.state.nearby_requester)}님의 제안 · {o.state.nearby_address}</p><b>{o.state.nearby_agreed?'상대 동의 완료':'상대 동의 대기'}</b>{o.state.nearby_requester!==o.uid&&!o.state.nearby_agreed&&<ActionButton onClick={()=>void o.act('nearby-agree')}>이 장소로 이동하고 배달비 0원에 동의</ActionButton>}<ActionButton secondary onClick={()=>void o.act('nearby-reset')}>제안 취소·다시 조율</ActionButton></>:<><label className="baef-order-field">내 근처 공개 수령 장소<input value={address} maxLength={200} onChange={e=>setAddress(e.target.value)} placeholder="건물 앞 등 만날 수 있는 장소"/></label><ActionButton disabled={!address.trim()} onClick={()=>void o.act('nearby-propose',{address:address.trim()})}>내 근처 수령 제안</ActionButton></>}</details>}
  </InfoDetails>
}
export function OrderMenu({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),d=useMenuDiscovery(),accountFeedback=useSaveFeedback()
  const [tool,setTool]=useState<'menus'|'meeting'|'account'|'people'|null>(null)
  if(!o.post)return <Page title="주문 진행" pop={pop}><p>참여 중인 모임을 선택해 주세요.</p></Page>
  const orders=d.baskets.filter(b=>b.post_id===o.post!.id&&o.members.some(m=>m.user_id===b.user_id)&&b.total>0)
  const amount=orders.reduce((sum,b)=>sum+b.total,0)
  const meetingReady=!!o.state?.meeting&&!!o.state.meeting_time
  const accountReady=!!o.state?.bank&&!!o.state.account&&!!o.state.holder
  const finalizeReason=o.state&&!pickupAgreed(o.state,o.members)?'모두 비대면 수령 안내에 동의해 주세요.':o.state?.nearby_requester&&!o.state.nearby_agreed?'내 근처에서 받기 제안에 동의하거나 제안을 취소해 주세요.':o.orderPeople.some(p=>p.transfer_review_pending)?'취소한 참가자의 송금 여부를 먼저 확인해 주세요.':o.members.length<2?'함께 주문할 배프가 한 명 더 필요해요.':orders.length<o.members.length?'모든 참가자가 메뉴를 저장해야 해요.':amount<o.post.min_order?`목표금액까지 ${money(o.post.min_order-amount)} 더 필요해요.`:!meetingReady?'수령 장소와 시간을 저장해 주세요.':!accountReady?'송금받을 리더 계좌를 저장해 주세요.':''
  const ownMenuSaved=orders.some(b=>b.user_id===o.uid)
  const guide=!ownMenuSaved?{title:'내 메뉴를 골라 저장해 주세요',description:'아래 주문 메뉴에서 먹고 싶은 메뉴와 수량을 확인하고 저장해 주세요.',target:'order-menus',action:'내 메뉴 고르기'}:!meetingReady?{title:'수령 장소와 시간을 정해 주세요',description:'채팅에서 합의한 장소와 시간을 아래에 저장해 주세요.',target:'order-meeting',action:'수령 장소·시간 설정'}:o.state&&!pickupAgreed(o.state,o.members)?{title:'비대면 수령 안내에 동의해 주세요',description:'놓을 위치와 음식 구분 방법을 확인해 주세요. 모두 동의해야 주문할 수 있어요.',target:'order-pickup',action:'비대면 수령 안내 확인'}:o.owner&&!accountReady?{title:'송금받을 계좌를 저장해 주세요',description:'은행·계좌번호·예금주를 저장하면 참가자가 이 계좌로 송금해요.',target:'order-account',action:'리더 계좌 설정'}:orders.length<o.members.length?{title:'다른 배프의 메뉴 선택을 기다리고 있어요',description:'모든 참가자가 메뉴를 저장하면 주문을 확정할 수 있어요.'}:amount<o.post.min_order?{title:`목표금액까지 ${money(o.post.min_order-amount)} 더 필요해요`,description:'추가할 메뉴가 있는지 채팅에서 함께 확인해 주세요.',target:'order-menus',action:'메뉴 확인하기'}:o.owner?{title:o.post.status==='open'?'준비를 마쳤어요. 모집을 마감해 주세요':'준비를 마쳤어요. 주문을 확정해 주세요',description:'아래 버튼을 누르면 송금 단계로 이어져요.',target:'order-confirm',action:'다음 단계로 이동'}:{title:'내 준비를 마쳤어요. 리더의 주문 확정을 기다려 주세요',description:s.isVirtual?.(o.post.owner_id)?'가상 리더가 메뉴를 확인하면 주문 진행 버튼이 표시돼요.':'리더가 확정하면 이 화면에서 내 송금액과 계좌가 보여요.'}
  const account=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const version=accountFeedback.begin(),f=new FormData(e.currentTarget);if(await o.act('account',{bank:f.get('bank'),account:f.get('account'),holder:f.get('holder')})){accountFeedback.saved(version);s.setNotice('리더 계좌를 저장했어요.')}}
  const ownBasket=orders.find(b=>b.user_id===o.uid)
  const pendingRequests=s.members.filter(m=>m.post_id===o.selectedId&&m.status==='pending'&&m.active).length
  const primary= <>{o.state?.phase==='menu'?(o.owner?<>{o.members.length<2?<ActionButton onClick={()=>push('applicants')}>함께할 배프·신청자 확인</ActionButton>:o.post.status==='open'?<ActionButton disabled={s.busy} onClick={()=>void s.act('close',o.post!.id)}>현재 인원으로 모집 마감</ActionButton>:<ActionButton disabledReason={o.post.status!=='closed'?'모집 마감 상태를 확인해 주세요.':finalizeReason} onClick={()=>void o.act('finalize').then(ok=>{if(ok)push('payment')})}>주문 확정하고 송금으로</ActionButton>}</>:<><p className="baef-muted">리더가 주문을 확정하면 송금 단계가 열려요.</p><ActionButton secondary onClick={()=>push('chat')}>채팅에서 함께 확인하기</ActionButton></>):<ActionButton onClick={()=>push(o.state?.phase==='completed'?'complete':'payment')}>다음 진행 확인</ActionButton>}</>
  return <Page title="내 메뉴와 주문 준비" pop={pop} footer={primary}>
    <div className="live-order-role"><span>{o.owner?'리더':'참가자'} · {o.members.length}명 함께 주문</span><button onClick={()=>push('chat')}><Icon name="chat" size={17}/>채팅</button></div>
    {o.state?.phase==='menu'&&<><OrderGuide title={guide.title} description={guide.description}/>{guide.target&&guide.target!=='order-confirm'&&<button className="baef-text-action baef-guide-link" onClick={()=>setTool(guide.target==='order-menus'?'menus':guide.target==='order-account'?'account':'meeting')}>{guide.action} →</button>}<ul className="baef-prep-checks"><li data-done={orders.length===o.members.length&&orders.length>0}><span>{orders.length===o.members.length&&orders.length>0?'✓':'○'}</span>메뉴 {orders.length}/{o.members.length}명</li><li data-done={meetingReady}><span>{meetingReady?'✓':'○'}</span>수령 장소·시간</li>{o.owner&&<li data-done={accountReady}><span>{accountReady?'✓':'○'}</span>리더 계좌</li>}</ul></>}
    {o.owner&&pendingRequests>0&&<button className="live-order-applicants" onClick={()=>push('applicants')}><Icon name="users" size={23}/><span><b>참가 신청 {pendingRequests}명이 기다려요</b><small>프로필과 후기를 보고 수락해 주세요</small></span><Icon name="chevron" size={18}/></button>}
    <section className="live-order-menu-summary"><div className="baef-section-title"><h2>내 주문 메뉴</h2>{o.state?.phase==='menu'&&<button className="baef-text-action" onClick={()=>setTool('menus')}>{ownBasket?'수정':'메뉴 담기'}<Icon name="edit" size={15}/></button>}</div>{ownBasket?<><p>{ownBasket.items.map(i=>`${i.name} ${i.quantity}개`).join(' · ')}</p><strong>{money(ownBasket.total)}</strong></>:<button className="live-empty-menu" onClick={()=>setTool('menus')}><Icon name="plus" size={22}/>먹고 싶은 메뉴를 담아 주세요</button>}</section>
    <section className="live-order-meeting-summary"><div className="baef-section-title"><h2>수령 장소와 시간</h2><button className="baef-text-action" onClick={()=>setTool('meeting')}>{o.state?.phase==='menu'?'변경':'확인'}</button></div><button className="live-order-summary-row" onClick={()=>setTool('meeting')}><span className="bv-round-icon"><Icon name="pin"/></span><span><b>{o.state?.meeting||o.post.meeting||'함께 정해 주세요'}</b><small>{o.state?.meeting_time?new Date(o.state.meeting_time).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시간을 정해 주세요'} · {o.state?.nearby_agreed?'내 근처 수령':o.state?.pickup_mode==='contactless'?'비대면 수령':'직접 만나기'}</small></span><Icon name="chevron" size={18}/></button>{o.state?.nearby_requester&&!o.state.nearby_agreed&&<button className="live-pickup-pending" onClick={()=>setTool('meeting')}>{o.state.nearby_requester===o.uid?'내 수령 제안을 확인하고 있어요':'내 근처 수령 제안이 왔어요 · 확인하기 →'}</button>}{o.state&&!pickupAgreed(o.state,o.members)&&<button className="live-pickup-pending" onClick={()=>setTool('meeting')}>비대면 수령 안내에 동의해 주세요 →</button>}</section>
    {o.owner&&o.state?.phase==='menu'&&<button className="live-order-account" onClick={()=>setTool('account')}><Icon name="wallet" size={24}/><span><b>송금받을 계좌</b><small>{accountReady?`${o.state.bank} · ${o.state.holder}`:'아직 등록하지 않았어요'}</small></span>{accountReady?<Icon name="check" size={19}/>:<span className="baef-text-action">등록하기 →</span>}</button>}
    <button className="live-order-people" onClick={()=>setTool('people')}><Icon name="users" size={23}/><span><b>함께하는 배프 {o.members.length}명</b><small>주문 메뉴·프로필·거래 후기 보기</small></span><Icon name="chevron" size={18}/></button>
    <p className="live-order-cost">현재 모인 메뉴 <b>{money(amount)}</b> · 목표 {money(o.post.min_order)}<br/>균등 분담 시 배달비 약 <b>{money(Math.ceil(o.post.delivery_fee/Math.max(2,o.members.length)))}</b>씩</p><WalkingRewardPlan/>
    {tool==='menus'&&<Modal title="내 메뉴 확인" close={()=>setTool(null)}><BasketEditor postId={o.post.id}/></Modal>}
    {tool==='meeting'&&<Modal title="수령 장소와 방법" close={()=>setTool(null)}><MeetingTools/><PickupMethod/>{o.error&&<p role="alert" className="baef-error">{o.error}</p>}</Modal>}
    {tool==='account'&&o.state&&<Modal title="송금받을 계좌" close={()=>setTool(null)}><p className="baef-muted">함께 주문하는 참가자가 이 계좌로 송금해요.</p><form className="baef-order-form" onChange={accountFeedback.change} onSubmit={async e=>{await account(e)}}><label>은행<input name="bank" defaultValue={o.state.bank} maxLength={30} required/></label><label>계좌번호<input name="account" defaultValue={o.state.account} maxLength={40} inputMode="numeric" required/></label><label>예금주<input name="holder" defaultValue={o.state.holder} maxLength={30} required/></label><button className="baef-button" disabled={o.busy}>{o.busy?'저장 중…':'계좌 저장'}</button><SaveFeedback status={accountFeedback.status}/>{o.error&&<p role="alert" className="baef-error">{o.error}</p>}</form></Modal>}
    {tool==='people'&&<Modal title="함께하는 배프" close={()=>setTool(null)}><BasketEditor postId={o.post.id}/><OrderParticipants/></Modal>}
  </Page>
}
export function OrderPayment({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),[copy,setCopy]=useState('')
  if(!o.state||!o.post)return <Page title="송금 현황" pop={pop}><p>모임을 선택해 주세요.</p></Page>
  if(o.state.phase==='menu'&&!o.orderPeople.some(p=>p.transfer_review_pending||p.refund_due>0))return <Page title="송금 현황" pop={pop}><p>메뉴·계좌·수령 장소를 정하고 주문 내용을 확정하면 송금할 수 있어요.</p><ActionButton onClick={()=>push('menu')}>메뉴와 주문 확정으로</ActionButton></Page>
  if(s.isVirtual?.(o.post.owner_id)&&o.state.phase!=='cancelled'&&o.members.some(m=>m.user_id===o.uid))return <Page title="가상 리더의 주문" pop={pop} footer={o.state.phase==='payment'?<ActionButton disabled={s.busy} onClick={()=>void s.act('virtual-order',o.post!.id).then(ok=>{if(ok)push('delivery')})}>주문 진행</ActionButton>:<ActionButton onClick={()=>push(o.state!.phase==='arrived'?'receipt':o.state!.phase==='completed'?'complete':'delivery')}>진행 상태 확인</ActionButton>}>
    <OrderGuide title="메뉴 준비가 끝났어요" description="가상 리더와 함께 주문을 진행해 보세요."/>
    <section className="baef-payment-amount"><span>내 예상 부담액</span><strong>{money(o.mine?orderDue(o.mine):0)}</strong></section>
    <p className="baef-muted">{s.nickname(o.post.owner_id)} · {phaseLabel[o.state.phase]}</p>
  </Page>
  const members=o.orderPeople.filter(p=>o.members.some(m=>m.user_id===p.user_id))
  const paid=members.filter(p=>p.user_id!==o.post!.owner_id&&remainingTransfer(p)===0).length
  const platformSupport=o.state.coupon_funding==='platform'?members.reduce((sum,p)=>sum+p.coupon_discount,0):0
  const ledger=members.map(p=><div className="baef-ledger-person" key={p.user_id}><b>{s.nickname(p.user_id)}</b><span>{money(orderDue(p))}</span><small>{s.isVirtual?.(p.user_id)?'가상 참가자 · 준비 완료':p.user_id===o.post!.owner_id?o.state!.leader_ready?'결제 준비 완료':'결제 준비 전':remainingTransfer(p)===0?'입금 확인 완료':p.claimed_amount>p.confirmed_amount?'리더 확인 대기':'송금 전'}</small>{o.owner&&!s.isVirtual?.(p.user_id)&&p.user_id!==o.uid&&p.claimed_amount>p.confirmed_amount&&o.state!.phase==='payment'&&<ActionButton secondary onClick={()=>void o.act('confirm-transfer',{user_id:p.user_id})}>{s.nickname(p.user_id)} 입금 확인</ActionButton>}</div>)
  const paymentAction=o.members.some(m=>m.user_id===o.uid)&&o.state.phase==='payment'&&(o.owner?(!o.state.leader_ready?<ActionButton onClick={()=>void o.act('leader-ready')}>내 결제 준비 완료</ActionButton>:<ActionButton disabledReason={paid!==o.members.length-1?'모든 참가자의 입금을 확인해 주세요.':o.orderPeople.some(p=>p.transfer_review_pending)?'취소한 참가자의 송금 여부를 먼저 확인해 주세요.':o.orderPeople.some(p=>p.refund_due>0)?'남은 환불 확인을 마쳐 주세요.':''} onClick={()=>{if(confirm('배달앱에서 주문을 완료했나요? 이후에는 일반 취소가 불가능해요.'))void o.act('order').then(ok=>{if(ok)push('delivery')})}}>배달앱 주문 완료 기록</ActionButton>):<ActionButton disabledReason={!o.mine?'내 주문 정보를 불러오는 중이에요.':remainingTransfer(o.mine)===0?'입금 확인이 완료됐어요.':o.mine.claimed_amount>o.mine.confirmed_amount?'리더의 입금 확인을 기다리고 있어요.':''} onClick={()=>void o.act('claim-transfer')}>송금했어요</ActionButton>)
  return <Page title={o.state.phase==='cancelled'?'취소·환불 현황':o.owner?'입금 확인과 주문':'리더에게 송금'} pop={pop} footer={paymentAction}>
    {o.state.phase!=='cancelled'&&o.state.phase!=='menu'&&o.members.some(m=>m.user_id===o.uid)&&<>{o.state.phase==='payment'&&<OrderGuide title={o.owner?'참가자의 입금 확인 → 배달앱에서 주문':'계좌 확인 → 송금 → 송금 완료 표시'} description={o.owner?'각 참가자의 입금을 확인한 뒤 배달앱에서 주문하고, 아래에서 주문 완료를 기록해 주세요.':'아래 계좌로 내 금액을 보내고 ‘송금했어요’를 눌러 주세요. 리더가 입금을 확인하고 최종 주문해요.'}/>}
      {o.mine&&<section className="baef-payment-amount"><span>{o.owner?'내 부담액':'총 송금액'}</span><strong>{money(orderDue(o.mine))}</strong>{!o.owner&&<p className="baef-muted">{remainingTransfer(o.mine)===0?'입금 확인 완료':o.mine.claimed_amount>o.mine.confirmed_amount?'리더 입금 확인 대기':`남은 송금액 ${money(remainingTransfer(o.mine))}`}</p>}<details className="baef-amount-breakdown"><summary>금액 상세</summary><div className="baef-bill"><p>내 음식값 <b>{money(o.mine.food_total)}</b></p><p>내 배달비 <b>{money(o.mine.fee)}</b></p>{o.mine.coupon_discount>0&&<p>{o.state.coupon_funding==='platform'?'배프 지원 쿠폰':'쿠폰'} <b>−{money(o.mine.coupon_discount)}</b></p>}</div></details></section>}
      <section className="baef-profile-section baef-bank-card"><h2>{o.state.bank} · {o.state.holder}</h2><p className="baef-account-number">{o.state.account}</p><button className="baef-text-action" onClick={()=>void navigator.clipboard.writeText(o.state!.account).then(()=>setCopy('계좌번호를 복사했어요.')).catch(()=>setCopy('복사하지 못했어요. 계좌번호를 직접 확인해 주세요.'))}>계좌번호 복사</button>{copy&&<p role="status" className="baef-muted">{copy}</p>}</section>
      {o.state.nearby_agreed&&<p className="baef-muted">내 근처 수령 · 요청자 {s.nickname(o.state.nearby_requester!)}님이 배달비 전액 부담</p>}
      {o.state.phase==='payment'&&o.couponEligible&&o.state.coupon_funding==='platform'&&!o.owner&&!o.state.nearby_agreed&&!o.mine?.coupon_discount&&<ActionButton secondary onClick={()=>void o.act('coupon')}>배프 지원 쿠폰 적용 · 최대 1,000원</ActionButton>}
      {o.owner?<section className="baef-profile-section"><h2>참가자 입금 확인 {paid}/{Math.max(0,o.members.length-1)}</h2>{ledger}</section>:<InfoDetails title="전체 입금 현황" summary={`${paid}/${Math.max(0,o.members.length-1)}명 확인 완료`}>{ledger}</InfoDetails>}
      {platformSupport>0&&<section className="baef-bill"><p>참여자 부담 합계 <b>{money(members.reduce((sum,p)=>sum+orderDue(p),0))}</b></p><p>배프 쿠폰 지원 <b>{money(platformSupport)}</b></p><p className="total">전체 주문금액 <b>{money(members.reduce((sum,p)=>sum+p.food_total+p.fee,0))}</b></p></section>}
      {['ordered','delivering','arrived','completed'].includes(o.state.phase)&&<ActionButton onClick={()=>push(o.state!.phase==='completed'?'complete':'delivery')}>주문 진행 확인</ActionButton>}
    </>}
    {o.state.phase==='cancelled'&&s.chatReadable&&<ActionButton secondary onClick={()=>push('chat')}>취소 전 채팅 보기</ActionButton>}
    {o.orderPeople.filter(p=>p.transfer_review_pending).map(p=><section className="baef-profile-section" key={`check:${p.user_id}`}><h2>{s.nickname(p.user_id)} 송금 여부 확인 중</h2><p className="baef-muted">송금 표시 금액 {money(p.claimed_amount)} · 확인된 입금 {money(p.confirmed_amount)}<br/>추가 송금 여부를 확인한 뒤 환불할 금액을 확정해요.</p>{o.owner&&<ActionButton secondary onClick={()=>{if(confirm(`${s.nickname(p.user_id)}님의 총 입금액 ${money(p.claimed_amount)}이 계좌에서 확인되었나요?`))void o.act('confirm-cancelled-transfer',{user_id:p.user_id})}}>계좌에서 입금 확인했어요</ActionButton>}{p.user_id===o.uid&&<ActionButton secondary onClick={()=>{if(confirm('리더가 확인한 금액 외에 추가로 송금하지 않았고, 송금 표시를 잘못 누른 것이 맞나요?'))void o.act('retract-transfer-claim')}}>송금 표시를 잘못 눌렀어요</ActionButton>}</section>)}
    {o.orderPeople.filter(p=>p.refund_due>0).map(p=><section className="baef-profile-section" key={p.user_id}><h2>{s.nickname(p.user_id)} 환불 {money(p.refund_due)}</h2><p className="baef-muted">{p.refund_sent?'환불 보냄 · 수령 확인 대기':'리더 환불 대기'}</p>{o.owner&&!p.refund_sent&&<ActionButton secondary disabledReason={p.transfer_review_pending?'추가 송금 여부를 먼저 확인해 주세요.':''} onClick={()=>void o.act('refund-sent',{user_id:p.user_id})}>환불을 보냈어요</ActionButton>}{p.user_id===o.uid&&p.refund_sent&&<ActionButton disabledReason={p.transfer_review_pending?'추가 송금 여부를 먼저 확인해 주세요.':''} onClick={()=>void o.act('refund-received')}>환불을 받았어요</ActionButton>}</section>)}
  </Page>
}
export function OrderDelivery({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle()
  return <Page title="주문·배달 현황" pop={pop}><OrderGuide title={o.owner?'배달 진행을 확인하고 음식 도착을 알려 주세요':'음식이 도착할 때까지 기다려 주세요'} description={o.state?.pickup_mode==='contactless'?'비대면 수령으로 정했어요. 리더가 음식을 놓으면 사진을 확인하고 찾아갈 수 있어요.':o.owner?'배달앱에서 진행 상황을 확인하고, 음식이 도착하면 아래 버튼을 눌러 주세요.':'수령 장소와 시간을 확인해 주세요. 리더가 도착을 알리면 이 화면에서 수령 단계로 이어져요.'}/><h2 className="baef-flow-status">{o.state?phaseLabel[o.state.phase]:'아직 주문 전이에요'}</h2><p className="baef-muted">리더가 배달앱에서 확인한 진행 상황을 기록해요.</p><MeetingTools/><WalkingRewardReceipt/>{o.owner&&o.state?.phase==='ordered'&&<ActionButton onClick={()=>void o.act('delivering')}>배달 중으로 표시</ActionButton>}{o.owner&&['ordered','delivering'].includes(o.state?.phase??'')&&<ActionButton onClick={()=>void o.act('arrive')}>음식 도착 확인</ActionButton>}{['arrived','completed'].includes(o.state?.phase??'')&&<ActionButton onClick={()=>push(o.state!.phase==='completed'?'complete':'receipt')}>내 음식 수령 확인</ActionButton>}{['menu','payment'].includes(o.state?.phase??'menu')&&<ActionButton secondary onClick={()=>push('payment')}>송금·주문 준비 확인</ActionButton>}<ActionButton secondary onClick={()=>push('chat')}>채팅방으로</ActionButton></Page>
}
export function OrderReceipt({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  const received=o.orderPeople.filter(p=>p.received_at&&o.members.some(m=>m.user_id===p.user_id)).length
  const lateAllowed=o.state?.arrived_at&&Date.now()>=Math.max(new Date(o.state.arrived_at).getTime(),new Date(o.state.meeting_time??o.state.arrived_at).getTime())+600000
  return <Page title="음식 수령 확인" pop={pop}><h2 className="baef-flow-status">수령 확인 {received}/{o.members.length}</h2><p className="baef-muted">{o.state?.meeting} · {o.state?.meeting_time&&new Date(o.state.meeting_time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</p><OrderGuide title={o.mine?.received_at?'내 수령 확인을 마쳤어요':o.state?.pickup_mode==='contactless'&&!o.state.pickup_dropped_at?'음식을 놓았다는 알림을 기다려 주세요':'내 음식을 받은 뒤 수령을 확인해 주세요'} description={o.mine?.received_at?'모두 수령하면 거래가 완료되고 평가 단계로 이어져요.':'닉네임과 주문 메뉴를 확인하고, 실제로 찾아간 뒤 내 수령 완료를 눌러 주세요.'}/><PickupMethod receipt/>{o.members.map(m=>{const p=o.orderPeople.find(p=>p.user_id===m.user_id);return <div className="baef-ledger-person" key={m.id}><b>{s.nickname(m.user_id)}</b><small>{p?.received_at?'수령 완료':'수령 대기'}</small>{o.owner&&m.user_id!==o.uid&&!p?.received_at&&lateAllowed&&!p?.late_reported&&<ActionButton secondary onClick={()=>void o.act('late-report',{user_id:m.user_id})}>수령 지각 확인 요청</ActionButton>}</div>})}
    <WalkingRewardReceipt/>{o.state?.pickup_mode==='contactless'&&<ActionButton secondary onClick={()=>push('chat')}>음식이 없거나 다르면 채팅으로 확인</ActionButton>}
    {o.mine?.late_reported&&!o.mine.late_ack&&<section className="baef-profile-section"><h2>지각 확인 요청이 있어요</h2><p className="baef-muted">인정한 지각이 2회부터는 3일간 새 모집 참여가 제한돼요. 사실과 다르면 채팅으로 확인하거나 상대 프로필에서 신고할 수 있어요.</p><ActionButton secondary onClick={()=>{if(confirm('이번 수령 지각이 맞나요?'))void o.act('late-ack')}}>이번 지각을 인정해요</ActionButton></section>}
    {o.state?.phase==='completed'&&<ActionButton onClick={()=>push('complete')}>모두 수령 완료 · 거래 마무리</ActionButton>}{o.state?.phase!=='arrived'&&o.state?.phase!=='completed'&&<p className="baef-muted">음식 도착을 확인한 뒤 수령할 수 있어요.</p>}
  </Page>
}
export function OrderComplete({pop,push}:{pop:()=>void;push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  const canReview=o.members.some(m=>m.user_id!==o.uid&&!s.isVirtual?.(m.user_id))
  return <Page title="거래 완료" pop={pop}>{o.state?.phase==='completed'?<><h2 className="baef-flow-status">모든 배프가 음식을 받았어요.</h2><p className="baef-muted">{canReview?'함께한 사람에 대한 후기를 남겨 주세요.':'이번 모임의 기록과 이동 포인트를 확인해 보세요.'}</p><WalkingRewardPlan/><OrderParticipants/>{canReview&&<ActionButton onClick={()=>push('rating')}>별점·후기 남기기</ActionButton>}<ActionButton secondary onClick={()=>push('chat')}>지난 채팅 보기</ActionButton><ActionButton secondary onClick={()=>push('main')}>다음 메뉴 찾기</ActionButton></>:<><p>아직 모든 참가자가 수령하지 않았어요.</p><ActionButton onClick={()=>push('receipt')}>수령 현황 확인</ActionButton></>}</Page>
}
export function OrderRating({pop}:{pop:()=>void}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  return <Page title="함께한 배프 평가" pop={pop}>{o.state?.phase!=='completed'?<p>전원 수령 완료 후 평가할 수 있어요.</p>:o.members.filter(m=>m.user_id!==o.uid&&!s.isVirtual?.(m.user_id)).map(m=>{const saved=o.reviews.find(r=>r.post_id===o.selectedId&&r.subject_id===m.user_id&&r.reviewer_id===o.uid);return <section className="baef-profile-section" key={m.id}><h2>{s.nickname(m.user_id)}</h2>{saved?<p>★ {saved.stars} · {saved.comment||'평가 완료'}</p>:<form className="baef-order-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await o.act('review',{user_id:m.user_id,stars:Number(f.get('stars')),comment:f.get('comment')})}}><label>별점<select name="stars" defaultValue="5">{[5,4,3,2,1].map(n=><option key={n} value={n}>{n}점</option>)}</select></label><label>간단한 후기<textarea name="comment" maxLength={500} placeholder="약속 시간, 소통, 수령 경험을 남겨 주세요."/></label><button className="baef-button" disabled={o.busy}>평가 저장</button></form>}</section>})}</Page>
}
export function OrderProfileExtras({push}:{push:Navigate}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery()
  if(!s.session)return null
  return <><WalkingRewardWallet/><section className="baef-profile-section"><h2>내 평판과 이용 기록</h2><p>{o.myReputation?.rating!=null?`★ ${o.myReputation.rating}`:'아직 별점 없음'} · 공동배달 {o.myReputation?.trades??0}회 · 후기 {o.myReputation?.review_count??0}개</p>{s.me?.suspended_until&&new Date(s.me.suspended_until).getTime()>Date.now()&&<p className="baef-error">{new Date(s.me.suspended_until).toLocaleString('ko-KR')}까지 새 모집 참여가 제한돼요.</p>}<p className="baef-muted">인정한 수령 지각 {o.people.filter(p=>p.user_id===o.uid&&p.late_ack).length}회 · 2회부터 3일 제한</p></section>
    <InfoDetails title="우수 배프 혜택" summary={o.couponEligible?"쿠폰 사용 가능":"쿠폰 조건 보기"}><p>{o.couponEligible?'배달비 쿠폰 사용 가능':'별점 4.8 이상 · 완료 거래 5회부터 쿠폰을 받을 수 있어요.'}</p><p className="baef-muted">배프가 배달비를 최대 1,000원 지원해요. 계정당 1회, 일반 모임에서 송금 전에 사용할 수 있어요.</p></InfoDetails>
    <InfoDetails title="주문·환불 이력" summary={`${o.states.length}건`}>{o.states.map(v=>{const post=s.rawPosts.find(p=>p.id===v.post_id);if(!post)return null;return <button key={v.post_id} className="baef-history-row" onClick={()=>{s.selectPost(s.numberFor(v.post_id));push(v.phase==='cancelled'?'payment':v.phase==='completed'?'complete':'detail')}}><b>{post.restaurant}</b><span>{phaseLabel[v.phase]} ›</span></button>})}{!o.states.length&&<p className="baef-muted">참여한 주문이 여기에 쌓여요.</p>}</InfoDetails>
    <InfoDetails title="신고 처리 내역" summary={o.reports.some(r=>r.status==='pending')?'검토 중인 신고 있음':`${o.reports.length}건`}>{o.reports.map(r=><div className="baef-review" key={r.id}><b>{r.reporter_id===o.uid?'내가 접수한 신고':'나에 대한 신고'} · {r.reason}</b><p>{r.status==='pending'?'검토 대기':r.status==='confirmed'?'확인 후 처리':'종결'}</p>{r.resolution&&<p>{r.resolution}</p>}</div>)}{!o.reports.length&&<p className="baef-muted">접수된 신고가 없어요. 상대 프로필에서 신고할 수 있어요.</p>}</InfoDetails>{o.error&&<p className="baef-error" role="alert">{o.error}</p>}</>
}
